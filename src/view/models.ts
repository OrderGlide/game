// Procedural low-poly models built from primitives — no asset files needed.
// Static parts of a model are merged into one vertex-coloured mesh to keep draw calls low.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export const COLORS = {
  snow: 0xeef3f9,
  dirt: 0xb98468,
  bark: 0x9c5f2e,
  logEnd: 0xecc795,
  wood: 0xc98b4f,
  woodDark: 0x8f5a2b,
  pine: 0x2f9e4a,
  pineLight: 0x46b95c,
  gate: 0x3b82d6,
  parka: 0x2f8cf0,
  fur: 0xffffff,
  skin: 0xffcfa6,
  santa: 0xe0413b,
  worker: 0xf0a030,
  bear: 0xf3f5f8,
  cash: 0x39c24c,
  cashLight: 0x9df2a6,
  dark: 0x2a2f3a,
  steel: 0xc9d2dc,
};

const matCache = new Map<string, THREE.MeshLambertMaterial>();
export function mat(color: number, opts: { flat?: boolean; vertex?: boolean } = {}): THREE.MeshLambertMaterial {
  const key = `${color}-${opts.flat ?? true}-${opts.vertex ?? false}`;
  let m = matCache.get(key);
  if (!m) {
    m = new THREE.MeshLambertMaterial({ color, flatShading: opts.flat ?? true, vertexColors: opts.vertex ?? false });
    matCache.set(key, m);
  }
  return m;
}
export const vertexMat = () => mat(0xffffff, { vertex: true });

interface Part {
  geo: THREE.BufferGeometry; color: number;
  pos?: [number, number, number]; rot?: [number, number, number]; scale?: [number, number, number];
}

/** Merge primitive parts into one geometry with per-vertex colours. */
export function merged(parts: Part[]): THREE.BufferGeometry {
  const geos = parts.map((p) => {
    let g = p.geo.index ? p.geo.toNonIndexed() : p.geo.clone();
    g.deleteAttribute('uv');
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(...(p.pos ?? [0, 0, 0])),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(...(p.rot ?? [0, 0, 0]))),
      new THREE.Vector3(...(p.scale ?? [1, 1, 1])),
    );
    g.applyMatrix4(m);
    const c = new THREE.Color(p.color);
    const n = g.getAttribute('position').count;
    const cols = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    g = g.index ? g.toNonIndexed() : g;
    return g;
  });
  const out = mergeGeometries(geos, false)!;
  out.computeVertexNormals();
  return out;
}

const shadowed = <T extends THREE.Object3D>(o: T): T => {
  o.traverse((c) => { if ((c as THREE.Mesh).isMesh) { c.castShadow = true; } });
  return o;
};

// ---------- characters ----------

export interface CharacterRig {
  root: THREE.Group; body: THREE.Group; legL: THREE.Mesh; legR: THREE.Mesh; armL: THREE.Mesh; armR: THREE.Mesh;
}

