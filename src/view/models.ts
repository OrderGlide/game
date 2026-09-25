// Procedural low-poly models built from primitives — no asset files needed.
// Static parts of a model are merged into one vertex-coloured mesh to keep draw calls low.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { EnemyKind, PadIcon, PetId, SurvivorKind, TowerKind } from '../data';

export const COLORS = {
  bark: 0x9c5f2e,
  logEnd: 0xecc795,
  wood: 0xc98b4f,
  woodDark: 0x8f5a2b,
  fur: 0xffffff,
  skin: 0xffcfa6,
  dark: 0x2a2f3a,
  steel: 0xc9d2dc,
  cash: 0x39c24c,
  cashLight: 0x9df2a6,
  gold: 0xffd23f,
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
const glowCache = new Map<number, THREE.MeshBasicMaterial>();
export function glowMat(color: number): THREE.MeshBasicMaterial {
  let m = glowCache.get(color);
  if (!m) { m = new THREE.MeshBasicMaterial({ color }); glowCache.set(color, m); }
  return m;
}

export interface Part {
  geo: THREE.BufferGeometry; color: number;
  pos?: [number, number, number]; rot?: [number, number, number]; scale?: [number, number, number];
}
export const P = (geo: THREE.BufferGeometry, color: number, pos?: Part['pos'], rot?: Part['rot'], scale?: Part['scale']): Part =>
  ({ geo, color, pos, rot, scale });

/** Merge primitive parts into one geometry with per-vertex colours. */
export function merged(parts: Part[]): THREE.BufferGeometry {
  const geos = parts.map((p) => {
    const g = p.geo.index ? p.geo.toNonIndexed() : p.geo.clone();
    g.deleteAttribute('uv');
    g.applyMatrix4(new THREE.Matrix4().compose(
      new THREE.Vector3(...(p.pos ?? [0, 0, 0])),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(...(p.rot ?? [0, 0, 0]))),
      new THREE.Vector3(...(p.scale ?? [1, 1, 1])),
    ));
    const c = new THREE.Color(p.color);
    const n = g.getAttribute('position').count;
    const cols = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    return g;
  });
  const out = mergeGeometries(geos, false)!;
  out.computeVertexNormals();
  return out;
}

export const mesh = (parts: Part[], m: THREE.Material = vertexMat()) => new THREE.Mesh(merged(parts), m);

export function shadowed<T extends THREE.Object3D>(o: T): T {
  o.traverse((c) => { if ((c as THREE.Mesh).isMesh) c.castShadow = true; });
  return o;
}

// short-hand primitives
const S = (r: number, w = 10, h = 8) => new THREE.SphereGeometry(r, w, h);
const C = (rt: number, rb: number, h: number, seg = 8) => new THREE.CylinderGeometry(rt, rb, h, seg);
const K = (r: number, h: number, seg = 8) => new THREE.ConeGeometry(r, h, seg);
const B = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
const Cap = (r: number, l: number) => new THREE.CapsuleGeometry(r, l, 3, 10);
const Tor = (r: number, t: number, arc = Math.PI * 2) => new THREE.TorusGeometry(r, t, 6, 16, arc);
const D = (r: number) => new THREE.DodecahedronGeometry(r, 0);
const O = (r: number) => new THREE.OctahedronGeometry(r, 0);

// ---------- characters ----------

export type Hat = 'hood' | SurvivorKind | 'beanie';

export interface CharacterRig {
  root: THREE.Group; body: THREE.Group; legL: THREE.Mesh; legR: THREE.Mesh;
  armL: THREE.Group; armR: THREE.Group; hand: THREE.Group; backpack: THREE.Group;
}

function hatParts(hat: Hat, coat: number, trim: number): Part[] {
  switch (hat) {
    case 'hood': return [
      P(new THREE.SphereGeometry(0.44, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.62), coat, [0, 1.6, -0.06]),
      P(Tor(0.33, 0.1), trim, [0, 1.57, 0.2]),
    ];
    case 'santa': return [
      P(K(0.33, 0.62, 10), 0xe0413b, [0, 2.02, -0.06], [-0.35, 0, 0]),
      P(Tor(0.31, 0.09), 0xffffff, [0, 1.8, 0], [Math.PI / 2, 0, 0]),
      P(S(0.1), 0xffffff, [0, 2.27, -0.22]),
      P(S(0.2), 0xffffff, [0, 1.38, 0.26], undefined, [1.1, 0.85, 0.7]),
    ];
    case 'nomad': return [
      P(Tor(0.3, 0.12), 0xf2e6c8, [0, 1.8, 0], [Math.PI / 2, 0, 0]),
      P(Tor(0.24, 0.11), 0xe8d8b0, [0, 1.92, 0], [Math.PI / 2, 0, 0.3]),
      P(S(0.24), 0xf2e6c8, [0, 1.98, -0.02]),
      P(O(0.06), 0xe8453c, [0, 1.84, 0.33]),
      P(C(0.32, 0.36, 0.22), 0x3aa0a0, [0, 1.28, 0]),
    ];
    case 'explorer': return [
      P(C(0.52, 0.52, 0.04, 16), 0xc8b27a, [0, 1.84, 0]),
      P(S(0.33, 12, 8), 0xc8b27a, [0, 1.86, 0], undefined, [1, 0.75, 1]),
      P(C(0.34, 0.34, 0.07, 14), 0x5a4228, [0, 1.9, 0]),
    ];
    case 'fisher': return [
      P(S(0.36, 12, 8), 0xf5c518, [0, 1.82, 0], undefined, [1, 0.8, 1]),
      P(C(0.5, 0.56, 0.05, 16), 0xf5c518, [0, 1.76, -0.05], [-0.25, 0, 0]),
    ];
    case 'miner': return [
      P(S(0.37, 12, 8), 0xf5b82e, [0, 1.78, 0], undefined, [1, 0.8, 1]),
      P(C(0.46, 0.46, 0.04, 16), 0xf5b82e, [0, 1.72, 0.06]),
      P(C(0.09, 0.09, 0.1, 10), 0x555555, [0, 1.86, 0.34], [Math.PI / 2, 0, 0]),
      P(C(0.07, 0.07, 0.02, 10), 0xfff6a0, [0, 1.86, 0.4], [Math.PI / 2, 0, 0]),
    ];
    case 'wizard': return [
      P(K(0.36, 0.9, 10), 0x6a4fc8, [0, 2.2, -0.08], [-0.2, 0, 0]),
      P(C(0.55, 0.55, 0.04, 16), 0x6a4fc8, [0, 1.78, 0]),
      P(O(0.07), 0xffe066, [0.1, 2.15, 0.2]),
      P(O(0.05), 0xffe066, [-0.12, 1.98, 0.28]),
      P(K(0.22, 0.55, 8), 0xf4f4f4, [0, 1.2, 0.26], [Math.PI, 0, 0]),
    ];
    case 'beanie': return [
      P(new THREE.SphereGeometry(0.37, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), coat === 0xf0a030 ? 0x2d9e5a : 0x2d9e5a, [0, 1.68, 0]),
      P(Tor(0.34, 0.07), 0x2a7a48, [0, 1.7, 0], [Math.PI / 2, 0, 0]),
      P(S(0.09), 0xffffff, [0, 2.05, 0]),
    ];
  }
}

