import type {
  ActivityLogEntry,
  RunActivity,
  RunType,
  SourceActivity,
  WeeklyStats,
} from "../types/activity.js";

const RUN_SPORT_TYPES = new Set(["Run", "TrailRun", "VirtualRun"]);
const LONG_RUN_THRESHOLD_KM = 16;
const INTERVAL_NAME_PATTERN = /interval|repeats?|fartlek|\d+\s*x\s*\d+/i;
const TEMPO_NAME_PATTERN = /tempo|threshold/i;

// `startDateLocal` is local wall-clock time; we treat it as UTC everywhere so
// the athlete's local date is preserved regardless of server timezone.
const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

/** Parses a local wall-clock ISO string as if it were UTC. */
function parseLocalDate(value: string): Date {
  const hasZone = /(Z|[+-]\d{2}:?\d{2})$/i.test(value);
  return new Date(hasZone ? value : `${value}Z`);
}

export function isRun(activity: SourceActivity): boolean {
  return RUN_SPORT_TYPES.has(activity.sportType);
}

/** Formats seconds as "m:ss" or "h:mm:ss". */
export function formatDuration(totalSeconds: number): string {
  const seconds = Math.round(totalSeconds);
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

/** Seconds per km -> "m:ss". */
export function formatPace(secondsPerKm: number): string {
  if (!Number.isFinite(secondsPerKm) || secondsPerKm <= 0) return "--";
  return formatDuration(secondsPerKm);
}

function classifyRun(activity: SourceActivity, distanceKm: number): RunType {
  if (activity.isRace) return "Race";
  if (activity.isLongRun) return "Long";
  if (INTERVAL_NAME_PATTERN.test(activity.name)) return "Intervals";
  if (activity.isWorkout || TEMPO_NAME_PATTERN.test(activity.name)) {
    return "Tempo";
  }
  if (distanceKm >= LONG_RUN_THRESHOLD_KM) return "Long";
  return "Easy";
}

export function toRunActivity(activity: SourceActivity): RunActivity {
  const distanceKm = activity.distanceM / 1000;

  return {
    id: activity.id,
    date: dateFormatter.format(parseLocalDate(activity.startDateLocal)),
    name: activity.name,
    distanceKm: Math.round(distanceKm * 100) / 100,
    pace: formatPace(activity.movingTimeS / distanceKm),
    duration: formatDuration(activity.movingTimeS),
    averageHeartRate:
      activity.averageHeartRate != null
        ? Math.round(activity.averageHeartRate)
        : null,
    type: classifyRun(activity, distanceKm),
    elevationGainM: Math.round(activity.elevationGainM),
  };
}

/** Monday 00:00 UTC of the week containing `date` (local wall-clock). */
function startOfIsoWeek(date: Date): Date {
  const d = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  const daysSinceMonday = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - daysSinceMonday);
  return d;
}

/**
 * Aggregates runs into the last `weeks` Monday-based weeks (oldest first).
 * Weeks with no runs are included with 0 km and a null pace.
 */
export function aggregateWeeklyStats(
  activities: SourceActivity[],
  weeks: number,
  now: Date = new Date(),
): WeeklyStats[] {
  const currentWeekStart = startOfIsoWeek(now);
  const buckets = new Map<number, { meters: number; seconds: number }>();

  for (let i = weeks - 1; i >= 0; i--) {
    const start = new Date(currentWeekStart);
    start.setUTCDate(start.getUTCDate() - i * 7);
    buckets.set(start.getTime(), { meters: 0, seconds: 0 });
  }

  for (const activity of activities) {
    if (!isRun(activity)) continue;
    const key = startOfIsoWeek(parseLocalDate(activity.startDateLocal)).getTime();
    const bucket = buckets.get(key);
    if (!bucket) continue;
    bucket.meters += activity.distanceM;
    bucket.seconds += activity.movingTimeS;
  }

  return [...buckets.entries()].map(([weekStart, { meters, seconds }]) => {
    const km = meters / 1000;
    return {
      week: dateFormatter.format(new Date(weekStart)),
      distanceKm: Math.round(km * 10) / 10,
      // Distance-weighted average pace in decimal minutes per km.
      averagePaceMinutes:
        km > 0 ? Math.round((seconds / 60 / km) * 100) / 100 : null,
    };
  });
}

/** Unix seconds for the start of the oldest week in the window. */
export function weeklyWindowStart(weeks: number, now: Date = new Date()): number {
  const start = startOfIsoWeek(now);
  start.setUTCDate(start.getUTCDate() - (weeks - 1) * 7);
  // Pad a day to account for timezone offset between UTC and local start time.
  return Math.floor(start.getTime() / 1000) - 86_400;
}

export function toLogEntry(activity: SourceActivity): ActivityLogEntry {
  return {
    date: parseLocalDate(activity.startDateLocal).toISOString().slice(0, 10),
    // Trail, virtual etc. runs are grouped as "Run", matching isRun().
    sportType: isRun(activity) ? "Run" : activity.sportType,
    movingTimeS: activity.movingTimeS,
    distanceM: Math.round(activity.distanceM),
  };
}
