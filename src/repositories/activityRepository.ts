import type { RunActivity, WeeklyStats } from "../types/activity";

export interface ActivityRepository {
  getRecentRuns(): Promise<RunActivity[]>;
  getWeeklyStats(): Promise<WeeklyStats[]>;
}
