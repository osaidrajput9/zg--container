/**
 * Builds the container's DOM.
 *
 * Every panel is a real CSS 3D plane, so the corrugation has actual depth and
 * the silhouette breaks up correctly as the box turns. A ridge is three planes
 * (rising web, crest, falling web) laid over one full-size base plane that
 * serves as every valley, which is a third cheaper than modelling each valley
 * separately for an identical result.
 *
 * The whole skin is assembled as one HTML string and parsed once. At high
 * quality a 40 ft box is ~700 planes; creating those through the DOM API one
 * at a time costs tens of milliseconds, while a single parse is ~2 ms.
 */

import {
  CASTING,
  DOOR_CORRUGATION,
  GASKET,
  ISO,
  POST_WIDTH,
  RAIL_HEIGHT,
  ROOF_CORRUGATION,
  WALL_CORRUGATION,
  ridgeCount,
  type Corrugation,
} from "./geometry";
import type { ContainerSize, Quality } from "./types";

/** A shading class. Each one resolves to a CSS custom property at paint time. */
export type FaceClass =
  | "sideR-base" | "sideR-crest" | "sideR-webA" | "sideR-webB"
  | "sideL-base" | "sideL-crest" | "sideL-webA" | "sideL-webB"
  | "endF-base" | "endF-crest" | "endF-webA" | "endF-webB"
  | "roof-base" | "roof-crest" | "roof-web"
  | "floor" | "rail" | "post" | "casting"
  | "door-base" | "door-crest" | "door-webA" | "door-webB"
  | "hardware" | "int-wall" | "int-floor" | "int-ceil";

const px = (n: number) => `${n.toFixed(2)}px`;

/** One absolutely-centred 3D plane. */
function plane(face: FaceClass, w: number, h: number, transform: string, extra = "", inner = "") {
  return (
    `<div class="sc-p sc-f--${face}${extra ? " " + extra : ""}" style="` +
    `width:${px(w)};height:${px(h)};margin-left:${px(-w / 2)};margin-top:${px(-h / 2)};` +
    `transform:${transform}">${inner}</div>`
  );
}

/**
 * Lay out one corrugated panel's ridges.
 *
 * Period layout, left to right: half valley, rising web, crest, falling web,
 * half valley. The base plane underneath supplies the valleys, so we only emit
 * the three raised faces.
 */
function ridges(
  span: number,
  height: number,
  c: Corrugation,
  count: number,
  classes: { crest: FaceClass; webA: FaceClass; webB: FaceClass },
  depthScale: number,
  place: (x: number, z: number, rotY: number, w: number, h: number, face: FaceClass) => string,
) {
  const pitch = span / count;
  const scale = pitch / c.pitch;
  const crest = c.crest * scale;
  const web = c.web * scale;
  const depth = c.depth * depthScale;
  const valley = pitch - crest - 2 * web;
  const webFace = Math.hypot(web, depth);
  const angle = (Math.atan2(depth, web) * 180) / Math.PI;

  let out = "";
  for (let i = 0; i < count; i++) {
    const x0 = -span / 2 + i * pitch;
    const riseC = x0 + valley / 2 + web / 2;
    const crestC = x0 + valley / 2 + web + crest / 2;
    const fallC = x0 + valley / 2 + web + crest + web / 2;
    out += place(riseC, depth / 2, -angle, webFace, height, classes.webA);
    out += place(crestC, depth, 0, crest, height, classes.crest);
    out += place(fallC, depth / 2, angle, webFace, height, classes.webB);
  }
  return out;
}

export interface BuildResult {
  html: string;
  /** Web angle actually used, per panel group — the shader needs it for normals. */
  angles: { wall: number; roof: number; door: number };
  dims: { L: number; W: number; H: number };
}

