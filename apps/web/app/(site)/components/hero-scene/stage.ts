/**
 * The 460×500 stage the hero mark is laid out in — shared by the CSS-3D mark
 * (`mark-3d.tsx`), the WebGL canvas box (`index.tsx`) and the Lottie intro overlay
 * (`grow-intro.tsx`), which is exactly why it lives alone: the three consumers
 * otherwise form an import cycle.
 */
export const STAGE = { width: 460, height: 500, markX: 30, markY: 60, markWidth: 400 } as const;