/** Chunky parka-wearing character. `hat` picks the headwear. */
export function makeCharacter(coat: number, hat: 'hood' | 'santa' | 'beanie'): CharacterRig {
  const parts: Part[] = [
    { geo: new THREE.CapsuleGeometry(0.4, 0.42, 3, 10), color: coat, pos: [0, 0.92, 0] },
    { geo: new THREE.TorusGeometry(0.38, 0.11, 5, 14), color: COLORS.fur, pos: [0, 0.6, 0], rot: [Math.PI / 2, 0, 0] },
    { geo: new THREE.BoxGeometry(0.1, 0.5, 0.06), color: COLORS.fur, pos: [0, 0.95, 0.4] },
    { geo: new THREE.SphereGeometry(0.34, 12, 10), color: COLORS.skin, pos: [0, 1.55, 0.02] },
    { geo: new THREE.SphereGeometry(0.045, 6, 5), color: COLORS.dark, pos: [-0.12, 1.6, 0.31] },
    { geo: new THREE.SphereGeometry(0.045, 6, 5), color: COLORS.dark, pos: [0.12, 1.6, 0.31] },
  ];
  if (hat === 'hood') {
    parts.push(
      { geo: new THREE.SphereGeometry(0.44, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.62), color: coat, pos: [0, 1.58, -0.06] },
      { geo: new THREE.TorusGeometry(0.33, 0.1, 6, 16), color: COLORS.fur, pos: [0, 1.56, 0.2] },
    );
  } else if (hat === 'santa') {
    parts.push(
      { geo: new THREE.ConeGeometry(0.33, 0.6, 10), color: COLORS.santa, pos: [0, 2.0, -0.05], rot: [-0.35, 0, 0] },
      { geo: new THREE.TorusGeometry(0.31, 0.09, 6, 14), color: COLORS.fur, pos: [0, 1.78, 0], rot: [Math.PI / 2, 0, 0] },
      { geo: new THREE.SphereGeometry(0.1, 8, 6), color: COLORS.fur, pos: [0, 2.24, -0.2] },
      { geo: new THREE.SphereGeometry(0.2, 8, 6), color: COLORS.fur, pos: [0, 1.38, 0.24], scale: [1.1, 0.8, 0.7] },
    );
  } else {
    parts.push(
      { geo: new THREE.SphereGeometry(0.37, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), color: 0x2d9e5a, pos: [0, 1.66, 0] },
      { geo: new THREE.TorusGeometry(0.34, 0.07, 5, 14), color: 0x2a7a48, pos: [0, 1.68, 0], rot: [Math.PI / 2, 0, 0] },
      { geo: new THREE.SphereGeometry(0.09, 6, 5), color: 0xffffff, pos: [0, 2.03, 0] },
    );
  }
  const body = new THREE.Group();
  body.add(new THREE.Mesh(merged(parts), vertexMat()));
  const legGeo = merged([
    { geo: new THREE.BoxGeometry(0.2, 0.42, 0.24), color: 0x2d3d63, pos: [0, -0.21, 0] },
    { geo: new THREE.BoxGeometry(0.22, 0.12, 0.3), color: 0x3a2a22, pos: [0, -0.4, 0.03] },
  ]);
  const armGeo = merged([
    { geo: new THREE.CapsuleGeometry(0.11, 0.3, 2, 8), color: coat, pos: [0, -0.2, 0] },
    { geo: new THREE.SphereGeometry(0.12, 8, 6), color: COLORS.fur, pos: [0, -0.43, 0] },
  ]);
  const legL = new THREE.Mesh(legGeo, vertexMat()); legL.position.set(-0.15, 0.45, 0);
  const legR = new THREE.Mesh(legGeo, vertexMat()); legR.position.set(0.15, 0.45, 0);
  const armL = new THREE.Mesh(armGeo, vertexMat()); armL.position.set(-0.47, 1.12, 0);
  const armR = new THREE.Mesh(armGeo, vertexMat()); armR.position.set(0.47, 1.12, 0);
  const root = new THREE.Group();
  body.add(armL, armR);
  root.add(body, legL, legR);
  return { root: shadowed(root), body, legL, legR, armL, armR };
}

export function animateCharacter(r: CharacterRig, walkT: number, moving: boolean, carrying: boolean): void {
  const s = moving ? Math.sin(walkT) : 0;
  r.legL.rotation.x = s * 0.7;
  r.legR.rotation.x = -s * 0.7;
  r.body.position.y = moving ? Math.abs(Math.cos(walkT)) * 0.07 : 0;
  if (carrying) {
    r.armL.rotation.x = r.armR.rotation.x = -1.2;
  } else {
    r.armL.rotation.x = -s * 0.6;
    r.armR.rotation.x = s * 0.6;
  }
}

// ---------- polar bear ----------

export interface BearRig { root: THREE.Group; body: THREE.Mesh; legs: THREE.Mesh[]; material: THREE.MeshLambertMaterial; }

