import { stravaConfig } from "../config.js";
import { UpstreamApiError } from "../errors.js";
import type { ActivityLap, DistanceStream, SourceActivity } from "../types/activity.js";
import type {
  StravaLap,
  StravaSummaryActivity,
  StravaTokenResponse,
} from "../types/strava.js";

const STRAVA_OAUTH_URL = "https://www.strava.com/oauth";
const STRAVA_API_URL = "https://www.strava.com/api/v3";

export class StravaApiError extends UpstreamApiError {
  constructor(status: number, message: string) {
    super("strava", status, message);
    this.name = "StravaApiError";
  }
}

export function buildAuthorizeUrl(state: string): string {
  const { clientId, redirectUri, scope } = stravaConfig();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    approval_prompt: "auto",
    scope,
    state,
  });
  return `${STRAVA_OAUTH_URL}/authorize?${params}`;
}

async function postToken(
  body: Record<string, string>,
): Promise<StravaTokenResponse> {
  const { clientId, clientSecret } = stravaConfig();
  const response = await fetch(`${STRAVA_OAUTH_URL}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      ...body,
    }),
  });

  if (!response.ok) {
    throw new StravaApiError(
      response.status,
      `Strava token request failed: ${await response.text()}`,
    );
  }
  return (await response.json()) as StravaTokenResponse;
}

export function exchangeCodeForToken(code: string) {
  return postToken({ code, grant_type: "authorization_code" });
}

export function refreshAccessToken(refreshToken: string) {
  return postToken({ refresh_token: refreshToken, grant_type: "refresh_token" });
}

export async function deauthorize(accessToken: string): Promise<void> {
  await fetch(`${STRAVA_OAUTH_URL}/deauthorize`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

async function apiGet<T>(
  accessToken: string,
  path: string,
  query?: Record<string, string | number | undefined>,
): Promise<T> {
  const url = new URL(`${STRAVA_API_URL}${path}`);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new StravaApiError(
      response.status,
      `Strava API ${path} failed (${response.status}): ${await response.text()}`,
    );
  }
  return (await response.json()) as T;
}

export function toSourceActivity(activity: StravaSummaryActivity): SourceActivity {
  return {
    id: String(activity.id),
    name: activity.name,
    startDateLocal: activity.start_date_local,
    sportType: activity.sport_type ?? activity.type,
    distanceM: activity.distance,
    movingTimeS: activity.moving_time,
    elevationGainM: activity.total_elevation_gain,
    averageHeartRate:
      activity.has_heartrate && activity.average_heartrate != null
        ? activity.average_heartrate
        : null,
    // Strava run workout_type: 0 = default, 1 = race, 2 = long run, 3 = workout.
    isRace: activity.workout_type === 1,
    isLongRun: activity.workout_type === 2,
    isWorkout: activity.workout_type === 3,
    link: {
      url: `https://www.strava.com/activities/${activity.id}`,
      label: "Strava",
    },
  };
}

export interface ListActivitiesOptions {
  /** Unix seconds; only activities after this time. */
  after?: number;
  /** Unix seconds; only activities before this time. */
  before?: number;
  page?: number;
  /** Max 200. */
  perPage?: number;
}

export async function listAthleteActivities(
  accessToken: string,
  { after, before, page = 1, perPage = 100 }: ListActivitiesOptions = {},
): Promise<SourceActivity[]> {
  const raw = await apiGet<StravaSummaryActivity[]>(
    accessToken,
    "/athlete/activities",
    { after, before, page, per_page: perPage },
  );
  return raw.map(toSourceActivity);
}

/**
 * Fetches every page within the time window, up to `maxPages` x 200
 * activities. Each page costs one request against Strava's rate limit.
 */
export async function listAllAthleteActivities(
  accessToken: string,
  {
    maxPages = 10,
    ...options
  }: Omit<ListActivitiesOptions, "page" | "perPage"> & { maxPages?: number } = {},
): Promise<SourceActivity[]> {
  const perPage = 200;
  const all: SourceActivity[] = [];

  for (let page = 1; page <= maxPages; page++) {
    const batch = await listAthleteActivities(accessToken, {
      ...options,
      page,
      perPage,
    });
    all.push(...batch);
    if (batch.length < perPage) break;
  }
  return all;
}

/**
 * Time + distance streams for one activity, or null when the activity has
 * no distance data. Costs one request against the rate limit.
 */
export async function getDistanceStream(
  accessToken: string,
  activityId: string,
): Promise<DistanceStream | null> {
  let streams: Partial<Record<"time" | "distance", { data: number[] }>>;
  try {
    streams = await apiGet(
      accessToken,
      `/activities/${encodeURIComponent(activityId)}/streams`,
      { keys: "time,distance", key_by_type: "true" },
    );
  } catch (err) {
    if (err instanceof StravaApiError && err.status === 404) return null;
    throw err;
  }

  const time = streams.time?.data;
  const distance = streams.distance?.data;
  if (!time?.length || !distance?.length) return null;
  return { time, distance };
}

/** Altitude samples for one activity, or null when it has none (e.g. treadmill). */
async function getAltitudeStream(
  accessToken: string,
  activityId: string,
): Promise<number[] | null> {
  let streams: Partial<Record<"altitude", { data: number[] }>>;
  try {
    streams = await apiGet(
      accessToken,
      `/activities/${encodeURIComponent(activityId)}/streams`,
      { keys: "altitude", key_by_type: "true" },
    );
  } catch (err) {
    if (err instanceof StravaApiError && err.status === 404) return null;
    throw err;
  }
  const altitude = streams.altitude?.data;
  return altitude?.length ? altitude : null;
}

/** Mean altitude over a few samples around `index`, to damp sensor noise. */
function altitudeAt(altitude: number[], index: number): number {
  const from = Math.max(0, Math.min(index, altitude.length - 1) - 2);
  const to = Math.min(altitude.length - 1, from + 4);
  let sum = 0;
  for (let i = from; i <= to; i++) sum += altitude[i];
  return sum / (to - from + 1);
}

/**
 * Laps for one activity. Strava laps only report elevation gain, so the net
 * (signed) change comes from the altitude stream. Costs two requests
 * against the rate limit.
 */
export async function getLaps(
  accessToken: string,
  activityId: string,
): Promise<ActivityLap[]> {
  let laps: StravaLap[];
  let altitude: number[] | null;
  try {
    [laps, altitude] = await Promise.all([
      apiGet<StravaLap[]>(accessToken, `/activities/${encodeURIComponent(activityId)}/laps`),
      getAltitudeStream(accessToken, activityId),
    ]);
  } catch (err) {
    if (err instanceof StravaApiError && err.status === 404) return [];
    throw err;
  }
  return laps
    .filter((l) => l.distance > 0 && l.moving_time > 0)
    .map((l) => ({
      distanceM: l.distance,
      movingTimeS: l.moving_time,
      averageHeartRate: l.average_heartrate ?? null,
      elevationGainM: l.total_elevation_gain ?? null,
      elevationChangeM: altitude
        ? altitudeAt(altitude, l.end_index) - altitudeAt(altitude, l.start_index)
        : null,
    }));
}
