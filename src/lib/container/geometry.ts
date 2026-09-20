/**
 * ISO dimensions and the corrugation profile maths.
 *
 * Everything here is in metres, matching the real spec sheet, and is converted
 * to pixels once by a single `unit` scale. That keeps proportions honest: the
 * component is never "roughly box shaped", it is 6.058 x 2.438 x 2.591 m.
 */

import type { ContainerSize, Quality } from "./types";

export interface Dimensions {
  /** Length along X, metres. */
  length: number;
  /** Width along Z, metres. */
  width: number;
  /** Height along Y, metres. */
  height: number;
}

/** ISO 668 series 1 dry freight containers. */
export const ISO: Record<ContainerSize, Dimensions> = {
  "20ft": { length: 6.058, width: 2.438, height: 2.591 },
  "40ft": { length: 12.192, width: 2.438, height: 2.591 },
};

/** Corner castings are a fixed ISO 1161 part, the same on every box. */
export const CASTING = { length: 0.178, width: 0.162, height: 0.118 };

/** Side and end rails, and the door gasket, in metres. */
export const RAIL_HEIGHT = 0.12;
export const POST_WIDTH = 0.09;
export const GASKET = 0.022;

/**
 * A trapezoidal corrugation, described the way a rollformer would:
 *
 *      crest        c
 *              ┌─────────┐              ─┐
 *             /           \               │ depth d
 *  ──────────┘             └──────────    ─┘
 *      v/2      w       w      v/2
 *      └──────── pitch p ───────┘
 *
 * The web run `w` follows from the depth and the web angle, so changing the
 * depth keeps the flanks at a believable angle instead of shearing them.
 */
export interface Corrugation {
  pitch: number;
  depth: number;
  crest: number;
  /** Horizontal run of one angled web. */
  web: number;
  /** Web angle from the wall plane, degrees. */
  angle: number;
  /** True length of the angled web face (the hypotenuse). */
  webFace: number;
}

export function corrugation(pitch: number, depth: number, crestRatio = 0.34): Corrugation {
  // Symmetric profile: crest and valley share a width, the rest is the two webs.
  //   p = c + v + 2w,  with v = c  =>  w = p(1 - 2*crestRatio) / 2
  const crest = pitch * crestRatio;
  const web = (pitch * (1 - 2 * crestRatio)) / 2;
  if (web <= 0) throw new Error("corrugation: crestRatio must be below 0.5");
  const angle = (Math.atan2(depth, web) * 180) / Math.PI;
  return { pitch, depth, crest, web, angle, webFace: Math.hypot(web, depth) };
}

/** Walls corrugate deeper than the roof; the brief calls this out explicitly. */
export const WALL_CORRUGATION = corrugation(0.28, 0.036);
export const ROOF_CORRUGATION = corrugation(0.36, 0.019);
export const DOOR_CORRUGATION = corrugation(0.3, 0.03);

/**
 * How many ridges we actually build.
 *
 * Every ridge is three composited planes, so a full-pitch 40 ft box is well
 * over 600 elements. Dropping the pitch multiplier on smaller screens is the
 * "lighter scene" the brief asks for on mobile, and it is invisible at the
 * sizes those screens render the box at.
 */
export const PITCH_SCALE: Record<Quality, number> = {
  high: 1,
  medium: 1.6,
  low: 2.6,
};

export function ridgeCount(span: number, c: Corrugation, quality: Quality): number {
  return Math.max(2, Math.floor(span / (c.pitch * PITCH_SCALE[quality])));
}

/**
 * Fit the box to its parent.
 *
 * The widest the box ever gets on screen is its diagonal footprint, since the
 * scroll story turns it through 180 degrees. Sizing against that, rather than
 * against the length alone, is what guarantees "never causes horizontal
 * overflow" at every frame of the orbit rather than only head-on.
 */
export function unitScale(parentWidth: number, dims: Dimensions, headroom = 0.86): number {
  const diagonal = Math.hypot(dims.length, dims.width);
  return (parentWidth * headroom) / diagonal;
}
