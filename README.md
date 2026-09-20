# ZG Container

One reusable 3D shipping container, built and animated entirely with GSAP, in
three working use cases: a homepage hero, a services-page carousel and a pinned
scroll story.

| Route | Use case |
| --- | --- |
| `/` | Hero — crane-drop intro, click-to-open doors, pointer tilt, live recolouring |
| `/carousel` | Services page — five containers in a 3D ring, drag / keys / buttons / autoplay |
| `/scroll` | Scroll story — pinned, camera orbits 180°, doors open at the midpoint, fully scrubbed |
| `/lab` | Demo lab — every control: zone colours, picker, 360° orbit, size, weathering, teardown test |

```bash
npm install
npm run dev     # http://localhost:3000
npm run build
npm run lint
```

## Which 3D approach, and why

**CSS 3D transforms, not WebGL.** The brief asked for a recommendation:

- The slots must hold *real HTML* that screen readers and search engines can
  read. In WebGL that content is pixels in a canvas and has to be duplicated in
  a hidden DOM layer to be accessible at all.
- Recolouring must derive shading from a base colour at runtime with no baked
  textures. In the DOM that is a handful of custom properties; in WebGL it means
  shader uniforms plus a texture pipeline.
- Decals must stay crisp at any zoom. DOM text is resolution-independent for
  free.
- The budget is 150 KB gzipped for component JS. This component is **11.4 KB
  gzipped** (9.3 KB JS + 2.1 KB CSS), excluding GSAP. The WebGL route starts
  with a ~2 MB glb and a WebGL fallback path to maintain.

The cost is that lighting has to be computed rather than rendered, which is what
`color.ts` and `shading.ts` do. See *Known limits* for where that shows.

## Architecture

```
src/lib/container/
  types.ts            public option and API types
  geometry.ts         ISO dimensions, trapezoidal corrugation profile, fitting
  color.ts            colour parsing (hex/rgb/hsl) and the two-lamp shading model
  shading.ts          face normals -> the ~27 CSS custom properties the skin paints with
  build.ts            DOM construction: walls, roof, doors, castings, rails, interior
  ShippingContainer.ts the class: effects, API, lifecycle, destroy()
  effects/carousel.ts  ContainerCarousel — the 3D ring
  effects/scroll.ts    attachScrollStory — pinned, scrubbed camera orbit
  container.css        the 3D skin
src/components/
  container-view.tsx   React wrapper (useGSAP owns the lifecycle)
```

### The geometry is real

Dimensions come from ISO 668: 6.058 × 2.438 × 2.591 m for the 20 ft, 12.192 m
long for the 40 ft. Corrugation is a true trapezoidal profile — `p = c + v + 2w`
with the web run derived from the depth — at a 280 mm pitch on the walls and a
shallower 360 mm on the roof. Each ridge is three planes (rising web, crest,
falling web) over one full-size base plane that serves as every valley, which is
a third cheaper than modelling valleys separately for an identical result.

A desktop 20 ft box is 293 planes; tablet 206; mobile 158. The whole skin is
assembled as one HTML string and parsed once.

### The colour system

Nothing about the paint is baked. Each zone holds one HSL base, and every lit
surface derives its own colour from it:

```
factor = ambient + key·max(0, n·L) + fill·max(0, n·F)
l      = 100 · (1 − (1 − base/100) ^ factor)
```

The exponent form is the important part. A plain multiply clips light paint to
flat white in the highlight and crushes dark paint to black in shadow; this
curve cannot leave 0–100, so cream keeps its roof corrugation and navy keeps its
door markings. Exposure is set so `factor === 1` on a side wall, which means the
wall reads as exactly the colour that was asked for.

Normals are rotated by the current orbit before shading, so the lamps stay fixed
in world space through a full 360° turn. Recomputation is throttled to 2.5° of
orbit change and disabled entirely at `quality: "low"`.

Resulting HSL lightness across the shipped presets. The lit and shaded ridge
faces stay 5 to 13 points apart across the whole range — widest on mid greys,
narrowest on near-black navy — which is why the corrugation still reads at both
ends instead of flattening to a silhouette:

| Preset | side wall | ridge lit | ridge shaded | roof |
| --- | --- | --- | --- | --- |
| Brand blue | 43.3 | 46.9 | 35 | 54 |
| Navy | 17.4 | 19.2 | 14.1 | 23 |
| Cream | 93.3 | 95.1 | 87.1 | 97.5 |
| Green | 32.4 | 35.4 | 26 | 41.5 |
| Rust red | 34.7 | 37.9 | 27.9 | 44.2 |
| Grey | 49.9 | 53.8 | 40.8 | 61.2 |

Decals are deliberately *not* derived from the paint — they keep their own flat
colour, so `setColor()` never shifts the branding.

## API

```js
const box = new ShippingContainer(element, {
  size: '20ft',                 // '20ft' | '40ft'
  colors: { body: '#2457FF', doors: '#111C44', decals: '#F8F1E4', interior: '#D8E3FF' },
  effect: 'hero',               // 'hero' | 'carousel' | 'scroll'
  weathering: true,
  quality: 'high',              // omit to pick from viewport width
  orbit: -38,                   // degrees
  pitch: 7,                     // camera looks down by this much
  motion: { doorDuration: 0.9, doorEase: 'power2.inOut', colorDuration: 0.7 },
  onOpen, onClose, onChange,
});

box.setColor('#8E2B1E', { zone: 'body', duration: 0.7 });
box.openDoors(); box.closeDoors(); box.toggleDoors();
box.setContent('side', '<h3>Nationwide carriage</h3>');
box.setOrbit(120); box.orbitTo(180, 1.2); box.setPitch(10);
box.setWeathering(false);
box.whenReady((b) => { /* geometry exists, page is measurable */ });
box.destroy();
```

