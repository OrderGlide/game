import {
  BRIDGES, COST_KEYS, ISLANDS, SAW_IN_MAX, UPGRADES, ZONES, inRect, mulberry32,
  type CostKey, type Rect, type Res, type UpgradeId,
} from './data';
import type { Game, Plot, ResNode, Worker } from './game';
import { JOY_RADIUS, type Input } from './input';
import { T } from './i18n';
import { isMuted } from './audio';

const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

const ITEM_COL: Record<Res, [string, string]> = {
  wood: ['#c98b4f', '#8f5a2b'],
  stone: ['#c3cad3', '#7d8591'],
  plank: ['#f3d59c', '#c99d58'],
  gold: ['#ffe066', '#d49b00'],
};

const UPGRADE_ICON: Record<UpgradeId, string> = { upCap: '🎒', upSpeed: '👟', upHarvest: '🪓', upHire: '👷' };

interface Deco { x: number; y: number; kind: 0 | 1 | 2; c: string; }

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private dpr = 1;
  W = 0;
  H = 0;
  zoom = 1;
  cam = { x: 0, y: 0 };
  safe = { t: 0, r: 0, b: 0, l: 0 };
  muteBtn = { x: 0, y: 0, r: 22 };
  private deco: Deco[] = [];
  private time = 0;

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
    const rnd = mulberry32(7);
    for (const isl of ISLANDS) {
      for (let i = 0; i < 90; i++) {
        const x = isl.x + (rnd() - 0.5) * (isl.w - 40), y = isl.y + (rnd() - 0.5) * (isl.h - 40);
        const kind = (rnd() < 0.75 ? 0 : rnd() < 0.6 ? 1 : 2) as Deco['kind'];
        const c = kind === 1 ? ['#fff4a8', '#ffb3d9', '#ffffff'][Math.floor(rnd() * 3)] : '#4f9e3a';
        this.deco.push({ x, y, kind, c });
      }
    }
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize(): void {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    this.W = window.innerWidth;
    this.H = window.innerHeight;
    this.canvas.width = Math.round(this.W * this.dpr);
    this.canvas.height = Math.round(this.H * this.dpr);
    this.zoom = Math.max(0.75, Math.min(2.2, Math.min(this.W, this.H) / 440));
    const st = getComputedStyle(document.getElementById('safe')!);
    this.safe = {
      t: parseFloat(st.paddingTop) || 0, r: parseFloat(st.paddingRight) || 0,
      b: parseFloat(st.paddingBottom) || 0, l: parseFloat(st.paddingLeft) || 0,
    };
    this.muteBtn = { x: this.W - this.safe.r - 34, y: this.safe.t + 34, r: 22 };
  }

  snapCamera(x: number, y: number): void { this.cam.x = x; this.cam.y = y; }

  draw(g: Game, input: Input, dt: number): void {
    this.time += dt;
    const ctx = this.ctx, p = g.player;
    const k = Math.min(1, dt * 6);
    this.cam.x += (p.x - this.cam.x) * k;
    this.cam.y += (p.y - 40 - this.cam.y) * k;
    const sx = g.shake > 0 ? (Math.random() - 0.5) * 12 * g.shake : 0;
    const sy = g.shake > 0 ? (Math.random() - 0.5) * 12 * g.shake : 0;

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = '#2b8fd6';
    ctx.fillRect(0, 0, this.W, this.H);

    const z = this.zoom;
    ctx.setTransform(this.dpr * z, 0, 0, this.dpr * z,
      this.dpr * (this.W / 2 - (this.cam.x + sx) * z), this.dpr * (this.H / 2 - (this.cam.y + sy) * z));
    const view: Rect = { x: this.cam.x, y: this.cam.y, w: this.W / z + 300, h: this.H / z + 400 };

    this.drawWater(view);
    for (const isl of ISLANDS) this.drawIsland(g, isl);
    this.drawBridges(g);

    // flat ground markings
    for (const pl of g.plots) if (g.plotVisible(pl)) this.drawPlot(g, pl);
    if (g.isBuilt('market')) this.drawMarketZones(g);
    if (g.isBuilt('sawmill')) this.drawSawZones(g);

    // depth-sorted objects
    const objs: { y: number; fn: () => void }[] = [];
    for (const n of g.nodes) if (inRect(n.x, n.y, view)) objs.push({ y: n.y, fn: () => this.drawNode(n) });
    for (const pl of g.plots) if (pl.built) objs.push({ y: pl.def.y + 30, fn: () => this.drawBuilding(g, pl) });
    for (const w of g.workers) objs.push({ y: w.y, fn: () => this.drawWorker(w) });
    objs.push({ y: p.y, fn: () => this.drawPlayer(g) });
    if (g.isBuilt('market')) objs.push({ y: ZONES.marketCash.y - 10, fn: () => this.drawCashPile(g.cash) });
    if (g.isBuilt('sawmill')) objs.push({ y: ZONES.sawOut.y - 10, fn: () => this.drawSawPiles(g) });
    objs.sort((a, b) => a.y - b.y);
    for (const o of objs) o.fn();

    for (const f of g.flyers) {
      const t = f.t, e = t * t * (3 - 2 * t);
      const x = f.x0 + (f.x1 - f.x0) * e, y = f.y0 + (f.y1 - f.y0) * e - Math.sin(t * Math.PI) * 50;
      if (f.kind === 'coin') this.coin(x, y, 7); else this.item(f.kind, x, y);
    }
    for (const q of g.particles) {
      ctx.globalAlpha = Math.min(1, q.life * 2);
      ctx.fillStyle = q.color;
      ctx.fillRect(q.x - q.size / 2, q.y - q.z - q.size / 2, q.size, q.size);
    }
    ctx.globalAlpha = 1;

    const obj = g.objective();
    if (obj && !g.showWin) this.drawGuide(g, obj);

    for (const f of g.floaters) {
      ctx.globalAlpha = Math.max(0, 1 - Math.max(0, f.t - 0.6) / 0.5);
      this.text(f.text, f.x, f.y, 22, f.color);
    }
    ctx.globalAlpha = 1;

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.drawHud(g, input, obj?.text ?? T.explore);
  }

  // ---------- primitives ----------

  private rr(x: number, y: number, w: number, h: number, r: number): void {
    const c = this.ctx;
    r = Math.min(r, w / 2, h / 2);
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  private shadow(x: number, y: number, rx: number, ry: number): void {
    const c = this.ctx;
    c.fillStyle = 'rgba(0,0,0,0.18)';
    c.beginPath();
    c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    c.fill();
  }

  private text(s: string, x: number, y: number, size: number, color = '#fff', align: CanvasTextAlign = 'center'): void {
    const c = this.ctx;
    c.font = `800 ${size}px ${FONT}`;
    c.textAlign = align;
    c.textBaseline = 'middle';
    c.lineJoin = 'round';
    c.lineWidth = size / 4;
    c.strokeStyle = 'rgba(20,30,45,0.7)';
    c.strokeText(s, x, y);
    c.fillStyle = color;
    c.fillText(s, x, y);
  }

  /** A small 3D-ish block representing one resource, centered at x,y. */
  private item(res: Res, x: number, y: number, s = 1): void {
    const c = this.ctx;
    const [top, front] = ITEM_COL[res];
    const w = 22 * s, h = 7 * s, d = 5 * s;
    c.fillStyle = front;
    this.rr(x - w / 2, y - h / 2, w, h, 2 * s);
    c.fill();
    c.fillStyle = top;
    this.rr(x - w / 2, y - h / 2 - d, w, d + 1, 2 * s);
    c.fill();
    if (res === 'wood') {
      c.fillStyle = '#e8b981';
      c.beginPath();
      c.ellipse(x + w / 2 - 3 * s, y - 1 * s, 2.5 * s, 4 * s, 0, 0, Math.PI * 2);
      c.fill();
    } else if (res === 'gold') {
      c.fillStyle = 'rgba(255,255,255,0.7)';
      c.fillRect(x - w / 2 + 3 * s, y - h / 2 - d + 1 * s, 6 * s, 1.5 * s);
    }
  }

  private coin(x: number, y: number, r: number): void {
    const c = this.ctx;
    c.fillStyle = '#d49b00';
    c.beginPath(); c.arc(x, y + r * 0.18, r, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#ffd23f';
    c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#f0a800';
    c.lineWidth = r * 0.18;
    c.beginPath(); c.arc(x, y, r * 0.62, 0, Math.PI * 2); c.stroke();
  }

  private costIcon(k: CostKey, x: number, y: number): void {
    if (k === 'coin') this.coin(x, y, 8); else this.item(k, x, y + 2, 0.8);
  }

  // ---------- world ----------

  private drawWater(view: Rect): void {
    const c = this.ctx, s = 90;
    c.strokeStyle = 'rgba(255,255,255,0.22)';
    c.lineWidth = 3;
    c.lineCap = 'round';
    const x0 = Math.floor((view.x - view.w / 2) / s) * s, y0 = Math.floor((view.y - view.h / 2) / s) * s;
    for (let x = x0; x < view.x + view.w / 2; x += s) {
      for (let y = y0; y < view.y + view.h / 2; y += s) {
        const ox = ((x * 7 + y * 13) % 50) + Math.sin(this.time * 1.2 + x * 0.01 + y * 0.02) * 10;
        const px = x + ox, py = y + ((x * 3) % 40);
        if (ISLANDS.some((i) => inRect(px, py, i, 30))) continue;
        c.beginPath();
        c.arc(px, py, 10, Math.PI * 0.15, Math.PI * 0.85);
        c.stroke();
      }
    }
  }

  private drawIsland(g: Game, isl: Rect & { id: 'A' | 'B' | 'C' }): void {
    const c = this.ctx;
    const { x, y, w, h } = isl;
    const foam = 22 + Math.sin(this.time * 1.5) * 4;
    c.fillStyle = 'rgba(255,255,255,0.35)';
    this.rr(x - w / 2 - foam, y - h / 2 - foam, w + foam * 2, h + foam * 2, 70);
    c.fill();
    c.fillStyle = '#f2d98d';
    this.rr(x - w / 2 - 14, y - h / 2 - 14, w + 28, h + 28, 60);
    c.fill();
    c.fillStyle = '#6cc24a';
    this.rr(x - w / 2, y - h / 2, w, h, 50);
    c.fill();
    c.fillStyle = '#5fb63f';
    this.rr(x - w / 2 + 30, y - h / 2 + 30, w - 60, h - 60, 40);
    c.fill();
    for (const d of this.deco) {
      if (!inRect(d.x, d.y, isl)) continue;
      if (d.kind === 0) {
        c.strokeStyle = d.c;
        c.lineWidth = 2;
        c.beginPath();
        c.moveTo(d.x - 4, d.y); c.lineTo(d.x - 2, d.y - 7);
        c.moveTo(d.x, d.y); c.lineTo(d.x, d.y - 9);
        c.moveTo(d.x + 4, d.y); c.lineTo(d.x + 2, d.y - 7);
        c.stroke();
      } else {
        c.fillStyle = d.c;
        c.beginPath(); c.arc(d.x, d.y, d.kind === 1 ? 3.5 : 2.5, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#ffcf33';
        c.beginPath(); c.arc(d.x, d.y, 1.3, 0, Math.PI * 2); c.fill();
      }
    }
    if (!g.islandUnlocked(isl.id)) {
      c.fillStyle = 'rgba(25,55,95,0.42)';
      this.rr(x - w / 2 - 14, y - h / 2 - 14, w + 28, h + 28, 60);
      c.fill();
      c.globalAlpha = 0.85;
      c.font = `64px ${FONT}`;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText('🔒', x, y);
      c.globalAlpha = 1;
    }
  }

  private drawBridges(g: Game): void {
    const c = this.ctx;
    for (const b of BRIDGES) {
      const built = g.isBuilt(b.id);
      const plot = g.plot(b.id);
      if (!built && !g.plotVisible(plot)) continue;
      const horiz = b.w > b.h;
      c.globalAlpha = built ? 1 : 0.35;
      c.fillStyle = 'rgba(0,0,0,0.15)';
      c.fillRect(b.x - b.w / 2, b.y - b.h / 2 + 8, b.w, b.h);
      const n = 9;
      for (let i = 0; i < n; i++) {
        c.fillStyle = i % 2 ? '#b27842' : '#c4884f';
        if (horiz) c.fillRect(b.x - b.w / 2 + (i * b.w) / n, b.y - b.h / 2, b.w / n - 1.5, b.h);
        else c.fillRect(b.x - b.w / 2, b.y - b.h / 2 + (i * b.h) / n, b.w, b.h / n - 1.5);
      }
      c.fillStyle = '#7a4a22';
      if (horiz) {
        c.fillRect(b.x - b.w / 2, b.y - b.h / 2 - 3, b.w, 5);
        c.fillRect(b.x - b.w / 2, b.y + b.h / 2 - 2, b.w, 5);
      } else {
        c.fillRect(b.x - b.w / 2 - 3, b.y - b.h / 2, 5, b.h);
        c.fillRect(b.x + b.w / 2 - 2, b.y - b.h / 2, 5, b.h);
      }
      c.globalAlpha = 1;
    }
  }

  private drawPlot(g: Game, pl: Plot): void {
    const c = this.ctx, d = pl.def;
    const s = 1 + pl.pulse * 0.4;
    const w = d.w * s, h = d.h * s, x = d.x - w / 2, y = d.y - h / 2;
    const upgrade = d.id.startsWith('up');
    c.fillStyle = upgrade ? 'rgba(40,70,140,0.28)' : 'rgba(255,255,255,0.2)';
    this.rr(x, y, w, h, 14);
    c.fill();
    const prog = g.progress(pl);
    if (prog > 0) {
      c.save();
      this.rr(x, y, w, h, 14);
      c.clip();
      c.fillStyle = 'rgba(255,210,63,0.45)';
      c.fillRect(x, y + h * (1 - prog), w, h * prog);
      c.restore();
    }
    c.setLineDash([10, 7]);
    c.lineDashOffset = -this.time * 20;
    c.strokeStyle = '#fff';
    c.lineWidth = 3;
    this.rr(x, y, w, h, 14);
    c.stroke();
    c.setLineDash([]);

    const cost = g.plotCost(pl);
    if (upgrade) {
      const id = d.id as UpgradeId;
      c.font = `26px ${FONT}`;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText(UPGRADE_ICON[id], d.x, d.y - 12);
      const lbl = id === 'upHire' ? `${T.plot[id]} ${g.levels[id]}/${UPGRADES[id].max}` : `${T.plot[id]} ${T.lvl}${g.levels[id] + 1}`;
      this.text(lbl, d.x, y - 12, 13);
      this.coin(d.x - 18, d.y + 18, 8);
      this.text(String(g.remaining(pl, 'coin')), d.x - 6, d.y + 18, 15, '#fff', 'left');
      return;
    }
    this.text(T.plot[d.id], d.x, y + 16, 16);
    const keys = COST_KEYS.filter((k) => (cost[k] ?? 0) > 0);
    const rowH = 22, top = d.y + 6 - ((keys.length - 1) * rowH) / 2;
    keys.forEach((k, i) => {
      const yy = top + i * rowH;
      this.costIcon(k, d.x - 18, yy);
      const rem = g.remaining(pl, k);
      this.text(rem > 0 ? String(rem) : '✓', d.x - 2, yy, 16, rem > 0 ? '#fff' : '#7cff6b', 'left');
    });
  }

  private zone(r: Rect, color: string): void {
    const c = this.ctx;
    c.fillStyle = color;
    this.rr(r.x - r.w / 2, r.y - r.h / 2, r.w, r.h, 12);
    c.fill();
    c.strokeStyle = 'rgba(255,255,255,0.9)';
    c.lineWidth = 3;
    c.stroke();
  }

  private drawMarketZones(g: Game): void {
    const s = ZONES.marketSell;
    this.zone(s, 'rgba(255,255,255,0.25)');
    this.coin(s.x, s.y - 4, 10);
    const c = this.ctx;
    c.fillStyle = '#fff';
    c.beginPath();
    const ay = s.y + 14 + Math.sin(this.time * 5) * 2;
    c.moveTo(s.x - 8, ay); c.lineTo(s.x + 8, ay); c.lineTo(s.x, ay + 8);
    c.fill();
    this.zone(ZONES.marketCash, g.cash > 0 ? 'rgba(124,255,107,0.35)' : 'rgba(255,255,255,0.15)');
  }

  private drawCashPile(cash: number): void {
    const z = ZONES.marketCash;
    const coins = Math.min(60, Math.ceil(cash / 4));
    const cols = [[-16, -10], [0, -10], [16, -10], [-16, 8], [0, 8], [16, 8]];
    for (let i = 0; i < coins; i++) {
      const [ox, oy] = cols[i % 6];
      const lvl = Math.floor(i / 6);
      this.coin(z.x + ox, z.y + oy - lvl * 4, 7);
    }
    if (cash > 0) this.text(String(cash), z.x, z.y - 22 - Math.floor(coins / 6) * 4, 14, '#ffd23f');
  }

  private drawSawZones(g: Game): void {
    const zi = ZONES.sawIn, zo = ZONES.sawOut;
    this.zone(zi, 'rgba(255,255,255,0.22)');
    this.zone(zo, 'rgba(255,255,255,0.22)');
    this.item('wood', zi.x, zi.y + 16, 0.8);
    this.text(`${g.sawIn}/${SAW_IN_MAX}`, zi.x, zi.y - 12, 13);
  }

  private drawSawPiles(g: Game): void {
    const zo = ZONES.sawOut;
    for (let i = 0; i < Math.min(g.sawOut, 40); i++) {
      const col = i % 2, lvl = Math.floor(i / 2);
      this.item('plank', zo.x - 12 + col * 24, zo.y + 16 - lvl * 5.5, 0.9);
    }
  }

  private drawNode(n: ResNode): void {
    const c = this.ctx;
    const sh = n.shake > 0 ? Math.sin(this.time * 70) * n.shake * 14 : 0;
    const x = n.x + sh, y = n.y;
    const g = n.hp > 0 ? 0.3 + 0.7 * easeOutBack(n.grow) : 0;
    if (n.kind === 'tree') {
      this.shadow(n.x, y + 2, 24, 9);
      c.fillStyle = '#7a4a22';
      if (n.hp <= 0) {
        c.fillStyle = '#8f5a2b';
        c.beginPath(); c.ellipse(n.x, y - 2, 10, 5, 0, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#d9a66b';
        c.beginPath(); c.ellipse(n.x, y - 4, 8, 3.5, 0, 0, Math.PI * 2); c.fill();
        return;
      }
      c.fillRect(x - 5, y - 22 * g, 10, 22 * g);
      const r = 22 * g;
      c.fillStyle = '#2f7d32';
      c.beginPath(); c.arc(x, y - 34 * g, r, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#3f9a3c';
      c.beginPath(); c.arc(x - 6 * g, y - 42 * g, r * 0.72, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#57b84a';
      c.beginPath(); c.arc(x - 9 * g, y - 48 * g, r * 0.35, 0, Math.PI * 2); c.fill();
      return;
    }
    // rock / gold ore
    this.shadow(n.x, y + 2, 24, 8);
    if (n.hp <= 0) {
      c.fillStyle = '#8c939e';
      for (const [ox, oy] of [[-8, 0], [6, -2], [0, 4]]) { c.beginPath(); c.arc(n.x + ox, y + oy - 2, 4, 0, Math.PI * 2); c.fill(); }
      return;
    }
    const s = g;
    c.fillStyle = n.kind === 'gold' ? '#6f6a64' : '#848c98';
    c.beginPath();
    c.moveTo(x - 24 * s, y);
    c.lineTo(x - 18 * s, y - 22 * s);
    c.lineTo(x - 2 * s, y - 32 * s);
    c.lineTo(x + 16 * s, y - 24 * s);
    c.lineTo(x + 24 * s, y);
    c.closePath();
    c.fill();
    c.fillStyle = n.kind === 'gold' ? '#8e8880' : '#a8b0bb';
    c.beginPath();
    c.moveTo(x - 18 * s, y - 22 * s);
    c.lineTo(x - 2 * s, y - 32 * s);
    c.lineTo(x + 6 * s, y - 16 * s);
    c.lineTo(x - 10 * s, y - 8 * s);
    c.closePath();
    c.fill();
    if (n.kind === 'gold') {
      c.fillStyle = '#ffd23f';
      for (const [ox, oy, r] of [[-8, -14, 5], [9, -10, 4], [2, -24, 3.5], [14, -20, 3]]) {
        c.beginPath();
        c.moveTo(x + ox * s, y + (oy - r) * s);
        c.lineTo(x + (ox + r) * s, y + oy * s);
        c.lineTo(x + ox * s, y + (oy + r) * s);
        c.lineTo(x + (ox - r) * s, y + oy * s);
        c.closePath();
        c.fill();
      }
    }
  }

  private drawBuilding(g: Game, pl: Plot): void {
    const c = this.ctx;
    const { x, y } = pl.def;
    switch (pl.def.id) {
      case 'market': {
        this.shadow(x, y + 30, 70, 16);
        for (const px of [-52, 52]) { c.fillStyle = '#7a4a22'; c.fillRect(x + px - 3, y - 62, 6, 70); }
        c.fillStyle = '#8f5a2b';
        c.fillRect(x - 60, y - 6, 120, 36);
        c.fillStyle = '#c98b4f';
        c.fillRect(x - 64, y - 14, 128, 12);
        for (let i = 0; i < 6; i++) {
          c.fillStyle = i % 2 ? '#fff' : '#ff5a4f';
          c.beginPath();
          const x0 = x - 66 + i * 22;
          c.moveTo(x0 + 4, y - 84); c.lineTo(x0 + 26, y - 84); c.lineTo(x0 + 22, y - 58); c.lineTo(x0, y - 58);
          c.fill();
          c.beginPath(); c.arc(x0 + 11, y - 58, 11, 0, Math.PI); c.fill();
        }
        this.item('wood', x - 30, y - 20, 0.8);
        this.item('stone', x - 4, y - 20, 0.8);
        this.coin(x + 30, y - 22, 8);
        this.coin(x, y + 12, 10);
        break;
      }
      case 'sawmill': {
        this.shadow(x, y + 32, 80, 16);
        c.fillStyle = '#a6552e';
        c.fillRect(x - 62, y - 40, 124, 70);
        c.fillStyle = '#8a4526';
        for (let i = 0; i < 6; i++) c.fillRect(x - 62 + i * 21, y - 40, 2, 70);
        c.fillStyle = '#5b3a29';
        c.beginPath(); c.moveTo(x - 72, y - 38); c.lineTo(x, y - 86); c.lineTo(x + 72, y - 38); c.closePath(); c.fill();
        c.fillStyle = '#3e2a1e';
        c.fillRect(x - 20, y - 6, 40, 36);
        // spinning blade
        c.save();
        c.translate(x, y - 58);
        c.rotate(g.sawSpin);
        c.fillStyle = '#d7dde5';
        c.beginPath();
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * Math.PI * 2;
          c.lineTo(Math.cos(a) * 17, Math.sin(a) * 17);
          c.lineTo(Math.cos(a + 0.26) * 12, Math.sin(a + 0.26) * 12);
        }
        c.closePath();
        c.fill();
        c.fillStyle = '#6d7580';
        c.beginPath(); c.arc(0, 0, 4, 0, Math.PI * 2); c.fill();
        c.restore();
        for (let i = 0; i < Math.min(g.sawIn, 12); i++) this.item('wood', x - 90 + (i % 2) * 8, y + 20 - Math.floor(i / 2) * 6, 0.8);
        break;
      }
      case 'hut': {
        this.shadow(x, y + 30, 64, 14);
        c.fillStyle = '#c9955c';
        c.fillRect(x - 50, y - 26, 100, 56);
        c.fillStyle = '#b17f48';
        for (let i = 0; i < 5; i++) c.fillRect(x - 50, y - 22 + i * 11, 100, 2);
        c.fillStyle = '#3f8f4e';
        c.beginPath(); c.moveTo(x - 62, y - 22); c.lineTo(x, y - 70); c.lineTo(x + 62, y - 22); c.closePath(); c.fill();
        c.fillStyle = '#5b3a29';
        c.fillRect(x - 12, y, 24, 30);
        c.fillStyle = '#9fd8ff';
        c.fillRect(x + 22, y - 12, 16, 14);
        c.fillRect(x - 38, y - 12, 16, 14);
        break;
      }
      case 'lighthouse': {
        this.shadow(x, y + 40, 70, 18);
        c.fillStyle = '#848c98';
        c.beginPath(); c.ellipse(x, y + 30, 62, 20, 0, 0, Math.PI * 2); c.fill();
        const top = y - 170, bot = y + 30;
        for (let i = 0; i < 6; i++) {
          const y0 = bot - ((bot - top) * i) / 6, y1 = bot - ((bot - top) * (i + 1)) / 6;
          const w0 = 34 - i * 3.2, w1 = 34 - (i + 1) * 3.2;
          c.fillStyle = i % 2 ? '#ff5a4f' : '#fbfbfb';
          c.beginPath(); c.moveTo(x - w0, y0); c.lineTo(x - w1, y1); c.lineTo(x + w1, y1); c.lineTo(x + w0, y0); c.closePath(); c.fill();
        }
        c.fillStyle = '#39424e';
        c.fillRect(x - 24, top - 6, 48, 8);
        c.fillStyle = '#ffe98a';
        c.fillRect(x - 16, top - 34, 32, 28);
        c.fillStyle = '#ff5a4f';
        c.beginPath(); c.moveTo(x - 22, top - 34); c.lineTo(x, top - 56); c.lineTo(x + 22, top - 34); c.closePath(); c.fill();
        // rotating beam
        const a = this.time * 1.4;
        const grad = c.createRadialGradient(x, top - 20, 4, x, top - 20, 260);
        grad.addColorStop(0, 'rgba(255,240,150,0.55)');
        grad.addColorStop(1, 'rgba(255,240,150,0)');
        c.fillStyle = grad;
        for (const off of [0, Math.PI]) {
          const dir = Math.cos(a + off);
          c.beginPath();
          c.moveTo(x, top - 20);
          c.lineTo(x + dir * 260, top - 20 - 40);
          c.lineTo(x + dir * 260, top - 20 + 40);
          c.closePath();
          c.fill();
        }
        break;
      }
      default:
        break; // bridges and upgrades are drawn elsewhere
    }
  }

  private drawCharacter(x: number, y: number, walkT: number, moving: boolean, facing: number, shirt: string, hat: string): void {
    const c = this.ctx;
    this.shadow(x, y + 2, 16, 6);
    const bob = moving ? Math.abs(Math.sin(walkT)) * 3 : 0;
    const leg = moving ? Math.sin(walkT) * 5 : 0;
    c.fillStyle = '#394a6b';
    c.fillRect(x - 7 + leg * 0.3, y - 12, 5, 12 + (leg > 0 ? -2 : 0));
    c.fillRect(x + 2 - leg * 0.3, y - 12, 5, 12 + (leg < 0 ? -2 : 0));
    c.fillStyle = shirt;
    this.rr(x - 11, y - 34 - bob, 22, 24, 7);
    c.fill();
    c.fillStyle = '#ffd1a1';
    c.beginPath(); c.arc(x + facing * 2, y - 44 - bob, 10, 0, Math.PI * 2); c.fill();
    c.fillStyle = hat;
    c.beginPath(); c.arc(x + facing * 2, y - 47 - bob, 10, Math.PI, 0); c.fill();
    c.fillRect(x + facing * 2 - (facing > 0 ? 0 : 14), y - 48 - bob, 14, 3);
    c.fillStyle = '#222';
    c.fillRect(x + facing * 6 - 1, y - 44 - bob, 2.5, 3);
  }

  private drawPlayer(g: Game): void {
    const p = g.player, c = this.ctx;
    const bob = p.moving ? Math.abs(Math.sin(p.walkT)) * 3 : 0;
    const n = p.stack.length;
    const spacing = n > 30 ? 180 / n : 6;
    const baseX = p.x - p.facing * 8, baseY = p.y - 30 - bob;
    const drawStack = () => {
      p.stack.forEach((s, i) => {
        const wob = p.moving ? Math.sin(this.time * 8 - i * 0.25) * i * 0.18 : 0;
        const tx = baseX + wob, ty = baseY - i * spacing;
        if (s.anim < 1) {
          const e = s.anim;
          this.item(s.res, s.fx + (tx - s.fx) * e, s.fy + (ty - s.fy) * e - Math.sin(e * Math.PI) * 40);
        } else this.item(s.res, tx, ty);
      });
    };
    // stack sits on the back: behind the body when facing right-ish
    drawStack();
    this.drawCharacter(p.x, p.y, p.walkT, p.moving, p.facing, '#4a7cff', '#ff5a4f');
    if (p.target) {
      const sw = Math.sin(p.swing * 18) * 0.9;
      c.save();
      c.translate(p.x + p.facing * 12, p.y - 26 - bob);
      c.rotate(p.facing * (0.6 + sw));
      c.fillStyle = '#7a4a22';
      c.fillRect(-1.5, -18, 3, 20);
      c.fillStyle = p.target.kind === 'tree' ? '#cfd6de' : '#9aa3ad';
      c.fillRect(p.facing > 0 ? 0 : -9, -20, 9, 7);
      c.restore();
    }
    if (n > 0) {
      const full = n >= g.capacity;
      const label = full ? T.full : `${n}/${g.capacity}`;
      const pulse = full ? 1 + Math.sin(this.time * 10) * 0.08 : 1;
      this.text(label, baseX, baseY - (n - 1) * spacing - 22, 15 * pulse, full ? '#ff5a4f' : '#fff');
    }
  }

  private drawWorker(w: Worker): void {
    const moving = w.state === 'walk' || w.state === 'deliver';
    for (let i = 0; i < w.carry; i++) this.item('wood', w.x - w.facing * 8, w.y - 30 - i * 6, 0.85);
    this.drawCharacter(w.x, w.y, w.walkT, moving, w.facing, '#ffb62e', '#ffe14d');
    if (w.state === 'chop') {
      const c = this.ctx;
      c.save();
      c.translate(w.x + w.facing * 12, w.y - 26);
      c.rotate(w.facing * (0.6 + Math.sin(w.t * 12) * 0.9));
      c.fillStyle = '#7a4a22'; c.fillRect(-1.5, -18, 3, 20);
      c.fillStyle = '#cfd6de'; c.fillRect(w.facing > 0 ? 0 : -9, -20, 9, 7);
      c.restore();
    }
  }

  private drawGuide(g: Game, obj: { x: number; y: number }): void {
    const c = this.ctx, p = g.player;
    const b = Math.abs(Math.sin(this.time * 4)) * 10;
    const ax = obj.x, ay = obj.y - 64 - b;
    const arrow = (x: number, y: number, ang: number, s: number) => {
      c.save();
      c.translate(x, y);
      c.rotate(ang);
      c.beginPath();
      c.moveTo(0, 14 * s); c.lineTo(-13 * s, -2 * s); c.lineTo(-5 * s, -2 * s); c.lineTo(-5 * s, -16 * s);
      c.lineTo(5 * s, -16 * s); c.lineTo(5 * s, -2 * s); c.lineTo(13 * s, -2 * s); c.closePath();
      c.fillStyle = '#ffd23f';
      c.strokeStyle = 'rgba(20,30,45,0.75)';
      c.lineWidth = 3;
      c.lineJoin = 'round';
      c.stroke();
      c.fill();
      c.restore();
    };
    arrow(ax, ay, 0, 1.2);
    const dx = obj.x - p.x, dy = obj.y - p.y, d = Math.hypot(dx, dy);
    if (d > 150) {
      const a = Math.atan2(dy, dx);
      arrow(p.x + Math.cos(a) * 58, p.y - 18 + Math.sin(a) * 40, a - Math.PI / 2, 0.8);
    }
  }

  // ---------- HUD (screen space) ----------

  private drawHud(g: Game, input: Input, hint: string): void {
    const c = this.ctx;
    const top = this.safe.t + 12, left = this.safe.l + 12;

    // coins
    c.font = `800 22px ${FONT}`;
    const coinsText = formatNum(g.coins);
    const cw = Math.max(110, c.measureText(coinsText).width + 62);
    c.fillStyle = 'rgba(15,30,55,0.55)';
    this.rr(left, top, cw, 44, 22);
    c.fill();
    this.coin(left + 24, top + 22, 12);
    this.text(coinsText, left + 44, top + 23, 22, '#fff', 'left');

    // mute
    const m = this.muteBtn;
    c.fillStyle = 'rgba(15,30,55,0.55)';
    c.beginPath(); c.arc(m.x, m.y, m.r, 0, Math.PI * 2); c.fill();
    c.font = `20px ${FONT}`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillStyle = '#fff';
    c.fillText(isMuted() ? '🔇' : '🔊', m.x, m.y + 1);

    // objective
    c.font = `800 16px ${FONT}`;
    const hw = Math.min(this.W - 24, c.measureText(hint).width + 36);
    const hy = top + 56;
    c.fillStyle = 'rgba(15,30,55,0.55)';
    this.rr(this.W / 2 - hw / 2, hy, hw, 34, 17);
    c.fill();
    this.text(hint, this.W / 2, hy + 17, 16, '#ffe98a');

    // joystick
    if (input.joy.active) {
      const j = input.joy;
      const dx = j.kx - j.ox, dy = j.ky - j.oy, d = Math.hypot(dx, dy), k = d > JOY_RADIUS ? JOY_RADIUS / d : 1;
      c.fillStyle = 'rgba(255,255,255,0.18)';
      c.strokeStyle = 'rgba(255,255,255,0.5)';
      c.lineWidth = 3;
      c.beginPath(); c.arc(j.ox, j.oy, JOY_RADIUS, 0, Math.PI * 2); c.fill(); c.stroke();
      c.fillStyle = 'rgba(255,255,255,0.75)';
      c.beginPath(); c.arc(j.ox + dx * k, j.oy + dy * k, 24, 0, Math.PI * 2); c.fill();
    }

    if (g.toast) {
      const a = Math.min(1, g.toast.t * 4, (3.5 - g.toast.t) * 2);
      c.globalAlpha = Math.max(0, a);
      this.text(g.toast.text, this.W / 2, this.H * 0.3, 28, '#fff');
      if (g.toast.sub) this.text(g.toast.sub, this.W / 2, this.H * 0.3 + 38, 32, '#ffd23f');
      c.globalAlpha = 1;
    }

    if (g.showWin) {
      c.fillStyle = 'rgba(10,20,40,0.6)';
      c.fillRect(0, 0, this.W, this.H);
      const s = 1 + Math.sin(this.time * 3) * 0.04;
      this.text('🏝️', this.W / 2, this.H * 0.36, 64);
      this.text(T.win, this.W / 2, this.H * 0.46, 34 * s, '#ffd23f');
      this.text(T.winSub, this.W / 2, this.H * 0.53, 16, '#fff');
    }
  }
}

function easeOutBack(t: number): number {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
}

function formatNum(n: number): string {
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e4) return (n / 1e3).toFixed(1) + 'K';
  return String(Math.floor(n));
}
