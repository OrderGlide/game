import {
  BOOSTS, CAMP, CAMPFIRE, CASH_ZONE, CHEST, COUNTER, COUNTER_MAX, DEPOSIT_ZONE, ENEMIES, FOREST_PEN, FORGE_ZONE, GATES,
  GEMS, MINE_PEN, ORES, PADS, PAD_ORDER, PAD_SIZE, PLAYER, QUEUE, SKINS, STATS, TOWER, TREE, UPGRADES, WAVES, WORKER,
  WORLD, dayKey, fenceBoxes, inBox, mulberry32, regionOf, wallMax, worldAt,
  type BoostId, type Box, type EnemyKind, type Gem, type PadDef, type PadId, type Price, type Pt, type Region, type Reward,
  type SkinId, type UpgradeId, type WorldInfo,
} from './data';
import {
  DAILY_REWARDS, addGems, dailyAvailable, dailyIndex, ensureQuests, hasGems, questProgress, spendGems, type ProfileData,
} from './profile';
import { sfx, vibrate } from './audio';
import { T, fmt } from './i18n';

export interface Tree {
  x: number; z: number; hp: number; respawnT: number; shake: number; grow: number; reserved: boolean;
  fallT: number; fallDir: number;
}
export interface Ore { gem: Gem; x: number; z: number; hp: number; maxHp: number; respawnT: number; shake: number; grow: number; reserved: boolean; }
export interface StackLog { anim: number; fx: number; fy: number; fz: number; }
export interface Survivor {
  id: number; x: number; z: number; want: number; got: number; slot: number;
  state: 'walk' | 'wait' | 'leave'; serveT: number; walkT: number; face: number; path: Pt[];
}
export interface Enemy {
  id: number; kind: EnemyKind; boss: boolean; x: number; z: number; hp: number; maxHp: number; homeZ: number;
  speed: number; damage: number; attackEvery: number;
  state: 'spawn' | 'approach' | 'attack' | 'chase' | 'dead';
  delay: number; atkT: number; flash: number; hitT: number; deadT: number; face: number; walkT: number;
}
export interface Tower { id: PadId; x: number; z: number; cd: number; aim: number; recoil: number; }
export interface Bolt { id: number; x: number; y: number; z: number; dx: number; dy: number; dz: number; target: number; dmg: number; }
export interface Drop { id: number; x: number; z: number; value: number; t: number; }
export interface Worker {
  id: number; kind: 'lumber' | 'miner'; x: number; z: number; face: number; walkT: number; moving: boolean;
  state: 'toTree' | 'chop' | 'toCounter' | 'drop' | 'toOre' | 'mine'; target: Tree | Ore | null; carry: number; t: number;
}
export interface PadState { def: PadDef; level: number; paid: Price; pulse: number; }

export type GameEvent =
  | { type: 'fly'; kind: 'log' | 'cash'; x0: number; y0: number; z0: number; x1: number; y1: number; z1: number }
  | { type: 'float'; text: string; x: number; z: number; color: string }
  | { type: 'burst'; x: number; y: number; z: number; color: number; n: number }
  | { type: 'build'; id: PadId; x: number; z: number }
  | { type: 'shake'; power: number }
  | { type: 'toast'; text: string; sub?: string }
  | { type: 'gems'; price: Price; x: number; z: number }
  | { type: 'forge' }
  | { type: 'worldComplete' };

export interface CampSave {
  money: number; cashPile: number; counterLogs: number;
  pads: Partial<Record<PadId, { level: number; paid: Price }>>;
  stack: number; px: number; pz: number; wave: number; waveTimer: number; wallHp: number;
  bossDefeated: boolean; worldDone: boolean; savedAt: number;
}

const dist = (ax: number, az: number, bx: number, bz: number) => Math.hypot(ax - bx, az - bz);

function distToSegment(x: number, z: number, a: Pt, b: Pt): number {
  const vx = b.x - a.x, vz = b.z - a.z, len2 = vx * vx + vz * vz;
  const t = Math.max(0, Math.min(1, ((x - a.x) * vx + (z - a.z) * vz) / len2));
  return dist(x, z, a.x + vx * t, a.z + vz * t);
}

export function turnTo(a: number, b: number, k: number): number {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * Math.min(1, k);
}

export function scalePrice(p: Price, k: number): Price {
  const out: Price = {};
  for (const key of Object.keys(p) as (keyof Price)[]) out[key] = Math.round((p[key] ?? 0) * k);
  return out;
}

export function formatNum(n: number): string {
  n = Math.floor(n);
  if (n >= 1e9) return (n / 1e9).toFixed(1).replace(/\.0$/, '') + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1e4) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
  return String(n);
}

export class Game {
  readonly world: WorldInfo;
  player = {
    x: PLAYER.start.x, z: PLAYER.start.z, face: Math.PI, moving: false, walkT: 0,
    stack: [] as StackLog[], chopT: 0, target: null as Tree | null, mining: null as Ore | null, mineT: 0,
    hurtT: 0, kx: 0, kz: 0, axeAngle: 0, lockT: 0,
  };
  money = 0;
  cashPile = 0;
  counterLogs = 0;
  pads: PadState[] = PADS.map((def) => ({ def, level: 0, paid: {}, pulse: 0 }));
  trees: Tree[] = [];
  ores: Ore[] = [];
  survivors: Survivor[] = [];
  enemies: Enemy[] = [];
  towers: Tower[] = [];
  bolts: Bolt[] = [];
  drops: Drop[] = [];
  workers: Worker[] = [];
  wave = 1;
  waveTimer: number = WAVES.firstIn;
  waveActive = false;
  breached = false;
  wallHp = wallMax(0);
  bossDefeated = false;
  worldDone = false;
  time = 0;
  events: GameEvent[] = [];
  onChange: (() => void) | null = null;
  /** Clock for boosts and chests; the simulation bot can override it. */
  now: () => number = () => Date.now();

