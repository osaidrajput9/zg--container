"use client";

import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import { Draggable } from "gsap/Draggable";
import { Flip } from "gsap/Flip";
import { InertiaPlugin } from "gsap/InertiaPlugin";
import { Observer } from "gsap/Observer";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";

// Register once, from a single module. Every component imports gsap from here
// so plugins are guaranteed to be registered before any tween is created.
// Safe during SSR: GSAP defers all DOM access until it sees a window.
gsap.registerPlugin(
  useGSAP,
  Draggable,
  Flip,
  InertiaPlugin,
  Observer,
  ScrollTrigger,
  SplitText,
);

export {
  gsap,
  useGSAP,
  Draggable,
  Flip,
  InertiaPlugin,
  Observer,
  ScrollTrigger,
  SplitText,
};