`next()` / `prev()` / `goTo(i)` exist on the instance and delegate to the
carousel that owns it, so the API in the brief works; the carousel itself is a
separate `ContainerCarousel` because a ring needs several containers.

### Durations and easings

Every duration and easing is an option (`motion`), never hard-coded. Defaults
follow the brief's motion rules: `power3` for travel, `power2.inOut` for doors,
no elastic or bounce anywhere except the single weighted settle on landing.

### Changing a colour

```js
box.setColor('hsl(210 90% 45%)', { zone: 'doors', duration: 0.8 });
```

Hex, `rgb()` and `hsl()` all work. Hue takes the short way round the wheel, so
blue to red does not sweep through green. Add a preset by appending to `PRESETS`
in `color.ts`.

### Adding content

```js
box.setContent('side', '<h3>Bonded storage</h3><p>HMRC approved</p>');
box.setContent('interior', '<h3>33.2 m³</h3><p>Plywood floor.</p>');
```

Real HTML in the DOM, so it is readable by screen readers and search engines.

### Adding an effect

An effect is a function that takes the instance and returns a teardown, the same
shape as `attachScrollStory`:

```ts
export function attachMyEffect(box: ShippingContainer, el: HTMLElement) {
  const tl = gsap.timeline();
  // drive box.setOrbit(), box.doorTimeline, box.elements.rig ...
  return () => tl.kill();
}
```

Call it inside `box.whenReady()` so the geometry exists, and call the teardown
from your component's cleanup.

### React

```tsx
<ContainerView
  options={{ size: '20ft', effect: 'hero' }}
  side="<h3>ZG Logistics</h3>"
  onReady={(box) => { ref.current = box; }}
/>
```

`useGSAP` owns the lifecycle. Props are mount-time configuration and the
dependency list is empty on purpose, so a parent re-render never rebuilds the
skin; change the container imperatively through the instance from `onReady`.

## Responsive and accessibility

`gsap.matchMedia()` sets up and tears down per breakpoint: desktop ≥1200 px (full
effects, pointer tilt, 5 carousel containers), tablet 768–1199 px (no tilt, 3
containers), mobile <768 px (1 container plus peeks, lighter geometry).

- Zero horizontal overflow at 375 / 834 / 1440 px, verified on every route.
- `prefers-reduced-motion` removes the camera orbit, the intro and autoplay;
  transitions become instant.
- Doors are a real `<button>` with `aria-expanded`, operable by click, Enter and
  Space, with a visible focus ring and a polite live region announcing state.
- Carousel announces the active container; non-active cards are `aria-hidden`
  with their controls removed from the tab order.
- Vertical page scrolling is never blocked by the carousel drag.
- A poster paints instantly and the geometry is built lazily on first
  intersection, so it does not delay first paint. Off-screen components pause.

## Verification

Everything below was measured on this build, not asserted.

| Check | Result |
| --- | --- |
| `tsc --noEmit`, `eslint`, `next build` | clean |
| Component JS + CSS, gzipped, excluding GSAP | **11.4 KB** (budget 150 KB) |
| Geometry at −180°…180° in 45° steps | no holes, no clipping, no z-fighting |
| Doors: bars → leaves → light, and full reverse | correct order, returns to identity |
| `destroy()` × 20 mount/unmount cycles | 293 planes before and after, 0 stray ScrollTriggers, tweens return to baseline, heap +0.6 MB (churn, not growth) |
| Decal colour across 4 paint changes | unchanged (`hsl(39 58.8% 93.3%)`) |
| Reduced motion | autoplay held, no orbit |
| Horizontal overflow, all routes, 375/834/1440 | none |
| Hero frame timing, full 360° orbit sweep | see *Frame rate* below — **not verified on real hardware** |

### Frame rate

**Unverified against the brief's target.** Treat every number below as a floor
measured on a software renderer, not as evidence the component hits 60 fps.

The only environment available here runs Chromium on SwiftShader — Chromium's
CPU rasteriser — so every CSS 3D plane is composited without a GPU. Measured
there, a continuous 360° orbit of the hero runs at a median of 30 fps with a
worst frame of 83 ms and 71% of frames over the 16.7 ms budget.

An earlier draft of this README claimed 60 fps with no frame over 20 ms. That
figure was wrong: the sampling window kept running for about three seconds
after the sweep had finished, so idle frames dominated the percentiles. The
in-page benchmark replaces it and samples only while the orbit is actually
moving.

To get a real number, open `/lab` on the device you care about and press **Run
benchmark**. It sweeps a full 360° for four seconds, reports the distribution
rather than an average, prints the WebGL renderer string, and flags a software
rasteriser with a warning so a meaningless result cannot be mistaken for a good
one. "Copy JSON" gives a pasteable record.

This is a device claim — "a mid-range laptop and a mid-range phone from the last
three years" — so it can only be settled by running it on those devices. A
remote GPU would answer a different question.

### Other known limits
- The carousel is the heavy case: five containers, ~1150 planes. If the
  benchmark comes back short on a target device, the first lever is
  `LAYOUTS[*].quality` in `effects/carousel.ts`.
- Rails, posts and castings wrap all four sides, so a single custom property
  cannot describe them directionally; they take a fixed relative tint off the
  body colour rather than per-orbit lighting. They are narrow enough that it
  does not read.
- The exploded view (the brief's optional extra) is not built.
- Lighthouse has not been run; it needs a deployed URL.
