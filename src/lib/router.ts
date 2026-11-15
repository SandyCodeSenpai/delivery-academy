import { useEffect, useState } from "react";
/** Plain-hash router. Route names are ASCII letters, digits and hyphens only (no "#/path"):
 *  home | course | chN | chN-L | labs | lab-<widgetId> | glossary | w-<widgetId>[@width][!full] | diagrams */
export function useHash(): string {
  const [h, setH] = useState(() => decodeURIComponent(location.hash.slice(1)));
  useEffect(() => { const f = () => setH(decodeURIComponent(location.hash.slice(1))); addEventListener("hashchange", f); return () => removeEventListener("hashchange", f); }, []);
  return h;
}
export const go = (name: string) => { if (location.hash.slice(1) === name) dispatchEvent(new HashChangeEvent("hashchange")); else location.hash = name; };
