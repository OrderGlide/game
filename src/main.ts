import { Game, type SaveData } from './game';
import { Input } from './input';
import { View } from './view/view';
import { Hud } from './view/hud';
import { setMuted, unlockAudio } from './audio';
import { T } from './i18n';

const SAVE_KEY = 'frost-camp-save-v2';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const game = new Game();

try {
  const raw = localStorage.getItem(SAVE_KEY);
  if (raw) game.load(JSON.parse(raw) as SaveData);
  setMuted(localStorage.getItem('frost-camp-muted') === '1');
} catch (e) {
  console.warn('Save could not be loaded, starting fresh', e);
}

const input = new Input(canvas);
const hud = new Hud();
const view = new View(canvas, game);

function save(): void {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(game.serialize())); } catch { /* storage full/blocked */ }
}

let dirty = false;
game.onChange = () => { dirty = true; };
setInterval(() => { if (dirty) { dirty = false; save(); } }, 3000);
document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });
window.addEventListener('pagehide', save);
input.onFirstInteraction = unlockAudio;

let last = performance.now();
function frame(now: number): void {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  const d = input.direction();
  game.update(dt, { x: d.x, z: d.y });
  const obj = game.objective();
  view.handleEvents(game.events, hud);
  view.update(game, dt, obj);
  hud.update(game, input, view.camera, obj?.text ?? T.free, dt);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

if (import.meta.env.DEV) Object.assign(window, { game, view });
