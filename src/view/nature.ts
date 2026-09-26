// Trees, gem ores and per-world decoration.
import * as THREE from 'three';
import { CAMP, COUNTER, FOREST_PEN, MINE_PEN, mulberry32, type Gem, type TreeKind, type WorldId } from '../data';
import { P, glowMat, mat, merged, vertexMat, type Part } from './models';
import type { Theme } from './theme';

/** Spheres get fewer segments the smaller they are: tiny eyes and flowers do not need 160 triangles. */
const S = (r: number, w = r < 0.2 ? 6 : r < 0.5 ? 8 : 10, h = r < 0.2 ? 4 : r < 0.5 ? 6 : 8) => new THREE.SphereGeometry(r, w, h);
const C = (rt: number, rb: number, h: number, seg = 8) => new THREE.CylinderGeometry(rt, rb, h, seg);
const K = (r: number, h: number, seg = 8) => new THREE.ConeGeometry(r, h, seg);
const B = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
const O = (r: number) => new THREE.OctahedronGeometry(r, 0);
const D = (r: number) => new THREE.DodecahedronGeometry(r, 0);

export const GEM_COLOR: Record<Gem, number> = { em: 0x2ee87a, di: 0x6fe8ff, ob: 0x7a3fd1 };

/** Foliage (hidden when chopped) and trunk (left as a stump) for each tree kind. */
export function treeGeometries(kind: TreeKind): { foliage: THREE.BufferGeometry; trunk: THREE.BufferGeometry } {
  switch (kind) {
    case 'pine': return {
      foliage: merged([
        P(K(1.2, 1.5, 8), 0x2f9e4a, [0, 1.5, 0]),
        P(K(1.05, 0.5, 8), 0xf4f8fc, [0, 1.95, 0]),
        P(K(0.95, 1.3, 8), 0x46b95c, [0, 2.3, 0], [0, 0.4, 0]),
        P(K(0.8, 0.45, 8), 0xf4f8fc, [0, 2.72, 0], [0, 0.4, 0]),
        P(K(0.62, 1.1, 8), 0x2f9e4a, [0, 3.0, 0], [0, 0.8, 0]),
        P(K(0.34, 0.5, 8), 0xffffff, [0, 3.45, 0], [0, 0.8, 0]),
      ]),
      trunk: merged([P(C(0.2, 0.26, 1.0, 7), 0x8a5a2e, [0, 0.5, 0]), P(C(0.2, 0.2, 0.02, 7), 0xecc795, [0, 1.0, 0])]),
    };
    case 'palm': {
      const segs: Part[] = [];
      for (let i = 0; i < 6; i++) {
        segs.push(P(C(0.17 - i * 0.012, 0.2 - i * 0.012, 0.52, 7), i % 2 ? 0xa0703c : 0x8a5f32, [i * i * 0.012, 0.3 + i * 0.5, 0], [0, 0, -i * 0.04]));
      }
      const top: [number, number, number] = [0.45, 3.2, 0];
      const leaves: Part[] = [];
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2;
        leaves.push(P(B(1.5, 0.05, 0.36), i % 2 ? 0x3aa84a : 0x2f8f3c,
          [top[0] + Math.cos(a) * 0.7, top[1] - 0.2, Math.sin(a) * 0.7], [0, -a, -0.45]));
      }
      leaves.push(P(S(0.13), 0x6b4a2a, [top[0] + 0.12, top[1] - 0.2, 0.1]), P(S(0.13), 0x6b4a2a, [top[0] - 0.1, top[1] - 0.22, -0.08]));
      return {
        foliage: merged([...segs.slice(2), ...leaves]),
        trunk: merged([...segs.slice(0, 2), P(C(0.17, 0.17, 0.02, 7), 0xecc795, [0, 1.03, 0])]),
      };
    }
    case 'jungle': return {
      foliage: merged([
        P(C(0.2, 0.26, 2.2, 7), 0x6b4a2a, [0, 2.1, 0]),
        P(S(1.2, 8, 6), 0x2e8a3a, [0, 3.4, 0], undefined, [1.2, 0.7, 1.2]),
        P(S(0.9, 8, 6), 0x3fa84a, [0.6, 3.8, 0.3], undefined, [1, 0.7, 1]),
        P(S(0.85, 8, 6), 0x2a7a34, [-0.6, 3.7, -0.3], undefined, [1, 0.7, 1]),
        P(C(0.03, 0.03, 1.4, 4), 0x3d8a2a, [0.9, 2.6, 0.4]),
        P(C(0.03, 0.03, 1.1, 4), 0x3d8a2a, [-0.8, 2.8, -0.5]),
        P(S(0.12), 0xff5fa2, [0.5, 3.1, 1.0]),
      ]),
      trunk: merged([
        P(C(0.26, 0.4, 1.0, 7), 0x6b4a2a, [0, 0.5, 0]),
        P(B(0.12, 0.5, 0.7), 0x5a3d22, [0.35, 0.22, 0], [0, 0, -0.5]),
        P(B(0.7, 0.5, 0.12), 0x5a3d22, [0, 0.22, -0.35], [0.5, 0, 0]),
        P(C(0.26, 0.26, 0.02, 7), 0xd8b07a, [0, 1.0, 0]),
      ]),
    };
    case 'willow': {
      const strands: Part[] = [];
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        strands.push(P(B(0.12, 1.5, 0.12), i % 2 ? 0x7f9a3a : 0x6b8a30, [Math.cos(a) * 1.05, 2.1, Math.sin(a) * 1.05], [Math.sin(a) * 0.15, 0, -Math.cos(a) * 0.15]));
      }
      return {
        foliage: merged([
          P(C(0.2, 0.26, 1.6, 7), 0x4a3a2a, [0, 1.8, 0]),
          P(S(1.15, 8, 6), 0x6b8a30, [0, 3.0, 0], undefined, [1.1, 0.6, 1.1]),
          P(S(0.8, 8, 6), 0x86a444, [0.2, 3.35, 0.1], undefined, [1, 0.6, 1]),
          ...strands,
        ]),
        trunk: merged([P(C(0.26, 0.36, 1.0, 7), 0x4a3a2a, [0, 0.5, 0]), P(C(0.26, 0.26, 0.02, 7), 0xb8946a, [0, 1.0, 0])]),
      };
    }
    case 'charred': return {
      foliage: merged([
        P(C(0.14, 0.2, 1.8, 6), 0x2a2224, [0, 1.9, 0]),
        P(C(0.06, 0.1, 1.1, 5), 0x2a2224, [0.4, 2.4, 0], [0, 0, -0.8]),
        P(C(0.06, 0.1, 1.0, 5), 0x2a2224, [-0.35, 2.6, 0.1], [0.2, 0, 0.9]),
        P(C(0.05, 0.08, 0.8, 5), 0x2a2224, [0.05, 2.9, -0.35], [-0.9, 0, 0]),
        P(D(0.12), 0xff7a1a, [0.1, 1.6, 0.18]),
        P(D(0.1), 0xffb02e, [-0.12, 2.2, 0.14]),
        P(D(0.08), 0xff5a1a, [0.75, 2.75, 0]),
        P(S(0.35, 7, 5), 0x6b2a1e, [-0.75, 3.05, 0.1], undefined, [1, 0.6, 1]),
        P(S(0.4, 7, 5), 0x7a3222, [0.85, 2.85, 0], undefined, [1, 0.6, 1]),
      ]),
      trunk: merged([P(C(0.2, 0.3, 1.0, 6), 0x2a2224, [0, 0.5, 0]), P(C(0.2, 0.2, 0.02, 6), 0xff7a1a, [0, 1.0, 0])]),
    };
    case 'crystal': return {
      foliage: merged([
        P(C(0.12, 0.18, 1.4, 6), 0xd8d0ff, [0, 1.7, 0]),
        P(O(0.55), 0x7ff3ff, [0, 2.9, 0], undefined, [1, 1.6, 1]),
        P(O(0.35), 0xff8ad9, [0.55, 2.5, 0.2], [0, 0, -0.5], [1, 1.5, 1]),
        P(O(0.35), 0xb49bff, [-0.5, 2.6, -0.2], [0, 0, 0.5], [1, 1.5, 1]),
        P(O(0.25), 0xffffff, [0.1, 3.7, 0.1], undefined, [1, 1.6, 1]),
      ]),
      trunk: merged([P(C(0.2, 0.3, 1.0, 6), 0xb8aef0, [0, 0.5, 0]), P(C(0.2, 0.2, 0.02, 6), 0x7ff3ff, [0, 1.0, 0])]),
    };
  }
}

