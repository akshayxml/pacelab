import type { ActivityLogEntry, WeeklyStats } from "../types/activity";
import { localIsoDate } from "./yearlyCumulative";

export type MileagePeriod = "week" | "month" | "year";

/** One bar in the mileage chart. */
export interface MileageBar {
  /** Axis label, e.g. "Oct 19", "Oct", "2026". */
  label: string;
  /** Tooltip heading, e.g. "October 2026 (so far)". */
  tooltipLabel: string;
  distanceKm: number;
}

const SO_FAR = " (so far)";

const shortMonth = new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" });
const longMonth = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

const pad = (n: number) => String(n).padStart(2, "0");
const round1 = (km: number) => Math.round(km * 10) / 10;

/** Total km of runs dated within [from, to] (inclusive, YYYY-MM-DD). */
function sumKm(entries: ActivityLogEntry[], from: string, to: string): number {
  let meters = 0;
  for (const e of entries) {
    if (e.date >= from && e.date <= to) meters += e.distanceM;
  }
  return meters / 1000;
}

/** Weekly bars from the backend's weekly stats (current week last). */
export function weeklyMileage(stats: WeeklyStats[]): MileageBar[] {
  return stats.map((week, i) => ({
    label: week.week,
    tooltipLabel: `Week of ${week.week}${i === stats.length - 1 ? SO_FAR : ""}`,
    distanceKm: week.distanceKm,
  }));
}

/** The last `months` calendar months including the current one, oldest first. */
export function monthlyMileage(
  entries: ActivityLogEntry[],
  months = 12,
  now = new Date(),
): MileageBar[] {
  const totals = new Map<string, number>();
  for (const e of entries) {
    const key = e.date.slice(0, 7);
    totals.set(key, (totals.get(key) ?? 0) + e.distanceM / 1000);
  }

  const bars: MileageBar[] = [];
  for (let i = months - 1; i >= 0; i--) {
    // Date.UTC normalises negative months into the previous year.
    const month = new Date(Date.UTC(now.getFullYear(), now.getMonth() - i, 1));
    const key = `${month.getUTCFullYear()}-${pad(month.getUTCMonth() + 1)}`;
    bars.push({
      label: shortMonth.format(month),
      tooltipLabel: longMonth.format(month) + (i === 0 ? SO_FAR : ""),
      distanceKm: round1(totals.get(key) ?? 0),
    });
  }
  return bars;
}

/**
 * Calendar years from the first year with runs to the current one, capped at
 * the last `years` years, oldest first.
 */
export function yearlyMileage(
  entries: ActivityLogEntry[],
  years = 12,
  now = new Date(),
): MileageBar[] {
  const currentYear = now.getFullYear();
  const totals = new Map<number, number>();
  let firstYear = currentYear;
  for (const e of entries) {
    const year = Number(e.date.slice(0, 4));
    if (year < firstYear) firstYear = year;
    totals.set(year, (totals.get(year) ?? 0) + e.distanceM / 1000);
  }

  const bars: MileageBar[] = [];
  for (let year = Math.max(firstYear, currentYear - years + 1); year <= currentYear; year++) {
    bars.push({
      label: String(year),
      tooltipLabel: String(year) + (year === currentYear ? SO_FAR : ""),
      distanceKm: round1(totals.get(year) ?? 0),
    });
  }
  return bars;
}

/**
 * Distance in the previous week, month or year up to the same day as today,
 * so a partly finished period is compared fairly ("vs this time last week").
 * Weeks are Monday-based, matching the weekly stats.
 */
export function previousPeriodToDate(
  entries: ActivityLogEntry[],
  period: MileagePeriod,
  now = new Date(),
): number {
  const [y, m, d] = localIsoDate(now).split("-").map(Number);

  if (period === "week") {
    const iso = (date: Date) => date.toISOString().slice(0, 10);
    const daysSinceMonday = (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
    const start = new Date(Date.UTC(y, m - 1, d - 7 - daysSinceMonday));
    const end = new Date(Date.UTC(y, m - 1, d - 7));
    return sumKm(entries, iso(start), iso(end));
  }

  if (period === "year") {
    return sumKm(entries, `${y - 1}-01-01`, `${y - 1}-${pad(m)}-${pad(d)}`);
  }

  const previous = new Date(Date.UTC(y, m - 2, 1));
  const py = previous.getUTCFullYear();
  const pm = previous.getUTCMonth() + 1;
  // Clamp e.g. Mar 31 to Feb 28.
  const lastDay = new Date(Date.UTC(py, pm, 0)).getUTCDate();
  return sumKm(entries, `${py}-${pad(pm)}-01`, `${py}-${pad(pm)}-${pad(Math.min(d, lastDay))}`);
}
