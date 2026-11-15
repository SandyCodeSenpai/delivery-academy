/* One line-icon family for every NodeKind: 24px grid, 2px margin, 1.75px stroke, round caps and joins. */
import type { ReactNode } from "react";
import type { NodeKind } from "@/content/types";

const ICONS: Record<NodeKind, ReactNode> = {
  // people and devices
  viewer: <><circle cx="12" cy="8" r="3.6" /><path d="M4.8 20.2c.6-3.8 3.6-6.2 7.2-6.2s6.6 2.4 7.2 6.2" /></>,
  device: <><rect x="6.5" y="2.8" width="11" height="18.4" rx="2.6" /><path d="M10.6 17.6h2.8" /></>,
  player: <><rect x="2.8" y="4.8" width="18.4" height="14.4" rx="3" /><path d="M10.2 9.3v5.4l4.6-2.7z" /></>,
  studio: <><rect x="2.8" y="6.8" width="12.6" height="10.4" rx="2.4" /><path d="M15.4 10.6l5.8-3.1v9l-5.8-3.1" /></>,
  // naming and control plane
  dns: <><path d="M12 2.8v18.4" /><path d="M5.2 5.6h10.6l2.8 2.6-2.8 2.6H5.2z" /><path d="M18.8 13.2H8.2l-2.8 2.6 2.8 2.6h10.6z" /></>,
  resolver: <><circle cx="10.6" cy="10.6" r="6.4" /><path d="M15.4 15.4l5 5" /><path d="M8 10.6h5.2" /></>,
  steering: <><circle cx="12" cy="12" r="9.2" /><path d="M15.6 8.4l-2 5.2-5.2 2 2-5.2z" /></>,
  api: <><path d="M8.4 3.8c-2 0-3 1-3 3v2.4c0 1.6-.9 2.8-2.4 2.8 1.5 0 2.4 1.2 2.4 2.8v2.4c0 2 1 3 3 3" /><path d="M15.6 3.8c2 0 3 1 3 3v2.4c0 1.6.9 2.8 2.4 2.8-1.5 0-2.4 1.2-2.4 2.8v2.4c0 2-1 3-3 3" /></>,
  service: <><path d="M12 3l9 4.6-9 4.6-9-4.6z" /><path d="M3 12l9 4.6 9-4.6" /><path d="M3 16.4L12 21l9-4.6" /></>,
  monitor: <><path d="M2.8 12.4h4l2.6-6.6 5 12.4 2.6-5.8h4.2" /></>,
  queue: <><rect x="2.8" y="7.6" width="4.6" height="8.8" rx="1.4" /><rect x="9.7" y="7.6" width="4.6" height="8.8" rx="1.4" /><rect x="16.6" y="7.6" width="4.6" height="8.8" rx="1.4" /></>,
  drm: <><circle cx="8" cy="15.6" r="4.4" /><path d="M11.2 12.4L20.6 3" /><path d="M17.4 6.2l2.6 2.6" /><path d="M14.8 8.8l2 2" /></>,
  // delivery network
  cdn: <><circle cx="12" cy="12" r="9.2" /><path d="M2.8 12h18.4" /><path d="M12 2.8c2.6 2.5 3.8 5.6 3.8 9.2s-1.2 6.7-3.8 9.2c-2.6-2.5-3.8-5.6-3.8-9.2s1.2-6.7 3.8-9.2z" /></>,
  pop: <><path d="M12 21.2s-6.8-5.8-6.8-11.4a6.8 6.8 0 0 1 13.6 0c0 5.6-6.8 11.4-6.8 11.4z" /><circle cx="12" cy="9.8" r="2.4" /></>,
  edge: <><rect x="3.4" y="3.8" width="17.2" height="7" rx="2.2" /><rect x="3.4" y="13.2" width="17.2" height="7" rx="2.2" /><path d="M7.4 7.3h.01" /><path d="M7.4 16.7h.01" /><path d="M11 7.3h5.6" /><path d="M11 16.7h5.6" /></>,
  shield: <><path d="M12 2.8l7.6 3v5.6c0 4.8-3.2 8.4-7.6 9.8-4.4-1.4-7.6-5-7.6-9.8V5.8z" /><path d="M8.6 12h6.8" /></>,
  cache: <><path d="M4.6 6.2c0-1.5 3.3-2.6 7.4-2.6s7.4 1.1 7.4 2.6-3.3 2.6-7.4 2.6-7.4-1.1-7.4-2.6z" /><path d="M4.6 6.2v11.6c0 1.5 3.3 2.6 7.4 2.6s7.4-1.1 7.4-2.6V6.2" /><path d="M12.8 10.6l-2.6 3.8h3.6l-2.6 3.8" /></>,
  isp: <><circle cx="12" cy="9.6" r="1.6" /><path d="M12 11.2v10" /><path d="M8.6 21.2h6.8" /><path d="M8.4 6a5.2 5.2 0 0 0 0 7.2" /><path d="M15.6 6a5.2 5.2 0 0 1 0 7.2" /><path d="M5.6 3.2a9.2 9.2 0 0 0 0 12.8" /><path d="M18.4 3.2a9.2 9.2 0 0 1 0 12.8" /></>,
  ix: <><path d="M3.4 8.2h15.4" /><path d="M15.4 4.8l3.4 3.4-3.4 3.4" /><path d="M20.6 15.8H5.2" /><path d="M8.6 12.4l-3.4 3.4 3.4 3.4" /></>,
  router: <><rect x="2.8" y="12.6" width="18.4" height="7.6" rx="2.4" /><path d="M6.8 16.4h.01" /><path d="M10.2 16.4h.01" /><path d="M8.4 8.4a5 5 0 0 1 7.2 0" /><path d="M5.8 5.6a8.8 8.8 0 0 1 12.4 0" /></>,
  loadbalancer: <><circle cx="5" cy="12" r="2.2" /><path d="M7.2 12h3.2" /><path d="M10.4 12c2.4 0 2.8-6 6.6-6" /><path d="M10.4 12h6.6" /><path d="M10.4 12c2.4 0 2.8 6 6.6 6" /><circle cx="19.2" cy="6" r="1.8" /><circle cx="19.2" cy="12" r="1.8" /><circle cx="19.2" cy="18" r="1.8" /></>,
  firewall: <><rect x="2.8" y="4" width="18.4" height="16" rx="2.4" /><path d="M2.8 9.4h18.4" /><path d="M2.8 14.6h18.4" /><path d="M9 4v5.4" /><path d="M15 4v5.4" /><path d="M12 9.4v5.2" /><path d="M9 14.6V20" /><path d="M15 14.6V20" /></>,
  // origin and data
  origin: <><rect x="5.4" y="2.8" width="13.2" height="18.4" rx="2.4" /><path d="M9 7h6" /><path d="M9 10.6h6" /><path d="M12 16.8h.01" /></>,
  storage: <><path d="M3.6 6.4c0 1.5 3.8 2.7 8.4 2.7s8.4-1.2 8.4-2.7-3.8-2.7-8.4-2.7-8.4 1.2-8.4 2.7z" /><path d="M3.6 6.4l1.8 12.4c.3 1.4 3.2 2.4 6.6 2.4s6.3-1 6.6-2.4l1.8-12.4" /></>,
  database: <><path d="M4.6 6.2c0-1.5 3.3-2.6 7.4-2.6s7.4 1.1 7.4 2.6-3.3 2.6-7.4 2.6-7.4-1.1-7.4-2.6z" /><path d="M4.6 6.2v11.6c0 1.5 3.3 2.6 7.4 2.6s7.4-1.1 7.4-2.6V6.2" /><path d="M4.6 12c0 1.5 3.3 2.6 7.4 2.6s7.4-1.1 7.4-2.6" /></>,
  packager: <><path d="M12 2.8l8.4 4.4v9.6L12 21.2l-8.4-4.4V7.2z" /><path d="M3.6 7.2L12 11.6l8.4-4.4" /><path d="M12 11.6v9.6" /><path d="M7.8 5l8.4 4.4" /></>,
  encoder: <><rect x="2.8" y="4.4" width="18.4" height="15.2" rx="2.4" /><path d="M7.4 4.4v15.2" /><path d="M16.6 4.4v15.2" /><path d="M2.8 9.4h4.6" /><path d="M2.8 14.6h4.6" /><path d="M16.6 9.4h4.6" /><path d="M16.6 14.6h4.6" /></>,
  cloud: <><path d="M7.2 18.8h9.8a4.4 4.4 0 0 0 .5-8.8 5.8 5.8 0 0 0-11.1 1.1 3.9 3.9 0 0 0 .8 7.7z" /></>,
  region: <><path d="M3 6.6l6-2.6 6 2.6 6-2.6v13.4l-6 2.6-6-2.6-6 2.6z" /><path d="M9 4v13.4" /><path d="M15 6.6V20" /></>,
  generic: <><rect x="3.6" y="3.6" width="16.8" height="16.8" rx="4" /><circle cx="12" cy="12" r="2.4" /></>,
};

export function Icon({ kind, size = 20 }: { kind?: NodeKind; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={1.75}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {ICONS[kind ?? "generic"] ?? ICONS.generic}
    </svg>
  );
}

/** Calm category families. Only the icon tile is tinted; cards stay neutral. */
export type Family = "client" | "delivery" | "origin" | "control";
const FAM: Record<NodeKind, Family> = {
  viewer: "client", device: "client", player: "client", studio: "origin",
  dns: "control", resolver: "control", steering: "control", api: "control", service: "control", monitor: "control", queue: "control", drm: "control",
  cdn: "delivery", pop: "delivery", edge: "delivery", shield: "delivery", cache: "delivery", isp: "delivery", ix: "delivery",
  router: "delivery", loadbalancer: "delivery", firewall: "delivery",
  origin: "origin", storage: "origin", database: "origin", packager: "origin", encoder: "origin", cloud: "origin", region: "origin",
  generic: "control",
};
export const familyOf = (k?: NodeKind): Family => FAM[k ?? "generic"] ?? "control";
