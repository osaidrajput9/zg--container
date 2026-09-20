"use client";

import { useRef } from "react";
import { useGSAP } from "@/lib/gsap";
import { ContainerView } from "@/components/container-view";
import { attachScrollStory, type ShippingContainer } from "@/lib/container";

/**
 * Use case 3 — Pinned scroll story.
 *
 * The section pins, the camera orbits 180 degrees, the doors open across the
 * middle third and the interior copy is revealed. Fully scrubbed: scrolling
 * back up runs the whole thing in reverse.
 */
const BEATS = [
  { h: "Collected", p: "Curtain-sided to your door, or tipped straight from the quay." },
  { h: "Sealed", p: "Bolt seal, photographed, logged against the booking reference." },
  { h: "Tracked", p: "Position and door state on the portal, refreshed every four minutes." },
  { h: "Delivered", p: "Doors opened against a signature, not a scanner beep." },
];

export default function ScrollPage() {
  const section = useRef<HTMLElement>(null);
  const captions = useRef<HTMLDivElement[]>([]);
  const box = useRef<ShippingContainer | null>(null);
  const detach = useRef<(() => void) | null>(null);

  const attach = (b: ShippingContainer | null) => {
    box.current = b;
    detach.current?.();
    detach.current = null;
    // Wait for the skin: ScrollTrigger must measure a laid-out page, not the
    // zero-height poster that stands in before the geometry is built.
    b?.whenReady((box) => {
      if (!section.current) return;
      detach.current = attachScrollStory(box, section.current, {
        length: 3.2,
        orbit: 180,
        startOrbit: -18,
        captions: captions.current.filter(Boolean),
      });
    });
  };

  useGSAP(() => () => { detach.current?.(); detach.current = null; }, { dependencies: [] });

  return (
    <main className="flex-1">
      <section className="mx-auto max-w-[1400px] px-5 pt-10 sm:px-8">
        <p className="eyebrow">Use case 3 · Scroll story</p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-5xl">
          Every box, end to end.
        </h1>
        <p className="mt-3 max-w-lg text-sm text-muted">Scroll to walk the load through.</p>
        <p className="mt-10 font-mono text-xs text-muted">Scroll ↓</p>
      </section>

      <section ref={section} className="scs mt-10">
        <div className="w-full max-w-[1200px] px-5 sm:px-8">
          <ContainerView
            className="w-full"
            options={{
              size: "20ft",
              effect: "scroll",
              weathering: true,
              colors: { body: "#2457FF", doors: "#111C44", decals: "#F8F1E4" },
            }}
            side='<h3>ZG Logistics</h3><p>Tracked, sealed, accountable</p>'
            interior='<h3>Sealed at origin</h3><p>Bolt seal 0042118, photographed and logged.</p>'
            onReady={attach}
          />
        </div>

        {BEATS.map((b, i) => (
          <div
            key={b.h}
            ref={(n) => { if (n) captions.current[i] = n; }}
            className="scs-caption"
          >
            <p className="eyebrow">Step {i + 1}</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">{b.h}</h2>
            <p className="mt-2 text-sm text-muted">{b.p}</p>
          </div>
        ))}
      </section>

      <section className="mx-auto max-w-[1400px] px-5 py-28 sm:px-8">
        <h2 className="text-2xl font-semibold tracking-tight">Scrubbed, not triggered</h2>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted">
          The doors are driven by tweening the container&apos;s own door timeline&apos;s progress,
          so the scrubbed open and the clicked open are the same choreography. Scroll back up
          and the locking bars re-seat after the leaves close, in the right order.
        </p>
      </section>
    </main>
  );
}
