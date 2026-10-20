import { useMemo, useState } from "react";
import { useRunHistory } from "../hooks/useRunHistory";
import { buildCumulativeRows } from "../lib/yearlyCumulative";
import type { ActivityRepository } from "../repositories/activityRepository";
import CumulativeYearChart from "./CumulativeYearChart";

interface YearlyProgressProps {
  repository: ActivityRepository;
  /** Called when the backend reports the session is gone. */
  onUnauthorized: () => void;
}

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
 * Yearly progress tab: cumulative running distance and hours, sharing one
 * set of year toggles.
 */
export default function YearlyProgress({
  repository,
  onUnauthorized,
}: YearlyProgressProps) {
  const { entries, error } = useRunHistory(repository, onUnauthorized);
  const [hiddenYears, setHiddenYears] = useState<Set<number>>(new Set());

  const years = useMemo(() => {
    const unique = new Set((entries ?? []).map((e) => Number(e.date.slice(0, 4))));
    return [...unique].sort((a, b) => b - a);
  }, [entries]);

  const hoursRows = useMemo(
    () => buildCumulativeRows(entries ?? [], years, (e) => e.movingTimeS / 3600),
    [entries, years],
  );
  const distanceRows = useMemo(
    () => buildCumulativeRows(entries ?? [], years, (e) => e.distanceM / 1000),
    [entries, years],
  );

  function toggleYear(year: number) {
    setHiddenYears((current) => {
      const next = new Set(current);
      if (next.has(year)) next.delete(year);
      else next.add(year);
      return next;
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
    return <div className="panel loading-panel">No runs recorded yet.</div>;
  }

  const shared = { years, hiddenYears, onToggleYear: toggleYear };

  return (
    <div className="progress-stack">
      <CumulativeYearChart
        id="progress-distance"
        title="Cumulative distance"
        subtitle="Kilometres run across the year"
        unit="km"
        rows={distanceRows}
        format={formatKm}
        formatAxis={compact}
        {...shared}
      />

      <CumulativeYearChart
        id="progress-hours"
        title="Cumulative hours"
        subtitle="Running time added up day by day, one line per year"
        unit="hours"
        rows={hoursRows}
        format={formatHours}
        formatAxis={(h) => `${compact(h)}h`}
        {...shared}
      />
    </div>
  );
}
