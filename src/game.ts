import {
  BEAR, CAMP, CASH_ZONE, COUNTER, COUNTER_MAX, DEPOSIT_ZONE, FIRST_WAVE_IN, FOREST, GATES, PADS, PAD_ORDER, PAD_SIZE,
  PLAYER, QUEUE, TOWER, TREE, WAVE_GAP, wallMax, WORKER, WORLD, fenceBoxes, inBox, inCamp, mulberry32,
  type Box, type PadDef, type PadId, type Pt,
} from './data';
import { sfx, vibrate } from './audio';
import { T, fmt } from './i18n';

export interface Tree { x: number; z: number; hp: number; respawnT: number; shake: number; grow: number; reserved: boolean; }
export interface StackLog { anim: number; fx: number; fy: number; fz: number; }
export interface Survivor {
  id: number; x: number; z: number; want: number; got: number; slot: number;
  state: 'walk' | 'wait' | 'leave'; serveT: number; walkT: number; face: number; path: Pt[];
}
export interface Bear {
  id: number; x: number; z: number; hp: number; maxHp: number; homeZ: number;
  state: 'spawn' | 'approach' | 'attack' | 'chase' | 'dead';
  delay: number; atkT: number; flash: number; hitT: number; deadT: number; face: number; walkT: number;
}
export interface Tower { id: PadId; x: number; z: number; cd: number; aim: number; recoil: number; }
export interface Bolt { id: number; x: number; y: number; z: number; dx: number; dy: number; dz: number; target: number; dmg: number; }
export interface Drop { id: number; x: number; z: number; value: number; t: number; }
export interface Worker {
  id: number; x: number; z: number; face: number; walkT: number; moving: boolean;
  state: 'toTree' | 'chop' | 'toCounter' | 'drop'; target: Tree | null; carry: number; t: number;
}
export interface PadState { def: PadDef; level: number; paid: number; pulse: number; }

export type GameEvent =
  | { type: 'fly'; kind: 'log' | 'cash'; x0: number; y0: number; z0: number; x1: number; y1: number; z1: number }
  | { type: 'float'; text: string; x: number; z: number; color: string }
  | { type: 'burst'; x: number; y: number; z: number; color: number; n: number }
  | { type: 'build'; id: PadId; x: number; z: number }
  | { type: 'shake'; power: number }
  | { type: 'toast'; text: string; sub?: string };

export interface SaveData {
  v: 2; money: number; cashPile: number; counterLogs: number;
  pads: Partial<Record<PadId, { level: number; paid: number }>>;
  stack: number; px: number; pz: number; wave: number; waveTimer: number; wallHp: number; savedAt: number;
}

interface GatePath { in: Pt; out: Pt; }
const GATE_PATHS: GatePath[] = [
  { in: { x: GATES.north.x, z: -CAMP.half + 1.4 }, out: { x: GATES.north.x, z: -CAMP.half - 1.6 } },
  { in: { x: CAMP.half - 1.4, z: GATES.east.z }, out: { x: CAMP.half + 1.6, z: GATES.east.z } },
];
const EAST_GATE_ONLY = [GATE_PATHS[1]];

const dist = (ax: number, az: number, bx: number, bz: number) => Math.hypot(ax - bx, az - bz);

function distToSegment(x: number, z: number, a: Pt, b: Pt): number {
  const vx = b.x - a.x, vz = b.z - a.z, len2 = vx * vx + vz * vz;
  const t = Math.max(0, Math.min(1, ((x - a.x) * vx + (z - a.z) * vz) / len2));
  return dist(x, z, a.x + vx * t, a.z + vz * t);
}

export class Game {
  player = {
    x: PLAYER.start.x, z: PLAYER.start.z, face: Math.PI, moving: false, walkT: 0,
    stack: [] as StackLog[], chopT: 0, target: null as Tree | null, hurtT: 0, kx: 0, kz: 0, axeAngle: 0,
  };
  money = 0;
  cashPile = 0;
  counterLogs = 0;
  pads: PadState[] = PADS.map((def) => ({ def, level: 0, paid: 0, pulse: 0 }));
  trees: Tree[] = [];
  survivors: Survivor[] = [];
  bears: Bear[] = [];
  towers: Tower[] = [];
  bolts: Bolt[] = [];
  drops: Drop[] = [];
  workers: Worker[] = [];
  wave = 1;
  waveTimer = FIRST_WAVE_IN;
  waveActive = false;
  breached = false;
  wallHp = wallMax(0);
  time = 0;
  events: GameEvent[] = [];
  onChange: (() => void) | null = null;

