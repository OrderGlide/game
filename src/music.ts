// Procedural background music: a looping 4-bar tune per world, generated with WebAudio.
import type { WorldId } from './data';
import { mulberry32 } from './data';
import { getAudioContext, whenAudioUnlocked } from './audio';

interface Track { bpm: number; root: number; scale: number[]; chords: number[]; lead: OscillatorType; bass: OscillatorType; bell?: boolean; }

const TRACKS: Record<WorldId, Track> = {
  winter: { bpm: 96, root: 62, scale: [0, 2, 4, 7, 9], chords: [0, 3, 1, 4], lead: 'triangle', bass: 'sine', bell: true },
  desert: { bpm: 104, root: 64, scale: [0, 1, 4, 5, 7, 8, 10], chords: [0, 1, 0, 6], lead: 'triangle', bass: 'triangle' },
  jungle: { bpm: 112, root: 60, scale: [0, 2, 3, 5, 7, 9, 10], chords: [0, 3, 4, 3], lead: 'square', bass: 'triangle' },
  swamp: { bpm: 84, root: 57, scale: [0, 3, 5, 7, 10], chords: [0, 2, 3, 1], lead: 'triangle', bass: 'sine' },
  volcano: { bpm: 120, root: 52, scale: [0, 2, 3, 5, 7, 8, 11], chords: [0, 5, 3, 4], lead: 'sawtooth', bass: 'square' },
  crystal: { bpm: 90, root: 67, scale: [0, 2, 4, 6, 7, 9, 11], chords: [0, 4, 5, 3], lead: 'sine', bass: 'sine', bell: true },
};

const STEPS = 64; // 4 bars of 16th notes

interface Pattern { lead: (number | null)[]; bass: (number | null)[]; }

function makePattern(t: Track, seed: number): Pattern {
  const rnd = mulberry32(seed);
  const deg = (d: number, oct = 0) => t.root + t.scale[((d % t.scale.length) + t.scale.length) % t.scale.length] + 12 * (oct + Math.floor(d / t.scale.length));
  const lead: (number | null)[] = [], bass: (number | null)[] = [];
  let d = 2;
  for (let i = 0; i < STEPS; i++) {
    const bar = Math.floor(i / 16), chord = t.chords[bar];
    // melody on 8th notes, wandering around the scale and landing on chord tones on the beat
    if (i % 2 === 0 && rnd() < (i % 4 === 0 ? 0.8 : 0.45)) {
      d += Math.round((rnd() - 0.5) * 4);
      d = Math.max(0, Math.min(t.scale.length * 2, d));
      if (i % 16 === 0) d = chord + t.scale.length;
      lead.push(deg(d, 0));
    } else lead.push(null);
    bass.push(i % 8 === 0 ? deg(chord, -2) : i % 8 === 6 && rnd() < 0.5 ? deg(chord + 2, -2) : null);
  }
  return { lead, bass };
}

const freq = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

export class Music {
  private on = true;
  private world: WorldId = 'winter';
  private pattern: Pattern = makePattern(TRACKS.winter, 1);
  private step = 0;
  private nextTime = 0;
  private gain: GainNode | null = null;
  private timer: number | null = null;
  private intense = false;

  constructor() {
    whenAudioUnlocked(() => this.start());
  }

  setEnabled(on: boolean): void {
    this.on = on;
    if (this.gain) this.gain.gain.value = on ? 0.5 : 0;
  }

  setWorld(w: WorldId): void {
    if (w === this.world && this.timer !== null) return;
    this.world = w;
    this.pattern = makePattern(TRACKS[w], w.length * 31 + 7);
    this.step = 0;
  }

  /** Waves add a driving kick drum. */
  setIntense(on: boolean): void { this.intense = on; }

  private start(): void {
    const ctx = getAudioContext();
    if (!ctx || this.timer !== null) return;
    this.gain = ctx.createGain();
    this.gain.gain.value = this.on ? 0.5 : 0;
    this.gain.connect(ctx.destination);
    this.nextTime = ctx.currentTime + 0.1;
    this.timer = window.setInterval(() => this.schedule(), 40);
  }

  private schedule(): void {
    const ctx = getAudioContext();
    if (!ctx || !this.gain) return;
    const t = TRACKS[this.world];
    const stepDur = 60 / t.bpm / 4;
    while (this.nextTime < ctx.currentTime + 0.2) {
      if (this.on) this.playStep(ctx, t, this.step, this.nextTime, stepDur);
      this.step = (this.step + 1) % STEPS;
      this.nextTime += stepDur;
    }
  }

  private playStep(ctx: AudioContext, t: Track, i: number, time: number, dur: number): void {
    const lead = this.pattern.lead[i], bass = this.pattern.bass[i];
    if (lead !== null) this.note(ctx, freq(lead), time, dur * (t.bell ? 3 : 1.8), t.lead, t.bell ? 0.05 : 0.035);
    if (lead !== null && t.bell && i % 8 === 0) this.note(ctx, freq(lead + 12), time, dur * 4, 'sine', 0.025);
    if (bass !== null) this.note(ctx, freq(bass), time, dur * 6, t.bass, 0.09);
    if (i % 16 === 0) {
      // soft pad chord at the start of each bar
      const root = t.root + t.scale[t.chords[Math.floor(i / 16)] % t.scale.length] - 12;
      for (const iv of [0, 7, 12]) this.note(ctx, freq(root + iv), time, dur * 15, 'sine', 0.018);
    }
    if (this.intense ? i % 4 === 0 : i % 16 === 0) this.kick(ctx, time);
  }

  private note(ctx: AudioContext, f: number, time: number, dur: number, type: OscillatorType, vol: number): void {
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = type;
    osc.frequency.value = f;
    g.gain.setValueAtTime(0.0001, time);
    g.gain.exponentialRampToValueAtTime(vol, time + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    osc.connect(g).connect(this.gain!);
    osc.start(time);
    osc.stop(time + dur + 0.05);
  }

  private kick(ctx: AudioContext, time: number): void {
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.frequency.setValueAtTime(120, time);
    osc.frequency.exponentialRampToValueAtTime(45, time + 0.12);
    g.gain.setValueAtTime(0.12, time);
    g.gain.exponentialRampToValueAtTime(0.0001, time + 0.15);
    osc.connect(g).connect(this.gain!);
    osc.start(time);
    osc.stop(time + 0.2);
  }
}
