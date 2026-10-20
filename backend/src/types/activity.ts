// Domain types returned to the frontend.
// Keep in sync with frontend/src/types/activity.ts.

import type { DataProvider } from "../config.js";

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

export interface Athlete {
  id: string;
  firstName: string;
  lastName: string;
  profileImageUrl: string | null;
}

export interface ConnectionStatus {
  provider: DataProvider;
  connected: boolean;
  athlete: Athlete | null;
}

/**
 * Minimal per-activity record (all sport types) for the yearly progress
 * charts. Kept small because the athlete's full history is sent at once.
 */
export interface ActivityLogEntry {
  /** Local calendar date, YYYY-MM-DD. */
  date: string;
  /** e.g. "Run", "Ride", "WeightTraining". */
  sportType: string;
  movingTimeS: number;
  distanceM: number;
}

/**
 * Provider-agnostic activity shape. Each provider client normalizes its raw
 * API response into this before mapping to RunActivity / WeeklyStats.
 */
export interface SourceActivity {
  id: string;
  name: string;
  /**
   * Local wall-clock start time as ISO-8601. May or may not carry a "Z"
   * suffix depending on provider; either way it represents local time.
   */
  startDateLocal: string;
  /** e.g. "Run", "TrailRun", "VirtualRun", "Ride". */
  sportType: string;
  distanceM: number;
  movingTimeS: number;
  elevationGainM: number;
  averageHeartRate: number | null;
  isRace: boolean;
  isLongRun: boolean;
  isWorkout: boolean;
}