  private nextId = 1;
  private transferT = 0;
  private zoneKey = '';
  private zoneT = 0;
  private readonly boxes: Box[] = [...fenceBoxes(), COUNTER];
  private rnd = mulberry32(99);

  constructor() {
    const rnd = mulberry32(2024);
    const f = FOREST, s = TREE.spacing;
    for (let x = f.x - f.w / 2 + s / 2; x < f.x + f.w / 2; x += s) {
      for (let z = f.z - f.d / 2 + s / 2; z < f.z + f.d / 2; z += s) {
        const tx = x + (rnd() - 0.5) * s * 0.5, tz = z + (rnd() - 0.5) * s * 0.5;
        this.trees.push({ x: tx, z: tz, hp: TREE.hp, respawnT: 0, shake: 0, grow: 1, reserved: false });
      }
    }
    for (let i = 0; i < QUEUE.size; i++) {
      const p = this.slotPos(i);
      this.survivors.push(this.newSurvivor(p.x, p.z, i, 'wait'));
    }
  }

  // ---------- queries ----------

  pad(id: PadId): PadState { return this.pads.find((p) => p.def.id === id)!; }
  level(id: PadId): number { return this.pad(id).level; }
  get axes(): number { return 1 + this.level('axe'); }
  get capacity(): number { return PLAYER.capacity(this.level('bag')); }
  get speed(): number { return PLAYER.speed(this.level('boots')); }
  get wallMax(): number { return wallMax(this.level('wall')); }
  get towerDamage(): number { return TOWER.damage * 1.3 ** this.level('power'); }

  padVisible(p: PadState): boolean {
    return p.level < p.def.max && p.def.requires.every((r) => this.level(r) >= 1);
  }
  padCost(p: PadState): number { return p.def.cost(p.level); }
  padRemaining(p: PadState): number { return Math.max(0, this.padCost(p) - p.paid); }

  aliveBears(): Bear[] { return this.bears.filter((b) => b.state !== 'dead' && b.state !== 'spawn'); }

  blocked(x: number, z: number, r: number): boolean {
    if (x < WORLD.minX || x > WORLD.maxX || z < WORLD.minZ || z > WORLD.maxZ) return true;
    for (const b of this.boxes) if (inBox(x, z, b, r)) return true;
    for (const t of this.towers) if (dist(x, z, t.x, t.z) < 0.8 + r) return true;
    return false;
  }

  /** Next point on the way to (tx,tz); crossing the palisade routes through a gate. */
  waypoint(x: number, z: number, tx: number, tz: number, gates = GATE_PATHS): Pt {
    const a = inCamp(x, z);
    if (a === inCamp(tx, tz)) return { x: tx, z: tz };
    let best = gates[0], bestD = Infinity;
    for (const g of gates) {
      const s = a ? g.in : g.out, e = a ? g.out : g.in;
      const d = dist(x, z, s.x, s.z) + dist(e.x, e.z, tx, tz);
      if (d < bestD) { bestD = d; best = g; }
    }
    const s = a ? best.in : best.out, e = a ? best.out : best.in;
    return distToSegment(x, z, s, e) < 0.6 ? e : s;
  }

  // ---------- update ----------

  update(dt: number, dir: { x: number; z: number }): void {
    this.time += dt;
    this.updatePlayer(dt, dir);
    this.updateTrees(dt);
    this.updateTransfers(dt);
    this.updateSurvivors(dt);
    this.updateWaves(dt);
    this.updateBears(dt);
    this.updateTowers(dt);
    for (const w of this.workers) this.updateWorker(w, dt);
    this.updateDrops(dt);
    for (const p of this.pads) p.pulse = Math.max(0, p.pulse - dt);
  }

  private moveBody(o: { x: number; z: number }, dx: number, dz: number, r: number): void {
    if (!this.blocked(o.x + dx, o.z, r)) o.x += dx;
    if (!this.blocked(o.x, o.z + dz, r)) o.z += dz;
  }

