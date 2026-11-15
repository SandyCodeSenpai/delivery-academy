import { DEMOS } from "@/diagram/demo";
import { Visual } from "@/diagram";
export default function DiagramHarness() {
  return (
    <div style={{ padding: 24, display: "grid", gap: 32, maxWidth: 760, margin: "0 auto" }}>
      {DEMOS.map((v, i) => <div key={i}><Visual visual={v} /></div>)}
    </div>
  );
}
