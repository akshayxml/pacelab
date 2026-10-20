import type { ActivityLogEntry } from "../types/activity";

/** One row per day of year; one column per year (keyed by "2025" etc.). */
export type CumulativeRow = { day: number } & Record<string, number | null>;

/** Day-of-year (1-based) of each month start in a non-leap year. */
export const MONTH_TICKS = [1, 32, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335];
const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/**
 * Newest year first: current year in violet, the next five in distinct hues
 * (blue, orange, pink, green, yellow); the 7th year and older in muted grey.
 */
const RECENT_YEAR_COLORS = [
  "var(--chart-bar)",
  "var(--year-2)",
  "var(--year-3)",
  "var(--year-4)",
  "var(--year-5)",
  "var(--year-6)",
];

export function yearStyle(index: number) {
  const recent = index < RECENT_YEAR_COLORS.length;
  return {
    color: recent ? RECENT_YEAR_COLORS[index] : "var(--year-old)",
    width: index === 0 ? 2.75 : recent ? 1.75 : 1.25,
    opacity: recent ? 1 : 0.7,
  };
}

/** Local calendar date as YYYY-MM-DD (not UTC, unlike toISOString). */
export function localIsoDate(date: Date): string {
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${m}-${d}`;
}

export function dayOfYear(isoDate: string): number {
  const [y, m, d] = isoDate.split("-").map(Number);
  return (Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 1)) / 86_400_000 + 1;
}

export function formatDay(day: number): string {
  const date = new Date(Date.UTC(2001, 0, day));
  return `${MONTH_NAMES[date.getUTCMonth()]} ${date.getUTCDate()}`;
}

export function formatMonthTick(day: number): string {
  return formatDay(day).split(" ")[0];
}

/**
 * Running totals of `valueOf(entry)` per year, day by day. The current year
 * stops at today so its line doesn't flatline into the future.
 */
export function buildCumulativeRows(
  entries: ActivityLogEntry[],
  years: number[],
  valueOf: (entry: ActivityLogEntry) => number,
  now = new Date(),
): CumulativeRow[] {
  const daily = new Map(years.map((y) => [y, new Float64Array(367)]));
  for (const entry of entries) {
    const bucket = daily.get(Number(entry.date.slice(0, 4)));
    if (bucket) bucket[dayOfYear(entry.date)] += valueOf(entry);
  }

  const currentYear = now.getFullYear();
  const today = dayOfYear(localIsoDate(now));
  const totals = new Map(years.map((y) => [y, 0]));
  const rows: CumulativeRow[] = [];

  for (let day = 1; day <= 366; day++) {
    const row = { day } as CumulativeRow;
    for (const year of years) {
      const total = totals.get(year)! + daily.get(year)![day];
      totals.set(year, total);
      row[String(year)] =
        year === currentYear && day > today ? null : Math.round(total * 10) / 10;
    }
    rows.push(row);
  }
  return rows;
}

/** Last non-null value for a year (year total, or year-to-date). */
export function finalValue(rows: CumulativeRow[], year: number): number {
  for (let i = rows.length - 1; i >= 0; i--) {
    const value = rows[i][String(year)];
    if (value != null) return value;
  }
  return 0;
}
