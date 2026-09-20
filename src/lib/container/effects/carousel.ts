/**
 * Carousel — several containers in a 3D arrangement.
 *
 * Each container renders inside its own perspective and is then placed in the
 * track's 3D space as a card. Nesting it that way, rather than putting every
 * box in one shared perspective, keeps each container's own orbit correct and
 * sidesteps the flattening browsers apply to deeply nested preserve-3d trees.
 *
 * Position is driven by one number: the fractional active index. Drag, keys,
 * buttons and autoplay all write to it, and a single render pass reads it, so
 * the four input routes can never disagree about where the ring is.
 */

import { Draggable, gsap, InertiaPlugin } from "@/lib/gsap";
import { ShippingContainer } from "../ShippingContainer";
import type { ContainerOptions, Quality } from "../types";

// Referenced so bundlers keep the plugin: Draggable only reads it by name.
void InertiaPlugin;

export interface CarouselItem extends ContainerOptions {
  label: string;
  side?: string;
  interior?: string;
}

export interface CarouselOptions {
  items: CarouselItem[];
  /** Seconds between advances. 0 disables autoplay. */
  autoplay?: number;
  startIndex?: number;
  onChange?: (detail: { index: number; total: number; label: string }) => void;
}

interface Layout {
  visible: number;
  /** Step between neighbours, as a fraction of the track width. */
  spacing: number;
  /** Card width, as a fraction of the track width. */
  card: number;
  /** How far each step pushes a card away from the camera, in px. */
  recede: number;
  tilt: number;
  /** Opacity lost per step away from the active card. */
  dim: number;
  quality: Quality;
}

// `visible` is what the brief asks to see at each breakpoint; spacing and card
// width are chosen so that many actually fit. The cards overlap deliberately —
// the neighbours tuck behind the active one rather than sitting in a row.
const LAYOUTS: Record<"desktop" | "tablet" | "mobile", Layout> = {
  desktop: { visible: 5, spacing: 0.235, card: 0.4, recede: 340, tilt: 44, dim: 0.3, quality: "medium" },
  tablet: { visible: 3, spacing: 0.33, card: 0.54, recede: 270, tilt: 38, dim: 0.36, quality: "medium" },
  // Mobile shows one, with its neighbours peeking in at the edges.
  mobile: { visible: 1, spacing: 0.64, card: 0.74, recede: 190, tilt: 26, dim: 0.44, quality: "low" },
};

export class ContainerCarousel {
  readonly el: HTMLElement;
  private track!: HTMLElement;
  private cards: HTMLElement[] = [];
  private hits: HTMLButtonElement[][] = [];
  private announced = -1;
  private boxes: ShippingContainer[] = [];
  private live!: HTMLElement;

  private items: CarouselItem[];
  private layout: Layout = LAYOUTS.desktop;
  private pos: number;
  private step = 260;
  private reduced = false;

  private ctx!: gsap.Context;
  private mm!: gsap.MatchMedia;
  private drag?: Draggable;
  private proxy!: HTMLElement;
  private autoplayCall?: gsap.core.Tween;
  private io?: IntersectionObserver;
  private ro?: ResizeObserver;
  private cleanups: Array<() => void> = [];
  private destroyed = false;
  private opts: CarouselOptions;

  constructor(element: HTMLElement | string, opts: CarouselOptions) {
    const el = typeof element === "string" ? document.querySelector<HTMLElement>(element) : element;
    if (!el) throw new Error("ContainerCarousel: element not found");
    this.el = el;
    this.opts = opts;
    this.items = opts.items;
    this.pos = opts.startIndex ?? Math.floor(opts.items.length / 2);
    // Pick the layout before mounting: the containers are built during mount
    // and the layout decides their quality, so starting on the desktop layout
    // would build a phone's five boxes at desktop plane counts.
    this.layout = LAYOUTS[ContainerCarousel.breakpoint()];
    this.mount();
  }

  private static breakpoint(): "desktop" | "tablet" | "mobile" {
    const w = typeof window === "undefined" ? 1440 : window.innerWidth;
    return w >= 1200 ? "desktop" : w >= 768 ? "tablet" : "mobile";
  }