/** Chunky character. `hat` picks the headwear (and a matching outfit detail). */
export function makeCharacter(coat: number, trim: number, hat: Hat, skin = COLORS.skin): CharacterRig {
  const parts: Part[] = [
    P(Cap(0.4, 0.42), coat, [0, 0.93, 0]),
    P(Tor(0.38, 0.11), trim, [0, 0.61, 0], [Math.PI / 2, 0, 0]),
    P(B(0.1, 0.5, 0.06), trim, [0, 0.96, 0.4]),
    P(C(0.41, 0.41, 0.1, 14), 0x4a3526, [0, 0.8, 0]),
    P(B(0.14, 0.1, 0.05), COLORS.gold, [0, 0.8, 0.41]),
    P(S(0.34, 14, 12), skin, [0, 1.56, 0.02]),
    // eyes, blush and nose
    P(S(0.06, 8, 6), 0xffffff, [-0.12, 1.61, 0.3]),
    P(S(0.06, 8, 6), 0xffffff, [0.12, 1.61, 0.3]),
    P(S(0.035, 6, 5), COLORS.dark, [-0.12, 1.61, 0.35]),
    P(S(0.035, 6, 5), COLORS.dark, [0.12, 1.61, 0.35]),
    P(S(0.05, 6, 5), 0xff9a9a, [-0.2, 1.5, 0.28], undefined, [1, 0.6, 0.4]),
    P(S(0.05, 6, 5), 0xff9a9a, [0.2, 1.5, 0.28], undefined, [1, 0.6, 0.4]),
    P(S(0.05, 6, 5), 0xf4b48a, [0, 1.53, 0.35]),
    ...hatParts(hat, coat, trim),
  ];
  const body = new THREE.Group();
  body.add(mesh(parts));
  const legGeo = merged([
    P(B(0.2, 0.42, 0.24), 0x2d3d63, [0, -0.21, 0]),
    P(B(0.23, 0.13, 0.31), 0x3a2a22, [0, -0.4, 0.03]),
  ]);
  const armGeo = merged([
    P(Cap(0.11, 0.3), coat, [0, -0.2, 0]),
    P(S(0.12), trim, [0, -0.43, 0]),
  ]);
  const legL = new THREE.Mesh(legGeo, vertexMat()); legL.position.set(-0.15, 0.45, 0);
  const legR = new THREE.Mesh(legGeo, vertexMat()); legR.position.set(0.15, 0.45, 0);
  const armL = new THREE.Group(); armL.position.set(-0.47, 1.12, 0); armL.add(new THREE.Mesh(armGeo, vertexMat()));
  const armR = new THREE.Group(); armR.position.set(0.47, 1.12, 0); armR.add(new THREE.Mesh(armGeo, vertexMat()));
  const hand = new THREE.Group(); hand.position.set(0, -0.45, 0.05); armR.add(hand);
  const backpack = new THREE.Group(); backpack.position.set(0, 1.0, -0.42); backpack.visible = false; body.add(backpack);
  const root = new THREE.Group();
  body.add(armL, armR);
  root.add(body, legL, legR);
  return { root: shadowed(root), body, legL, legR, armL, armR, hand, backpack };
}

export function animateCharacter(r: CharacterRig, walkT: number, moving: boolean, carrying: boolean): void {
  const s = moving ? Math.sin(walkT) : 0;
  r.legL.rotation.x = s * 0.7;
  r.legR.rotation.x = -s * 0.7;
  r.body.position.y = moving ? Math.abs(Math.cos(walkT)) * 0.07 : 0;
  r.body.rotation.z = moving ? Math.sin(walkT) * 0.04 : 0;
  if (carrying) {
    r.armL.rotation.x = r.armR.rotation.x = -1.2;
  } else {
    r.armL.rotation.x = -s * 0.6;
    r.armR.rotation.x = s * 0.6;
  }
}

export function makeBackpack(color: number, size: number): THREE.Mesh {
  const k = 0.8 + size * 0.05;
  return mesh([
    P(B(0.6, 0.7, 0.3), color, [0, 0, -0.1], undefined, [k, k, k]),
    P(B(0.62, 0.22, 0.34), new THREE.Color(color).multiplyScalar(0.75).getHex(), [0, 0.27 * k, -0.1], undefined, [k, 1, k]),
    P(B(0.34, 0.2, 0.1), new THREE.Color(color).multiplyScalar(0.85).getHex(), [0, -0.1, -0.29 * k]),
    P(B(0.08, 0.08, 0.05), COLORS.gold, [0, 0.18 * k, -0.28 * k]),
    P(C(0.16, 0.16, 0.66, 8), 0x9ec5ff, [0, 0.43 * k, -0.1], [0, 0, Math.PI / 2]),
  ]);
}

// ---------- tools ----------

export function makeAxe(tier: number): THREE.Mesh {
  const blade = tier;
  const shine = new THREE.Color(blade).lerp(new THREE.Color(0xffffff), 0.45).getHex();
  return shadowed(mesh([
    P(C(0.05, 0.05, 0.95, 6), COLORS.wood),
    P(C(0.06, 0.06, 0.12, 6), COLORS.woodDark, [0, -0.44, 0]),
    P(B(0.38, 0.32, 0.07), blade, [0.17, 0.33, 0]),
    P(B(0.07, 0.36, 0.08), shine, [0.36, 0.33, 0]),
    P(B(0.12, 0.12, 0.09), 0x5a5f66, [0, 0.33, 0]),
  ]));
}

export function makePickaxe(tier: number): THREE.Mesh {
  return shadowed(mesh([
    P(C(0.045, 0.045, 0.85, 6), COLORS.wood, [0, 0, 0]),
    P(new THREE.TorusGeometry(0.3, 0.05, 5, 10, Math.PI * 0.9), tier, [0, 0.32, 0], [0, 0, Math.PI * 0.05]),
    P(K(0.06, 0.18, 5), new THREE.Color(tier).lerp(new THREE.Color(0xffffff), 0.4).getHex(), [0.3, 0.3, 0], [0, 0, -Math.PI / 2 + 0.3]),
    P(K(0.06, 0.18, 5), new THREE.Color(tier).lerp(new THREE.Color(0xffffff), 0.4).getHex(), [-0.3, 0.3, 0], [0, 0, Math.PI / 2 - 0.3]),
  ]));
}

// ---------- creatures ----------

export interface EnemyRig {
  root: THREE.Group;
  body: THREE.Group;
  head: THREE.Object3D | null;
  jaw: THREE.Object3D | null;
  legs: THREE.Object3D[];
  arms: THREE.Object3D[];
  tail: THREE.Object3D[];
  crown: THREE.Object3D;
  material: THREE.MeshLambertMaterial;
  kind: EnemyKind;
  height: number;
}

function limb(parts: Part[], m: THREE.Material, x: number, y: number, z: number): THREE.Group {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.add(new THREE.Mesh(merged(parts), m));
  return g;
}

function makeCrown(): THREE.Group {
  const g = new THREE.Group();
  const parts: Part[] = [P(C(0.34, 0.3, 0.16, 10), COLORS.gold)];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    parts.push(P(K(0.08, 0.22, 5), COLORS.gold, [Math.cos(a) * 0.28, 0.17, Math.sin(a) * 0.28]));
    parts.push(P(O(0.05), i % 2 ? 0xe8453c : 0x3bd6ff, [Math.cos(a) * 0.33, 0.02, Math.sin(a) * 0.33]));
  }
  g.add(mesh(parts));
  return g;
}

