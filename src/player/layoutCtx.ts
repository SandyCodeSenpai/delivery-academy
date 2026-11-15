import { createContext } from "react";
import type { Visual } from "@/content/types";
/** true on wide viewports (>= 1100px): flow and sequence visuals move to a sticky left column. */
export const WideCtx = createContext(false);
export const WIDE_QUERY = "(min-width: 1100px)";
export const splitsVisual = (v?: Visual) => !!v && (v.kind === "flow" || v.kind === "sequence");
