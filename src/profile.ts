// Persistent player profile: everything that survives travelling between worlds.
import {
  DAILY, GEMS, QUEST_POOL, SKINS, UPGRADES, dayKey, mulberry32,
  type BoostId, type Gems, type Levels, type Price, type QuestKind, type SkinId,
} from './data';

export interface Quest { kind: QuestKind; target: number; progress: number; reward: Price; claimed: boolean; }

export interface ProfileData {
  v: 3;
  world: number;
  gems: Gems;
  levels: Levels;
  skins: SkinId[];
  skin: SkinId;
  daily: { last: string; streak: number };
  quests: { day: string; list: Quest[] };
  /** Boost expiry times (ms since epoch). */
  boosts: Record<Exclude<BoostId, 'repair'>, number>;
  freeChestAt: number;
  stats: { bestWave: number; worldsDone: number; kills: number };
}

export function newProfile(): ProfileData {
  const levels = Object.fromEntries(UPGRADES.map((u) => [u.id, 0])) as Levels;
  return {
    v: 3, world: 0, gems: { em: 0, di: 0, ob: 0 }, levels, skins: ['blue'], skin: 'blue',
    daily: { last: '', streak: 0 }, quests: { day: '', list: [] },
    boosts: { cash: 0, speed: 0, chop: 0 }, freeChestAt: 0,
    stats: { bestWave: 0, worldsDone: 0, kills: 0 },
  };
}

/** Fill in anything missing from an older or partial save. */
export function normalizeProfile(p: Partial<ProfileData>): ProfileData {
  const d = newProfile();
  return {
    ...d, ...p,
    gems: { ...d.gems, ...p.gems },
    levels: { ...d.levels, ...p.levels },
    daily: { ...d.daily, ...p.daily },
    quests: p.quests ?? d.quests,
    boosts: { ...d.boosts, ...p.boosts },
    stats: { ...d.stats, ...p.stats },
    skins: p.skins?.length ? p.skins : d.skins,
  };
}

export function hasGems(p: ProfileData, price: Price): boolean {
  return GEMS.every((g) => p.gems[g] >= (price[g] ?? 0));
}

export function addGems(p: ProfileData, price: Price, mult = 1): void {
  for (const g of GEMS) p.gems[g] += Math.round((price[g] ?? 0) * mult);
}

export function spendGems(p: ProfileData, price: Price): void {
  for (const g of GEMS) p.gems[g] -= price[g] ?? 0;
}

// ---------- daily login reward ----------

function yesterdayKey(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return dayKey(d);
}

export function dailyAvailable(p: ProfileData): boolean { return p.daily.last !== dayKey(); }

/** Index (0..6) of the reward the player gets today; a missed day restarts the streak. */
export function dailyIndex(p: ProfileData): number {
  if (!dailyAvailable(p)) return (p.daily.streak - 1 + 7) % 7;
  return p.daily.last === yesterdayKey() ? p.daily.streak % 7 : 0;
}

// ---------- daily quests ----------

export function ensureQuests(p: ProfileData, priceMult: number): void {
  const today = dayKey();
  if (p.quests.day === today && p.quests.list.length) return;
  let seed = 0;
  for (const ch of today) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
  const rnd = mulberry32(seed);
  const pool = [...QUEST_POOL];
  const list: Quest[] = [];
  while (list.length < 3 && pool.length) {
    const q = pool.splice(Math.floor(rnd() * pool.length), 1)[0];
    const target = q.kind === 'earn' ? Math.round(q.target * priceMult) : q.target;
    list.push({ kind: q.kind, target, progress: 0, reward: q.reward, claimed: false });
  }
  p.quests = { day: today, list };
}

export function questProgress(p: ProfileData, kind: QuestKind, n: number): void {
  for (const q of p.quests.list) if (q.kind === kind && !q.claimed) q.progress = Math.min(q.target, q.progress + n);
}

export const skinDef = (id: SkinId) => SKINS.find((s) => s.id === id) ?? SKINS[0];
export const DAILY_REWARDS = DAILY;
