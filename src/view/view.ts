// Three.js scene: builds the current world and mirrors the game state every frame.
import * as THREE from 'three';
import {
  CAMPFIRE, CASH_ZONE, COUNTER, DEPOSIT_ZONE, FOREST_PEN, FORGE_ZONE, GATES, MINE_PEN, PAD_SIZE, TENT_SPOTS, TOOL_TIERS, WORLDS,
  fenceBoxes, mulberry32, type Gem, type PadId, type Price, type SurvivorKind, type TowerKind,
} from '../data';
import { formatNum, type Game, type GameEvent, type PadState } from '../game';
import { skinDef, type Quality } from '../profile';
import { T } from '../i18n';
import type { Hud } from './hud';
import {
  animateCharacter, animateEnemy, billGeometry, boltGeometries, fenceLogGeometry, logGeometry, makeAnvil, makeArrow, makeAxe,
  makeBackpack, makeCampfire, makeCharacter, makeCounter, makeEnemy, makeGate, makePadIcon, makePet, makePickaxe, makePortal,
  makeTent, makeTower, mat, vertexMat,
  type CampfireRig, type CharacterRig, type EnemyRig, type GateRig, type PetRig, type PortalRig, type TowerRig,
} from './models';
import { GEM_COLOR, buildDecor, oreGeometries, treeGeometries } from './nature';
import { THEMES, type Theme } from './theme';

const CAM_DIR = new THREE.Vector3(0, 1.3, 1).normalize();
const CHAR_SCALE = 1.3;

const SURVIVOR_COAT: Record<SurvivorKind, [number, number]> = {
  santa: [0xe0413b, 0xffffff], nomad: [0xe8d8b0, 0x3aa0a0], explorer: [0xc8b27a, 0x6b4a2a],
  fisher: [0xf5c518, 0x2a6ab0], miner: [0x6b5a4a, 0xf5b82e], wizard: [0x6a4fc8, 0xffe066],
};

interface Flyer { kind: 'log' | 'cash'; a: THREE.Vector3; b: THREE.Vector3; t: number; }
interface Particle { p: THREE.Vector3; v: THREE.Vector3; life: number; color: THREE.Color; size: number; }
interface PadView {
  plate: THREE.Mesh; ctx: CanvasRenderingContext2D; tex: THREE.CanvasTexture;
  icon: THREE.Group; label: THREE.Sprite; lctx: CanvasRenderingContext2D; ltex: THREE.CanvasTexture; key: string;
}
interface EnemyView { rig: EnemyRig; hpBg: THREE.Sprite; hpFill: THREE.Sprite; }
interface Bubble { sprite: THREE.Sprite; ctx: CanvasRenderingContext2D; tex: THREE.CanvasTexture; key: string; }

const tmpM = new THREE.Matrix4();
const tmpQ = new THREE.Quaternion();
const tmpQ2 = new THREE.Quaternion();
const tmpS = new THREE.Vector3();
const tmpP = new THREE.Vector3();
const tmpE = new THREE.Euler();
const tmpA = new THREE.Vector3();
const Y = new THREE.Vector3(0, 1, 0);

function setInst(m: THREE.InstancedMesh, i: number, x: number, y: number, z: number, ry: number, s = 1, rx = 0, rz = 0): void {
  tmpQ.setFromEuler(tmpE.set(rx, ry, rz));
  m.setMatrixAt(i, tmpM.compose(tmpP.set(x, y, z), tmpQ, tmpS.set(s, s, s)));
}

function easeOutBack(t: number): number {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
}

