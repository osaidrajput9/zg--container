/**
 * ShippingContainer — one reusable 3D container, animated entirely by GSAP.
 *
 * Lifecycle: every tween, ScrollTrigger, Draggable, matchMedia query and DOM
 * listener this instance creates is registered inside a single gsap.context,
 * so `destroy()` is one `ctx.revert()` plus the observers. That is what makes
 * the mount/unmount-20-times test come back clean.
 */

import { gsap, ScrollTrigger } from "@/lib/gsap";
import { buildContainer } from "./build";
import { parseColor, type Hsl } from "./color";
import { ISO, unitScale } from "./geometry";
import { applyShading, computeShading, type ZoneHsl } from "./shading";
import type {
  ColorInput, ColorZone, ContainerOptions, ContentSlots,
  EffectName, MotionOptions, Quality, SetColorOptions,
} from "./types";
import "./container.css";

/** The skin is built once at this scale and then transformed to fit. */
const REF_UNIT = 100;
/** Perspective is held proportional to the scale, so resizing is a similarity. */
const PERSPECTIVE_RATIO = 17;

const DEFAULT_MOTION: Required<MotionOptions> = {
  introDuration: 1.2,
  introEase: "power3.out",
  doorDuration: 0.9,
  doorEase: "power2.inOut",
  doorStagger: 0.15,
  colorDuration: 0.7,
  orbitEase: "power3.inOut",
  tiltMax: 8,
};

const DEFAULT_COLORS = {
  body: "#2457FF",
  doors: "#111C44",
  decals: "#F8F1E4",
  interior: "#D8E3FF",
};

let uid = 0;

export class ShippingContainer {
  readonly el: HTMLElement;
  readonly id = `sc${++uid}`;

  private opts: Required<Pick<ContainerOptions, "size" | "weathering" | "autoplay" | "orbit">> & ContainerOptions;
  private motion: Required<MotionOptions>;

  private ctx!: gsap.Context;
  private mm!: gsap.MatchMedia;
  private io?: IntersectionObserver;
  private ro?: ResizeObserver;

  private scene!: HTMLElement;
  private poster!: HTMLElement;
  private scaler!: HTMLElement;
  private rig!: HTMLElement;
  private box!: HTMLElement;
  private shadow!: HTMLElement;
  private hit!: HTMLButtonElement;
  private live!: HTMLElement;

  private colors: ZoneHsl;
  private angles = { wall: 0, roof: 0, door: 0 };
  private quality: Quality = "high";
  private worldLit = true;
  private built = false;
  private destroyed = false;
  private readyCbs: Array<(box: ShippingContainer) => void> = [];

  private doorTl?: gsap.core.Timeline;
  private introTl?: gsap.core.Timeline;
  private orbit: number;
  /** Camera pitch. A few degrees of downward look is what puts the roof and
   *  the ground shadow in frame; at zero both are edge-on and invisible. */
  private pitch: number;
  private lastShaded = Number.NaN;
  private tiltX?: gsap.QuickToFunc;
  private tiltY?: gsap.QuickToFunc;
  private reduced = false;
  private cleanups: Array<() => void> = [];
  private effect: EffectName;
  private content: ContentSlots = {};

  /** Set by ContainerCarousel so the brief's box.next()/prev()/goTo() work. */
  carousel?: { next(): void; prev(): void; goTo(i: number): void };

  constructor(element: HTMLElement | string, options: ContainerOptions = {}) {
    const el = typeof element === "string" ? document.querySelector<HTMLElement>(element) : element;
    if (!el) throw new Error("ShippingContainer: element not found");
    this.el = el;

    this.opts = {
      size: options.size ?? "20ft",
      weathering: options.weathering ?? true,
      autoplay: options.autoplay ?? 0,
      orbit: options.orbit ?? -38,
      ...options,
    };
    this.motion = { ...DEFAULT_MOTION, ...(options.motion ?? {}) };
    this.effect = options.effect ?? "hero";
    this.orbit = this.opts.orbit;
    this.pitch = options.pitch ?? 7;

    const c = { ...DEFAULT_COLORS, ...(options.colors ?? {}) };
    this.colors = {
      body: parseColor(c.body),
      doors: parseColor(c.doors),
      decals: parseColor(c.decals),
      interior: parseColor(c.interior),
    };

    this.mount();
  }

