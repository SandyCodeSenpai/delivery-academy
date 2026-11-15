import { lazy, Suspense } from "react";
import { useHash } from "@/lib/router";

// Pages (owned by the shell agent). Harness pages are for development and QA.
const Shell = lazy(() => import("@/pages/Shell"));
const WidgetHarness = lazy(() => import("@/pages/WidgetHarness"));
const DiagramHarness = lazy(() => import("@/pages/DiagramHarness"));

export default function App() {
  const hash = useHash();
  let page;
  if (hash.startsWith("w-")) page = <WidgetHarness hash={hash} />;
  else if (hash === "diagrams") page = <DiagramHarness />;
  else page = <Shell hash={hash} />;
  return <Suspense fallback={<div style={{ padding: 32, color: "var(--muted)" }}>Loading</div>}>{page}</Suspense>;
}
