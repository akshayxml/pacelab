import type { NextFunction, Request, Response } from "express";
import { config } from "../config.js";
import { getAuth, requireStravaSession } from "../auth/requireStravaSession.js";
import * as intervals from "../intervals/intervalsClient.js";
import * as strava from "../strava/stravaClient.js";
import type { SourceActivity } from "../types/activity.js";

const RECENT_WINDOW_DAYS = 90;
/** Full-history cap for Strava: 25 pages x 200 = 5,000 activities. */
const STRAVA_HISTORY_MAX_PAGES = 25;

/** Uniform read interface over each provider. */
export interface ActivitySource {
  /** Cache namespace (per-session for Strava, global for Intervals). */
  cacheScope: string;
  /** Most recent activities, newest first. */
  listRecent(): Promise<SourceActivity[]>;
  /** All activities since `after` (Unix seconds). */
  listSince(after: number): Promise<SourceActivity[]>;
  /** The athlete's entire activity history. */
  listAll(): Promise<SourceActivity[]>;
}

function stravaSource(sessionId: string, accessToken: string): ActivitySource {
  return {
    cacheScope: sessionId,
    listRecent: () => strava.listAthleteActivities(accessToken, { perPage: 100 }),
    listSince: (after) => strava.listAllAthleteActivities(accessToken, { after }),
    listAll: () =>
      strava.listAllAthleteActivities(accessToken, {
        maxPages: STRAVA_HISTORY_MAX_PAGES,
      }),
  };
}

const intervalsSource: ActivitySource = {
  cacheScope: "intervals",
  listRecent: () =>
    intervals.listActivities(
      Math.floor(Date.now() / 1000) - RECENT_WINDOW_DAYS * 86_400,
    ),
  listSince: (after) => intervals.listActivities(after),
  listAll: () => intervals.listActivities(0),
};

export function getActivitySource(res: Response): ActivitySource {
  return res.locals.activitySource as ActivitySource;
}

/**
 * Resolves the configured provider into an ActivitySource on res.locals.
 * Strava requires a user session; Intervals.icu uses the server's API key.
 */
export function resolveActivitySource(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (config.provider === "intervals") {
    res.locals.activitySource = intervalsSource;
    next();
    return;
  }

  void requireStravaSession(req, res, () => {
    const { sessionId, session } = getAuth(res);
    res.locals.activitySource = stravaSource(sessionId, session.accessToken);
    next();
  });
}
