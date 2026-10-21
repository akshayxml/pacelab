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
  /** Where the run can be opened in its original app (absent for sample data). */
  link?: ActivityLink;
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

/** Minimal per-run record for the yearly progress charts. */
export interface ActivityLogEntry {
  /** Local calendar date, YYYY-MM-DD. */
  date: string;
  movingTimeS: number;
  distanceM: number;
}

export interface BestEffortDistance {
  key: string;
  label: string;
  meters: number;
}

/** Where the activity can be viewed in its original app. */
export interface ActivityLink {
  url: string;
  /** e.g. "Garmin Connect", "Strava", "Intervals.icu". */
  label: string;
}

export interface BestEffortActivity {
  id: string;
  name: string;
  /** Local calendar date, YYYY-MM-DD. */
  date: string;
  distanceM: number;
  link: ActivityLink;
  /** Fastest seconds per distance key; null if the activity was too short. */
  efforts: Record<string, number | null>;
}

export interface BestEffortsResponse {
  distances: BestEffortDistance[];
  activities: BestEffortActivity[];
  progress: {
    analysed: number;
    total: number;
    running: boolean;
    /** ISO time when analysis resumes after an upstream rate limit. */
    rateLimitedUntil: string | null;
  };
}

/** One lap (or device/auto-detected interval) of an activity. */
export interface ActivityLap {
  distanceM: number;
  movingTimeS: number;
  /** null when recorded without a heart-rate monitor. */
  averageHeartRate: number | null;
  /** Metres climbed (never negative); null when the provider doesn't report it. */
  elevationGainM: number | null;
  /** Net change, end minus start (negative when the lap goes downhill); null when unknown. */
  elevationChangeM: number | null;
}
