// Three.js scene: builds the static camp and mirrors the game state every frame.
import * as THREE from 'three';
import {
  CASH_ZONE, COUNTER, DEPOSIT_ZONE, GATES, PADS, PAD_SIZE, fenceBoxes, mulberry32, type PadDef, type PadId, type PadIcon,
} from '../data';
import type { Game, GameEvent } from '../game';
import type { Hud } from './hud';
import {
  COLORS, animateCharacter, billGeometry, boltGeometry, fenceLogGeometry, logGeometry, makeArrow, makeAxe, makeBear,
  makeCharacter, makeCounter, makeGate, makeTower, mat, pineGeometries, vertexMat,
  type BearRig, type CharacterRig, type GateRig, type TowerRig,
} from './models';

const PAD_ICON: Record<PadIcon, string> = { tower: '🏹', axe: '🪓', bag: '🎒', boots: '👢', worker: '👷', power: '⚡', wall: '🧱' };
const CAM_DIR = new THREE.Vector3(0, 1.3, 1).normalize();
const CHAR_SCALE = 1.3;

interface Flyer { kind: 'log' | 'cash'; a: THREE.Vector3; b: THREE.Vector3; t: number; }
interface Particle { p: THREE.Vector3; v: THREE.Vector3; life: number; color: THREE.Color; size: number; }
interface PadView { mesh: THREE.Mesh; ctx: CanvasRenderingContext2D; tex: THREE.CanvasTexture; key: string; }
interface BearView { rig: BearRig; hpBg: THREE.Sprite; hpFill: THREE.Sprite; }
interface Bubble { sprite: THREE.Sprite; ctx: CanvasRenderingContext2D; tex: THREE.CanvasTexture; key: string; }

const tmpM = new THREE.Matrix4();
const tmpQ = new THREE.Quaternion();
const tmpS = new THREE.Vector3();
const tmpP = new THREE.Vector3();
const tmpE = new THREE.Euler();
const Y = new THREE.Vector3(0, 1, 0);

function setInst(m: THREE.InstancedMesh, i: number, x: number, y: number, z: number, ry: number, s = 1, rx = 0, rz = 0): void {
  tmpE.set(rx, ry, rz);
  tmpQ.setFromEuler(tmpE);
  tmpS.set(s, s, s);
  tmpP.set(x, y, z);
  m.setMatrixAt(i, tmpM.compose(tmpP, tmpQ, tmpS));
}

function easeOutBack(t: number): number {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
}

function canvasTex(size: number): { ctx: CanvasRenderingContext2D; tex: THREE.CanvasTexture } {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return { ctx: c.getContext('2d')!, tex };
}

