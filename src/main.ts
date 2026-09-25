import { Game, type SaveData } from './game';
import { Input } from './input';
import { Renderer } from './render';
import { isMuted, setMuted, unlockAudio } from './audio';

const SAVE_KEY = 'stack-island-save-v1';
const MUTE_KEY = 'stack-island-muted';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const game = new Game();
const input = new Input(canvas);
const renderer = new Renderer(canvas);

try {
  const raw = localStorage.getItem(SAVE_KEY);
  if (raw) game.load(JSON.parse(raw) as SaveData);
  setMuted(localStorage.getItem(MUTE_KEY) === '1');
} catch (e) {
  console.warn('Save could not be loaded, starting fresh', e);
}
renderer.snapCamera(game.player.x, game.player.y - 40);

function save(): void {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(game.serialize())); } catch { /* storage full/blocked */ }
}

let dirty = false;
game.onChange = () => { dirty = true; };
setInterval(() => { if (dirty) { dirty = false; save(); } }, 3000);
document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });
window.addEventListener('pagehide', save);

input.onFirstInteraction = unlockAudio;
input.onTap = (x, y) => {
  if (game.showWin) { game.showWin = false; return true; }
  const m = renderer.muteBtn;
  if (Math.hypot(x - m.x, y - m.y) <= m.r + 8) {
    setMuted(!isMuted());
    try { localStorage.setItem(MUTE_KEY, isMuted() ? '1' : '0'); } catch { /* ignore */ }
    return true;
  }
  return false;
};

let last = performance.now();
function frame(now: number): void {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  game.update(dt, game.showWin ? { x: 0, y: 0 } : input.direction());
  renderer.draw(game, input, dt);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

if (import.meta.env.DEV) Object.assign(window, { game, renderer });