export function makeEnemy(kind: EnemyKind): EnemyRig {
  const material = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const rig: EnemyRig = { root, body, head: null, jaw: null, legs: [], arms: [], tail: [], crown: makeCrown(), material, kind, height: 2 };
  const add = (parts: Part[], parent: THREE.Object3D = body) => { const m = new THREE.Mesh(merged(parts), material); parent.add(m); return m; };

  if (kind === 'bear') {
    const fur = 0xf3f0e7, shade = 0xd9d3c4;
    add([
      P(Cap(0.55, 0.85), fur, [0, 1.0, -0.05], [Math.PI / 2, 0, 0]),
      P(S(0.62, 12, 10), fur, [0, 1.16, 0.28], undefined, [1, 1, 1.05]),
      P(S(0.6, 12, 10), fur, [0, 1.05, -0.55]),
      P(S(0.14), fur, [0, 1.12, -1.13]),
      P(S(0.5, 10, 8), shade, [0, 0.72, 0], undefined, [0.9, 0.5, 1.6]),
    ]);
    const head = new THREE.Group(); head.position.set(0, 1.28, 0.85); body.add(head);
    add([
      P(S(0.4, 12, 10), fur),
      P(Cap(0.19, 0.2), 0xebe6da, [0, -0.08, 0.34], [Math.PI / 2, 0, 0]),
      P(S(0.08), 0x2a2a30, [0, -0.03, 0.58]),
      P(B(0.14, 0.02, 0.02), 0x2a2a30, [0, -0.18, 0.5]),
      P(S(0.055), 0x1a1a22, [-0.15, 0.1, 0.33]),
      P(S(0.055), 0x1a1a22, [0.15, 0.1, 0.33]),
      P(S(0.13), fur, [-0.27, 0.3, -0.02]),
      P(S(0.13), fur, [0.27, 0.3, -0.02]),
      P(S(0.07), 0xf0b8b8, [-0.27, 0.3, 0.06]),
      P(S(0.07), 0xf0b8b8, [0.27, 0.3, 0.06]),
    ], head);
    rig.head = head;
    for (const [x, z] of [[-0.34, 0.5], [0.34, 0.5], [-0.34, -0.58], [0.34, -0.58]]) {
      const l = limb([
        P(C(0.2, 0.17, 0.72, 8), shade, [0, -0.36, 0]),
        P(S(0.2, 8, 6), fur, [0, -0.74, 0.04], undefined, [1, 0.6, 1.2]),
        P(K(0.035, 0.1, 4), 0x2a2a30, [-0.08, -0.8, 0.27], [Math.PI / 2, 0, 0]),
        P(K(0.035, 0.1, 4), 0x2a2a30, [0, -0.8, 0.29], [Math.PI / 2, 0, 0]),
        P(K(0.035, 0.1, 4), 0x2a2a30, [0.08, -0.8, 0.27], [Math.PI / 2, 0, 0]),
      ], material, x, 0.84, z);
      body.add(l);
      rig.legs.push(l);
    }
    rig.crown.position.set(0, 0.42, 0);
    head.add(rig.crown);
    rig.height = 2;
  } else if (kind === 'scorpion') {
    const shell = 0xd08a3a, plate = 0x8a4d1c, belly = 0xe9b56a;
    add([
      P(S(0.5, 12, 8), shell, [0, 0.5, 0.35], undefined, [1, 0.45, 1.1]),
      P(S(0.47, 12, 8), plate, [0, 0.56, 0.35], undefined, [0.9, 0.3, 1]),
      P(S(0.42, 12, 8), shell, [0, 0.5, -0.25], undefined, [1, 0.45, 1]),
      P(S(0.34, 12, 8), shell, [0, 0.5, -0.7], undefined, [1, 0.45, 1]),
      P(S(0.45, 10, 8), belly, [0, 0.4, 0], undefined, [0.9, 0.2, 1.8]),
      P(S(0.06), 0x111111, [-0.14, 0.66, 0.78]),
      P(S(0.06), 0x111111, [0.14, 0.66, 0.78]),
    ]);
    for (let i = 0; i < 8; i++) {
      const side = i < 4 ? -1 : 1, zi = i % 4;
      const l = limb([
        P(C(0.05, 0.05, 0.6, 5), plate, [side * 0.28, 0.12, 0], [0, 0, side * 1.1]),
        P(C(0.045, 0.03, 0.62, 5), shell, [side * 0.62, -0.12, 0], [0, 0, -side * 0.5]),
      ], material, side * 0.35, 0.5, 0.45 - zi * 0.28);
      body.add(l);
      rig.legs.push(l);
    }
    for (const side of [-1, 1]) {
      const arm = limb([
        P(C(0.08, 0.08, 0.6, 6), shell, [0, 0, 0.3], [Math.PI / 2, 0, 0]),
        P(S(0.2, 8, 6), shell, [0, 0, 0.65], undefined, [1, 0.7, 1.2]),
        P(B(0.08, 0.1, 0.4), plate, [side * 0.1, 0, 0.9], [0, side * 0.3, 0]),
        P(B(0.08, 0.1, 0.36), plate, [-side * 0.06, 0, 0.88], [0, -side * 0.25, 0]),
      ], material, side * 0.38, 0.52, 0.72);
      arm.rotation.y = -side * 0.35;
      body.add(arm);
      rig.arms.push(arm);
    }
    // tail: a chain of segments curling over the back
    let parent: THREE.Object3D = body;
    const sizes = [0.22, 0.2, 0.18, 0.16, 0.14];
    for (let i = 0; i < sizes.length; i++) {
      const seg = new THREE.Group();
      seg.position.set(0, i === 0 ? 0.55 : 0.3, i === 0 ? -0.95 : 0);
      const parts = [P(S(sizes[i], 8, 6), i % 2 ? plate : shell, [0, 0.15, 0], undefined, [1, 1.2, 1])];
      if (i === sizes.length - 1) parts.push(P(K(0.08, 0.3, 6), 0x2a1a10, [0, 0.3, 0.18], [1.4, 0, 0]));
      seg.add(new THREE.Mesh(merged(parts), material));
      seg.rotation.x = i === 0 ? -0.35 : 0.55;
      parent.add(seg);
      rig.tail.push(seg);
      parent = seg;
    }
    rig.crown.position.set(0, 0.85, 0.35);
    body.add(rig.crown);
    rig.height = 1.4;
  } else if (kind === 'gorilla') {
    const furC = 0x4f4f5e, chest = 0x7a7a8e, face = 0x7d6a64;
    add([
      P(S(0.75, 12, 10), furC, [0, 1.35, 0], undefined, [1.05, 1.05, 0.85]),
      P(S(0.55, 12, 10), chest, [0, 1.3, 0.3], undefined, [1, 1, 0.6]),
      P(S(0.5, 12, 10), furC, [0, 0.95, -0.15], undefined, [1.1, 0.8, 0.9]),
      P(S(0.35, 10, 8), furC, [-0.62, 1.78, 0], undefined, [1, 0.9, 0.9]),
      P(S(0.35, 10, 8), furC, [0.62, 1.78, 0], undefined, [1, 0.9, 0.9]),
    ]);
    const head = new THREE.Group(); head.position.set(0, 2.05, 0.3); body.add(head);
    add([
      P(S(0.38, 12, 10), furC),
      P(S(0.3, 10, 8), face, [0, -0.06, 0.22], undefined, [1, 0.9, 0.7]),
      P(B(0.5, 0.1, 0.16), furC, [0, 0.14, 0.26]),
      P(S(0.05), 0xffffff, [-0.12, 0.05, 0.4]),
      P(S(0.05), 0xffffff, [0.12, 0.05, 0.4]),
      P(S(0.03), 0x111111, [-0.12, 0.05, 0.44]),
      P(S(0.03), 0x111111, [0.12, 0.05, 0.44]),
      P(S(0.04), 0x2a1a1a, [-0.05, -0.1, 0.44]),
      P(S(0.04), 0x2a1a1a, [0.05, -0.1, 0.44]),
    ], head);
    rig.head = head;
    for (const side of [-1, 1]) {
      const arm = limb([
        P(Cap(0.2, 0.9), furC, [0, -0.6, 0]),
        P(S(0.25, 8, 6), face, [0, -1.25, 0.05], undefined, [1, 0.8, 1]),
      ], material, side * 0.8, 1.85, 0.05);
      body.add(arm);
      rig.arms.push(arm);
    }
    for (const side of [-1, 1]) {
      const leg = limb([
        P(Cap(0.2, 0.35), furC, [0, -0.3, 0]),
        P(B(0.3, 0.12, 0.4), face, [0, -0.62, 0.08]),
      ], material, side * 0.35, 0.72, -0.15);
      body.add(leg);
      rig.legs.push(leg);
    }
    rig.crown.position.set(0, 0.38, 0);
    head.add(rig.crown);
    rig.height = 2.5;
  } else if (kind === 'croc') {
    const skin = 0x4f7a3a, dark = 0x3a5a2a, belly = 0xb9c47a;
    const ridges: Part[] = [];
    for (let i = 0; i < 7; i++) ridges.push(P(K(0.09, 0.2, 4), dark, [0, 0.72, 0.8 - i * 0.28]));
    add([
      P(Cap(0.42, 1.5), skin, [0, 0.48, 0], [Math.PI / 2, 0, 0], [1.25, 1, 0.7]),
      P(Cap(0.36, 1.3), belly, [0, 0.36, 0], [Math.PI / 2, 0, 0], [1.2, 1, 0.5]),
      ...ridges,
    ]);
    const head = new THREE.Group(); head.position.set(0, 0.5, 1.15); body.add(head);
    const teeth: Part[] = [];
    for (let i = 0; i < 6; i++) {
      teeth.push(P(K(0.035, 0.1, 4), 0xffffff, [-0.22, -0.12, 0.2 + i * 0.13], [Math.PI, 0, 0]));
      teeth.push(P(K(0.035, 0.1, 4), 0xffffff, [0.22, -0.12, 0.2 + i * 0.13], [Math.PI, 0, 0]));
    }
    add([
      P(B(0.58, 0.24, 1.0), skin, [0, 0, 0.45]),
      P(B(0.62, 0.1, 0.35), dark, [0, 0.14, 0.1]),
      P(S(0.12), 0xf5d23a, [-0.2, 0.2, 0.1]),
      P(S(0.12), 0xf5d23a, [0.2, 0.2, 0.1]),
      P(B(0.04, 0.12, 0.04), 0x111111, [-0.2, 0.22, 0.2]),
      P(B(0.04, 0.12, 0.04), 0x111111, [0.2, 0.22, 0.2]),
      P(S(0.04), 0x223311, [-0.1, 0.1, 0.93]),
      P(S(0.04), 0x223311, [0.1, 0.1, 0.93]),
      ...teeth,
    ], head);
    const jaw = new THREE.Group(); jaw.position.set(0, -0.14, 0); head.add(jaw);
    add([P(B(0.52, 0.12, 0.95), belly, [0, -0.04, 0.45])], jaw);
    rig.head = head;
    rig.jaw = jaw;
    for (const [x, z] of [[-0.5, 0.55], [0.5, 0.55], [-0.5, -0.55], [0.5, -0.55]]) {
      const leg = limb([
        P(C(0.12, 0.1, 0.45, 6), skin, [Math.sign(x) * 0.12, -0.16, 0], [0, 0, Math.sign(x) * 0.7]),
        P(B(0.24, 0.08, 0.28), dark, [Math.sign(x) * 0.28, -0.34, 0.06]),
      ], material, x, 0.42, z);
      body.add(leg);
      rig.legs.push(leg);
    }
    let parent: THREE.Object3D = body;
    const tailSizes = [0.34, 0.26, 0.18, 0.1];
    for (let i = 0; i < tailSizes.length; i++) {
      const seg = new THREE.Group();
      seg.position.set(0, i === 0 ? 0.45 : 0, i === 0 ? -1.05 : -0.55);
      seg.add(new THREE.Mesh(merged([
        P(K(tailSizes[i], 0.7, 6), skin, [0, 0, -0.25], [-Math.PI / 2, 0, 0], [1.2, 1, 0.6]),
        P(K(0.07, 0.16, 4), dark, [0, tailSizes[i] * 0.6, -0.2]),
      ]), material));
      parent.add(seg);
      rig.tail.push(seg);
      parent = seg;
    }
    rig.crown.position.set(0, 0.35, 0.1);
    head.add(rig.crown);
    rig.height = 1.2;
  } else if (kind === 'golem') {
    const stone = 0x3b3434, stone2 = 0x4d4444;
    add([
      P(D(0.8), stone, [0, 1.55, 0], undefined, [1.15, 1, 0.85]),
      P(D(0.5), stone2, [0, 1.0, 0], undefined, [1, 0.8, 0.8]),
      P(D(0.35), stone2, [-0.55, 2.05, 0]),
      P(D(0.35), stone2, [0.55, 2.05, 0]),
    ]);
    const glow = glowMat(0xff7a1a);
    const cracks = new THREE.Mesh(merged([
      P(B(0.08, 0.5, 0.05), 0xffffff, [0.2, 1.6, 0.66], [0, 0, 0.4]),
      P(B(0.06, 0.4, 0.05), 0xffffff, [-0.25, 1.4, 0.66], [0, 0, -0.5]),
      P(S(0.18, 8, 6), 0xffffff, [0, 1.75, 0.62]),
      P(B(0.3, 0.05, 0.05), 0xffffff, [0.05, 1.15, 0.45]),
    ]), glow);
    body.add(cracks);
    const head = new THREE.Group(); head.position.set(0, 2.45, 0.1); body.add(head);
    add([P(D(0.38), stone2)], head);
    head.add(new THREE.Mesh(merged([
      P(B(0.1, 0.07, 0.05), 0xffffff, [-0.13, 0.03, 0.33]),
      P(B(0.1, 0.07, 0.05), 0xffffff, [0.13, 0.03, 0.33]),
    ]), glowMat(0xffd23f)));
    rig.head = head;
    for (const side of [-1, 1]) {
      const arm = limb([
        P(D(0.34), stone2, [0, -0.1, 0]),
        P(D(0.36), stone, [0, -0.7, 0.05]),
        P(D(0.44), stone2, [0, -1.25, 0.1]),
      ], material, side * 1.05, 2.0, 0);
      arm.add(new THREE.Mesh(merged([P(B(0.05, 0.3, 0.05), 0xffffff, [0, -0.7, 0.35])]), glow));
      body.add(arm);
      rig.arms.push(arm);
    }
    for (const side of [-1, 1]) {
      const leg = limb([
        P(D(0.36), stone, [0, -0.25, 0]),
        P(B(0.5, 0.25, 0.6), stone2, [0, -0.62, 0.08]),
      ], material, side * 0.42, 0.8, 0);
      body.add(leg);
      rig.legs.push(leg);
    }
    rig.crown.position.set(0, 0.4, 0);
    head.add(rig.crown);
    rig.height = 2.8;
  } else {
    // crystal spider
    const shell = 0x5a3fb0, dark = 0x3a2a78, crystal = 0x7ff3ff;
    add([
      P(S(0.7, 12, 10), shell, [0, 1.0, -0.6], undefined, [1, 0.8, 1.2]),
      P(S(0.45, 12, 10), dark, [0, 0.82, 0.32]),
      P(K(0.12, 0.5, 5), crystal, [0, 1.62, -0.6]),
      P(K(0.1, 0.4, 5), crystal, [0.3, 1.5, -0.8], [0, 0, -0.5]),
      P(K(0.1, 0.4, 5), crystal, [-0.3, 1.5, -0.8], [0, 0, 0.5]),
      P(K(0.09, 0.35, 5), 0xff7ad9, [0.15, 1.45, -0.25], [0.4, 0, -0.3]),
      P(K(0.09, 0.35, 5), 0xff7ad9, [-0.15, 1.45, -0.25], [0.4, 0, 0.3]),
      P(K(0.05, 0.2, 4), 0xeeeeee, [-0.1, 0.62, 0.7], [Math.PI, 0, 0]),
      P(K(0.05, 0.2, 4), 0xeeeeee, [0.1, 0.62, 0.7], [Math.PI, 0, 0]),
    ]);
    body.add(new THREE.Mesh(merged([
      P(S(0.06), 0xffffff, [-0.12, 0.95, 0.72]), P(S(0.06), 0xffffff, [0.12, 0.95, 0.72]),
      P(S(0.04), 0xffffff, [-0.22, 1.02, 0.64]), P(S(0.04), 0xffffff, [0.22, 1.02, 0.64]),
    ]), glowMat(0xff3b6d)));
    for (let i = 0; i < 8; i++) {
      const side = i < 4 ? -1 : 1, zi = i % 4;
      const l = limb([
        P(C(0.07, 0.06, 0.95, 5), dark, [side * 0.4, 0.25, 0], [0, 0, side * 1.0]),
        P(C(0.06, 0.03, 1.15, 5), shell, [side * 0.95, -0.25, 0], [0, 0, -side * 0.45]),
        P(O(0.07), crystal, [side * 0.82, 0.5, 0]),
      ], material, side * 0.3, 0.9, 0.55 - zi * 0.3);
      l.rotation.y = side * (zi - 1.5) * -0.35;
      body.add(l);
      rig.legs.push(l);
    }
    rig.crown.position.set(0, 1.62, -0.6);
    body.add(rig.crown);
    rig.height = 1.8;
  }
  rig.crown.visible = false;
  return { ...rig, root: shadowed(root) };
}

