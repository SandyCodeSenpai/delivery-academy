# Delivery Academy

An interactive, Brilliant-style course on **CDN and media delivery infrastructure**, from zero to staff level. Crunchyroll is the running example throughout: simulcast spikes, multi-CDN delivery, and origins on AWS and GCP.

**Live site:** https://sandycodesenpai.github.io/delivery-academy/

## What is inside

- **20 chapters, 154 lessons, about 2,900 steps.** One idea per step: read, predict, check. Step types are quizzes, number estimates, ordering, matching, think-then-reveal and summaries.
- **17 simulations.** The flagship is the **Delivery Playground**, a working multi-CDN, multi-origin delivery system. You can press play, warm or purge caches, take down a CDN or an origin region, and push 2 million viewers through it.
- Diagrams that build up step by step, a glossary with tap-to-define terms, XP, a daily streak and a lesson path.

The course is adapted from the handbook *CDN & Media Delivery: From Zero to Staff*. Crunchyroll facts come from public sources. Anything not published is labelled as assumed.

## Run locally

```bash
bun install
bun run dev        # http://127.0.0.1:5180
bun run validate   # content checks
bun run build      # static site in dist/
```

The stack is Vite, React 18, TypeScript and framer-motion. Course content lives in `src/content/chNN.ts`, simulations in `src/widgets/<id>/`, the lesson player in `src/player/` and diagrams in `src/diagram/`. `CONTRIBUTING.md` and `design/DESIGN.md` describe the rules and the design system.

Progress is stored in your browser's localStorage only.
