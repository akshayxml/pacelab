import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, ExternalLink, Trophy } from "lucide-react";
import { ApiError } from "../api/apiClient";
import type { ActivityRepository } from "../repositories/activityRepository";
import type { BestEffortActivity, BestEffortsResponse } from "../types/activity";

interface BestEffortsProps {
  repository: ActivityRepository;
  /** Called when the backend reports the session is gone. */
  onUnauthorized: () => void;
}

/** How often to re-check while the backend is still analysing activities. */
const POLL_MS = 3_000;
const PAGE_SIZE = 50;

type SortKey = "date" | "distance" | string;
interface SortState {
  key: SortKey;
  dir: "asc" | "desc";
}

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

/** Seconds -> "m:ss" or "h:mm:ss". */
function formatDuration(totalSeconds: number): string {
  const s = Math.round(totalSeconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

function formatPace(seconds: number, meters: number): string {
  return `${formatDuration(seconds / (meters / 1000))} /km`;
}

function formatKm(meters: number): string {
  return `${(meters / 1000).toFixed(meters >= 100_000 ? 0 : 1)} km`;
}

function sortValue(row: BestEffortActivity, key: SortKey): number | string | null {
  if (key === "date") return row.date;
  if (key === "distance") return row.distanceM;
  return row.efforts[key] ?? null;
}

/** Sorts with missing values always last, whichever direction. */
function compareRows(a: BestEffortActivity, b: BestEffortActivity, sort: SortState) {
  const av = sortValue(a, sort.key);
  const bv = sortValue(b, sort.key);
  if (av === null && bv === null) return 0;
  if (av === null) return 1;
  if (bv === null) return -1;
  const cmp = av < bv ? -1 : av > bv ? 1 : 0;
  return sort.dir === "asc" ? cmp : -cmp;
}

export default function BestEfforts({ repository, onUnauthorized }: BestEffortsProps) {
  const [data, setData] = useState<BestEffortsResponse | null>(
    () => repository.peekBestEfforts() ?? null,
  );
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<SortState>({ key: "date", dir: "desc" });
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // Fetch, then keep polling while the backend is still analysing.
  useEffect(() => {
    if (repository.peekBestEfforts()) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const load = () => {
      repository
        .getBestEfforts()
        .then((result) => {
          if (cancelled) return;
          setData(result);
          if (result.progress.running) timer = setTimeout(load, POLL_MS);
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
              : "Failed to load best efforts.",
          );
        });
    };
    load();

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [repository, onUnauthorized]);

  const runs = useMemo(() => data?.activities ?? [], [data]);

  // Hide distances never covered (e.g. 50K for most runners).
  const columns = useMemo(
    () =>
      (data?.distances ?? []).filter((d) =>
        runs.some((a) => a.efforts[d.key] != null),
      ),
    [data, runs],
  );

  // Fastest time per column, highlighted as the personal best.
  const bests = useMemo(() => {
    const result: Record<string, number> = {};
    for (const { key } of columns) {
      for (const a of runs) {
        const t = a.efforts[key];
        if (t != null && (result[key] === undefined || t < result[key])) result[key] = t;
      }
    }
    return result;
  }, [columns, runs]);

  const sorted = useMemo(
    () => [...runs].sort((a, b) => compareRows(a, b, sort)),
    [runs, sort],
  );

  function changeSort(key: SortKey) {
    setVisibleCount(PAGE_SIZE);
    setSort((current) =>
      current.key === key
        ? { key, dir: current.dir === "asc" ? "desc" : "asc" }
        : // Times: fastest first. Date/distance: newest/longest first.
          { key, dir: key === "date" || key === "distance" ? "desc" : "asc" },
    );
  }

  if (error) {
    return (
      <div className="panel error-panel" role="alert">
        {error}
      </div>
    );
  }
  if (!data) {
    return <div className="panel loading-panel">Loading best efforts...</div>;
  }

  const { analysed, total, running, rateLimitedUntil } = data.progress;
  const percent = total > 0 ? Math.round((analysed / total) * 100) : 100;
  const rankedByTime = sort.key !== "date" && sort.key !== "distance" && sort.dir === "asc";

  const sortHeader = (key: SortKey, label: string, className = "") => {
    const active = sort.key === key;
    const Icon = !active ? ArrowUpDown : sort.dir === "asc" ? ArrowUp : ArrowDown;
    return (
      <th
        scope="col"
        className={className}
        aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
      >
        <button
          type="button"
          id={`sort-${key}`}
          className={`sort-button ${active ? "active" : ""}`}
          onClick={() => changeSort(key)}
        >
          {label}
          <Icon size={12} aria-hidden />
        </button>
      </th>
    );
  };

  return (
    <div className="best-efforts">
      {(running || rateLimitedUntil) && (
        <div className="analysis-status" role="status">
          <div className="analysis-text">
            {rateLimitedUntil
              ? `Paused by the upstream rate limit. Resumes around ${new Date(rateLimitedUntil).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}.`
              : "Analysing your runs for best efforts. This only happens once."}
            <strong>
              {analysed} / {total}
            </strong>
          </div>
          <div className="progress-track" aria-hidden>
            <div className="progress-fill" style={{ width: `${percent}%` }} />
          </div>
        </div>
      )}

      <section className="panel best-panel" aria-labelledby="best-efforts-title">
        <div className="panel-heading">
          <div>
            <h2 id="best-efforts-title">Fastest efforts by distance</h2>
            <p>
              Best time for each distance within a run. Click a column to sort.
            </p>
          </div>
          <span className="panel-chip">
            {runs.length} {runs.length === 1 ? "run" : "runs"}
          </span>
        </div>

        {runs.length === 0 ? (
          <p className="best-empty">
            {running ? "Results will appear here as runs are analysed." : "No runs with distance data yet."}
          </p>
        ) : (
          <>
            <div className="best-table-wrap">
              <table className="best-table">
                <thead>
                  <tr>
                    {rankedByTime && <th scope="col" className="rank-col">#</th>}
                    <th scope="col" className="name-col">Run</th>
                    {sortHeader("date", "Date")}
                    {sortHeader("distance", "Distance")}
                    {columns.map((d) => sortHeader(d.key, d.label, "effort-col"))}
                  </tr>
                </thead>
                <tbody>
                  {sorted.slice(0, visibleCount).map((a, index) => (
                    <tr key={a.id}>
                      {rankedByTime && (
                        <td className="rank-col">
                          {a.efforts[sort.key] != null ? index + 1 : ""}
                        </td>
                      )}
                      <th scope="row" className="name-col">
                        <a
                          className="activity-link"
                          href={a.link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={`${a.name}: open in ${a.link.label}`}
                        >
                          <span className="activity-link-text">{a.name}</span>
                          <ExternalLink size={12} aria-hidden />
                          <span className="visually-hidden"> (opens {a.link.label} in a new tab)</span>
                        </a>
                      </th>
                      <td className="muted-cell">{dateFormatter.format(new Date(a.date))}</td>
                      <td className="muted-cell">{formatKm(a.distanceM)}</td>
                      {columns.map((d) => {
                        const t = a.efforts[d.key];
                        if (t == null) {
                          return (
                            <td key={d.key} className="effort-col empty">
                              –
                            </td>
                          );
                        }
                        const isBest = bests[d.key] === t;
                        return (
                          <td
                            key={d.key}
                            className={`effort-col ${isBest ? "is-best" : ""} ${sort.key === d.key ? "is-sorted" : ""}`}
                          >
                            <span className="effort-time">
                              {isBest && <Trophy size={11} aria-label="Personal best" />}
                              {formatDuration(t)}
                            </span>
                            <span className="effort-pace">{formatPace(t, d.meters)}</span>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {sorted.length > visibleCount && (
              <button
                type="button"
                id="best-show-more"
                className="show-more"
                onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
              >
                Show more ({sorted.length - visibleCount} remaining)
              </button>
            )}
          </>
        )}
      </section>
    </div>
  );
}
