/** Props every widget receives. Extra keys come from a WidgetStep's `props`. */
export interface WidgetProps {
  /** Call once when the reader has done the widget's task (e.g. reached the final state). Unlocks Continue. */
  onComplete?: () => void;
  /** true inside a lesson step (fit roughly 640x520, no page chrome); false on the full lab page. */
  compact?: boolean;
  [key: string]: unknown;
}
