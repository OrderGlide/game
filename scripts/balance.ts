// Balance test: a bot plays through the worlds headlessly (no graphics) and reports how long each world
// takes, how often the palisade falls and how the boss fights go.
//
//   npm run balance              all 6 worlds
//   W=2 MIN=40 npm run balance   first 2 worlds, give up after 40 minutes of game time per world
//   FARM=300 npm run balance     farm 5 minutes before summoning each boss (default 2)
//   TRACE=1 npm run balance      print the camp state every 2.5 minutes
//
// The bot plays like a decent player: it follows the in-game hints, buys Forge upgrades, levels the
// Armory and the palisade with spare cash, and steps out of the boss's slam ring.
import { Game } from '../src/game';
import { PAD_ORDER } from '../src/data';
import { T } from '../src/i18n';
import { newProfile } from '../src/profile';

const profile = newProfile();
profile.tutorial = 99;
const dt = 1 / 20;
const PER_WORLD = +(process.env.MIN ?? 90) * 60;
const WORLDS = +(process.env.W ?? 6);
const FARM = +(process.env.FARM ?? 120);
let clock = 0;
let total = 0;

for (let w = 0; w < WORLDS; w++) {
  const g = new Game(profile);
  g.now = () => clock * 1000;
  let t = 0, breaches = 0, wasBreached = false, waitT = 0, summonAt = 0, slams = 0, minWall = 1;
  const fights: string[] = [];
  const walls: string[] = [];

  while (t < PER_WORLD && !g.worldDone) {
    const calm = !g.aliveEnemies().length;
    if (calm && g.player.stack.length === 0) {
      // Forge: keep half of the next building's price in reserve
      for (const id of ['pick', 'power', 'axe', 'bag', 'axes', 'boots'] as const) {
        const price = g.upgradePrice(id);
        const next = PAD_ORDER.map((p) => g.pad(p)).find((p) => g.padVisible(p) && p.level === 0);
        const reserve = next ? (g.padRemaining(next).cash ?? 0) * 0.5 : 0;
        if (price && g.canAfford({ ...price, cash: (price.cash ?? 0) + reserve })) { g.buyUpgrade(id); break; }
      }
      profile.quests.list.forEach((_, i) => g.claimQuest(i));
    }
    if (g.bossWaiting && (waitT += dt) > FARM) {
      g.summonBoss();
      waitT = 0;
      summonAt = t;
    }

    let obj = g.objective();
    if (obj && obj.text.startsWith(T.upgradePick.split('{')[0])) {
      const price = g.upgradePrice('pick');
      if (price && g.canAfford(price)) g.buyUpgrade('pick');
    }
    // level the Armory and palisade with spare cash
    if (calm && g.player.stack.length === 0) {
      for (const id of ['armory', 'wall'] as const) {
        const pad = g.pad(id), cost = g.padRemaining(pad).cash ?? 0;
        if (g.padVisible(pad) && pad.level > 0 && cost > 0 && g.money >= cost * 1.5) { obj = { text: '', x: pad.def.x, z: pad.def.z }; break; }
      }
    }

    let dir = { x: 0, z: 0 };
    if (obj) {
      const wp = g.waypoint(g.player.x, g.player.z, obj.x, obj.z);
      const final = wp.x === obj.x && wp.z === obj.z;
      const isNode = g.trees.some((tr) => tr.x === obj!.x && tr.z === obj!.z) || g.ores.some((o) => o.x === obj!.x && o.z === obj!.z);
      const stop = final ? (isNode ? 1.2 : 0.15) : 0.1;
      const dx = wp.x - g.player.x, dz = wp.z - g.player.z, d = Math.hypot(dx, dz);
      if (d > stop) dir = { x: dx / d, z: dz / d };
    }
    const stunned = g.player.stunT;
    g.update(dt, dir);
    if (g.player.stunT > stunned) slams++;
    t += dt;
    clock += dt;

    if (g.waveActive) minWall = Math.min(minWall, g.wallHp / g.wallMax);
    if (g.breached && !wasBreached) breaches++;
    wasBreached = g.breached;
    for (const e of g.events) {
      if (e.type === 'waveCleared') { walls.push(`${g.wave - 1}:${Math.round(minWall * 100)}`); minWall = 1; }
      if (e.type === 'toast' && e.text === T.bossFled) fights.push('fled');
      if (e.type === 'toast' && e.text === T.bossDown) fights.push(`won in ${Math.round(t - summonAt)}s`);
    }
    g.events.length = 0;
    if (process.env.TRACE && Math.floor(t / 150) !== Math.floor((t - dt) / 150)) {
      console.log(`  ${(t / 60).toFixed(1)}m wave ${g.wave} $${Math.round(g.money)} wall ${Math.round(g.wallHp)}/${g.wallMax} ` +
        `pads ${g.pads.filter((p) => p.level).map((p) => p.def.id + p.level).join(',')} · ${g.objective()?.text}`);
    }
  }
  total += t;
  console.log(`=== world ${w + 1} ${g.world.def.id}: ${g.worldDone ? 'done' : 'NOT DONE'} in ${(t / 60).toFixed(1)} min, ` +
    `wave ${g.wave}, palisade fell ${breaches}×, slams taken ${slams}, Armory ${g.level('armory')}, palisade ${g.level('wall')}`);
  console.log(`   boss fights: ${fights.join(', ') || '-'}`);
  console.log(`   lowest palisade % per wave: ${walls.join(' ')}`);
  console.log(`   forge ${JSON.stringify(profile.levels)} gems ${JSON.stringify(profile.gems)}`);
  if (!g.worldDone) { process.exitCode = 1; break; }
  profile.world++;
}
console.log(`total ${(total / 60).toFixed(0)} min`);
