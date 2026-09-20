/**
 * Turns the four zone colours into the ~27 CSS custom properties the skin
 * paints with, for the container's current orbit.
 *
 * The lamp is fixed in world space, so every normal is rotated by the orbit
 * before it is shaded. That is the difference between a box that is lit and a
 * box that carries its highlights around with it as it turns — the brief's
 * "must look correct from every angle through a full 360 rotation".
 *
 * Only the large readable surfaces get per-orbit lighting. Rails, posts and
 * castings wrap around all four sides, so a single custom property cannot
 * describe them directionally; they take a fixed relative tint off the body
 * colour instead. They are narrow enough that the simplification does not
 * read, and it keeps the per-frame property count low.
 */

import { rotateY, shade, type Hsl, type Vec3 } from "./color";
import type { FaceClass } from "./build";

type Transform = (n: Vec3) => Vec3;

const idn: Transform = (n) => n;
const flipZ: Transform = ([x, y, z]) => [-x, y, -z];
const endFront: Transform = ([x, y, z]) => [-z, y, x];
const doorEnd: Transform = ([x, y, z]) => [z, y, -x];
const roofT: Transform = ([x, y, z]) => [x, -z, y];

/** Local normal of a panel face, given the web angle in degrees. */
const localNormal = (kind: "base" | "crest" | "webA" | "webB", angle: number): Vec3 => {
  const r = (angle * Math.PI) / 180;
  if (kind === "webA") return [-Math.sin(r), 0, Math.cos(r)];
  if (kind === "webB") return [Math.sin(r), 0, Math.cos(r)];
  return [0, 0, 1];
};

interface LitFace {
  face: FaceClass;
  zone: "body" | "doors";
  transform: Transform;
  kind: "base" | "crest" | "webA" | "webB";
  panel: "wall" | "roof" | "door";
}

const LIT: LitFace[] = [
  ...(["base", "crest", "webA", "webB"] as const).flatMap((k) => [
    { face: `sideR-${k}` as FaceClass, zone: "body" as const, transform: idn, kind: k, panel: "wall" as const },
    { face: `sideL-${k}` as FaceClass, zone: "body" as const, transform: flipZ, kind: k, panel: "wall" as const },
    { face: `endF-${k}` as FaceClass, zone: "body" as const, transform: endFront, kind: k, panel: "wall" as const },
    { face: `door-${k}` as FaceClass, zone: "doors" as const, transform: doorEnd, kind: k, panel: "door" as const },
  ]),
  { face: "roof-base", zone: "body", transform: roofT, kind: "base", panel: "roof" },
  { face: "roof-crest", zone: "body", transform: roofT, kind: "crest", panel: "roof" },
  { face: "roof-web", zone: "body", transform: roofT, kind: "webA", panel: "roof" },
];

/** Live zone colours, already parsed, so a colour tween can drive this per frame. */
export interface ZoneHsl {
  body: Hsl;
  doors: Hsl;
  decals: Hsl;
  interior: Hsl;
}

export interface ShadeInput {
  colors: ZoneHsl;
  angles: { wall: number; roof: number; door: number };
  orbit: number;
  /** Fixed-lamp mode for low-end devices: skip the per-orbit recompute. */
  worldLit: boolean;
}

export function computeShading(input: ShadeInput): Record<string, string> {
  const { body, doors, interior } = input.colors;
  const orbit = input.worldLit ? input.orbit : 0;
  const out: Record<string, string> = {};

  for (const f of LIT) {
    const base = f.zone === "body" ? body : doors;
    const n = rotateY(f.transform(localNormal(f.kind, input.angles[f.panel])), orbit);
    out[`--sc-${f.face}`] = shade(base, n, { sheen: f.kind === "crest" });
  }

  // Underside: always in shadow, and a touch cooler.
  out["--sc-floor"] = shade({ ...body, l: body.l * 0.72 }, rotateY([0, 1, 0], orbit));

  // Trim, painted with the doors colour per the brief's zone split.
  out["--sc-rail"] = tint(doors, 0.88);
  out["--sc-post"] = tint(doors, 0.8);
  out["--sc-casting"] = tint(doors, 0.6, -6);
  out["--sc-hardware"] = tint(doors, 0.52, -10);

  // Decals are a printed stencil: flat, unshaded, and deliberately not derived
  // from the paint so they never shift when the body colour tweens.
  out["--sc-decals"] = `hsl(${input.colors.decals.h.toFixed(1)} ${input.colors.decals.s.toFixed(1)}% ${input.colors.decals.l.toFixed(1)}%)`;

  // Interior is lit by its own lamp, not the sun, so it does not track orbit.
  out["--sc-int-floor"] = tint(interior, 0.74, -4);
  out["--sc-int-wall"] = tint(interior, 0.92);
  out["--sc-int-ceil"] = tint(interior, 1.06);

  return out;
}

/** Relative tint off a base colour, keeping headroom at both ends. */
function tint(base: Hsl, factor: number, satShift = 0): string {
  const l = factor > 1 ? base.l + (100 - base.l) * (factor - 1) : base.l * factor;
  const s = Math.min(100, Math.max(0, base.s + satShift));
  return `hsl(${base.h.toFixed(1)} ${s.toFixed(1)}% ${Math.min(98, Math.max(2, l)).toFixed(1)}%)`;
}

/** Apply a shading map to an element in one pass. */
export function applyShading(el: HTMLElement, map: Record<string, string>) {
  for (const k in map) el.style.setProperty(k, map[k]);
}
