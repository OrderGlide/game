// DOM overlay: money & gems, hint, wave/boss bars, joystick, floating texts, and the menus
// (Forge upgrades, Shop, Daily rewards, Daily quests, World complete).
import * as THREE from 'three';
import { JOY_RADIUS, type Input } from '../input';
import { formatNum, type Game } from '../game';
import {
  BOOSTS, CHEST, GEMS, SKINS, STATS, UPGRADES, WORLDS, type Gem, type Levels, type Price, type Reward, type UpgradeId,
} from '../data';
import { DAILY_REWARDS, type Quality, type Settings } from '../profile';
import { PETS, type PetId } from '../data';
import { PRODUCTS, type ProductId } from '../platform/config';
import { T, fmt } from '../i18n';
import { unlockAudio } from '../audio';

const GEM_CSS: Record<Gem, string> = { em: '#2ee87a', di: '#6fe8ff', ob: '#9b5cff' };

const CSS = `
#hud { position: fixed; inset: 0; pointer-events: none; font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  font-weight: 800; color: #fff; -webkit-font-smoothing: antialiased; }
#hud .top { position: absolute; left: 0; right: 0; top: calc(env(safe-area-inset-top) + 10px); padding: 0 12px;
  display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; }
#hud .left { display: flex; flex-direction: column; gap: 6px; align-items: flex-start; }
#hud .pill { background: rgba(20,32,52,.66); border-radius: 999px; padding: 5px 14px 5px 8px; display: flex; align-items: center; gap: 8px;
  font-size: 21px; box-shadow: 0 3px 0 rgba(0,0,0,.18); text-shadow: 0 2px 0 rgba(0,0,0,.35); font-variant-numeric: tabular-nums; }
#hud .gems { display: flex; gap: 5px; }
#hud .gems .pill { font-size: 15px; padding: 3px 10px 3px 6px; gap: 5px; }
#hud .bill { width: 32px; height: 19px; border-radius: 4px; background: linear-gradient(#58d86a, #2fae42); position: relative; box-shadow: inset 0 0 0 2px #1f8a31; }
#hud .bill::after { content: '$'; position: absolute; inset: 0; display: grid; place-items: center; font-size: 13px; color: #eaffea; text-shadow: none; }
#hud .gem { width: 14px; height: 14px; transform: rotate(45deg); border-radius: 3px; box-shadow: inset -3px -3px 0 rgba(0,0,0,.2), inset 3px 3px 0 rgba(255,255,255,.45); flex: none; }
#hud .bump { animation: bump .18s ease-out; }
@keyframes bump { 50% { transform: scale(1.12); } }
#hud .right { display: flex; flex-direction: column; gap: 6px; align-items: flex-end; }
#hud .world { font-size: 12px; background: rgba(20,32,52,.55); padding: 4px 10px; border-radius: 999px; }
#hud .round { pointer-events: auto; width: 46px; height: 46px; border-radius: 50%; background: rgba(20,32,52,.66); display: grid;
  place-items: center; font-size: 22px; cursor: pointer; position: relative; box-shadow: 0 3px 0 rgba(0,0,0,.2); border: 0; color: #fff; }
#hud .round:active { transform: scale(.94); }
#hud .dot::after { content: ''; position: absolute; top: 3px; right: 3px; width: 12px; height: 12px; border-radius: 50%; background: #ff4d4d;
  box-shadow: 0 0 0 2px #fff; }
#hud .side { position: absolute; right: 12px; top: calc(env(safe-area-inset-top) + 150px); display: flex; flex-direction: column; gap: 10px; }
#hud .hint { position: absolute; left: 50%; transform: translateX(-50%); top: calc(env(safe-area-inset-top) + 96px);
  background: rgba(20,32,52,.66); border-radius: 999px; padding: 7px 16px; font-size: 15px; color: #ffe98a; white-space: nowrap;
  max-width: calc(100vw - 150px); overflow: hidden; text-overflow: ellipsis; }
#hud .wave { position: absolute; left: 50%; transform: translateX(-50%); top: calc(env(safe-area-inset-top) + 136px);
  display: flex; flex-direction: column; align-items: center; gap: 4px; font-size: 13px; text-shadow: 0 2px 0 rgba(0,0,0,.4); }
#hud .bar { width: 140px; height: 10px; border-radius: 6px; background: rgba(20,32,52,.55); overflow: hidden; box-shadow: inset 0 0 0 2px rgba(255,255,255,.5); }
#hud .bar i { display: block; height: 100%; width: 100%; background: linear-gradient(#ffb36b, #d9782f); transition: width .2s; }
#hud .wave.danger .bar i { background: linear-gradient(#ff7a6b, #d93a2f); }
#hud .boss { display: none; flex-direction: column; align-items: center; gap: 3px; margin-top: 4px; color: #ffd23f; font-size: 14px; }
#hud .boss .bar { width: 220px; height: 14px; }
#hud .boss .bar i { background: linear-gradient(#ff6a5a, #b3262e); }
#hud .boosts { display: flex; gap: 5px; flex-wrap: wrap; max-width: 200px; }
#hud .boosts span { font-size: 12px; background: rgba(255,170,40,.85); color: #2a1a00; border-radius: 999px; padding: 2px 8px; }
#hud .toast { position: absolute; left: 0; right: 0; top: 34%; text-align: center; opacity: 0; transition: opacity .25s;
  text-shadow: 0 3px 0 rgba(0,0,0,.35), 0 0 18px rgba(0,0,0,.25); padding: 0 16px; }
#hud .toast .t1 { font-size: 32px; }
#hud .toast .t2 { font-size: 19px; color: #ffe98a; margin-top: 6px; }
#hud .joy { position: absolute; width: ${JOY_RADIUS * 2}px; height: ${JOY_RADIUS * 2}px; margin: -${JOY_RADIUS}px 0 0 -${JOY_RADIUS}px;
  border-radius: 50%; background: rgba(255,255,255,.18); box-shadow: inset 0 0 0 3px rgba(255,255,255,.55); display: none; }
#hud .joy i { position: absolute; left: 50%; top: 50%; width: 48px; height: 48px; margin: -24px 0 0 -24px; border-radius: 50%; background: rgba(255,255,255,.8); }
#hud .float { position: absolute; font-size: 22px; transform: translate(-50%, -50%); text-shadow: 0 2px 0 rgba(0,0,0,.45); white-space: nowrap;
  display: flex; align-items: center; gap: 4px; }

/* menus */
#hud .overlay { position: absolute; inset: 0; z-index: 5; background: rgba(10,16,30,.45); display: none; pointer-events: auto; align-items: flex-end; justify-content: center; }
#hud .overlay.open { display: flex; }
#hud .panel { width: min(460px, 100%); max-height: min(78vh, 680px); background: #1c2740; border-radius: 22px 22px 0 0; padding: 16px 16px calc(env(safe-area-inset-bottom) + 16px);
  box-shadow: 0 -6px 30px rgba(0,0,0,.35); display: flex; flex-direction: column; gap: 12px; animation: up .22s ease-out; }
@keyframes up { from { transform: translateY(40px); opacity: .4; } }
#hud .phead { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
#hud .phead h2 { margin: 0; font-size: 22px; letter-spacing: .01em; }
#hud .x { width: 38px; height: 38px; border-radius: 50%; border: 0; background: #2c3a5c; color: #fff; font-size: 18px; font-weight: 900; cursor: pointer; }
#hud .pbody { overflow-y: auto; display: flex; flex-direction: column; gap: 10px; padding-bottom: 4px; }
#hud .row { background: #26345a; border-radius: 16px; padding: 10px 12px; display: grid; grid-template-columns: 44px 1fr auto; gap: 10px; align-items: center; }
#hud .ic { width: 44px; height: 44px; border-radius: 12px; background: #33446f; display: grid; place-items: center; font-size: 24px; }
#hud .nm { font-size: 16px; }
#hud .nm small { color: #9fb0d6; font-weight: 700; font-size: 12px; margin-left: 4px; }
#hud .info { font-size: 12px; color: #b9c6e6; font-weight: 700; margin-top: 2px; }
#hud .cost { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 5px; font-size: 13px; }
#hud .cost span { display: inline-flex; align-items: center; gap: 4px; background: #1c2740; border-radius: 999px; padding: 2px 8px 2px 5px; }
#hud .cost span.no { color: #ff8a80; }
#hud .cost .bill { width: 22px; height: 13px; }
#hud .cost .bill::after { font-size: 9px; }
#hud .cost .gem { width: 10px; height: 10px; }
#hud .btn { border: 0; border-radius: 12px; padding: 10px 14px; font: inherit; font-size: 15px; color: #fff; cursor: pointer; min-width: 78px;
  background: linear-gradient(#4fd566, #27a33f); box-shadow: 0 3px 0 #1a7a2c; }
#hud .btn:active { transform: translateY(2px); box-shadow: 0 1px 0 #1a7a2c; }
#hud .btn[disabled] { background: #45506e; box-shadow: 0 3px 0 #2e3650; color: #9aa6c4; cursor: default; }
#hud .btn.gold { background: linear-gradient(#ffd45a, #f0a020); box-shadow: 0 3px 0 #b87400; color: #3a2400; }
#hud .btn.gold[disabled] { background: #45506e; box-shadow: 0 3px 0 #2e3650; color: #9aa6c4; }
#hud .tabs { display: flex; gap: 6px; }
#hud .tab { flex: 1; border: 0; border-radius: 12px; padding: 9px 4px; font: inherit; font-size: 14px; color: #b9c6e6; background: #26345a; cursor: pointer; }
#hud .tab.on { background: #3b5bd9; color: #fff; }
#hud .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(118px, 1fr)); gap: 10px; }
#hud .card { background: #26345a; border-radius: 16px; padding: 10px; display: flex; flex-direction: column; align-items: center; gap: 6px; text-align: center; font-size: 13px; }
#hud .sw { width: 54px; height: 54px; border-radius: 50%; border: 6px solid; }
#hud .days { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
#hud .dayc { background: #26345a; border-radius: 14px; padding: 8px 4px; text-align: center; font-size: 12px; display: flex; flex-direction: column; gap: 4px; align-items: center; min-height: 86px; justify-content: center; }
#hud .dayc.now { box-shadow: inset 0 0 0 3px #ffd23f; background: #33446f; }
#hud .dayc.done { opacity: .5; }
#hud .dayc b { font-size: 20px; }
#hud .qbar { height: 10px; border-radius: 6px; background: #1c2740; overflow: hidden; margin-top: 6px; }
#hud .qbar i { display: block; height: 100%; background: linear-gradient(#ffd45a, #f0a020); }
#hud .note { color: #9fb0d6; font-size: 13px; text-align: center; font-weight: 700; }
#hud .big { text-align: center; display: flex; flex-direction: column; gap: 10px; align-items: center; padding: 10px 0; }
#hud .big .emoji { font-size: 64px; }
#hud .big h3 { margin: 0; font-size: 26px; color: #ffd23f; }
#hud .btn.ad { background: linear-gradient(#6aa8ff, #3b6fe0); box-shadow: 0 3px 0 #2a4fae; }
#hud .btn.ad[disabled] { background: #45506e; box-shadow: 0 3px 0 #2e3650; color: #9aa6c4; }
#hud .btns { display: flex; flex-direction: column; gap: 6px; align-items: stretch; }
#hud .tabs .tab { font-size: 12px; padding: 9px 2px; }
#hud .tag { display: inline-block; font-size: 10px; background: #ffd23f; color: #3a2400; border-radius: 999px; padding: 1px 7px; margin-left: 6px; vertical-align: middle; }
#hud .repair { position: absolute; left: 50%; bottom: calc(env(safe-area-inset-bottom) + 110px); transform: translateX(-50%);
  pointer-events: auto; display: none; font-size: 16px; }
#hud .tut { position: absolute; left: 50%; bottom: calc(env(safe-area-inset-bottom) + 28px); transform: translateX(-50%);
  background: rgba(255,210,63,.95); color: #3a2400; border-radius: 18px; padding: 12px 18px; font-size: 16px; display: none;
  max-width: calc(100vw - 32px); text-align: center; box-shadow: 0 4px 0 rgba(0,0,0,.2); animation: pulse 1.4s ease-in-out infinite; }
@keyframes pulse { 50% { transform: translateX(-50%) scale(1.04); } }
#hud .hand { position: absolute; left: 50%; bottom: 30%; font-size: 54px; display: none; animation: swipe 1.6s ease-in-out infinite; }
@keyframes swipe { 0% { transform: translate(-40px, 0); opacity: 0; } 20% { opacity: 1; } 80% { transform: translate(40px, -30px); opacity: 1; } 100% { opacity: 0; } }
#hud .fps { position: absolute; left: 12px; bottom: calc(env(safe-area-inset-bottom) + 8px); font-size: 12px; background: rgba(20,32,52,.6); padding: 2px 8px; border-radius: 8px; display: none; }
#hud .setrow { display: flex; align-items: center; justify-content: space-between; background: #26345a; border-radius: 14px; padding: 10px 12px; font-size: 15px; }
#hud .setrow .btn { min-width: 96px; padding: 8px 12px; }
#hud .danger { background: linear-gradient(#ff7a6b, #d93a2f); box-shadow: 0 3px 0 #9e2a20; }
`;

