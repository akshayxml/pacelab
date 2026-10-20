// ActivityRepository for the static app: reads Intervals.icu directly from
// the browser with the user's API key. One request loads the whole history;
// recent runs, weekly stats and yearly progress are all derived from it.

import { ApiError } from "../api/apiClient";
import {
  bestEffortJobStatus,
  ensureBestEfforts,
  loadBestEffortResults,
  resetBestEffortJob,
} from "../intervals/bestEffortJob";
import { BEST_EFFORT_DISTANCES, MIN_BEST_EFFORT_METERS } from "../intervals/bestEfforts";
import { listActivities } from "../intervals/client";
import {
  aggregateWeeklyStats,
  isRun,
  localDate,
  toLogEntry,
  toRunActivity,
} from "../intervals/mapper";
import { activityCacheStore, apiKeyStore } from "../intervals/storage";
import type { SourceActivity } from "../intervals/types";
import type {
  ActivityLogEntry,
  BestEffortActivity,
  BestEffortsResponse,
} from "../types/activity";
import type { ActivityRepository } from "./activityRepository";

const RECENT_RUNS_LIMIT = 10;
const WEEKLY_STATS_WEEKS = 8;
/** Reuse fetched activities for this long before asking Intervals.icu again. */
const ACTIVITIES_TTL_MS = 5 * 60 * 1000;

let memory: { activities: SourceActivity[]; fetchedAt: number } | null = null;
let inflight: Promise<SourceActivity[]> | null = null;
/** Bumped on reset so a request from a previous session can't repopulate memory. */
let generation = 0;
let bestEffortsCache: BestEffortsResponse | null = null;
const historyByActivities = new WeakMap<SourceActivity[], ActivityLogEntry[]>();

function requireApiKey(): string {
  const key = apiKeyStore.get();
  if (!key) throw new ApiError(401, "not_connected");
  return key;
}

function isFresh(): boolean {
  return memory !== null && Date.now() - memory.fetchedAt < ACTIVITIES_TTL_MS;
}

/**
 * Every activity, newest first. Network first; when offline, falls back to
 * the copy saved on this device so the installed app still opens.
 */
function loadActivities(): Promise<SourceActivity[]> {
  if (memory && isFresh()) return Promise.resolve(memory.activities);

  const requestGeneration = generation;
  inflight ??= (async () => {
    try {
      const activities = await listActivities(requireApiKey(), 0);
      if (requestGeneration === generation) {
        memory = { activities, fetchedAt: Date.now() };
        void activityCacheStore.set(activities).catch(() => {});
      }
      return activities;
    } catch (err) {
      // Auth and rate-limit errors are real answers; only network failures
      // fall back to cached data.
      if (!(err instanceof ApiError)) {
        const cached = memory?.activities ?? (await activityCacheStore.get().catch(() => undefined));
        if (cached) return cached;
      }
      throw err;
    } finally {
      if (requestGeneration === generation) inflight = null;
    }
  })();
  return inflight;
}

function historyOf(activities: SourceActivity[]): ActivityLogEntry[] {
  let history = historyByActivities.get(activities);
  if (!history) {
    history = activities.filter(isRun).map(toLogEntry);
    historyByActivities.set(activities, history);
  }
  return history;
}

/** Drops in-memory data and stops background work (e.g. on disconnect). */
export function resetIntervalsRepository(): void {
  generation++;
  memory = null;
  inflight = null;
  bestEffortsCache = null;
  resetBestEffortJob();
}

export const intervalsActivityRepository: ActivityRepository = {
  async getRecentRuns() {
    const activities = await loadActivities();
    return activities.filter(isRun).slice(0, RECENT_RUNS_LIMIT).map(toRunActivity);
  },

  async getWeeklyStats() {
    return aggregateWeeklyStats(await loadActivities(), WEEKLY_STATS_WEEKS);
  },

  async getHistory() {
    return historyOf(await loadActivities());
  },

  peekHistory() {
    return memory && isFresh() ? historyOf(memory.activities) : undefined;
  },

  async getBestEfforts() {
    const [activities, results] = await Promise.all([
      loadActivities(),
      loadBestEffortResults(),
    ]);

    const candidates = activities.filter(
      (a) => isRun(a) && a.distanceM >= MIN_BEST_EFFORT_METERS,
    );
    // Starts (or continues) analysing runs that aren't cached yet.
    await ensureBestEfforts(requireApiKey(), candidates.map((a) => a.id));

    let analysed = 0;
    const rows: BestEffortActivity[] = [];
    for (const activity of candidates) {
      if (!results.has(activity.id)) continue;
      analysed++;
      const stored = results.get(activity.id);
      if (!stored) continue;

      // Streams can read slightly longer than the recorded distance; don't
      // report efforts the activity didn't actually cover (1% tolerance).
      const efforts: Record<string, number | null> = {};
      for (const { key, meters } of BEST_EFFORT_DISTANCES) {
        efforts[key] = meters <= activity.distanceM * 1.01 ? stored[key] ?? null : null;
      }
      if (Object.values(efforts).every((v) => v === null)) continue;
      rows.push({
        id: activity.id,
        name: activity.name,
        date: localDate(activity),
        distanceM: Math.round(activity.distanceM),
        link: activity.link,
        efforts,
      });
    }

    const status = bestEffortJobStatus();
    const response: BestEffortsResponse = {
      distances: BEST_EFFORT_DISTANCES,
      activities: rows,
      progress: {
        analysed,
        total: candidates.length,
        running: status.running && analysed < candidates.length,
        rateLimitedUntil: status.rateLimitedUntil
          ? new Date(status.rateLimitedUntil).toISOString()
          : null,
      },
    };
    if (analysed >= candidates.length) bestEffortsCache = response;
    return response;
  },

  peekBestEfforts() {
    return bestEffortsCache && isFresh() ? bestEffortsCache : undefined;
  },
};
