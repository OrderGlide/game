import type { PlotId, Res } from './data';

const pl = {
  plot: {
    market: 'Targ', bridgeAB: 'Most', hut: 'Chata drwali', sawmill: 'Tartak', bridgeBC: 'Most',
    lighthouse: 'Latarnia', upCap: 'Plecak', upSpeed: 'Buty', upHarvest: 'Siekiera', upHire: 'Zatrudnij',
  } as Record<PlotId, string>,
  res: { wood: 'drewno', stone: 'kamień', plank: 'deski', gold: 'złoto' } as Record<Res, string>,
  collect: 'Zbierz: {r}',
  build: 'Zbuduj: {b}',
  upgrade: 'Ulepsz: {b}',
  hire: 'Zatrudnij pracownika',
  sell: 'Sprzedaj surowce na targu',
  takeCash: 'Odbierz monety',
  feedSaw: 'Wrzuć drewno do tartaku',
  takePlanks: 'Odbierz deski z tartaku',
  full: 'MAX',
  lvl: 'Poz.',
  welcome: 'Witaj z powrotem!',
  win: 'Wyspa ukończona!',
  winSub: 'Latarnia świeci. Dotknij, aby grać dalej',
  explore: 'Rozbudowuj i ulepszaj!',
  built: 'Zbudowano!',
};

type Dict = typeof pl;

const en: Dict = {
  plot: {
    market: 'Market', bridgeAB: 'Bridge', hut: 'Lumber hut', sawmill: 'Sawmill', bridgeBC: 'Bridge',
    lighthouse: 'Lighthouse', upCap: 'Backpack', upSpeed: 'Boots', upHarvest: 'Axe', upHire: 'Hire',
  },
  res: { wood: 'wood', stone: 'stone', plank: 'planks', gold: 'gold' },
  collect: 'Collect: {r}',
  build: 'Build: {b}',
  upgrade: 'Upgrade: {b}',
  hire: 'Hire a worker',
  sell: 'Sell resources at the market',
  takeCash: 'Pick up your coins',
  feedSaw: 'Put wood into the sawmill',
  takePlanks: 'Pick up planks',
  full: 'MAX',
  lvl: 'Lv',
  welcome: 'Welcome back!',
  win: 'Island complete!',
  winSub: 'The lighthouse shines. Tap to keep playing',
  explore: 'Keep building and upgrading!',
  built: 'Built!',
};

const lang = (navigator.language || 'en').toLowerCase().startsWith('pl') ? 'pl' : 'en';
export const T: Dict = lang === 'pl' ? pl : en;

export function fmt(s: string, vars: Record<string, string | number>): string {
  return s.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ''));
}