  /* ================================================================== *
   * Mount
   * ================================================================== */

  private mount() {
    this.el.classList.add("sc-root");
    // The contact shadow lives OUTSIDE .sc-scene on purpose. Its blur filter
    // flattens it out of 3D sorting, after which the browser paints it in
    // stacking order rather than by depth — landing it between the wall's base
    // planes and its ridge crests and blacking out the corrugation valleys.
    // z-index cannot fix that from inside a preserve-3d tree, so the only
    // reliable answer is to keep it out of the 3D context altogether.
    this.el.innerHTML =
      `<div class="sc-shadow" data-shadow></div>` +
      `<div class="sc-scene" data-scene>` +
      `<div class="sc-poster" data-poster><div class="sc-poster-box"></div></div>` +
      `<div class="sc-stage">` +
      `<div class="sc-scale" data-scale>` +
      `<div class="sc-rig" data-rig><div class="sc-box" data-box></div></div>` +
      `</div></div>` +
      `<button class="sc-hit" type="button" data-hit aria-expanded="false">` +
      `<span class="sc-sr">Open the container doors</span></button>` +
      `<p class="sc-sr" role="status" aria-live="polite" data-live></p>` +
      `</div>`;

    this.scene = this.el.querySelector("[data-scene]")!;
    this.poster = this.el.querySelector("[data-poster]")!;
    this.scaler = this.el.querySelector("[data-scale]")!;
    this.rig = this.el.querySelector("[data-rig]")!;
    this.box = this.el.querySelector("[data-box]")!;
    this.shadow = this.el.querySelector("[data-shadow]")!;
    this.hit = this.el.querySelector("[data-hit]")!;
    this.live = this.el.querySelector("[data-live]")!;

    // Poster tint tracks the body colour so the placeholder never flashes a
    // colour the real container is not about to be.
    this.scene.style.setProperty("--sc-poster-hi", `hsl(${this.colors.body.h} ${this.colors.body.s}% ${Math.min(74, this.colors.body.l + 16)}%)`);
    this.scene.style.setProperty("--sc-poster-lo", `hsl(${this.colors.body.h} ${this.colors.body.s}% ${Math.max(16, this.colors.body.l - 14)}%)`);

    this.ctx = gsap.context(() => {}, this.el);
    this.resize();

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(this.el);

    // Poster paints instantly; the ~700-plane skin is built only once the
    // component is actually about to be seen, so it never delays first paint.
    // A pinned scroll story owns the page it is on, so build it up front
    // rather than racing the observer against ScrollTrigger's measurements.
    if (this.effect === "scroll") {
      requestAnimationFrame(() => this.build());
    }

    this.io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting && !this.built) this.build();
          // Off-screen components stop consuming frames entirely.
          if (this.built) this.setActive(e.isIntersecting);
        }
      },
      { rootMargin: "200px" },
    );
    this.io.observe(this.el);
  }

  private resize() {
    const dims = ISO[this.opts.size];
    const w = this.el.clientWidth || 640;
    const unit = unitScale(w, dims);
    const scale = unit / REF_UNIT;
    // scale3d, never scale(). A 2D scale leaves every descendant's translateZ
    // at reference scale while stretching x and y, which squashes the depth
    // axis relative to the other two and makes planes at different depths
    // project inconsistently. Scaling all three axes keeps the geometry
    // similar, and since perspective is held proportional to the same unit the
    // projection is an exact similarity at every size.
    this.scaler.style.transform = `scale3d(${scale.toFixed(4)},${scale.toFixed(4)},${scale.toFixed(4)})`;
    this.scene.style.setProperty("--sc-perspective", `${(PERSPECTIVE_RATIO * unit).toFixed(0)}px`);
    this.scene.style.height = `${(dims.height * unit * 1.46).toFixed(0)}px`;

    // The contact shadow is a flat ellipse in screen space, not a 3D plane.
    // A blurred plane inside the preserve-3d tree gets flattened by its own
    // filter and then sorts by a single depth, which lands it *between* the
    // wall's base planes and its ridge crests — painting the corrugation
    // valleys near-black while the crests stay lit. Screen space has no such
    // failure mode, blurs far cheaper, and looks identical.
    if (this.shadow) {
      const w = dims.length * unit * 1.02;
      const h = dims.width * unit * 0.42;
      this.shadow.style.width = `${w.toFixed(0)}px`;
      this.shadow.style.height = `${h.toFixed(0)}px`;
      this.shadow.style.marginLeft = `${(-w / 2).toFixed(0)}px`;
      this.shadow.style.top = `${(dims.height * unit * (0.73 + 0.5) - h / 2).toFixed(0)}px`;
      this.shadow.style.setProperty("--sc-shadow-blur", `${(dims.width * unit * 0.07).toFixed(1)}px`);
    }
  }

  private pickQuality(): Quality {
    const w = window.innerWidth;
    if (w < 768) return "low";
    if (w < 1200) return "medium";
    return "high";
  }

  private build() {
    if (this.built || this.destroyed) return;
    this.built = true;
    this.quality = this.opts.quality ?? this.pickQuality();
    this.worldLit = this.quality !== "low";

    const result = buildContainer(this.opts.size, REF_UNIT, this.quality, {
      weathering: this.opts.weathering,
      sideContent: this.content.side ?? "",
      interiorContent: this.content.interior ?? "",
      id: this.id,
    });
    this.angles = result.angles;
    this.box.innerHTML = result.html;
    this.box.classList.toggle("sc-weathered", this.opts.weathering);

    this.paint(true);
    this.applyOrbit(this.orbit, this.pitch);

    // The placeholder has done its job the moment real geometry exists.
    // Leaving it in the scene would show through the corrugation valleys.
    gsap.to(this.poster, {
      opacity: 0,
      duration: 0.35,
      ease: "power2.out",
      onComplete: () => { this.poster.style.display = "none"; },
    });

    this.ctx.add(() => {
      this.buildDoorTimeline();
      this.cleanups.push(this.bindInput());
      this.setupMedia();
    });

    // The skin only now has real dimensions, and the scene only now has a
    // height. Anything measuring the page — a pinned ScrollTrigger above all —
    // was working from a zero-height placeholder until this point.
    ScrollTrigger.refresh();

    const cbs = this.readyCbs;
    this.readyCbs = [];
    cbs.forEach((cb) => cb(this));
  }

  /* ================================================================== *
   * Painting
   * ================================================================== */

  private paint(force = false) {
    if (!this.built) return;
    // Reshading writes 27 custom properties onto the box, which invalidates
    // style for every plane beneath it. 2.5 degrees is below the threshold
    // where the stepping is visible and roughly halves the work during a scrub.
    if (!force && Math.abs(this.orbit - this.lastShaded) < 2.5) return;
    this.lastShaded = this.orbit;
    applyShading(
      this.box,
      computeShading({ colors: this.colors, angles: this.angles, orbit: this.orbit, worldLit: this.worldLit }),
    );
  }

  private applyOrbit(deg: number, pitch: number) {
    this.orbit = deg;
    gsap.set(this.rig, { rotationY: deg, rotationX: -pitch });
    this.paint(true);
  }

  /* ================================================================== *
   * Door timeline — one timeline, played forward or reversed.
   * ================================================================== */

  private buildDoorTimeline() {
    const leaves = {
      right: this.box.querySelector<HTMLElement>('[data-leaf="right"]')!,
      left: this.box.querySelector<HTMLElement>('[data-leaf="left"]')!,
    };
    const bars = gsap.utils.toArray<HTMLElement>(this.box.querySelectorAll("[data-bar]"));
    const light = this.box.querySelector<HTMLElement>(".sc-int-light")!;
    const cargo = this.box.querySelector<HTMLElement>(".sc-cargo")!;
    const interior = this.box.querySelector<HTMLElement>(".sc-interior")!;
    const { doorDuration: d, doorEase: ease, doorStagger } = this.motion;

    // A single paused timeline is the whole reversibility story: play() and
    // reverse() pick up from wherever the heads currently are, so closing the
    // doors mid-open eases back from that exact angle with no jump.
    const tl = gsap.timeline({
      paused: true,
      onComplete: () => {
        this.hit.setAttribute("aria-expanded", "true");
        this.announce("Container doors open");
        this.opts.onOpen?.();
      },
      onReverseComplete: () => {
        this.hit.setAttribute("aria-expanded", "false");
        this.announce("Container doors closed");
        this.opts.onClose?.();
      },
    });

    // Bars rotate first to lift the cams clear of the keepers, then the leaves
    // are free to swing. Overlapping these would clip the cam through the frame.
    // The liner only enters the render once a leaf has actually started to
    // move; reversing the timeline puts it back out of the scene.
    // Placed just before the leaves start to move, not at position 0: a
    // scrubbed story renders the timeline at progress 0, and a set there would
    // put the liner in the scene while the doors are still shut.
    tl.set(interior, { visibility: "visible" }, d * 0.26)
      .to(bars, { rotationY: -96, duration: d * 0.38, ease }, 0)
      .to(leaves.right, { rotationY: -96, duration: d, ease }, d * 0.3)
      .to(leaves.left, { rotationY: 96, duration: d, ease }, d * 0.3 + doorStagger)
      .to(light, { opacity: 1, duration: d * 0.8, ease: "power2.out" }, d * 0.55)
      .to(cargo, { opacity: 1, duration: d * 0.7, ease: "power2.out" }, d * 0.7);

    this.doorTl = tl;
  }

  /* ================================================================== *
   * Input
   * ================================================================== */

  private bindInput() {
    const onClick = () => this.toggleDoors();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        this.toggleDoors();
      }
      if (e.key === "ArrowRight") this.carousel?.next();
      if (e.key === "ArrowLeft") this.carousel?.prev();
    };
    this.hit.addEventListener("click", onClick);
    this.hit.addEventListener("keydown", onKey);
    // Registered inside the context so revert() removes them.
    return () => {
      this.hit.removeEventListener("click", onClick);
      this.hit.removeEventListener("keydown", onKey);
    };
  }

  /** Breakpoint and reduced-motion setup, each with its own teardown. */
  private setupMedia() {
    this.mm = gsap.matchMedia(this.el);

    this.mm.add("(prefers-reduced-motion: reduce)", () => {
      this.reduced = true;
      // Transitions become instant; nothing orbits or autoplays on its own.
      this.doorTl?.timeScale(3);
      return () => {
        this.reduced = false;
        this.doorTl?.timeScale(1);
      };
    });

    // Pointer tilt is desktop-only and never runs under reduced motion.
    this.mm.add("(min-width: 1200px) and (prefers-reduced-motion: no-preference) and (hover: hover)", () => {
      const max = this.motion.tiltMax;
      // quickTo keeps one reusable tween per axis instead of allocating a new
      // tween on every mousemove — the difference between smooth and janky.
      this.tiltY = gsap.quickTo(this.rig, "rotationY", { duration: 0.6, ease: "power3.out" });
      this.tiltX = gsap.quickTo(this.rig, "rotationX", { duration: 0.6, ease: "power3.out" });

      const onMove = (e: PointerEvent) => {
        if (this.effect === "scroll") return;
        const r = this.scene.getBoundingClientRect();
        const nx = (e.clientX - r.left) / r.width - 0.5;
        const ny = (e.clientY - r.top) / r.height - 0.5;
        this.tiltY?.(this.orbit + nx * max * 2);
        // Tilt is an offset from the resting pitch, not a replacement for it.
        this.tiltX?.(-this.pitch + gsap.utils.clamp(-max, max, -ny * max * 1.4));
        // The highlight sweep tracks the cursor across the corrugation.
        this.box.style.setProperty("--sc-sweep", `${(nx * 100).toFixed(1)}%`);
      };
      const onLeave = () => {
        this.tiltY?.(this.orbit);
        this.tiltX?.(-this.pitch);
      };

      this.scene.addEventListener("pointermove", onMove);
      this.scene.addEventListener("pointerleave", onLeave);
      return () => {
        this.scene.removeEventListener("pointermove", onMove);
        this.scene.removeEventListener("pointerleave", onLeave);
        this.tiltX = this.tiltY = undefined;
      };
    });

    if (this.effect === "hero") this.playIntro();
  }

  private setActive(on: boolean) {
    // Pausing the root timelines is cheaper than pausing the global ticker and
    // leaves other components on the page running.
    if (on) this.introTl?.resume();
    else this.introTl?.pause();
  }

  private announce(msg: string) {
    this.live.textContent = msg;
  }

  /* ================================================================== *
   * Public API
   * ================================================================== */

  /**
   * Run `cb` once the skin exists, immediately if it already does.
   *
   * The geometry is built lazily on first intersection, so anything that needs
   * real measurements — a pinned scroll story, a layout read — must wait for
   * this rather than for the constructor to return.
   */
  whenReady(cb: (box: ShippingContainer) => void): this {
    if (this.built) cb(this);
    else this.readyCbs.push(cb);
    return this;
  }

  get isBuilt(): boolean {
    return this.built;
  }

  /** Intro: lowered in as if from a crane, one weighted settle, shadow tightens. */
  playIntro(): gsap.core.Timeline {
    const { introDuration: d, introEase } = this.motion;
    this.introTl?.kill();

    const tl = gsap.timeline();
    if (this.reduced) {
      tl.set(this.scaler, { autoAlpha: 1 }).fromTo(this.el, { opacity: 0 }, { opacity: 1, duration: 0.3 });
      this.introTl = tl;
      return tl;
    }

    const drop = ISO[this.opts.size].height * REF_UNIT * 1.35;
    tl.from(this.rig, { y: -drop, duration: d * 0.86, ease: introEase })
      // The settle: a single short dip and recovery, ~1.6% of the box height.
      // No elastic or bounce — steel deflects once and stops.
      .to(this.rig, { y: REF_UNIT * 0.042, duration: d * 0.1, ease: "power2.out" })
      .to(this.rig, { y: 0, duration: d * 0.22, ease: "power2.inOut" })
      // Shadow starts wide and soft, then tightens as the box lands.
      .fromTo(
        this.shadow,
        { scaleX: 1.55, scaleY: 1.7, opacity: 0.07 },
        { scaleX: 1, scaleY: 1, opacity: 1, duration: d * 0.86, ease: introEase },
        0,
      )
      .to(this.shadow, { scaleX: 0.97, scaleY: 0.94, duration: d * 0.1, ease: "power2.out" }, d * 0.86)
      .to(this.shadow, { scaleX: 1, scaleY: 1, duration: d * 0.22, ease: "power2.inOut" });

    this.introTl = tl;
    return tl;
  }

  /**
   * Recolour a zone. Hue takes the short way round the wheel, so blue to red
   * does not sweep through green on the way.
   */
  setColor(color: ColorInput, options: SetColorOptions = {}): this {
    const zone: ColorZone = options.zone ?? "body";
    const target = parseColor(color);
    const current = this.colors[zone];
    const duration = options.duration ?? this.motion.colorDuration;

    let dh = target.h - current.h;
    if (dh > 180) dh -= 360;
    if (dh < -180) dh += 360;

    const proxy = { ...current };
    gsap.killTweensOf(proxy);
    gsap.to(proxy, {
      h: current.h + dh,
      s: target.s,
      l: target.l,
      duration: this.reduced ? 0 : duration,
      ease: options.ease ?? "power2.inOut",
      onUpdate: () => {
        this.colors[zone] = { h: ((proxy.h % 360) + 360) % 360, s: proxy.s, l: proxy.l } as Hsl;
        this.paint(true);
      },
      onComplete: () => {
        this.colors[zone] = target;
        this.paint(true);
        this.opts.onChange?.({ index: 0, total: 1 });
      },
    });
    return this;
  }

  openDoors(): this {
    this.doorTl?.play();
    return this;
  }

  closeDoors(): this {
    this.doorTl?.reverse();
    return this;
  }

  toggleDoors(): this {
    const tl = this.doorTl;
    if (!tl) return this;
    // reversed() alone is wrong before the first play, so test progress too.
    const opening = tl.reversed() || tl.progress() === 0;
    return opening ? this.openDoors() : this.closeDoors();
  }

  get doorsOpen(): boolean {
    return !!this.doorTl && this.doorTl.progress() > 0.5 && !this.doorTl.reversed();
  }

  /** Switch effects at runtime. Each effect module owns its own teardown. */
  use(effect: EffectName): this {
    this.effect = effect;
    return this;
  }

  get currentEffect(): EffectName {
    return this.effect;
  }

  next(): this { this.carousel?.next(); return this; }
  prev(): this { this.carousel?.prev(); return this; }
  goTo(i: number): this { this.carousel?.goTo(i); return this; }

  /** Real HTML, so slot content stays readable by search engines and AT. */
  setContent(slot: keyof ContentSlots, html: string): this {
    this.content[slot] = html;
    if (!this.built) return this;
    const target = slot === "side"
      ? this.box.querySelectorAll<HTMLElement>(".sc-decal-in")
      : this.box.querySelectorAll<HTMLElement>(".sc-cargo-in");
    target.forEach((n) => { n.innerHTML = html; });
    return this;
  }

  setWeathering(on: boolean): this {
    this.opts.weathering = on;
    this.box.classList.toggle("sc-weathered", on);
    return this;
  }

  /** Orbit to an absolute angle. Used by the scroll story and the demo page. */
  orbitTo(deg: number, duration = 0.9): this {
    gsap.to(this, {
      orbit: deg,
      duration: this.reduced ? 0 : duration,
      ease: this.motion.orbitEase,
      onUpdate: () => {
        gsap.set(this.rig, { rotationY: this.orbit, rotationX: -this.pitch });
        this.paint();
      },
    });
    return this;
  }

  /** Direct, un-tweened orbit for scrubbed and dragged effects. */
  setOrbit(deg: number): this {
    this.orbit = deg;
    gsap.set(this.rig, { rotationY: deg, rotationX: -this.pitch });
    this.paint();
    return this;
  }

  /** Camera pitch in degrees; positive looks down on the box. */
  setPitch(deg: number): this {
    this.pitch = deg;
    gsap.set(this.rig, { rotationX: -deg });
    return this;
  }

  get elements() {
    return { scene: this.scene, rig: this.rig, box: this.box, shadow: this.shadow, hit: this.hit };
  }

  get doorTimeline() {
    return this.doorTl;
  }

  get isReduced() {
    return this.reduced;
  }

  get stats() {
    return { planes: this.box.querySelectorAll(".sc-p").length, quality: this.quality, worldLit: this.worldLit };
  }

  /** Kills every tween, trigger, listener and observer this instance created. */
  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.io?.disconnect();
    this.ro?.disconnect();
    this.cleanups.forEach((fn) => fn());
    this.cleanups = [];
    this.doorTl?.kill();
    this.introTl?.kill();
    this.mm?.revert();
    this.ctx?.revert();
    gsap.killTweensOf(this);
    gsap.killTweensOf([this.rig, this.box, this.shadow]);
    ScrollTrigger.getAll()
      .filter((t) => this.el.contains(t.trigger as Node))
      .forEach((t) => t.kill());
    this.el.innerHTML = "";
    this.el.classList.remove("sc-root");
  }
}
