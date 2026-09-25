import {
  BRIDGES, COST_KEYS, ISLANDS, MAIN_ORDER, NODE_INFO, NODE_REGIONS, PLAYER_START, PLOTS, RES_VALUE,
  SAW_IN_MAX, SAW_OUT_MAX, SAW_TIME, UPGRADES, WORKER, ZONES, inRect, mulberry32, stats,
  type Cost, type CostKey, type IslandId, type NodeKind, type PlotDef, type PlotId, type Res,
  type UpgradeId,
} from './data';
import { sfx, vibrate } from './audio';
import { T, fmt } from './i18n';

export interface StackItem { res: Res; anim: number; fx: number; fy: number; }

export interface ResNode {
  kind: NodeKind; island: IslandId; x: number; y: number;
  hp: number; maxHp: number; respawnT: number; shake: number; grow: number; reserved: boolean;
}

export interface Worker {
  x: number; y: number; facing: number; walkT: number;
  state: 'seek' | 'walk' | 'chop' | 'deliver' | 'drop';
  target: ResNode | null; carry: number; t: number;
}

export interface Plot { def: PlotDef; paid: Cost; built: boolean; pulse: number; }

export interface Flyer { kind: CostKey; x0: number; y0: number; x1: number; y1: number; t: number; dur: number; }
export interface Floater { text: string; x: number; y: number; t: number; color: string; coin?: number; }
export interface Particle { x: number; y: number; z: number; vx: number; vy: number; vz: number; life: number; color: string; size: number; }

export interface SaveData {
  v: 1; coins: number; cash: number; levels: Record<UpgradeId, number>;
  plots: Partial<Record<PlotId, { paid: Cost; built: boolean }>>;
  stack: Res[]; px: number; py: number; sawIn: number; sawOut: number; won: boolean; savedAt: number;
}

const isUpgrade = (id: PlotId): id is UpgradeId => id.startsWith('up');

export class Game {
  player = {
    x: PLAYER_START.x, y: PLAYER_START.y, facing: 1, walkT: 0, moving: false,
    stack: [] as StackItem[], harvestT: 0, target: null as ResNode | null, swing: 0, fullFlash: 0,
  };
  coins = 0;
  cash = 0;
  levels: Record<UpgradeId, number> = { upCap: 0, upSpeed: 0, upHarvest: 0, upHire: 0 };
  plots: Plot[] = PLOTS.map((def) => ({ def, paid: {}, built: false, pulse: 0 }));
  nodes: ResNode[] = [];
  workers: Worker[] = [];
  sawIn = 0;
  sawOut = 0;
  sawT = 0;
  sawSpin = 0;
  flyers: Flyer[] = [];
  floaters: Floater[] = [];
  particles: Particle[] = [];
  shake = 0;
  time = 0;
  won = false;
  showWin = false;
  toast: { text: string; sub?: string; t: number } | null = null;
  private transferT = 0;
  private zoneKey = '';
  private zoneT = 0;
  onChange: (() => void) | null = null;

