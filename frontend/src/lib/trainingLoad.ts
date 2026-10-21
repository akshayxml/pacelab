import type { ActivityLogEntry } from "../types/activity";
import { localIsoDate } from "./yearlyCumulative";

/** One day in the training load chart. */
export interface TrainingLoadPoint {
  /** Axis label, e.g. "Oct 21". */
  label: string;
  /** Tooltip heading, e.g. "Wed, Oct 21". */
  tooltipLabel: string;
  /** Distance over the last 7 days (acute load). */
  acuteKm: number;
  /** Average weekly distance over the last 28 days (chronic load). */
  chronicKm: number;
  /** acute / chronic, or null when there's no chronic base yet. */
  ratio: number | null;
}

export type LoadZone = "low" | "optimal" | "caution" | "high";

const shortDay = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});
const longDay = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

const round1 = (km: number) => Math.round(km * 10) / 10;

/**
 * Daily acute (7-day) and chronic (28-day, per week) distance for the last
 * `days` days, oldest first.
 */
export function trainingLoad(
  entries: ActivityLogEntry[],
  days = 84,
  now = new Date(),
): TrainingLoadPoint[] {
  const kmByDate = new Map<string, number>();
  for (const e of entries) {
    kmByDate.set(e.date, (kmByDate.get(e.date) ?? 0) + e.distanceM / 1000);
  }

  const [y, m, d] = localIsoDate(now).split("-").map(Number);
  // Include 27 extra leading days so the first point has a full 28-day window.
  const total = days + 27;
  const dates: Date[] = [];
  const prefix = [0];
  for (let i = total - 1; i >= 0; i--) {
    const date = new Date(Date.UTC(y, m - 1, d - i));
    dates.push(date);
    const km = kmByDate.get(date.toISOString().slice(0, 10)) ?? 0;
    prefix.push(prefix[prefix.length - 1] + km);
  }
  const windowKm = (end: number, length: number) => prefix[end + 1] - prefix[end + 1 - length];

  const points: TrainingLoadPoint[] = [];
  for (let i = 27; i < total; i++) {
    const acute = windowKm(i, 7);
    const chronic = windowKm(i, 28) / 4;
    points.push({
      label: shortDay.format(dates[i]),
      tooltipLabel: longDay.format(dates[i]),
      acuteKm: round1(acute),
      chronicKm: round1(chronic),
      ratio: chronic > 0 ? Math.round((acute / chronic) * 100) / 100 : null,
    });
  }
  return points;
}

/** Commonly used acute:chronic workload ratio bands (upper bounds). */
export const ZONE_BOUNDS = { low: 0.8, optimal: 1.3, caution: 1.5 } as const;

export const LOAD_ZONE_LABELS: Record<LoadZone, string> = {
  low: "Detraining",
  optimal: "Sweet spot",
  caution: "Ramping up fast",
  high: "High injury risk",
};

export function loadZone(ratio: number): LoadZone {
  if (ratio < ZONE_BOUNDS.low) return "low";
  if (ratio <= ZONE_BOUNDS.optimal) return "optimal";
  if (ratio <= ZONE_BOUNDS.caution) return "caution";
  return "high";
}
