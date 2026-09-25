// Static game data: world layout, resources, costs, balancing.

export type Res = 'wood' | 'stone' | 'plank' | 'gold';
export type CostKey = Res | 'coin';
export type Cost = Partial<Record<CostKey, number>>;

/** Center-based rectangle. */
export interface Rect { x: number; y: number; w: number; h: number; }

export const RESOURCES: Res[] = ['wood', 'stone', 'plank', 'gold'];
export const COST_KEYS: CostKey[] = ['wood', 'stone', 'plank', 'gold', 'coin'];

/** Coins paid by the market per item. */
export const RES_VALUE: Record<Res, number> = { wood: 2, stone: 3, plank: 6, gold: 15 };

export type NodeKind = 'tree' | 'rock' | 'gold';
export const NODE_INFO: Record<NodeKind, { res: Res; hp: number; respawn: number }> = {
  tree: { res: 'wood', hp: 3, respawn: 9 },
  rock: { res: 'stone', hp: 4, respawn: 12 },
  gold: { res: 'gold', hp: 3, respawn: 16 },
};

export type IslandId = 'A' | 'B' | 'C';
export const ISLANDS: (Rect & { id: IslandId; unlockedBy?: PlotId })[] = [
  { id: 'A', x: 0, y: 0, w: 800, h: 800 },
  { id: 'B', x: 920, y: 0, w: 800, h: 800, unlockedBy: 'bridgeAB' },
  { id: 'C', x: 920, y: 920, w: 800, h: 800, unlockedBy: 'bridgeBC' },
];

export const BRIDGES: (Rect & { id: PlotId })[] = [
  { id: 'bridgeAB', x: 460, y: 0, w: 180, h: 76 },
  { id: 'bridgeBC', x: 920, y: 460, w: 76, h: 180 },
];

export type PlotId =
  | 'market' | 'bridgeAB' | 'hut' | 'sawmill' | 'bridgeBC' | 'lighthouse'
  | 'upCap' | 'upSpeed' | 'upHarvest' | 'upHire';

export type UpgradeId = 'upCap' | 'upSpeed' | 'upHarvest' | 'upHire';

export interface PlotDef extends Rect {
  id: PlotId;
  requires: PlotId[];
  /** Fixed cost for buildings; upgrades compute cost from level. */
  cost?: Cost;
}

export const PLOTS: PlotDef[] = [
  { id: 'market', x: 270, y: 195, w: 130, h: 90, requires: [], cost: { wood: 10 } },
  { id: 'upCap', x: -130, y: 300, w: 86, h: 76, requires: ['market'] },
  { id: 'upSpeed', x: 0, y: 300, w: 86, h: 76, requires: ['market'] },
  { id: 'upHarvest', x: 130, y: 300, w: 86, h: 76, requires: ['market'] },
  { id: 'bridgeAB', x: 340, y: 0, w: 90, h: 100, requires: ['market'], cost: { wood: 20, coin: 30 } },
  { id: 'hut', x: -250, y: 215, w: 120, h: 90, requires: ['bridgeAB'], cost: { wood: 20, stone: 15, coin: 80 } },
  { id: 'upHire', x: -250, y: 320, w: 90, h: 64, requires: ['hut'] },
  { id: 'sawmill', x: 760, y: 110, w: 140, h: 90, requires: ['bridgeAB'], cost: { wood: 15, stone: 25, coin: 60 } },
  { id: 'bridgeBC', x: 920, y: 340, w: 90, h: 90, requires: ['sawmill'], cost: { stone: 30, plank: 15, coin: 150 } },
  { id: 'lighthouse', x: 760, y: 1070, w: 150, h: 150, requires: ['bridgeBC'], cost: { stone: 40, plank: 30, gold: 20, coin: 250 } },
];

/** Order in which the guide arrow walks the player through the game (upgrades: first purchase only). */
export const MAIN_ORDER: PlotId[] = ['market', 'upCap', 'bridgeAB', 'sawmill', 'hut', 'upHire', 'bridgeBC', 'lighthouse'];

export const UPGRADES: Record<UpgradeId, { max: number; cost: (lvl: number) => number }> = {
  upCap: { max: 12, cost: (l) => Math.round(20 * 1.55 ** l) },
  upSpeed: { max: 10, cost: (l) => Math.round(25 * 1.6 ** l) },
  upHarvest: { max: 10, cost: (l) => Math.round(25 * 1.6 ** l) },
  upHire: { max: 4, cost: (l) => Math.round(60 * 1.9 ** l) },
};

export const stats = {
  capacity: (lvl: number) => 10 + 5 * lvl,
  speed: (lvl: number) => 175 + 18 * lvl,
  harvestInterval: (lvl: number) => 0.42 * 0.87 ** lvl,
};

// Zones attached to buildings once they are built.
export const ZONES = {
  marketSell: { x: 235, y: 295, w: 70, h: 60 },
  marketCash: { x: 315, y: 295, w: 64, h: 60 },
  sawIn: { x: 705, y: 195, w: 74, h: 60 },
  sawOut: { x: 815, y: 195, w: 74, h: 60 },
} satisfies Record<string, Rect>;

export const SAW_IN_MAX = 30;
export const SAW_OUT_MAX = 40;
export const SAW_TIME = 1.1;

export const WORKER = { carry: 6, speed: 125, chopTime: 0.7 };

export const PLAYER_START = { x: 0, y: 170 };

/** Regions filled with resource nodes (seeded jittered grid). */
export const NODE_REGIONS: { kind: NodeKind; island: IslandId; rect: Rect; spacing: number }[] = [
  { kind: 'tree', island: 'A', rect: { x: -215, y: -130, w: 310, h: 500 }, spacing: 66 },
  { kind: 'tree', island: 'A', rect: { x: 175, y: -240, w: 300, h: 260 }, spacing: 66 },
  { kind: 'rock', island: 'B', rect: { x: 920, y: -230, w: 720, h: 280 }, spacing: 76 },
  { kind: 'tree', island: 'B', rect: { x: 1165, y: 235, w: 230, h: 270 }, spacing: 66 },
  { kind: 'rock', island: 'C', rect: { x: 700, y: 640, w: 320, h: 220 }, spacing: 76 },
  { kind: 'gold', island: 'C', rect: { x: 1150, y: 800, w: 240, h: 460 }, spacing: 80 },
  { kind: 'tree', island: 'C', rect: { x: 1110, y: 1205, w: 340, h: 170 }, spacing: 66 },
];

export function inRect(px: number, py: number, r: Rect, pad = 0): boolean {
  return Math.abs(px - r.x) <= r.w / 2 + pad && Math.abs(py - r.y) <= r.h / 2 + pad;
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