  private nextId = 1;
  private transferT = 0;
  private zoneKey = '';
  private zoneT = 0;
  private readonly boxes: Box[] = [...fenceBoxes(), COUNTER];
  private rnd = mulberry32(99);

  constructor(readonly profile: ProfileData, camp?: CampSave) {
    this.world = worldAt(profile.world);
    const rnd = mulberry32(2024 + profile.world);
    // forest pen
    const s = TREE.spacing, f = FOREST_PEN;
    for (let x = f.x0 + 1.2; x < f.x1 - 0.8; x += s) {
      for (let z = f.z0 + 1.2; z < f.z1 - 1.2; z += s) {
        this.trees.push({
          x: x + (rnd() - 0.5) * s * 0.45, z: z + (rnd() - 0.5) * s * 0.45, hp: TREE.hp, respawnT: 0, shake: 0, grow: 1,
          reserved: false, fallT: 9, fallDir: 0,
        });
      }
    }
    // mine pen: emeralds near the gate, the rest rolled from the world's ore mix
    const m = MINE_PEN, w = this.world.def.ores;
    for (let x = m.x0 + 1.6; x < m.x1 - 1.2; x += 2.6) {
      for (let z = m.z0 + 1.5; z < m.z1 - 1; z += 2.6) {
        const ox = x + (rnd() - 0.5) * 0.8, oz = z + (rnd() - 0.5) * 0.8;
        const nearGate = dist(ox, oz, GATES.mine.other.x, GATES.mine.other.z) < 5;
        const r = rnd();
        const gem: Gem = nearGate || r < w.em ? 'em' : r < w.em + w.di ? 'di' : 'ob';
        const hp = ORES[gem].hp;
        this.ores.push({ gem, x: ox, z: oz, hp, maxHp: hp, respawnT: 0, shake: 0, grow: 1, reserved: false });
      }
    }
    for (let i = 0; i < QUEUE.size; i++) {
      const p = this.slotPos(i);
      this.survivors.push(this.newSurvivor(p.x, p.z, i, 'wait'));
    }
    ensureQuests(profile, this.world.priceMult);
    if (camp) this.loadCamp(camp);
  }

  // ---------- stats ----------

  get lv() { return this.profile.levels; }
  get axes(): number { return STATS.axeCount(this.lv); }
  get capacity(): number { return STATS.capacity(this.lv); }
  get speed(): number { return STATS.speed(this.lv) * (this.boostActive('speed') ? 1.6 : 1); }
  get pickLevel(): number { return STATS.pickLevel(this.lv); }
  get wallMax(): number { return wallMax(this.level('wall')); }
  get towerDamage(): number { return TOWER.damage * STATS.towerMult(this.lv) * this.world.towerMult; }
  get logPrice(): number { return QUEUE.pricePerLog * this.world.priceMult * (this.boostActive('cash') ? 2 : 1); }
  boostActive(id: Exclude<BoostId, 'repair'>): boolean { return this.now() < this.profile.boosts[id]; }
  boostLeft(id: Exclude<BoostId, 'repair'>): number { return Math.max(0, (this.profile.boosts[id] - this.now()) / 1000); }

  pad(id: PadId): PadState { return this.pads.find((p) => p.def.id === id)!; }
  level(id: PadId): number { return this.pad(id).level; }

  padVisible(p: PadState): boolean {
    return p.level < p.def.max && p.def.requires.every((r) => (r === 'boss' ? this.bossDefeated : this.level(r) >= 1));
  }

  padPrice(p: PadState): Price {
    if (p.def.id === 'portal') {
      const w = this.world, c = w.def.portal, k = 1 + w.cycle;
      return {
        cash: Math.round((c.cash ?? 0) * (w.priceMult / w.def.priceMult)),
        em: (c.em ?? 0) * k, di: (c.di ?? 0) * k, ob: (c.ob ?? 0) * k,
      };
    }
    return { cash: Math.round(p.def.cost(p.level) * this.world.priceMult) };
  }

  padRemaining(p: PadState): Price {
    const price = this.padPrice(p), out: Price = {};
    for (const k of ['cash', ...GEMS] as const) {
      const r = (price[k] ?? 0) - (p.paid[k] ?? 0);
      if (r > 0) out[k] = r;
    }
    return out;
  }

  padProgress(p: PadState): number {
    const price = this.padPrice(p);
    let n = 0, sum = 0;
    for (const k of ['cash', ...GEMS] as const) {
      const v = price[k] ?? 0;
      if (!v) continue;
      n++;
      sum += Math.min(1, (p.paid[k] ?? 0) / v);
    }
    return n ? sum / n : 0;
  }

  canAfford(price: Price): boolean { return this.money >= (price.cash ?? 0) && hasGems(this.profile, price); }

  private pay(price: Price): void {
    this.money -= price.cash ?? 0;
    spendGems(this.profile, price);
  }