  private mount() {
    this.el.classList.add("scx");
    this.el.innerHTML =
      `<div class="scx-track" data-track role="group" aria-roledescription="carousel" aria-label="Container fleet"></div>` +
      `<p class="sc-sr" role="status" aria-live="polite" data-live></p>`;
    this.track = this.el.querySelector("[data-track]")!;
    this.live = this.el.querySelector("[data-live]")!;

    this.items.forEach((item, i) => {
      const card = document.createElement("div");
      card.className = "scx-card";
      card.setAttribute("role", "group");
      card.setAttribute("aria-roledescription", "slide");
      card.setAttribute("aria-label", `${i + 1} of ${this.items.length}: ${item.label}`);
      const mount = document.createElement("div");
      mount.className = "scx-mount";
      card.appendChild(mount);
      this.track.appendChild(card);
      this.cards.push(card);
      this.hits.push([]);

      // Carousel members render at under half the width a hero does, so the
      // full-pitch corrugation would be spending planes nobody can resolve.
      const box = new ShippingContainer(mount, {
        ...item, effect: "carousel", orbit: -24, quality: item.quality ?? this.layout.quality,
      });
      box.carousel = this;
      if (item.side) box.setContent("side", item.side);
      if (item.interior) box.setContent("interior", item.interior);
      this.boxes.push(box);
      // Cached once. Querying for these on every frame of a move was costing
      // more than the geometry: each setAttribute on aria-hidden forces the
      // accessibility tree to be rebuilt, sixty times a second.
      box.whenReady(() => {
        this.hits[i] = [...card.querySelectorAll<HTMLButtonElement>(".sc-hit")];
        this.applyActive(true);
      });
    });

    this.ctx = gsap.context(() => {}, this.el);
    this.proxy = document.createElement("div");

    this.ro = new ResizeObserver(() => this.measure());
    this.ro.observe(this.el);

    this.io = new IntersectionObserver(
      ([e]) => (e.isIntersecting ? this.resumeAutoplay() : this.pauseAutoplay()),
      { threshold: 0.2 },
    );
    this.io.observe(this.el);

    this.measure();
    this.setupMedia();
    this.render(true);
  }

  private measure() {
    const w = this.el.clientWidth || 900;
    this.step = w * this.layout.spacing;
    // Card width is driven from the same layout object as the spacing, so the
    // two can never drift apart across a breakpoint change.
    this.el.style.setProperty("--scx-card", `${(this.layout.card * 100).toFixed(1)}%`);
    this.render(true);
  }

