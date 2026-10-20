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
/** After a 429, wait this long before the next attempt. */
const RATE_LIMIT_BACKOFF_MS = 15 * 60 * 1000;
const WRITE_DEBOUNCE_MS = 2_000;

/** activityId -> best efforts; null = no distance data (don't refetch). */
let results: Map<string, BestEffortTimes | null> | null = null;
let loading: Promise<Map<string, BestEffortTimes | null>> | null = null;
let running = false;
let rateLimitedUntil = 0;
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

export function bestEffortJobStatus() {
  return {
    running,
    rateLimitedUntil: rateLimitedUntil > Date.now() ? rateLimitedUntil : null,
  };
}

/**
 * Analyses `activityIds` that have no cached result yet. Fire-and-forget:
 * callers re-read the results to track progress. A second call while the
 * job is running is a no-op.
 */
export async function ensureBestEfforts(apiKey: string, activityIds: string[]): Promise<void> {
  const store = await loadBestEffortResults();
  if (running || rateLimitedUntil > Date.now()) return;

  const queue = activityIds.filter((id) => !store.has(id));
  if (queue.length === 0) return;

  running = true;
  const jobGeneration = generation;
  let stopped = false;

  const worker = async () => {
    while (!stopped && jobGeneration === generation) {
      const id = queue.shift();
      if (!id) return;
      try {
        const stream = await getDistanceStream(apiKey, id);
        if (jobGeneration !== generation) return;
        store.set(id, stream ? computeBestEfforts(stream) : null);
        scheduleWrite();
      } catch (err) {
        if (!(err instanceof ApiError)) {
          // Offline or timed out: stop and retry on a later visit rather
          // than burning through the queue.
          stopped = true;
          return;
        }
        if (err.status === 429) {
          stopped = true;
          rateLimitedUntil = Date.now() + RATE_LIMIT_BACKOFF_MS;
          return;
        }
        if (err.status === 401 || err.status === 403) {
          // Key revoked mid-job; the next dashboard request will surface it.
          stopped = true;
          return;
        }
        // Other API errors: skip this run for now; it's retried on a later visit.
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
}
