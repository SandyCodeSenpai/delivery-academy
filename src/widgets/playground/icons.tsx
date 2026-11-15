/**
 * Line icons for the stage, drawn in a 24 x 24 box centred on (0, 0).
 * One stroke width, round caps and joins, colour from `currentColor`, so every icon
 * follows the theme and the node's state.
 */
type IconName = "viewer" | "steer" | "shield" | "bucket" | "down";

export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  const s = size / 24;
  return (
    <g transform={`scale(${s})`} fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {name === "viewer" && (<>
        <rect x={-10} y={-8.5} width={20} height={13.5} rx={2.5} />
        <path d="M-4 9.5H4M0 5V9.5" />
        <path d="M-2 -4.6L3 -1.75L-2 1.1Z" fill="currentColor" stroke="none" />
      </>)}
      {name === "steer" && (<>
        <path d="M0 10V0" />
        <path d="M0 0L-7 -7M0 0L7 -7" />
        <path d="M-7 -2.5V-7H-2.5M7 -2.5V-7H2.5" />
      </>)}
      {name === "shield" && (<>
        <path d="M0 -10L8 -7V-0.5C8 4.6 4.6 8.4 0 10C-4.6 8.4 -8 4.6 -8 -0.5V-7Z" />
        <path d="M-3.4 0.2L-0.8 2.8L3.8 -2" />
      </>)}
      {name === "bucket" && (<>
        <ellipse cx={0} cy={-6.5} rx={8} ry={3} />
        <path d="M-8 -6.5V6.5C-8 8.2 -4.4 9.5 0 9.5C4.4 9.5 8 8.2 8 6.5V-6.5" />
        <path d="M-8 0C-8 1.7 -4.4 3 0 3C4.4 3 8 1.7 8 0" />
      </>)}
      {name === "down" && <path d="M-5 -5L5 5M5 -5L-5 5" strokeWidth={2.2} />}
    </g>
  );
}
