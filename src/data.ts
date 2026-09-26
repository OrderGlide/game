// Static game data: layout, costs and balancing. World units ≈ meters.
// Axes: x → right, z → toward the camera (down on screen), y → up.

export interface Box { x: number; z: number; w: number; d: number; } // center-based, w along x, d along z
export interface Pt { x: number; z: number; }

export type Gem = 'em' | 'di' | 'ob';
export const GEMS: Gem[] = ['em', 'di', 'ob'];
export type Gems = Record<Gem, number>;
/** A price in cash and/or gems. */
export interface Price { cash?: number; em?: number; di?: number; ob?: number; }

// ---------- layout: camp in the middle, fenced forest (north) and mine (west) ----------

export const CAMP = { half: 8.5 };
export const FOREST_PEN = { x0: -8.5, x1: 8.5, z0: -25, z1: -8.5 };
export const MINE_PEN = { x0: -24, x1: -8.5, z0: -8.5, z1: 8.5 };

export type Region = 'camp' | 'forest' | 'mine' | 'out';
export function regionOf(x: number, z: number): Region {
  const h = CAMP.half;
  if (Math.abs(x) < h && Math.abs(z) < h) return 'camp';
  if (x > FOREST_PEN.x0 && x < FOREST_PEN.x1 && z > FOREST_PEN.z0 && z < FOREST_PEN.z1) return 'forest';
  if (x > MINE_PEN.x0 && x < MINE_PEN.x1 && z > MINE_PEN.z0 && z < MINE_PEN.z1) return 'mine';
  return 'out';
}

export interface Gate { x: number; z: number; alongX: boolean; half: number; camp: Pt; other: Pt; }
/** Every region connects to the camp through one gate. */
export const GATES: Record<Exclude<Region, 'camp'>, Gate> = {
  forest: { x: 0, z: -CAMP.half, alongX: true, half: 1.6, camp: { x: 0, z: -CAMP.half + 1.4 }, other: { x: 0, z: -CAMP.half - 1.6 } },
  mine: { x: -CAMP.half, z: 0, alongX: false, half: 1.6, camp: { x: -CAMP.half + 1.4, z: 0 }, other: { x: -CAMP.half - 1.6, z: 0 } },
  out: { x: CAMP.half, z: 0, alongX: false, half: 1.6, camp: { x: CAMP.half - 1.4, z: 0 }, other: { x: CAMP.half + 1.6, z: 0 } },
};

/** Serving counter built into the south palisade; survivors queue outside it. */
export const COUNTER: Box = { x: -3, z: CAMP.half, w: 4, d: 1.1 };
export const DEPOSIT_ZONE: Box = { x: -3, z: 6.9, w: 3.8, d: 1.9 };
export const CASH_ZONE: Box = { x: -6.4, z: 6.5, w: 2.2, d: 2.2 };
export const FORGE_ZONE: Box = { x: -6.2, z: -6.2, w: 2.2, d: 2.2 };
export const CAMPFIRE: Pt = { x: 1.6, z: 5.6 };
export const COUNTER_MAX = 40;

export const QUEUE = { x: -3, z: 9.8, gap: 1.25, size: 8, spawnZ: 26, pricePerLog: 5 };

export const TREE = { hp: 2, respawn: 12, spacing: 2.25 };
export const WORLD = { minX: -30, maxX: 34, minZ: -31, maxZ: 26 };

export const PLAYER = { start: { x: 0, z: 3 }, radius: 0.45, axeReach: 2.1, mineReach: 1.9 };
export const WORKER = { carry: 4, speed: 3.6, chopTime: 0.9, mineTime: 1.1 };

// ---------- ores ----------

export interface OreInfo { hp: number; respawn: number; yield: number; pickLevel: number; }
export const ORES: Record<Gem, OreInfo> = {
  em: { hp: 4, respawn: 26, yield: 1, pickLevel: 1 },
  di: { hp: 6, respawn: 32, yield: 1, pickLevel: 3 },
  ob: { hp: 9, respawn: 45, yield: 1, pickLevel: 6 },
};

// ---------- enemies ----------

/** The first six roam the worlds on difficulty 1; the other six replace them on difficulty 2. */
export type EnemyKind = 'bear' | 'scorpion' | 'gorilla' | 'croc' | 'golem' | 'spider'
  | 'yeti' | 'hyena' | 'panther' | 'troll' | 'salamander' | 'shardback';