  aliveEnemies(): Enemy[] { return this.enemies.filter((b) => b.state !== 'dead' && b.state !== 'spawn'); }
  boss(): Enemy | undefined { return this.enemies.find((e) => e.boss && e.state !== 'dead' && e.state !== 'spawn'); }

  blocked(x: number, z: number, r: number): boolean {
    if (x < WORLD.minX || x > WORLD.maxX || z < WORLD.minZ || z > WORLD.maxZ) return true;
    for (const b of this.boxes) if (inBox(x, z, b, r)) return true;
    for (const t of this.towers) if (dist(x, z, t.x, t.z) < 0.8 + r) return true;
    if (dist(x, z, CAMPFIRE.x, CAMPFIRE.z) < 0.7 + r) return true;
    return false;
  }

  /** Next point on the way to (tx,tz); every pen connects to the camp through its gate. */
  waypoint(x: number, z: number, tx: number, tz: number): Pt {
    const a = regionOf(x, z), b = regionOf(tx, tz);
    if (a === b) return { x: tx, z: tz };
    const g = GATES[(a === 'camp' ? b : a) as Exclude<Region, 'camp'>];
    const s = a === 'camp' ? g.camp : g.other, e = a === 'camp' ? g.other : g.camp;
    return distToSegment(x, z, s, e) < 0.6 ? e : s;
  }

  // ---------- update ----------

  update(dt: number, dir: { x: number; z: number }): void {
    this.time += dt;
    this.updatePlayer(dt, dir);
    this.updateTrees(dt);
    this.updateOres(dt);
    this.updateTransfers(dt);
    this.updateSurvivors(dt);
    this.updateWaves(dt);
    this.updateEnemies(dt);
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
    p.lockT = Math.max(0, p.lockT - dt);
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

    // orbiting axes chop the nearest tree in reach
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
      p.chopT += dt * (this.boostActive('chop') ? 2 : 1);
      const every = STATS.chopInterval(this.lv);
      if (p.chopT >= every) {
        p.chopT -= every;
        this.hitTree(p.target, p.x, p.z);
        p.stack.push({ anim: 0, fx: p.target.x, fy: 1.2, fz: p.target.z });
        questProgress(this.profile, 'chop', 1);
        sfx('pick');
        if (p.stack.length >= this.capacity) this.events.push({ type: 'float', text: T.full, x: p.x, z: p.z, color: '#ff5a4f' });
      }
    } else p.chopT = 0;

    // the pickaxe mines the nearest ore in reach
    p.mining = null;
    if (!p.target) {
      let best: Ore | null = null, bestD = PLAYER.mineReach;
      for (const o of this.ores) {
        if (o.hp <= 0) continue;
        const d = dist(o.x, o.z, p.x, p.z);
        if (d < bestD) { best = o; bestD = d; }
      }
      if (best && this.pickLevel < ORES[best.gem].pickLevel) {
        if (p.lockT <= 0) {
          p.lockT = 1.5;
          this.events.push({ type: 'float', text: fmt(T.needPick, { n: ORES[best.gem].pickLevel }), x: best.x, z: best.z, color: '#ffb36b' });
        }
        best = null;
      }
      p.mining = best;
    }
    if (p.mining) {
      p.mineT += dt;
      const every = STATS.mineInterval(this.lv);
      if (p.mineT >= every) {
        p.mineT -= every;
        this.hitOre(p.mining);
      }
    } else p.mineT = 0;

