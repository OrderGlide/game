// Per-world look: sky, ground, palisade, lighting and ambient particles.
import type { WorldId } from '../data';

export interface Theme {
  sky: number;
  fogNear: number;
  fogFar: number;
  ground: number;
  groundAlt: number;
  floor: number;
  fence: number;
  fenceTop: number;
  gate: number;
  hemiSky: number;
  hemiGround: number;
  hemi: number;
  sun: number;
  sunPower: number;
  rock: number;
  particles: { color: number; size: number; fall: number; drift: number; rise: boolean; opacity: number };
  portal: number;
}

export const THEMES: Record<WorldId, Theme> = {
  winter: {
    sky: 0xdde8f3, fogNear: 38, fogFar: 78, ground: 0xeef3f9, groundAlt: 0xf8fbfe, floor: 0xb98468,
    fence: 0xc98b4f, fenceTop: 0xecc795, gate: 0x3b82d6, hemiSky: 0xffffff, hemiGround: 0x9eb2cc, hemi: 1.9,
    sun: 0xfff6ea, sunPower: 2.3, rock: 0x9aa6b5,
    particles: { color: 0xffffff, size: 0.13, fall: 1.6, drift: 0.3, rise: false, opacity: 0.9 }, portal: 0x6fd6ff,
  },
  desert: {
    sky: 0xf6dfb2, fogNear: 40, fogFar: 85, ground: 0xefcf92, groundAlt: 0xf6dca8, floor: 0xc58a58,
    fence: 0xd9a05b, fenceTop: 0xf2d29b, gate: 0x19a39a, hemiSky: 0xfff4dc, hemiGround: 0xc9a06a, hemi: 1.8,
    sun: 0xfff0cf, sunPower: 2.7, rock: 0xc99a62,
    particles: { color: 0xe8c690, size: 0.09, fall: 0.2, drift: 1.8, rise: false, opacity: 0.6 }, portal: 0x5fe08a,
  },
  jungle: {
    sky: 0xcfe8c4, fogNear: 34, fogFar: 72, ground: 0x6fb04a, groundAlt: 0x7fbe57, floor: 0x9a6b44,
    fence: 0x9b6a3c, fenceTop: 0xd8b07a, gate: 0xd8742a, hemiSky: 0xf2fff0, hemiGround: 0x4f7a3a, hemi: 1.7,
    sun: 0xfffbe6, sunPower: 2.2, rock: 0x7f8a74,
    particles: { color: 0xfff27a, size: 0.12, fall: -0.15, drift: 0.6, rise: true, opacity: 0.85 }, portal: 0x4f8f3a,
  },
  swamp: {
    sky: 0xa9b8a0, fogNear: 26, fogFar: 62, ground: 0x5b6b3e, groundAlt: 0x66773f, floor: 0x76583c,
    fence: 0x7a5a38, fenceTop: 0xb8946a, gate: 0x6b8f3a, hemiSky: 0xdfe8d0, hemiGround: 0x3a4a2a, hemi: 1.6,
    sun: 0xf0f4d8, sunPower: 1.7, rock: 0x6a705c,
    particles: { color: 0xc8ff6a, size: 0.12, fall: -0.1, drift: 0.8, rise: true, opacity: 0.9 }, portal: 0xff5a2a,
  },
  volcano: {
    sky: 0x4a2c2a, fogNear: 30, fogFar: 70, ground: 0x3b3536, groundAlt: 0x463e3e, floor: 0x5a4038,
    fence: 0x5b3a2a, fenceTop: 0x9a6a4a, gate: 0xc0392b, hemiSky: 0xffd2b0, hemiGround: 0x5a2a20, hemi: 1.5,
    sun: 0xffb98a, sunPower: 2.0, rock: 0x2e2a2c,
    particles: { color: 0xff8a2a, size: 0.12, fall: -0.9, drift: 0.5, rise: true, opacity: 0.9 }, portal: 0xb07cff,
  },
  crystal: {
    sky: 0x2d2350, fogNear: 30, fogFar: 72, ground: 0x4b3d7a, groundAlt: 0x57488a, floor: 0x6a5a9a,
    fence: 0x8a7ac0, fenceTop: 0xd6ccff, gate: 0x38d6ff, hemiSky: 0xe0d8ff, hemiGround: 0x3a2a6a, hemi: 1.8,
    sun: 0xe8e0ff, sunPower: 2.0, rock: 0x6a5aa0,
    particles: { color: 0x9ff3ff, size: 0.11, fall: -0.3, drift: 0.4, rise: true, opacity: 0.9 }, portal: 0xffffff,
  },
};
