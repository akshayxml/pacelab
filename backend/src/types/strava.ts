// Subset of Strava API v3 response shapes that PaceLab uses.
// Reference: https://developers.strava.com/docs/reference/

export interface StravaSummaryAthlete {
  id: number;
  firstname: string;
  lastname: string;
  profile?: string;
  profile_medium?: string;
}

export interface StravaTokenResponse {
  token_type: "Bearer";
  access_token: string;
  refresh_token: string;
  /** Unix timestamp (seconds). */
  expires_at: number;
  expires_in: number;
  /** Only present on the initial authorization_code exchange. */
  athlete?: StravaSummaryAthlete;
}

export interface StravaSummaryActivity {
  id: number;
  name: string;
  /** Meters. */
  distance: number;
  /** Seconds. */
  moving_time: number;
  /** Seconds. */
  elapsed_time: number;
  /** Meters. */
  total_elevation_gain: number;
  type: string;
  sport_type: string;
  /** For runs: 0 = default, 1 = race, 2 = long run, 3 = workout. */
  workout_type?: number | null;
  start_date: string;
  start_date_local: string;
  timezone: string;
  /** Meters per second. */
  average_speed: number;
  max_speed: number;
  has_heartrate: boolean;
  average_heartrate?: number;
  max_heartrate?: number;
}

/** Subset of a Strava lap (GET /activities/{id}/laps). */
export interface StravaLap {
  /** Meters. */
  distance: number;
  /** Seconds. */
  moving_time: number;
  average_heartrate?: number | null;
  total_elevation_gain?: number | null;
}
