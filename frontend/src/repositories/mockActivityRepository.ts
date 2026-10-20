import { recentRuns, weeklyStats } from "../data/mockRuns";
import { bestEfforts } from "../data/mockBestEfforts";
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

  async getBestEfforts() {
    return bestEfforts;
  },

  peekBestEfforts() {
    return bestEfforts;
  },
};
