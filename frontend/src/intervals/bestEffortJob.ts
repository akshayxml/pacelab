// Background best-effort analysis in the browser: fetches each run's
// distance stream once, computes its best efforts and caches the result in
// IndexedDB, so later visits only analyse new runs.
// Ported from backend/src/bestEfforts/bestEffortJob.ts.

import { ApiError } from "../api/apiClient";
import { computeBestEfforts, type BestEffortTimes } from "./bestEfforts";
import { getDistanceStream } from "./client";
import { bestEffortCacheStore } from "./storage";

/** Parallel stream requests; low to stay polite with Intervals.icu. */
const CONCURRENCY = 3;
/** Minimum gap between stream requests across all workers (~4 req/s). */
const MIN_REQUEST_INTERVAL_MS = 250;
/**
 * After a 429, wait this long before the next attempt. Retry-After isn't
 * readable cross-origin, so use a fixed, moderate pause.
 */
const RATE_LIMIT_BACKOFF_MS = 5 * 60 * 1000;
/** After a network error (offline, timeout), wait before trying again. */
const NETWORK_BACKOFF_MS = 60 * 1000;
/** An activity whose streams failed isn't retried for this long. */
const FAILED_ACTIVITY_BACKOFF_MS = 30 * 60 * 1000;
const WRITE_DEBOUNCE_MS = 2_000;

/** activityId -> best efforts; null = no distance data (don't refetch). */
let results: Map<string, BestEffortTimes | null> | null = null;
let loading: Promise<Map<string, BestEffortTimes | null>> | null = null;
let running = false;
let rateLimitedUntil = 0;
/** No new job starts before this (network error, or the key was rejected). */
let pausedUntil = 0;
/** activityId -> time after which a failed activity may be retried. */
const failedUntil = new Map<string, number>();
let nextRequestAt = 0;
let writeTimer: ReturnType<typeof setTimeout> | undefined;
/** Bumped on reset so workers from a previous session stop. */
let generation = 0;

/** Loads cached results from IndexedDB (once). */
export function loadBestEffortResults(): Promise<Map<string, BestEffortTimes | null>> {
  if (results) return Promise.resolve(results);
  loading ??= bestEffortCacheStore
    .get()
    .catch(() => undefined)
    .then((stored) => {
      results ??= new Map(Object.entries(stored ?? {}));
      return results;
    });
  return loading;
}

function scheduleWrite(): void {
  if (writeTimer) return;
  writeTimer = setTimeout(() => {
    writeTimer = undefined;
    if (results) void bestEffortCacheStore.set(Object.fromEntries(results));
  }, WRITE_DEBOUNCE_MS);
}

/** Waits for this worker's turn so all workers together respect the rate cap. */
function throttle(): Promise<void> {
  const now = Date.now();
  const at = Math.max(now, nextRequestAt);
  nextRequestAt = at + MIN_REQUEST_INTERVAL_MS;
  return at > now ? new Promise((resolve) => setTimeout(resolve, at - now)) : Promise.resolve();
}

export function bestEffortJobStatus() {
  return {
    running,
    rateLimitedUntil: rateLimitedUntil > Date.now() ? rateLimitedUntil : null,
  };
}

/**
 * Analyses `activityIds` that have no cached result yet. Fire-and-forget:
 * callers re-read the results to track progress. A second call while the
 * job is running, paused or backing off is a no-op, so polling can't turn
 * failures into a request loop.
 */
export async function ensureBestEfforts(apiKey: string, activityIds: string[]): Promise<void> {
  const store = await loadBestEffortResults();
  const now = Date.now();
  if (running || rateLimitedUntil > now || pausedUntil > now) return;

  const queue = activityIds.filter(
    (id) => !store.has(id) && !((failedUntil.get(id) ?? 0) > now),
  );
  if (queue.length === 0) return;

  running = true;
  const jobGeneration = generation;
  let stopped = false;

  const worker = async () => {
    while (!stopped && jobGeneration === generation) {
      const id = queue.shift();
      if (!id) return;
      await throttle();
      if (stopped || jobGeneration !== generation) return;
      try {
        const stream = await getDistanceStream(apiKey, id);
        if (jobGeneration !== generation) return;
        store.set(id, stream ? computeBestEfforts(stream) : null);
        scheduleWrite();
      } catch (err) {
        if (jobGeneration !== generation) return;
        if (!(err instanceof ApiError)) {
          // Offline or timed out: stop and try again after a short pause.
          stopped = true;
          pausedUntil = Date.now() + NETWORK_BACKOFF_MS;
          return;
        }
        if (err.status === 429) {
          stopped = true;
          rateLimitedUntil = Date.now() + RATE_LIMIT_BACKOFF_MS;
          return;
        }
        if (err.status === 401 || err.status === 403) {
          // Key revoked or lacks access: don't retry with it this session.
          // The next activity-list fetch surfaces the 401 to the user.
          stopped = true;
          pausedUntil = Number.POSITIVE_INFINITY;
          return;
        }
        // Other API errors: skip this run for a while instead of retrying it
        // on every poll.
        failedUntil.set(id, Date.now() + FAILED_ACTIVITY_BACKOFF_MS);
      }
    }
  };

  void Promise.all(Array.from({ length: CONCURRENCY }, worker)).finally(() => {
    if (jobGeneration === generation) running = false;
  });
}

/** Forgets in-memory results and stops any running job (e.g. on disconnect). */
export function resetBestEffortJob(): void {
  generation++;
  clearTimeout(writeTimer);
  writeTimer = undefined;
  results = null;
  loading = null;
  running = false;
  rateLimitedUntil = 0;
  pausedUntil = 0;
  failedUntil.clear();
  nextRequestAt = 0;
}
