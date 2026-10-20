import type { ActivityLogEntry } from "../types/activity";

const YEARS = 5;

/** Weekly run template: [minMinutes, maxMinutes, chance per week, km/h]. */
const WEEKLY_PLAN: [number, number, number, number][] = [
  [30, 55, 1, 10.5], // easy
  [35, 60, 0.9, 11], // tempo / intervals
  [70, 120, 0.8, 10], // long run
  [25, 40, 0.4, 10.5], // optional recovery
];

/** Small deterministic PRNG so demo data is stable across reloads. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildMockHistory(now = new Date()): ActivityLogEntry[] {
  const random = mulberry32(42);
  const entries: ActivityLogEntry[] = [];
  const firstYear = now.getFullYear() - YEARS + 1;
  const today = now.toISOString().slice(0, 10);

  for (
    let week = new Date(Date.UTC(firstYear, 0, 1));
    week.toISOString().slice(0, 10) <= today;
    week.setUTCDate(week.getUTCDate() + 7)
  ) {
    // Later years train a bit more, so the lines visibly diverge.
    const yearBoost = 1 + (week.getUTCFullYear() - firstYear) * 0.12;

    for (const [min, max, chance, kmh] of WEEKLY_PLAN) {
      if (random() > chance) continue;
      const day = new Date(week);
      day.setUTCDate(day.getUTCDate() + Math.floor(random() * 7));
      const date = day.toISOString().slice(0, 10);
      if (date > today) continue;

      const minutes = (min + random() * (max - min)) * yearBoost;
      const distanceM = Math.round((minutes / 60) * kmh * (0.9 + random() * 0.2) * 1000);
      entries.push({
        date,
        movingTimeS: Math.round(minutes * 60),
        distanceM,
      });
    }
  }
  return entries;
}

export const history: ActivityLogEntry[] = buildMockHistory();