export function buildContainer(
  size: ContainerSize,
  unit: number,
  quality: Quality,
  opts: { weathering: boolean; sideContent: string; interiorContent: string; id: string },
): BuildResult {
  const d = ISO[size];
  const L = d.length * unit;
  const W = d.width * unit;
  const H = d.height * unit;
  const halfL = L / 2;
  const halfW = W / 2;
  const halfH = H / 2;

  const cast = { l: CASTING.length * unit, w: CASTING.width * unit, h: CASTING.height * unit };
  const rail = RAIL_HEIGHT * unit;
  const post = POST_WIDTH * unit;
  const gasket = GASKET * unit;

  const nWall = ridgeCount(d.length, WALL_CORRUGATION, quality);
  const nEnd = ridgeCount(d.width, WALL_CORRUGATION, quality);
  const nRoof = ridgeCount(d.length, ROOF_CORRUGATION, quality);
  const nDoor = ridgeCount(d.width / 2, DOOR_CORRUGATION, quality);

  // Corrugation only spans the panel between the rails and posts.
  const wallH = H - 2 * rail;
  const wallL = L - 2 * post;
  const endW = W - 2 * post;

  let s = "";

  /* ---- Side walls -------------------------------------------------- */
  // Right (+Z) and left (-Z). The left wall is the same panel turned 180deg,
  // which is why its ridge normals mirror in the shader.
  for (const side of ["R", "L"] as const) {
    const sign = side === "R" ? 1 : -1;
    const base = `translateZ(${px(sign * halfW)})${side === "L" ? " rotateY(180deg)" : ""}`;
    s += `<div class="sc-grp" style="transform:${base}">`;
    s += plane(`side${side}-base` as FaceClass, wallL, wallH, "translateZ(0px)");
    s += ridges(
      wallL, wallH, WALL_CORRUGATION, nWall,
      {
        crest: `side${side}-crest` as FaceClass,
        webA: `side${side}-webA` as FaceClass,
        webB: `side${side}-webB` as FaceClass,
      },
      unit,
      (x, z, r, w, h, f) => plane(f, w, h, `translate3d(${px(x)},0px,${px(z)}) rotateY(${r.toFixed(2)}deg)`),
    );
    // Branding decal panel — real HTML, so it stays crisp and screen readable.
    s += `<div class="sc-p sc-decal" style="width:${px(wallL * 0.46)};height:${px(wallH * 0.4)};` +
      `margin-left:${px(-wallL * 0.23)};margin-top:${px(-wallH * 0.2)};` +
      `transform:translate3d(${px(-wallL * 0.12)},0px,${px(WALL_CORRUGATION.depth * unit + 0.6)})">` +
      `<div class="sc-decal-in">${opts.sideContent}</div></div>`;
    s += `</div>`;
  }

  /* ---- Front end wall ---------------------------------------------- */
  s += `<div class="sc-grp" style="transform:translateX(${px(-halfL)}) rotateY(-90deg)">`;
  s += plane("endF-base", endW, wallH, "translateZ(0px)");
  s += ridges(endW, wallH, WALL_CORRUGATION, nEnd, {
    crest: "endF-crest", webA: "endF-webA", webB: "endF-webB",
  }, unit, (x, z, r, w, h, f) =>
    plane(f, w, h, `translate3d(${px(x)},0px,${px(z)}) rotateY(${r.toFixed(2)}deg)`));
  s += `</div>`;

  /* ---- Roof --------------------------------------------------------- */
  // Shallower profile than the walls, running across the width.
  s += `<div class="sc-grp" style="transform:translateY(${px(-halfH)}) rotateX(90deg)">`;
  s += plane("roof-base", L - 2 * post, W - 2 * post, "translateZ(0px)");
  s += ridges(L - 2 * post, W - 2 * post, ROOF_CORRUGATION, nRoof, {
    crest: "roof-crest", webA: "roof-web", webB: "roof-web",
  }, unit, (x, z, r, w, h, f) =>
    plane(f, w, h, `translate3d(${px(x)},0px,${px(z)}) rotateY(${r.toFixed(2)}deg)`));
  s += `</div>`;

  /* ---- Underside and cross members ---------------------------------- */
  s += `<div class="sc-grp" style="transform:translateY(${px(halfH)}) rotateX(-90deg)">`;
  s += plane("floor", L, W, "translateZ(0px)");
  const members = Math.max(4, Math.round(d.length / 0.5));
  for (let i = 1; i < members; i++) {
    const x = -L / 2 + (i * L) / members;
    s += plane("rail", unit * 0.05, W, `translate3d(${px(x)},0px,${px(unit * 0.04)})`);
  }
  s += `</div>`;

  s += buildRailsAndCastings(L, W, H, rail, post, cast);
  s += buildInterior(L, W, H, unit, opts.interiorContent);
  s += buildDoors(L, W, H, unit, rail, post, gasket, nDoor, opts.id);

  if (opts.weathering) s += `<div class="sc-weather"></div>`;

  return {
    html: s,
    angles: {
      wall: (Math.atan2(WALL_CORRUGATION.depth, WALL_CORRUGATION.web) * 180) / Math.PI,
      roof: (Math.atan2(ROOF_CORRUGATION.depth, ROOF_CORRUGATION.web) * 180) / Math.PI,
      door: (Math.atan2(DOOR_CORRUGATION.depth, DOOR_CORRUGATION.web) * 180) / Math.PI,
    },
    dims: { L, W, H },
  };
}