/** Rock with coloured crystals growing out of it. */
export function oreGeometries(rockColor: number): { rock: THREE.BufferGeometry; crystals: Record<Gem, THREE.BufferGeometry> } {
  const dark = new THREE.Color(rockColor).multiplyScalar(0.8).getHex();
  const rock = merged([
    P(D(0.62), rockColor, [0, 0.35, 0], [0.3, 0.2, 0], [1.1, 0.75, 1]),
    P(D(0.42), dark, [0.45, 0.25, 0.2], [0.5, 0.8, 0.1]),
    P(D(0.35), rockColor, [-0.4, 0.2, -0.25], [0.1, 0.4, 0.6]),
  ]);
  const crystal = (c: number): THREE.BufferGeometry => {
    const light = new THREE.Color(c).lerp(new THREE.Color(0xffffff), 0.5).getHex();
    return merged([
      P(O(0.24), c, [0, 0.95, 0], [0, 0.3, 0.15], [0.8, 2.1, 0.8]),
      P(O(0.18), light, [0.32, 0.75, 0.2], [0, 0, -0.55], [0.8, 1.9, 0.8]),
      P(O(0.17), c, [-0.3, 0.7, 0.15], [0.2, 0, 0.6], [0.8, 1.8, 0.8]),
      P(O(0.14), light, [0.05, 0.6, -0.38], [-0.6, 0, 0], [0.8, 1.7, 0.8]),
    ]);
  };
  return { rock, crystals: { em: crystal(GEM_COLOR.em), di: crystal(GEM_COLOR.di), ob: crystal(0x3a1d6c) } };
}

