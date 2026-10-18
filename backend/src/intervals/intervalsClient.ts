import { intervalsConfig } from "../config.js";
import { UpstreamApiError } from "../errors.js";
import type { Athlete, SourceActivity } from "../types/activity.js";
import type {
  IntervalsActivity,
  IntervalsAthlete,
} from "../types/intervals.js";

const INTERVALS_API_URL = "https://intervals.icu/api/v1";

export class IntervalsApiError extends UpstreamApiError {
  constructor(status: number, message: string) {
    super("intervals", status, message);
    this.name = "IntervalsApiError";
  }
}

function authHeader(): string {
  // Personal API keys use HTTP Basic auth with the literal username "API_KEY".
  const token = Buffer.from(`API_KEY:${intervalsConfig().apiKey}`).toString(
    "base64",
  );
  return `Basic ${token}`;
}

async function apiGet<T>(
  path: string,
  query?: Record<string, string | undefined>,
): Promise<T> {
  const url = new URL(`${INTERVALS_API_URL}${path}`);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined) url.searchParams.set(key, value);
  }

  const response = await fetch(url, {
    headers: { Authorization: authHeader(), Accept: "application/json" },
  });

  if (!response.ok) {
    throw new IntervalsApiError(
      response.status,
      `Intervals.icu API ${path} failed (${response.status}): ${await response.text()}`,
    );
  }
  return (await response.json()) as T;
}

/** YYYY-MM-DD for a Unix timestamp (seconds). */
function toIsoDate(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toISOString().slice(0, 10);
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
    // Intervals.icu has no long-run/workout flag; the mapper falls back to
    // distance and name heuristics.
    isLongRun: false,
    isWorkout: false,
  };
}

export async function getAthlete(): Promise<Athlete> {
  const athlete = await apiGet<IntervalsAthlete>(
    `/athlete/${intervalsConfig().athleteId}`,
  );
  const [first = "", ...rest] = (athlete.name ?? "").split(" ");

  return {
    id: athlete.id,
    firstName: athlete.firstname ?? first,
    lastName: athlete.lastname ?? rest.join(" "),
    profileImageUrl: athlete.profile_medium ?? null,
  };
}

/**
 * Lists activities whose start date is on/after `after` (Unix seconds),
 * newest first.
 */
export async function listActivities(after: number): Promise<SourceActivity[]> {
  const now = Math.floor(Date.now() / 1000);
  const raw = await apiGet<IntervalsActivity[]>(
    `/athlete/${intervalsConfig().athleteId}/activities`,
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
