import { useEffect, useState } from "react";
import { Zap } from "lucide-react";
import { ApiError } from "../api/apiClient";
import type { ActivityRepository } from "../repositories/activityRepository";
import type { ActivityLap } from "../types/activity";

interface LapDetailsProps {
  repository: ActivityRepository;
  activityId: string;
  /** Called when the backend reports the session is gone. */
  onUnauthorized: () => void;
}

/** Laps shorter than this (e.g. a 30 m tail) are excluded from "fastest". */
const MIN_RANKED_LAP_M = 200;

/** Seconds -> "m:ss" or "h:mm:ss". */
function formatDuration(totalSeconds: number): string {
  const s = Math.round(totalSeconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

const paceOf = (lap: ActivityLap) => lap.movingTimeS / (lap.distanceM / 1000);

/** Per-lap breakdown, loaded when the row is expanded. */
export default function LapDetails({ repository, activityId, onUnauthorized }: LapDetailsProps) {
  const [laps, setLaps] = useState<ActivityLap[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    repository
      .getLaps(activityId)
      .then((result) => {
        if (!cancelled) setLaps(result);
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
            : "Couldn't load laps for this run.",
        );
      });
    return () => {
      cancelled = true;
    };
  }, [repository, activityId, onUnauthorized]);

  if (error) return <p className="lap-message error">{error}</p>;
  if (!laps) return <p className="lap-message">Loading laps...</p>;
  if (laps.length === 0) return <p className="lap-message">No lap data for this run.</p>;

  const ranked = laps.filter((l) => l.distanceM >= MIN_RANKED_LAP_M);
  const paces = ranked.map(paceOf);
  const fastest = paces.length > 1 ? Math.min(...paces) : null;
  const slowest = paces.length ? Math.max(...paces) : 0;
  const hasHr = laps.some((l) => l.averageHeartRate != null);
  const hasElevation = laps.some((l) => l.elevationGainM != null);

  return (
    <div className="lap-details">
      <table className="lap-table">
        <thead>
          <tr>
            <th scope="col">Lap</th>
            <th scope="col">Distance</th>
            <th scope="col">Time</th>
            <th scope="col" className="lap-pace-col">Pace</th>
            {hasHr && <th scope="col">Avg HR</th>}
            {hasElevation && <th scope="col">Elev</th>}
          </tr>
        </thead>
        <tbody>
          {laps.map((lap, i) => {
            const pace = paceOf(lap);
            const isFastest = fastest !== null && lap.distanceM >= MIN_RANKED_LAP_M && pace === fastest;
            // Bar length: faster laps are longer (relative to the slowest lap).
            const barPct = slowest > 0 ? Math.max(15, Math.min(100, (slowest / pace) * 70)) : 0;
            return (
              <tr key={i} className={isFastest ? "is-fastest" : undefined}>
                <td className="lap-index">{i + 1}</td>
                <td>{(lap.distanceM / 1000).toFixed(2)} km</td>
                <td>{formatDuration(lap.movingTimeS)}</td>
                <td className="lap-pace-col">
                  <span className="lap-pace">
                    <span className="lap-pace-bar" style={{ width: `${barPct}%` }} aria-hidden />
                    <span className="lap-pace-value">
                      {isFastest && <Zap size={11} aria-label="Fastest lap" />}
                      {formatDuration(pace)} /km
                    </span>
                  </span>
                </td>
                {hasHr && (
                  <td>{lap.averageHeartRate != null ? `${Math.round(lap.averageHeartRate)} bpm` : "–"}</td>
                )}
                {hasElevation && (
                  <td>{lap.elevationGainM != null ? `${Math.round(lap.elevationGainM)} m` : "–"}</td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
