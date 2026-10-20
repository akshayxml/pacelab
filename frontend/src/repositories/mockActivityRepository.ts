import { recentRuns, weeklyStats } from "../data/mockRuns";
import { history } from "../data/mockHistory";
import type { ActivityRepository } from "./activityRepository";

export const mockActivityRepository: ActivityRepository = {
  async getRecentRuns() {
    return recentRuns;
  },

  async getWeeklyStats() {
    return weeklyStats;
  },

  async getHistory() {
    return history;
  },

  peekHistory() {
    return history;
  },
};