  private updatePlayer(dt: number, dir: { x: number; z: number }): void {
    const p = this.player;
    p.hurtT = Math.max(0, p.hurtT - dt);
    const decay = Math.exp(-7 * dt);
    p.kx *= decay;
    p.kz *= decay;
    const sp = this.speed;
    this.moveBody(p, (dir.x * sp + p.kx) * dt, (dir.z * sp + p.kz) * dt, PLAYER.radius);
    p.moving = Math.hypot(dir.x, dir.z) > 0.1;
    if (p.moving) {
      p.walkT += dt * 11;
      p.face = turnTo(p.face, Math.atan2(dir.x, dir.z), dt * 12);
    }
    p.axeAngle += dt * (4.5 + this.axes * 0.5);
    for (const s of p.stack) s.anim = Math.min(1, s.anim + dt * 5);

    // the orbiting axes chop the nearest tree in reach
    p.target = null;
    if (p.stack.length < this.capacity) {
      let best: Tree | null = null, bestD = PLAYER.axeReach;
      for (const t of this.trees) {
        if (t.hp <= 0) continue;
        const d = dist(t.x, t.z, p.x, p.z);
        if (d < bestD) { best = t; bestD = d; }
      }
      p.target = best;
    }
    if (p.target) {
      p.chopT += dt;
      const every = PLAYER.chopInterval(this.axes);
      if (p.chopT >= every) {
        p.chopT -= every;
        this.hitTree(p.target);
        p.stack.push({ anim: 0, fx: p.target.x, fy: 1.2, fz: p.target.z });
        sfx('pick');
        if (p.stack.length >= this.capacity) this.events.push({ type: 'float', text: T.full, x: p.x, z: p.z, color: '#ff5a4f' });
      }
    } else p.chopT = 0;

    // ...and hurt any bear that gets close
    for (const b of this.bears) {
      if (b.state === 'dead' || b.state === 'spawn') continue;
      if (dist(b.x, b.z, p.x, p.z) > PLAYER.axeReach + 0.6) continue;
      b.hitT += dt;
      const tick = b.hitT >= 0.22;
      if (tick) b.hitT = 0;
      this.damageBear(b, PLAYER.axeDps(this.axes) * dt, tick);
    }
  }

  private hitTree(t: Tree): void {
    t.hp--;
    t.shake = 0.3;
    if (t.hp <= 0) { t.respawnT = TREE.respawn; t.reserved = false; }
    this.events.push({ type: 'burst', x: t.x, y: 1.4, z: t.z, color: 0x3f9a4a, n: 5 });
    sfx('chop');
  }

  private updateTrees(dt: number): void {
    for (const t of this.trees) {
      t.shake = Math.max(0, t.shake - dt);
      if (t.hp <= 0) {
        t.respawnT -= dt;
        if (t.respawnT <= 0) { t.hp = TREE.hp; t.grow = 0; }
      }
      t.grow = Math.min(1, t.grow + dt * 2);
    }
  }

  // ---------- zones: counter, cash pile, pads ----------

  private zoneAt(x: number, z: number): string {
    for (const p of this.pads) {
      if (this.padVisible(p) && inBox(x, z, { x: p.def.x, z: p.def.z, w: PAD_SIZE, d: PAD_SIZE })) return p.def.id;
    }
    if (inBox(x, z, DEPOSIT_ZONE)) return 'deposit';
    if (inBox(x, z, CASH_ZONE)) return 'cash';
    return '';
  }

