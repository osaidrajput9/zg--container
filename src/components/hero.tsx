"use client";

import { useRef } from "react";
import { gsap, useGSAP, SplitText } from "@/lib/gsap";

export function Hero() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      // SplitText 3.13+ API: autoSplit re-splits on font load / resize, and
      // onSplit re-runs the animation against the fresh chars.
      const split = SplitText.create("[data-split]", {
        type: "words,chars",
        mask: "words",
        autoSplit: true,
        onSplit: (self) =>
          gsap.from(self.chars, {
            yPercent: 120,
            opacity: 0,
            duration: 0.8,
            ease: "power3.out",
            stagger: 0.015,
          }),
      });

      gsap.from("[data-hero-fade]", {
        y: 24,
        opacity: 0,
        duration: 0.7,
        ease: "power2.out",
        stagger: 0.12,
        delay: 0.35,
      });

      return () => split.revert();
    },
    { scope: root },
  );

  return (
    <section
      ref={root}
      className="flex min-h-svh flex-col justify-center gap-6 px-6 py-24 sm:px-12"
    >
      <p
        data-hero-fade
        className="font-mono text-xs uppercase tracking-[0.2em] text-foreground/50"
      >
        Next.js {" · "} Tailwind {" · "} GSAP
      </p>

      <h1
        data-split
        className="max-w-4xl text-5xl font-semibold leading-[1.05] tracking-tight sm:text-7xl"
      >
        Motion that ships.
      </h1>

      <p data-hero-fade className="max-w-xl text-lg text-foreground/60">
        Every GSAP plugin is bundled and registered — ScrollTrigger, SplitText,
        Flip, Draggable, Observer — free under the standard license.
      </p>

      <div data-hero-fade className="flex flex-wrap gap-3 pt-2">
        <a
          href="https://gsap.com/docs/v3/"
          target="_blank"
          rel="noreferrer"
          className="rounded-full bg-foreground px-6 py-3 text-sm font-medium text-background transition-opacity hover:opacity-85"
        >
          GSAP docs
        </a>
        <a
          href="https://gsap.com/resources/React"
          target="_blank"
          rel="noreferrer"
          className="rounded-full border border-foreground/15 px-6 py-3 text-sm font-medium transition-colors hover:border-foreground/40"
        >
          useGSAP() guide
        </a>
      </div>

      <p
        data-hero-fade
        className="pt-10 font-mono text-xs text-foreground/40"
      >
        Scroll ↓
      </p>
    </section>
  );
}
