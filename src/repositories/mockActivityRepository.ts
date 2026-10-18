import { recentRuns, weeklyStats } from "../data/mockRuns";
import type { ActivityRepository } from "./activityRepository";

export const mockActivityRepository: ActivityRepository = {
  async getRecentRuns() {
    return recentRuns;
  },

  async getWeeklyStats() {
    return weeklyStats;
  },
};