export interface EnemyPose { moving: boolean; attack: number; t: number; walkT: number; dead: number; }

export function animateEnemy(r: EnemyRig, s: EnemyPose): void {
  const w = s.moving ? s.walkT : 0, a = s.attack;
  const sw = (i: number) => Math.sin(w * 1.2 + (i % 2 ? Math.PI : 0) + (i >= 2 ? Math.PI : 0));
  switch (r.kind) {
    case 'bear':
      r.legs.forEach((l, i) => { l.rotation.x = s.moving ? sw(i) * 0.6 : 0; });
      r.body.position.y = s.moving ? Math.abs(Math.sin(w * 1.2)) * 0.06 : 0;
      r.body.rotation.x = -a * 0.45;
      r.body.position.z = a * 0.25;
      if (r.head) r.head.rotation.y = Math.sin(s.t * 1.5) * 0.15;
      break;
    case 'scorpion':
      r.legs.forEach((l, i) => { l.rotation.y = (s.moving ? Math.sin(w * 2 + i) * 0.35 : 0); });
      r.arms.forEach((arm, i) => { arm.rotation.x = -a * 0.5 + Math.sin(s.t * 3 + i) * 0.08; });
      r.tail.forEach((seg, i) => { seg.rotation.x = (i === 0 ? -0.35 : 0.55) + a * 0.3 + Math.sin(s.t * 2 + i) * 0.05; });
      break;
    case 'gorilla':
      r.arms.forEach((arm, i) => {
        arm.rotation.x = s.moving ? Math.sin(w * 1.2 + i * Math.PI) * 0.5 - 0.2 : -0.2;
        if (a > 0) arm.rotation.x = -a * 2.4;
      });
      r.legs.forEach((l, i) => { l.rotation.x = s.moving ? Math.sin(w * 1.2 + i * Math.PI) * 0.6 : 0; });
      r.body.rotation.x = s.moving ? 0.25 : 0.1;
      r.body.position.y = s.moving ? Math.abs(Math.sin(w * 1.2)) * 0.08 : 0;
      break;
    case 'croc':
      r.legs.forEach((l, i) => { l.rotation.y = s.moving ? sw(i) * 0.5 : 0; });
      r.tail.forEach((seg, i) => { seg.rotation.y = Math.sin(s.t * 3 - i * 0.8 + w * 0.6) * (0.15 + i * 0.05); });
      if (r.jaw) r.jaw.rotation.x = 0.1 + a * 0.6 + Math.max(0, Math.sin(s.t * 1.3)) * 0.1;
      r.body.rotation.y = s.moving ? Math.sin(w * 1.2) * 0.08 : 0;
      break;
    case 'golem':
      r.arms.forEach((arm, i) => { arm.rotation.x = (s.moving ? Math.sin(w + i * Math.PI) * 0.4 : 0) - a * 1.8; });
      r.legs.forEach((l, i) => { l.rotation.x = s.moving ? Math.sin(w + i * Math.PI) * 0.45 : 0; });
      r.body.rotation.z = s.moving ? Math.sin(w) * 0.06 : 0;
      break;
    case 'spider':
      r.legs.forEach((l, i) => { l.rotation.z = s.moving ? Math.sin(w * 2 + i * 1.3) * 0.2 : 0; });
      r.body.position.y = s.moving ? Math.sin(w * 2) * 0.05 : 0;
      r.body.rotation.x = -a * 0.35;
      break;
  }
  if (s.dead > 0) {
    r.root.rotation.z = Math.min(1, s.dead * 3) * (Math.PI / 2);
    r.root.position.y = -Math.max(0, s.dead - 0.8) * 1.5;
  } else r.root.rotation.z = 0;
}