export const ENEMIES: Record<EnemyKind, { hp: number; speed: number; wallDamage: number; attackEvery: number }> = {
  bear: { hp: 35, speed: 2.3, wallDamage: 4, attackEvery: 1.5 },
  scorpion: { hp: 30, speed: 2.9, wallDamage: 3, attackEvery: 1.1 },
  gorilla: { hp: 45, speed: 2.4, wallDamage: 5, attackEvery: 1.4 },
  croc: { hp: 40, speed: 2.0, wallDamage: 5, attackEvery: 1.3 },
  golem: { hp: 55, speed: 1.7, wallDamage: 7, attackEvery: 1.9 },
  spider: { hp: 32, speed: 3.2, wallDamage: 4, attackEvery: 1.0 },
  yeti: { hp: 42, speed: 2.3, wallDamage: 5, attackEvery: 1.4 },
  hyena: { hp: 26, speed: 3.3, wallDamage: 3, attackEvery: 0.9 },
  panther: { hp: 30, speed: 3.5, wallDamage: 4, attackEvery: 0.9 },
  troll: { hp: 46, speed: 1.9, wallDamage: 6, attackEvery: 1.6 },
  salamander: { hp: 42, speed: 2.4, wallDamage: 5, attackEvery: 1.2 },
  shardback: { hp: 36, speed: 3.0, wallDamage: 5, attackEvery: 1.0 },
};
/** Colour schemes creatures wear from difficulty 3 on. */
export type Tint = 'shadow' | 'blood' | 'frost';
export const TINTS: Tint[] = ['shadow', 'blood', 'frost'];
/** Fast runners and armoured brutes mix into later waves. */
export type Variant = 'normal' | 'fast' | 'tank';
export const VARIANTS: Record<Variant, { hp: number; speed: number; damage: number; scale: number; reward: number }> = {
  normal: { hp: 1, speed: 1, damage: 1, scale: 1, reward: 1 },
  fast: { hp: 0.5, speed: 1.8, damage: 0.7, scale: 0.8, reward: 0.8 },
  tank: { hp: 3.2, speed: 0.72, damage: 2.4, scale: 1.4, reward: 2.5 },
};
export const WAVES = {
  firstIn: 90,
  gap: 55,
  count: (wave: number) => 2 + Math.floor((wave - 1) * 0.7),
  hp: (wave: number) => 1.13 ** (wave - 1),
  /** Share of fast / tank creatures in a wave. */
  mix: (wave: number) => ({
    fast: wave >= 4 ? Math.min(0.35, 0.12 + (wave - 4) * 0.03) : 0,
    tank: wave >= 7 ? Math.min(0.3, 0.1 + (wave - 7) * 0.025) : 0,
  }),
  bossEvery: 10,
  aggro: 7,
  reward: (wave: number) => 5 + 2 * wave,
  /** Waves stop counting down after this many seconds without touching the screen. */
  idlePause: 25,
  /** A creature that breaks in grabs this share of your cash and runs; catch it to get the cash back. */
  steal: 0.06,
};
/** Bosses wait until the player summons them, then fight in phases. */
export const BOSS = {
  hp: 34, damage: 3, speed: 0.75,
  /** Seconds before an undefeated boss retreats. */
  timeLimit: 120,
  /** Shield in % of max hp; only the player's axes break it, towers deal a fraction meanwhile. */
  shield: 0.1, shieldAxeMult: 3, shieldedTowerMult: 0.15, stun: 7, stunnedTowerMult: 1.5,
  /** The boss brings only part of a normal wave with it. */
  escort: 0.5,
  slamEvery: 6.5, slamWarn: 1.1, slamRadius: 3.8, slamStun: 1.4,
  summonAt: [0.66, 0.33], summonCount: 3,
  enrageAt: 0.3,
};
/** Bosses on higher difficulties bring bigger shields, more helpers, faster slams and a tower-stunning roar. */
export function bossStats(cycle: number) {
  return {
    shield: Math.min(0.22, BOSS.shield + 0.03 * cycle),
    summonCount: Math.min(6, BOSS.summonCount + cycle),
    slamEvery: BOSS.slamEvery * Math.max(0.6, 1 - 0.12 * cycle),
    slamRadius: BOSS.slamRadius + Math.min(1.2, 0.3 * cycle),
    enrageAt: Math.min(0.45, BOSS.enrageAt + 0.05 * cycle),
    /** Seconds between roars that stop all towers for `roarStun` s (0 = never). */
    roarEvery: cycle >= 1 ? Math.max(9, 16 - 2 * cycle) : 0,
    roarStun: 2.5,
  };
}
export const wallMax = (level: number) => 150 + 70 * level;
export const TOWER = { range: 14.5, every: 1.2, damage: 14 };
/** Each Armory level adds tower damage and makes every tower look sturdier. */
export const ARMORY_BONUS = 0.3;
export const towerTier = (armory: number) => Math.min(4, Math.floor(armory / 2));
export const wallTier = (wall: number) => (wall < 2 ? 0 : wall < 4 ? 1 : wall < 7 ? 2 : 3);

