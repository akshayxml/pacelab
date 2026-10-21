// Intervals.icu API client for the browser. Intervals.icu allows CORS from
// any origin, so the static app calls it directly with the user's API key.
// Ported from backend/src/intervals/intervalsClient.ts; keep in sync.

import { ApiError } from "../api/apiClient";
import type { ActivityLap, ActivityLink, Athlete } from "../types/activity";
import type {
  DistanceStream,
  IntervalsActivity,
  IntervalsAthlete,
  IntervalsInterval,
  SourceActivity,
} from "./types";

const API_URL = "https://intervals.icu/api/v1";
/** "0" means "the athlete that owns the API key". */
const ATHLETE_ID = "0";
/** Give up on a hung request instead of leaving the UI loading forever. */
const TIMEOUT_MS = 30_000;

function authHeader(apiKey: string): string {
  // Personal API keys use HTTP Basic auth with the literal username "API_KEY".
  // btoa throws on non-Latin-1 input; real keys are plain ASCII.
  try {
    return `Basic ${btoa(`API_KEY:${apiKey}`)}`;
  } catch {
    throw new ApiError(401, "invalid_api_key");
  }
}

async function apiGet<T>(
  apiKey: string,
  path: string,
  query?: Record<string, string>,
): Promise<T> {
  const url = new URL(`${API_URL}${path}`);
  for (const [key, value] of Object.entries(query ?? {})) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url, {
    headers: { Authorization: authHeader(apiKey), Accept: "application/json" },
    // The API key is the only credential; never send cookies or a referrer.
    credentials: "omit",
    referrerPolicy: "no-referrer",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new ApiError(response.status, `intervals_${response.status}`);
  }
  return (await response.json()) as T;
}

/** YYYY-MM-DD for a Unix timestamp (seconds). */
function toIsoDate(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toISOString().slice(0, 10);
}

/**
 * Best link to the original activity: Garmin Connect or Strava when we can
 * identify it, otherwise the Intervals.icu page (which links onward).
 */
function activityLink(activity: IntervalsActivity): ActivityLink {
  const externalId = activity.external_id?.trim();
  if (activity.source === "GARMIN_CONNECT" && externalId && /^\d+$/.test(externalId)) {
    return {
      url: `https://connect.garmin.com/modern/activity/${externalId}`,
      label: "Garmin Connect",
    };
  }
  const stravaId = activity.strava_id != null ? String(activity.strava_id) : "";
  if (/^\d+$/.test(stravaId)) {
    return { url: `https://www.strava.com/activities/${stravaId}`, label: "Strava" };
  }
  return {
    url: `https://intervals.icu/activities/${encodeURIComponent(activity.id)}`,
    label: "Intervals.icu",
  };
}

function toSourceActivity(activity: IntervalsActivity): SourceActivity | null {
  // Strava-synced activities come back as stubs without metrics; skip them.
  if (
    !activity.start_date_local ||
    activity.distance == null ||
    activity.moving_time == null
  ) {
    return null;
  }

  return {
    id: activity.id,
    name: activity.name ?? "Untitled activity",
    startDateLocal: activity.start_date_local,
    sportType: activity.type ?? "Unknown",
    distanceM: activity.distance,
    movingTimeS: activity.moving_time,
    elevationGainM: activity.total_elevation_gain ?? 0,
    averageHeartRate: activity.average_heartrate ?? null,
    isRace: activity.race === true,
    link: activityLink(activity),
  };
}

export async function getAthlete(apiKey: string): Promise<Athlete> {
  const athlete = await apiGet<IntervalsAthlete>(apiKey, `/athlete/${ATHLETE_ID}`);
  const [first = "", ...rest] = (athlete.name ?? "").split(" ");

  return {
    id: athlete.id,
    firstName: athlete.firstname ?? first,
    lastName: athlete.lastname ?? rest.join(" "),
    profileImageUrl: athlete.profile_medium ?? null,
  };
}

/** Activities starting on/after `after` (Unix seconds), newest first. */
export async function listActivities(
  apiKey: string,
  after: number,
): Promise<SourceActivity[]> {
  const now = Math.floor(Date.now() / 1000);
  const raw = await apiGet<IntervalsActivity[]>(
    apiKey,
    `/athlete/${ATHLETE_ID}/activities`,
    {
      oldest: toIsoDate(after),
      // Pad a day so activities later today (in any timezone) are included.
      newest: toIsoDate(now + 86_400),
    },
  );

  return raw
    .map(toSourceActivity)
    .filter((a): a is SourceActivity => a !== null)
    .sort((a, b) => b.startDateLocal.localeCompare(a.startDateLocal));
}

/**
 * Time + distance streams for one activity, or null when the activity has
 * no distance data (e.g. gym sessions, manual entries).
 */
export async function getDistanceStream(
  apiKey: string,
  activityId: string,
): Promise<DistanceStream | null> {
  let streams: { type: string; data: (number | null)[] | null }[];
  try {
    streams = await apiGet(apiKey, `/activity/${encodeURIComponent(activityId)}/streams`, {
      types: "time,distance",
    });
  } catch (err) {
    if (err instanceof ApiError && (err.status === 404 || err.status === 422)) {
      return null;
    }
    throw err;
  }

  const time = streams.find((s) => s.type === "time")?.data;
  const distance = streams.find((s) => s.type === "distance")?.data;
  if (!time?.length || !distance?.length) return null;
  return {
    time: time.map((v) => v ?? 0),
    distance: distance.map((v) => v ?? 0),
  };
}

/**
 * Laps for one activity. Intervals.icu reports them as `icu_intervals`
 * (device laps, or auto-detected intervals when the athlete re-analysed).
 */
export async function getLaps(apiKey: string, activityId: string): Promise<ActivityLap[]> {
  let activity: { icu_intervals?: IntervalsInterval[] | null };
  try {
    activity = await apiGet(apiKey, `/activity/${encodeURIComponent(activityId)}`, {
      intervals: "true",
    });
  } catch (err) {
    if (err instanceof ApiError && (err.status === 404 || err.status === 422)) return [];
    throw err;
  }
  return (activity.icu_intervals ?? [])
    .filter((i) => (i.distance ?? 0) > 0 && (i.moving_time ?? i.elapsed_time ?? 0) > 0)
    .map((i) => ({
      distanceM: i.distance ?? 0,
      movingTimeS: i.moving_time ?? i.elapsed_time ?? 0,
      averageHeartRate: i.average_heartrate ?? null,
      elevationGainM: i.total_elevation_gain ?? null,
    }));
}
