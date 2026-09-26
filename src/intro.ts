// Studio intro shown on every launch: an ice-crystal emblem draws itself, "COLDVAIN" appears letter by
// letter with a frosty shine, snow drifts down, then everything fades to the main menu. Tap to skip.

const CSS = `
#intro { position: fixed; inset: 0; z-index: 50; overflow: hidden; display: grid; place-items: center; cursor: pointer;
  background: radial-gradient(ellipse at 50% 42%, #173156 0%, #0a1528 55%, #04080f 100%);
  font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; transition: opacity .6s ease; }
#intro.out { opacity: 0; }
#intro canvas { position: absolute; inset: 0; width: 100%; height: 100%; }
#intro .mark { position: relative; display: flex; flex-direction: column; align-items: center; gap: 18px; transform: translateY(-4vh); }
#intro svg { width: min(34vw, 150px); height: auto; overflow: visible; filter: drop-shadow(0 0 14px rgba(120,210,255,.55)); }
#intro svg .arm { fill: none; stroke: #bfeaff; stroke-width: 3.2; stroke-linecap: round; stroke-linejoin: round;
  stroke-dasharray: 120; stroke-dashoffset: 120; animation: draw .9s cubic-bezier(.6,0,.3,1) forwards; }
#intro svg .core { fill: #e9f8ff; transform-origin: 60px 60px; transform: scale(0); animation: pop .5s .75s cubic-bezier(.3,1.6,.5,1) forwards; }
#intro svg .ring { fill: none; stroke: rgba(160,225,255,.45); stroke-width: 1.5; transform-origin: 60px 60px; opacity: 0;
  animation: ring 1.4s .9s ease-out forwards; }
#intro .word { display: flex; gap: .06em; font-size: min(12vw, 64px); font-weight: 800; letter-spacing: .08em; position: relative; }
#intro .word span { display: inline-block; opacity: 0; transform: translateY(18px) scale(.9); filter: blur(6px);
  background: linear-gradient(180deg, #ffffff 0%, #cdefff 45%, #6cc4f2 100%); -webkit-background-clip: text; background-clip: text; color: transparent;
  animation: letter .55s cubic-bezier(.2,.9,.3,1.2) forwards; }
#intro .word::after { content: ''; position: absolute; inset: -10% -20%; opacity: 0;
  background: linear-gradient(105deg, transparent 35%, rgba(255,255,255,.85) 50%, transparent 65%); mix-blend-mode: overlay;
  transform: translateX(-120%); animation: shine 1s 1.75s ease-in-out forwards; }
#intro .sub { font-size: min(3.4vw, 15px); letter-spacing: .7em; color: #8fc6e8; opacity: 0; padding-left: .7em;
  animation: fade .6s 1.5s ease forwards; }
#intro .skip { position: absolute; bottom: calc(env(safe-area-inset-bottom) + 22px); font-size: 12px; color: rgba(190,225,255,.45);
  letter-spacing: .15em; opacity: 0; animation: fade .6s 1.2s forwards; }
@keyframes draw { to { stroke-dashoffset: 0; } }
@keyframes pop { to { transform: scale(1); } }
@keyframes ring { 0% { opacity: .9; transform: scale(.6); } 100% { opacity: 0; transform: scale(1.9); } }
@keyframes letter { to { opacity: 1; transform: none; filter: none; } }
@keyframes shine { 0% { opacity: 1; transform: translateX(-120%); } 100% { opacity: 1; transform: translateX(120%); } }
@keyframes fade { to { opacity: 1; } }
`;

/** Six-armed ice crystal, each arm a stroke that draws itself. */
function emblem(): string {
  const arms: string[] = [];
  for (let i = 0; i < 6; i++) {
    const a = i * 60;
    arms.push(`<g transform="rotate(${a} 60 60)"><path class="arm" style="animation-delay:${i * 0.07}s"
      d="M60 60 L60 12 M60 30 L48 20 M60 30 L72 20 M60 44 L52 38 M60 44 L68 38"/></g>`);
  }
  return `<svg viewBox="0 0 120 120"><circle class="ring" cx="60" cy="60" r="34"/>${arms.join('')}
    <path class="core" d="M60 50 L69 60 L60 70 L51 60 Z"/></svg>`;
}

/** Plays the intro; resolves when it has faded out (about 3.4 s, or right away after a tap). */
export function playIntro(skipLabel: string): Promise<void> {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  const el = document.createElement('div');
  el.id = 'intro';
  el.innerHTML = `<canvas></canvas><div class="mark">${emblem()}
    <div class="word">${[...'COLDVAIN'].map((ch, i) => `<span style="animation-delay:${0.55 + i * 0.08}s">${ch}</span>`).join('')}</div>
    <div class="sub">STUDIO</div></div><div class="skip">${skipLabel}</div>`;
  document.body.appendChild(el);

  // gentle snowfall behind the logo
  const canvas = el.querySelector('canvas')!;
  const ctx = canvas.getContext('2d')!;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const resize = () => { canvas.width = innerWidth * dpr; canvas.height = innerHeight * dpr; };
  resize();
  const flakes = Array.from({ length: 70 }, () => ({
    x: Math.random(), y: Math.random(), r: 0.6 + Math.random() * 2.2, v: 0.03 + Math.random() * 0.06, s: Math.random() * 6,
  }));
  let raf = 0, last = performance.now();
  const tick = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const f of flakes) {
      f.y += f.v * dt;
      f.s += dt;
      if (f.y > 1.02) { f.y = -0.02; f.x = Math.random(); }
      ctx.globalAlpha = 0.25 + f.r * 0.2;
      ctx.fillStyle = '#dff4ff';
      ctx.beginPath();
      ctx.arc((f.x + Math.sin(f.s) * 0.01) * canvas.width, f.y * canvas.height, f.r * dpr, 0, Math.PI * 2);
      ctx.fill();
    }
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);

  return new Promise((resolve) => {
    let done = false;
    const finish = (delay: number) => {
      if (done) return;
      done = true;
      setTimeout(() => {
        el.classList.add('out');
        setTimeout(() => { cancelAnimationFrame(raf); el.remove(); style.remove(); resolve(); }, 600);
      }, delay);
    };
    const timer = setTimeout(() => finish(0), 2900);
    el.addEventListener('pointerdown', () => { clearTimeout(timer); finish(0); });
  });
}