  private updateTransfers(dt: number): void {
    const p = this.player;
    const key = this.zoneAt(p.x, p.z);
    const isPad = key !== '' && key !== 'deposit' && key !== 'cash';
    // pads only spend while the player stands still, so walking across one never buys anything
    if (key !== this.zoneKey || (isPad && p.moving)) { this.zoneKey = key; this.zoneT = 0; }
    this.zoneT += dt;
    if (!key || this.zoneT < (isPad ? 0.25 : key === 'deposit' ? 0.12 : 0)) return;
    this.transferT -= dt;
    if (this.transferT > 0) return;
    let did = false;

    if (key === 'deposit') {
      if (p.stack.length && this.counterLogs < COUNTER_MAX) {
        p.stack.pop();
        this.counterLogs++;
        this.events.push({ type: 'fly', kind: 'log', x0: p.x, y0: 1.2 + p.stack.length * 0.3, z0: p.z, x1: COUNTER.x, y1: 1.3, z1: COUNTER.z });
        sfx('drop');
        did = true;
      }
    } else if (key === 'cash') {
      if (this.cashPile > 0) {
        const chunk = Math.min(this.cashPile, Math.max(1, Math.ceil(this.cashPile / 12)));
        this.cashPile -= chunk;
        this.money += chunk;
        this.events.push({ type: 'fly', kind: 'cash', x0: CASH_ZONE.x, y0: 0.6, z0: CASH_ZONE.z, x1: p.x, y1: 1.4, z1: p.z });
        sfx('coin');
        did = true;
      }
    } else {
      const pad = this.pad(key as PadId);
      const rem = this.padRemaining(pad);
      if (rem > 0 && this.money > 0) {
        const chunk = Math.min(this.money, rem, Math.max(1, Math.ceil(this.padCost(pad) / 20)));
        this.money -= chunk;
        pad.paid += chunk;
        pad.pulse = 0.12;
        this.events.push({ type: 'fly', kind: 'cash', x0: p.x, y0: 1.4, z0: p.z, x1: pad.def.x, y1: 0.1, z1: pad.def.z });
        sfx('coin');
        if (pad.paid >= this.padCost(pad)) this.completePad(pad);
        did = true;
      }
    }
    this.transferT = did ? 0.06 : 0;
    if (did) this.onChange?.();
  }

  private completePad(pad: PadState): void {
    pad.level++;
    pad.paid = 0;
    const { id, x, z } = pad.def;
    if (id.startsWith('tower')) {
      this.towers.push({ id, x, z, cd: 0.5, aim: -Math.PI / 2, recoil: 0 });
      // step off the spot where the tower appears
      const p = this.player;
      if (dist(p.x, p.z, x, z) < 1.4) p.x = x - 1.5;
    }
    if (id === 'worker') this.spawnWorker();
    if (id === 'wall') this.wallHp = this.wallMax;
    this.events.push({ type: 'build', id, x, z });
    this.events.push({ type: 'shake', power: 0.25 });
    sfx(id.startsWith('tower') ? 'build' : 'upgrade');
    vibrate(60);
    this.onChange?.();
  }

  // ---------- survivors ----------

  private slotPos(i: number): Pt { return { x: QUEUE.x + (i % 2 ? 0.28 : -0.28), z: QUEUE.z + i * QUEUE.gap }; }

  private newSurvivor(x: number, z: number, slot: number, state: Survivor['state']): Survivor {
    const maxWant = Math.min(4, 1 + this.wave * 0.5);
    return {
      id: this.nextId++, x, z, slot, state, want: 1 + Math.floor(this.rnd() * maxWant), got: 0,
      serveT: 0, walkT: this.rnd() * 10, face: Math.PI, path: [],
    };
  }

  private updateSurvivors(dt: number): void {
    const queued = this.survivors.filter((s) => s.state !== 'leave').length;
    for (let i = queued; i < QUEUE.size; i++) {
      this.survivors.push(this.newSurvivor(QUEUE.x + (this.rnd() - 0.5) * 2, QUEUE.spawnZ + i * 0.8, i, 'walk'));
    }
    for (const s of this.survivors) {
      if (s.state === 'leave') {
        const t = s.path[0];
        if (t && this.walkTo(s, t.x, t.z, 3.4, dt, 0.2)) s.path.shift();
        continue;
      }
      const slot = this.slotPos(s.slot);
      if (this.walkTo(s, slot.x, slot.z, 3.2, dt, 0.05)) {
        s.state = 'wait';
        s.face = turnTo(s.face, Math.PI, dt * 8);
      } else s.state = 'walk';
      if (s.slot !== 0 || s.state !== 'wait') continue;
      s.serveT += dt;
      if (s.serveT >= 0.28 && s.got < s.want && this.counterLogs > 0) {
        s.serveT = 0;
        this.counterLogs--;
        s.got++;
        this.events.push({ type: 'fly', kind: 'log', x0: COUNTER.x, y0: 1.3, z0: COUNTER.z, x1: s.x, y1: 1.3, z1: s.z });
        sfx('pick');
      }
      if (s.got >= s.want) {
        const pay = s.want * QUEUE.pricePerLog;
        this.cashPile += pay;
        this.events.push({ type: 'fly', kind: 'cash', x0: s.x, y0: 1.5, z0: s.z, x1: CASH_ZONE.x, y1: 0.4, z1: CASH_ZONE.z });
        this.events.push({ type: 'float', text: `+$${pay}`, x: s.x, z: s.z, color: '#7dff7a' });
        sfx('coin');
        s.state = 'leave';
        s.path = [{ x: s.x - 3, z: s.z + 1.5 }, { x: -16, z: 25 }];
        for (const o of this.survivors) if (o.state !== 'leave') o.slot--;
        this.onChange?.();
      }
    }
    this.survivors = this.survivors.filter((s) => s.state !== 'leave' || s.path.length > 0);
  }

