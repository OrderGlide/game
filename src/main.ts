import { Game, type CampSave } from './game';
import { newProfile, normalizeProfile, type ProfileData, type Settings } from './profile';
import { Input } from './input';
import { View } from './view/view';
import { Hud } from './view/hud';
import { Music } from './music';
import { setMuted, setVibration, unlockAudio } from './audio';
import { T, fmt, setLang } from './i18n';
import { initAds, isNative, showInterstitial, showRewarded } from './platform/ads';
import { billingAvailable, loadPrices, ownedProducts, priceOf, purchase } from './platform/billing';
import { INTERSTITIAL } from './platform/config';

const SAVE_KEY = 'frost-camp-save-v3';
const VERSION = '0.4.0';

interface SaveFile { v: 3; profile: ProfileData; camp: CampSave | null; }

function loadSave(): { profile: ProfileData; camp?: CampSave } {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      const s = JSON.parse(raw) as SaveFile;
      return { profile: normalizeProfile(s.profile), camp: s.camp ?? undefined };
    }
  } catch (e) {
    console.warn('Save could not be loaded, starting fresh', e);
  }
  return { profile: newProfile() };
}

const canvas = document.getElementById('game') as HTMLCanvasElement;
const saved = loadSave();
const profile = saved.profile;
setLang(profile.settings.lang);
let game = new Game(profile, saved.camp);

const input = new Input(canvas);
const view = new View(canvas);
const hud = new Hud();
const music = new Music();

function applySettings(s: Settings): void {
  setMuted(!s.sfx);
  setVibration(s.vibration);
  music.setEnabled(s.music);
  view.setQuality(s.quality);
}

function save(): void {
  try {
    const file: SaveFile = { v: 3, profile, camp: game.serializeCamp() };
    localStorage.setItem(SAVE_KEY, JSON.stringify(file));
  } catch { /* storage full or blocked */ }
}

hud.svc = {
  showRewarded,
  purchase,
  priceOf,
  billingAvailable,
  version: VERSION,
  async restore() {
    for (const id of await ownedProducts()) if (!game.owns(id)) game.grantProduct(id);
  },
  applySettings(s, langChanged) {
    applySettings(s);
    save();
    if (langChanged) location.reload();
  },
  resetProgress() {
    try { localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ }
    location.reload();
  },
};

function enterWorld(): void {
  view.build(game);
  hud.setGame(game);
  music.setWorld(game.world.def.id);
}

let dirty = false;
function wire(g: Game): void { g.onChange = () => { dirty = true; }; }
wire(game);
applySettings(profile.settings);
enterWorld();
setInterval(() => { if (dirty) { dirty = false; save(); } }, 3000);
document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });
window.addEventListener('pagehide', save);
input.onFirstInteraction = unlockAudio;

function announceWorld(): void {
  const w = game.world;
  hud.showToast(`${fmt(T.worldN, { n: w.n + 1 })}: ${T.world[w.def.id]}`, w.cycle ? fmt(T.cycle, { n: w.cycle + 1 }) : '');
}

hud.onTravel = () => {
  profile.world++;
  profile.stats.worldsDone++;
  game = new Game(profile);
  wire(game);
  enterWorld();
  save();
  announceWorld();
};

if (!saved.camp) announceWorld();
if (game.worldDone) hud.worldComplete();

// ads & store (Android only; the browser build uses a simulated ad)
if (isNative) {
  void initAds();
  void loadPrices();
  void hud.svc.restore();
}
const sessionStart = performance.now();
let lastInterstitial = 0;
let wavesSinceAd = 0;
function maybeInterstitial(): void {
  if (profile.noAds) return;
  wavesSinceAd++;
  const now = performance.now() / 1000;
  if (now - sessionStart / 1000 < INTERSTITIAL.firstAfterSec || now - lastInterstitial < INTERSTITIAL.minGapSec) return;
  if (wavesSinceAd < INTERSTITIAL.everyWaves || hud.menuOpen) return;
  wavesSinceAd = 0;
  lastInterstitial = now;
  void showInterstitial();
}

let last = performance.now();
function frame(now: number): void {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  const d = hud.menuOpen ? { x: 0, y: 0 } : input.direction();
  game.update(dt, { x: d.x, z: d.y });
  if (game.events.some((e) => e.type === 'waveCleared')) maybeInterstitial();
  music.setIntense(game.waveActive);
  const obj = game.objective();
  view.handleEvents(game.events, hud);
  view.update(game, dt, obj);
  hud.update(game, input, view.camera, obj?.text ?? T.free, dt);
  hud.showFps(profile.settings.fps ? view.fps : null);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

if (import.meta.env.DEV) {
  Object.defineProperty(window, 'game', { get: () => game });
  Object.assign(window, { view, hud, profile, travel: () => hud.onTravel?.() });
}
