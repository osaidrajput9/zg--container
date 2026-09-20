# zg--container

Next.js 16 (App Router) + Tailwind CSS v4 + GSAP 3, with `@gsap/react`.

## Stack

| Package        | Version |
| -------------- | ------- |
| next           | 16.3.5  |
| react          | 19.2.8  |
| tailwindcss    | 4.x     |
| gsap           | 3.15.0  |
| @gsap/react    | 2.1.2   |

## Getting started

```bash
npm install
npm run dev     # http://localhost:3000
npm run build   # production build
npm run lint
```

## GSAP setup

All plugins are registered once in `src/lib/gsap.ts`. Import GSAP from there
rather than from `gsap` directly, so registration always happens first:

```tsx
"use client";

import { gsap, useGSAP, ScrollTrigger } from "@/lib/gsap";
```

Currently registered: `Draggable`, `Flip`, `InertiaPlugin`, `Observer`,
`ScrollTrigger`, `SplitText`. To add another, import it from `gsap/<PluginName>`
in that file and add it to the `registerPlugin` call — every plugin ships in the
public `gsap` package under the standard "no charge" license, so there is no
private registry or auth token to configure.

### Writing animations

Use `useGSAP()` in a client component. It scopes selector text to a container
ref and reverts every tween, ScrollTrigger and listener on unmount — which also
makes it safe under React Strict Mode's double-invoked effects.

```tsx
const root = useRef<HTMLDivElement>(null);

useGSAP(
  () => {
    gsap.from("[data-card]", { y: 40, opacity: 0, stagger: 0.1 });
  },
  { scope: root },
);
```

Return a cleanup function from the callback for anything GSAP does not own, such
as reverting a `SplitText` instance.

## Layout

```
src/
  app/          route segments, layout and global styles
  components/   client components (hero, scroll-reveal)
  lib/gsap.ts   single plugin registration point
```

## GSAP MCP server

`.mcp.json` registers [`@vinhnguyen/gsap-mcp`](https://github.com/glorynguyen/gsap-mcp)
as a project-scoped MCP server, so any agent working in this repo can query the
GSAP API instead of recalling it. It exposes six tools:

| Tool | Purpose |
| --- | --- |
| `understand_and_create_animation` | Turn a plain-English brief into GSAP code |
| `get_gsap_api_expert` | Look up a method, plugin or property in depth |
| `generate_complete_setup` | Emit plugin registration and framework boilerplate |
| `debug_animation_issue` | Diagnose a misbehaving animation |
| `optimize_for_performance` | Rework an animation toward 60fps |
| `create_production_pattern` | Produce a vetted pattern (hero, reveal, parallax…) |

It is a community package, not an official GreenSock release. It runs over stdio
and serves static reference data only — no network, filesystem or shell access.
The version is pinned so a new release cannot change what runs without a
deliberate bump here.

MCP servers are loaded when a session starts, so restart Claude Code after
pulling this file. On first connect you will be asked to approve the server.