interface Floater { el: HTMLDivElement; pos: THREE.Vector3; t: number; }
type Panel = 'forge' | 'shop' | 'daily' | 'quests' | 'world' | 'settings' | 'offline' | null;
type ShopTab = 'gems' | 'skins' | 'pets' | 'boosts' | 'chests';

/** Platform hooks the menus call into (ads, store, settings), provided by main. */
export interface HudServices {
  showRewarded(): Promise<boolean>;
  purchase(id: ProductId): Promise<boolean>;
  restore(): Promise<void>;
  priceOf(id: ProductId): string;
  billingAvailable: boolean;
  applySettings(s: Settings, langChanged: boolean): void;
  resetProgress(): void;
  version: string;
}

const gemHtml = (g: Gem) => `<span class="gem" style="background:${GEM_CSS[g]}"></span>`;
function priceHtml(p: Price, game: Game | null): string {
  const parts: string[] = [];
  if (p.cash) parts.push(`<span class="${game && game.money < p.cash ? 'no' : ''}"><span class="bill"></span>${formatNum(p.cash)}</span>`);
  for (const g of GEMS) {
    const n = p[g];
    if (n) parts.push(`<span class="${game && game.profile.gems[g] < n ? 'no' : ''}">${gemHtml(g)}${n}</span>`);
  }
  return parts.join('');
}