  constructor() {
    const rnd = mulberry32(1337);
    for (const reg of NODE_REGIONS) {
      const r = reg.rect, s = reg.spacing;
      const cols = Math.max(1, Math.floor(r.w / s)), rows = Math.max(1, Math.floor(r.h / s));
      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          if (rnd() < 0.18) continue; // leave some gaps so it feels natural
          const x = r.x - r.w / 2 + (i + 0.5) * (r.w / cols) + (rnd() - 0.5) * s * 0.45;
          const y = r.y - r.h / 2 + (j + 0.5) * (r.h / rows) + (rnd() - 0.5) * s * 0.45;
          if (PLOTS.some((p) => inRect(x, y, p, 30)) || Object.values(ZONES).some((z) => inRect(x, y, z, 30))) continue;
          const hp = NODE_INFO[reg.kind].hp;
          this.nodes.push({ kind: reg.kind, island: reg.island, x, y, hp, maxHp: hp, respawnT: 0, shake: 0, grow: 1, reserved: false });
        }
      }
    }
  }

  // ---------- queries ----------

  plot(id: PlotId): Plot { return this.plots.find((p) => p.def.id === id)!; }
  isBuilt(id: PlotId): boolean { return this.plot(id).built; }
  get capacity(): number { return stats.capacity(this.levels.upCap); }

  islandUnlocked(id: IslandId): boolean {
    const isl = ISLANDS.find((i) => i.id === id)!;
    return !isl.unlockedBy || this.isBuilt(isl.unlockedBy);
  }

  plotVisible(p: Plot): boolean {
    if (p.built) return false;
    if (!p.def.requires.every((r) => this.isBuilt(r))) return false;
    if (isUpgrade(p.def.id) && this.levels[p.def.id] >= UPGRADES[p.def.id].max) return false;
    return true;
  }

  plotCost(p: Plot): Cost {
    const id = p.def.id;
    if (isUpgrade(id)) return { coin: UPGRADES[id].cost(this.levels[id]) };
    return p.def.cost ?? {};
  }

  remaining(p: Plot, k: CostKey): number {
    return Math.max(0, (this.plotCost(p)[k] ?? 0) - (p.paid[k] ?? 0));
  }

  progress(p: Plot): number {
    const c = this.plotCost(p);
    let total = 0, paid = 0;
    for (const k of COST_KEYS) { total += c[k] ?? 0; paid += Math.min(c[k] ?? 0, p.paid[k] ?? 0); }
    return total ? paid / total : 0;
  }

  walkable(x: number, y: number): boolean {
    for (const isl of ISLANDS) if (this.islandUnlocked(isl.id) && inRect(x, y, isl, -14)) return true;
    for (const b of BRIDGES) if (this.isBuilt(b.id) && inRect(x, y, b)) return true;
    return false;
  }

  countInStack(r: Res): number { return this.player.stack.reduce((n, s) => n + (s.res === r ? 1 : 0), 0); }

  // ---------- update ----------

  update(dt: number, dir: { x: number; y: number }): void {
    this.time += dt;
    this.updatePlayer(dt, dir);
    this.updateNodes(dt);
    this.updateTransfers(dt);
    this.updateSawmill(dt);
    for (const w of this.workers) this.updateWorker(w, dt);
    this.updateFx(dt);
  }

  private updatePlayer(dt: number, dir: { x: number; y: number }): void {
    const p = this.player;
    const sp = stats.speed(this.levels.upSpeed);
    const nx = p.x + dir.x * sp * dt, ny = p.y + dir.y * sp * dt;
    if (this.walkable(nx, p.y)) p.x = nx;
    if (this.walkable(p.x, ny)) p.y = ny;
    p.moving = Math.hypot(dir.x, dir.y) > 0.1;
    if (p.moving) p.walkT += dt * 10;
    if (Math.abs(dir.x) > 0.15) p.facing = Math.sign(dir.x);
    for (const s of p.stack) s.anim = Math.min(1, s.anim + dt * 5);
    p.fullFlash = Math.max(0, p.fullFlash - dt);

    // auto-harvest the nearest node in reach
    p.target = null;
    if (p.stack.length < this.capacity) {
      let best: ResNode | null = null, bestD = 56;
      for (const n of this.nodes) {
        if (n.hp <= 0) continue;
        const d = Math.hypot(n.x - p.x, n.y - p.y);
        if (d < bestD) { best = n; bestD = d; }
      }
      p.target = best;
    }
    if (p.target) {
      p.swing += dt;
      p.harvestT += dt;
      const interval = stats.harvestInterval(this.levels.upHarvest);
      if (p.harvestT >= interval) {
        p.harvestT -= interval;
        const res = this.hitNode(p.target);
        p.stack.push({ res, anim: 0, fx: p.target.x, fy: p.target.y - 24 });
        sfx('pick');
        if (p.stack.length >= this.capacity) {
          p.fullFlash = 1;
          this.floaters.push({ text: T.full, x: p.x, y: p.y - 60, t: 0, color: '#ff5a4f' });
        }
      }
    } else {
      p.harvestT = 0;
      p.swing = 0;
    }
  }

  private hitNode(n: ResNode): Res {
    n.hp--;
    n.shake = 0.25;
    const info = NODE_INFO[n.kind];
    if (n.hp <= 0) { n.respawnT = info.respawn; n.reserved = false; }
    const col = n.kind === 'tree' ? '#c68a4c' : n.kind === 'gold' ? '#ffd23f' : '#a4acb8';
    for (let i = 0; i < 4; i++) this.burst(n.x, n.y, col, 1, 70, 90);
    sfx('chop');
    return info.res;
  }

  private updateNodes(dt: number): void {
    for (const n of this.nodes) {
      n.shake = Math.max(0, n.shake - dt);
      if (n.hp <= 0) {
        n.respawnT -= dt;
        if (n.respawnT <= 0) { n.hp = n.maxHp; n.grow = 0; }
      }
      n.grow = Math.min(1, n.grow + dt * 3);
    }
  }

  private zoneAt(x: number, y: number): string {
    for (const pl of this.plots) if (this.plotVisible(pl) && inRect(x, y, pl.def)) return pl.def.id;
    if (this.isBuilt('market')) {
      if (inRect(x, y, ZONES.marketSell)) return 'sell';
      if (inRect(x, y, ZONES.marketCash)) return 'cash';
    }
    if (this.isBuilt('sawmill')) {
      if (inRect(x, y, ZONES.sawIn)) return 'sawIn';
      if (inRect(x, y, ZONES.sawOut)) return 'sawOut';
    }
    return '';
  }

  private updateTransfers(dt: number): void {
    const p = this.player;
    const key = this.zoneAt(p.x, p.y);
    // upgrade pads only spend coins while the player stands still on them
    if (key !== this.zoneKey || (key.startsWith('up') && p.moving)) { this.zoneKey = key; this.zoneT = 0; }
    this.zoneT += dt;
    // items are only taken after a short stay, so walking across a zone doesn't empty the backpack
    const pickup = key === 'cash' || key === 'sawOut';
    if (!key || (!pickup && this.zoneT < 0.3)) return;
    this.transferT -= dt;
    if (this.transferT > 0) return;
    let did = false;

    for (const plot of this.plots) {
      if (!this.plotVisible(plot) || !inRect(p.x, p.y, plot.def)) continue;
      did = this.payPlot(plot);
      if (did) break;
    }
    if (!did && this.isBuilt('market')) {
      if (inRect(p.x, p.y, ZONES.marketSell) && p.stack.length) {
        const s = p.stack.pop()!;
        this.cash += RES_VALUE[s.res];
        this.fly(s.res, p.x, p.y - this.stackTopOffset(), ZONES.marketSell.x, ZONES.marketSell.y - 30);
        sfx('drop');
        did = true;
      } else if (inRect(p.x, p.y, ZONES.marketCash) && this.cash > 0) {
        const chunk = Math.min(this.cash, Math.max(1, Math.ceil(this.cash / 10)));
        this.cash -= chunk;
        this.coins += chunk;
        this.fly('coin', ZONES.marketCash.x, ZONES.marketCash.y, p.x, p.y - 30);
        this.coinFloater(chunk);
        sfx('coin');
        did = true;
      }
    }
    if (!did && this.isBuilt('sawmill')) {
      if (inRect(p.x, p.y, ZONES.sawIn) && this.sawIn < SAW_IN_MAX) {
        const i = this.findInStack('wood');
        if (i >= 0) {
          p.stack.splice(i, 1);
          this.sawIn++;
          this.fly('wood', p.x, p.y - this.stackTopOffset(), ZONES.sawIn.x, ZONES.sawIn.y - 40);
          sfx('drop');
          did = true;
        }
      } else if (inRect(p.x, p.y, ZONES.sawOut) && this.sawOut > 0 && p.stack.length < this.capacity) {
        this.sawOut--;
        p.stack.push({ res: 'plank', anim: 0, fx: ZONES.sawOut.x, fy: ZONES.sawOut.y - 10 });
        sfx('pick');
        did = true;
      }
    }
    this.transferT = did ? 0.065 : 0;
    if (did) this.onChange?.();
  }

  private findInStack(r: Res): number {
    const s = this.player.stack;
    for (let i = s.length - 1; i >= 0; i--) if (s[i].res === r) return i;
    return -1;
  }

  private payPlot(plot: Plot): boolean {
    const p = this.player;
    for (let i = p.stack.length - 1; i >= 0; i--) {
      const r = p.stack[i].res;
      if (this.remaining(plot, r) > 0) {
        p.stack.splice(i, 1);
        plot.paid[r] = (plot.paid[r] ?? 0) + 1;
        plot.pulse = 0.15;
        this.fly(r, p.x, p.y - this.stackTopOffset(), plot.def.x, plot.def.y);
        sfx('drop');
        this.checkComplete(plot);
        return true;
      }
    }
    const need = this.remaining(plot, 'coin');
    if (need > 0 && this.coins > 0) {
      const total = this.plotCost(plot).coin ?? 0;
      const chunk = Math.min(this.coins, need, Math.max(1, Math.ceil(total / 24)));
      this.coins -= chunk;
      plot.paid.coin = (plot.paid.coin ?? 0) + chunk;
      plot.pulse = 0.15;
      this.fly('coin', p.x, p.y - 30, plot.def.x, plot.def.y);
      sfx('coin');
      this.checkComplete(plot);
      return true;
    }
    return false;
  }

  private checkComplete(plot: Plot): void {
    const cost = this.plotCost(plot);
    if (!COST_KEYS.every((k) => (plot.paid[k] ?? 0) >= (cost[k] ?? 0))) return;
    const id = plot.def.id;
    const { x, y } = plot.def;
    if (isUpgrade(id)) {
      this.levels[id]++;
      plot.paid = {};
      sfx('upgrade');
      vibrate(30);
      this.burst(x, y, '#ffd23f', 14, 160, 260);
      const lvlText = id === 'upHire' ? `+1 👷` : `${T.lvl} ${this.levels[id] + 1}`;
      this.floaters.push({ text: lvlText, x, y: y - 50, t: 0, color: '#fff' });
      if (id === 'upHire') this.spawnWorker();
    } else {
      plot.built = true;
      sfx('build');
      vibrate(80);
      this.shake = 0.35;
      const cols = ['#ff5a4f', '#ffd23f', '#4fd1ff', '#7cff6b', '#ff8ad8'];
      for (let i = 0; i < 40; i++) this.burst(x, y, cols[i % cols.length], 1, 260, 420);
      this.floaters.push({ text: T.built, x, y: y - 70, t: 0, color: '#fff' });
      if (id === 'lighthouse') { this.won = true; this.showWin = true; }
    }
    this.onChange?.();
  }

  private updateSawmill(dt: number): void {
    if (!this.isBuilt('sawmill')) return;
    const working = this.sawIn > 0 && this.sawOut < SAW_OUT_MAX;
    if (working) {
      this.sawSpin += dt * 18;
      this.sawT += dt;
      if (this.sawT >= SAW_TIME) {
        this.sawT = 0;
        this.sawIn--;
        this.sawOut++;
        this.burst(ZONES.sawIn.x + 55, ZONES.sawIn.y - 80, '#e8c48a', 3, 60, 120);
      }
    }
  }

  spawnWorker(): void {
    const h = this.plot('hut').def;
    this.workers.push({ x: h.x, y: h.y + 40, facing: 1, walkT: 0, state: 'seek', target: null, carry: 0, t: 0 });
  }

  private moveTo(w: Worker, tx: number, ty: number, dt: number, stopAt: number): boolean {
    const dx = tx - w.x, dy = ty - w.y, d = Math.hypot(dx, dy);
    if (d <= stopAt) return true;
    const step = Math.min(d - stopAt, WORKER.speed * dt);
    w.x += (dx / d) * step;
    w.y += (dy / d) * step;
    w.walkT += dt * 9;
    if (Math.abs(dx) > 1) w.facing = Math.sign(dx);
    return false;
  }

  private updateWorker(w: Worker, dt: number): void {
    const release = () => { if (w.target) w.target.reserved = false; w.target = null; };
    switch (w.state) {
      case 'seek': {
        if (w.carry >= WORKER.carry) { w.state = 'deliver'; break; }
        let best: ResNode | null = null, bestD = Infinity;
        for (const n of this.nodes) {
          if (n.kind !== 'tree' || n.island !== 'A' || n.hp <= 0 || n.reserved) continue;
          const d = Math.hypot(n.x - w.x, n.y - w.y);
          if (d < bestD) { best = n; bestD = d; }
        }
        if (best) { best.reserved = true; w.target = best; w.state = 'walk'; }
        else if (w.carry > 0) w.state = 'deliver';
        break;
      }
      case 'walk': {
        const t = w.target;
        if (!t || t.hp <= 0) { release(); w.state = 'seek'; break; }
        if (this.moveTo(w, t.x + (w.x < t.x ? -30 : 30), t.y + 8, dt, 4)) { w.state = 'chop'; w.t = 0; }
        break;
      }
      case 'chop': {
        const t = w.target;
        if (!t || t.hp <= 0) { release(); w.state = 'seek'; break; }
        w.t += dt;
        if (w.t >= WORKER.chopTime) {
          w.t = 0;
          this.hitNode(t);
          w.carry++;
          if (w.carry >= WORKER.carry || t.hp <= 0) { release(); w.state = w.carry >= WORKER.carry ? 'deliver' : 'seek'; }
        }
        break;
      }
      case 'deliver':
        if (this.moveTo(w, ZONES.marketSell.x, ZONES.marketSell.y, dt, 6)) { w.state = 'drop'; w.t = 0; }
        break;
      case 'drop':
        w.t += dt;
        if (w.t >= 0.12) {
          w.t = 0;
          w.carry--;
          this.cash += RES_VALUE.wood;
          this.fly('wood', w.x, w.y - 30 - w.carry * 7, ZONES.marketSell.x, ZONES.marketSell.y - 30);
          if (w.carry <= 0) { w.carry = 0; w.state = 'seek'; }
        }
        break;
    }
  }

  // ---------- fx ----------

  stackTopOffset(): number { return 34 + Math.min(this.player.stack.length, 30) * 6; }

  private fly(kind: CostKey, x0: number, y0: number, x1: number, y1: number): void {
    this.flyers.push({ kind, x0, y0, x1, y1, t: 0, dur: 0.28 });
  }

  private coinFloater(n: number): void {
    const p = this.player;
    const f = this.floaters.find((fl) => fl.coin !== undefined && fl.t < 0.4);
    if (f) { f.coin = (f.coin ?? 0) + n; f.text = `+${f.coin}`; f.t = 0; f.x = p.x; f.y = p.y - 70; return; }
    this.floaters.push({ text: `+${n}`, x: p.x, y: p.y - 70, t: 0, color: '#ffd23f', coin: n });
  }

  burst(x: number, y: number, color: string, n: number, speed: number, up: number): void {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = speed * (0.4 + Math.random() * 0.6);
      this.particles.push({
        x, y, z: 10, vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.6, vz: up * (0.5 + Math.random() * 0.5),
        life: 0.8 + Math.random() * 0.6, color, size: 3 + Math.random() * 4,
      });
    }
  }

  private updateFx(dt: number): void {
    this.shake = Math.max(0, this.shake - dt);
    for (const pl of this.plots) pl.pulse = Math.max(0, pl.pulse - dt);
    for (const f of this.flyers) f.t += dt / f.dur;
    this.flyers = this.flyers.filter((f) => f.t < 1);
    for (const f of this.floaters) { f.t += dt; f.y -= 40 * dt; }
    this.floaters = this.floaters.filter((f) => f.t < 1.1);
    for (const q of this.particles) {
      q.life -= dt;
      q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt;
      q.vz -= 900 * dt;
      if (q.z < 0) { q.z = 0; q.vz *= -0.35; q.vx *= 0.6; q.vy *= 0.6; }
    }
    this.particles = this.particles.filter((q) => q.life > 0);
    if (this.toast) { this.toast.t += dt; if (this.toast.t > 3.5) this.toast = null; }
  }

  // ---------- guidance ----------

  /** Next thing the player should do, used for the hint text and guide arrow. */
  objective(): { text: string; x: number; y: number } | null {
    const p = this.player;
    const next = MAIN_ORDER.map((id) => this.plot(id))
      .find((pl) => this.plotVisible(pl) && !(isUpgrade(pl.def.id) && this.levels[pl.def.id] > 0));
    if (!next) {
      if (this.cash > 0) return { text: T.takeCash, ...ZONES.marketCash };
      return null;
    }
    const id = next.def.id;
    const label = id === 'upHire' ? T.hire : fmt(isUpgrade(id) ? T.upgrade : T.build, { b: T.plot[id] });
    const buildHint = { text: label, x: next.def.x, y: next.def.y };
    const needed = (['wood', 'stone', 'plank', 'gold'] as Res[]).filter((r) => this.remaining(next, r) > 0);
    const carried = needed.reduce((n, r) => n + Math.min(this.countInStack(r), this.remaining(next, r)), 0);
    const total = needed.reduce((n, r) => n + this.remaining(next, r), 0);
    const full = p.stack.length >= this.capacity;
    // deliver once the backpack is full or already holds everything still missing
    if (carried > 0 && (full || carried >= total)) return buildHint;
    if (full && this.isBuilt('market')) return { text: T.sell, ...ZONES.marketSell };
    if (this.remaining(next, 'coin') > 0 && !needed.length) {
      if (this.cash > 0 && this.coins < this.remaining(next, 'coin')) return { text: T.takeCash, ...ZONES.marketCash };
      if (this.coins > 0) return buildHint;
      // earn coins: gather whatever is closest, sell once the backpack is full
      return this.nearestNodeHint(null);
    }
    const r = needed.find((res) => this.countInStack(res) < this.remaining(next, res));
    if (!r) return buildHint;
    if (r === 'plank') {
      if (this.sawOut > 0) return { text: T.takePlanks, ...ZONES.sawOut };
      if (this.countInStack('wood') > 0 || this.sawIn > 0) return { text: T.feedSaw, ...ZONES.sawIn };
      return this.nearestNodeHint('tree');
    }
    return this.nearestNodeHint(r === 'wood' ? 'tree' : r === 'stone' ? 'rock' : 'gold');
  }

  /** Nearest harvestable node of a kind (any kind when null). */
  private nearestNodeHint(kind: NodeKind | null): { text: string; x: number; y: number } | null {
    const p = this.player;
    let best: ResNode | null = null, bestD = Infinity;
    for (const n of this.nodes) {
      if ((kind && n.kind !== kind) || n.hp <= 0 || !this.islandUnlocked(n.island)) continue;
      const d = Math.hypot(n.x - p.x, n.y - p.y);
      if (d < bestD) { best = n; bestD = d; }
    }
    return best ? { text: fmt(T.collect, { r: T.res[NODE_INFO[best.kind].res] }), x: best.x, y: best.y } : null;
  }

  // ---------- persistence ----------

  serialize(): SaveData {
    const plots: SaveData['plots'] = {};
    for (const pl of this.plots) plots[pl.def.id] = { paid: { ...pl.paid }, built: pl.built };
    return {
      v: 1, coins: this.coins, cash: this.cash, levels: { ...this.levels }, plots,
      stack: this.player.stack.map((s) => s.res), px: this.player.x, py: this.player.y,
      sawIn: this.sawIn, sawOut: this.sawOut, won: this.won, savedAt: Date.now(),
    };
  }

  load(d: SaveData): void {
    this.coins = d.coins;
    this.cash = d.cash;
    Object.assign(this.levels, d.levels);
    for (const pl of this.plots) {
      const s = d.plots[pl.def.id];
      if (s) { pl.paid = { ...s.paid }; pl.built = s.built; }
    }
    this.player.stack = d.stack.slice(0, this.capacity).map((res) => ({ res, anim: 1, fx: 0, fy: 0 }));
    if (this.walkable(d.px, d.py)) { this.player.x = d.px; this.player.y = d.py; }
    this.sawIn = d.sawIn;
    this.sawOut = d.sawOut;
    this.won = d.won;
    for (let i = 0; i < this.levels.upHire; i++) this.spawnWorker();

    // idle earnings: workers keep chopping (about half their online rate) while the app is closed, capped at 2h
    const away = Math.min(2 * 3600, (Date.now() - d.savedAt) / 1000);
    if (away > 60 && this.levels.upHire > 0) {
      const earned = Math.floor(away * this.levels.upHire * 0.1);
      this.cash += earned;
      this.toast = { text: T.welcome, sub: `+${earned} 🪙`, t: 0 };
    }
  }
}

