// Tiny WebAudio synth — no audio files needed.

type Sfx = 'pick' | 'drop' | 'coin' | 'build' | 'chop' | 'upgrade';

let ctx: AudioContext | null = null;
let muted = false;
const lastPlayed: Partial<Record<Sfx, number>> = {};

export function unlockAudio(): void {
  if (!ctx) {
    try { ctx = new AudioContext(); } catch { return; }
  }
  if (ctx.state === 'suspended') void ctx.resume();
}

export function setMuted(m: boolean): void { muted = m; }
export function isMuted(): boolean { return muted; }

function tone(freq: number, dur: number, type: OscillatorType, vol: number, delay = 0, slide = 0): void {
  if (!ctx) return;
  const t0 = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t0 + dur);
  gain.gain.setValueAtTime(vol, t0);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

export function sfx(name: Sfx): void {
  if (muted || !ctx) return;
  const now = performance.now();
  // throttle rapid-fire sounds so stacks of transfers don't turn into noise
  if (now - (lastPlayed[name] ?? 0) < 45) return;
  lastPlayed[name] = now;
  const jitter = 1 + (Math.random() - 0.5) * 0.12;
  switch (name) {
    case 'pick': tone(520 * jitter, 0.08, 'triangle', 0.12, 0, 260); break;
    case 'drop': tone(380 * jitter, 0.07, 'triangle', 0.1, 0, -120); break;
    case 'coin': tone(1180 * jitter, 0.06, 'square', 0.04); tone(1560 * jitter, 0.08, 'square', 0.035, 0.04); break;
    case 'chop': tone(160 * jitter, 0.06, 'sawtooth', 0.06, 0, -60); break;
    case 'upgrade': [523, 659, 784].forEach((f, i) => tone(f, 0.12, 'triangle', 0.12, i * 0.06)); break;
    case 'build': [392, 523, 659, 784, 1046].forEach((f, i) => tone(f, 0.18, 'triangle', 0.14, i * 0.07)); break;
  }
}

export function vibrate(ms: number): void {
  if (muted) return;
  try { navigator.vibrate?.(ms); } catch { /* not supported */ }
}
