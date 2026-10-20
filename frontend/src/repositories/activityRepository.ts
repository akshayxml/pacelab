import type {
  ActivityLogEntry,
  RunActivity,
  WeeklyStats,
} from "../types/activity";

export interface ActivityRepository {
  getRecentRuns(): Promise<RunActivity[]>;
  getWeeklyStats(): Promise<WeeklyStats[]>;
  /** The athlete's entire history, all sport types. */
  getHistory(): Promise<ActivityLogEntry[]>;
  /** Already-loaded history, if any, so revisits render without a loading flash. */
  peekHistory(): ActivityLogEntry[] | undefined;
}
