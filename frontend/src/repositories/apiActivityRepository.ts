import { apiClient } from "../api/apiClient";
import type {
  ActivityLogEntry,
  RunActivity,
  WeeklyStats,
} from "../types/activity";
import type { ActivityRepository } from "./activityRepository";

const RECENT_RUNS_LIMIT = 10;
const WEEKLY_STATS_WEEKS = 8;
/** Matches the backend's history cache; a fresher fetch would be a cache hit anyway. */
const HISTORY_TTL_MS = 30 * 60 * 1000;

interface HistoryCacheEntry {
  promise: Promise<ActivityLogEntry[]>;
  fetchedAt: number;
  /** Set once the request resolves. */
  data?: ActivityLogEntry[];
}

let historyCache: HistoryCacheEntry | null = null;

function isFresh(cache: HistoryCacheEntry | null): cache is HistoryCacheEntry {
  return cache !== null && Date.now() - cache.fetchedAt < HISTORY_TTL_MS;
}

/**
 * Drops cached responses. Call when the session ends so a different
 * account never sees the previous user's data.
 */
export function clearActivityCache(): void {
  historyCache = null;
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
};
