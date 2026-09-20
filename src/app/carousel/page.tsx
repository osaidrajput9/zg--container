"use client";

import { useRef, useState } from "react";
import { useGSAP } from "@/lib/gsap";
import { ContainerCarousel, type CarouselItem } from "@/lib/container";

/**
 * Use case 2 — Services page carousel.
 *
 * Five containers in a 3D ring: drag with momentum, arrow keys, buttons and
 * autoplay all write to one fractional index. Each carries its own colour and
 * its own HTML content.
 */
const FLEET: CarouselItem[] = [
  { label: "General freight", size: "20ft", colors: { body: "#2457FF", doors: "#111C44" },
    side: "<h3>General freight</h3><p>Palletised, groupage, full loads</p>",
    interior: "<h3>33.2 m&sup3;</h3><p>Standard dry van, plywood floor.</p>" },
  { label: "Bonded storage", size: "20ft", colors: { body: "#8E2B1E", doors: "#2A1410" },
    side: "<h3>Bonded storage</h3><p>HMRC approved premises</p>",
    interior: "<h3>Duty suspended</h3><p>Sealed and CCTV monitored.</p>" },
  { label: "Long haul", size: "40ft", colors: { body: "#2E6B3F", doors: "#15301F" },
    side: "<h3>Long haul</h3><p>40 ft, continental</p>",
    interior: "<h3>67.7 m&sup3;</h3><p>Double the cube, same handling.</p>" },
  { label: "Site units", size: "20ft", colors: { body: "#F8F1E4", doors: "#7A7F85", decals: "#111C44" },
    side: "<h3>Site units</h3><p>Secure on-site storage</p>",
    interior: "<h3>Lock box fitted</h3><p>Anti-tamper hardware as standard.</p>" },
  { label: "Cold chain", size: "20ft", colors: { body: "#D8E3FF", doors: "#111C44", decals: "#111C44" },
    side: "<h3>Cold chain</h3><p>Temperature controlled</p>",
    interior: "<h3>-25 to +25 &deg;C</h3><p>Continuous logging, two-hour alarm.</p>" },
];

export default function CarouselPage() {
  const host = useRef<HTMLDivElement>(null);
  const api = useRef<ContainerCarousel | null>(null);
  const [active, setActive] = useState({ index: 2, label: FLEET[2].label });

  useGSAP(() => {
    if (!host.current) return;
    const c = new ContainerCarousel(host.current, {
      items: FLEET,
      autoplay: 5,
      startIndex: 2,
      onChange: ({ index, label }) => setActive({ index, label }),
    });
    api.current = c;
    return () => { c.destroy(); api.current = null; };
  }, { scope: host, dependencies: [] });

  return (
    <main className="flex-1">
      <section className="mx-auto max-w-[1400px] px-5 pb-24 pt-10 sm:px-8">
        <p className="eyebrow">Use case 2 &middot; Services page</p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-5xl">The fleet</h1>
        <p className="mt-3 max-w-lg text-sm leading-relaxed text-muted">
          Drag, swipe, use the arrow keys or just wait. Each container holds its own colour
          and its own content.
        </p>

        <div ref={host} className="mt-8 scx-host" />

        <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <button type="button" className="btn" onClick={() => api.current?.prev()} aria-label="Previous container">&larr;</button>
            <button type="button" className="btn" onClick={() => api.current?.next()} aria-label="Next container">&rarr;</button>
          </div>

          <ol className="flex flex-wrap items-center gap-1.5">
            {FLEET.map((f, i) => (
              <li key={f.label}>
                <button
                  type="button"
                  className="btn !px-3 !py-1 !text-[0.7rem]"
                  aria-pressed={active.index === i}
                  onClick={() => api.current?.goTo(i)}
                >
                  {f.label}
                </button>
              </li>
            ))}
          </ol>
        </div>

        <p className="mt-6 font-mono text-xs text-muted">
          Active: <span className="text-foreground">{active.label}</span> &middot; {active.index + 1} of {FLEET.length}
        </p>
      </section>
    </main>
  );
}
