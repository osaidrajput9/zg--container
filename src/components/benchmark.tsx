"use client";

import { useRef, useState } from "react";
import type { ShippingContainer } from "@/lib/container";

interface Result {
  medianFps: number;
  p95Ms: number;
  worstMs: number;
  overBudget: number;
  frames: number;
  device: string;
  renderer: string;
  dpr: number;
  planes: number;
}

/** What the browser is actually rasterising with. A software renderer here
 *  means the numbers say nothing about real-device performance. */
function rendererName(): string {
  try {
    const gl = document.createElement("canvas").getContext("webgl");
    if (!gl) return "no WebGL";
    const dbg = gl.getExtension("WEBGL_debug_renderer_info");
    const raw = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : String(gl.getParameter(gl.RENDERER));
    return /swiftshader|llvmpipe|software/i.test(raw) ? `${raw}  ⚠ software` : raw;
  } catch {
    return "unavailable";
  }
}

/**
 * Frame-timing harness.
 *
 * Runs the hardest thing the component does — a continuous orbit, which moves
 * every plane and re-derives the shading — and reports the distribution rather
 * than an average, because a 60 fps mean with three 90 ms stalls is not 60 fps.
 */
export function Benchmark({ target }: { target: () => ShippingContainer | null }) {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const raf = useRef(0);

  const run = () => {
    const box = target();
    if (!box || running) return;
    setRunning(true);
    setResult(null);

    const stamps: number[] = [];
    let angle = -180;
    const started = performance.now();

    const tick = (t: number) => {
      stamps.push(t);
      angle += 2.2;
      box.setOrbit(angle > 180 ? angle - 360 : angle);
      if (t - started < 4000) raf.current = requestAnimationFrame(tick);
      else finish();
    };

    const finish = () => {
      cancelAnimationFrame(raf.current);
      const d: number[] = [];
      for (let i = 1; i < stamps.length; i++) d.push(stamps[i] - stamps[i - 1]);
      d.sort((a, b) => a - b);
      const at = (p: number) => d[Math.min(d.length - 1, Math.floor(d.length * p))] ?? 0;
      setResult({
        medianFps: Math.round(1000 / (at(0.5) || 16.7)),
        p95Ms: +at(0.95).toFixed(1),
        worstMs: +(d[d.length - 1] ?? 0).toFixed(1),
        overBudget: d.length ? Math.round((d.filter((x) => x > 16.7).length / d.length) * 100) : 0,
        frames: d.length,
        device: navigator.userAgent.includes("Mobile") ? "mobile" : "desktop",
        renderer: rendererName(),
        dpr: +window.devicePixelRatio.toFixed(2),
        planes: box.stats.planes,
      });
      box.setOrbit(-38);
      setRunning(false);
    };

    raf.current = requestAnimationFrame(tick);
  };

  const copy = () => {
    if (result) void navigator.clipboard?.writeText(JSON.stringify(result, null, 2));
  };

  const verdict = result
    ? result.medianFps >= 58 && result.worstMs <= 20
      ? { text: "Meets the brief: 60 fps, nothing over 20 ms", tone: "#3ddc84" }
      : result.medianFps >= 50
        ? { text: "Above 50 fps but with stalls — check worst frame", tone: "#e8c547" }
        : { text: "Below the brief's floor on this device", tone: "#ff6b5e" }
    : null;

  return (
    <div className="border-t border-line pt-4">
      <p className="eyebrow">Frame timing</p>
      <p className="mt-1 text-[0.68rem] leading-relaxed text-muted">
        Sweeps a full 360° for four seconds — the heaviest thing the component does —
        and reports the distribution, not an average.
      </p>
      <div className="mt-2 flex gap-1.5">
        <button type="button" className="btn !px-3 !py-1 !text-[0.7rem]" onClick={run} disabled={running}>
          {running ? "Measuring…" : "Run benchmark"}
        </button>
        {result && (
          <button type="button" className="btn !px-3 !py-1 !text-[0.7rem]" onClick={copy}>
            Copy JSON
          </button>
        )}
      </div>

      {result && (
        <>
          <dl className="mt-3 space-y-1 font-mono text-[0.68rem] text-muted">
            <div className="flex justify-between"><dt>median</dt><dd data-bm-fps className="text-foreground">{result.medianFps} fps</dd></div>
            <div className="flex justify-between"><dt>p95 frame</dt><dd>{result.p95Ms} ms</dd></div>
            <div className="flex justify-between"><dt>worst frame</dt><dd>{result.worstMs} ms</dd></div>
            <div className="flex justify-between"><dt>over 16.7 ms</dt><dd>{result.overBudget}%</dd></div>
            <div className="flex justify-between"><dt>planes / dpr</dt><dd>{result.planes} / {result.dpr}</dd></div>
          </dl>
          <p className="mt-2 break-words font-mono text-[0.6rem] leading-relaxed text-muted">{result.renderer}</p>
          {verdict && (
            <p className="mt-2 text-[0.68rem] font-medium" style={{ color: verdict.tone }}>
              {verdict.text}
            </p>
          )}
        </>
      )}
    </div>
  );
}