function canvasTex(w: number, h = w): { ctx: CanvasRenderingContext2D; tex: THREE.CanvasTexture } {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
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
function brackets(c: CanvasRenderingContext2D, w: number, h: number, inset: number, len: number, lw: number): void {
  c.strokeStyle = '#fff';
  c.lineWidth = lw;
  c.lineCap = 'round';
  c.lineJoin = 'round';
  const a = inset, b = w - inset, t = inset, u = h - inset;
  for (const [x, y, dx, dy] of [[a, t, 1, 1], [b, t, -1, 1], [a, u, 1, -1], [b, u, -1, -1]]) {
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

function drawGem(c: CanvasRenderingContext2D, x: number, y: number, r: number, gem: Gem): void {
  c.fillStyle = '#' + new THREE.Color(GEM_COLOR[gem]).getHexString();
  c.beginPath();
  c.moveTo(x, y - r); c.lineTo(x + r * 0.8, y - r * 0.2); c.lineTo(x, y + r); c.lineTo(x - r * 0.8, y - r * 0.2);
  c.closePath();
  c.fill();
  c.fillStyle = 'rgba(255,255,255,0.55)';
  c.beginPath();
  c.moveTo(x, y - r); c.lineTo(x + r * 0.4, y - r * 0.2); c.lineTo(x, y); c.lineTo(x - r * 0.4, y - r * 0.2);
  c.closePath();
  c.fill();
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
  scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(40, 1, 0.5, 160);
  private sun!: THREE.DirectionalLight;
  private theme!: Theme;
  private camTarget = new THREE.Vector3();
  private camDist = 26;
  private shakeT = 0;
  private time = 0;

  private player!: CharacterRig;
  private playerKey = '';
  private axes: THREE.Mesh[] = [];
  private axeKey = '';
  private axeGroup = new THREE.Group();
  private pickaxe: THREE.Mesh | null = null;
  private stack!: THREE.InstancedMesh;
  private trees!: { foliage: THREE.InstancedMesh; trunk: THREE.InstancedMesh; vary: { s: number; r: number }[] };
  private ores!: { rock: THREE.InstancedMesh; crystals: Record<Gem, THREE.InstancedMesh> };
  private survivors = new Map<number, CharacterRig>();
  private workers = new Map<number, CharacterRig>();
  private workerLogs!: THREE.InstancedMesh;
  private enemies = new Map<number, EnemyView>();
  private towers = new Map<PadId, { rig: TowerRig; t: number }>();
  private bolts = new Map<number, THREE.Mesh>();
  private boltGeo = boltGeometries();
  private petRig: PetRig | null = null;
  private petId = '';
  private tents: THREE.Group[] = [];
  private quality: Exclude<Quality, 'auto'> = 'high';
  private autoQuality = true;
  private fpsT = 0;
  private fpsFrames = 0;
  private fpsChecks = 0;
  fps = 60;
  private gates: { rig: GateRig; x: number; z: number; open: number }[] = [];
  private pads = new Map<PadId, PadView>();
  private portal: PortalRig | null = null;
  private campfire!: CampfireRig;
  private lava: THREE.Mesh[] = [];
  private bubbles: Bubble[] = [];
  private counterLogs!: THREE.InstancedMesh;
  private cashPile!: THREE.InstancedMesh;
  private drops!: THREE.InstancedMesh;
  private flyLogs!: THREE.InstancedMesh;
  private flyCash!: THREE.InstancedMesh;
  private flyers: Flyer[] = [];
  private particles: Particle[] = [];
  private particleMesh!: THREE.InstancedMesh;
  private arrow = makeArrow();
  private pointer!: THREE.Mesh;
  private ambient!: THREE.Points;

  constructor(canvas: HTMLCanvasElement) {
    const r = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFShadowMap;
    this.renderer = r;
    // phones with very dense screens start one step lower; auto mode adapts from there
    this.quality = (window.devicePixelRatio || 1) > 2.5 ? 'medium' : 'high';
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  /** 'auto' measures FPS and steps down while the game runs slowly. */
  setQuality(q: Quality): void {
    this.autoQuality = q === 'auto';
    if (q !== 'auto') this.applyQuality(q);
    this.fpsChecks = 0;
  }

  private applyQuality(q: Exclude<Quality, 'auto'>): void {
    this.quality = q;
    const dpr = window.devicePixelRatio || 1;
    this.renderer.setPixelRatio(q === 'high' ? Math.min(dpr, 2) : q === 'medium' ? Math.min(dpr, 1.5) : 1);
    const shadows = q !== 'low';
    if (this.renderer.shadowMap.enabled !== shadows) {
      this.renderer.shadowMap.enabled = shadows;
      this.scene.traverse((o) => {
        const m = (o as THREE.Mesh).material;
        if (m) (Array.isArray(m) ? m : [m]).forEach((x) => { x.needsUpdate = true; });
      });
    }
    if (this.sun) {
      this.sun.castShadow = shadows;
      const size = q === 'high' ? 2048 : 1024;
      if (this.sun.shadow.mapSize.x !== size) {
        this.sun.shadow.mapSize.set(size, size);
        this.sun.shadow.map?.dispose();
        this.sun.shadow.map = null;
      }
    }
    if (this.ambient) this.ambient.geometry.setDrawRange(0, q === 'high' ? 600 : q === 'medium' ? 300 : 120);
    this.resize();
  }

  private trackFps(dt: number): void {
    this.fpsFrames++;
    this.fpsT += dt;
    if (this.fpsT < 1) return;
    this.fps = Math.round(this.fpsFrames / this.fpsT);
    this.fpsFrames = 0;
    this.fpsT = 0;
    if (!this.autoQuality || this.quality === 'low') return;
    // after a warm-up second, three slow seconds in a row step the graphics down
    this.fpsChecks = this.fps < 40 ? this.fpsChecks + 1 : 0;
    if (this.fpsChecks >= 3) {
      this.fpsChecks = 0;
      this.applyQuality(this.quality === 'high' ? 'medium' : 'low');
    }
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

  // ---------- building a world ----------

  build(game: Game): void {
    this.scene.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh && m.geometry) m.geometry.dispose(); });
    this.scene = new THREE.Scene();
    this.survivors.clear();
    this.workers.clear();
    this.enemies.clear();
    this.towers.clear();
    this.bolts.clear();
    this.pads.clear();
    this.gates = [];
    this.bubbles = [];
    this.flyers = [];
    this.particles = [];
    this.portal = null;
    this.playerKey = '';
    this.axeKey = '';
    this.axes = [];
    this.axeGroup = new THREE.Group();
    this.arrow = makeArrow();
    this.petRig = null;
    this.petId = '';
    this.tents = [];

    const th = (this.theme = THEMES[game.world.def.id]);
    const s = this.scene;
    s.background = new THREE.Color(th.sky);
    s.fog = new THREE.Fog(th.sky, th.fogNear, th.fogFar);
    s.add(new THREE.HemisphereLight(th.hemiSky, th.hemiGround, th.hemi));
    this.sun = new THREE.DirectionalLight(th.sun, th.sunPower);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    sc.left = sc.bottom = -24;
    sc.right = sc.top = 24;
    sc.near = 1;
    sc.far = 90;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.03;
    s.add(this.sun, this.sun.target);

    this.buildGround(th);
    this.buildCamp(th);
    const tg = treeGeometries(game.world.def.tree);
    this.trees = this.buildTrees(game, tg);
    this.ores = this.buildOres(game, th);
    this.lava = buildDecor(game.world.def.id, th, s, tg).lava;

    s.add(this.axeGroup);
    this.stack = this.instanced(logGeometry(), vertexMat(), 70);
    this.workerLogs = this.instanced(logGeometry(), vertexMat(), 16);
    this.counterLogs = this.instanced(logGeometry(), vertexMat(), 50);
    this.cashPile = this.instanced(billGeometry(), vertexMat(), 90);
    this.drops = this.instanced(billGeometry(), vertexMat(), 120);
    this.flyLogs = this.instanced(logGeometry(), vertexMat(), 80);
    this.flyCash = this.instanced(billGeometry(), vertexMat(), 80);
    this.particleMesh = this.instanced(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial(), 500, false);
    this.particleMesh.setColorAt(0, new THREE.Color(0xffffff)); // allocate instance colours before the first compile

    for (const ps of game.pads) this.pads.set(ps.def.id, this.makePad(ps));
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

    this.ambient = this.buildAmbient(th);
    this.camTarget.set(game.player.x, 0, game.player.z);
    this.applyQuality(this.quality);
  }

  private instanced(geo: THREE.BufferGeometry, m: THREE.Material, n: number, shadow = true): THREE.InstancedMesh {
    const im = new THREE.InstancedMesh(geo, m, n);
    im.count = 0;
    im.castShadow = shadow;
    im.frustumCulled = false;
    this.scene.add(im);
    return im;
  }

  private plane(w: number, d: number, color: number, x: number, z: number, y = 0.02): THREE.Mesh {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat(color, { flat: false }));
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, y, z);
    m.receiveShadow = true;
    this.scene.add(m);
    return m;
  }

  private buildGround(th: Theme): void {
    this.plane(240, 240, th.ground, 0, 0, 0);
    this.plane(17.4, 17.4, th.floor, 0, 0);
    const f = FOREST_PEN, m = MINE_PEN;
    this.plane(f.x1 - f.x0, f.z1 - f.z0, th.groundAlt, (f.x0 + f.x1) / 2, (f.z0 + f.z1) / 2, 0.015);
    this.plane(m.x1 - m.x0, m.z1 - m.z0, new THREE.Color(th.floor).lerp(new THREE.Color(th.rock), 0.55).getHex(), (m.x0 + m.x1) / 2, 0, 0.015);
    this.plane(3, 26, th.floor, COUNTER.x, COUNTER.z + 13);
  }

  private buildCamp(th: Theme): void {
    const s = this.scene;
    const positions: [number, number][] = [];
    for (const b of fenceBoxes()) {
      const horiz = b.w > b.d, len = horiz ? b.w : b.d;
      const n = Math.max(1, Math.round(len / 0.64));
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n - 0.5;
        positions.push(horiz ? [b.x + t * len, b.z] : [b.x, b.z + t * len]);
      }
    }
    const fence = new THREE.InstancedMesh(fenceLogGeometry(th.fence, th.fenceTop), vertexMat(), positions.length);
    const rnd = mulberry32(11);
    positions.forEach(([x, z], i) => {
      tmpQ.setFromEuler(tmpE.set(0, rnd() * 6, 0));
      fence.setMatrixAt(i, tmpM.compose(tmpP.set(x, 0, z), tmpQ, tmpS.set(1, 0.9 + rnd() * 0.2, 1)));
    });
    fence.castShadow = fence.receiveShadow = true;
    s.add(fence);

    for (const g of Object.values(GATES)) {
      const rig = makeGate(g.half * 2, th.gate, th.fence, th.fenceTop);
      rig.root.position.set(g.x, 0, g.z);
      if (!g.alongX) rig.root.rotation.y = Math.PI / 2;
      s.add(rig.root);
      this.gates.push({ rig, x: g.x, z: g.z, open: 0 });
    }

    const counter = makeCounter(th.fence);
    counter.position.set(COUNTER.x, 0, COUNTER.z);
    s.add(counter);
    const anvil = makeAnvil();
    anvil.position.set(FORGE_ZONE.x - 0.3, 0, FORGE_ZONE.z - 0.2);
    anvil.rotation.y = 0.5;
    s.add(anvil);
    this.campfire = makeCampfire();
    this.campfire.root.position.set(CAMPFIRE.x, 0, CAMPFIRE.z);
    s.add(this.campfire.root);

    s.add(this.zoneMarker(DEPOSIT_ZONE.x, DEPOSIT_ZONE.z, DEPOSIT_ZONE.w, DEPOSIT_ZONE.d, 'log'));
    s.add(this.zoneMarker(CASH_ZONE.x, CASH_ZONE.z, CASH_ZONE.w, CASH_ZONE.d, 'cash'));
    s.add(this.zoneMarker(FORGE_ZONE.x, FORGE_ZONE.z, FORGE_ZONE.w, FORGE_ZONE.d, 'forge'));
  }

  private zoneMarker(x: number, z: number, w: number, d: number, icon: 'log' | 'cash' | 'forge'): THREE.Mesh {
    const h = Math.round((256 * d) / w);
    const { ctx: c, tex } = canvasTex(256, h);
    c.fillStyle = icon === 'forge' ? 'rgba(255,140,40,0.22)' : 'rgba(60,35,20,0.18)';
    rr(c, 8, 8, 240, h - 16, 18);
    c.fill();
    brackets(c, 256, h, 14, 44, 12);
    c.globalAlpha = 0.9;
    if (icon === 'log') drawLogIcon(c, 128, h / 2, 90);
    else if (icon === 'cash') drawBill(c, 88, h / 2 - 22, 80);
    else {
      c.font = '96px system-ui, "Apple Color Emoji", "Noto Color Emoji", sans-serif';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText('🔨', 128, h / 2 + 6);
    }
    tex.needsUpdate = true;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, 0.04, z);
    return m;
  }

  private buildTrees(game: Game, g: { foliage: THREE.BufferGeometry; trunk: THREE.BufferGeometry }) {
    const n = game.trees.length;
    const f = new THREE.InstancedMesh(g.foliage, vertexMat(), n);
    const t = new THREE.InstancedMesh(g.trunk, vertexMat(), n);
    f.castShadow = t.castShadow = true;
    f.receiveShadow = true;
    f.frustumCulled = t.frustumCulled = false;
    this.scene.add(f, t);
    const rnd = mulberry32(3);
    const vary = game.trees.map(() => ({ s: 0.85 + rnd() * 0.3, r: rnd() * Math.PI * 2 }));
    return { foliage: f, trunk: t, vary };
  }

  private buildOres(game: Game, th: Theme) {
    const g = oreGeometries(th.rock);
    const n = game.ores.length;
    const rock = new THREE.InstancedMesh(g.rock, vertexMat(), n);
    rock.castShadow = rock.receiveShadow = true;
    rock.frustumCulled = false;
    this.scene.add(rock);
    const crystals = {} as Record<Gem, THREE.InstancedMesh>;
    for (const gem of ['em', 'di', 'ob'] as Gem[]) {
      const m = new THREE.InstancedMesh(g.crystals[gem], new THREE.MeshLambertMaterial({
        vertexColors: true, flatShading: true, emissive: GEM_COLOR[gem], emissiveIntensity: 0.25,
      }), n);
      m.castShadow = true;
      m.frustumCulled = false;
      m.count = 0;
      this.scene.add(m);
      crystals[gem] = m;
    }
    return { rock, crystals };
  }

  private buildAmbient(th: Theme): THREE.Points {
    const n = 600;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 46;
      pos[i * 3 + 1] = Math.random() * 18;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 46;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pt = th.particles;
    const p = new THREE.Points(g, new THREE.PointsMaterial({ color: pt.color, size: pt.size, transparent: true, opacity: pt.opacity, depthWrite: false }));
    p.frustumCulled = false;
    this.scene.add(p);
    return p;
  }

  // ---------- pads ----------

  private makePad(ps: PadState): PadView {
    const def = ps.def;
    const { ctx, tex } = canvasTex(256);
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(PAD_SIZE, PAD_SIZE), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
    plate.rotation.x = -Math.PI / 2;
    plate.position.set(def.x, 0.05, def.z);
    this.scene.add(plate);
    const icon = makePadIcon(def.icon, this.theme.gate);
    icon.position.set(def.x, 1.1, def.z);
    this.scene.add(icon);
    const l = canvasTex(320, 110);
    const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: l.tex, depthTest: false, transparent: true }));
    label.scale.set(2.3, 0.79, 1);
    label.position.set(def.x, 2.2, def.z);
    label.renderOrder = 9;
    this.scene.add(label);
    return { plate, ctx, tex, icon, label, lctx: l.ctx, ltex: l.tex, key: '' };
  }

  private drawPad(pv: PadView, remaining: Price, progress: number, name: string): void {
    const c = pv.ctx, S = 256;
    c.clearRect(0, 0, S, S);
    c.fillStyle = 'rgba(40,25,15,0.5)';
    rr(c, 10, 10, S - 20, S - 20, 26);
    c.fill();
    if (progress > 0) {
      c.save();
      rr(c, 10, 10, S - 20, S - 20, 26);
      c.clip();
      c.fillStyle = 'rgba(95,220,112,0.6)';
      c.fillRect(10, 10 + (S - 20) * (1 - progress), S - 20, (S - 20) * progress);
      c.restore();
    }
    brackets(c, S, S, 16, 56, 14);
    pv.tex.needsUpdate = true;

    // floating price tag
    const l = pv.lctx, W = 320, H = 110;
    l.clearRect(0, 0, W, H);
    l.fillStyle = 'rgba(20,32,52,0.8)';
    rr(l, 4, 4, W - 8, H - 8, 30);
    l.fill();
    l.font = '800 26px system-ui, sans-serif';
    l.textAlign = 'center';
    l.textBaseline = 'middle';
    l.fillStyle = '#ffe98a';
    l.fillText(name, W / 2, 30);
    const chips: [string, (x: number) => void][] = [];
    if (remaining.cash) chips.push([formatNum(remaining.cash), (x) => drawBill(l, x, 60, 40)]);
    for (const g of ['em', 'di', 'ob'] as Gem[]) {
      const n = remaining[g];
      if (n) chips.push([String(n), (x) => drawGem(l, x + 18, 72, 16, g)]);
    }
    l.font = '900 32px system-ui, sans-serif';
    const widths = chips.map(([t]) => 46 + l.measureText(t).width + 16);
    let x = W / 2 - widths.reduce((a, b) => a + b, 0) / 2;
    chips.forEach(([t, draw], i) => {
      draw(x);
      l.font = '900 32px system-ui, sans-serif';
      l.fillStyle = '#fff';
      l.textAlign = 'left';
      l.textBaseline = 'middle';
      l.fillText(t, x + 46, 74);
      x += widths[i];
    });
    pv.ltex.needsUpdate = true;
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
        case 'gems': hud.floatGems(e.price, e.x, 2.4, e.z); break;
        case 'build':
          this.burst(e.x, 0.5, e.z, 0xffd23f, 18, 7);
          this.burst(e.x, 0.5, e.z, 0xffffff, 12, 6);
          break;
        case 'shake': this.shakeT = Math.max(this.shakeT, e.power); break;
        case 'toast': hud.showToast(e.text, e.sub); break;
        case 'forge': hud.openForge(); break;
        case 'worldComplete': hud.worldComplete(); break;
        case 'offline': hud.showOffline(e.amount); break;
      }
    }
    events.length = 0;
  }

  private burst(x: number, y: number, z: number, color: number, n: number, speed: number): void {
    const col = new THREE.Color(color);
    for (let i = 0; i < n && this.particles.length < 500; i++) {
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
    this.trackFps(dt);
    const t = this.time, p = g.player;

    this.camTarget.lerp(tmpP.set(p.x, 0, p.z), Math.min(1, dt * 6));
    this.shakeT = Math.max(0, this.shakeT - dt);
    const sh = this.shakeT * 0.6;
    this.camera.position.copy(this.camTarget).addScaledVector(CAM_DIR, this.camDist);
    this.camera.position.x += (Math.random() - 0.5) * sh;
    this.camera.position.y += (Math.random() - 0.5) * sh;
    this.camera.lookAt(this.camTarget.x, 0.6, this.camTarget.z);
    this.sun.position.set(this.camTarget.x - 10, 26, this.camTarget.z + 8);
    this.sun.target.position.copy(this.camTarget);

    this.updatePlayer(g, t);
    this.updatePet(g, t);
    this.updateTents(g);
    this.updateTrees(g, t);
    this.updateOres(g, t);
    this.updateSurvivors(g);
    this.updateWorkers(g, t);
    this.updateEnemies(g, t);
    this.updateTowers(g, dt, t);
    this.updatePads(g, t);
    this.updatePiles(g, t);
    this.updateFx(dt);

    for (const gt of this.gates) {
      let near = Math.hypot(p.x - gt.x, p.z - gt.z) < 3.2;
      for (const w of g.workers) if (Math.hypot(w.x - gt.x, w.z - gt.z) < 3) near = true;
      if (g.breached && gt.x > 0) near = true;
      gt.open += ((near ? 1 : 0) - gt.open) * Math.min(1, dt * 8);
      gt.rig.left.rotation.y = -gt.open * 1.4;
      gt.rig.right.rotation.y = Math.PI + gt.open * 1.4;
    }

    // campfire flicker, lava shimmer
    this.campfire.flames.forEach((f, i) => {
      const k = 1 + Math.sin(t * (9 + i * 3) + i) * 0.12 + Math.sin(t * 17 + i) * 0.06;
      f.scale.set(k, 1 + Math.sin(t * 11 + i * 2) * 0.2, k);
    });
    this.campfire.light.intensity = 5 + Math.sin(t * 13) * 0.8;
    for (const l of this.lava) l.position.y = 0.04 + Math.sin(t * 2 + l.position.x) * 0.01;

    // guide arrow above the objective, plus a ground pointer when it's far away
    this.arrow.visible = !!objective && !g.worldDone;
    this.pointer.visible = false;
    if (objective && !g.worldDone) {
      this.arrow.position.set(objective.x, 3.4 + Math.abs(Math.sin(t * 4)) * 0.5, objective.z);
      this.arrow.rotation.y = t * 2;
      const dx = objective.x - p.x, dz = objective.z - p.z, d = Math.hypot(dx, dz);
      if (d > 4) {
        this.pointer.visible = true;
        this.pointer.position.set(p.x + (dx / d) * 1.9, 0.06, p.z + (dz / d) * 1.9);
        this.pointer.rotation.z = Math.atan2(-dx, -dz);
      }
    }

    // ambient particles (snow, dust, fireflies, embers…) around the camera target
    const pt = this.theme.particles;
    const sp = this.ambient.geometry.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < sp.count; i++) {
      let y = sp.getY(i) - dt * pt.fall;
      let x = sp.getX(i) + Math.sin(t * 0.7 + i) * dt * pt.drift;
      let z = sp.getZ(i) + Math.cos(t * 0.5 + i) * dt * pt.drift * 0.5;
      if (y < 0 || y > 18) { y = pt.rise ? 0.2 : 18; x = (Math.random() - 0.5) * 46; z = (Math.random() - 0.5) * 46; }
      sp.setXYZ(i, x, y, z);
    }
    sp.needsUpdate = true;
    this.ambient.position.set(this.camTarget.x, 0, this.camTarget.z);

    this.renderer.render(this.scene, this.camera);
  }

  private updatePlayer(g: Game, t: number): void {
    const p = g.player, prof = g.profile;
    const key = `${prof.skin}|${prof.levels.bag}`;
    if (key !== this.playerKey) {
      if (this.player) this.scene.remove(this.player.root);
      const skin = skinDef(prof.skin);
      this.player = makeCharacter(skin.color, skin.trim, 'hood');
      this.player.root.scale.setScalar(CHAR_SCALE);
      this.player.backpack.add(makeBackpack(skin.id === 'blue' ? 0xe0823a : new THREE.Color(skin.color).multiplyScalar(0.8).getHex(), prof.levels.bag));
      this.player.backpack.visible = true;
      this.scene.add(this.player.root);
      this.playerKey = key;
      this.axeKey = '';
    }
    const axeKey = `${g.axes}|${prof.levels.axe}|${prof.levels.pick}`;
    if (axeKey !== this.axeKey) {
      for (const a of this.axes) this.axeGroup.remove(a);
      this.axes = [];
      const tier = TOOL_TIERS[Math.min(prof.levels.axe, TOOL_TIERS.length - 1)];
      for (let i = 0; i < g.axes; i++) { const a = makeAxe(tier); this.axes.push(a); this.axeGroup.add(a); }
      if (this.pickaxe) this.pickaxe.parent?.remove(this.pickaxe);
      this.pickaxe = makePickaxe(TOOL_TIERS[Math.min(prof.levels.pick, TOOL_TIERS.length - 1)]);
      this.pickaxe.rotation.x = Math.PI / 2;
      this.player.hand.add(this.pickaxe);
      this.axeKey = axeKey;
    }
    const pr = this.player;
    pr.root.position.set(p.x, 0, p.z);
    pr.root.rotation.y = p.face;
    animateCharacter(pr, p.walkT, p.moving, p.stack.length > 0);
    const mining = !!p.mining;
    if (this.pickaxe) this.pickaxe.visible = mining;
    if (mining) pr.armR.rotation.x = -1.6 + Math.sin(t * 16) * 1.0;
    pr.root.visible = !(p.hurtT > 0 && Math.floor(t * 16) % 2 === 0);
    this.axeGroup.position.set(p.x, 0.95, p.z);
    this.axeGroup.visible = !mining;
    this.axes.forEach((a, i) => {
      const ang = p.axeAngle + (i / this.axes.length) * Math.PI * 2;
      a.position.set(Math.cos(ang) * 1.55, 0, Math.sin(ang) * 1.55);
      a.rotation.set(Math.PI / 2, 0, -ang + t * 14);
    });

    // carried log stack in the player's arms
    const n = Math.min(p.stack.length, 70);
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
  }

  private updatePet(g: Game, t: number): void {
    const pet = g.pet;
    const id = pet?.id ?? '';
    if (id !== this.petId) {
      if (this.petRig) this.scene.remove(this.petRig.root);
      this.petRig = pet ? makePet(pet.id) : null;
      if (this.petRig) this.scene.add(this.petRig.root);
      this.petId = id;
    }
    if (!pet || !this.petRig) return;
    const r = this.petRig;
    r.root.position.set(pet.x, r.flying ? 1.6 + Math.sin(t * 3) * 0.15 : 0, pet.z);
    r.root.rotation.y = pet.face;
    r.wings.forEach((w, i) => { w.rotation.z = Math.sin(t * 14) * 0.6 * (i ? -1 : 1); });
    if (r.tail) r.tail.rotation.y = Math.sin(t * 5) * 0.4;
    if (!r.flying) r.body.position.y = Math.abs(Math.sin(pet.walkT)) * 0.08;
  }

  private updateTents(g: Game): void {
    const n = Math.min(g.level('tent'), TENT_SPOTS.length);
    const colors = [0xe8a23a, 0x3aa0e8, 0xe85a5a];
    while (this.tents.length < n) {
      const i = this.tents.length, spot = TENT_SPOTS[i];
      const tent = makeTent(colors[i % colors.length]);
      tent.position.set(spot.x, 0, spot.z);
      tent.rotation.y = 0.4 + i * 0.5;
      this.scene.add(tent);
      this.tents.push(tent);
      this.burst(spot.x, 1, spot.z, 0xffd23f, 16, 5);
    }
  }

  private updateTrees(g: Game, t: number): void {
    const { foliage, trunk, vary } = this.trees;
    g.trees.forEach((tr, i) => {
      const v = vary[i];
      const alive = tr.hp > 0;
      const wob = tr.shake > 0 ? Math.sin(t * 45) * tr.shake * 0.35 : 0;
      if (!alive && tr.fallT < 0.9) {
        // timber! the whole tree tips over away from the chopper, then sinks away
        const k = Math.min(1, tr.fallT / 0.5);
        tmpA.set(Math.cos(tr.fallDir), 0, -Math.sin(tr.fallDir));
        tmpQ.setFromAxisAngle(tmpA, k * k * (Math.PI / 2) * 0.95).multiply(tmpQ2.setFromAxisAngle(Y, v.r));
        const sink = Math.max(0, tr.fallT - 0.55) * 1.8;
        const sc = v.s * Math.max(0.01, 1 - sink * 0.6);
        tmpM.compose(tmpP.set(tr.x, -sink * 0.3, tr.z), tmpQ, tmpS.set(sc, sc, sc));
        foliage.setMatrixAt(i, tmpM);
        trunk.setMatrixAt(i, tmpM);
        return;
      }
      if (!alive) {
        setInst(foliage, i, tr.x, -9, tr.z, 0, 0.001);
        tmpQ.setFromEuler(tmpE.set(0, v.r, 0));
        trunk.setMatrixAt(i, tmpM.compose(tmpP.set(tr.x, 0, tr.z), tmpQ, tmpS.set(v.s, 0.32, v.s)));
        return;
      }
      const s = v.s * Math.max(0.01, easeOutBack(tr.grow));
      setInst(foliage, i, tr.x, 0, tr.z, v.r, s, wob, wob * 0.5);
      setInst(trunk, i, tr.x, 0, tr.z, v.r, s, wob * 0.5, 0);
    });
    foliage.instanceMatrix.needsUpdate = true;
    trunk.instanceMatrix.needsUpdate = true;
  }

  private updateOres(g: Game, t: number): void {
    const { rock, crystals } = this.ores;
    const idx: Record<Gem, number> = { em: 0, di: 0, ob: 0 };
    g.ores.forEach((o, i) => {
      const wob = o.shake > 0 ? Math.sin(t * 50) * o.shake * 0.3 : 0;
      const alive = o.hp > 0;
      const r = (i * 1.7) % (Math.PI * 2);
      setInst(rock, i, o.x + wob * 0.2, 0, o.z, r, alive ? 1 : 0.55, 0, wob);
      if (alive) {
        const s = Math.max(0.01, easeOutBack(o.grow)) * (0.85 + (o.hp / o.maxHp) * 0.15);
        setInst(crystals[o.gem], idx[o.gem]++, o.x + wob * 0.2, 0, o.z, r, s, 0, wob);
      }
    });
    rock.instanceMatrix.needsUpdate = true;
    for (const gem of ['em', 'di', 'ob'] as Gem[]) {
      crystals[gem].count = idx[gem];
      crystals[gem].instanceMatrix.needsUpdate = true;
    }
  }

  private updateSurvivors(g: Game): void {
    const seen = new Set<number>();
    const [coat, trim] = SURVIVOR_COAT[g.world.def.survivor];
    for (const s of g.survivors) {
      seen.add(s.id);
      let rig = this.survivors.get(s.id);
      if (!rig) {
        rig = makeCharacter(coat, trim, g.world.def.survivor);
        rig.root.scale.setScalar(CHAR_SCALE);
        this.survivors.set(s.id, rig);
        this.scene.add(rig.root);
      }
      rig.root.position.set(s.x, 0, s.z);
      rig.root.rotation.y = s.face;
      animateCharacter(rig, s.walkT, s.state !== 'wait', false);
      if (s.state === 'wait') rig.body.position.y = Math.abs(Math.sin(this.time * 2 + s.id)) * 0.03;
    }
    for (const [id, rig] of this.survivors) if (!seen.has(id)) { this.scene.remove(rig.root); this.survivors.delete(id); }

    const front = g.survivors.filter((s) => s.state !== 'leave' && s.slot < 2).sort((a, b) => a.slot - b.slot);
    this.bubbles.forEach((b, i) => {
      const s = front[i];
      b.sprite.visible = !!s;
      if (!s) return;
      const left = s.want - s.got;
      if (`${left}` !== b.key) { this.drawBubble(b, left); b.key = `${left}`; }
      b.sprite.position.set(s.x, 3.6 + Math.sin(this.time * 3 + i) * 0.06, s.z);
    });
  }

  private updateWorkers(g: Game, t: number): void {
    let li = 0;
    for (const w of g.workers) {
      let rig = this.workers.get(w.id);
      if (!rig) {
        rig = w.kind === 'miner' ? makeCharacter(0x6b5a4a, 0xf5b82e, 'miner') : makeCharacter(0xf0a030, 0xffffff, 'beanie');
        rig.root.scale.setScalar(CHAR_SCALE);
        const tool = w.kind === 'miner' ? makePickaxe(0xd0d6de) : makeAxe(0xd0d6de);
        tool.rotation.x = Math.PI / 2;
        rig.hand.add(tool);
        this.workers.set(w.id, rig);
        this.scene.add(rig.root);
      }
      rig.root.position.set(w.x, 0, w.z);
      rig.root.rotation.y = w.face;
      animateCharacter(rig, w.walkT, w.moving, w.carry > 0);
      if (w.state === 'chop' || w.state === 'mine') rig.armR.rotation.x = -1.5 + Math.sin(t * 12 + w.id) * 0.9;
      const sin = Math.sin(w.face), cos = Math.cos(w.face);
      for (let i = 0; i < w.carry && li < 16; i++) setInst(this.workerLogs, li++, w.x + 0.7 * sin, 1.05 * CHAR_SCALE + i * 0.33, w.z + 0.7 * cos, w.face);
    }
    this.workerLogs.count = li;
    this.workerLogs.instanceMatrix.needsUpdate = true;
  }

  private updateEnemies(g: Game, t: number): void {
    const seen = new Set<number>();
    for (const b of g.enemies) {
      if (b.state === 'spawn') continue;
      seen.add(b.id);
      let v = this.enemies.get(b.id);
      if (!v) {
        const rig = makeEnemy(b.kind);
        if (b.boss) { rig.root.scale.setScalar(2.1); rig.crown.visible = true; }
        const hpBg = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0x1d2633, depthTest: false }));
        const hpFill = new THREE.Sprite(new THREE.SpriteMaterial({ color: b.boss ? 0xff5a4f : 0x9be34b, depthTest: false }));
        hpBg.scale.set(b.boss ? 2.4 : 1.3, b.boss ? 0.26 : 0.18, 1);
        hpFill.center.set(0, 0.5);
        hpBg.renderOrder = hpFill.renderOrder = 11;
        this.scene.add(rig.root, hpBg, hpFill);
        v = { rig, hpBg, hpFill };
        this.enemies.set(b.id, v);
      }
      const { rig, hpBg, hpFill } = v;
      rig.root.position.set(b.x, 0, b.z);
      rig.root.rotation.y = b.face;
      const attack = b.state === 'attack'
        ? Math.max(0, Math.sin((b.atkT / b.attackEvery) * Math.PI))
        : b.state === 'chase' ? Math.max(0, Math.sin((b.atkT / 1.1) * Math.PI)) : 0;
      animateEnemy(rig, {
        moving: b.state === 'approach' || (b.state === 'chase' && b.atkT === 0), attack, t: t + b.id, walkT: b.walkT,
        dead: b.state === 'dead' ? b.deadT + 0.0001 : 0,
      });
      const burn = b.burnT > 0 ? 0.25 + Math.sin(t * 20) * 0.1 : 0;
      rig.material.emissive.setRGB(b.flash * 0.5 + burn, burn * 0.35, b.slowT > 0 ? 0.35 : 0);
      const showHp = b.state !== 'dead' && b.hp < b.maxHp;
      hpBg.visible = hpFill.visible = showHp;
      if (showHp) {
        const y = rig.height * (b.boss ? 2.1 : 1) + 0.6;
        const full = b.boss ? 2.3 : 1.2;
        hpBg.position.set(b.x, y, b.z);
        hpFill.scale.set(Math.max(0.001, full * Math.max(0, b.hp / b.maxHp)), b.boss ? 0.18 : 0.12, 1);
        tmpP.set(-full / 2, 0, 0).applyQuaternion(this.camera.quaternion);
        hpFill.position.set(b.x + tmpP.x, y + tmpP.y, b.z + tmpP.z);
      }
    }
    for (const [id, v] of this.enemies) {
      if (seen.has(id)) continue;
      this.scene.remove(v.rig.root, v.hpBg, v.hpFill);
      v.rig.material.dispose();
      this.enemies.delete(id);
    }
  }

  private updateTowers(g: Game, dt: number, t: number): void {
    for (const tw of g.towers) {
      let v = this.towers.get(tw.id);
      if (!v) {
        v = { rig: makeTower(this.theme.fence, this.theme.gate, tw.kind), t: 0 };
        v.rig.root.position.set(tw.x, 0, tw.z);
        this.scene.add(v.rig.root);
        this.towers.set(tw.id, v);
      }
      v.t = Math.min(1, v.t + dt * 2.2);
      v.rig.root.scale.setScalar(Math.max(0.01, easeOutBack(v.t)));
      v.rig.head.rotation.y = tw.aim;
      v.rig.stock.position.z = -tw.recoil * 0.25;
      v.rig.flag.rotation.y = Math.sin(t * 3 + tw.x) * 0.3;
    }
    const seen = new Set<number>();
    for (const b of g.bolts) {
      seen.add(b.id);
      let m = this.bolts.get(b.id);
      if (!m) { m = new THREE.Mesh(this.boltGeo[b.kind as TowerKind], vertexMat()); this.bolts.set(b.id, m); this.scene.add(m); }
      m.position.set(b.x, b.y, b.z);
      if (b.kind === 'fire' && Math.random() < 0.5) this.burst(b.x, b.y, b.z, 0xff8a2a, 1, 0.5);
      m.lookAt(b.x + b.dx, b.y + b.dy, b.z + b.dz);
    }
    for (const [id, m] of this.bolts) if (!seen.has(id)) { this.scene.remove(m); this.bolts.delete(id); }

    // the portal appears once it has been paid for
    const portalPad = g.pad('portal');
    if (portalPad.level > 0 && !this.portal) {
      const next = WORLDS[(g.profile.world + 1) % WORLDS.length].id;
      this.portal = makePortal(THEMES[next].portal, 0x8d939b);
      this.portal.root.position.set(portalPad.def.x, 0, portalPad.def.z);
      this.scene.add(this.portal.root);
      this.burst(portalPad.def.x, 1.3, portalPad.def.z, THEMES[next].portal, 40, 6);
    }
    if (this.portal) {
      this.portal.disc.rotation.z = t * 2.5;
      this.portal.ring.scale.setScalar(1 + Math.sin(t * 4) * 0.04);
      if (Math.random() < 0.3) this.burst(portalPad.def.x + (Math.random() - 0.5) * 2, 0.3, portalPad.def.z, 0xffffff, 1, 1);
    }
  }

  private updatePads(g: Game, t: number): void {
    for (const ps of g.pads) {
      const pv = this.pads.get(ps.def.id)!;
      const vis = g.padVisible(ps);
      pv.plate.visible = pv.icon.visible = pv.label.visible = vis;
      if (!vis) continue;
      const rem = g.padRemaining(ps), prog = g.padProgress(ps);
      const key = `${JSON.stringify(rem)}|${Math.round(prog * 30)}`;
      if (key !== pv.key) {
        const multi = ps.def.max > 1;
        this.drawPad(pv, rem, prog, multi ? `${T.pad[ps.def.id]} ${ps.level + 1}` : T.pad[ps.def.id]);
        pv.key = key;
      }
      pv.plate.scale.setScalar(1 + ps.pulse * 0.6);
      pv.icon.position.y = 1.1 + Math.sin(t * 2.5 + ps.def.x) * 0.12;
      pv.icon.rotation.y = t * 1.2;
      pv.label.position.y = 2.25 + Math.sin(t * 2.5 + ps.def.x) * 0.05;
    }
  }

  private updatePiles(g: Game, t: number): void {
    const n = Math.min(g.counterLogs, 50);
    for (let i = 0; i < n; i++) {
      const col = i % 10, layer = Math.floor(i / 10);
      setInst(this.counterLogs, i, COUNTER.x - 1.62 + col * 0.36, 1.2 + layer * 0.32, COUNTER.z, Math.PI / 2);
    }
    this.counterLogs.count = n;
    this.counterLogs.instanceMatrix.needsUpdate = true;

    const bills = Math.min(90, Math.ceil(g.cashPile / (5 * g.world.priceMult)));
    for (let i = 0; i < bills; i++) {
      const slot = i % 6, layer = Math.floor(i / 6);
      const x = CASH_ZONE.x + (slot % 2 ? 0.38 : -0.38), z = CASH_ZONE.z + (Math.floor(slot / 2) - 1) * 0.42;
      setInst(this.cashPile, i, x, 0.1 + layer * 0.14, z, 0);
    }
    this.cashPile.count = bills;
    this.cashPile.instanceMatrix.needsUpdate = true;

    let di = 0;
    for (const d of g.drops) {
      for (let k = 0; k < 3 && di < 120; k++) setInst(this.drops, di++, d.x, 0.35 + k * 0.14 + Math.sin(t * 4 + d.id) * 0.12, d.z, t * 2 + d.id + k * 0.3);
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