// ---------- props ----------

let logGeoCache: THREE.BufferGeometry | null = null;
/** A log lying along the x axis. */
export function logGeometry(): THREE.BufferGeometry {
  logGeoCache ??= merged([
    P(new THREE.CylinderGeometry(0.17, 0.17, 0.86, 9, 1, true), COLORS.bark, undefined, [0, 0, Math.PI / 2]),
    P(new THREE.CircleGeometry(0.17, 9), COLORS.logEnd, [0.43, 0, 0], [0, Math.PI / 2, 0]),
    P(new THREE.CircleGeometry(0.17, 9), COLORS.logEnd, [-0.43, 0, 0], [0, -Math.PI / 2, 0]),
    P(new THREE.CircleGeometry(0.07, 7), 0xd9a86a, [0.432, 0, 0], [0, Math.PI / 2, 0]),
  ]);
  return logGeoCache;
}

let billGeoCache: THREE.BufferGeometry | null = null;
export function billGeometry(): THREE.BufferGeometry {
  billGeoCache ??= merged([P(B(0.7, 0.13, 0.36), COLORS.cash), P(B(0.16, 0.135, 0.365), COLORS.cashLight)]);
  return billGeoCache;
}

export function gemGeometry(color: number): THREE.BufferGeometry {
  return merged([
    P(O(0.22), color, undefined, undefined, [1, 1.3, 1]),
    P(O(0.12), new THREE.Color(color).lerp(new THREE.Color(0xffffff), 0.6).getHex(), [0.05, 0.1, 0.1]),
  ]);
}

