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
  /**
   * ID in the source system. For Garmin Connect this is usually the numeric
   * activity ID, but can be a file name (which may contain the user's email).
   */
  external_id?: string | null;
  strava_id?: string | number | null;
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

/** Subset of one entry in `icu_intervals` (GET /activity/{id}?intervals=true). */
export interface IntervalsInterval {
  /** Meters. */
  distance?: number | null;
  /** Seconds. */
  moving_time?: number | null;
  elapsed_time?: number | null;
  average_heartrate?: number | null;
  total_elevation_gain?: number | null;
  /** Net climb over distance as a fraction, e.g. -0.019 = -1.9% (downhill). */
  average_gradient?: number | null;
}
