/** Small line icons for the player (24px grid, 1.75 stroke, round caps). */
import { motion } from "framer-motion";

type P = { size?: number; className?: string };
const base = (size: number) => ({ width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.9, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true });

export const IconClose = ({ size = 22, className }: P) => <svg {...base(size)} className={className}><path d="M6 6l12 12M18 6L6 18" /></svg>;
export const IconCheck = ({ size = 20, className }: P) => <svg {...base(size)} strokeWidth={2.4} className={className}><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>;
export const IconX = ({ size = 20, className }: P) => <svg {...base(size)} strokeWidth={2.4} className={className}><path d="M7 7l10 10M17 7L7 17" /></svg>;
export const IconBolt = ({ size = 16, className }: P) => (
  <svg {...base(size)} className={className} strokeWidth={1.8}><path d="M13 3L5.5 13.5H11L10 21l7.5-10.5H12L13 3z" fill="currentColor" fillOpacity={0.18} /></svg>
);
export const IconBulb = ({ size = 20, className }: P) => (
  <svg {...base(size)} className={className}><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z" /></svg>
);
export const IconKeyboard = ({ size = 18, className }: P) => (
  <svg {...base(size)} className={className} strokeWidth={1.7}><rect x="2.5" y="6" width="19" height="12" rx="2.5" /><path d="M6 10h.01M9.5 10h.01M13 10h.01M16.5 10h.01M7.5 14h9" /></svg>
);
export const IconClock = ({ size = 18, className }: P) => <svg {...base(size)} className={className}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></svg>;
export const IconTarget = ({ size = 18, className }: P) => <svg {...base(size)} className={className}><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="4.5" /><circle cx="12" cy="12" r="0.8" fill="currentColor" /></svg>;
export const IconFlask = ({ size = 18, className }: P) => <svg {...base(size)} className={className}><path d="M9.5 3h5M10 3v6L4.8 18.2A1.9 1.9 0 0 0 6.5 21h11a1.9 1.9 0 0 0 1.7-2.8L14 9V3" /><path d="M7.5 15h9" /></svg>;
export const IconExpand = ({ size = 18, className }: P) => <svg {...base(size)} className={className}><path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7" /></svg>;
export const IconChevronLeft = ({ size = 22, className }: P) => <svg {...base(size)} strokeWidth={2.2} className={className}><path d="M14.5 5.5L8 12l6.5 6.5" /></svg>;
/** A small four-point spark: "an idea", used for guesses. */
export const IconSpark = ({ size = 16, className }: P) => (
  <svg {...base(size)} className={className} strokeWidth={1.8}><path d="M12 3.5c.6 4.3 2.2 5.9 6.5 6.5-4.3.6-5.9 2.2-6.5 6.5-.6-4.3-2.2-5.9-6.5-6.5 4.3-.6 5.9-2.2 6.5-6.5z" fill="currentColor" fillOpacity={0.2} /><path d="M18.5 16.5v3M17 18h3" /></svg>
);
export const IconRetry = ({ size = 18, className }: P) => <svg {...base(size)} className={className}><path d="M4 12a8 8 0 1 0 2.5-5.8M4 4v4.5h4.5" /></svg>;

/** A check mark that draws itself (used in the feedback sheet and on completion). */
export function DrawCheck({ size = 22, reduced, delay = 0 }: { size?: number; reduced?: boolean; delay?: number }) {
  return (
    <svg {...base(size)} strokeWidth={2.6}>
      <motion.path d="M5 12.5l4.5 4.5L19 7.5" initial={{ pathLength: reduced ? 1 : 0 }} animate={{ pathLength: 1 }} transition={{ duration: reduced ? 0 : 0.3, ease: "easeOut", delay }} />
    </svg>
  );
}
