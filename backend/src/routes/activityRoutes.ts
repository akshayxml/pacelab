import { Router } from "express";
import {
  aggregateWeeklyStats,
  isRun,
  localDate,
  toRunActivity,
  toLogEntry,
} from "../activities/activityMapper.js";
import { activityCache } from "../activities/activityCache.js";
import {
  BEST_EFFORT_DISTANCES,
  MIN_BEST_EFFORT_METERS,
} from "../bestEfforts/bestEfforts.js";
import {
  ensureBestEfforts,
  jobStatus,
  storeKey,
} from "../bestEfforts/bestEffortJob.js";
import { bestEffortStore } from "../bestEfforts/bestEffortStore.js";
import type {
  ActivityLap,
  BestEffortActivity,
  BestEffortsResponse,
} from "../types/activity.js";
import {
  getActivitySource,
  resolveActivitySource,
  type ActivitySource,
} from "../activities/activitySource.js";

export const activityRouter = Router();
activityRouter.use(resolveActivitySource);

function clampInt(value: unknown, fallback: number, min: number, max: number) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (Number.isNaN(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

/** The athlete's full activity history, newest first (incrementally synced). */
function loadHistory(source: ActivitySource) {
  return activityCache.getHistory(source.cacheScope, source);
}

/** GET /api/activities/recent?limit=10 */
activityRouter.get("/recent", async (req, res) => {
  const source = getActivitySource(res);
  const limit = clampInt(req.query.limit, 10, 1, 50);
  const activities = await loadHistory(source);
  res.json(activities.filter(isRun).slice(0, limit).map(toRunActivity));
});

/** GET /api/activities/weekly-stats?weeks=8 */
activityRouter.get("/weekly-stats", async (req, res) => {
  const source = getActivitySource(res);
  const weeks = clampInt(req.query.weeks, 8, 1, 52);
  // Only activities inside the window land in a weekly bucket.
  res.json(aggregateWeeklyStats(await loadHistory(source), weeks));
});

/**
 * GET /api/activities/history
 * Every run in the athlete's history (any run type: road, trail, virtual)
 * for the yearly progress charts: time and distance.
 */
activityRouter.get("/history", async (_req, res) => {
  const source = getActivitySource(res);
  const activities = await loadHistory(source);
  res.json(activities.filter(isRun).map(toLogEntry));
});

/**
 * GET /api/activities/best-efforts
 * Fastest time per standard distance within each run. Streams are
 * analysed in the background and persisted; poll until `progress.running`
 * is false.
 */
activityRouter.get("/best-efforts", async (_req, res) => {
  const source = getActivitySource(res);
  const [activities, store] = await Promise.all([
    loadHistory(source),
    bestEffortStore.ready(),
  ]);

  // Newest first, so recent activities appear early during the first analysis.
  const candidates = activities.filter(
    (a) => isRun(a) && a.distanceM >= MIN_BEST_EFFORT_METERS,
  );
  ensureBestEfforts(source, candidates.map((a) => a.id));

  let analysed = 0;
  const rows: BestEffortActivity[] = [];
  for (const activity of candidates) {
    const key = storeKey(source.provider, activity.id);
    if (!store.has(key)) continue;
    analysed++;
    const stored = store.get(key);
    if (!stored) continue;

    // Streams can read slightly longer than the recorded distance; don't
    // report efforts the activity didn't actually cover (1% tolerance).
    const efforts: Record<string, number | null> = {};
    for (const { key: distanceKey, meters } of BEST_EFFORT_DISTANCES) {
      efforts[distanceKey] =
        meters <= activity.distanceM * 1.01 ? stored[distanceKey] ?? null : null;
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

  const status = jobStatus(source.provider);
  res.json({
    distances: BEST_EFFORT_DISTANCES,
    activities: rows,
    progress: {
      analysed,
      total: candidates.length,
      // Still working if the job runs or there is unanalysed work left.
      running: status.running && analysed < candidates.length,
      rateLimitedUntil: status.rateLimitedUntil
        ? new Date(status.rateLimitedUntil).toISOString()
        : null,
    },
  } satisfies BestEffortsResponse);
});

/** Laps of a finished activity don't change; keep a bounded in-memory cache. */
const LAPS_CACHE_MAX = 500;
const lapsCache = new Map<string, ActivityLap[]>();

/**
 * True if `id` is one of the athlete's runs. Uses the same synced history
 * as the dashboard, so it rarely costs an upstream request.
 */
async function isOwnRun(source: ActivitySource, id: string): Promise<boolean> {
  const history = await loadHistory(source);
  return history.some((a) => a.id === id && isRun(a));
}

/** GET /api/activities/:id/laps */
activityRouter.get("/:id/laps", async (req, res) => {
  const { id } = req.params;
  if (!/^[\w-]{1,64}$/.test(id)) {
    res.status(400).json({ error: "invalid_activity_id" });
    return;
  }

  const source = getActivitySource(res);
  const cacheKey = `${source.cacheScope}:${id}`;
  let laps = lapsCache.get(cacheKey);
  if (!laps) {
    // Only proxy the athlete's own runs, never arbitrary upstream IDs.
    if (!(await isOwnRun(source, id))) {
      res.status(404).json({ error: "activity_not_found" });
      return;
    }
    laps = await source.getLaps(id);
    if (lapsCache.size >= LAPS_CACHE_MAX) {
      // Map iterates in insertion order: drop the oldest entry.
      lapsCache.delete(lapsCache.keys().next().value as string);
    }
    lapsCache.set(cacheKey, laps);
  }
  res.json(laps);
});
