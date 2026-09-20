/**
 * Runtime colour system.
 *
 * Nothing about the paint is baked into a texture. A zone holds one base
 * colour in HSL, and every lit surface derives its own colour from that base
 * at paint time using a Lambert term. That is what lets a single
 * `setColor('#8E2B1E')` keep the corrugation readable: the ridge faces are
 * still lighter and darker than the valleys by the same *ratio*, whatever the
 * hue, and a near-white body does not blow out to a flat silhouette.
 */

export interface Hsl {
  h: number;
  s: number;
  l: number;
}

export type Vec3 = readonly [number, number, number];

/**
 * A two-lamp rig, the way a product shot is actually lit.
 *
 * KEY is high, front, slightly left. FILL is low, behind and to the right, at
 * roughly a third of the power. Without the fill, any surface turned away from
 * the key crushes to near-black — which is exactly what a dark navy door end
 * does under a single lamp, taking its markings with it.
 *
 * CSS screen axes: +x right, +y down, +z towards the viewer. So "high" is -y.
 */
export const LIGHT: Vec3 = normalize([-0.38, -0.82, 0.43]);
export const FILL: Vec3 = normalize([0.62, -0.18, -0.76]);

/** Fraction of full brightness a surface keeps when it faces both lamps away. */
const AMBIENT = 0.42;
const KEY_POWER = 0.52;
const FILL_POWER = 0.19;

/**
 * Skylight floor, in absolute lightness points. Painted steel outdoors never
 * reads as pure shadow colour; this keeps dark paint from collapsing into a
 * silhouette while leaving light paint untouched.
 */
const AMBIENT_FLOOR = 4;

/**
 * Exposure, chosen so a side wall lands at exactly the colour that was asked
 * for. Without it every surface renders darker than the swatch the designer
 * picked, which makes `setColor('#2457FF')` look like it did the wrong thing.
 */
const EXPOSURE = 1.55;

/** How much a grazing angle lifts the specular sheen of painted steel. */
const SHEEN = 0.16;

export function normalize(v: Vec3): Vec3 {
  const m = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / m, v[1] / m, v[2] / m];
}

export function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

/** Rotate a vector about the Y (vertical) axis by `deg`. */
export function rotateY(v: Vec3, deg: number): Vec3 {
  const r = (deg * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  return [v[0] * c + v[2] * s, v[1], -v[0] * s + v[2] * c];
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/* ------------------------------------------------------------------ *
 * Parsing: hex, rgb()/rgba(), hsl()/hsla() all land in the same Hsl.
 * ------------------------------------------------------------------ */

export function parseColor(input: string): Hsl {
  const raw = input.trim().toLowerCase();

  const hex = raw.match(/^#([0-9a-f]{3,8})$/);
  if (hex) {
    let h = hex[1];
    if (h.length === 3 || h.length === 4) {
      h = h
        .split("")
        .map((c) => c + c)
        .join("");
    }
    const n = parseInt(h.slice(0, 6), 16);
    return rgbToHsl((n >> 16) & 255, (n >> 8) & 255, n & 255);
  }

  const rgb = raw.match(/^rgba?\(([^)]+)\)$/);
  if (rgb) {
    const [r, g, b] = rgb[1]
      .split(/[\s,/]+/)
      .filter(Boolean)
      .slice(0, 3)
      .map((p) => (p.endsWith("%") ? (parseFloat(p) / 100) * 255 : parseFloat(p)));
    return rgbToHsl(r, g, b);
  }

  const hsl = raw.match(/^hsla?\(([^)]+)\)$/);
  if (hsl) {
    const parts = hsl[1].split(/[\s,/]+/).filter(Boolean);
    return {
      h: ((parseFloat(parts[0]) % 360) + 360) % 360,
      s: clamp(parseFloat(parts[1]), 0, 100),
      l: clamp(parseFloat(parts[2]), 0, 100),
    };
  }

  throw new Error(`ShippingContainer: unsupported colour "${input}" (use hex, rgb() or hsl())`);
}

function rgbToHsl(r: number, g: number, b: number): Hsl {
  const rn = clamp(r, 0, 255) / 255;
  const gn = clamp(g, 0, 255) / 255;
  const bn = clamp(b, 0, 255) / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const d = max - min;

  if (d === 0) return { h: 0, s: 0, l: l * 100 };

  const s = d / (1 - Math.abs(2 * l - 1));
  let h: number;
  if (max === rn) h = ((gn - bn) / d) % 6;
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;

  return { h: ((h * 60) % 360 + 360) % 360, s: s * 100, l: l * 100 };
}

export const hslToCss = ({ h, s, l }: Hsl) =>
  `hsl(${h.toFixed(1)} ${clamp(s, 0, 100).toFixed(1)}% ${clamp(l, 0, 100).toFixed(1)}%)`;

/* ------------------------------------------------------------------ *
 * Shading
 * ------------------------------------------------------------------ */

/**
 * Shade one surface of a painted zone.
 *
 * `normal` is the surface normal in *world* space, so the caller rotates it by
 * the current orbit before calling. Keeping the lamps world-fixed is what makes
 * a full 360 turn read as one object lit from one side, rather than a box
 * carrying its highlights around with it.
 */
export function shade(base: Hsl, normal: Vec3, opts: { tint?: number; sheen?: boolean } = {}): string {
  const key = Math.max(0, dot(normal, LIGHT));
  const fill = Math.max(0, dot(normal, FILL));
  let factor = AMBIENT + KEY_POWER * key + FILL_POWER * fill;

  if (opts.sheen) {
    // Grazing light catches the crest of a ridge: add a narrow specular lift.
    factor += SHEEN * Math.pow(key, 6);
  }
  factor = factor * EXPOSURE * (opts.tint ?? 1);

  // Shade as an exponent on the *remaining headroom to white*, not as a plain
  // multiply. A multiply clips light paint to flat white at the highlight and
  // crushes dark paint to black in shadow; this curve cannot leave 0..100, so
  // cream keeps its roof corrugation and navy keeps its door markings.
  //
  //   l = 100 * (1 - (1 - base/100) ^ factor)
  //
  // factor === 1 returns the base colour untouched, which is what makes the
  // side wall read as exactly the colour that was asked for.
  const b = clamp(base.l, 0, 100) / 100;
  let l = 100 * (1 - Math.pow(1 - b, factor));
  l += AMBIENT_FLOOR * Math.max(0, 1 - factor);

  // Saturation rises slightly in shadow and falls in the highlight, which is
  // how real paint behaves and stops mid-tones looking chalky.
  const s = base.s * (1 + (1 - factor) * 0.22);

  return hslToCss({ h: base.h, s, l: clamp(l, 2, 98) });
}

/** Brand and classic presets the brief asks us to ship. */
export const PRESETS = [
  { name: "Brand blue", value: "#2457FF" },
  { name: "Navy", value: "#111C44" },
  { name: "Cream", value: "#F8F1E4" },
  { name: "Soft blue", value: "#D8E3FF" },
  { name: "Rust red", value: "#8E2B1E" },
  { name: "Green", value: "#2E6B3F" },
  { name: "Grey", value: "#7A7F85" },
] as const;
