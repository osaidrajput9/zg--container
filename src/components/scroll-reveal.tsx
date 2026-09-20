"use client";

import { useRef } from "react";
import { gsap, useGSAP, Draggable } from "@/lib/gsap";

const PLUGINS = [
  { name: "ScrollTrigger", note: "Scroll-driven timelines, pinning, scrub." },
  { name: "SplitText", note: "Split into lines/words/chars, with autoSplit." },
  { name: "Flip", note: "Animate between two DOM states, layout included." },
  { name: "Draggable", note: "Drag, throw and snap with InertiaPlugin." },
  { name: "Observer", note: "Unified wheel / touch / pointer events." },
  { name: "InertiaPlugin", note: "Momentum-based throwing with natural easing." },
];

export function ScrollReveal() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      // Scrub the progress bar against this section's scroll position.
      gsap.to("[data-progress]", {
        scaleX: 1,
        ease: "none",
        scrollTrigger: {
          trigger: root.current,
          start: "top 80%",
          end: "bottom bottom",
          scrub: 0.4,
        },
      });

      // Reveal each card as it enters the viewport.
      gsap.utils.toArray<HTMLElement>("[data-card]").forEach((card) => {
        gsap.from(card, {
          y: 40,
          opacity: 0,
          duration: 0.6,
          ease: "power2.out",
          scrollTrigger: { trigger: card, start: "top 85%" },
        });
      });

      Draggable.create("[data-draggable]", {
        bounds: "[data-drag-bounds]",
        inertia: true,
        edgeResistance: 0.7,
      });
    },
    { scope: root },
  );

  return (
    <section ref={root} className="px-6 pb-32 sm:px-12">
      <div className="h-px w-full bg-foreground/10">
        <div
          data-progress
          className="h-px origin-left scale-x-0 bg-foreground"
        />
      </div>

      <h2 className="pt-16 text-sm font-mono uppercase tracking-[0.2em] text-foreground/50">
        Registered plugins
      </h2>

      <ul className="grid gap-4 pt-8 sm:grid-cols-2 lg:grid-cols-3">
        {PLUGINS.map((plugin) => (
          <li
            key={plugin.name}
            data-card
            className="rounded-xl border border-foreground/10 p-6"
          >
            <h3 className="font-mono text-sm">{plugin.name}</h3>
            <p className="pt-2 text-sm text-foreground/55">{plugin.note}</p>
          </li>
        ))}
      </ul>

      <div
        data-drag-bounds
        className="relative mt-16 h-40 rounded-xl border border-dashed border-foreground/15"
      >
        <div
          data-draggable
          className="absolute left-4 top-4 flex h-24 w-24 cursor-grab items-center justify-center rounded-lg bg-foreground text-center font-mono text-[10px] leading-tight text-background active:cursor-grabbing"
        >
          drag
          <br />
          me
        </div>
      </div>
    </section>
  );
}
