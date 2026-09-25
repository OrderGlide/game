// Static game data: camp layout, costs and balancing. World units ≈ meters.
// Axes: x → right, z → toward the camera (down on screen), y → up.

export interface Box { x: number; z: number; w: number; d: number; } // center-based, w along x, d along z
export interface Pt { x: number; z: number; }

/** Inner camp area; the palisade runs along its border. */
export const CAMP = { half: 8.5 };

export const GATES = {
  north: { x: -4.5, z: -CAMP.half, half: 1.6 }, // to the forest
  east: { x: CAMP.half, z: 0, half: 1.6 }, // to the snowfield (bears)
};

/** Serving counter built into the south palisade; survivors queue outside it. */
export const COUNTER: Box = { x: -3, z: CAMP.half, w: 4, d: 1.1 };
export const DEPOSIT_ZONE: Box = { x: -3, z: 6.9, w: 3.8, d: 1.9 };
export const CASH_ZONE: Box = { x: -6.4, z: 6.5, w: 2.2, d: 2.2 };
export const COUNTER_MAX = 40;

export const QUEUE = { x: -3, z: 9.8, gap: 1.25, size: 8, spawnZ: 26, pricePerLog: 5 };

export const FOREST: Box = { x: -10, z: -20, w: 28, d: 18 }; // x -24..4, z -29..-11
export const TREE = { hp: 2, respawn: 14, spacing: 2.3 };

export const WORLD = { minX: -26, maxX: 32, minZ: -31, maxZ: 24 };

export const PLAYER = {
  start: { x: -2, z: 3 },
  radius: 0.45,
  speed: (lvl: number) => 6 + 0.6 * lvl,
  capacity: (lvl: number) => 8 + 4 * lvl,
  chopInterval: (axes: number) => 0.5 * 0.85 ** (axes - 1),
  axeReach: 2.1,
  axeDps: (axes: number) => 16 * axes,
};

export const WORKER = { carry: 4, speed: 3.6, chopTime: 0.9 };

export const BEAR = {
  speed: 2.3,
  hp: (wave: number) => Math.round(35 * 1.08 ** (wave - 1)),
  count: (wave: number) => 2 + Math.floor((wave - 1) * 0.6),
  wallDamage: 4,
  attackEvery: 1.5,
  aggro: 7,
  reward: (wave: number) => 5 + 2 * wave,
};

export const wallMax = (level: number) => 100 + 60 * level;
export const FIRST_WAVE_IN = 90;
export const WAVE_GAP = 60;

export const TOWER = { range: 14.5, every: 1.2, damage: 14, boltSpeed: 28 };

export type PadId = 'tower1' | 'tower2' | 'tower3' | 'tower4' | 'axe' | 'bag' | 'boots' | 'worker' | 'power' | 'wall';
export type PadIcon = 'tower' | 'axe' | 'bag' | 'boots' | 'worker' | 'power' | 'wall';

export interface PadDef {
  id: PadId; x: number; z: number; icon: PadIcon;
  /** Pads needing all of these bought at least once before they appear. */
  requires: PadId[];
  max: number;
  cost: (level: number) => number;
}

export const PADS: PadDef[] = [
  { id: 'tower1', x: 5.6, z: -5.2, icon: 'tower', requires: [], max: 1, cost: () => 20 },
  { id: 'axe', x: 2.8, z: 1.2, icon: 'axe', requires: ['tower1'], max: 3, cost: (l) => Math.round(60 * 2.4 ** l) },
  { id: 'tower2', x: 5.6, z: 3.8, icon: 'tower', requires: ['tower1'], max: 1, cost: () => 120 },
  { id: 'bag', x: 0.3, z: -3, icon: 'bag', requires: ['tower1'], max: 8, cost: (l) => Math.round(40 * 1.7 ** l) },
  { id: 'worker', x: -6.4, z: 1.5, icon: 'worker', requires: ['tower2'], max: 3, cost: (l) => Math.round(180 * 2.2 ** l) },
  { id: 'wall', x: 0.1, z: 0.8, icon: 'wall', requires: ['tower2'], max: 8, cost: (l) => Math.round(120 * 1.7 ** l) },
  { id: 'boots', x: 2.8, z: -3, icon: 'boots', requires: ['tower2'], max: 8, cost: (l) => Math.round(60 * 1.7 ** l) },
  { id: 'tower3', x: 1.5, z: -6.3, icon: 'tower', requires: ['tower2', 'axe'], max: 1, cost: () => 400 },
  { id: 'power', x: 0.3, z: 3.6, icon: 'power', requires: ['tower3'], max: 6, cost: (l) => Math.round(250 * 1.8 ** l) },
  { id: 'tower4', x: 5.6, z: 6.6, icon: 'tower', requires: ['tower3'], max: 1, cost: () => 900 },
];

/** Order the guide arrow suggests first purchases in. */
export const PAD_ORDER: PadId[] = ['tower1', 'axe', 'tower2', 'bag', 'worker', 'wall', 'tower3', 'boots', 'power', 'tower4'];

export const PAD_SIZE = 2.3;

export function inBox(x: number, z: number, b: Box, pad = 0): boolean {
  return Math.abs(x - b.x) <= b.w / 2 + pad && Math.abs(z - b.z) <= b.d / 2 + pad;
}

export function inCamp(x: number, z: number): boolean {
  return Math.abs(x) < CAMP.half && Math.abs(z) < CAMP.half;
}

/** Palisade pieces as boxes, with openings for the gates and the counter. */
export function fenceBoxes(): Box[] {
  const h = CAMP.half, t = 0.7, out: Box[] = [];
  const seg = (a: number, b: number, fixed: number, horiz: boolean) => {
    if (b - a <= 0) return;
    out.push(horiz ? { x: (a + b) / 2, z: fixed, w: b - a, d: t } : { x: fixed, z: (a + b) / 2, w: t, d: b - a });
  };
  const n = GATES.north, e = GATES.east;
  seg(-h, n.x - n.half, -h, true);
  seg(n.x + n.half, h, -h, true);
  seg(-h, COUNTER.x - COUNTER.w / 2, h, true);
  seg(COUNTER.x + COUNTER.w / 2, h, h, true);
  seg(-h, h, -h, false);
  seg(-h, e.z - e.half, h, false);
  seg(e.z + e.half, h, h, false);
  return out;
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
