import type {
  BestEffortActivity,
  BestEffortDistance,
  BestEffortsResponse,
} from "../types/activity";
import { history } from "./mockHistory";

// Keep in sync with backend/src/bestEfforts/bestEfforts.ts.
const DISTANCES: BestEffortDistance[] = [
  { key: "1k", label: "1K", meters: 1000 },
  { key: "1mi", label: "1 mile", meters: 1609.344 },
  { key: "2mi", label: "2 mile", meters: 3218.688 },
  { key: "5k", label: "5K", meters: 5000 },
  { key: "10k", label: "10K", meters: 10000 },
  { key: "10mi", label: "10 mile", meters: 16093.44 },
  { key: "hm", label: "Half marathon", meters: 21097.5 },
  { key: "30k", label: "30K", meters: 30000 },
  { key: "fm", label: "Marathon", meters: 42195 },
  { key: "50k", label: "50K", meters: 50000 },
];

const NAMES = ["Morning Run", "Easy Run", "Tempo Run", "Long Run", "Lunch Run", "Evening Run"];

/**
 * Demo best efforts derived from the mock history: shorter efforts are run
 * a bit faster than the activity's average pace (Riegel-style), with a
 * little deterministic variation.
 */
function buildMockBestEfforts(): BestEffortsResponse {
  const activities: BestEffortActivity[] = history
    .filter((e) => e.distanceM >= DISTANCES[0].meters)
    .map((entry, i) => {
      const avgSpeed = entry.distanceM / entry.movingTimeS;
      const jitter = 1 + ((i * 7919) % 11) / 200;
      const efforts: Record<string, number | null> = {};
      for (const { key, meters } of DISTANCES) {
        efforts[key] =
          meters > entry.distanceM
            ? null
            : Math.round(
                ((meters / avgSpeed) *
                  Math.pow(meters / entry.distanceM, 0.06)) /
                  jitter,
              );
      }
      return {
        id: `mock-${i}`,
        name: NAMES[i % NAMES.length],
        date: entry.date,
        distanceM: entry.distanceM,
        // Demo data has no real activity behind it; point at Strava's home.
        link: { url: "https://www.strava.com/", label: "Strava" },
        efforts,
      };
    })
    .reverse();

  return {
    distances: DISTANCES,
    activities,
    progress: {
      analysed: activities.length,
      total: activities.length,
      running: false,
      rateLimitedUntil: null,
    },
  };
}

export const bestEfforts: BestEffortsResponse = buildMockBestEfforts();
