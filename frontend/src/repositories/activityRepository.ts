import type {
  ActivityLogEntry,
  BestEffortsResponse,
  RunActivity,
  WeeklyStats,
} from "../types/activity";

export interface ActivityRepository {
  getRecentRuns(): Promise<RunActivity[]>;
  getWeeklyStats(): Promise<WeeklyStats[]>;
  /** Every run in the athlete's history (road, trail, virtual...). */
  getHistory(): Promise<ActivityLogEntry[]>;
  /** Already-loaded history, if any, so revisits render without a loading flash. */
  peekHistory(): ActivityLogEntry[] | undefined;
  /** Best efforts per run; may be partial while the backend analyses. */
  getBestEfforts(): Promise<BestEffortsResponse>;
  /** Last complete best-efforts result, if any. */
  peekBestEfforts(): BestEffortsResponse | undefined;
}
