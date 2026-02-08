/* ─── Lightweight audio utility helpers ───────────────────────── */

/**
 * Compute average amplitude from a Uint8Array of frequency data.
 * Returns a normalised 0 → 1 value.
 */
export function averageAmplitude(data: Uint8Array): number {
  if (data.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    sum += data[i];
  }
  return sum / data.length / 255;
}

/**
 * Linearly interpolate between two values.
 * `t` should be 0 → 1.
 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Clamp a value between min and max.
 */
export function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}