  private walkTo(o: { x: number; z: number; face: number; walkT: number }, tx: number, tz: number, speed: number, dt: number, stop: number): boolean {
    const dx = tx - o.x, dz = tz - o.z, d = Math.hypot(dx, dz);
    if (d <= stop) return true;
    const step = Math.min(d, speed * dt);
    o.x += (dx / d) * step;
    o.z += (dz / d) * step;
    o.walkT += dt * 10;
    o.face = turnTo(o.face, Math.atan2(dx, dz), dt * 10);
    return false;
  }

  // ---------- bears & defence ----------

  private updateWaves(dt: number): void {
    if (!this.waveActive) {
      this.wallHp = Math.min(this.wallMax, this.wallHp + 10 * dt);
      this.waveTimer -= dt;
      if (this.waveTimer <= 0) this.startWave();
      return;
    }
    if (this.bears.every((b) => b.state === 'dead')) {
      this.waveActive = false;
      this.breached = false;
      this.wave++;
      this.waveTimer = WAVE_GAP;
      this.events.push({ type: 'toast', text: T.waveCleared });
      sfx('upgrade');
      this.onChange?.();
    }
  }

  private startWave(): void {
    this.waveActive = true;
    const n = BEAR.count(this.wave), hp = BEAR.hp(this.wave);
    for (let i = 0; i < n; i++) {
      const z = -10 + this.rnd() * 20;
      this.bears.push({
        id: this.nextId++, x: 27 + this.rnd() * 4, z, hp, maxHp: hp, homeZ: Math.max(-7.3, Math.min(7.3, z)),
        state: 'spawn', delay: i * 1.3, atkT: 0, flash: 0, hitT: 0, deadT: 0, face: -Math.PI / 2, walkT: 0,
      });
    }
    this.events.push({ type: 'toast', text: fmt(T.wave, { n: this.wave }), sub: T.waveStart });
    sfx('bear');
  }

  private damageBear(b: Bear, dmg: number, fx: boolean): void {
    if (b.state === 'dead') return;
    b.hp -= dmg;
    if (fx) {
      b.flash = 1;
      this.events.push({ type: 'burst', x: b.x, y: 1.1, z: b.z, color: 0xb3262e, n: 4 });
      sfx('hit');
    }
    if (b.hp <= 0) {
      b.state = 'dead';
      b.deadT = 0;
      this.drops.push({ id: this.nextId++, x: b.x, z: b.z, value: BEAR.reward(this.wave), t: 0 });
      this.events.push({ type: 'burst', x: b.x, y: 1, z: b.z, color: 0xffffff, n: 14 });
      sfx('bear');
    }
  }