export type TowerKind = 'crossbow' | 'ice' | 'fire' | 'cannon';
/** Special towers: damage is a multiple of the crossbow's; ice slows, fire burns, cannon hits an area. */
export const TOWER_KINDS: Record<TowerKind, { every: number; damage: number; slow?: number; burn?: number; splash?: number }> = {
  crossbow: { every: 1.2, damage: 1 },
  ice: { every: 1.0, damage: 0.4, slow: 2 },
  fire: { every: 0.9, damage: 0.5, burn: 3 },
  cannon: { every: 2.6, damage: 3.5, splash: 2.4 },
};

// ---------- worlds ----------

export type WorldId = 'winter' | 'desert' | 'jungle' | 'swamp' | 'volcano' | 'crystal';
export type TreeKind = 'pine' | 'palm' | 'jungle' | 'willow' | 'charred' | 'crystal';
export type SurvivorKind = 'santa' | 'nomad' | 'explorer' | 'fisher' | 'miner' | 'wizard';
export interface WorldDef {
  id: WorldId;
  enemy: EnemyKind;
  /** Creature that takes over on difficulty 2. */
  enemy2: EnemyKind;
  tree: TreeKind;
  survivor: SurvivorKind;
  /** Chance of each ore type in the mine. */
  ores: Gems;
  priceMult: number;
  hpMult: number;
  towerMult: number;
  portal: Price;
  bossGems: Price;
}

export const WORLDS: WorldDef[] = [
  {
    id: 'winter', enemy: 'bear', enemy2: 'yeti', tree: 'pine', survivor: 'santa', ores: { em: 0.72, di: 0.23, ob: 0.05 },
    priceMult: 1, hpMult: 1, towerMult: 1, portal: { cash: 1500, em: 25, di: 6 }, bossGems: { em: 12, di: 3 },
  },
  {
    id: 'desert', enemy: 'scorpion', enemy2: 'hyena', tree: 'palm', survivor: 'nomad', ores: { em: 0.5, di: 0.38, ob: 0.12 },
    priceMult: 3, hpMult: 2.5, towerMult: 2, portal: { cash: 4500, em: 30, di: 15, ob: 3 }, bossGems: { em: 15, di: 6, ob: 1 },
  },
  {
    id: 'jungle', enemy: 'gorilla', enemy2: 'panther', tree: 'jungle', survivor: 'explorer', ores: { em: 0.42, di: 0.42, ob: 0.16 },
    priceMult: 8, hpMult: 6.5, towerMult: 4, portal: { cash: 12000, em: 35, di: 22, ob: 6 }, bossGems: { em: 18, di: 8, ob: 2 },
  },
  {
    id: 'swamp', enemy: 'croc', enemy2: 'troll', tree: 'willow', survivor: 'fisher', ores: { em: 0.35, di: 0.42, ob: 0.23 },
    priceMult: 20, hpMult: 18, towerMult: 8, portal: { cash: 30000, em: 40, di: 28, ob: 10 }, bossGems: { em: 20, di: 10, ob: 4 },
  },
  {
    id: 'volcano', enemy: 'golem', enemy2: 'salamander', tree: 'charred', survivor: 'miner', ores: { em: 0.25, di: 0.37, ob: 0.38 },
    priceMult: 50, hpMult: 42, towerMult: 16, portal: { cash: 75000, di: 32, ob: 18 }, bossGems: { di: 12, ob: 6 },
  },
  {
    id: 'crystal', enemy: 'spider', enemy2: 'shardback', tree: 'crystal', survivor: 'wizard', ores: { em: 0.25, di: 0.35, ob: 0.4 },
    priceMult: 120, hpMult: 100, towerMult: 32, portal: { cash: 180000, em: 50, di: 40, ob: 30 }, bossGems: { em: 25, di: 15, ob: 10 },
  },
];

