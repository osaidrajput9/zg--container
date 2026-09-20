"use client";

import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import { Draggable } from "gsap/Draggable";
import { InertiaPlugin } from "gsap/InertiaPlugin";
import { ScrollTrigger } from "gsap/ScrollTrigger";

// Register once, from a single module. Every component imports gsap from here
// so plugins are guaranteed to be registered before any tween is created.
// Safe during SSR: GSAP defers all DOM access until it sees a window.
//
// Only what is actually used. Registering the rest of the (now free) plugin
// set costs ~26 KB gzipped of dead weight; adding one back is two lines here.
gsap.registerPlugin(useGSAP, Draggable, InertiaPlugin, ScrollTrigger);

export { gsap, useGSAP, Draggable, InertiaPlugin, ScrollTrigger };