function rr(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

/** White corner brackets, like the build zones in the reference games. */
function brackets(c: CanvasRenderingContext2D, s: number, inset: number, len: number, lw: number): void {
  c.strokeStyle = '#fff';
  c.lineWidth = lw;
  c.lineCap = 'round';
  c.lineJoin = 'round';
  const a = inset, b = s - inset;
  for (const [x, y, dx, dy] of [[a, a, 1, 1], [b, a, -1, 1], [a, b, 1, -1], [b, b, -1, -1]]) {
    c.beginPath();
    c.moveTo(x, y + dy * len);
    c.lineTo(x, y);
    c.lineTo(x + dx * len, y);
    c.stroke();
  }
}

function drawBill(c: CanvasRenderingContext2D, x: number, y: number, w: number): void {
  const h = w * 0.55;
  c.fillStyle = '#2fae42';
  rr(c, x, y, w, h, w * 0.1);
  c.fill();
  c.fillStyle = '#5fdc70';
  rr(c, x + w * 0.08, y + h * 0.14, w * 0.84, h * 0.72, w * 0.06);
  c.fill();
  c.fillStyle = '#fff';
  c.font = `900 ${h * 0.7}px system-ui, sans-serif`;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText('$', x + w / 2, y + h / 2 + 1);
}

function drawLogIcon(c: CanvasRenderingContext2D, cx: number, cy: number, w: number): void {
  const h = w * 0.42;
  c.fillStyle = '#9c5f2e';
  rr(c, cx - w / 2, cy - h / 2, w, h, h / 2);
  c.fill();
  c.fillStyle = '#ecc795';
  c.beginPath();
  c.ellipse(cx + w / 2 - h / 2, cy, h * 0.42, h / 2, 0, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = '#c99357';
  c.lineWidth = 3;
  c.beginPath();
  c.ellipse(cx + w / 2 - h / 2, cy, h * 0.2, h * 0.25, 0, 0, Math.PI * 2);
  c.stroke();
}

export class View {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(40, 1, 0.5, 150);
  private sun: THREE.DirectionalLight;
  private camTarget = new THREE.Vector3();
  private camDist = 26;
  private shakeT = 0;
  private time = 0;

  private player: CharacterRig;
  private axes: THREE.Mesh[] = [];
  private axeGroup = new THREE.Group();
  private stack: THREE.InstancedMesh;
  private trees: { foliage: THREE.InstancedMesh; trunk: THREE.InstancedMesh; vary: { s: number; r: number }[] };
  private survivors = new Map<number, CharacterRig>();
  private workers = new Map<number, CharacterRig>();
  private workerLogs: THREE.InstancedMesh;
  private bears = new Map<number, BearView>();
  private towers = new Map<PadId, { rig: TowerRig; t: number }>();
  private bolts = new Map<number, THREE.Mesh>();
  private boltGeo = boltGeometry();
  private gates: { rig: GateRig; x: number; z: number; open: number }[] = [];
  private pads = new Map<PadId, PadView>();
  private bubbles: Bubble[] = [];
  private counterLogs: THREE.InstancedMesh;
  private cashPile: THREE.InstancedMesh;
  private drops: THREE.InstancedMesh;
  private flyLogs: THREE.InstancedMesh;
  private flyCash: THREE.InstancedMesh;
  private flyers: Flyer[] = [];
  private particles: Particle[] = [];
  private particleMesh: THREE.InstancedMesh;
  private arrow = makeArrow();
  private pointer: THREE.Mesh;
  private snow: THREE.Points;

  constructor(canvas: HTMLCanvasElement, game: Game) {
    const r = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFShadowMap;
    this.renderer = r;

    const s = this.scene;
    s.background = new THREE.Color(0xdde8f3);
    s.fog = new THREE.Fog(0xdde8f3, 38, 75);
    s.add(new THREE.HemisphereLight(0xffffff, 0x9eb2cc, 1.9));
    this.sun = new THREE.DirectionalLight(0xfff6ea, 2.3);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    sc.left = sc.bottom = -22;
    sc.right = sc.top = 22;
    sc.near = 1;
    sc.far = 90;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.03;
    s.add(this.sun, this.sun.target);

    this.buildGround();
    this.buildCamp();
    this.trees = this.buildTrees(game);

    this.player = makeCharacter(COLORS.parka, 'hood');
    this.player.root.scale.setScalar(CHAR_SCALE);
    s.add(this.player.root, this.axeGroup);

    this.stack = this.instanced(logGeometry(), vertexMat(), 64);
    this.workerLogs = this.instanced(logGeometry(), vertexMat(), 16);
    this.counterLogs = this.instanced(logGeometry(), vertexMat(), 50);
    this.cashPile = this.instanced(billGeometry(), vertexMat(), 90);
    this.drops = this.instanced(billGeometry(), vertexMat(), 90);
    this.flyLogs = this.instanced(logGeometry(), vertexMat(), 80);
    this.flyCash = this.instanced(billGeometry(), vertexMat(), 80);
    this.particleMesh = this.instanced(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial(), 400, false);
    this.particleMesh.setColorAt(0, new THREE.Color(0xffffff)); // allocate instance colours before the first compile

    for (const def of PADS) this.pads.set(def.id, this.makePad(def));
    for (let i = 0; i < 2; i++) {
      const { ctx, tex } = canvasTex(128);
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false }));
      sprite.scale.set(1.1, 1.1, 1);
      sprite.renderOrder = 10;
      s.add(sprite);
      this.bubbles.push({ sprite, ctx, tex, key: '' });
    }

    s.add(this.arrow);
    const tri = new THREE.Shape();
    tri.moveTo(0, 0.55); tri.lineTo(-0.38, -0.25); tri.lineTo(0, -0.08); tri.lineTo(0.38, -0.25); tri.closePath();
    this.pointer = new THREE.Mesh(new THREE.ShapeGeometry(tri), new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.9 }));
    this.pointer.rotation.x = -Math.PI / 2;
    s.add(this.pointer);

    this.snow = this.buildSnowfall();
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.camTarget.set(game.player.x, 0, game.player.z);
  }

  resize(): void {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    // keep about 12 m of the world visible across the narrow side of the screen
    const hfov = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * this.camera.aspect);
    this.camDist = THREE.MathUtils.clamp(6 / Math.tan(hfov / 2), 18, 38);
    this.camera.updateProjectionMatrix();
  }

  private instanced(geo: THREE.BufferGeometry, m: THREE.Material, n: number, shadow = true): THREE.InstancedMesh {
    const im = new THREE.InstancedMesh(geo, m, n);
    im.count = 0;
    im.castShadow = shadow;
    im.frustumCulled = false;
    this.scene.add(im);
    return im;
  }

  // ---------- static world ----------

  private buildGround(): void {
    const s = this.scene;
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(220, 220), mat(COLORS.snow, { flat: false }));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    s.add(ground);
    const dirt = mat(COLORS.dirt, { flat: false });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(17.4, 17.4), dirt);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0.02;
    floor.receiveShadow = true;
    s.add(floor);
    const path = new THREE.Mesh(new THREE.PlaneGeometry(3, 26), dirt);
    path.rotation.x = -Math.PI / 2;
    path.position.set(COUNTER.x, 0.02, COUNTER.z + 13);
    path.receiveShadow = true;
    s.add(path);

    // scattered snow mounds and rocks
    const rnd = mulberry32(5);
    const mound = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 20, 10), mat(0xf7fafd, { flat: false }), 70);
    const rock = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(0.5, 0), mat(0x9aa6b5), 30);
    let nm = 0, nr = 0;
    for (let i = 0; i < 200 && (nm < 70 || nr < 30); i++) {
      const x = -40 + rnd() * 85, z = -40 + rnd() * 75;
      if (Math.abs(x) < 11 && Math.abs(z) < 11) continue;
      if (x > -25 && x < 5 && z > -30 && z < -9) continue;
      if (Math.abs(x - COUNTER.x) < 3 && z > 8) continue;
      if (nm < 70) {
        tmpE.set(0, rnd() * 3, 0);
        tmpQ.setFromEuler(tmpE);
        const sc = 0.8 + rnd() * 1.8;
        mound.setMatrixAt(nm++, tmpM.compose(tmpP.set(x, -0.1, z), tmpQ, tmpS.set(sc, sc * 0.35, sc * 1.2)));
      } else {
        setInst(rock, nr++, x, 0.15, z, rnd() * 3, 0.6 + rnd() * 0.8, rnd(), rnd());
      }
    }
    mound.receiveShadow = rock.castShadow = true;
    s.add(mound, rock);
  }

  private buildCamp(): void {
    const s = this.scene;
    // palisade of vertical logs
    const boxes = fenceBoxes();
    const positions: [number, number][] = [];
    for (const b of boxes) {
      const horiz = b.w > b.d, len = horiz ? b.w : b.d;
      const n = Math.max(1, Math.round(len / 0.64));
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n - 0.5;
        positions.push(horiz ? [b.x + t * len, b.z] : [b.x, b.z + t * len]);
      }
    }
    const fence = new THREE.InstancedMesh(fenceLogGeometry(), vertexMat(), positions.length);
    const rnd = mulberry32(11);
    positions.forEach(([x, z], i) => {
      tmpQ.setFromEuler(tmpE.set(0, rnd() * 6, 0));
      fence.setMatrixAt(i, tmpM.compose(tmpP.set(x, 0, z), tmpQ, tmpS.set(1, 0.9 + rnd() * 0.2, 1)));
    });
    fence.castShadow = fence.receiveShadow = true;
    s.add(fence);

    const north = makeGate(GATES.north.half * 2);
    north.root.position.set(GATES.north.x, 0, GATES.north.z);
    const east = makeGate(GATES.east.half * 2);
    east.root.position.set(GATES.east.x, 0, GATES.east.z);
    east.root.rotation.y = Math.PI / 2;
    s.add(north.root, east.root);
    this.gates.push({ rig: north, x: GATES.north.x, z: GATES.north.z, open: 0 }, { rig: east, x: GATES.east.x, z: GATES.east.z, open: 0 });

    const counter = makeCounter();
    counter.position.set(COUNTER.x, 0, COUNTER.z);
    s.add(counter);

    s.add(this.zoneMarker(DEPOSIT_ZONE.x, DEPOSIT_ZONE.z, DEPOSIT_ZONE.w, DEPOSIT_ZONE.d, 'log'));
    s.add(this.zoneMarker(CASH_ZONE.x, CASH_ZONE.z, CASH_ZONE.w, CASH_ZONE.d, 'cash'));
  }

  private zoneMarker(x: number, z: number, w: number, d: number, icon: 'log' | 'cash'): THREE.Mesh {
    const { ctx: c, tex } = canvasTex(256);
    const h = Math.round((256 * d) / w);
    c.canvas.height = h;
    c.fillStyle = 'rgba(60,35,20,0.18)';
    rr(c, 8, 8, 240, h - 16, 18);
    c.fill();
    brackets(c, 256, 14, 44, 12);
    // bottom brackets for non-square canvases
    c.save();
    c.translate(0, h - 256);
    brackets(c, 256, 14, 44, 12);
    c.restore();
    c.globalAlpha = 0.85;
    if (icon === 'log') drawLogIcon(c, 128, h / 2, 90); else drawBill(c, 88, h / 2 - 22, 80);
    tex.needsUpdate = true;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, 0.04, z);
    return m;
  }

  private buildTrees(game: Game) {
    const { foliage, trunk } = pineGeometries();
    const n = game.trees.length;
    const f = new THREE.InstancedMesh(foliage, vertexMat(), n);
    const t = new THREE.InstancedMesh(trunk, vertexMat(), n);
    f.castShadow = t.castShadow = true;
    f.receiveShadow = true;
    this.scene.add(f, t);
    const rnd = mulberry32(3);
    const vary = game.trees.map(() => ({ s: 0.85 + rnd() * 0.35, r: rnd() * Math.PI * 2 }));
    return { foliage: f, trunk: t, vary };
  }

  private buildSnowfall(): THREE.Points {
    const n = 700;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 44;
      pos[i * 3 + 1] = Math.random() * 18;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 44;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const p = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 0.13, transparent: true, opacity: 0.9, depthWrite: false }));
    p.frustumCulled = false;
    this.scene.add(p);
    return p;
  }

  // ---------- pads ----------

  private makePad(def: PadDef): PadView {
    const { ctx, tex } = canvasTex(256);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(PAD_SIZE, PAD_SIZE), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(def.x, 0.05, def.z);
    this.scene.add(mesh);
    return { mesh, ctx, tex, key: '' };
  }

  private drawPad(pv: PadView, def: PadDef, remaining: number, progress: number): void {
    const c = pv.ctx, S = 256;
    c.clearRect(0, 0, S, S);
    c.fillStyle = 'rgba(70,40,25,0.55)';
    rr(c, 10, 10, S - 20, S - 20, 26);
    c.fill();
    if (progress > 0) {
      c.save();
      rr(c, 10, 10, S - 20, S - 20, 26);
      c.clip();
      c.fillStyle = 'rgba(95,220,112,0.55)';
      c.fillRect(10, 10 + (S - 20) * (1 - progress), S - 20, (S - 20) * progress);
      c.restore();
    }
    brackets(c, S, 16, 52, 13);
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.font = `92px system-ui, "Apple Color Emoji", "Noto Color Emoji", sans-serif`;
    c.fillText(PAD_ICON[def.icon], S / 2, 96);
    drawBill(c, 42, 158, 62);
    c.font = '900 58px system-ui, sans-serif';
    c.lineWidth = 10;
    c.strokeStyle = 'rgba(30,20,10,0.6)';
    c.textAlign = 'left';
    c.strokeText(String(remaining), 112, 176);
    c.fillStyle = '#fff';
    c.fillText(String(remaining), 112, 176);
    pv.tex.needsUpdate = true;
  }

  private drawBubble(b: Bubble, left: number): void {
    const c = b.ctx;
    c.clearRect(0, 0, 128, 128);
    c.fillStyle = '#fff';
    c.beginPath();
    c.arc(64, 56, 48, 0, Math.PI * 2);
    c.fill();
    c.beginPath();
    c.moveTo(48, 96); c.lineTo(64, 124); c.lineTo(78, 96);
    c.fill();
    drawLogIcon(c, 64, 52, 58);
    if (left > 1) {
      c.font = '900 30px system-ui, sans-serif';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.lineWidth = 6;
      c.strokeStyle = '#fff';
      c.strokeText(`×${left}`, 88, 84);
      c.fillStyle = '#333';
      c.fillText(`×${left}`, 88, 84);
    }
    b.tex.needsUpdate = true;
  }

  // ---------- per-frame ----------

  handleEvents(events: GameEvent[], hud: Hud): void {
    for (const e of events) {
      switch (e.type) {
        case 'fly':
          if (this.flyers.length < 80) this.flyers.push({ kind: e.kind, a: new THREE.Vector3(e.x0, e.y0, e.z0), b: new THREE.Vector3(e.x1, e.y1, e.z1), t: 0 });
          break;
        case 'float': hud.float(e.text, e.x, 2.6, e.z, e.color); break;
        case 'burst': this.burst(e.x, e.y, e.z, e.color, e.n, 4); break;
        case 'build':
          this.burst(e.x, 0.5, e.z, 0xffd23f, 18, 7);
          this.burst(e.x, 0.5, e.z, 0xffffff, 12, 6);
          break;
        case 'shake': this.shakeT = Math.max(this.shakeT, e.power); break;
        case 'toast': hud.showToast(e.text, e.sub); break;
      }
    }
    events.length = 0;
  }

  private burst(x: number, y: number, z: number, color: number, n: number, speed: number): void {
    const col = new THREE.Color(color);
    for (let i = 0; i < n && this.particles.length < 400; i++) {
      const a = Math.random() * Math.PI * 2, sp = speed * (0.4 + Math.random() * 0.6);
      this.particles.push({
        p: new THREE.Vector3(x, y, z),
        v: new THREE.Vector3(Math.cos(a) * sp, 3 + Math.random() * 4, Math.sin(a) * sp),
        life: 0.6 + Math.random() * 0.5, color: col, size: 0.1 + Math.random() * 0.12,
      });
    }
  }

  update(g: Game, dt: number, objective: { x: number; z: number } | null): void {
    this.time += dt;
    const t = this.time, p = g.player;

    // camera follows the player
    this.camTarget.lerp(tmpP.set(p.x, 0, p.z), Math.min(1, dt * 6));
    this.shakeT = Math.max(0, this.shakeT - dt);
    const sh = this.shakeT * 0.6;
    this.camera.position.copy(this.camTarget).addScaledVector(CAM_DIR, this.camDist);
    this.camera.position.x += (Math.random() - 0.5) * sh;
    this.camera.position.y += (Math.random() - 0.5) * sh;
    this.camera.lookAt(this.camTarget.x, 0.6, this.camTarget.z);
    this.sun.position.set(this.camTarget.x - 10, 26, this.camTarget.z + 8);
    this.sun.target.position.copy(this.camTarget);

    // player + orbiting axes
    const pr = this.player;
    pr.root.position.set(p.x, 0, p.z);
    pr.root.rotation.y = p.face;
    animateCharacter(pr, p.walkT, p.moving, p.stack.length > 0);
    pr.root.visible = !(p.hurtT > 0 && Math.floor(t * 16) % 2 === 0);
    while (this.axes.length < g.axes) { const a = makeAxe(); this.axes.push(a); this.axeGroup.add(a); }
    this.axeGroup.position.set(p.x, 0.95, p.z);
    this.axes.forEach((a, i) => {
      const ang = p.axeAngle + (i / this.axes.length) * Math.PI * 2;
      a.position.set(Math.cos(ang) * 1.55, 0, Math.sin(ang) * 1.55);
      a.rotation.set(Math.PI / 2, 0, -ang + t * 14);
    });

    // carried log stack in the player's arms
    const n = Math.min(p.stack.length, 64);
    const sin = Math.sin(p.face), cos = Math.cos(p.face);
    for (let i = 0; i < n; i++) {
      const s = p.stack[i];
      const wob = p.moving ? Math.sin(t * 9 - i * 0.35) * i * 0.012 : 0;
      const lx = wob, ly = (1.05 + pr.body.position.y) * CHAR_SCALE + i * 0.33, lz = 0.75;
      let x = p.x + lx * cos + lz * sin, y = ly, z = p.z - lx * sin + lz * cos;
      if (s.anim < 1) {
        const e = s.anim;
        x = s.fx + (x - s.fx) * e;
        z = s.fz + (z - s.fz) * e;
        y = s.fy + (y - s.fy) * e + Math.sin(e * Math.PI) * 1.5;
      }
      setInst(this.stack, i, x, y, z, p.face);
    }
    this.stack.count = n;
    this.stack.instanceMatrix.needsUpdate = true;

    this.updateTrees(g, t);
    this.updateSurvivors(g, dt);
    this.updateWorkers(g);
    this.updateBears(g);
    this.updateTowers(g, dt);
    this.updatePads(g);
    this.updatePiles(g, t);
    this.updateFx(dt);

    for (const gt of this.gates) {
      const near = Math.hypot(p.x - gt.x, p.z - gt.z) < 3.2 || [...this.workers.values()].some((w) => Math.hypot(w.root.position.x - gt.x, w.root.position.z - gt.z) < 3);
      gt.open += ((near ? 1 : 0) - gt.open) * Math.min(1, dt * 8);
      gt.rig.left.rotation.y = -gt.open * 1.4;
      gt.rig.right.rotation.y = Math.PI + gt.open * 1.4;
    }

    // guide arrow above the objective, plus a ground pointer when it's far away
    this.arrow.visible = !!objective;
    this.pointer.visible = false;
    if (objective) {
      this.arrow.position.set(objective.x, 3.4 + Math.abs(Math.sin(t * 4)) * 0.5, objective.z);
      this.arrow.rotation.y = t * 2;
      const dx = objective.x - p.x, dz = objective.z - p.z, d = Math.hypot(dx, dz);
      if (d > 4) {
        this.pointer.visible = true;
        this.pointer.position.set(p.x + (dx / d) * 1.9, 0.06, p.z + (dz / d) * 1.9);
        this.pointer.rotation.z = Math.atan2(dx, -dz) * -1;
      }
    }

    // snowfall around the camera target
    const sp = this.snow.geometry.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < sp.count; i++) {
      let y = sp.getY(i) - dt * 1.6;
      let x = sp.getX(i) + Math.sin(t + i) * dt * 0.3;
      let z = sp.getZ(i);
      if (y < 0) { y += 18; x = (Math.random() - 0.5) * 44; z = (Math.random() - 0.5) * 44; }
      sp.setXYZ(i, x, y, z);
    }
    sp.needsUpdate = true;
    this.snow.position.set(this.camTarget.x, 0, this.camTarget.z);

    this.renderer.render(this.scene, this.camera);
  }

  private updateTrees(g: Game, t: number): void {
    const { foliage, trunk, vary } = this.trees;
    g.trees.forEach((tr, i) => {
      const v = vary[i];
      const alive = tr.hp > 0;
      const s = alive ? v.s * Math.max(0.01, easeOutBack(tr.grow)) : 0.001;
      const wob = tr.shake > 0 ? Math.sin(t * 45) * tr.shake * 0.35 : 0;
      setInst(foliage, i, tr.x, alive ? 0 : -5, tr.z, v.r, s, wob, wob * 0.5);
      setInst(trunk, i, tr.x, 0, tr.z, v.r, v.s, wob * 0.5, 0);
      if (!alive) {
        tmpQ.setFromEuler(tmpE.set(0, v.r, 0));
        trunk.setMatrixAt(i, tmpM.compose(tmpP.set(tr.x, 0, tr.z), tmpQ, tmpS.set(v.s, 0.35, v.s)));
      }
    });
    foliage.instanceMatrix.needsUpdate = true;
    trunk.instanceMatrix.needsUpdate = true;
  }

  private updateSurvivors(g: Game, _dt: number): void {
    const seen = new Set<number>();
    for (const s of g.survivors) {
      seen.add(s.id);
      let rig = this.survivors.get(s.id);
      if (!rig) { rig = makeCharacter(COLORS.santa, 'santa'); rig.root.scale.setScalar(CHAR_SCALE); this.survivors.set(s.id, rig); this.scene.add(rig.root); }
      rig.root.position.set(s.x, 0, s.z);
      rig.root.rotation.y = s.face;
      animateCharacter(rig, s.walkT, s.state !== 'wait', false);
      if (s.state === 'wait') rig.body.position.y = Math.abs(Math.sin(this.time * 2 + s.id)) * 0.03;
    }
    for (const [id, rig] of this.survivors) if (!seen.has(id)) { this.scene.remove(rig.root); this.survivors.delete(id); }

    // speech bubbles over the first two in line
    const front = g.survivors.filter((s) => s.state !== 'leave' && s.slot < 2).sort((a, b) => a.slot - b.slot);
    this.bubbles.forEach((b, i) => {
      const s = front[i];
      b.sprite.visible = !!s;
      if (!s) return;
      const left = s.want - s.got;
      const key = `${left}`;
      if (key !== b.key) { this.drawBubble(b, left); b.key = key; }
      b.sprite.position.set(s.x, 3.6 + Math.sin(this.time * 3 + i) * 0.06, s.z);
    });
  }

  private updateWorkers(g: Game): void {
    let li = 0;
    for (const w of g.workers) {
      let rig = this.workers.get(w.id);
      if (!rig) { rig = makeCharacter(COLORS.worker, 'beanie'); rig.root.scale.setScalar(CHAR_SCALE); this.workers.set(w.id, rig); this.scene.add(rig.root); }
      rig.root.position.set(w.x, 0, w.z);
      rig.root.rotation.y = w.face;
      animateCharacter(rig, w.walkT, w.moving, w.carry > 0);
      if (w.state === 'chop') rig.armR.rotation.x = -1.5 + Math.sin(w.t * 14) * 0.9;
      const sin = Math.sin(w.face), cos = Math.cos(w.face);
      for (let i = 0; i < w.carry && li < 16; i++) setInst(this.workerLogs, li++, w.x + 0.7 * sin, 1.05 * CHAR_SCALE + i * 0.33, w.z + 0.7 * cos, w.face);
    }
    this.workerLogs.count = li;
    this.workerLogs.instanceMatrix.needsUpdate = true;
  }

  private updateBears(g: Game): void {
    const seen = new Set<number>();
    for (const b of g.bears) {
      if (b.state === 'spawn') continue;
      seen.add(b.id);
      let v = this.bears.get(b.id);
      if (!v) {
        const rig = makeBear();
        const hpBg = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0x1d2633, depthTest: false }));
        const hpFill = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0x9be34b, depthTest: false }));
        hpBg.scale.set(1.3, 0.18, 1);
        hpFill.center.set(0, 0.5);
        hpBg.renderOrder = hpFill.renderOrder = 11;
        this.scene.add(rig.root, hpBg, hpFill);
        v = { rig, hpBg, hpFill };
        this.bears.set(b.id, v);
      }
      const { rig, hpBg, hpFill } = v;
      rig.root.position.set(b.x, 0, b.z);
      rig.root.rotation.y = b.face;
      const walking = b.state === 'approach' || b.state === 'chase';
      rig.legs.forEach((l, i) => { l.rotation.x = walking ? Math.sin(b.walkT * 1.2 + (i % 2 ? Math.PI : 0) + (i > 1 ? Math.PI : 0)) * 0.6 : 0; });
      const lunge = b.state === 'attack' || (b.state === 'chase' && b.atkT > 0.8) ? Math.max(0, Math.sin((b.atkT / 1.5) * Math.PI)) : 0;
      rig.body.rotation.x = lunge * 0.3;
      rig.body.position.z = lunge * 0.3;
      rig.material.emissive.setRGB(b.flash * 0.5, 0, 0);
      if (b.state === 'dead') {
        const k = Math.min(1, b.deadT * 3);
        rig.root.rotation.z = k * (Math.PI / 2);
        rig.root.position.y = -Math.max(0, b.deadT - 0.8) * 1.2;
      } else rig.root.rotation.z = 0;
      const showHp = b.state !== 'dead' && b.hp < b.maxHp;
      hpBg.visible = hpFill.visible = showHp;
      if (showHp) {
        hpBg.position.set(b.x, 3.0, b.z);
        const w = 1.2 * Math.max(0, b.hp / b.maxHp);
        hpFill.scale.set(Math.max(0.001, w), 0.12, 1);
        // sprite anchored at its left edge: shift it left by half the full bar width in screen space
        tmpP.set(-0.6, 0, 0).applyQuaternion(this.camera.quaternion);
        hpFill.position.set(b.x + tmpP.x, 3.0 + tmpP.y, b.z + tmpP.z);
      }
    }
    for (const [id, v] of this.bears) {
      if (seen.has(id)) continue;
      this.scene.remove(v.rig.root, v.hpBg, v.hpFill);
      v.rig.material.dispose();
      this.bears.delete(id);
    }
  }

  private updateTowers(g: Game, dt: number): void {
    for (const tw of g.towers) {
      let v = this.towers.get(tw.id);
      if (!v) {
        v = { rig: makeTower(), t: 0 };
        v.rig.root.position.set(tw.x, 0, tw.z);
        this.scene.add(v.rig.root);
        this.towers.set(tw.id, v);
      }
      v.t = Math.min(1, v.t + dt * 2.2);
      v.rig.root.scale.setScalar(Math.max(0.01, easeOutBack(v.t)));
      v.rig.head.rotation.y = tw.aim;
      v.rig.stock.position.z = -tw.recoil * 0.25;
    }
    const seen = new Set<number>();
    for (const b of g.bolts) {
      seen.add(b.id);
      let m = this.bolts.get(b.id);
      if (!m) { m = new THREE.Mesh(this.boltGeo, vertexMat()); this.bolts.set(b.id, m); this.scene.add(m); }
      m.position.set(b.x, b.y, b.z);
      m.lookAt(b.x + b.dx, b.y + b.dy, b.z + b.dz);
    }
    for (const [id, m] of this.bolts) if (!seen.has(id)) { this.scene.remove(m); this.bolts.delete(id); }
  }

  private updatePads(g: Game): void {
    for (const ps of g.pads) {
      const pv = this.pads.get(ps.def.id)!;
      const vis = g.padVisible(ps);
      pv.mesh.visible = vis;
      if (!vis) continue;
      const rem = g.padRemaining(ps), prog = ps.paid / g.padCost(ps);
      const key = `${rem}|${Math.round(prog * 30)}`;
      if (key !== pv.key) { this.drawPad(pv, ps.def, rem, prog); pv.key = key; }
      pv.mesh.scale.setScalar(1 + ps.pulse * 0.6);
    }
  }

  private updatePiles(g: Game, t: number): void {
    // logs waiting on the counter
    const n = Math.min(g.counterLogs, 50);
    for (let i = 0; i < n; i++) {
      const col = i % 10, layer = Math.floor(i / 10);
      setInst(this.counterLogs, i, COUNTER.x - 1.62 + col * 0.36, 1.2 + layer * 0.32, COUNTER.z, Math.PI / 2);
    }
    this.counterLogs.count = n;
    this.counterLogs.instanceMatrix.needsUpdate = true;

    // cash stacks next to the counter
    const bills = Math.min(90, Math.ceil(g.cashPile / 5));
    for (let i = 0; i < bills; i++) {
      const slot = i % 6, layer = Math.floor(i / 6);
      const x = CASH_ZONE.x + (slot % 2 ? 0.38 : -0.38), z = CASH_ZONE.z + (Math.floor(slot / 2) - 1) * 0.42;
      setInst(this.cashPile, i, x, 0.1 + layer * 0.14, z, 0);
    }
    this.cashPile.count = bills;
    this.cashPile.instanceMatrix.needsUpdate = true;

    // cash dropped by bears
    let di = 0;
    for (const d of g.drops) {
      for (let k = 0; k < 3 && di < 90; k++) setInst(this.drops, di++, d.x, 0.35 + k * 0.14 + Math.sin(t * 4 + d.id) * 0.12, d.z, t * 2 + d.id + k * 0.3);
    }
    this.drops.count = di;
    this.drops.instanceMatrix.needsUpdate = true;
  }

  private updateFx(dt: number): void {
    let li = 0, ci = 0;
    for (const f of this.flyers) {
      f.t += dt / 0.35;
      const e = Math.min(1, f.t);
      const x = f.a.x + (f.b.x - f.a.x) * e, z = f.a.z + (f.b.z - f.a.z) * e;
      const y = f.a.y + (f.b.y - f.a.y) * e + Math.sin(e * Math.PI) * 1.8;
      if (f.kind === 'log') setInst(this.flyLogs, li++, x, y, z, e * 6);
      else setInst(this.flyCash, ci++, x, y, z, e * 8);
    }
    this.flyers = this.flyers.filter((f) => f.t < 1);
    this.flyLogs.count = li;
    this.flyCash.count = ci;
    this.flyLogs.instanceMatrix.needsUpdate = this.flyCash.instanceMatrix.needsUpdate = true;

    let pi = 0;
    for (const q of this.particles) {
      q.life -= dt;
      q.v.y -= 18 * dt;
      q.p.addScaledVector(q.v, dt);
      if (q.p.y < 0.05) { q.p.y = 0.05; q.v.set(q.v.x * 0.5, -q.v.y * 0.3, q.v.z * 0.5); }
      const s = q.size * Math.min(1, q.life * 3);
      tmpQ.setFromAxisAngle(Y, q.life * 8);
      this.particleMesh.setMatrixAt(pi, tmpM.compose(q.p, tmpQ, tmpS.set(s, s, s)));
      this.particleMesh.setColorAt(pi, q.color);
      pi++;
    }
    this.particles = this.particles.filter((q) => q.life > 0);
    this.particleMesh.count = pi;
    this.particleMesh.instanceMatrix.needsUpdate = true;
    if (this.particleMesh.instanceColor) this.particleMesh.instanceColor.needsUpdate = true;
  }
}
