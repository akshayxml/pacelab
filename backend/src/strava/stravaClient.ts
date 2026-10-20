import { stravaConfig } from "../config.js";
import { UpstreamApiError } from "../errors.js";
import type { SourceActivity } from "../types/activity.js";
import type {
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
