"use client";

import { useRef, useState } from "react";
import { ContainerView } from "@/components/container-view";
import { PRESETS, type ShippingContainer } from "@/lib/container";

/**
 * Use case 1 — Homepage hero.
 *
 * Intro drop with a weighted settle, click/Enter to open the doors, pointer
 * tilt on desktop, and live recolouring from the preset swatches.
 */
export default function HeroPage() {
  const box = useRef<ShippingContainer | null>(null);
  const [open, setOpen] = useState(false);
  const [color, setColor] = useState<string>(PRESETS[0].value);

  const recolor = (value: string) => {
    setColor(value);
    box.current?.setColor(value, { zone: "body", duration: 0.7 });
  };

  return (
    <main className="flex-1">
      <section className="mx-auto max-w-[1400px] px-5 pb-20 pt-10 sm:px-8">
        <p className="eyebrow">Corrugated · 20 ft ISO dry · CSS 3D</p>
        <h1 className="mt-4 max-w-3xl text-4xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
          Freight that moves like freight.
        </h1>
        <p className="mt-4 max-w-xl text-base leading-relaxed text-muted">
          One container component. Real trapezoidal corrugation, hinged doors on their true
          pivot, and a colour system derived at runtime — every frame driven by GSAP.
        </p>

        <div className="mt-10">
          <ContainerView
            className="w-full"
            options={{
              size: "20ft",
              effect: "hero",
              weathering: true,
              colors: { body: PRESETS[0].value, doors: "#111C44", decals: "#F8F1E4" },
              onOpen: () => setOpen(true),
              onClose: () => setOpen(false),
            }}
            side='<h3>ZG Logistics</h3><p>Nationwide carriage &amp; bonded storage</p>'
            interior='<h3>Dry cargo, 33.2 m³</h3><p>Plywood floor, lashing rings on all four rails, CSC plated to 30,480 kg gross.</p>'
            onReady={(b) => { box.current = b; }}
          />
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="btn"
              aria-pressed={open}
              onClick={() => box.current?.toggleDoors()}
            >
              {open ? "Close doors" : "Open doors"}
            </button>
            <span className="text-xs text-muted">or click the container</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="eyebrow">Paint</span>
            {PRESETS.map((p) => (
              <button
                key={p.value}
                type="button"
                className="swatch"
                style={{ background: p.value }}
                aria-label={p.name}
                aria-pressed={color === p.value}
                onClick={() => recolor(p.value)}
              />
            ))}
          </div>
        </div>

        <dl className="mt-14 grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-4">
          {[
            ["Length", "6.058 m"],
            ["Width", "2.438 m"],
            ["Height", "2.591 m"],
            ["Corrugation", "280 mm pitch"],
          ].map(([k, v]) => (
            <div key={k} className="bg-panel px-5 py-4">
              <dt className="eyebrow">{k}</dt>
              <dd className="mt-1 font-mono text-sm">{v}</dd>
            </div>
          ))}
        </dl>
      </section>
    </main>
  );
}
