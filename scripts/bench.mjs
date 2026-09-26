// Performance test: starts the dev server, loads a fully built camp with ~40 monsters in a headless
// browser with the CPU slowed down like a budget phone, and measures the time per frame spent in game
// logic, scene updates and the HUD, plus draw calls, triangles and GPU buffers (to catch leaks).
//
//   npm run bench                     both graphics levels, CPU slowed 4×
//   THROTTLE=6 Q=low npm run bench    slower CPU, only the low setting
//
// Needs a Chromium: `npx playwright install chromium` once, or point CHROME_PATH at Chrome.
// Headless rendering runs on the CPU, so "render" times are only a rough guide; the JS numbers,
// draw calls and triangles are what to compare between versions.
import { chromium } from 'playwright-core';
import { createServer } from 'vite';

const THROTTLE = +(process.env.THROTTLE ?? 4);
const server = await createServer({ server: { port: 5199, strictPort: false }, logLevel: 'error' });
await server.listen();
const url = server.resolvedUrls.local[0];
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});

const stats = (a) => {
  const s = [...a].sort((x, y) => x - y);
  return `avg ${(a.reduce((x, y) => x + y, 0) / a.length).toFixed(2)} ms, p95 ${s[Math.floor(s.length * 0.95)].toFixed(2)} ms`;
};
let failed = false;

for (const quality of (process.env.Q ?? 'high,low').split(',')) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await ctx.addInitScript((quality) => {
    const lv = (n) => ({ level: n, paid: {} });
    const pads = {
      tower1: lv(1), tower2: lv(1), tower3: lv(1), tower4: lv(1), ice: lv(1), fire: lv(1), cannon: lv(1),
      lumber: lv(3), miner: lv(2), tent: lv(3), armory: lv(6), wall: lv(8),
    };
    const profile = {
      v: 3, world: 0, tutorial: 99, pet: 'dragon', pets: ['dragon'], gems: { em: 0, di: 0, ob: 0 },
      levels: { bag: 10, axe: 6, axes: 3, pick: 6, boots: 5, power: 5 },
      settings: { sfx: false, music: false, vibration: false, quality, fps: false, lang: 'pl' },
    };
    const camp = {
      money: 5000, cashPile: 3000, counterLogs: 30, pads, stack: 30, px: 2, pz: 2, wave: 25, waveTimer: 50, wallHp: 99999,
      bossDefeated: true, worldDone: false, savedAt: Date.now(),
    };
    localStorage.setItem('frost-camp-save-v3', JSON.stringify({ v: 3, profile, camp }));
  }, quality);
  await page.goto(url);
  await page.waitForFunction(() => window.game && window.view, null, { timeout: 30000 });
  await page.waitForTimeout(1500);
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: THROTTLE });

  // three big waves, all killed: GPU buffers must not keep growing
  const before = await page.evaluate(() => view.renderer.info.memory.geometries);
  for (let w = 0; w < 3; w++) {
    await page.evaluate(() => { game.startWave(); game.startWave(); game.enemies.forEach((e) => { e.delay = 0; }); });
    await page.waitForFunction(() => game.enemies.every((e) => e.state !== 'spawn'), null, { timeout: 60000 });
    await page.evaluate(() => { game.enemies.forEach((e) => game.damageEnemy(e, 1e12, false, 'tower')); });
    await page.waitForFunction(() => game.enemies.length === 0, null, { timeout: 60000 });
  }
  await page.waitForTimeout(300);
  const after = await page.evaluate(() => view.renderer.info.memory.geometries);

  // then measure a fight with ~40 monsters on screen
  await page.evaluate(() => {
    game.startWave(); game.startWave();
    game.enemies.forEach((e) => { e.delay = 0; e.state = 'approach'; e.x = 10 + Math.random() * 10; });
    const s = (window.__perf = { game: [], view: [], hud: [], render: [], calls: [], tris: [] });
    const wrap = (obj, name, key) => {
      const orig = obj[name].bind(obj);
      obj[name] = (...a) => { const t0 = performance.now(); const r = orig(...a); s[key].push(performance.now() - t0); return r; };
    };
    wrap(view.renderer, 'render', 'render');
    wrap(game, 'update', 'game');
    wrap(view, 'update', 'view');
    wrap(hud, 'update', 'hud');
    const tick = () => { s.calls.push(view.renderer.info.render.calls); s.tris.push(view.renderer.info.render.triangles); requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  });
  await page.waitForTimeout(8000);
  const r = await page.evaluate(() => ({ ...window.__perf, enemies: game.aliveEnemies().length }));
  const scene = r.view.map((v, i) => v - (r.render[i] ?? 0));
  const js = r.game.map((v, i) => v + (scene[i] ?? 0) + (r.hud[i] ?? 0));
  console.log(`\n== graphics: ${quality}, CPU slowed ${THROTTLE}×, ${r.enemies} monsters, ${r.game.length} frames`);
  console.log(`   game logic   ${stats(r.game)}`);
  console.log(`   scene update ${stats(scene)}`);
  console.log(`   HUD          ${stats(r.hud)}`);
  console.log(`   all JS       ${stats(js)}  (budget for 60 FPS: 16.7 ms)`);
  console.log(`   render       ${stats(r.render)}  (software rendering, rough guide only)`);
  console.log(`   draw calls ${Math.max(...r.calls)}, triangles ${Math.round(Math.max(...r.tris) / 1000)}K`);
  console.log(`   GPU geometries before/after 3 waves: ${before} → ${after}`);
  if (after - before > 80) { console.log('   ✗ geometries keep growing: something is leaking'); failed = true; }
  if (errors.length) { console.log('   ✗ page errors:', errors); failed = true; }
  await ctx.close();
}
await browser.close();
await server.close();
process.exitCode = failed ? 1 : 0;