  private updateBears(dt: number): void {
    const p = this.player;
    const playerOut = !inCamp(p.x, p.z);
    for (const b of this.bears) {
      if (b.state === 'dead') { b.deadT += dt; continue; }
      if (b.state === 'spawn') { b.delay -= dt; if (b.delay <= 0) b.state = 'approach'; continue; }
      b.flash = Math.max(0, b.flash - dt * 9);
      const dP = dist(b.x, b.z, p.x, p.z);
      const canChase = this.breached || (playerOut && dP < BEAR.aggro);
      if (canChase) b.state = 'chase';
      else if (b.state === 'chase') b.state = 'approach';

      if (b.state === 'chase') {
        if (dP < 1.5) {
          b.face = turnTo(b.face, Math.atan2(p.x - b.x, p.z - b.z), dt * 10);
          b.atkT += dt;
          if (b.atkT >= 1.1) { b.atkT = 0; this.hurtPlayer(b); }
        } else {
          const wp = this.breached ? this.waypoint(b.x, b.z, p.x, p.z, EAST_GATE_ONLY) : { x: p.x, z: p.z };
          this.walkTo(b, wp.x, wp.z, BEAR.speed * 1.15, dt, 0.1);
        }
      } else if (b.state === 'approach') {
        if (this.walkTo(b, CAMP.half + 1.2, b.homeZ, BEAR.speed, dt, 0.15)) { b.state = 'attack'; b.atkT = 0; }
      } else if (b.state === 'attack') {
        b.face = turnTo(b.face, -Math.PI / 2, dt * 8);
        b.atkT += dt;
        if (b.atkT >= BEAR.attackEvery) {
          b.atkT = 0;
          this.wallHp = Math.max(0, this.wallHp - BEAR.wallDamage);
          this.events.push({ type: 'burst', x: CAMP.half + 0.3, y: 1, z: b.z, color: 0xc9844a, n: 5 });
          sfx('thud');
          if (this.wallHp <= 0 && !this.breached) {
            this.breached = true;
            this.events.push({ type: 'toast', text: T.breach });
            this.events.push({ type: 'shake', power: 0.5 });
            vibrate(150);
          }
        }
      }
      if (!this.breached) b.x = Math.max(b.x, CAMP.half + 0.9); // the palisade holds
    }
    // keep bears from overlapping
    const alive = this.aliveBears();
    for (let i = 0; i < alive.length; i++) {
      for (let j = i + 1; j < alive.length; j++) {
        const a = alive[i], c = alive[j];
        const d = dist(a.x, a.z, c.x, c.z);
        if (d > 0 && d < 1.3) {
          const push = (1.3 - d) / 2, nx = (a.x - c.x) / d, nz = (a.z - c.z) / d;
          a.x += nx * push; a.z += nz * push; c.x -= nx * push; c.z -= nz * push;
        }
      }
    }
    this.bears = this.bears.filter((b) => b.state !== 'dead' || b.deadT < 1.6);
  }

  private hurtPlayer(b: Bear): void {
    const p = this.player;
    if (p.hurtT > 0) return;
    p.hurtT = 1.2;
    const d = Math.max(0.01, dist(p.x, p.z, b.x, b.z));
    p.kx = ((p.x - b.x) / d) * 10;
    p.kz = ((p.z - b.z) / d) * 10;
    const lost = Math.min(3, p.stack.length);
    p.stack.length -= lost;
    if (lost) this.events.push({ type: 'float', text: `-${lost}`, x: p.x, z: p.z, color: '#ff6b5f' });
    this.events.push({ type: 'burst', x: p.x, y: 1.2, z: p.z, color: 0xc9844a, n: 6 + lost * 3 });
    this.events.push({ type: 'shake', power: 0.35 });
    sfx('hurt');
    vibrate(90);
  }

  private updateTowers(dt: number): void {
    for (const t of this.towers) {
      t.cd -= dt;
      t.recoil = Math.max(0, t.recoil - dt * 4);
      let target: Bear | null = null, bestD = TOWER.range;
      for (const b of this.bears) {
        if (b.state === 'dead' || b.state === 'spawn') continue;
        const d = dist(b.x, b.z, t.x, t.z);
        if (d < bestD) { target = b; bestD = d; }
      }
      if (!target) continue;
      t.aim = turnTo(t.aim, Math.atan2(target.x - t.x, target.z - t.z), dt * 10);
      if (t.cd <= 0) {
        t.cd = TOWER.every;
        t.recoil = 1;
        this.bolts.push({ id: this.nextId++, x: t.x, y: 2.9, z: t.z, dx: 0, dy: 0, dz: 1, target: target.id, dmg: this.towerDamage });
        sfx('shoot');
      }
    }
    for (const bolt of this.bolts) {
      const b = this.bears.find((x) => x.id === bolt.target);
      if (!b || b.state === 'dead') { bolt.target = -1; continue; }
      const dx = b.x - bolt.x, dy = 1 - bolt.y, dz = b.z - bolt.z, d = Math.hypot(dx, dy, dz);
      const step = 28 * dt;
      bolt.dx = dx / d; bolt.dy = dy / d; bolt.dz = dz / d;
      if (d <= step + 0.3) {
        this.damageBear(b, bolt.dmg, true);
        bolt.target = -1;
        continue;
      }
      bolt.x += bolt.dx * step; bolt.y += bolt.dy * step; bolt.z += bolt.dz * step;
    }
    this.bolts = this.bolts.filter((b) => b.target !== -1);
  }