/** Places a scatter of instanced decoration outside the camp and pens. */
export function buildDecor(world: WorldId, theme: Theme, scene: THREE.Object3D, tree: { foliage: THREE.BufferGeometry; trunk: THREE.BufferGeometry }): { lava: THREE.Mesh[] } {
  const rnd = mulberry32(77 + world.length);
  const blocked = (x: number, z: number, pad: number) => {
    const h = CAMP.half + pad;
    if (Math.abs(x) < h && Math.abs(z) < h) return true;
    if (x > FOREST_PEN.x0 - pad && x < FOREST_PEN.x1 + pad && z > FOREST_PEN.z0 - pad && z < FOREST_PEN.z1 + pad) return true;
    if (x > MINE_PEN.x0 - pad && x < MINE_PEN.x1 + pad && z > MINE_PEN.z0 - pad && z < MINE_PEN.z1 + pad) return true;
    if (Math.abs(x - COUNTER.x) < 3.5 && z > CAMP.half) return true; // survivor path
    if (x > CAMP.half && Math.abs(z) < 14) return true; // monster approach
    return false;
  };
  const spots = (n: number, pad: number): [number, number][] => {
    const out: [number, number][] = [];
    for (let i = 0; i < n * 8 && out.length < n; i++) {
      const x = -44 + rnd() * 90, z = -44 + rnd() * 80;
      if (!blocked(x, z, pad)) out.push([x, z]);
    }
    return out;
  };
  const place = (geo: THREE.BufferGeometry, m: THREE.Material, pts: [number, number][], sMin: number, sMax: number, flatY = 1, y = 0) => {
    const im = new THREE.InstancedMesh(geo, m, Math.max(1, pts.length));
    const o = new THREE.Object3D();
    pts.forEach(([x, z], i) => {
      const s = sMin + rnd() * (sMax - sMin);
      o.position.set(x, y, z);
      o.rotation.set(0, rnd() * Math.PI * 2, 0);
      o.scale.set(s, s * flatY, s);
      o.updateMatrix();
      im.setMatrixAt(i, o.matrix);
    });
    im.count = pts.length;
    im.castShadow = true;
    im.receiveShadow = true;
    scene.add(im);
    return im;
  };

  // background trees everywhere
  const treePts = spots(60, 2);
  place(tree.foliage, vertexMat(), treePts, 0.9, 1.3);
  place(tree.trunk, vertexMat(), treePts, 0.9, 1.3);
  place(D(0.6), mat(theme.rock), spots(26, 1), 0.5, 1.2, 0.7, 0.15);
  const lava: THREE.Mesh[] = [];

  switch (world) {
    case 'winter':
      place(S(1, 16, 8), mat(0xf7fafd, { flat: false }), spots(60, 1), 0.8, 2.4, 0.35, -0.1);
      break;
    case 'desert':
      place(S(1, 16, 8), mat(theme.groundAlt, { flat: false }), spots(40, 1), 2, 5, 0.25, -0.2);
      place(merged([
        P(C(0.28, 0.3, 2.2, 8), 0x3f9a4a, [0, 1.1, 0]),
        P(C(0.18, 0.18, 0.8, 8), 0x3f9a4a, [0.45, 1.2, 0], [0, 0, Math.PI / 2]),
        P(C(0.16, 0.16, 0.7, 8), 0x3f9a4a, [0.8, 1.5, 0]),
        P(C(0.16, 0.16, 0.6, 8), 0x3f9a4a, [-0.4, 1.5, 0], [0, 0, Math.PI / 2]),
        P(C(0.14, 0.14, 0.55, 8), 0x3f9a4a, [-0.65, 1.75, 0]),
        P(S(0.12), 0xff6fb5, [0, 2.25, 0]),
      ]), vertexMat(), spots(24, 1), 0.7, 1.2);
      place(merged([P(B(0.9, 0.12, 0.12), 0xf2ead8), P(S(0.18), 0xf2ead8, [0.5, 0.05, 0])]), vertexMat(), spots(10, 1), 0.8, 1.2, 1, 0.06);
      break;
    case 'jungle':
      place(merged([
        P(S(0.8, 8, 6), 0x2e8a3a, [0, 0.4, 0], undefined, [1.2, 0.7, 1.2]),
        P(S(0.5, 8, 6), 0x46b95c, [0.4, 0.6, 0.2]),
        P(S(0.12), 0xff5fa2, [0.3, 0.9, 0.5]),
        P(S(0.1), 0xffd23f, [-0.5, 0.7, 0.3]),
      ]), vertexMat(), spots(60, 1), 0.7, 1.5);
      break;
    case 'swamp': {
      const water = new THREE.MeshLambertMaterial({ color: 0x3f5a3a, transparent: true, opacity: 0.85 });
      place(new THREE.CircleGeometry(1, 16).rotateX(-Math.PI / 2), water, spots(26, 2), 1.5, 3.5, 1, 0.03);
      place(merged([
        P(C(0.03, 0.03, 1.3, 4), 0x6b7a3a, [0, 0.65, 0]),
        P(C(0.03, 0.03, 1.1, 4), 0x6b7a3a, [0.12, 0.55, 0.05]),
        P(C(0.06, 0.06, 0.3, 6), 0x5a3a22, [0, 1.35, 0]),
      ]), vertexMat(), spots(70, 1), 0.8, 1.3);
      place(new THREE.CylinderGeometry(0.35, 0.35, 0.03, 10), mat(0x5a9a3a), spots(30, 2), 0.7, 1.3, 1, 0.06);
      break;
    }
    case 'volcano': {
      const lavaMat = glowMat(0xff5a1a);
      for (const [x, z] of spots(14, 2)) {
        const m = new THREE.Mesh(new THREE.CircleGeometry(1, 18).rotateX(-Math.PI / 2), lavaMat);
        const s = 1.2 + rnd() * 2.5;
        m.scale.set(s, 1, s * (0.6 + rnd() * 0.6));
        m.position.set(x, 0.04, z);
        scene.add(m);
        lava.push(m);
      }
      place(K(1, 2, 7), mat(0x2a2426), spots(20, 1), 0.6, 1.4, 1, 0.8);
      break;
    }
    case 'crystal':
      place(merged([
        P(O(0.4), 0x7ff3ff, [0, 0.6, 0], undefined, [0.8, 2, 0.8]),
        P(O(0.28), 0xff8ad9, [0.35, 0.45, 0.1], [0, 0, -0.5], [0.8, 1.8, 0.8]),
        P(O(0.25), 0xb49bff, [-0.3, 0.4, -0.1], [0, 0, 0.5], [0.8, 1.7, 0.8]),
      ]), vertexMat(), spots(50, 1), 0.7, 1.6);
      break;
  }
  return { lava };
}
