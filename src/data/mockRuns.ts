
import type { RunActivity, WeeklyStats } from "../types/activity";

export const weeklyStats: WeeklyStats[] = [
  { week: "Aug 31", distanceKm: 22, averagePaceMinutes: 5.42 },
  { week: "Sep 7", distanceKm: 27, averagePaceMinutes: 5.36 },
  { week: "Sep 14", distanceKm: 31, averagePaceMinutes: 5.29 },
  { week: "Sep 21", distanceKm: 25, averagePaceMinutes: 5.24 },
  { week: "Sep 28", distanceKm: 34, averagePaceMinutes: 5.19 },
  { week: "Oct 5", distanceKm: 29, averagePaceMinutes: 5.12 },
  { week: "Oct 12", distanceKm: 32, averagePaceMinutes: 5.08 },
  { week: "Oct 19", distanceKm: 30, averagePaceMinutes: 5.03 },
];

export const recentRuns: RunActivity[] = [
  {
    id: "run-1",
    date: "Oct 17",
    name: "Easy morning run",
    distanceKm: 7.2,
    pace: "5:42",
    duration: "41:02",
    averageHeartRate: 142,
    type: "Easy",
    elevationGainM: 38,
  },
  {
    id: "run-2",
    date: "Oct 15",
    name: "Tempo intervals",
    distanceKm: 8.4,
    pace: "4:48",
    duration: "40:19",
    averageHeartRate: 165,
    type: "Tempo",
    elevationGainM: 52,
  },
  {
    id: "run-3",
    date: "Oct 12",
    name: "Weekend long run",
    distanceKm: 12.1,
    pace: "5:38",
    duration: "1:08:10",
    averageHeartRate: 148,
    type: "Long",
    elevationGainM: 74,
  },
  {
    id: "run-4",
    date: "Oct 10",
    name: "Recovery run",
    distanceKm: 5.1,
    pace: "6:02",
    duration: "30:46",
    averageHeartRate: 136,
    type: "Easy",
    elevationGainM: 21,
  },
];