/** Top and bottom side rails, corner posts, and the eight ISO 1161 castings. */
function buildRailsAndCastings(
  L: number, W: number, H: number, rail: number, post: number,
  cast: { l: number; w: number; h: number },
) {
  let s = "";
  const halfL = L / 2, halfW = W / 2, halfH = H / 2;

  for (const zs of [1, -1]) {
    for (const ys of [1, -1]) {
      // Side rail: a shallow box, so it catches its own highlight.
      s += plane("rail", L, rail,
        `translate3d(0px,${px(ys * (halfH - rail / 2))},${px(zs * (halfW + 1))})` +
        (zs === -1 ? " rotateY(180deg)" : ""));
      s += plane("rail", L, rail * 0.55,
        `translate3d(0px,${px(ys * (halfH - rail))},${px(zs * (halfW + 1))}) rotateX(${ys > 0 ? -58 : 58}deg)`);
    }
  }

  // Corner posts at all four vertical edges.
  for (const xs of [1, -1]) {
    for (const zs of [1, -1]) {
      s += plane("post", post, H - 2 * rail,
        `translate3d(${px(xs * (halfL - post / 2))},0px,${px(zs * (halfW + 1.2))})`);
      s += plane("post", post * 0.9, H - 2 * rail,
        `translate3d(${px(xs * (halfL + 1.2))},0px,${px(zs * (halfW - post / 2))}) rotateY(90deg)`);
    }
  }

  // Eight castings. Each is three visible planes plus its oval aperture.
  for (const xs of [1, -1]) {
    for (const ys of [1, -1]) {
      for (const zs of [1, -1]) {
        const cx = xs * (halfL - cast.l / 2);
        const cy = ys * (halfH - cast.h / 2);
        const cz = zs * (halfW - cast.w / 2);
        const g = `translate3d(${px(cx)},${px(cy)},${px(cz)})`;
        s += `<div class="sc-grp sc-cast" style="transform:${g}">`;
        s += plane("casting", cast.l, cast.h, `translateZ(${px(zs * (cast.w / 2 + 1))})${zs < 0 ? " rotateY(180deg)" : ""}`,
          "sc-cast-face", `<i class="sc-ap"></i>`);
        s += plane("casting", cast.w, cast.h, `translateX(${px(xs * (cast.l / 2 + 1))}) rotateY(${xs > 0 ? 90 : -90}deg)`,
          "sc-cast-face", `<i class="sc-ap"></i>`);
        s += plane("casting", cast.l, cast.w, `translateY(${px(ys * (cast.h / 2 + 1))}) rotateX(${ys > 0 ? -90 : 90}deg)`,
          "sc-cast-face", `<i class="sc-ap sc-ap--top"></i>`);
        s += `</div>`;
      }
    }
  }
  return s;
}

/** Plywood floor, ribbed liner walls and the ceiling, seen when the doors open. */
function buildInterior(L: number, W: number, H: number, unit: number, content: string) {
  const inset = unit * 0.09;
  let s = `<div class="sc-grp sc-interior">`;
  s += plane("int-floor", L - inset, W - inset, `translateY(${px(H / 2 - inset)}) rotateX(90deg)`);
  s += plane("int-ceil", L - inset, W - inset, `translateY(${px(-H / 2 + inset)}) rotateX(-90deg)`);
  for (const zs of [1, -1]) {
    s += plane("int-wall", L - inset, H - inset,
      `translateZ(${px(zs * (W / 2 - inset))})${zs > 0 ? " rotateY(180deg)" : ""}`);
  }
  s += plane("int-wall", W - inset, H - inset, `translateX(${px(-L / 2 + inset)}) rotateY(90deg)`);
  // Content billboard, standing just inside the doors so it reads on reveal.
  s += `<div class="sc-p sc-cargo" style="width:${px(W * 0.66)};height:${px(H * 0.48)};` +
    `margin-left:${px(-W * 0.33)};margin-top:${px(-H * 0.24)};` +
    `transform:translate3d(${px(L / 2 - unit * 1.5)},0px,0px) rotateY(90deg)">` +
    `<div class="sc-cargo-in">${content}</div></div>`;
  s += `<div class="sc-int-light"></div></div>`;
  return s;
}

