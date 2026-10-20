
import { Footprints } from "lucide-react";
import type { RunActivity } from "../types/activity";

interface RecentRunsProps {
  runs: RunActivity[];
}

export default function RecentRuns({ runs }: RecentRunsProps) {
  return (
    <div className="panel runs-panel" id="runs">
      <div className="panel-heading">
        <div>
          <h2>Run log</h2>
          <p>{runs.length} runs · newest first</p>
        </div>
      </div>

      <div className="run-table">
        <div className="run-row run-header">
          <span>ACTIVITY</span>
          <span>DISTANCE</span>
          <span>PACE</span>
          <span>AVG HR</span>
        </div>

        {runs.map((run) => (
          <div className="run-row" key={run.id}>
            <div className="run-name">
              <div className={`run-type-icon ${run.type.toLowerCase()}`}>
                <Footprints size={17} />
              </div>
              <div>
                <strong>{run.name}</strong>
                <small>{run.date} · {run.duration}</small>
              </div>
            </div>

            <span className="run-number">
              {run.distanceKm.toFixed(1)} <small>km</small>
            </span>
            <span className="run-number">
              {run.pace} <small>/km</small>
            </span>
            <span className="run-number">
              {run.averageHeartRate ?? "--"} <small>bpm</small>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