export class Hud {
  onTravel: (() => void) | null = null;
  svc: HudServices | null = null;
  private offlineAmount = 0;
  private resetArmed = false;
  private busy = false;
  private game: Game | null = null;
  private root: HTMLElement;
  private els: Record<string, HTMLElement> = {};
  private floaters: Floater[] = [];
  private toastT = 99;
  private last: Record<string, string> = {};
  private v = new THREE.Vector3();
  private panel: Panel = null;
  private shopTab: ShopTab = 'gems';
  private panelKey = '';
  private forgeCooldown = 0;

  constructor() {
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);
    this.root = document.createElement('div');
    this.root.id = 'hud';
    this.root.innerHTML = `
      <div class="top">
        <div class="left">
          <div class="pill money"><span class="bill"></span><span data-v="money">0</span></div>
          <div class="gems">
            ${GEMS.map((g) => `<div class="pill" data-gem="${g}">${gemHtml(g)}<span data-v="${g}">0</span></div>`).join('')}
          </div>
          <div class="boosts" data-v="boosts"></div>
        </div>
        <div class="right">
          <button class="round" data-act="mute">🔊</button>
          <div class="world" data-v="world"></div>
        </div>
      </div>
      <div class="side">
        <button class="round" data-act="forge">🔨</button>
        <button class="round" data-act="shop">🛒</button>
        <button class="round" data-act="daily">📅</button>
        <button class="round" data-act="quests">📜</button>
        <button class="round" data-act="settings">⚙️</button>
      </div>
      <button class="btn ad repair" data-act="adRepair" data-v="repair"></button>
      <div class="hand" data-v="hand">👆</div>
      <div class="tut" data-v="tut"></div>
      <div class="fps" data-v="fps"></div>
      <div class="hint" data-v="hint"></div>
      <div class="wave" data-v="waveBox"><span data-v="wave"></span><div class="bar"><i data-v="wall"></i></div>
        <div class="boss" data-v="bossBox"><span>👑 BOSS</span><div class="bar"><i data-v="bossHp"></i></div></div></div>
      <div class="toast"><div class="t1"></div><div class="t2"></div></div>
      <div class="joy"><i></i></div>
      <div class="overlay" data-v="overlay"><div class="panel" data-v="panel"></div></div>`;
    document.body.appendChild(this.root);
    this.root.querySelectorAll<HTMLElement>('[data-v]').forEach((el) => { this.els[el.dataset.v!] = el; });
    this.els.toast = this.root.querySelector('.toast')!;
    this.els.joy = this.root.querySelector('.joy')!;
    this.els.knob = this.root.querySelector('.joy i')!;
    this.els.mute = this.root.querySelector('[data-act="mute"]')!;