export interface WorldInfo {
  n: number; def: WorldDef; cycle: number; priceMult: number; hpMult: number; towerMult: number;
  /** Creature of this world at this difficulty, and its colour scheme (difficulty 3+). */
  enemy: EnemyKind; tint: Tint | null;
}
/**
 * World number n (0-based) cycles through the 6 themes, each cycle (difficulty) harder than the last:
 * difficulty 2 brings new creatures, from difficulty 3 old and new ones alternate in new colours.
 */
export function worldAt(n: number): WorldInfo {
  const def = WORLDS[n % WORLDS.length];
  const cycle = Math.floor(n / WORLDS.length);
  return {
    n, def, cycle,
    enemy: cycle % 2 === 1 ? def.enemy2 : def.enemy,
    tint: cycle >= 2 ? TINTS[(cycle - 2) % TINTS.length] : null,
    priceMult: def.priceMult * 200 ** cycle,
    hpMult: def.hpMult * 100 ** cycle,
    towerMult: def.towerMult * 70 ** cycle,
  };
}

// ---------- build pads (cash, per world) ----------

export type PadId = 'tower1' | 'tower2' | 'tower3' | 'tower4' | 'lumber' | 'miner' | 'wall' | 'portal' | 'tent' | 'ice' | 'fire' | 'cannon' | 'armory';
export type PadIcon = 'tower' | 'lumber' | 'miner' | 'wall' | 'portal' | 'tent' | 'ice' | 'fire' | 'cannon' | 'armory';

export interface PadDef {
  id: PadId; x: number; z: number; icon: PadIcon;
  /** Pads needing all of these bought at least once before they appear ('boss' = world boss beaten). */
  requires: (PadId | 'boss')[];
  max: number;
  /** Cash cost before the world's price multiplier. */
  cost: (level: number) => number;
}

export const PADS: PadDef[] = [
  { id: 'tower1', x: 5.6, z: -5.2, icon: 'tower', requires: [], max: 1, cost: () => 20 },
  { id: 'tower2', x: 5.6, z: 3.8, icon: 'tower', requires: ['tower1'], max: 1, cost: () => 120 },
  { id: 'lumber', x: -2.8, z: -5.4, icon: 'lumber', requires: ['tower2'], max: 3, cost: (l) => Math.round(180 * 2.2 ** l) },
  { id: 'wall', x: 2.6, z: 1.2, icon: 'wall', requires: ['tower2'], max: 8, cost: (l) => Math.round(120 * 1.7 ** l) },
  { id: 'miner', x: -6.2, z: -2.6, icon: 'miner', requires: ['tower2'], max: 2, cost: (l) => Math.round(300 * 2.5 ** l) },
  { id: 'tower3', x: 3.4, z: -6.4, icon: 'tower', requires: ['tower2'], max: 1, cost: () => 400 },
  { id: 'tower4', x: 5.6, z: 6.6, icon: 'tower', requires: ['tower3'], max: 1, cost: () => 900 },
  { id: 'portal', x: -1.6, z: 1.4, icon: 'portal', requires: ['boss'], max: 1, cost: () => 0 },
  { id: 'tent', x: -6.3, z: 3.3, icon: 'tent', requires: ['tower2'], max: 3, cost: (l) => Math.round(250 * 2.2 ** l) },
  { id: 'ice', x: 11.3, z: 9.6, icon: 'ice', requires: ['tower2'], max: 1, cost: () => 600 },
  { id: 'fire', x: 6.3, z: -2.7, icon: 'fire', requires: ['tower4'], max: 1, cost: () => 1500 },
  { id: 'cannon', x: 11.3, z: -9.6, icon: 'cannon', requires: ['tower3'], max: 1, cost: () => 2500 },
  { id: 'armory', x: 2.2, z: -2.6, icon: 'armory', requires: ['tower2'], max: 8, cost: (l) => Math.round(250 * 2.05 ** l) },
];
export const PAD_ORDER: PadId[] = ['tower1', 'tower2', 'wall', 'lumber', 'armory', 'tent', 'miner', 'tower3', 'portal', 'ice', 'tower4', 'fire', 'cannon'];
export const TOWER_PADS: Partial<Record<PadId, TowerKind>> = {
  tower1: 'crossbow', tower2: 'crossbow', tower3: 'crossbow', tower4: 'crossbow', ice: 'ice', fire: 'fire', cannon: 'cannon',
};
/** Each tent brings more survivors who pay more for wood. */
export const TENT_BONUS = 0.25;
export const TENT_SPOTS: Pt[] = [{ x: -9.5, z: 11.5 }, { x: -12.5, z: 13.5 }, { x: -9.8, z: 15.5 }];
export const PAD_SIZE = 2.3;

