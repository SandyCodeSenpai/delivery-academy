import { useEffect, useRef, useState, type RefObject } from "react";

/** Calls cb(dtSeconds) every animation frame while `running`. dt is capped at 0.05 s. */
export function useRaf(cb: (dt: number) => void, running = true) {
  const ref = useRef(cb); ref.current = cb;
  useEffect(() => {
    if (!running) return;
    let id = 0, last = performance.now();
    const tick = (t: number) => { const dt = Math.max(0, Math.min(0.05, (t - last) / 1000)); last = t; ref.current(dt); id = requestAnimationFrame(tick); };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [running]);
}

/** Width of an element, updated on resize. Use it to switch widget layouts (wide vs narrow). */
export function useWidth<T extends HTMLElement>(ref: RefObject<T>): number {
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    setW(el.clientWidth);
    const ro = new ResizeObserver(() => setW(el.clientWidth)); ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return w;
}

export function useReducedMotion(): boolean {
  const [r, setR] = useState(() => typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches);
  useEffect(() => { const m = matchMedia("(prefers-reduced-motion: reduce)"); const f = () => setR(m.matches); m.addEventListener("change", f); return () => m.removeEventListener("change", f); }, []);
  return r;
}

/** Simple seeded RNG so simulations are repeatable. */
export function rng(seed = 42) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
