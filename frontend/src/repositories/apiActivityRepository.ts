import { apiClient } from "../api/apiClient";
import type {
  ActivityLap,
  ActivityLogEntry,
  BestEffortsResponse,
  RunActivity,
  WeeklyStats,
} from "../types/activity";
import type { ActivityRepository } from "./activityRepository";

const RECENT_RUNS_LIMIT = 10;
const WEEKLY_STATS_WEEKS = 12;
/** Matches the backend's history cache; a fresher fetch would be a cache hit anyway. */
const HISTORY_TTL_MS = 30 * 60 * 1000;

interface HistoryCacheEntry {
  promise: Promise<ActivityLogEntry[]>;
  fetchedAt: number;
  /** Set once the request resolves. */
  data?: ActivityLogEntry[];
}

let historyCache: HistoryCacheEntry | null = null;

/** Only complete results are kept; partial ones are still being analysed. */
let bestEffortsCache: { data: BestEffortsResponse; fetchedAt: number } | null = null;
/** Laps of a finished activity never change; cache them for the session. */
const lapsCache = new Map<string, Promise<ActivityLap[]>>();

function isFresh(cache: HistoryCacheEntry | null): cache is HistoryCacheEntry {
  return cache !== null && Date.now() - cache.fetchedAt < HISTORY_TTL_MS;
}

/**
 * Drops cached responses. Call when the session ends so a different
 * account never sees the previous user's data.
 */
export function clearActivityCache(): void {
  historyCache = null;
  bestEffortsCache = null;
  lapsCache.clear();
}

export const apiActivityRepository: ActivityRepository = {
  getRecentRuns() {
    return apiClient.get<RunActivity[]>(
      `/api/activities/recent?limit=${RECENT_RUNS_LIMIT}`,
    );
  },

  getWeeklyStats() {
    return apiClient.get<WeeklyStats[]>(
      `/api/activities/weekly-stats?weeks=${WEEKLY_STATS_WEEKS}`,
    );
  },

  /**
   * Full history is large and slow upstream, so it's fetched once and reused
   * across tab visits. Caching the promise also dedupes concurrent calls.
   */
  getHistory() {
    if (isFresh(historyCache)) return historyCache.promise;

    const promise = apiClient.get<ActivityLogEntry[]>("/api/activities/history");
    const entry: HistoryCacheEntry = {
      promise,
      fetchedAt: Date.now(),
    };
    historyCache = entry;
    promise.then(
      (data) => {
        entry.data = data;
      },
      // Don't cache failures: the next visit should retry.
      () => {
        if (historyCache === entry) historyCache = null;
      },
    );
    return promise;
  },

  peekHistory() {
    return isFresh(historyCache) ? historyCache.data : undefined;
  },

  async getBestEfforts() {
    const data = await apiClient.get<BestEffortsResponse>(
      "/api/activities/best-efforts",
    );
    const { analysed, total, running } = data.progress;
    if (!running && analysed >= total) {
      bestEffortsCache = { data, fetchedAt: Date.now() };
    }
    return data;
  },

  peekBestEfforts() {
    return bestEffortsCache &&
      Date.now() - bestEffortsCache.fetchedAt < HISTORY_TTL_MS
      ? bestEffortsCache.data
      : undefined;
  },

  getLaps(activityId) {
    let laps = lapsCache.get(activityId);
    if (!laps) {
      laps = apiClient.get<ActivityLap[]>(
        `/api/activities/${encodeURIComponent(activityId)}/laps`,
      );
      lapsCache.set(activityId, laps);
      // Don't cache failures: reopening should retry.
      laps.catch(() => lapsCache.delete(activityId));
    }
    return laps;
  },
};
