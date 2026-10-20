// Keep in sync with backend/src/types/activity.ts.

export type RunType = "Easy" | "Tempo" | "Long" | "Intervals" | "Race";

export interface RunActivity {
  id: string;
  date: string;
  name: string;
  distanceKm: number;
  pace: string;
  duration: string;
  /** null when the activity was recorded without a heart-rate monitor. */
  averageHeartRate: number | null;
  type: RunType;
  elevationGainM: number;
}

export interface WeeklyStats {
  week: string;
  distanceKm: number;
  /** null for weeks with no runs. */
  averagePaceMinutes: number | null;
}

export type DataProvider = "strava" | "intervals";

export interface Athlete {
  id: string;
  firstName: string;
  lastName: string;
  profileImageUrl: string | null;
}

/** Minimal per-activity record (all sport types) for the yearly progress charts. */
export interface ActivityLogEntry {
  /** Local calendar date, YYYY-MM-DD. */
  date: string;
  /** e.g. "Run", "Ride", "WeightTraining". */
  sportType: string;
  movingTimeS: number;
  distanceM: number;
}
