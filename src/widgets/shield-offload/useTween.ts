import { useEffect, useRef, useState } from "react";
import { useRaf } from "@/lib/hooks";

/** Eases every number in `target` toward its new value. Snaps instantly when `reduced` is true. */
export function useTween<T extends Record<string, number>>(target: T, reduced: boolean, rate = 9): T {
  const [cur, setCur] = useState<T>(target);
  const curRef = useRef<T>(target);
  const targetRef = useRef<T>(target);
  targetRef.current = target;
  const [running, setRunning] = useState(false);
  const key = Object.keys(target).map((k) => target[k]).join("|");

  useEffect(() => {
    if (reduced) { curRef.current = targetRef.current; setCur(targetRef.current); setRunning(false); }
    else setRunning(true);
  }, [key, reduced]);

  useRaf((dt) => {
    const t = targetRef.current;
    const k = 1 - Math.exp(-dt * rate);
    const next = { ...curRef.current } as Record<string, number>;
    let settled = true;
    for (const name of Object.keys(t)) {
      const goal = t[name];
      const from = next[name] ?? goal;
      const v = from + (goal - from) * k;
      if (Math.abs(goal - v) <= Math.max(1e-4, Math.abs(goal) * 1e-3)) next[name] = goal;
      else { next[name] = v; settled = false; }
    }
    curRef.current = next as T;
    setCur(next as T);
    if (settled) setRunning(false);
  }, running);

  return cur;
}