// ---------- upgrades (Forge menu, persist across worlds) ----------

export type UpgradeId = 'bag' | 'axe' | 'axes' | 'pick' | 'boots' | 'power';
export interface UpgradeDef { id: UpgradeId; icon: string; max: number; cost: (level: number) => Price; }

const gemIf = (cond: boolean, n: number) => (cond ? Math.max(1, Math.round(n)) : 0);
export const UPGRADES: UpgradeDef[] = [
  {
    id: 'bag', icon: '🎒', max: 15,
    cost: (l) => ({ cash: Math.round(40 * 1.55 ** l), em: gemIf(l >= 3, 2 * (l - 2)), di: gemIf(l >= 9, l - 8) }),
  },
  {
    id: 'axe', icon: '🪓', max: 9,
    cost: (l) => ({ cash: Math.round(60 * 1.85 ** l), em: gemIf(l >= 1, 3 * l), di: gemIf(l >= 4, 2 * (l - 3)), ob: gemIf(l >= 7, 2 * (l - 6)) }),
  },
  {
    id: 'axes', icon: '🌀', max: 3,
    cost: (l) => ({ cash: Math.round(150 * 3 ** l), em: 8 * (l + 1), di: gemIf(l >= 2, 5) }),
  },
  {
    id: 'pick', icon: '⛏️', max: 9,
    cost: (l) => ({ cash: Math.round(80 * 1.8 ** l), em: 4 * (l + 1), di: gemIf(l >= 3, 2 * (l - 2)), ob: gemIf(l >= 6, l - 5) }),
  },
  {
    id: 'boots', icon: '👢', max: 10,
    cost: (l) => ({ cash: Math.round(50 * 1.6 ** l), em: gemIf(l >= 4, l - 3) }),
  },
  {
    id: 'power', icon: '🏹', max: 12,
    cost: (l) => ({ cash: Math.round(150 * 1.75 ** l), em: gemIf(l >= 1, 2 * l), di: gemIf(l >= 4, l - 3), ob: gemIf(l >= 8, l - 7) }),
  },
];

export type Levels = Record<UpgradeId, number>;
export const STATS = {
  capacity: (u: Levels) => 8 + 4 * u.bag,
  chopInterval: (u: Levels) => 0.5 * 0.88 ** u.axe,
  axeCount: (u: Levels) => 1 + u.axes,
  axeDps: (u: Levels) => 14 * (1 + 0.35 * u.axe) * (1 + u.axes),
  pickLevel: (u: Levels) => 1 + u.pick,
  mineInterval: (u: Levels) => 0.55 * 0.9 ** u.pick,
  speed: (u: Levels) => 6 + 0.5 * u.boots,
  towerMult: (u: Levels) => 1.2 ** u.power,
};

/** Tool tier colours: wood → stone → iron → gold → diamond → emerald → ruby → amethyst → obsidian → star. */
export const TOOL_TIERS = [0xa0703c, 0x8c9096, 0xd0d6de, 0xffcf3f, 0x5fe0ff, 0x2ee87a, 0xff4d6d, 0x9b5cff, 0x2a1840, 0xffffff];

// ---------- shop ----------

export type PetId = 'fox' | 'owl' | 'dragon';
/** Pets follow the player: fox speeds up chopping/mining, owl collects cash, dragon breathes fire at monsters. */
export const PETS: { id: PetId; price: Price }[] = [
  { id: 'fox', price: { em: 40 } },
  { id: 'owl', price: { di: 15 } },
  { id: 'dragon', price: { ob: 20 } },
];

export type SkinId = 'blue' | 'red' | 'green' | 'pink' | 'ice' | 'gold' | 'obsidian';
export const SKINS: { id: SkinId; color: number; trim: number; price: Price }[] = [
  { id: 'blue', color: 0x2f8cf0, trim: 0xffffff, price: {} },
  { id: 'red', color: 0xe8453c, trim: 0xffffff, price: { em: 25 } },
  { id: 'green', color: 0x2fb45a, trim: 0xfff4d6, price: { em: 25 } },
  { id: 'pink', color: 0xff6fb5, trim: 0xffffff, price: { em: 35 } },
  { id: 'ice', color: 0x9fe6ff, trim: 0xffffff, price: { di: 12 } },
  { id: 'gold', color: 0xf5b82e, trim: 0xfff1b0, price: { di: 25 } },
  { id: 'obsidian', color: 0x2a1840, trim: 0xb07cff, price: { ob: 15 } },
];