let bearBodyGeo: THREE.BufferGeometry | null = null;
let bearLegGeo: THREE.BufferGeometry | null = null;
export function makeBear(): BearRig {
  bearBodyGeo ??= merged([
    { geo: new THREE.CapsuleGeometry(0.55, 0.85, 4, 12), color: COLORS.bear, pos: [0, 0.98, -0.05], rot: [Math.PI / 2, 0, 0] },
    { geo: new THREE.SphereGeometry(0.62, 12, 10), color: COLORS.bear, pos: [0, 1.12, -0.35], scale: [1, 1, 1.1] },
    { geo: new THREE.SphereGeometry(0.4, 12, 10), color: COLORS.bear, pos: [0, 1.22, 0.85] },
    { geo: new THREE.SphereGeometry(0.22, 10, 8), color: 0xe8ebef, pos: [0, 1.1, 1.18], scale: [1, 0.85, 1.1] },
    { geo: new THREE.SphereGeometry(0.08, 6, 5), color: COLORS.dark, pos: [0, 1.17, 1.4] },
    { geo: new THREE.SphereGeometry(0.05, 6, 5), color: COLORS.dark, pos: [-0.16, 1.35, 1.17] },
    { geo: new THREE.SphereGeometry(0.05, 6, 5), color: COLORS.dark, pos: [0.16, 1.35, 1.17] },
    { geo: new THREE.SphereGeometry(0.12, 8, 6), color: COLORS.bear, pos: [-0.27, 1.55, 0.78] },
    { geo: new THREE.SphereGeometry(0.12, 8, 6), color: COLORS.bear, pos: [0.27, 1.55, 0.78] },
    { geo: new THREE.SphereGeometry(0.12, 8, 6), color: COLORS.bear, pos: [0, 1.05, -1.0] },
  ]);
  bearLegGeo ??= merged([
    { geo: new THREE.CylinderGeometry(0.2, 0.17, 0.75, 8), color: 0xd3dbe5, pos: [0, -0.37, 0] },
    { geo: new THREE.CylinderGeometry(0.19, 0.21, 0.12, 8), color: 0x9aa6b5, pos: [0, -0.72, 0.03] },
  ]);
  const material = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  const root = new THREE.Group();
  const body = new THREE.Mesh(bearBodyGeo, material);
  root.add(body);
  const legs: THREE.Mesh[] = [];
  for (const [x, z] of [[-0.32, 0.5], [0.32, 0.5], [-0.32, -0.55], [0.32, -0.55]]) {
    const l = new THREE.Mesh(bearLegGeo, material);
    l.position.set(x, 0.75, z);
    root.add(l);
    legs.push(l);
  }
  root.scale.setScalar(1.35);
  return { root: shadowed(root), body, legs, material };
}

// ---------- props ----------

let logGeoCache: THREE.BufferGeometry | null = null;
/** A log lying along the x axis. */
export function logGeometry(): THREE.BufferGeometry {
  logGeoCache ??= merged([
    { geo: new THREE.CylinderGeometry(0.17, 0.17, 0.86, 9, 1, true), color: COLORS.bark, rot: [0, 0, Math.PI / 2] },
    { geo: new THREE.CircleGeometry(0.17, 9), color: COLORS.logEnd, pos: [0.43, 0, 0], rot: [0, Math.PI / 2, 0] },
    { geo: new THREE.CircleGeometry(0.17, 9), color: COLORS.logEnd, pos: [-0.43, 0, 0], rot: [0, -Math.PI / 2, 0] },
    { geo: new THREE.CircleGeometry(0.07, 7), color: 0xd9a86a, pos: [0.432, 0, 0], rot: [0, Math.PI / 2, 0] },
  ]);
  return logGeoCache;
}

let billGeoCache: THREE.BufferGeometry | null = null;
export function billGeometry(): THREE.BufferGeometry {
  billGeoCache ??= merged([
    { geo: new THREE.BoxGeometry(0.7, 0.13, 0.36), color: COLORS.cash },
    { geo: new THREE.BoxGeometry(0.16, 0.135, 0.365), color: COLORS.cashLight },
  ]);
  return billGeoCache;
}