    this.root.addEventListener('pointerdown', (e) => {
      const target = e.target as HTMLElement;
      if (target.closest('.overlay, .round')) { e.stopPropagation(); unlockAudio(); }
    });
    // act on release (not click) so a menu refresh between press and release can't swallow the tap,
    // and ignore releases that ended a scroll gesture
    let down = { x: 0, y: 0 };
    this.root.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY }; });
    this.root.addEventListener('pointerup', (e) => {
      if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > 12) return;
      this.onPress(e.target as HTMLElement);
    });
  }

  setGame(g: Game): void {
    this.game = g;
    const st = g.profile.settings;
    this.els.mute.textContent = st.sfx || st.music ? '🔊' : '🔇';
    this.last = {};
    this.close();
  }

  // ---------- event hooks from the view ----------

  showToast(text: string, sub = ''): void {
    (this.els.toast.querySelector('.t1') as HTMLElement).textContent = text;
    (this.els.toast.querySelector('.t2') as HTMLElement).textContent = sub;
    this.toastT = 0;
  }

  float(text: string, x: number, y: number, z: number, color: string): void {
    const el = document.createElement('div');
    el.className = 'float';
    el.textContent = text;
    el.style.color = color;
    this.addFloat(el, x, y, z);
  }

  floatGems(p: Price, x: number, y: number, z: number): void {
    const el = document.createElement('div');
    el.className = 'float';
    el.innerHTML = GEMS.filter((g) => p[g]).map((g) => `${gemHtml(g)}<span style="color:${GEM_CSS[g]}">+${p[g]}</span>`).join(' ');
    this.addFloat(el, x, y, z);
  }

  private addFloat(el: HTMLDivElement, x: number, y: number, z: number): void {
    this.root.appendChild(el);
    this.floaters.push({ el, pos: new THREE.Vector3(x, y, z), t: 0 });
  }

  openForge(): void {
    if (this.forgeCooldown > 0 || this.panel) return;
    this.open('forge');
  }

  worldComplete(): void { this.open('world'); }

  showFps(fps: number | null): void {
    this.els.fps.style.display = fps === null ? 'none' : 'block';
    if (fps !== null) this.els.fps.textContent = `${fps} FPS`;
  }

  showOffline(amount: number): void {
    this.offlineAmount = amount;
    if (!this.panel) this.open('offline');
  }

  /** Runs a rewarded ad and, if it was watched to the end, the reward. */
  private async withAd(reward: () => void): Promise<void> {
    if (this.busy || !this.svc) return;
    this.busy = true;
    try {
      if (await this.svc.showRewarded()) reward();
    } finally {
      this.busy = false;
      this.renderPanel();
    }
  }

  // ---------- menus ----------

  get menuOpen(): boolean { return this.panel !== null; }

  private open(p: Exclude<Panel, null>): void {
    this.panel = p;
    this.els.overlay.classList.add('open');
    this.renderPanel();
  }

  private close(): void {
    if (this.panel === 'forge') this.forgeCooldown = 1.5;
    this.panel = null;
    this.els.overlay?.classList.remove('open');
  }

  private onPress(target: HTMLElement): void {
    const g = this.game;
    if (target === this.els.overlay) { if (this.panel !== 'world' && this.panel !== 'offline') this.close(); return; }
    const btn = target.closest<HTMLElement>('[data-act]');
    if (!btn || !g) return;
    const act = btn.dataset.act!, arg = btn.dataset.arg ?? '';
    switch (act) {
      case 'mute': {
        const st = g.profile.settings;
        const on = !(st.sfx || st.music);
        st.sfx = st.music = on;
        this.svc?.applySettings(st, false);
        btn.textContent = on ? '🔊' : '🔇';
        return;
      }
      case 'forge': case 'shop': case 'daily': case 'quests': case 'settings':
        this.resetArmed = false;
        if (this.panel === act) this.close(); else this.open(act);
        return;
      case 'close': this.close(); return;
      case 'tab': this.shopTab = arg as typeof this.shopTab; break;
      case 'up': g.buyUpgrade(arg as UpgradeId); break;
      case 'skin': g.buySkin(arg as (typeof SKINS)[number]['id']); break;
      case 'boost': g.buyBoost(arg as (typeof BOOSTS)[number]['id']); break;
      case 'chest': {
        const got = g.openChest(arg === 'free');
        if (got) this.showToast(T.got, priceText(got));
        break;
      }
      case 'claimDaily': {
        const got = g.claimDaily();
        if (got) this.showToast(T.got, rewardText(got));
        break;
      }
      case 'quest': g.claimQuest(Number(arg)); break;
      case 'pet': g.buyPet(arg as PetId); break;
      case 'adBoost': void this.withAd(() => { g.adBoost(arg as 'cash' | 'speed' | 'chop'); this.showToast(T.got, T.boost[arg as 'cash']); }); return;
      case 'adChest': void this.withAd(() => this.showToast(T.got, priceText(g.adChest()))); return;
      case 'adDouble': void this.withAd(() => this.showToast(T.got, rewardText(g.doubleDaily()))); return;
      case 'adRepair': void this.withAd(() => g.adRepair()); return;
      case 'offline':
        if (arg === 'ad') void this.withAd(() => { g.claimOffline(2); this.close(); });
        else { g.claimOffline(1); this.close(); }
        return;
      case 'buy': {
        const id = arg as ProductId;
        if (this.busy || !this.svc) return;
        this.busy = true;
        void this.svc.purchase(id).then((ok) => {
          this.busy = false;
          if (ok) { g.grantProduct(id); this.showToast(T.got, T.product[id]); }
          else if (!this.svc?.billingAvailable) this.showToast(T.storeOnlyApp);
          this.renderPanel();
        });
        return;
      }
      case 'restore': void this.svc?.restore().then(() => this.renderPanel()); return;
      case 'set': {
        const st = g.profile.settings;
        const before = st.lang;
        if (arg === 'quality') {
          const order: Quality[] = ['auto', 'low', 'medium', 'high'];
          st.quality = order[(order.indexOf(st.quality) + 1) % order.length];
        } else if (arg === 'lang') {
          const order: Settings['lang'][] = ['auto', 'pl', 'en'];
          st.lang = order[(order.indexOf(st.lang) + 1) % order.length];
        } else {
          const k = arg as 'sfx' | 'music' | 'vibration' | 'fps';
          st[k] = !st[k];
        }
        this.svc?.applySettings(st, st.lang !== before);
        g.onChange?.();
        break;
      }
      case 'reset':
        if (!this.resetArmed) { this.resetArmed = true; break; }
        this.svc?.resetProgress();
        return;
      case 'travel': this.close(); this.onTravel?.(); return;
    }
    this.renderPanel();
  }

  private renderPanel(): void {
    const g = this.game;
    if (!g || !this.panel) return;
    const head = (title: string, closable = true) =>
      `<div class="phead"><h2>${title}</h2>${closable ? '<button class="x" data-act="close">✕</button>' : ''}</div>`;
    let html = '';
    if (this.panel === 'forge') {
      html = head(`🔨 ${T.forgeTitle}`) + `<div class="pbody">${UPGRADES.map((u) => {
        const l = g.lv[u.id], price = g.upgradePrice(u.id);
        const info = price ? upgradeInfo(u.id, g.lv) : '';
        return `<div class="row"><div class="ic">${u.icon}</div><div>
          <div class="nm">${T.upgrade[u.id]}<small>${fmt(T.lvl, { n: l + 1 })}</small></div>
          <div class="info">${info}</div>
          ${price ? `<div class="cost">${priceHtml(price, g)}</div>` : ''}</div>
          ${price ? `<button class="btn" data-act="up" data-arg="${u.id}" ${g.canAfford(price) ? '' : 'disabled'}>${T.buyBtn}</button>`
            : `<button class="btn" disabled>${T.max}</button>`}</div>`;
      }).join('')}</div>`;
    } else if (this.panel === 'shop') {
      const tab = (id: ShopTab, label: string) => `<button class="tab ${this.shopTab === id ? 'on' : ''}" data-act="tab" data-arg="${id}">${label}</button>`;
      let body = '';
      if (this.shopTab === 'gems') {
        body = PRODUCTS.map((pr) => {
          const owned = !pr.consumable && g.owns(pr.id);
          const info = T.productInfo[pr.id] || '';
          return `<div class="row"><div class="ic">${pr.icon}</div><div>
            <div class="nm">${T.product[pr.id]}${pr.best ? `<span class="tag">${T.bestValue}</span>` : ''}</div>
            ${info ? `<div class="info">${info}</div>` : ''}
            <div class="cost">${priceHtml(pr.grant, null)}</div></div>
            ${owned ? `<button class="btn" disabled>${T.bought}</button>`
              : `<button class="btn gold" data-act="buy" data-arg="${pr.id}">${this.svc?.priceOf(pr.id) ?? ''}</button>`}</div>`;
        }).join('') + `<button class="btn" data-act="restore">${T.restore}</button>`
          + (this.svc?.billingAvailable ? '' : `<div class="note">${T.storeOnlyApp}</div>`);
      } else if (this.shopTab === 'pets') {
        body = `<div class="grid">${PETS.map((pt) => {
          const owned = g.profile.pets.includes(pt.id), on = g.profile.pet === pt.id;
          const icon = pt.id === 'fox' ? '🦊' : pt.id === 'owl' ? '🦉' : '🐉';
          const btn = on ? `<button class="btn" data-act="pet" data-arg="${pt.id}">${T.petOn} ✓</button>`
            : owned ? `<button class="btn" data-act="pet" data-arg="${pt.id}">${T.petTake}</button>`
              : `<button class="btn gold" data-act="pet" data-arg="${pt.id}" ${g.canAfford(pt.price) ? '' : 'disabled'}>${T.buyBtn}</button>`;
          return `<div class="card"><div style="font-size:40px">${icon}</div><div>${T.pet[pt.id]}</div>
            <div class="info">${T.petInfo[pt.id]}</div>${owned ? '' : `<div class="cost">${priceHtml(pt.price, g)}</div>`}${btn}</div>`;
        }).join('')}</div>`;
      } else if (this.shopTab === 'skins') {
        body = `<div class="grid">${SKINS.map((s) => {
          const owned = g.profile.skins.includes(s.id), on = g.profile.skin === s.id;
          const c = '#' + new THREE.Color(s.color).getHexString(), t = '#' + new THREE.Color(s.trim).getHexString();
          const btn = on ? `<button class="btn" disabled>${T.equipped}</button>`
            : owned ? `<button class="btn" data-act="skin" data-arg="${s.id}">${T.equip}</button>`
              : `<button class="btn gold" data-act="skin" data-arg="${s.id}" ${g.canAfford(s.price) ? '' : 'disabled'}>${T.buyBtn}</button>`;
          return `<div class="card"><div class="sw" style="background:${c};border-color:${t}"></div><div>${T.skin[s.id]}</div>
            ${owned ? '' : `<div class="cost">${priceHtml(s.price, g)}</div>`}${btn}</div>`;
        }).join('')}</div>`;
      } else if (this.shopTab === 'boosts') {
        body = BOOSTS.map((b) => {
          const left = b.id === 'repair' ? 0 : g.boostLeft(b.id);
          return `<div class="row"><div class="ic">${b.icon}</div><div><div class="nm">${T.boost[b.id]}</div>
            ${left > 0 ? `<div class="info">${fmt(T.active, { t: fmtTime(left) })}</div>` : ''}
            <div class="cost">${priceHtml(b.price, g)}</div></div>
            <div class="btns"><button class="btn gold" data-act="boost" data-arg="${b.id}" ${g.canAfford(b.price) ? '' : 'disabled'}>${T.buyBtn}</button>
            ${b.id === 'repair' ? '' : g.adReady(b.id)
              ? `<button class="btn ad" data-act="adBoost" data-arg="${b.id}">${T.adFree}</button>`
              : `<button class="btn ad" disabled>${fmtTime(g.adWait(b.id))}</button>`}</div></div>`;
        }).join('');
      } else {
        const ready = g.freeChestReady();
        const wait = Math.max(0, (g.profile.freeChestAt - g.now()) / 1000);
        body = `<div class="row"><div class="ic">🎁</div><div><div class="nm">${T.freeChest}</div>
            <div class="info">${ready ? '' : fmt(T.readyIn, { t: fmtTime(wait) })}</div></div>
            ${ready ? `<button class="btn" data-act="chest" data-arg="free">${T.open}</button>`
              : g.adReady('chest') ? `<button class="btn ad" data-act="adChest">${T.adOpenNow}</button>`
                : `<button class="btn" disabled>${T.open}</button>`}</div>
          <div class="row"><div class="ic">💎</div><div><div class="nm">${T.gemChest}</div>
            <div class="info">${gemHtml('em')} ${gemHtml('di')} ${gemHtml('ob')}</div>
            <div class="cost">${priceHtml(CHEST.price, g)}</div></div>
            <button class="btn gold" data-act="chest" data-arg="gem" ${g.canAfford(CHEST.price) ? '' : 'disabled'}>${T.open}</button></div>`;
      }
      html = head(`🛒 ${T.shopTitle}`) + `<div class="tabs">${tab('gems', T.tabGems)}${tab('skins', T.tabSkins)}${tab('pets', T.tabPets)}${tab('boosts', T.tabBoosts)}${tab('chests', T.tabChests)}</div>
        <div class="pbody">${body}</div>`;
    } else if (this.panel === 'daily') {
      const idx = g.dailyIndex(), avail = g.dailyAvailable();
      html = head(`📅 ${T.dailyTitle}`) + `<div class="pbody"><div class="days">${DAILY_REWARDS.map((r, i) => {
        const done = avail ? i < idx : i <= idx;
        const now = avail && i === idx;
        return `<div class="dayc ${done ? 'done' : ''} ${now ? 'now' : ''}"><div>${fmt(T.day, { n: i + 1 })}</div>
          <b>${done ? '✓' : rewardIcon(r)}</b><div>${rewardShort(r, g.world.priceMult)}</div></div>`;
      }).join('')}</div>
        ${avail ? `<button class="btn gold" data-act="claimDaily">${T.claim}</button>`
          : `${g.canDoubleDaily() ? `<button class="btn ad" data-act="adDouble">${T.adDouble}</button>` : ''}<div class="note">${T.comeBack}</div>`}</div>`;
    } else if (this.panel === 'quests') {
      html = head(`📜 ${T.questsTitle}`) + `<div class="pbody">${g.profile.quests.list.map((q, i) => {
        const done = q.progress >= q.target;
        return `<div class="row"><div class="ic">${questIcon(q.kind)}</div><div>
          <div class="nm">${fmt(T.quest[q.kind], { n: formatNum(q.target) })}</div>
          <div class="qbar"><i style="width:${(q.progress / q.target) * 100}%"></i></div>
          <div class="cost"><span>${formatNum(q.progress)} / ${formatNum(q.target)}</span>${priceHtml(q.reward, null)}</div></div>
          ${q.claimed ? `<button class="btn" disabled>${T.claimed}</button>`
            : `<button class="btn gold" data-act="quest" data-arg="${i}" ${done ? '' : 'disabled'}>${T.claim}</button>`}</div>`;
      }).join('')}</div>`;
    } else if (this.panel === 'settings') {
      const st = g.profile.settings;
      const row = (label: string, key: string, value: string) =>
        `<div class="setrow"><span>${label}</span><button class="btn" data-act="set" data-arg="${key}">${value}</button></div>`;
      const onOff = (b: boolean) => (b ? T.on : T.off);
      html = head(`⚙️ ${T.settingsTitle}`) + `<div class="pbody">
        ${row(T.sMusic, 'music', onOff(st.music))}${row(T.sSfx, 'sfx', onOff(st.sfx))}${row(T.sVibration, 'vibration', onOff(st.vibration))}
        ${row(T.sQuality, 'quality', T.quality[st.quality])}${row(T.sFps, 'fps', onOff(st.fps))}
        ${row(T.sLang, 'lang', st.lang === 'auto' ? T.quality.auto : st.lang.toUpperCase())}
        <button class="btn danger" data-act="reset">${this.resetArmed ? T.resetConfirm : T.reset}</button>
        <div class="note">${T.version} ${this.svc?.version ?? ''}</div></div>`;
    } else if (this.panel === 'offline') {
      html = head(`🌙 ${T.offlineTitle}`, false) + `<div class="big"><div class="note">${T.offlineText}</div>
        <h3>+$${formatNum(this.offlineAmount)}</h3>
        <button class="btn ad" data-act="offline" data-arg="ad">${T.adDouble}</button>
        <button class="btn" data-act="offline" data-arg="1">${T.collect}</button></div>`;
    } else if (this.panel === 'world') {
      const next = WORLDS[(g.profile.world + 1) % WORLDS.length].id;
      html = head(`🌍 ${T.worldDone}`, false) + `<div class="big"><div class="emoji">🌀</div>
        <h3>${T.world[g.world.def.id]} ✓</h3>
        <button class="btn gold" data-act="travel">${fmt(T.travel, { w: T.world[next] })}</button></div>`;
    }
    this.els.panel.innerHTML = html;
    this.panelKey = this.stateKey();
  }

  /** Everything a menu shows; the open menu only re-renders when this changes. */
  private stateKey(): string {
    const g = this.game;
    if (!g) return '';
    const p = g.profile;
    return [this.panel, this.shopTab, this.resetArmed, JSON.stringify(p.settings), p.pet, p.pets.length, p.owned.length, p.dailyDoubled,
      Math.ceil(g.adWait('cash')), Math.ceil(g.adWait('speed')), Math.ceil(g.adWait('chop')), g.adReady('chest'), Math.floor(g.money), JSON.stringify(p.gems), JSON.stringify(p.levels), p.skin, p.skins.length,
      Math.ceil(g.boostLeft('cash')), Math.ceil(g.boostLeft('speed')), Math.ceil(g.boostLeft('chop')),
      Math.ceil((p.freeChestAt - g.now()) / 1000), p.daily.last, JSON.stringify(p.quests.list.map((q) => [q.progress, q.claimed]))].join('|');
  }

  // ---------- per-frame ----------

  update(g: Game, input: Input, camera: THREE.Camera, hint: string, dt: number): void {
    this.forgeCooldown = Math.max(0, this.forgeCooldown - dt);
    const set = (k: string, v: string, bump = false) => {
      if (this.last[k] === v) return;
      const prev = this.last[k];
      this.last[k] = v;
      this.els[k].textContent = v;
      if (bump && prev !== undefined) {
        const pill = this.els[k].parentElement!;
        pill.classList.remove('bump');
        void pill.offsetWidth;
        pill.classList.add('bump');
      }
    };
    set('money', formatNum(g.money), true);
    for (const gem of GEMS) set(gem, formatNum(g.profile.gems[gem]), true);
    set('hint', hint);
    const w = g.world;
    set('world', `${fmt(T.worldN, { n: w.n + 1 })}: ${T.world[w.def.id]}${w.cycle ? ` · ${fmt(T.cycle, { n: w.cycle + 1 })}` : ''}`);

    const enemies = g.enemies.filter((e) => e.state !== 'dead').length;
    set('wave', g.waveActive ? `${fmt(T.wave, { n: g.wave })} · ${enemies} 👾` : fmt(T.waveIn, { n: g.wave, t: fmtTime(g.waveTimer) }));
    this.els.wall.style.width = `${(g.wallHp / g.wallMax) * 100}%`;
    this.els.waveBox.classList.toggle('danger', g.waveActive);
    const boss = g.boss();
    this.els.bossBox.style.display = boss ? 'flex' : 'none';
    if (boss) this.els.bossHp.style.width = `${Math.max(0, boss.hp / boss.maxHp) * 100}%`;

    const boosts = (['cash', 'speed', 'chop'] as const).filter((b) => g.boostActive(b))
      .map((b) => `${BOOSTS.find((x) => x.id === b)!.icon} ${fmtTime(g.boostLeft(b))}`).join('|');
    if (this.last.boosts !== boosts) {
      this.last.boosts = boosts;
      this.els.boosts.innerHTML = boosts ? boosts.split('|').map((s) => `<span>${s}</span>`).join('') : '';
    }

    const dot = (act: string, on: boolean) => this.root.querySelector(`[data-act="${act}"]`)!.classList.toggle('dot', on);
    dot('daily', g.dailyAvailable());
    dot('quests', g.questsReady() > 0);
    dot('forge', !!g.affordableUpgrade());
    dot('shop', g.freeChestReady());

    // keep an open menu's buttons in sync with money and timers
    if (this.panel && this.panel !== 'world' && this.panel !== 'offline' && this.stateKey() !== this.panelKey) this.renderPanel();

    // watch-an-ad palisade repair while monsters are inside
    const canRepair = g.canAdRepair();
    this.els.repair.style.display = canRepair && !this.panel ? 'block' : 'none';
    if (canRepair) set('repair', T.adRepair);

    // first-run tutorial
    const step = g.profile.tutorial;
    const tut = step < 99 && !this.panel ? T.tut[Math.min(step, T.tut.length - 1)] : '';
    this.els.tut.style.display = tut ? 'block' : 'none';
    if (tut) set('tut', `👉 ${tut}`);
    this.els.hand.style.display = step === 0 && !input.joy.active ? 'block' : 'none';

    this.toastT += dt;
    this.els.toast.style.opacity = this.toastT < 2.6 ? '1' : '0';

    if (input.joy.active && !this.panel) {
      const j = input.joy;
      const dx = j.kx - j.ox, dy = j.ky - j.oy, d = Math.hypot(dx, dy), k = d > JOY_RADIUS ? JOY_RADIUS / d : 1;
      this.els.joy.style.display = 'block';
      this.els.joy.style.left = `${j.ox}px`;
      this.els.joy.style.top = `${j.oy}px`;
      this.els.knob.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
    } else this.els.joy.style.display = 'none';

    for (const f of this.floaters) {
      f.t += dt;
      this.v.copy(f.pos);
      this.v.y += f.t * 1.5;
      this.v.project(camera);
      f.el.style.left = `${(this.v.x * 0.5 + 0.5) * window.innerWidth}px`;
      f.el.style.top = `${(-this.v.y * 0.5 + 0.5) * window.innerHeight}px`;
      f.el.style.opacity = String(Math.max(0, 1 - Math.max(0, f.t - 0.7) / 0.5));
      if (f.t > 1.2) f.el.remove();
    }
    this.floaters = this.floaters.filter((f) => f.t <= 1.2);
  }
}

