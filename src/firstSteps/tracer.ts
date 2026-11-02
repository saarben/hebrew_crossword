/**
 * Finger-tracing logic (no React, no DOM) so it can be unit-tested.
 *
 * The child must start near the start dot and drag along each stroke in order.
 * Progress only advances along the path (scribbling elsewhere does nothing),
 * lifting the finger keeps progress, and wandering far off the path is counted
 * as a "stray" so the game can offer help.
 */
import type { Pt } from './strokes';

export const STEP = 2; // spacing (in 100x100 units) of the resampled path

export interface Tracer {
  /** Resampled strokes. */
  paths: Pt[][];
  /** Radius (units) within which the finger counts as "on the path". */
  radius: number;
  stroke: number;
  /** Index of the next point to reach on the current stroke. */
  idx: number;
  active: boolean;
  off: boolean;
  strays: number;
  done: boolean;
}

export type TraceEvent = 'none' | 'progress' | 'stray' | 'strokeDone' | 'letterDone';

const dist = (a: Pt, b: Pt) => Math.hypot(a[0] - b[0], a[1] - b[1]);

export function resample(stroke: Pt[], step = STEP): Pt[] {
  const out: Pt[] = [stroke[0]];
  let carry = 0;
  for (let i = 1; i < stroke.length; i++) {
    const a = stroke[i - 1];
    const b = stroke[i];
    const len = dist(a, b);
    let t = step - carry;
    while (t <= len) {
      out.push([a[0] + ((b[0] - a[0]) * t) / len, a[1] + ((b[1] - a[1]) * t) / len]);
      t += step;
    }
    carry = len - (t - step);
  }
  const last = stroke[stroke.length - 1];
  if (dist(out[out.length - 1], last) > 0.01) out.push(last);
  return out;
}

export function createTracer(strokes: Pt[][], radius = 9): Tracer {
  return { paths: strokes.map((s) => resample(s)), radius, stroke: 0, idx: 0, active: false, off: false, strays: 0, done: false };
}

/** How many points of the current stroke are already traced (for drawing the ink). */
export function progressOf(t: Tracer, stroke: number): number {
  if (t.done || stroke < t.stroke) return t.paths[stroke].length;
  return stroke === t.stroke ? t.idx : 0;
}

/** Finger touched down at p. Activates only close to where the child must continue. */
export function begin(t: Tracer, p: Pt): boolean {
  if (t.done) return false;
  const path = t.paths[t.stroke];
  const target = path[Math.min(t.idx, path.length - 1)];
  // starting a stroke needs to be near its start dot; resuming near the traced end
  t.active = dist(p, target) <= t.radius * 2.2;
  t.off = false;
  return t.active;
}

export function end(t: Tracer) {
  t.active = false;
  t.off = false;
}

/** Finger moved to p (call with interpolated points so fast swipes aren't skipped). */
export function move(t: Tracer, p: Pt): TraceEvent {
  if (!t.active || t.done) return 'none';
  const path = t.paths[t.stroke];
  const WINDOW = Math.ceil((t.radius * 2.5) / STEP);
  let best = -1;
  let nearest = Infinity;
  for (let j = Math.max(0, t.idx - 2); j < Math.min(path.length, t.idx + WINDOW); j++) {
    const d = dist(p, path[j]);
    nearest = Math.min(nearest, d);
    if (j >= t.idx && d <= t.radius) best = j;
  }
  if (best >= 0) {
    t.off = false;
    const advanced = best + 1 > t.idx;
    t.idx = Math.max(t.idx, best + 1);
    if (t.idx >= path.length - 1) {
      t.idx = path.length;
      t.active = false;
      t.stroke += 1;
      t.idx = 0;
      if (t.stroke >= t.paths.length) {
        t.done = true;
        return 'letterDone';
      }
      return 'strokeDone';
    }
    return advanced ? 'progress' : 'none';
  }
  if (nearest > t.radius * 1.8 && !t.off) {
    t.off = true;
    t.strays += 1;
    return 'stray';
  }
  return 'none';
}

/** Move along the segment a→b in small steps; returns the strongest event seen. */
export function moveSegment(t: Tracer, a: Pt, b: Pt): TraceEvent {
  const n = Math.max(1, Math.ceil(dist(a, b) / 1.5));
  let result: TraceEvent = 'none';
  const rank: Record<TraceEvent, number> = { none: 0, progress: 1, stray: 2, strokeDone: 3, letterDone: 4 };
  for (let i = 1; i <= n; i++) {
    const e = move(t, [a[0] + ((b[0] - a[0]) * i) / n, a[1] + ((b[1] - a[1]) * i) / n]);
    if (rank[e] > rank[result]) result = e;
    if (e === 'letterDone') break;
  }
  return result;
}

/** Point on the current stroke where the next dot should pulse. */
export function nextTarget(t: Tracer): Pt | null {
  if (t.done) return null;
  const path = t.paths[t.stroke];
  return path[Math.min(t.idx, path.length - 1)];
}