export type BoostId = 'cash' | 'speed' | 'chop' | 'repair';
export const BOOSTS: { id: BoostId; icon: string; price: Price; seconds: number }[] = [
  { id: 'cash', icon: '💵', price: { em: 8 }, seconds: 300 },
  { id: 'speed', icon: '⚡', price: { em: 6 }, seconds: 300 },
  { id: 'chop', icon: '🪓', price: { di: 4 }, seconds: 300 },
  { id: 'repair', icon: '🧱', price: { di: 3 }, seconds: 0 },
];

// The paid chest has a fixed reward on purpose: a purchase with a randomised reward counts as a
// loot box for IARC and lands the game at 18+ in Brazil and Australia.
export const CHEST = {
  price: { em: 20 } as Price,
  reward: { em: 14, di: 4, ob: 1 } as Price,
  freeEvery: 4 * 3600 * 1000,
};

// ---------- daily rewards & quests ----------

export type Reward = Price & { boost?: BoostId; skin?: SkinId };
/** 7-day login streak; cash is multiplied by the current world's prices. */
export const DAILY: Reward[] = [
  { cash: 200 }, { em: 8 }, { boost: 'cash' }, { di: 4 }, { cash: 1000 }, { ob: 3 }, { skin: 'gold', di: 15 },
];

export type QuestKind = 'chop' | 'serve' | 'kill' | 'mine' | 'earn' | 'waves';
export const QUEST_POOL: { kind: QuestKind; target: number; reward: Price }[] = [
  { kind: 'chop', target: 60, reward: { em: 6 } },
  { kind: 'serve', target: 15, reward: { em: 6 } },
  { kind: 'kill', target: 12, reward: { em: 8 } },
  { kind: 'mine', target: 10, reward: { di: 2 } },
  { kind: 'earn', target: 400, reward: { em: 5 } },
  { kind: 'waves', target: 3, reward: { di: 3 } },
];

// ---------- helpers ----------

export function inBox(x: number, z: number, b: Box, pad = 0): boolean {
  return Math.abs(x - b.x) <= b.w / 2 + pad && Math.abs(z - b.z) <= b.d / 2 + pad;
}

/** All palisade pieces as boxes, with openings for the gates and the counter. */
export function fenceBoxes(): Box[] {
  const h = CAMP.half, t = 0.7, out: Box[] = [];
  const horiz = (x0: number, x1: number, z: number) => { if (x1 > x0) out.push({ x: (x0 + x1) / 2, z, w: x1 - x0, d: t }); };
  const vert = (z0: number, z1: number, x: number) => { if (z1 > z0) out.push({ x, z: (z0 + z1) / 2, w: t, d: z1 - z0 }); };
  const g = GATES;
  // camp
  horiz(-h, g.forest.x - g.forest.half, -h);
  horiz(g.forest.x + g.forest.half, h, -h);
  horiz(-h, COUNTER.x - COUNTER.w / 2, h);
  horiz(COUNTER.x + COUNTER.w / 2, h, h);
  vert(-h, g.mine.z - g.mine.half, -h);
  vert(g.mine.z + g.mine.half, h, -h);
  vert(-h, g.out.z - g.out.half, h);
  vert(g.out.z + g.out.half, h, h);
  // forest pen
  vert(FOREST_PEN.z0, -h, FOREST_PEN.x0);
  vert(FOREST_PEN.z0, -h, FOREST_PEN.x1);
  horiz(FOREST_PEN.x0, FOREST_PEN.x1, FOREST_PEN.z0);
  // mine pen
  horiz(MINE_PEN.x0, -h, MINE_PEN.z0);
  horiz(MINE_PEN.x0, -h, MINE_PEN.z1);
  vert(MINE_PEN.z0, MINE_PEN.z1, MINE_PEN.x0);
  return out;
}

/** Rounds a price to a friendly amount: 396 → 400, 871 → 900, 1916 → 2000. */
export function nicePrice(n: number): number {
  if (n < 20) return Math.max(1, Math.round(n));
  const e = 10 ** Math.floor(Math.log10(n)), m = n / e;
  const steps = [1, 1.2, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 6, 7, 7.5, 8, 9, 10];
  let best = steps[0];
  for (const st of steps) if (Math.abs(st - m) < Math.abs(best - m)) best = st;
  return Math.round(best * e);
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

export function dayKey(d = new Date()): string {
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}
