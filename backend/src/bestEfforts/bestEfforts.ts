import type { DistanceStream } from "../types/activity.js";

export interface BestEffortDistance {
  key: string;
  label: string;
  meters: number;
}

/** Columns of the best-efforts table, shortest first. */
export const BEST_EFFORT_DISTANCES: BestEffortDistance[] = [
  { key: "1k", label: "1K", meters: 1000 },
  { key: "1mi", label: "1 mile", meters: 1609.344 },
  { key: "2mi", label: "2 mile", meters: 3218.688 },
  { key: "5k", label: "5K", meters: 5000 },
  { key: "10k", label: "10K", meters: 10000 },
  { key: "10mi", label: "10 mile", meters: 16093.44 },
  { key: "hm", label: "Half marathon", meters: 21097.5 },
  { key: "30k", label: "30K", meters: 30000 },
  { key: "fm", label: "Marathon", meters: 42195 },
  { key: "50k", label: "50K", meters: 50000 },
];

/** Shortest distance we analyse; activities below this are skipped. */
export const MIN_BEST_EFFORT_METERS = BEST_EFFORT_DISTANCES[0].meters;

/** Best time (seconds) per distance key; null when the activity was too short. */
export type BestEffortTimes = Record<string, number | null>;

/**
 * Fastest plausible running speed (m/s), quicker than world-record 400m pace.
 * GPS glitches can "teleport" hundreds of meters in a second; capping each
 * sample's distance gain at this speed stops a single spike from producing
 * an impossible effort.
 */
const MAX_RUN_SPEED_MPS = 9;

/**
 * Cumulative distance with each step clamped to [0, maxSpeed * dt]. Removes
 * GPS spikes and backwards dips (distance must never decrease).
 */
function cleanDistance(stream: DistanceStream, maxSpeed: number): Float64Array {
  const { time, distance } = stream;
  const n = Math.min(time.length, distance.length);
  const dist = new Float64Array(n);
  for (let i = 1; i < n; i++) {
    const dt = Math.max(time[i] - time[i - 1], 1);
    const step = (distance[i] ?? 0) - (distance[i - 1] ?? 0);
    dist[i] = dist[i - 1] + Math.min(Math.max(step, 0), maxSpeed * dt);
  }
  return dist;
}

/**
 * Fastest time to cover `meters` anywhere within the stream.
 *
 * Sliding window over cumulative distance: for each end sample, find the
 * latest start where at least `meters` have been covered, interpolating the
 * exact start time inside that sample interval. O(n) per distance.
 */
export function fastestTime(
  stream: DistanceStream,
  meters: number,
  maxSpeed: number = MAX_RUN_SPEED_MPS,
  dist: Float64Array = cleanDistance(stream, maxSpeed),
): number | null {
  const { time } = stream;
  const n = dist.length;
  if (n < 2) return null;
  if (dist[n - 1] - dist[0] < meters) return null;

  let best = Infinity;
  let start = 0;
  for (let end = 1; end < n; end++) {
    const target = dist[end] - meters;
    if (target < dist[0]) continue;
    // Advance to the last sample at or before the target start distance.
    while (start + 1 < end && dist[start + 1] <= target) start++;

    const span = dist[start + 1] - dist[start];
    const fraction = span > 0 ? (target - dist[start]) / span : 0;
    const startTime = time[start] + fraction * (time[start + 1] - time[start]);
    const elapsed = time[end] - startTime;
    if (elapsed > 0 && elapsed < best) best = elapsed;
  }
  return Number.isFinite(best) ? Math.round(best) : null;
}

export function computeBestEfforts(stream: DistanceStream): BestEffortTimes {
  const dist = cleanDistance(stream, MAX_RUN_SPEED_MPS);
  const result: BestEffortTimes = {};
  for (const { key, meters } of BEST_EFFORT_DISTANCES) {
    result[key] = fastestTime(stream, meters, MAX_RUN_SPEED_MPS, dist);
  }
  return result;
}
