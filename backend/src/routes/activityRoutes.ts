import { Router } from "express";
import {
  aggregateWeeklyStats,
  isRun,
  toRunActivity,
  weeklyWindowStart,
} from "../activities/activityMapper.js";
import { activityCache } from "../activities/activityCache.js";
import {
  getActivitySource,
  resolveActivitySource,
} from "../activities/activitySource.js";

export const activityRouter = Router();
activityRouter.use(resolveActivitySource);

function clampInt(value: unknown, fallback: number, min: number, max: number) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (Number.isNaN(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

/** GET /api/activities/recent?limit=10 */
activityRouter.get("/recent", async (req, res) => {
  const source = getActivitySource(res);
  const limit = clampInt(req.query.limit, 10, 1, 50);

  // Over-fetch since non-run activities (rides, swims) are filtered out.
  const activities = await activityCache.getOrFetch(
    source.cacheScope,
    "recent",
    () => source.listRecent(),
  );

  res.json(activities.filter(isRun).slice(0, limit).map(toRunActivity));
});

/** GET /api/activities/weekly-stats?weeks=8 */
activityRouter.get("/weekly-stats", async (req, res) => {
  const source = getActivitySource(res);
  const weeks = clampInt(req.query.weeks, 8, 1, 52);

  const activities = await activityCache.getOrFetch(
    source.cacheScope,
    `weekly:${weeks}`,
    () => source.listSince(weeklyWindowStart(weeks)),
  );

  res.json(aggregateWeeklyStats(activities, weeks));
});
