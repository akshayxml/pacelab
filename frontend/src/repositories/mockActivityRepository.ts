import { recentRuns, weeklyStats } from "../data/mockRuns";
import { bestEfforts } from "../data/mockBestEfforts";
import { history } from "../data/mockHistory";
import type { ActivityLap } from "../types/activity";
import type { ActivityRepository } from "./activityRepository";

/** Sample 1 km laps (plus a partial last lap) with a little pace variation. */
function mockLaps(activityId: string): ActivityLap[] {
  const distanceM =
    (recentRuns.find((r) => r.id === activityId)?.distanceKm ?? 0) * 1000 ||
    bestEfforts.activities.find((a) => a.id === activityId)?.distanceM ||
    5000;

  const laps: ActivityLap[] = [];
  for (let start = 0, i = 0; start < distanceM; start += 1000, i++) {
    const lapM = Math.min(1000, distanceM - start);
    const paceS = 320 + Math.round(Math.sin(i * 1.7) * 12) - i; // ~5:20/km, slight negative split
    const changeM = Math.round(Math.sin(i * 1.3) * 9 * (lapM / 1000)); // rolling hills
    laps.push({
      distanceM: lapM,
      movingTimeS: Math.round((paceS * lapM) / 1000),
      averageHeartRate: 145 + Math.min(i * 2, 20),
      elevationGainM: Math.max(changeM, 0) + Math.round(Math.abs(Math.cos(i)) * 3),
      elevationChangeM: changeM,
    });
  }
  return laps;
}

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

  async getLaps(activityId) {
    return mockLaps(activityId);
  },
};
