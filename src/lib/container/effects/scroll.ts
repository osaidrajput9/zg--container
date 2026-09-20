/**
 * Scroll story — the section pins, the camera orbits the container through
 * 180 degrees, the doors open around the midpoint and the interior content is
 * revealed. Everything is scrubbed, so scrolling back up plays it backwards
 * exactly, frame for frame.
 *
 * The doors are driven by tweening the container's own door timeline's
 * `progress`, not by a second copy of the choreography. One timeline stays the
 * single source of truth, so a scrubbed open and a clicked open cannot drift
 * apart, and the bar-then-leaf ordering is preserved at every scrub position.
 */

import { gsap, ScrollTrigger } from "@/lib/gsap";
import type { ShippingContainer } from "../ShippingContainer";

export interface ScrollStoryOptions {
  /** Scroll distance the pinned story occupies, in viewport heights. */
  length?: number;
  /** Degrees of orbit travelled across the story. */
  orbit?: number;
  startOrbit?: number;
  /** Elements revealed in sequence; each gets an equal slice of the story. */
  captions?: HTMLElement[];
  scrub?: number;
}

export function attachScrollStory(
  box: ShippingContainer,
  section: HTMLElement,
  options: ScrollStoryOptions = {},
): () => void {
  const length = options.length ?? 3;
  const sweep = options.orbit ?? 180;
  const startOrbit = options.startOrbit ?? -20;
  const captions = options.captions ?? [];
  const doorTl = box.doorTimeline;

  const state = { orbit: startOrbit };
  const reduced = box.isReduced;

  // Reduced motion: no camera orbit at all. The section still tells the story,
  // it just does it with plain fades and no pinning.
  if (reduced) {
    const tweens = captions.map((c) =>
      gsap.fromTo(c, { opacity: 0 }, {
        opacity: 1, duration: 0.3,
        scrollTrigger: { trigger: c, start: "top 82%", toggleActions: "play none none reverse" },
      }),
    );
    return () => tweens.forEach((t) => { t.scrollTrigger?.kill(); t.kill(); });
  }

  const tl = gsap.timeline({ defaults: { ease: "none" } });

  // Camera orbit across the whole story.
  tl.to(state, {
    orbit: startOrbit + sweep,
    duration: 1,
    onUpdate: () => box.setOrbit(state.orbit),
  }, 0);

  // Doors open across the middle third, so the reveal lands as the far side
  // comes round rather than while the box is still edge-on.
  if (doorTl) {
    doorTl.pause(0);
    tl.to(doorTl, { progress: 1, duration: 0.34 }, 0.33);
  }

  // Captions cross-fade, one per equal slice.
  captions.forEach((c, i) => {
    const slot = i / captions.length;
    const span = 1 / captions.length;
    tl.fromTo(c, { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: span * 0.32 }, slot + span * 0.06);
    if (i < captions.length - 1) {
      tl.to(c, { opacity: 0, y: -18, duration: span * 0.28 }, slot + span * 0.72);
    }
  });

  const trigger = ScrollTrigger.create({
    trigger: section,
    start: "top top",
    end: () => `+=${window.innerHeight * length}`,
    pin: true,
    pinSpacing: true,
    scrub: options.scrub ?? 0.55,
    animation: tl,
    invalidateOnRefresh: true,
    anticipatePin: 1,
  });

  return () => {
    trigger.kill();
    tl.kill();
    gsap.killTweensOf(state);
    if (doorTl) gsap.killTweensOf(doorTl);
  };
}
