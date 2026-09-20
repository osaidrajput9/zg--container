"use client";

import { useCallback, useRef, useState } from "react";
import { ContainerView } from "@/components/container-view";
import { gsap, ScrollTrigger } from "@/lib/gsap";
import { Benchmark } from "@/components/benchmark";
import { PRESETS, type ColorZone, type ContainerSize, type ShippingContainer } from "@/lib/container";

/**
 * Demo lab — every control the brief asks to be able to test live:
 * colour picker and presets per zone, size, weathering, doors, and a full
 * 360 orbit so the model can be checked from every angle.
 */
const ZONES: ColorZone[] = ["body", "doors", "decals", "interior"];

export default function LabPage() {
  const box = useRef<ShippingContainer | null>(null);
  const [size, setSize] = useState<ContainerSize>("20ft");
  const [zone, setZone] = useState<ColorZone>("body");
  const [hex, setHex] = useState("#2457FF");
  const [weathering, setWeathering] = useState(true);
  const [orbit, setOrbit] = useState(-38);
  const [open, setOpen] = useState(false);
  const [stats, setStats] = useState<{ planes: number; quality: string } | null>(null);
  const [mountKey, setMountKey] = useState(0);
  const [cycles, setCycles] = useState(0);
  const [live, setLive] = useState({ tweens: 0, triggers: 0, nodes: 0 });

  const ready = useCallback((b: ShippingContainer | null) => {
    box.current = b;
    if (b) setTimeout(() => setStats(b.stats), 400);
  }, []);

  const apply = (value: string) => {
    setHex(value);
    box.current?.setColor(value, { zone, duration: 0.7 });
  };

  // What destroy() is supposed to leave behind: nothing. Counting the global
  // timeline's children and the live ScrollTriggers is the only honest way to
  // show that, so the readout is part of the lab rather than a claim in a README.
  const sample = () =>
    setLive({
      tweens: gsap.globalTimeline.getChildren(true, true, true).length,
      triggers: ScrollTrigger.getAll().length,
      nodes: document.querySelectorAll(".sc-p").length,
    });

  // Mount/unmount stress: the brief's "no memory leaks after 20 cycles".
  const stress = async () => {
    for (let i = 0; i < 20; i++) {
      setMountKey((k) => k + 1);
      setCycles((c) => c + 1);
      await new Promise((r) => setTimeout(r, 160));
    }
    await new Promise((r) => setTimeout(r, 1200));
    sample();
  };

  return (
    <main className="flex-1">
      <section className="mx-auto max-w-[1400px] px-5 pb-24 pt-10 sm:px-8">
        <p className="eyebrow">Demo lab</p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-5xl">Every control</h1>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="panel overflow-hidden p-4">
            <ContainerView
              key={`${size}-${mountKey}`}
              className="w-full"
              options={{
                size,
                effect: "hero",
                weathering,
                orbit,
                colors: { body: "#2457FF", doors: "#111C44", decals: "#F8F1E4", interior: "#D8E3FF" },
                onOpen: () => setOpen(true),
                onClose: () => setOpen(false),
              }}
              side='<h3>ZG Logistics</h3><p>Swappable decal panel</p>'
              interior='<h3>Interior slot</h3><p>Real HTML, readable by screen readers.</p>'
              onReady={ready}
            />
          </div>

          <div className="panel flex flex-col gap-5 p-5">
            <div>
              <p className="eyebrow">Zone</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {ZONES.map((z) => (
                  <button key={z} type="button" className="btn !px-3 !py-1 !text-[0.7rem]"
                    aria-pressed={zone === z} onClick={() => setZone(z)}>{z}</button>
                ))}
              </div>
            </div>

            <div>
              <p className="eyebrow">Colour</p>
              <div className="mt-2 flex items-center gap-2">
                <input type="color" value={hex} aria-label="Colour picker"
                  onChange={(e) => apply(e.target.value)}
                  className="h-9 w-12 cursor-pointer rounded border border-line bg-transparent" />
                <input type="text" value={hex} aria-label="Colour value"
                  onChange={(e) => setHex(e.target.value)}
                  onBlur={(e) => { try { apply(e.target.value); } catch { setHex(hex); } }}
                  className="w-full rounded border border-line bg-transparent px-2 py-1.5 font-mono text-xs" />
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {PRESETS.map((p) => (
                  <button key={p.value} type="button" className="swatch" style={{ background: p.value }}
                    aria-label={p.name} onClick={() => apply(p.value)} />
                ))}
              </div>
              <p className="mt-2 text-[0.68rem] leading-relaxed text-muted">
                Accepts hex, <code>rgb()</code> and <code>hsl()</code>. Decals keep their own
                colour when the paint changes.
              </p>
            </div>

            <div>
              <p className="eyebrow">Orbit — {orbit}&deg;</p>
              <input type="range" min={-180} max={180} value={orbit} aria-label="Orbit angle"
                onChange={(e) => { const v = Number(e.target.value); setOrbit(v); box.current?.setOrbit(v); }}
                className="mt-2 w-full accent-[var(--accent)]" />
            </div>

            <div className="flex flex-wrap gap-1.5">
              <button type="button" className="btn !px-3 !py-1 !text-[0.7rem]"
                aria-pressed={size === "20ft"} onClick={() => setSize("20ft")}>20 ft</button>
              <button type="button" className="btn !px-3 !py-1 !text-[0.7rem]"
                aria-pressed={size === "40ft"} onClick={() => setSize("40ft")}>40 ft</button>
              <button type="button" className="btn !px-3 !py-1 !text-[0.7rem]" aria-pressed={weathering}
                onClick={() => { setWeathering((w) => !w); box.current?.setWeathering(!weathering); }}>
                Weathering
              </button>
              <button type="button" className="btn !px-3 !py-1 !text-[0.7rem]" aria-pressed={open}
                onClick={() => box.current?.toggleDoors()}>Doors</button>
            </div>

            <Benchmark target={() => box.current} />

            <div className="border-t border-line pt-4">
              <p className="eyebrow">Teardown test</p>
              <div className="mt-2 flex gap-1.5">
                <button type="button" className="btn !px-3 !py-1 !text-[0.7rem]" onClick={stress}>
                  Mount / unmount &times;20
                </button>
                <button type="button" className="btn !px-3 !py-1 !text-[0.7rem]" onClick={sample}>
                  Sample
                </button>
              </div>
              <dl className="mt-3 space-y-1 font-mono text-[0.68rem] text-muted">
                <div className="flex justify-between"><dt>planes</dt><dd>{stats?.planes ?? "—"}</dd></div>
                <div className="flex justify-between"><dt>quality</dt><dd>{stats?.quality ?? "—"}</dd></div>
                <div className="flex justify-between"><dt>cycles</dt><dd>{cycles}</dd></div>
                <div className="flex justify-between"><dt>live tweens</dt><dd data-live-tweens>{live.tweens}</dd></div>
                <div className="flex justify-between"><dt>scrolltriggers</dt><dd data-live-triggers>{live.triggers}</dd></div>
                <div className="flex justify-between"><dt>planes in DOM</dt><dd data-live-nodes>{live.nodes}</dd></div>
              </dl>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