  private updateDrops(dt: number): void {
    const p = this.player;
    for (const d of this.drops) {
      d.t += dt;
      const dd = dist(d.x, d.z, p.x, p.z);
      if (dd < 0.7) {
        this.money += d.value;
        this.events.push({ type: 'float', text: `+$${d.value}`, x: p.x, z: p.z, color: '#7dff7a' });
        d.value = 0;
        sfx('coin');
        this.onChange?.();
      } else if (dd < 3) {
        const step = Math.min(dd, 12 * dt);
        d.x += ((p.x - d.x) / dd) * step;
        d.z += ((p.z - d.z) / dd) * step;
      }
    }
    this.drops = this.drops.filter((d) => d.value > 0);
  }

  // ---------- lumberjack workers ----------

  spawnWorker(): void {
    this.workers.push({ id: this.nextId++, x: -5, z: 4, face: 0, walkT: 0, moving: false, state: 'toTree', target: null, carry: 0, t: 0 });
  }

  private updateWorker(w: Worker, dt: number): void {
    const release = () => { if (w.target) w.target.reserved = false; w.target = null; };
    const go = (tx: number, tz: number, stop: number): boolean => {
      const wp = this.waypoint(w.x, w.z, tx, tz);
      const final = wp.x === tx && wp.z === tz;
      const arrived = this.walkTo(w, wp.x, wp.z, WORKER.speed, dt, final ? stop : 0.1);
      w.moving = !(arrived && final);
      return arrived && final;
    };
    switch (w.state) {
      case 'toTree': {
        if (!w.target || w.target.hp <= 0) {
          release();
          let best: Tree | null = null, bestD = Infinity;
          const gate = GATE_PATHS[0].out;
          for (const t of this.trees) {
            if (t.hp <= 0 || t.reserved) continue;
            const d = dist(t.x, t.z, gate.x, gate.z);
            if (d < bestD) { best = t; bestD = d; }
          }
          if (!best) { w.moving = false; break; }
          best.reserved = true;
          w.target = best;
        }
        if (go(w.target.x, w.target.z + 1, 0.2)) { w.state = 'chop'; w.t = 0; }
        break;
      }
      case 'chop': {
        w.moving = false;
        const t = w.target;
        if (!t || t.hp <= 0) { release(); w.state = w.carry > 0 ? 'toCounter' : 'toTree'; break; }
        w.face = turnTo(w.face, Math.atan2(t.x - w.x, t.z - w.z), dt * 8);
        w.t += dt;
        if (w.t >= WORKER.chopTime) {
          w.t = 0;
          this.hitTree(t);
          w.carry++;
          if (w.carry >= WORKER.carry || t.hp <= 0) { release(); w.state = w.carry >= WORKER.carry ? 'toCounter' : 'toTree'; }
        }
        break;
      }
      case 'toCounter':
        if (go(DEPOSIT_ZONE.x + ((w.id % 3) - 1) * 1.1, DEPOSIT_ZONE.z, 0.15)) { w.state = 'drop'; w.t = 0; }
        break;
      case 'drop':
        w.moving = false;
        w.face = turnTo(w.face, 0, dt * 8);
        w.t += dt;
        if (w.t >= 0.15 && this.counterLogs < COUNTER_MAX) {
          w.t = 0;
          w.carry--;
          this.counterLogs++;
          this.events.push({ type: 'fly', kind: 'log', x0: w.x, y0: 1.5, z0: w.z, x1: COUNTER.x, y1: 1.3, z1: COUNTER.z });
          if (w.carry <= 0) { w.carry = 0; w.state = 'toTree'; }
        }
        break;
    }
  }

