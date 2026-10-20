import { useEffect, useMemo, useState } from "react";
import { ApiError } from "../api/apiClient";
import { buildCumulativeRows, sportLabel } from "../lib/yearlyCumulative";
import type { ActivityRepository } from "../repositories/activityRepository";
import type { ActivityLogEntry } from "../types/activity";
import CumulativeYearChart from "./CumulativeYearChart";

interface YearlyProgressProps {
  repository: ActivityRepository;
  /** Called when the backend reports the session is gone. */
  onUnauthorized: () => void;
}

const ALL = "all";

const numberFormat = new Intl.NumberFormat("en-US");

function formatHours(hours: number): string {
  return hours >= 100 ? `${Math.round(hours)} h` : `${hours.toFixed(1)} h`;
}

function formatKm(km: number): string {
  return km >= 100 ? `${numberFormat.format(Math.round(km))} km` : `${km.toFixed(1)} km`;
}

/** "1500" -> "1.5k" for compact axis labels. */
function compact(value: number): string {
  return value >= 1000 ? `${Number((value / 1000).toFixed(1))}k` : String(value);
}

/**
 * Yearly progress tab: one shared activity filter and year toggle state
 * driving the cumulative distance and hours charts.
 */
export default function YearlyProgress({
  repository,
  onUnauthorized,
}: YearlyProgressProps) {
  // Start from cached data when available so revisiting the tab is instant.
  const [entries, setEntries] = useState<ActivityLogEntry[] | null>(
    () => repository.peekHistory() ?? null,
  );
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string> | typeof ALL>(ALL);
  const [hiddenYears, setHiddenYears] = useState<Set<number>>(new Set());

  useEffect(() => {
    // The repository caches this; when already loaded there's nothing to do.
    if (repository.peekHistory()) return;

    let cancelled = false;
    repository
      .getHistory()
      .then((data) => {
        if (!cancelled) setEntries(data);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.isUnauthorized) {
          onUnauthorized();
          return;
        }
        setError(
          err instanceof ApiError && err.status === 429
            ? "Rate limit reached. Please try again in a few minutes."
            : "Failed to load activity history.",
        );
      });
    return () => {
      cancelled = true;
    };
  }, [repository, onUnauthorized]);

  // Sport types ordered by total time, most first.
  const sportTypes = useMemo(() => {
    const totals = new Map<string, number>();
    for (const e of entries ?? []) {
      totals.set(e.sportType, (totals.get(e.sportType) ?? 0) + e.movingTimeS);
    }
    return [...totals.entries()].sort((a, b) => b[1] - a[1]).map(([s]) => s);
  }, [entries]);

  const years = useMemo(() => {
    const unique = new Set((entries ?? []).map((e) => Number(e.date.slice(0, 4))));
    return [...unique].sort((a, b) => b - a);
  }, [entries]);

  const filtered = useMemo(
    () =>
      (entries ?? []).filter((e) => selected === ALL || selected.has(e.sportType)),
    [entries, selected],
  );

  const hoursRows = useMemo(
    () => buildCumulativeRows(filtered, years, (e) => e.movingTimeS / 3600),
    [filtered, years],
  );
  const distanceRows = useMemo(
    () => buildCumulativeRows(filtered, years, (e) => e.distanceM / 1000),
    [filtered, years],
  );

  function toggleYear(year: number) {
    setHiddenYears((current) => {
      const next = new Set(current);
      if (next.has(year)) next.delete(year);
      else next.add(year);
      return next;
    });
  }

  function toggleSport(sport: string) {
    setSelected((current) => {
      const next = new Set(current === ALL ? [] : current);
      if (next.has(sport)) next.delete(sport);
      else next.add(sport);
      return next.size === 0 || next.size === sportTypes.length ? ALL : next;
    });
  }

  if (error) {
    return (
      <div className="panel error-panel" role="alert">
        {error}
      </div>
    );
  }
  if (entries === null) {
    return <div className="panel loading-panel">Loading activity history...</div>;
  }
  if (entries.length === 0) {
    return <div className="panel loading-panel">No activities recorded yet.</div>;
  }

  const shared = { years, hiddenYears, onToggleYear: toggleYear };

  return (
    <div className="progress-stack">
      <div className="sport-filter" role="group" aria-label="Filter by activity">
        <button
          type="button"
          id="sport-filter-all"
          className={`sport-chip ${selected === ALL ? "active" : ""}`}
          aria-pressed={selected === ALL}
          onClick={() => setSelected(ALL)}
        >
          All activities
        </button>
        {sportTypes.map((sport) => {
          const active = selected !== ALL && selected.has(sport);
          return (
            <button
              key={sport}
              type="button"
              id={`sport-filter-${sport}`}
              className={`sport-chip ${active ? "active" : ""}`}
              aria-pressed={active}
              onClick={() => toggleSport(sport)}
            >
              {sportLabel(sport)}
            </button>
          );
        })}
      </div>

      <CumulativeYearChart
        id="progress-distance"
        title="Cumulative distance"
        subtitle="Kilometres covered across the year"
        unit="km"
        rows={distanceRows}
        format={formatKm}
        formatAxis={compact}
        {...shared}
      />

      <CumulativeYearChart
        id="progress-hours"
        title="Cumulative hours"
        subtitle="Moving time added up day by day, one line per year"
        unit="hours"
        rows={hoursRows}
        format={formatHours}
        formatAxis={(h) => `${compact(h)}h`}
        {...shared}
      />
    </div>
  );
}