    // ...and the axes hurt any creature that gets close
    for (const b of this.enemies) {
      if (b.state === 'dead' || b.state === 'spawn') continue;
      if (dist(b.x, b.z, p.x, p.z) > PLAYER.axeReach + (b.boss ? 1.4 : 0.6)) continue;
      b.hitT += dt;
      const tick = b.hitT >= 0.22;
      if (tick) b.hitT = 0;
      this.damageEnemy(b, STATS.axeDps(this.lv) * this.world.towerMult * dt, tick);
    }
  }

  private hitTree(t: Tree, fromX: number, fromZ: number): void {
    t.hp--;
    t.shake = 0.3;
    if (t.hp <= 0) {
      t.respawnT = TREE.respawn;
      t.reserved = false;
      t.fallT = 0;
      t.fallDir = Math.atan2(t.x - fromX, t.z - fromZ);
    }
    this.events.push({ type: 'burst', x: t.x, y: 1.4, z: t.z, color: 0x6fbf4a, n: 5 });
    sfx('chop');
  }

  private hitOre(o: Ore): void {
    o.hp--;
    o.shake = 0.25;
    const color = o.gem === 'em' ? 0x2ee87a : o.gem === 'di' ? 0x6fe8ff : 0x9b5cff;
    this.events.push({ type: 'burst', x: o.x, y: 0.9, z: o.z, color, n: 4 });
    sfx('hit');
    if (o.hp > 0) return;
    o.respawnT = ORES[o.gem].respawn;
    o.reserved = false;
    const got: Price = { [o.gem]: ORES[o.gem].yield };
    addGems(this.profile, got);
    questProgress(this.profile, 'mine', ORES[o.gem].yield);
    this.events.push({ type: 'gems', price: got, x: o.x, z: o.z });
    this.events.push({ type: 'burst', x: o.x, y: 0.8, z: o.z, color, n: 14 });
    sfx('coin');
    this.onChange?.();
  }

  private updateTrees(dt: number): void {
    for (const t of this.trees) {
      t.shake = Math.max(0, t.shake - dt);
      t.fallT += dt;
      if (t.hp <= 0) {
        t.respawnT -= dt;
        if (t.respawnT <= 0) { t.hp = TREE.hp; t.grow = 0; }
      }
      t.grow = Math.min(1, t.grow + dt * 2);
    }
  }

  private updateOres(dt: number): void {
    for (const o of this.ores) {
      o.shake = Math.max(0, o.shake - dt);
      if (o.hp <= 0) {
        o.respawnT -= dt;
        if (o.respawnT <= 0) { o.hp = o.maxHp; o.grow = 0; }
      }
      o.grow = Math.min(1, o.grow + dt * 2);
    }
  }

  // ---------- zones: counter, cash pile, forge, pads ----------

  private zoneAt(x: number, z: number): string {
    for (const p of this.pads) {
      if (this.padVisible(p) && inBox(x, z, { x: p.def.x, z: p.def.z, w: PAD_SIZE, d: PAD_SIZE })) return p.def.id;
    }
    if (inBox(x, z, DEPOSIT_ZONE)) return 'deposit';
    if (inBox(x, z, CASH_ZONE)) return 'cash';
    if (inBox(x, z, FORGE_ZONE)) return 'forge';
    return '';
  }

  private updateTransfers(dt: number): void {
    const p = this.player;
    const key = this.zoneAt(p.x, p.z);
    const isPad = key !== '' && key !== 'deposit' && key !== 'cash' && key !== 'forge';
    if (key !== this.zoneKey) {
      if (key === 'forge') this.events.push({ type: 'forge' });
      this.zoneKey = key;
      this.zoneT = 0;
    }
    // pads only spend while the player stands still, so walking across one never buys anything
    if (isPad && p.moving) this.zoneT = 0;
    this.zoneT += dt;
    if (!key || key === 'forge' || this.zoneT < (isPad ? 0.25 : key === 'deposit' ? 0.12 : 0)) return;
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
      did = this.payPad(this.pad(key as PadId));
    }
    this.transferT = did ? 0.06 : 0;
    if (did) this.onChange?.();
  }

  private payPad(pad: PadState): boolean {
    const p = this.player, rem = this.padRemaining(pad), price = this.padPrice(pad);
    const cashRem = rem.cash ?? 0;
    if (cashRem > 0 && this.money > 0) {
      const chunk = Math.min(this.money, cashRem, Math.max(1, Math.ceil((price.cash ?? 0) / 20)));
      this.money -= chunk;
      pad.paid.cash = (pad.paid.cash ?? 0) + chunk;
      this.events.push({ type: 'fly', kind: 'cash', x0: p.x, y0: 1.4, z0: p.z, x1: pad.def.x, y1: 0.1, z1: pad.def.z });
    } else {
      const g = GEMS.find((k) => (rem[k] ?? 0) > 0 && this.profile.gems[k] > 0);
      if (!g) return false;
      const chunk = Math.min(this.profile.gems[g], rem[g] ?? 0, Math.max(1, Math.ceil((price[g] ?? 0) / 15)));
      this.profile.gems[g] -= chunk;
      pad.paid[g] = (pad.paid[g] ?? 0) + chunk;
      this.events.push({ type: 'burst', x: pad.def.x, y: 0.4, z: pad.def.z, color: g === 'em' ? 0x2ee87a : g === 'di' ? 0x6fe8ff : 0x9b5cff, n: 3 });
    }
    pad.pulse = 0.12;
    sfx('coin');
    if (Object.keys(this.padRemaining(pad)).length === 0) this.completePad(pad);
    return true;
  }

  private completePad(pad: PadState): void {
    pad.level++;
    pad.paid = {};
    const { id, x, z } = pad.def;
    if (id.startsWith('tower')) {
      this.towers.push({ id, x, z, cd: 0.5, aim: -Math.PI / 2, recoil: 0 });
      const p = this.player;
      if (dist(p.x, p.z, x, z) < 1.4) p.x = x - 1.5; // step off the spot where the tower appears
    }
    if (id === 'lumber') this.spawnWorker('lumber');
    if (id === 'miner') this.spawnWorker('miner');
    if (id === 'wall') this.wallHp = this.wallMax;
    this.events.push({ type: 'build', id, x, z });
    this.events.push({ type: 'shake', power: 0.25 });
    sfx(id === 'wall' || id === 'lumber' || id === 'miner' ? 'upgrade' : 'build');
    vibrate(60);
    if (id === 'portal') {
      this.worldDone = true;
      this.events.push({ type: 'worldComplete' });
    }
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
        const pay = Math.round(s.want * this.logPrice);
        this.cashPile += pay;
        questProgress(this.profile, 'serve', 1);
        questProgress(this.profile, 'earn', pay);
        this.events.push({ type: 'fly', kind: 'cash', x0: s.x, y0: 1.5, z0: s.z, x1: CASH_ZONE.x, y1: 0.4, z1: CASH_ZONE.z });
        this.events.push({ type: 'float', text: `+$${formatNum(pay)}`, x: s.x, z: s.z, color: '#7dff7a' });
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

  // ---------- waves, creatures & defence ----------

  private updateWaves(dt: number): void {
    if (!this.waveActive) {
      this.wallHp = Math.min(this.wallMax, this.wallHp + 10 * dt);
      this.waveTimer -= dt;
      if (this.waveTimer <= 0) this.startWave();
      return;
    }
    if (this.enemies.every((b) => b.state === 'dead')) {
      this.waveActive = false;
      this.breached = false;
      this.profile.stats.bestWave = Math.max(this.profile.stats.bestWave, this.wave);
      questProgress(this.profile, 'waves', 1);
      this.wave++;
      this.waveTimer = WAVES.gap;
      this.events.push({ type: 'toast', text: T.waveCleared });
      sfx('upgrade');
      this.onChange?.();
    }
  }

  private spawnEnemy(boss: boolean, delay: number): void {
    const kind = this.world.def.enemy, e = ENEMIES[kind];
    const hp = e.hp * WAVES.hp(this.wave) * this.world.hpMult * (boss ? WAVES.bossHp : 1);
    const z = boss ? 0 : -10 + this.rnd() * 20;
    this.enemies.push({
      id: this.nextId++, kind, boss, x: 27 + this.rnd() * 4, z, hp, maxHp: hp, homeZ: Math.max(-7.3, Math.min(7.3, z)),
      speed: e.speed * (boss ? 0.75 : 1), damage: e.wallDamage * (boss ? WAVES.bossDamage : 1), attackEvery: e.attackEvery,
      state: 'spawn', delay, atkT: 0, flash: 0, hitT: 0, deadT: 0, face: -Math.PI / 2, walkT: 0,
    });
  }

  private startWave(): void {
    this.waveActive = true;
    const n = WAVES.count(this.wave);
    for (let i = 0; i < n; i++) this.spawnEnemy(false, i * 1.3);
    const bossWave = this.wave % WAVES.bossEvery === 0;
    if (bossWave) this.spawnEnemy(true, n * 1.3 + 1);
    this.events.push({ type: 'toast', text: fmt(T.wave, { n: this.wave }), sub: bossWave ? T.bossComing : T.waveStart });
    sfx('bear');
  }

  private damageEnemy(b: Enemy, dmg: number, fx: boolean): void {
    if (b.state === 'dead') return;
    b.hp -= dmg;
    if (fx) {
      b.flash = 1;
      this.events.push({ type: 'burst', x: b.x, y: 1.1, z: b.z, color: 0xb3262e, n: 4 });
      sfx('hit');
    }
    if (b.hp > 0) return;
    b.state = 'dead';
    b.deadT = 0;
    this.profile.stats.kills++;
    questProgress(this.profile, 'kill', 1);
    const value = Math.round(WAVES.reward(this.wave) * this.world.priceMult * (b.boss ? 20 : 1) * (this.boostActive('cash') ? 2 : 1));
    this.drops.push({ id: this.nextId++, x: b.x, z: b.z, value, t: 0 });
    this.events.push({ type: 'burst', x: b.x, y: 1, z: b.z, color: 0xffffff, n: b.boss ? 40 : 14 });
    sfx('bear');
    if (b.boss) {
      const reward = scalePrice(this.world.def.bossGems, 1 + this.world.cycle);
      addGems(this.profile, reward);
      this.events.push({ type: 'gems', price: reward, x: b.x, z: b.z });
      if (!this.bossDefeated) {
        this.bossDefeated = true;
        this.events.push({ type: 'toast', text: T.bossDown, sub: T.portalOpen });
      }
      this.events.push({ type: 'shake', power: 0.6 });
      this.onChange?.();
    }
  }

  private updateEnemies(dt: number): void {
    const p = this.player;
    const region = regionOf(p.x, p.z);
    for (const b of this.enemies) {
      if (b.state === 'dead') { b.deadT += dt; continue; }
      if (b.state === 'spawn') { b.delay -= dt; if (b.delay <= 0) b.state = 'approach'; continue; }
      b.flash = Math.max(0, b.flash - dt * 9);
      const dP = dist(b.x, b.z, p.x, p.z);
      // creatures never enter the fenced forest or mine
      const canChase = (this.breached && (region === 'camp' || region === 'out')) || (region === 'out' && dP < WAVES.aggro);
      if (canChase) b.state = 'chase';
      else if (b.state === 'chase') b.state = 'approach';
      const reach = b.boss ? 2.4 : 1.5;

      if (b.state === 'chase') {
        if (dP < reach) {
          b.face = turnTo(b.face, Math.atan2(p.x - b.x, p.z - b.z), dt * 10);
          b.atkT += dt;
          if (b.atkT >= 1.1) { b.atkT = 0; this.hurtPlayer(b); }
        } else {
          const wp = this.waypoint(b.x, b.z, p.x, p.z);
          this.walkTo(b, wp.x, wp.z, b.speed * 1.15, dt, 0.1);
        }
      } else if (b.state === 'approach') {
        if (this.breached) {
          const wp = this.waypoint(b.x, b.z, 2, 0);
          this.walkTo(b, wp.x, wp.z, b.speed, dt, 0.8);
        } else if (this.walkTo(b, CAMP.half + (b.boss ? 2 : 1.2), b.homeZ, b.speed, dt, 0.15)) {
          b.state = 'attack';
          b.atkT = 0;
        }
      } else if (b.state === 'attack') {
        b.face = turnTo(b.face, -Math.PI / 2, dt * 8);
        b.atkT += dt;
        if (this.breached) b.state = 'approach';
        else if (b.atkT >= b.attackEvery) {
          b.atkT = 0;
          this.wallHp = Math.max(0, this.wallHp - b.damage);
          this.events.push({ type: 'burst', x: CAMP.half + 0.3, y: 1, z: b.z, color: 0xc9844a, n: b.boss ? 12 : 5 });
          if (b.boss) this.events.push({ type: 'shake', power: 0.2 });
          sfx('thud');
          if (this.wallHp <= 0 && !this.breached) {
            this.breached = true;
            this.events.push({ type: 'toast', text: T.breach });
            this.events.push({ type: 'shake', power: 0.5 });
            vibrate(150);
          }
        }
      }
      if (!this.breached) b.x = Math.max(b.x, CAMP.half + (b.boss ? 1.6 : 0.9)); // the palisade holds
    }
    const alive = this.aliveEnemies();
    for (let i = 0; i < alive.length; i++) {
      for (let j = i + 1; j < alive.length; j++) {
        const a = alive[i], c = alive[j];
        const min = a.boss || c.boss ? 2.4 : 1.3;
        const d = dist(a.x, a.z, c.x, c.z);
        if (d > 0 && d < min) {
          const push = (min - d) / 2, nx = (a.x - c.x) / d, nz = (a.z - c.z) / d;
          a.x += nx * push; a.z += nz * push; c.x -= nx * push; c.z -= nz * push;
        }
      }
    }
    this.enemies = this.enemies.filter((b) => b.state !== 'dead' || b.deadT < 1.6);
  }

  private hurtPlayer(b: Enemy): void {
    const p = this.player;
    if (p.hurtT > 0) return;
    p.hurtT = 1.2;
    const d = Math.max(0.01, dist(p.x, p.z, b.x, b.z));
    p.kx = ((p.x - b.x) / d) * (b.boss ? 16 : 10);
    p.kz = ((p.z - b.z) / d) * (b.boss ? 16 : 10);
    const lost = Math.min(b.boss ? 6 : 3, p.stack.length);
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
      let target: Enemy | null = null, bestD = TOWER.range;
      for (const b of this.enemies) {
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
      const b = this.enemies.find((x) => x.id === bolt.target);
      if (!b || b.state === 'dead') { bolt.target = -1; continue; }
      const ty = b.boss ? 2 : 1;
      const dx = b.x - bolt.x, dy = ty - bolt.y, dz = b.z - bolt.z, d = Math.hypot(dx, dy, dz);
      const step = 28 * dt;
      bolt.dx = dx / d; bolt.dy = dy / d; bolt.dz = dz / d;
      if (d <= step + (b.boss ? 1 : 0.3)) {
        this.damageEnemy(b, bolt.dmg, true);
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
        questProgress(this.profile, 'earn', d.value);
        this.events.push({ type: 'float', text: `+$${formatNum(d.value)}`, x: p.x, z: p.z, color: '#7dff7a' });
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

  // ---------- helpers: lumberjacks & miners ----------

  spawnWorker(kind: Worker['kind']): void {
    this.workers.push({
      id: this.nextId++, kind, x: kind === 'miner' ? -6 : -3, z: kind === 'miner' ? -1 : -4, face: 0, walkT: 0, moving: false,
      state: kind === 'miner' ? 'toOre' : 'toTree', target: null, carry: 0, t: 0,
    });
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
        let t = w.target as Tree | null;
        if (!t || t.hp <= 0) {
          release();
          let bestD = Infinity;
          const gate = GATES.forest.other;
          t = null;
          for (const c of this.trees) {
            if (c.hp <= 0 || c.reserved) continue;
            const d = dist(c.x, c.z, gate.x, gate.z);
            if (d < bestD) { t = c; bestD = d; }
          }
          if (!t) { w.moving = false; break; }
          t.reserved = true;
          w.target = t;
        }
        if (go(t.x, t.z + 1, 0.2)) { w.state = 'chop'; w.t = 0; }
        break;
      }
      case 'chop': {
        w.moving = false;
        const t = w.target as Tree | null;
        if (!t || t.hp <= 0) { release(); w.state = w.carry > 0 ? 'toCounter' : 'toTree'; break; }
        w.face = turnTo(w.face, Math.atan2(t.x - w.x, t.z - w.z), dt * 8);
        w.t += dt;
        if (w.t >= WORKER.chopTime) {
          w.t = 0;
          this.hitTree(t, w.x, w.z);
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
      case 'toOre': {
        let o = w.target as Ore | null;
        if (!o || o.hp <= 0) {
          release();
          let bestD = Infinity;
          o = null;
          for (const c of this.ores) {
            if (c.hp <= 0 || c.reserved || ORES[c.gem].pickLevel > this.pickLevel) continue;
            const d = dist(c.x, c.z, w.x, w.z);
            if (d < bestD) { o = c; bestD = d; }
          }
          if (!o) { w.moving = false; break; }
          o.reserved = true;
          w.target = o;
        }
        if (go(o.x + 1.1, o.z, 0.15)) { w.state = 'mine'; w.t = 0; }
        break;
      }
      case 'mine': {
        w.moving = false;
        const o = w.target as Ore | null;
        if (!o || o.hp <= 0) { release(); w.state = 'toOre'; break; }
        w.face = turnTo(w.face, Math.atan2(o.x - w.x, o.z - w.z), dt * 8);
        w.t += dt;
        if (w.t >= WORKER.mineTime) { w.t = 0; this.hitOre(o); }
        break;
      }
    }
  }

  // ---------- forge, shop, daily, quests ----------

  upgradePrice(id: UpgradeId): Price | null {
    const def = UPGRADES.find((u) => u.id === id)!;
    const l = this.lv[id];
    if (l >= def.max) return null;
    const p = def.cost(l);
    return { ...p, cash: Math.round((p.cash ?? 0) * this.world.priceMult) };
  }

  buyUpgrade(id: UpgradeId): boolean {
    const price = this.upgradePrice(id);
    if (!price || !this.canAfford(price)) return false;
    this.pay(price);
    this.lv[id]++;
    sfx('upgrade');
    vibrate(40);
    this.onChange?.();
    return true;
  }

  buySkin(id: SkinId): boolean {
    const s = SKINS.find((k) => k.id === id)!;
    if (this.profile.skins.includes(id)) { this.profile.skin = id; this.onChange?.(); return true; }
    if (!hasGems(this.profile, s.price)) return false;
    spendGems(this.profile, s.price);
    this.profile.skins.push(id);
    this.profile.skin = id;
    sfx('build');
    this.onChange?.();
    return true;
  }

  buyBoost(id: BoostId): boolean {
    const b = BOOSTS.find((k) => k.id === id)!;
    if (!hasGems(this.profile, b.price)) return false;
    spendGems(this.profile, b.price);
    this.applyBoost(id, b.seconds);
    this.onChange?.();
    return true;
  }

  private applyBoost(id: BoostId, seconds: number): void {
    if (id === 'repair') {
      this.wallHp = this.wallMax;
      this.breached = false;
    } else {
      const now = this.now();
      this.profile.boosts[id] = Math.max(now, this.profile.boosts[id]) + seconds * 1000;
    }
    sfx('upgrade');
  }

  freeChestReady(): boolean { return this.now() >= this.profile.freeChestAt; }

  openChest(free: boolean): Price | null {
    if (free) {
      if (!this.freeChestReady()) return null;
      this.profile.freeChestAt = this.now() + CHEST.freeEvery;
    } else {
      if (!hasGems(this.profile, CHEST.price)) return null;
      spendGems(this.profile, CHEST.price);
    }
    const r = Math.random;
    const got: Price = free
      ? { em: 3 + Math.floor(r() * 6), di: Math.floor(r() * 3) }
      : { em: 8 + Math.floor(r() * 12), di: 2 + Math.floor(r() * 5), ob: r() < 0.35 ? 1 + Math.floor(r() * 3) : 0 };
    addGems(this.profile, got);
    sfx('build');
    this.onChange?.();
    return got;
  }

  dailyAvailable(): boolean { return dailyAvailable(this.profile); }
  dailyIndex(): number { return dailyIndex(this.profile); }

  claimDaily(): Reward | null {
    if (!this.dailyAvailable()) return null;
    const i = this.dailyIndex();
    const r = DAILY_REWARDS[i];
    const got: Reward = {};
    if (r.cash) { got.cash = Math.round(r.cash * this.world.priceMult); this.money += got.cash; }
    for (const g of GEMS) {
      const n = r[g] ?? 0;
      if (n) { got[g] = n; this.profile.gems[g] += n; }
    }
    if (r.boost) { got.boost = r.boost; this.applyBoost(r.boost, 300); }
    if (r.skin && !this.profile.skins.includes(r.skin)) { got.skin = r.skin; this.profile.skins.push(r.skin); }
    this.profile.daily = { last: dayKey(), streak: i + 1 };
    sfx('build');
    this.onChange?.();
    return got;
  }

  claimQuest(i: number): boolean {
    const q = this.profile.quests.list[i];
    if (!q || q.claimed || q.progress < q.target) return false;
    q.claimed = true;
    addGems(this.profile, q.reward);
    sfx('build');
    this.onChange?.();
    return true;
  }

  questsReady(): number { return this.profile.quests.list.filter((q) => !q.claimed && q.progress >= q.target).length; }

  /** First Forge upgrade the player can afford right now, if any. */
  affordableUpgrade(): UpgradeId | null {
    for (const u of UPGRADES) {
      const p = this.upgradePrice(u.id);
      if (p && this.canAfford(p)) return u.id;
    }
    return null;
  }

  // ---------- guidance ----------

  /** Next thing the player should do: hint text plus where the guide arrow points. */
  objective(): { text: string; x: number; z: number } | null {
    const p = this.player;
    const alive = this.aliveEnemies();
    if (alive.length && (this.breached || this.towers.length === 0)) {
      const b = this.nearest(alive)!;
      return { text: this.breached ? T.breach : T.defend, x: b.x, z: b.z };
    }
    const boss = this.boss();
    if (boss) return { text: T.bossFight, x: boss.x, z: boss.z };

    const next = PAD_ORDER.map((id) => this.pad(id)).find((pd) => this.padVisible(pd) && pd.level === 0);
    if (next) {
      const h = this.acquire(this.padRemaining(next), 0);
      if (h) return h;
      const label = next.def.id === 'portal' ? T.buildPortal : fmt(T.buy, { b: T.pad[next.def.id] });
      return { text: label, x: next.def.x, z: next.def.z };
    }
    if (this.cashPile > 0 && !p.stack.length) return this.hintCash();
    if (p.stack.length >= this.capacity) return this.hintDeliver();
    if (!p.stack.length && this.affordableUpgrade()) return { text: T.forge, x: FORGE_ZONE.x, z: FORGE_ZONE.z };
    if (!this.bossDefeated) return this.hintChop(fmt(T.survive, { n: Math.ceil(this.wave / WAVES.bossEvery) * WAVES.bossEvery }));
    return this.hintChop(T.free);
  }

  private nearest<K extends { x: number; z: number }>(list: K[]): K | null {
    const p = this.player;
    let best: K | null = null, bestD = Infinity;
    for (const c of list) {
      const d = dist(c.x, c.z, p.x, p.z);
      if (d < bestD) { best = c; bestD = d; }
    }
    return best;
  }

  private hintCash() { return { text: T.takeCash, x: CASH_ZONE.x, z: CASH_ZONE.z }; }
  private hintDeliver() { return { text: T.deliver, x: DEPOSIT_ZONE.x, z: DEPOSIT_ZONE.z }; }
  private hintChop(text: string) {
    const t = this.nearest(this.trees.filter((tr) => tr.hp > 0));
    return t ? { text, x: t.x, z: t.z } : this.hintDeliver();
  }

  /** Hint for getting whatever is still missing to pay `price`; null when it's already affordable. */
  private acquire(price: Price, depth: number): { text: string; x: number; z: number } | null {
    const p = this.player;
    const cashNeed = (price.cash ?? 0) - this.money;
    const gemNeed = GEMS.find((g) => (price[g] ?? 0) > this.profile.gems[g]);
    if (cashNeed <= 0 && !gemNeed) return null;
    if (gemNeed) {
      if (this.pickLevel >= ORES[gemNeed].pickLevel) {
        if (p.stack.length >= this.capacity) return this.hintDeliver();
        const o = this.nearest(this.ores.filter((x) => x.gem === gemNeed && x.hp > 0)) ?? this.nearest(this.ores.filter((x) => x.gem === gemNeed));
        if (o) return { text: fmt(T.mine, { g: T.gem[gemNeed] }), x: o.x, z: o.z };
      } else if (depth < 3) {
        const up = this.upgradePrice('pick');
        if (up) {
          return this.acquire(up, depth + 1) ?? { text: fmt(T.upgradePick, { n: ORES[gemNeed].pickLevel }), x: FORGE_ZONE.x, z: FORGE_ZONE.z };
        }
      }
    }
    if (cashNeed <= 0) return null;
    const full = p.stack.length >= this.capacity;
    if (this.cashPile > 0 && this.cashPile >= cashNeed) return this.hintCash();
    const worth = this.cashPile + (p.stack.length + this.counterLogs) * this.logPrice;
    if (p.stack.length && (full || worth >= cashNeed)) return this.hintDeliver();
    if (this.cashPile > 0 && !p.stack.length) return this.hintCash();
    if (full) return this.hintDeliver();
    return this.hintChop(T.chop);
  }

  // ---------- persistence ----------

  serializeCamp(): CampSave {
    const pads: CampSave['pads'] = {};
    for (const p of this.pads) pads[p.def.id] = { level: p.level, paid: { ...p.paid } };
    return {
      money: this.money, cashPile: this.cashPile, counterLogs: this.counterLogs, pads,
      stack: this.player.stack.length, px: this.player.x, pz: this.player.z, wave: this.wave,
      waveTimer: this.waveActive ? 20 : this.waveTimer, wallHp: this.wallHp,
      bossDefeated: this.bossDefeated, worldDone: this.worldDone, savedAt: Date.now(),
    };
  }

  private loadCamp(d: CampSave): void {
    this.money = d.money;
    this.cashPile = d.cashPile;
    this.counterLogs = d.counterLogs;
    for (const p of this.pads) {
      const s = d.pads[p.def.id];
      if (!s) continue;
      p.level = Math.min(s.level, p.def.max);
      p.paid = { ...s.paid };
      if (p.def.id.startsWith('tower') && p.level > 0) {
        this.towers.push({ id: p.def.id, x: p.def.x, z: p.def.z, cd: 0, aim: -Math.PI / 2, recoil: 0 });
      }
    }
    for (let i = 0; i < this.level('lumber'); i++) this.spawnWorker('lumber');
    for (let i = 0; i < this.level('miner'); i++) this.spawnWorker('miner');
    this.player.stack = Array.from({ length: Math.min(d.stack, this.capacity) }, () => ({ anim: 1, fx: 0, fy: 0, fz: 0 }));
    if (!this.blocked(d.px, d.pz, PLAYER.radius)) { this.player.x = d.px; this.player.z = d.pz; }
    this.wave = d.wave;
    this.waveTimer = Math.max(15, d.waveTimer);
    this.wallHp = d.wallHp;
    this.bossDefeated = d.bossDefeated;
    this.worldDone = d.worldDone;

    // lumberjacks keep supplying the camp while the game is closed (about half the online rate, max 2h)
    const away = Math.min(2 * 3600, (Date.now() - d.savedAt) / 1000);
    const lumber = this.level('lumber');
    if (away > 60 && lumber > 0) {
      const earned = Math.floor(away * lumber * 0.25 * this.world.priceMult);
      this.cashPile += earned;
      this.events.push({ type: 'toast', text: T.welcome, sub: `+$${formatNum(earned)}` });
    }
  }
}
