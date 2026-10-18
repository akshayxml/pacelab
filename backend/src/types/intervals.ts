// Subset of Intervals.icu API response shapes that PaceLab uses.
// Reference: https://intervals.icu/api-docs.html
// Fields are optional because activities synced from Strava are returned as
// stubs (Strava's API terms prevent Intervals.icu from re-sharing them).

export interface IntervalsActivity {
  id: string;
  name?: string | null;
  /** Local wall-clock time without timezone, e.g. "2026-10-17T07:05:12". */
  start_date_local?: string | null;
  type?: string | null;
  /** Meters. */
  distance?: number | null;
  /** Seconds. */
  moving_time?: number | null;
  elapsed_time?: number | null;
  /** Meters. */
  total_elevation_gain?: number | null;
  average_heartrate?: number | null;
  /** e.g. "GARMIN_CONNECT", "STRAVA", "UPLOAD". */
  source?: string | null;
  /** True if the athlete marked this activity as a race. */
  race?: boolean | null;
}

export interface IntervalsAthlete {
  id: string;
  name?: string | null;
  firstname?: string | null;
  lastname?: string | null;
  profile_medium?: string | null;
}