export function fenceLogGeometry(side: number, top: number): THREE.BufferGeometry {
  return merged([
    P(new THREE.CylinderGeometry(0.33, 0.33, 1.25, 10, 1, true), side, [0, 0.62, 0]),
    P(new THREE.CircleGeometry(0.33, 10), top, [0, 1.25, 0], [-Math.PI / 2, 0, 0]),
    P(new THREE.RingGeometry(0.12, 0.16, 10), new THREE.Color(top).multiplyScalar(0.85).getHex(), [0, 1.255, 0], [-Math.PI / 2, 0, 0]),
  ]);
}

export interface GateRig { root: THREE.Group; left: THREE.Group; right: THREE.Group; }
/** Double gate spanning `width`, laid out along local x. */
export function makeGate(width: number, panel: number, wood: number, top: number): GateRig {
  const root = new THREE.Group();
  const half = width / 2;
  const leafGeo = merged([
    P(B(half - 0.05, 1.05, 0.14), new THREE.Color(wood).multiplyScalar(0.7).getHex(), [(half - 0.05) / 2, 0.62, 0]),
    P(B(half - 0.35, 0.75, 0.16), panel, [(half - 0.05) / 2, 0.62, 0]),
    P(B(0.1, 1.15, 0.18), wood, [(half - 0.05) / 2, 0.62, 0], [0, 0, 0.9]),
  ]);
  const left = new THREE.Group();
  left.position.x = -half;
  left.add(new THREE.Mesh(leafGeo, vertexMat()));
  const right = new THREE.Group();
  right.position.x = half;
  right.rotation.y = Math.PI;
  right.add(new THREE.Mesh(leafGeo, vertexMat()));
  const postGeo = merged([
    P(C(0.38, 0.38, 1.6, 10), wood, [0, 0.8, 0]),
    P(new THREE.CircleGeometry(0.38, 10), top, [0, 1.601, 0], [-Math.PI / 2, 0, 0]),
    P(K(0.2, 0.3, 6), panel, [0, 1.75, 0]),
  ]);
  for (const x of [-half - 0.2, half + 0.2]) {
    const p = new THREE.Mesh(postGeo, vertexMat());
    p.position.x = x;
    root.add(p);
  }
  root.add(left, right);
  return { root: shadowed(root), left, right };
}

export interface TowerRig { root: THREE.Group; head: THREE.Group; stock: THREE.Object3D; flag: THREE.Mesh; kind: TowerKind; }
export function makeTower(wood: number, accent: number, kind: TowerKind = 'crossbow'): TowerRig {
  const root = new THREE.Group();
  const dark = new THREE.Color(wood).multiplyScalar(0.7).getHex();
  const stone = kind === 'ice' ? 0xbfe6f5 : kind === 'fire' ? 0x7a3a2a : kind === 'cannon' ? 0x6d737c : 0x8d939b;
  const body = kind === 'crossbow' ? wood : kind === 'ice' ? 0xdff4ff : kind === 'fire' ? 0x9a4a32 : 0x8a9099;
  root.add(mesh([
    P(C(0.95, 1.05, 0.35, 8), stone, [0, 0.17, 0]),
    P(C(0.72, 0.86, 1.9, 8), body, [0, 1.1, 0]),
    P(C(0.74, 0.74, 0.08, 8), kind === 'crossbow' ? dark : stone, [0, 0.7, 0]),
    P(C(0.74, 0.74, 0.08, 8), kind === 'crossbow' ? dark : stone, [0, 1.5, 0]),
    P(C(1.02, 0.95, 0.24, 8), kind === 'crossbow' ? COLORS.logEnd : stone, [0, 2.15, 0]),
    P(C(0.04, 0.04, 1.4, 5), dark, [0.8, 2.8, 0]),
  ]));
  const flag = mesh([P(B(0.02, 0.35, 0.5), accent, [0, 0, -0.25])]);
  flag.position.set(0.8, 3.3, 0);
  root.add(flag);
  const head = new THREE.Group();
  head.position.y = 2.5;
  head.add(mesh([P(C(0.22, 0.3, 0.35, 8), dark, [0, -0.1, 0])]));
  let stock: THREE.Object3D;
  if (kind === 'ice') {
    stock = new THREE.Group();
    stock.add(mesh([P(C(0.16, 0.22, 0.9, 8), 0x9fd8f0, [0, 0.2, 0.25], [Math.PI / 2 - 0.2, 0, 0])]));
    const crystal = new THREE.Mesh(merged([
      P(O(0.32), 0xffffff, [0, 0.55, -0.1], undefined, [0.8, 1.6, 0.8]),
      P(O(0.18), 0xffffff, [0.28, 0.4, 0.05], [0, 0, -0.5], [0.8, 1.5, 0.8]),
      P(O(0.18), 0xffffff, [-0.28, 0.4, 0.05], [0, 0, 0.5], [0.8, 1.5, 0.8]),
    ]), glowMat(0x8fe8ff));
    stock.add(crystal);
  } else if (kind === 'fire') {
    stock = new THREE.Group();
    stock.add(mesh([
      P(C(0.5, 0.3, 0.35, 10), 0x3a3334, [0, 0.12, 0]),
      P(C(0.12, 0.16, 0.8, 8), 0x2a2426, [0, 0.2, 0.45], [Math.PI / 2, 0, 0]),
    ]));
    const flames = new THREE.Mesh(merged([
      P(K(0.38, 0.8, 7), 0xffffff, [0, 0.62, 0]),
      P(K(0.2, 0.55, 6), 0xffffff, [0.18, 0.52, 0.1]),
      P(K(0.2, 0.5, 6), 0xffffff, [-0.16, 0.5, -0.1]),
    ]), glowMat(0xff7a1a));
    const core = new THREE.Mesh(merged([P(K(0.2, 0.5, 6), 0xffffff, [0, 0.55, 0])]), glowMat(0xffe066));
    stock.add(flames, core);
  } else if (kind === 'cannon') {
    stock = mesh([
      P(C(0.22, 0.28, 1.3, 12), 0x2d3036, [0, 0.2, 0.25], [Math.PI / 2 - 0.12, 0, 0]),
      P(Tor(0.24, 0.06), 0x4a4f57, [0, 0.27, 0.86], [0.12, 0, 0]),
      P(S(0.3, 10, 8), 0x2d3036, [0, 0.12, -0.35]),
      P(C(0.3, 0.3, 0.1, 12), wood, [0.38, 0, 0], [0, 0, Math.PI / 2]),
      P(C(0.3, 0.3, 0.1, 12), wood, [-0.38, 0, 0], [0, 0, Math.PI / 2]),
    ]);
  } else {
    stock = mesh([
      P(B(0.26, 0.2, 1.4), wood, [0, 0.12, 0.1]),
      P(Tor(0.62, 0.06, Math.PI), accent, [0, 0.14, 0.6], [Math.PI / 2, 0, 0]),
      P(B(1.24, 0.03, 0.03), 0xeeeeee, [0, 0.14, 0.58]),
      P(C(0.035, 0.035, 1.0, 5), COLORS.steel, [0, 0.25, 0.5], [Math.PI / 2, 0, 0]),
    ]);
  }
  head.add(stock);
  root.add(head);
  return { root: shadowed(root), head, stock, flag, kind };
}