  // ---------- guidance ----------

  /** Next thing the player should do: hint text plus where the guide arrow points. */
  objective(): { text: string; x: number; z: number } | null {
    const p = this.player;
    const alive = this.aliveBears();
    if (alive.length && (this.breached || this.towers.length === 0)) {
      const b = alive.reduce((a, c) => (dist(a.x, a.z, p.x, p.z) <= dist(c.x, c.z, p.x, p.z) ? a : c));
      return { text: this.breached ? T.breach : T.defend, x: b.x, z: b.z };
    }
    const full = p.stack.length >= this.capacity;
    const next = PAD_ORDER.map((id) => this.pad(id)).find((pd) => this.padVisible(pd) && pd.level === 0);
    const deliver = { text: T.deliver, x: DEPOSIT_ZONE.x, z: DEPOSIT_ZONE.z };
    const cash = { text: T.takeCash, x: CASH_ZONE.x, z: CASH_ZONE.z };
    if (next) {
      const rem = this.padRemaining(next);
      if (this.money >= rem) return { text: fmt(T.buy, { b: T.pad[next.def.id] }), x: next.def.x, z: next.def.z };
      if (this.cashPile > 0 && this.money + this.cashPile >= rem) return cash;
      const worth = this.money + this.cashPile + (p.stack.length + this.counterLogs) * QUEUE.pricePerLog;
      if (p.stack.length && (full || worth >= rem)) return deliver;
      if (this.cashPile > 0 && !p.stack.length) return cash;
    } else if (this.cashPile > 0 && !p.stack.length) return cash;
    if (full) return deliver;
    let best: Tree | null = null, bestD = Infinity;
    for (const t of this.trees) {
      if (t.hp <= 0) continue;
      const d = dist(t.x, t.z, p.x, p.z);
      if (d < bestD) { best = t; bestD = d; }
    }
    return best ? { text: next ? T.chop : T.free, x: best.x, z: best.z } : null;
  }

  // ---------- persistence ----------

  serialize(): SaveData {
    const pads: SaveData['pads'] = {};
    for (const p of this.pads) pads[p.def.id] = { level: p.level, paid: p.paid };
    return {
      v: 2, money: this.money, cashPile: this.cashPile, counterLogs: this.counterLogs, pads,
      stack: this.player.stack.length, px: this.player.x, pz: this.player.z, wave: this.wave,
      waveTimer: this.waveActive ? 20 : this.waveTimer, wallHp: this.wallHp, savedAt: Date.now(),
    };
  }

  load(d: SaveData): void {
    if (d.v !== 2) return;
    this.money = d.money;
    this.cashPile = d.cashPile;
    this.counterLogs = d.counterLogs;
    for (const p of this.pads) {
      const s = d.pads[p.def.id];
      if (!s) continue;
      p.level = Math.min(s.level, p.def.max);
      p.paid = s.paid;
      if (p.def.id.startsWith('tower') && p.level > 0) {
        this.towers.push({ id: p.def.id, x: p.def.x, z: p.def.z, cd: 0, aim: -Math.PI / 2, recoil: 0 });
      }
    }
    for (let i = 0; i < this.level('worker'); i++) this.spawnWorker();
    this.player.stack = Array.from({ length: Math.min(d.stack, this.capacity) }, () => ({ anim: 1, fx: 0, fy: 0, fz: 0 }));
    if (!this.blocked(d.px, d.pz, PLAYER.radius)) { this.player.x = d.px; this.player.z = d.pz; }
    this.wave = d.wave;
    this.waveTimer = Math.max(15, d.waveTimer);
    this.wallHp = d.wallHp;

    // lumberjacks keep supplying survivors while the game is closed (about half the online rate, max 2h)
    const away = Math.min(2 * 3600, (Date.now() - d.savedAt) / 1000);
    const workers = this.level('worker');
    if (away > 60 && workers > 0) {
      const earned = Math.floor(away * workers * 0.25);
      this.cashPile += earned;
      this.events.push({ type: 'toast', text: T.welcome, sub: `+$${earned}` });
    }
  }
}

function turnTo(a: number, b: number, k: number): number {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * Math.min(1, k);
}
