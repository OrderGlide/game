// DOM overlay: money, hint, wave + palisade bar, joystick, toasts and floating texts.
import * as THREE from 'three';
import { JOY_RADIUS, type Input } from '../input';
import type { Game } from '../game';
import { T, fmt } from '../i18n';
import { isMuted, setMuted } from '../audio';

const CSS = `
#hud { position: fixed; inset: 0; pointer-events: none; font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  font-weight: 800; color: #fff; -webkit-font-smoothing: antialiased; }
#hud .top { position: absolute; left: 0; right: 0; top: calc(env(safe-area-inset-top) + 10px); padding: 0 12px;
  display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; }
#hud .pill { background: rgba(20,32,52,.62); border-radius: 999px; padding: 6px 14px 6px 8px; display: flex; align-items: center; gap: 8px;
  font-size: 22px; box-shadow: 0 3px 0 rgba(0,0,0,.18); text-shadow: 0 2px 0 rgba(0,0,0,.35); }
#hud .bill { width: 34px; height: 20px; border-radius: 4px; background: linear-gradient(#58d86a, #2fae42); position: relative;
  box-shadow: inset 0 0 0 2px #1f8a31; }
#hud .bill::after { content: '$'; position: absolute; inset: 0; display: grid; place-items: center; font-size: 14px; color: #eaffea; text-shadow: none; }
#hud .money.bump { animation: bump .18s ease-out; }
@keyframes bump { 50% { transform: scale(1.12); } }
#hud .mute { pointer-events: auto; width: 44px; height: 44px; border-radius: 50%; background: rgba(20,32,52,.62); display: grid;
  place-items: center; font-size: 20px; cursor: pointer; }
#hud .hint { position: absolute; left: 50%; transform: translateX(-50%); top: calc(env(safe-area-inset-top) + 64px);
  background: rgba(20,32,52,.62); border-radius: 999px; padding: 7px 18px; font-size: 16px; color: #ffe98a; white-space: nowrap;
  max-width: calc(100vw - 24px); overflow: hidden; text-overflow: ellipsis; }
#hud .wave { position: absolute; left: 50%; transform: translateX(-50%); top: calc(env(safe-area-inset-top) + 106px);
  display: flex; flex-direction: column; align-items: center; gap: 4px; font-size: 14px; text-shadow: 0 2px 0 rgba(0,0,0,.4); }
#hud .bar { width: 150px; height: 10px; border-radius: 6px; background: rgba(20,32,52,.55); overflow: hidden; box-shadow: inset 0 0 0 2px rgba(255,255,255,.5); }
#hud .bar i { display: block; height: 100%; width: 100%; background: linear-gradient(#ffb36b, #d9782f); transition: width .2s; }
#hud .wave.danger .bar i { background: linear-gradient(#ff7a6b, #d93a2f); }
#hud .toast { position: absolute; left: 0; right: 0; top: 30%; text-align: center; opacity: 0; transition: opacity .25s;
  text-shadow: 0 3px 0 rgba(0,0,0,.35), 0 0 18px rgba(0,0,0,.25); }
#hud .toast .t1 { font-size: 34px; }
#hud .toast .t2 { font-size: 20px; color: #ffe98a; margin-top: 6px; }
#hud .joy { position: absolute; width: ${JOY_RADIUS * 2}px; height: ${JOY_RADIUS * 2}px; margin: -${JOY_RADIUS}px 0 0 -${JOY_RADIUS}px;
  border-radius: 50%; background: rgba(255,255,255,.18); box-shadow: inset 0 0 0 3px rgba(255,255,255,.55); display: none; }
#hud .joy i { position: absolute; left: 50%; top: 50%; width: 48px; height: 48px; margin: -24px 0 0 -24px; border-radius: 50%;
  background: rgba(255,255,255,.8); }
#hud .float { position: absolute; font-size: 22px; transform: translate(-50%, -50%); text-shadow: 0 2px 0 rgba(0,0,0,.45); white-space: nowrap; }
`;

interface Floater { el: HTMLDivElement; pos: THREE.Vector3; t: number; }

export class Hud {
  private money: HTMLElement;
  private moneyPill: HTMLElement;
  private hint: HTMLElement;
  private wave: HTMLElement;
  private waveText: HTMLElement;
  private wallFill: HTMLElement;
  private toast: HTMLElement;
  private joy: HTMLElement;
  private knob: HTMLElement;
  private floaters: Floater[] = [];
  private toastT = 99;
  private lastMoney = -1;
  private v = new THREE.Vector3();
  private root: HTMLElement;

