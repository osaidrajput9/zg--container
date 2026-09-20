"use client";

import { useRef } from "react";
import { useGSAP } from "@/lib/gsap";
import { ShippingContainer } from "@/lib/container";
import type { ContainerOptions } from "@/lib/container";

export interface ContainerViewProps {
  options?: ContainerOptions;
  side?: string;
  interior?: string;
  className?: string;
  /** Receives the instance once it is mounted, and again as null on teardown. */
  onReady?: (box: ShippingContainer | null) => void;
}

/**
 * React wrapper.
 *
 * useGSAP owns the lifecycle: the instance is created inside the hook's
 * context and destroyed by the cleanup it returns, so a Strict Mode double
 * mount tears the first instance down completely before the second is built.
 *
 * The empty dependency list is deliberate. Props are mount-time configuration
 * and the callback closes over the values it was given, so a parent re-render
 * never rebuilds the ~700 plane skin; changing the container after mount is
 * done imperatively through the instance handed to `onReady`.
 */
export function ContainerView({ options, side, interior, className, onReady }: ContainerViewProps) {
  const host = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const el = host.current;
      if (!el) return;

      const box = new ShippingContainer(el, options ?? {});
      if (side) box.setContent("side", side);
      if (interior) box.setContent("interior", interior);
      onReady?.(box);

      return () => {
        onReady?.(null);
        box.destroy();
      };
    },
    { scope: host, dependencies: [] },
  );

  return <div ref={host} className={className} />;
}