  private setupMedia() {
    this.mm = gsap.matchMedia(this.el);

    const bind = (key: keyof typeof LAYOUTS, query: string) =>
      this.mm.add(query, () => {
        this.layout = LAYOUTS[key];
        this.measure();
        this.setupDrag();
        return () => this.drag?.kill();
      });

    bind("desktop", "(min-width: 1200px)");
    bind("tablet", "(min-width: 768px) and (max-width: 1199px)");
    bind("mobile", "(max-width: 767px)");

    this.mm.add("(prefers-reduced-motion: reduce)", () => {
      this.reduced = true;
      this.pauseAutoplay();
      return () => {
        this.reduced = false;
        this.resumeAutoplay();
      };
    });

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") { e.preventDefault(); this.next(); }
      if (e.key === "ArrowLeft") { e.preventDefault(); this.prev(); }
      if (e.key === "Home") { e.preventDefault(); this.goTo(0); }
      if (e.key === "End") { e.preventDefault(); this.goTo(this.items.length - 1); }
    };
    const onEnter = () => this.pauseAutoplay();
    const onLeave = () => this.resumeAutoplay();
    this.el.addEventListener("keydown", onKey);
    this.el.addEventListener("pointerenter", onEnter);
    this.el.addEventListener("pointerleave", onLeave);
    this.cleanups.push(() => {
      this.el.removeEventListener("keydown", onKey);
      this.el.removeEventListener("pointerenter", onEnter);
      this.el.removeEventListener("pointerleave", onLeave);
    });
  }

  private setupDrag() {
    this.drag?.kill();
    const snapTo = (v: number) => {
      const max = 0;
      const min = -(this.items.length - 1) * this.step;
      return gsap.utils.clamp(min, max, Math.round(v / this.step) * this.step);
    };

    [this.drag] = Draggable.create(this.proxy, {
      type: "x",
      trigger: this.track,
      inertia: true,
      // Vertical page scrolling on touch must keep working; this is the option
      // that lets a mostly-vertical gesture through to the page.
      allowNativeTouchScrolling: true,
      dragResistance: 0.12,
      edgeResistance: 0.86,
      snap: { x: snapTo },
      bounds: { minX: -(this.items.length - 1) * this.step, maxX: 0 },
      onPressInit: () => {
        this.pauseAutoplay();
        gsap.set(this.proxy, { x: -this.pos * this.step });
      },
      onDrag: () => this.fromProxy(),
      onThrowUpdate: () => this.fromProxy(),
      onThrowComplete: () => { this.settle(); this.resumeAutoplay(); },
      onRelease: () => { if (!this.drag?.isThrowing) { this.settle(); this.resumeAutoplay(); } },
    });
  }

  private fromProxy() {
    this.pos = -gsap.getProperty(this.proxy, "x") as number / this.step;
    this.render();
  }

  private settle() {
    const i = gsap.utils.clamp(0, this.items.length - 1, Math.round(this.pos));
    this.goTo(i);
  }

  /**
   * One render pass reads the fractional index and places every card.
   *
   * Split in two on purpose: transform and opacity are compositable and run
   * every frame, while anything that touches the DOM's semantics or its
   * stacking order runs only when the active card actually changes.
   */
  private render(force = false) {
    const { recede, tilt, dim } = this.layout;
    for (let i = 0; i < this.cards.length; i++) {
      const o = i - this.pos;
      const a = Math.min(Math.abs(o), 3);
      gsap.set(this.cards[i], {
        x: o * this.step,
        z: -a * recede,
        rotationY: gsap.utils.clamp(-tilt, tilt, -o * tilt),
        opacity: Math.max(0.06, 1 - a * dim),
      });
    }
    this.applyActive(force);
    if (force) this.announce();
  }

  /** Semantics and stacking, written only when the active index moves. */
  private applyActive(force = false) {
    const active = gsap.utils.clamp(0, this.cards.length - 1, Math.round(this.pos));
    if (!force && active === this.announced) return;
    this.announced = active;
    for (let i = 0; i < this.cards.length; i++) {
      const card = this.cards[i];
      const a = Math.min(Math.abs(i - active), 3);
      const isActive = i === active;
      card.setAttribute("aria-hidden", isActive ? "false" : "true");
      // Cards more than three places away are not composited at all.
      card.style.visibility = a >= 3 ? "hidden" : "visible";
      card.style.zIndex = String(100 - a * 10);
      for (const b of this.hits[i]) b.tabIndex = isActive ? 0 : -1;
    }
  }

  private announce() {
    const i = gsap.utils.clamp(0, this.items.length - 1, Math.round(this.pos));
    const item = this.items[i];
    if (!item) return;
    this.live.textContent = `${item.label}, ${i + 1} of ${this.items.length}`;
    this.opts.onChange?.({ index: i, total: this.items.length, label: item.label });
  }

  private pauseAutoplay() {
    this.autoplayCall?.kill();
    this.autoplayCall = undefined;
  }

  private resumeAutoplay() {
    if (this.reduced || !this.opts.autoplay) return;
    this.pauseAutoplay();
    this.autoplayCall = gsap.delayedCall(this.opts.autoplay, () => {
      this.goTo((Math.round(this.pos) + 1) % this.items.length);
      this.resumeAutoplay();
    });
  }

  /* ---- Public API ------------------------------------------------- */

  get index() {
    return gsap.utils.clamp(0, this.items.length - 1, Math.round(this.pos));
  }

  get containers() {
    return this.boxes;
  }

  goTo(i: number): void {
    const target = gsap.utils.clamp(0, this.items.length - 1, i);
    gsap.killTweensOf(this);
    gsap.to(this, {
      pos: target,
      duration: this.reduced ? 0 : 0.85,
      // Weighted, never springy: the ring decelerates like something with mass.
      ease: "expo.out",
      onUpdate: () => this.render(),
      onComplete: () => {
        this.pos = target;
        gsap.set(this.proxy, { x: -target * this.step });
        this.render(true);
      },
    });
  }

  next(): void { this.goTo(this.index + 1); }
  prev(): void { this.goTo(this.index - 1); }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.pauseAutoplay();
    this.io?.disconnect();
    this.ro?.disconnect();
    this.cleanups.forEach((fn) => fn());
    this.cleanups = [];
    this.drag?.kill();
    this.mm?.revert();
    this.ctx?.revert();
    gsap.killTweensOf(this);
    this.boxes.forEach((b) => b.destroy());
    this.boxes = [];
    this.cards = [];
    this.hits = [];
    this.el.innerHTML = "";
    this.el.classList.remove("scx");
  }
}