function upgradeInfo(id: UpgradeId, lv: Levels): string {
  const next = { ...lv, [id]: lv[id] + 1 };
  const [a, b] = ((): [string | number, string | number] => {
    switch (id) {
      case 'bag': return [STATS.capacity(lv), STATS.capacity(next)];
      case 'axe': return [T.tiers[Math.min(lv.axe, 9)], T.tiers[Math.min(next.axe, 9)]];
      case 'axes': return [STATS.axeCount(lv), STATS.axeCount(next)];
      case 'pick': return [STATS.pickLevel(lv), STATS.pickLevel(next)];
      case 'boots': return [STATS.speed(lv).toFixed(1), STATS.speed(next).toFixed(1)];
      case 'power': return [STATS.towerMult(lv).toFixed(2), STATS.towerMult(next).toFixed(2)];
    }
  })();
  return fmt(T.upgradeInfo[id], { a, b });
}

function fmtTime(s: number): string {
  const t = Math.max(0, Math.ceil(s));
  if (t >= 3600) return `${Math.floor(t / 3600)}h ${Math.floor((t % 3600) / 60)}m`;
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
}

function priceText(p: Price): string {
  const parts: string[] = [];
  if (p.cash) parts.push(`$${formatNum(p.cash)}`);
  const names: Record<Gem, string> = { em: '💚', di: '💎', ob: '🟣' };
  for (const g of GEMS) if (p[g]) parts.push(`${names[g]} ${p[g]}`);
  return parts.join('  ');
}

function rewardText(r: Reward): string {
  const parts = [priceText(r)];
  if (r.boost) parts.push(T.boost[r.boost]);
  if (r.skin) parts.push(T.skin[r.skin]);
  return parts.filter(Boolean).join('  ');
}

function rewardIcon(r: Reward): string {
  if (r.skin) return '🧥';
  if (r.boost) return '⚡';
  if (r.ob) return '🟣';
  if (r.di) return '💎';
  if (r.em) return '💚';
  return '💵';
}

function rewardShort(r: Reward, mult: number): string {
  if (r.skin) return T.skinTag;
  if (r.boost) return T.boostTag;
  if (r.cash) return `$${formatNum(r.cash * mult)}`;
  const g = GEMS.find((k) => r[k]);
  return g ? `×${r[g]}` : '';
}

function questIcon(kind: string): string {
  return ({ chop: '🪓', serve: '🎅', kill: '⚔️', mine: '⛏️', earn: '💵', waves: '🛡️' } as Record<string, string>)[kind] ?? '⭐';
}