export function pineGeometries(): { foliage: THREE.BufferGeometry; trunk: THREE.BufferGeometry } {
  const foliage = merged([
    { geo: new THREE.ConeGeometry(1.15, 1.5, 7), color: COLORS.pine, pos: [0, 1.55, 0] },
    { geo: new THREE.ConeGeometry(0.9, 1.3, 7), color: COLORS.pineLight, pos: [0, 2.35, 0], rot: [0, 0.4, 0] },
    { geo: new THREE.ConeGeometry(0.58, 1.1, 7), color: COLORS.pine, pos: [0, 3.05, 0], rot: [0, 0.8, 0] },
    { geo: new THREE.ConeGeometry(0.3, 0.45, 7), color: 0xffffff, pos: [0, 3.5, 0] },
  ]);
  const trunk = merged([
    { geo: new THREE.CylinderGeometry(0.2, 0.26, 1.0, 7), color: COLORS.bark, pos: [0, 0.5, 0] },
    { geo: new THREE.CylinderGeometry(0.2, 0.2, 0.02, 7), color: COLORS.logEnd, pos: [0, 1.0, 0] },
  ]);
  return { foliage, trunk };
}

export function fenceLogGeometry(): THREE.BufferGeometry {
  return merged([
    { geo: new THREE.CylinderGeometry(0.33, 0.33, 1.25, 10, 1, true), color: COLORS.wood, pos: [0, 0.62, 0] },
    { geo: new THREE.CircleGeometry(0.33, 10), color: COLORS.logEnd, pos: [0, 1.25, 0], rot: [-Math.PI / 2, 0, 0] },
    { geo: new THREE.RingGeometry(0.12, 0.16, 10), color: 0xd9a86a, pos: [0, 1.255, 0], rot: [-Math.PI / 2, 0, 0] },
  ]);
}

export interface GateRig { root: THREE.Group; left: THREE.Group; right: THREE.Group; }
/** Double gate spanning `width`, laid out along local x. */
export function makeGate(width: number): GateRig {
  const root = new THREE.Group();
  const half = width / 2;
  const leafGeo = merged([
    { geo: new THREE.BoxGeometry(half - 0.05, 1.05, 0.14), color: COLORS.woodDark, pos: [(half - 0.05) / 2, 0.62, 0] },
    { geo: new THREE.BoxGeometry(half - 0.35, 0.75, 0.16), color: COLORS.gate, pos: [(half - 0.05) / 2, 0.62, 0] },
    { geo: new THREE.BoxGeometry(0.1, 1.15, 0.18), color: COLORS.wood, pos: [(half - 0.05) / 2, 0.62, 0], rot: [0, 0, 0.9] },
  ]);
  const left = new THREE.Group();
  left.position.x = -half;
  left.add(new THREE.Mesh(leafGeo, vertexMat()));
  const right = new THREE.Group();
  right.position.x = half;
  right.rotation.y = Math.PI;
  right.add(new THREE.Mesh(leafGeo, vertexMat()));
  const postGeo = merged([
    { geo: new THREE.CylinderGeometry(0.38, 0.38, 1.6, 10), color: COLORS.wood, pos: [0, 0.8, 0] },
    { geo: new THREE.CircleGeometry(0.38, 10), color: COLORS.logEnd, pos: [0, 1.601, 0], rot: [-Math.PI / 2, 0, 0] },
  ]);
  for (const x of [-half - 0.2, half + 0.2]) {
    const p = new THREE.Mesh(postGeo, vertexMat());
    p.position.x = x;
    root.add(p);
  }
  root.add(left, right);
  return { root: shadowed(root), left, right };
}