export function boltGeometries(): Record<TowerKind, THREE.BufferGeometry> {
  return {
    crossbow: merged([
      P(C(0.035, 0.035, 0.9, 5), COLORS.woodDark, undefined, [Math.PI / 2, 0, 0]),
      P(K(0.08, 0.2, 5), COLORS.steel, [0, 0, 0.52], [Math.PI / 2, 0, 0]),
      P(B(0.14, 0.01, 0.16), 0xffffff, [0, 0, -0.38]),
    ]),
    ice: merged([P(O(0.16), 0xbff4ff, undefined, [Math.PI / 2, 0, 0], [0.7, 2.2, 0.7]), P(O(0.08), 0xffffff, [0, 0, -0.25])]),
    fire: merged([P(S(0.2, 8, 6), 0xff8a2a), P(S(0.13, 8, 6), 0xffe066, [0, 0, 0.06]), P(K(0.14, 0.4, 6), 0xff5a1a, [0, 0, -0.25], [-Math.PI / 2, 0, 0])]),
    cannon: merged([P(S(0.22, 10, 8), 0x222428)]),
  };
}

export function makeTent(color: number): THREE.Group {
  const g = new THREE.Group();
  const dark = new THREE.Color(color).multiplyScalar(0.7).getHex();
  g.add(mesh([
    P(K(1.35, 1.7, 4), color, [0, 0.85, 0], [0, Math.PI / 4, 0], [1.1, 1, 1.5]),
    P(B(0.5, 0.9, 0.05), 0x3a2a22, [0, 0.45, 1.06]),
    P(B(0.08, 0.08, 2.4), dark, [0, 1.72, 0]),
    P(C(0.03, 0.03, 0.8, 4), COLORS.woodDark, [0, 2.1, 0]),
    P(B(0.02, 0.22, 0.34), 0xffd23f, [0, 2.4, 0.17]),
  ]));
  return shadowed(g);
}

// ---------- pets ----------

export interface PetRig { root: THREE.Group; body: THREE.Group; wings: THREE.Object3D[]; tail: THREE.Object3D | null; flying: boolean; }
export function makePet(id: PetId): PetRig {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const wings: THREE.Object3D[] = [];
  let tail: THREE.Object3D | null = null;
  if (id === 'fox') {
    const o = 0xf07a2a, w = 0xfff4e6;
    body.add(mesh([
      P(Cap(0.22, 0.45), o, [0, 0.42, 0], [Math.PI / 2, 0, 0]),
      P(S(0.2, 8, 6), w, [0, 0.36, 0.22], undefined, [0.9, 0.8, 0.8]),
      P(S(0.24, 10, 8), o, [0, 0.72, 0.42]),
      P(K(0.12, 0.25, 6), w, [0, 0.66, 0.66], [Math.PI / 2, 0, 0]),
      P(S(0.04), 0x222222, [0, 0.66, 0.78]),
      P(K(0.08, 0.2, 4), o, [-0.13, 0.98, 0.4]),
      P(K(0.08, 0.2, 4), o, [0.13, 0.98, 0.4]),
      P(S(0.035), 0x222222, [-0.09, 0.78, 0.62]),
      P(S(0.035), 0x222222, [0.09, 0.78, 0.62]),
      P(C(0.05, 0.05, 0.3, 5), 0x3a2a22, [-0.12, 0.15, 0.2]), P(C(0.05, 0.05, 0.3, 5), 0x3a2a22, [0.12, 0.15, 0.2]),
      P(C(0.05, 0.05, 0.3, 5), 0x3a2a22, [-0.12, 0.15, -0.2]), P(C(0.05, 0.05, 0.3, 5), 0x3a2a22, [0.12, 0.15, -0.2]),
    ]));
    tail = new THREE.Group();
    tail.position.set(0, 0.5, -0.38);
    tail.add(mesh([P(S(0.18, 8, 6), o, [0, 0.12, -0.2], undefined, [0.9, 0.9, 1.6]), P(S(0.1, 8, 6), w, [0, 0.2, -0.45])]));
    body.add(tail);
  } else if (id === 'owl') {
    const br = 0x8a5a3a, be = 0xf2d9b0;
    body.add(mesh([
      P(S(0.32, 12, 10), br, [0, 0, 0], undefined, [1, 1.15, 0.95]),
      P(S(0.24, 10, 8), be, [0, -0.05, 0.14], undefined, [1, 1.1, 0.7]),
      P(new THREE.CircleGeometry(0.11, 12), 0xffffff, [-0.11, 0.12, 0.3]),
      P(new THREE.CircleGeometry(0.11, 12), 0xffffff, [0.11, 0.12, 0.3]),
      P(new THREE.CircleGeometry(0.06, 10), 0x111111, [-0.11, 0.12, 0.305]),
      P(new THREE.CircleGeometry(0.06, 10), 0x111111, [0.11, 0.12, 0.305]),
      P(K(0.05, 0.12, 4), 0xf5a623, [0, 0.02, 0.33], [Math.PI / 2, 0, 0]),
      P(K(0.07, 0.18, 4), br, [-0.18, 0.36, 0], [0, 0, 0.3]),
      P(K(0.07, 0.18, 4), br, [0.18, 0.36, 0], [0, 0, -0.3]),
    ]));
    for (const side of [-1, 1]) {
      const wing = new THREE.Group();
      wing.position.set(side * 0.3, 0.05, 0);
      wing.add(mesh([P(S(0.2, 8, 6), 0x6b4428, [side * 0.12, 0, 0], undefined, [1.2, 0.3, 0.8])]));
      body.add(wing);
      wings.push(wing);
    }
  } else {
    const c = 0x7a4fd6, belly = 0xf2c46a;
    body.add(mesh([
      P(Cap(0.2, 0.4), c, [0, 0, 0], [Math.PI / 2, 0, 0]),
      P(Cap(0.15, 0.3), belly, [0, -0.07, 0.03], [Math.PI / 2, 0, 0], [1, 0.8, 1]),
      P(S(0.22, 10, 8), c, [0, 0.2, 0.36]),
      P(Cap(0.1, 0.12), c, [0, 0.14, 0.58], [Math.PI / 2, 0, 0]),
      P(K(0.05, 0.2, 5), 0xfff4e6, [-0.1, 0.42, 0.3], [-0.4, 0, 0]),
      P(K(0.05, 0.2, 5), 0xfff4e6, [0.1, 0.42, 0.3], [-0.4, 0, 0]),
      P(S(0.04), 0xffe066, [-0.1, 0.26, 0.54]),
      P(S(0.04), 0xffe066, [0.1, 0.26, 0.54]),
      P(K(0.12, 0.45, 6), c, [0, 0, -0.45], [-Math.PI / 2, 0, 0]),
      P(K(0.06, 0.12, 4), belly, [0, 0.2, -0.05]),
      P(K(0.06, 0.12, 4), belly, [0, 0.2, 0.12]),
    ]));
    for (const side of [-1, 1]) {
      const wing = new THREE.Group();
      wing.position.set(side * 0.16, 0.14, 0);
      wing.add(mesh([P(B(0.5, 0.03, 0.35), 0x5a36b0, [side * 0.26, 0, -0.02], [0, side * 0.2, 0])]));
      body.add(wing);
      wings.push(wing);
    }
  }
  return { root: shadowed(root), body, wings, tail, flying: id !== 'fox' };
}

export function makeCounter(wood: number): THREE.Group {
  const g = new THREE.Group();
  g.add(mesh([
    P(B(4, 0.9, 1.1), wood, [0, 0.45, 0]),
    P(B(4.25, 0.14, 1.3), COLORS.logEnd, [0, 0.95, 0]),
    P(B(4.02, 0.08, 1.12), new THREE.Color(wood).multiplyScalar(0.7).getHex(), [0, 0.2, 0]),
    P(B(0.62, 0.34, 0.5), 0x7d8794, [-1.6, 1.19, -0.2]),
    P(B(0.5, 0.06, 0.36), 0x3d4552, [-1.6, 1.38, -0.2], [0.3, 0, 0]),
    P(B(0.2, 0.08, 0.1), 0x39c24c, [-1.6, 1.33, 0.05]),
  ]));
  return shadowed(g);
}

