import { apiClient } from "../api/apiClient";
import type { RunActivity, WeeklyStats } from "../types/activity";
import type { ActivityRepository } from "./activityRepository";

const RECENT_RUNS_LIMIT = 10;
const WEEKLY_STATS_WEEKS = 8;

export const apiActivityRepository: ActivityRepository = {
  getRecentRuns() {
    return apiClient.get<RunActivity[]>(
      `/api/activities/recent?limit=${RECENT_RUNS_LIMIT}`,
    );
  },

  getWeeklyStats() {
    return apiClient.get<WeeklyStats[]>(
      `/api/activities/weekly-stats?weeks=${WEEKLY_STATS_WEEKS}`,
    );
  },
};