export interface TowerRig { root: THREE.Group; head: THREE.Group; stock: THREE.Mesh; }
export function makeTower(): TowerRig {
  const root = new THREE.Group();
  const base = new THREE.Mesh(merged([
    { geo: new THREE.CylinderGeometry(0.72, 0.86, 1.9, 8), color: COLORS.wood, pos: [0, 0.95, 0] },
    { geo: new THREE.CylinderGeometry(0.74, 0.74, 0.08, 8), color: COLORS.woodDark, pos: [0, 0.5, 0] },
    { geo: new THREE.CylinderGeometry(0.74, 0.74, 0.08, 8), color: COLORS.woodDark, pos: [0, 1.3, 0] },
    { geo: new THREE.CylinderGeometry(1.0, 0.95, 0.24, 8), color: COLORS.logEnd, pos: [0, 2.0, 0] },
  ]), vertexMat());
  root.add(base);
  const head = new THREE.Group();
  head.position.y = 2.35;
  const mount = new THREE.Mesh(merged([
    { geo: new THREE.CylinderGeometry(0.22, 0.3, 0.35, 8), color: COLORS.woodDark, pos: [0, -0.1, 0] },
  ]), vertexMat());
  const stock = new THREE.Mesh(merged([
    { geo: new THREE.BoxGeometry(0.26, 0.2, 1.4), color: COLORS.wood, pos: [0, 0.12, 0.1] },
    { geo: new THREE.TorusGeometry(0.62, 0.06, 5, 14, Math.PI), color: 0x3b6fb6, pos: [0, 0.14, 0.6], rot: [Math.PI / 2, 0, 0] },
    { geo: new THREE.BoxGeometry(1.24, 0.03, 0.03), color: 0xeeeeee, pos: [0, 0.14, 0.58] },
    { geo: new THREE.CylinderGeometry(0.035, 0.035, 1.0, 5), color: COLORS.steel, pos: [0, 0.25, 0.5], rot: [Math.PI / 2, 0, 0] },
  ]), vertexMat());
  head.add(mount, stock);
  root.add(head);
  return { root: shadowed(root), head, stock };
}

export function boltGeometry(): THREE.BufferGeometry {
  return merged([
    { geo: new THREE.CylinderGeometry(0.035, 0.035, 0.9, 5), color: COLORS.woodDark, rot: [Math.PI / 2, 0, 0] },
    { geo: new THREE.ConeGeometry(0.08, 0.2, 5), color: COLORS.steel, pos: [0, 0, 0.52], rot: [Math.PI / 2, 0, 0] },
  ]);
}

export function makeAxe(): THREE.Mesh {
  return shadowed(new THREE.Mesh(merged([
    { geo: new THREE.CylinderGeometry(0.05, 0.05, 0.9, 6), color: COLORS.wood, pos: [0, 0, 0] },
    { geo: new THREE.BoxGeometry(0.34, 0.28, 0.06), color: COLORS.steel, pos: [0.16, 0.34, 0] },
    { geo: new THREE.BoxGeometry(0.06, 0.3, 0.07), color: 0x8a939e, pos: [0.33, 0.34, 0] },
  ]), vertexMat()));
}

export function makeCounter(): THREE.Group {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(merged([
    { geo: new THREE.BoxGeometry(4, 0.9, 1.1), color: COLORS.wood, pos: [0, 0.45, 0] },
    { geo: new THREE.BoxGeometry(4.25, 0.14, 1.3), color: COLORS.logEnd, pos: [0, 0.95, 0] },
    { geo: new THREE.BoxGeometry(4.02, 0.08, 1.12), color: COLORS.woodDark, pos: [0, 0.2, 0] },
    { geo: new THREE.BoxGeometry(0.62, 0.34, 0.5), color: 0x7d8794, pos: [-1.6, 1.19, -0.2] },
    { geo: new THREE.BoxGeometry(0.5, 0.06, 0.36), color: 0x3d4552, pos: [-1.6, 1.38, -0.2], rot: [0.3, 0, 0] },
  ]), vertexMat()));
  return shadowed(g);
}

export function makeArrow(): THREE.Group {
  const g = new THREE.Group();
  const m = new THREE.MeshLambertMaterial({ color: 0xffd23f, emissive: 0x6b4d00 });
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.7, 10), m);
  shaft.position.y = 0.75;
  const head = new THREE.Mesh(new THREE.ConeGeometry(0.4, 0.6, 12), m);
  head.rotation.x = Math.PI;
  head.position.y = 0.2;
  g.add(shaft, head);
  return g;
}