  constructor() {
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);
    this.root = document.createElement('div');
    this.root.id = 'hud';
    this.root.innerHTML = `
      <div class="top">
        <div class="pill money"><span class="bill"></span><span class="v">0</span></div>
        <div class="mute">🔊</div>
      </div>
      <div class="hint"></div>
      <div class="wave"><span class="wt"></span><div class="bar"><i></i></div></div>
      <div class="toast"><div class="t1"></div><div class="t2"></div></div>
      <div class="joy"><i></i></div>`;
    document.body.appendChild(this.root);
    const q = (s: string) => this.root.querySelector(s) as HTMLElement;
    this.moneyPill = q('.money');
    this.money = q('.money .v');
    this.hint = q('.hint');
    this.wave = q('.wave');
    this.waveText = q('.wave .wt');
    this.wallFill = q('.bar i');
    this.toast = q('.toast');
    this.joy = q('.joy');
    this.knob = q('.joy i');
    const mute = q('.mute');
    mute.textContent = isMuted() ? '🔇' : '🔊';
    mute.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      setMuted(!isMuted());
      mute.textContent = isMuted() ? '🔇' : '🔊';
      try { localStorage.setItem('frost-camp-muted', isMuted() ? '1' : '0'); } catch { /* ignore */ }
    });
  }

  showToast(text: string, sub = ''): void {
    (this.toast.querySelector('.t1') as HTMLElement).textContent = text;
    (this.toast.querySelector('.t2') as HTMLElement).textContent = sub;
    this.toastT = 0;
  }

  float(text: string, x: number, y: number, z: number, color: string): void {
    const el = document.createElement('div');
    el.className = 'float';
    el.textContent = text;
    el.style.color = color;
    this.root.appendChild(el);
    this.floaters.push({ el, pos: new THREE.Vector3(x, y, z), t: 0 });
  }

  update(g: Game, input: Input, camera: THREE.Camera, hint: string, dt: number): void {
    const m = Math.floor(g.money);
    if (m !== this.lastMoney) {
      this.money.textContent = formatNum(m);
      if (m > this.lastMoney && this.lastMoney >= 0) {
        this.moneyPill.classList.remove('bump');
        void this.moneyPill.offsetWidth;
        this.moneyPill.classList.add('bump');
      }
      this.lastMoney = m;
    }
    if (this.hint.textContent !== hint) this.hint.textContent = hint;

    const bears = g.aliveBears().length + g.bears.filter((b) => b.state === 'spawn').length;
    const wt = g.waveActive
      ? `${fmt(T.wave, { n: g.wave })} · ${fmt(T.bearsLeft, { n: bears })}`
      : fmt(T.waveIn, { n: g.wave, t: formatTime(g.waveTimer) });
    if (this.waveText.textContent !== wt) this.waveText.textContent = wt;
    this.wallFill.style.width = `${(g.wallHp / g.wallMax) * 100}%`;
    this.wave.classList.toggle('danger', g.waveActive);

    this.toastT += dt;
    this.toast.style.opacity = this.toastT < 2.6 ? '1' : '0';

    if (input.joy.active) {
      const j = input.joy;
      const dx = j.kx - j.ox, dy = j.ky - j.oy, d = Math.hypot(dx, dy), k = d > JOY_RADIUS ? JOY_RADIUS / d : 1;
      this.joy.style.display = 'block';
      this.joy.style.left = `${j.ox}px`;
      this.joy.style.top = `${j.oy}px`;
      this.knob.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
    } else this.joy.style.display = 'none';

    for (const f of this.floaters) {
      f.t += dt;
      this.v.copy(f.pos);
      this.v.y += f.t * 1.5;
      this.v.project(camera);
      f.el.style.left = `${(this.v.x * 0.5 + 0.5) * window.innerWidth}px`;
      f.el.style.top = `${(-this.v.y * 0.5 + 0.5) * window.innerHeight}px`;
      f.el.style.opacity = String(Math.max(0, 1 - Math.max(0, f.t - 0.6) / 0.5));
      if (f.t > 1.1) f.el.remove();
    }
    this.floaters = this.floaters.filter((f) => f.t <= 1.1);
  }
}

function formatNum(n: number): string {
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e4) return (n / 1e3).toFixed(1) + 'K';
  return String(n);
}

function formatTime(s: number): string {
  const t = Math.max(0, Math.ceil(s));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
}