/** Two door leaves with locking bars, cam keepers, handles, hinges and gasket. */
function buildDoors(
  L: number, W: number, H: number, unit: number, rail: number, post: number,
  gasket: number, nDoor: number, id: string,
) {
  const leafW = W / 2 - gasket;
  const leafH = H - gasket;
  let s = `<div class="sc-grp sc-doorframe" style="transform:translateX(${px(L / 2)}) rotateY(90deg)">`;
  s += `<div class="sc-p sc-gasket" style="width:${px(W)};height:${px(H)};` +
    `margin-left:${px(-W / 2)};margin-top:${px(-H / 2)};` +
    `--sc-gasket-w:${px(gasket)};transform:translateZ(-1px)"></div>`;

  for (const side of ["right", "left"] as const) {
    const sign = side === "right" ? 1 : -1;
    // Hinged on the outer vertical edge: the pivot sits at the leaf's far side,
    // so the leaf swings around the real hinge line rather than its own centre.
    const originX = sign > 0 ? "100%" : "0%";
    const offset = sign * (leafW / 2 + gasket / 2);
    s +=
      `<div class="sc-leaf sc-leaf--${side}" data-leaf="${side}" ` +
      `style="width:${px(leafW)};height:${px(leafH)};margin-left:${px(-leafW / 2)};` +
      `margin-top:${px(-leafH / 2)};transform-origin:${originX} 50%;` +
      `transform:translate3d(${px(offset)},0px,0px)">`;

    s += plane("door-base", leafW, leafH - 2 * rail, "translateZ(0px)");
    s += ridges(leafW, leafH - 2 * rail, DOOR_CORRUGATION, nDoor, {
      crest: "door-crest", webA: "door-webA", webB: "door-webB",
    }, unit, (x, z, r, w, h, f) =>
      plane(f, w, h, `translate3d(${px(x)},0px,${px(z)}) rotateY(${r.toFixed(2)}deg)`));

    // Perimeter frame members.
    for (const ys of [1, -1]) {
      s += plane("rail", leafW, rail, `translate3d(0px,${px(ys * (leafH / 2 - rail / 2))},${px(unit * 0.035)})`);
    }

    // Two vertical locking bars per leaf, each with cam keepers top and bottom.
    for (const b of [0, 1]) {
      const bx = (b === 0 ? -0.26 : 0.22) * leafW * (sign > 0 ? 1 : -1);
      s += `<div class="sc-bar" data-bar style="height:${px(leafH - rail * 1.4)};` +
        `width:${px(unit * 0.05)};margin-left:${px(-unit * 0.025)};` +
        `margin-top:${px(-(leafH - rail * 1.4) / 2)};` +
        `transform:translate3d(${px(bx)},0px,${px(unit * 0.055)})">` +
        `<i class="sc-keeper sc-keeper--t"></i><i class="sc-keeper sc-keeper--b"></i>` +
        `<i class="sc-handle"></i></div>`;
    }

    // Four hinges down the outer edge.
    for (let i = 0; i < 4; i++) {
      const hy = (-0.5 + (i + 0.5) / 4) * (leafH - rail);
      s += `<i class="sc-hinge" style="transform:translate3d(` +
        `${px(sign * (leafW / 2 - unit * 0.02))},${px(hy)},${px(unit * 0.05)})"></i>`;
    }

    if (side === "right") {
      // ID code, size/type code and data plate live on the right leaf.
      s += `<div class="sc-marks" aria-hidden="true">` +
        `<span class="sc-mark-id">ABCU 123456 7</span>` +
        `<span class="sc-mark-type">22G1</span>` +
        `<span class="sc-mark-plate">CSC SAFETY APPROVAL<br>GB/${id.slice(-4).toUpperCase()}/2026<br>MAX GROSS 30,480 KG</span>` +
        `</div>`;
    }
    s += `</div>`;
  }
  s += `</div>`;
  return s;
}