export function makeAnvil(): THREE.Group {
  const g = new THREE.Group();
  g.add(mesh([
    P(C(0.55, 0.62, 0.6, 10), COLORS.bark, [0, 0.3, 0]),
    P(C(0.55, 0.55, 0.02, 10), COLORS.logEnd, [0, 0.61, 0]),
    P(B(0.5, 0.25, 0.35), 0x3d434c, [0, 0.74, 0]),
    P(B(0.9, 0.2, 0.42), 0x4d545e, [0.1, 0.94, 0]),
    P(K(0.2, 0.45, 4), 0x4d545e, [0.72, 0.94, 0], [0, 0, -Math.PI / 2]),
    P(C(0.04, 0.04, 0.6, 5), COLORS.wood, [-0.3, 1.25, 0.1], [0.3, 0, 0.9]),
    P(B(0.26, 0.16, 0.16), 0x8a929c, [-0.52, 1.42, 0.16], [0.3, 0, 0.9]),
  ]));
  const coals = new THREE.Mesh(merged([
    P(D(0.14), 0xffffff, [-0.75, 0.12, 0.45]),
    P(D(0.12), 0xffffff, [-0.6, 0.1, 0.62]),
    P(D(0.1), 0xffffff, [-0.85, 0.09, 0.66]),
  ]), glowMat(0xff7a1a));
  g.add(coals);
  return shadowed(g);
}

export interface CampfireRig { root: THREE.Group; flames: THREE.Mesh[]; light: THREE.PointLight; }
export function makeCampfire(): CampfireRig {
  const root = new THREE.Group();
  const stones: Part[] = [];
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    stones.push(P(D(0.14), 0x8d939b, [Math.cos(a) * 0.55, 0.08, Math.sin(a) * 0.55]));
  }
  root.add(mesh([
    ...stones,
    P(C(0.08, 0.08, 0.8, 6), COLORS.bark, [0, 0.15, 0], [0, 0.5, Math.PI / 2]),
    P(C(0.08, 0.08, 0.8, 6), COLORS.bark, [0, 0.15, 0], [0, -0.7, Math.PI / 2]),
    P(C(0.08, 0.08, 0.8, 6), COLORS.bark, [0, 0.2, 0], [0, 1.6, Math.PI / 2]),
  ]));
  const flames = [
    new THREE.Mesh(K(0.3, 0.8, 7), glowMat(0xff6a1a)),
    new THREE.Mesh(K(0.2, 0.6, 7), glowMat(0xffb02e)),
    new THREE.Mesh(K(0.1, 0.35, 6), glowMat(0xfff27a)),
  ];
  flames.forEach((f, i) => { f.position.y = 0.45 + i * 0.05; root.add(f); });
  const light = new THREE.PointLight(0xffa04a, 6, 8, 1.6);
  light.position.y = 1;
  root.add(light);
  return { root: shadowed(root), flames, light };
}

export interface PortalRig { root: THREE.Group; disc: THREE.Mesh; ring: THREE.Mesh; }
export function makePortal(color: number, stone: number): PortalRig {
  const root = new THREE.Group();
  const blocks: Part[] = [];
  for (let i = 0; i <= 10; i++) {
    const a = (i / 10) * Math.PI;
    blocks.push(P(B(0.5, 0.42, 0.5), i % 2 ? stone : new THREE.Color(stone).multiplyScalar(0.8).getHex(),
      [Math.cos(a) * 1.35, 1.35 + Math.sin(a) * 1.35, 0], [0, 0, a]));
  }
  blocks.push(P(B(0.6, 1.35, 0.6), stone, [-1.35, 0.67, 0]), P(B(0.6, 1.35, 0.6), stone, [1.35, 0.67, 0]));
  blocks.push(P(C(1.9, 2.1, 0.2, 12), new THREE.Color(stone).multiplyScalar(0.7).getHex(), [0, 0.1, 0]));
  root.add(shadowed(mesh(blocks)));
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d')!;
  const col = new THREE.Color(color);
  const css = (k: number) => `rgb(${Math.round(Math.min(255, col.r * 255 * k))},${Math.round(Math.min(255, col.g * 255 * k))},${Math.round(Math.min(255, col.b * 255 * k))})`;
  const grad = x.createRadialGradient(64, 64, 4, 64, 64, 64);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(0.35, css(1.2));
  grad.addColorStop(1, css(0.5));
  x.fillStyle = grad;
  x.fillRect(0, 0, 128, 128);
  x.strokeStyle = 'rgba(255,255,255,0.55)';
  x.lineWidth = 5;
  for (let i = 0; i < 4; i++) {
    x.beginPath();
    for (let t = 0; t < 1; t += 0.02) {
      const a = t * Math.PI * 3 + (i * Math.PI) / 2, r = t * 60;
      const px = 64 + Math.cos(a) * r, py = 64 + Math.sin(a) * r;
      if (t === 0) x.moveTo(px, py); else x.lineTo(px, py);
    }
    x.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const disc = new THREE.Mesh(new THREE.CircleGeometry(1.15, 32), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }));
  disc.position.y = 1.35;
  root.add(disc);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.06, 6, 32), new THREE.MeshBasicMaterial({ color }));
  ring.position.y = 1.35;
  root.add(ring);
  return { root, disc, ring };
}

/** Small spinning model floating above a build pad. */
export function makePadIcon(icon: PadIcon, accent: number): THREE.Group {
  const g = new THREE.Group();
  let m: THREE.Object3D;
  switch (icon) {
    case 'tower': {
      const t = makeTower(COLORS.wood, accent);
      t.root.scale.setScalar(0.32);
      m = t.root;
      break;
    }
    case 'lumber': {
      const a = makeAxe(0xd0d6de);
      a.rotation.z = 0.5;
      a.scale.setScalar(0.9);
      const l = new THREE.Mesh(logGeometry(), vertexMat());
      l.position.set(0, -0.3, 0);
      m = new THREE.Group();
      m.add(a, l);
      break;
    }
    case 'miner': {
      const p = makePickaxe(0xd0d6de);
      p.rotation.z = -0.4;
      const gem = new THREE.Mesh(gemGeometry(0x2ee87a), vertexMat());
      gem.position.set(0.3, -0.3, 0);
      m = new THREE.Group();
      m.add(p, gem);
      break;
    }
    case 'wall': {
      const geo = fenceLogGeometry(COLORS.wood, COLORS.logEnd);
      m = new THREE.Group();
      for (let i = -1; i <= 1; i++) {
        const l = new THREE.Mesh(geo, vertexMat());
        l.scale.setScalar(0.45);
        l.position.set(i * 0.3, -0.3, 0);
        m.add(l);
      }
      break;
    }
    case 'portal': {
      m = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.1, 8, 20), new THREE.MeshBasicMaterial({ color: accent }));
      break;
    }
    case 'tent': {
      m = makeTent(0xe8a23a);
      m.scale.setScalar(0.4);
      m.position.y = -0.4;
      break;
    }
    case 'ice': case 'fire': case 'cannon': {
      const t = makeTower(COLORS.wood, accent, icon);
      t.root.scale.setScalar(0.32);
      m = t.root;
      break;
    }
  }
  g.add(m);
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
