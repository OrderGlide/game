import { Game, type CampSave } from './game';
import { newProfile, normalizeProfile, type ProfileData } from './profile';
import { Input } from './input';
import { View } from './view/view';
import { Hud } from './view/hud';
import { setMuted, unlockAudio } from './audio';
import { T, fmt } from './i18n';

const SAVE_KEY = 'frost-camp-save-v3';

interface SaveFile { v: 3; profile: ProfileData; camp: CampSave | null; }

function loadSave(): { profile: ProfileData; camp?: CampSave } {
  try {
    setMuted(localStorage.getItem('frost-camp-muted') === '1');
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
let game = new Game(profile, saved.camp);

const input = new Input(canvas);
const view = new View(canvas);
const hud = new Hud();
view.build(game);
hud.setGame(game);

function save(): void {
  try {
    const file: SaveFile = { v: 3, profile, camp: game.serializeCamp() };
    localStorage.setItem(SAVE_KEY, JSON.stringify(file));
  } catch { /* storage full or blocked */ }
}

let dirty = false;
function wire(g: Game): void { g.onChange = () => { dirty = true; }; }
wire(game);
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
  view.build(game);
  hud.setGame(game);
  save();
  announceWorld();
};

if (!saved.camp) announceWorld();
if (game.worldDone) hud.worldComplete();

let last = performance.now();
function frame(now: number): void {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  const d = hud.menuOpen ? { x: 0, y: 0 } : input.direction();
  game.update(dt, { x: d.x, z: d.y });
  const obj = game.objective();
  view.handleEvents(game.events, hud);
  view.update(game, dt, obj);
  hud.update(game, input, view.camera, obj?.text ?? T.free, dt);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

if (import.meta.env.DEV) {
  Object.defineProperty(window, 'game', { get: () => game });
  Object.assign(window, { view, hud, profile, travel: () => hud.onTravel?.() });
}
