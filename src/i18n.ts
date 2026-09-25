import type { PadId } from './data';

const pl = {
  pad: {
    tower1: 'Wieża z kuszą', tower2: 'Wieża z kuszą', tower3: 'Wieża z kuszą', tower4: 'Wieża z kuszą',
    axe: '+1 topór', bag: 'Większy stos', boots: 'Szybsze buty', worker: 'Drwal', power: 'Moc wież', wall: 'Mocniejsza palisada',
  } as Record<PadId, string>,
  chop: 'Zetnij drzewa w lesie',
  deliver: 'Zanieś drewno na ladę',
  takeCash: 'Zbierz pieniądze',
  buy: 'Kup: {b}',
  defend: 'Niedźwiedzie! Broń obozu',
  breach: 'Niedźwiedzie wdarły się do obozu!',
  free: 'Rozbudowuj obóz',
  full: 'MAX',
  wave: 'Fala {n}',
  waveIn: 'Fala {n} za {t}',
  bearsLeft: '🐻 {n}',
  wall: 'Palisada',
  welcome: 'Witaj z powrotem!',
  waveCleared: 'Fala odparta!',
  waveStart: 'Nadciągają niedźwiedzie!',
};

type Dict = typeof pl;

const en: Dict = {
  pad: {
    tower1: 'Crossbow tower', tower2: 'Crossbow tower', tower3: 'Crossbow tower', tower4: 'Crossbow tower',
    axe: '+1 axe', bag: 'Bigger stack', boots: 'Faster boots', worker: 'Lumberjack', power: 'Tower power', wall: 'Stronger palisade',
  },
  chop: 'Chop trees in the forest',
  deliver: 'Bring wood to the counter',
  takeCash: 'Collect your cash',
  buy: 'Buy: {b}',
  defend: 'Bears! Defend the camp',
  breach: 'Bears broke into the camp!',
  free: 'Keep upgrading your camp',
  full: 'MAX',
  wave: 'Wave {n}',
  waveIn: 'Wave {n} in {t}',
  bearsLeft: '🐻 {n}',
  wall: 'Palisade',
  welcome: 'Welcome back!',
  waveCleared: 'Wave cleared!',
  waveStart: 'The bears are coming!',
};

const lang = (globalThis.navigator?.language || 'en').toLowerCase().startsWith('pl') ? 'pl' : 'en';
export const T: Dict = lang === 'pl' ? pl : en;

export function fmt(s: string, vars: Record<string, string | number>): string {
  return s.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ''));
}
