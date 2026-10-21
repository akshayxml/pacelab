import type { ActivityLogEntry } from "../types/activity";
import { localIsoDate } from "./yearlyCumulative";

const iso = (date: Date) => date.toISOString().slice(0, 10);

/** Today's local date as UTC-midnight parts, for calendar arithmetic. */
function todayParts(now: Date): [number, number, number] {
  const [y, m, d] = localIsoDate(now).split("-").map(Number);
  return [y, m, d];
}

/** Total km of runs from the start of the current month/year through today. */
export function periodToDateKm(
  entries: ActivityLogEntry[],
  period: "month" | "year",
  now = new Date(),
): number {
  const prefix = localIsoDate(now).slice(0, period === "month" ? 7 : 4);
  let meters = 0;
  for (const e of entries) {
    if (e.date.startsWith(prefix)) meters += e.distanceM;
  }
  return meters / 1000;
}

/**
 * Longest single run in the last `days` days (including today), and in the
 * `days` days before that. Distances are in km; 0 when there were no runs.
 */
export function longestRuns(
  entries: ActivityLogEntry[],
  days = 28,
  now = new Date(),
): { currentKm: number; previousKm: number } {
  const [y, m, d] = todayParts(now);
  const currentStart = iso(new Date(Date.UTC(y, m - 1, d - days + 1)));
  const previousStart = iso(new Date(Date.UTC(y, m - 1, d - 2 * days + 1)));
  const today = iso(new Date(Date.UTC(y, m - 1, d)));

  let current = 0;
  let previous = 0;
  for (const e of entries) {
    if (e.date >= currentStart && e.date <= today) current = Math.max(current, e.distanceM);
    else if (e.date >= previousStart && e.date < currentStart) {
      previous = Math.max(previous, e.distanceM);
    }
  }
  return { currentKm: current / 1000, previousKm: previous / 1000 };
}
