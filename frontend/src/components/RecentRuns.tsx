
import { useState, type KeyboardEvent } from "react";
import { ChevronDown, ExternalLink, Footprints } from "lucide-react";
import type { ActivityRepository } from "../repositories/activityRepository";
import type { RunActivity } from "../types/activity";
import LapDetails from "./LapDetails";

interface RecentRunsProps {
  runs: RunActivity[];
  repository: ActivityRepository;
  /** Called when the backend reports the session is gone. */
  onUnauthorized: () => void;
}

export default function RecentRuns({ runs, repository, onUnauthorized }: RecentRunsProps) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

  const toggle = (id: string) =>
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const onRowKey = (event: KeyboardEvent, id: string) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      toggle(id);
    }
  };

  return (
    <div className="panel runs-panel" id="runs">
      <div className="panel-heading">
        <div>
          <h2>Run log</h2>
          <p>{runs.length} runs · newest first · click a run for laps</p>
        </div>
      </div>

      <div className="run-table">
        <div className="run-row run-header">
          <span>ACTIVITY</span>
          <span>DISTANCE</span>
          <span>PACE</span>
          <span>AVG HR</span>
        </div>

        {runs.map((run) => {
          const isOpen = expanded.has(run.id);
          return (
            <div className={`run-item ${isOpen ? "is-open" : ""}`} key={run.id}>
              <div
                className="run-row run-toggle"
                role="button"
                tabIndex={0}
                aria-expanded={isOpen}
                aria-controls={`laps-${run.id}`}
                onClick={() => toggle(run.id)}
                onKeyDown={(e) => onRowKey(e, run.id)}
              >
                <div className="run-name">
                  <div className={`run-type-icon ${run.type.toLowerCase()}`}>
                    <Footprints size={17} />
                  </div>
                  <div className="run-name-text">
                    <strong>
                      {run.name}
                      {run.link && (
                        <a
                          className="run-external"
                          href={run.link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={`Open in ${run.link.label}`}
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => e.stopPropagation()}
                        >
                          <ExternalLink size={11} aria-hidden />
                          <span className="visually-hidden"> (opens {run.link.label} in a new tab)</span>
                        </a>
                      )}
                    </strong>
                    <small>{run.date} · {run.duration}</small>
                  </div>
                  <ChevronDown size={15} className="run-chevron" aria-hidden />
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

              {isOpen && (
                <div className="run-laps" id={`laps-${run.id}`}>
                  <LapDetails
                    repository={repository}
                    activityId={run.id}
                    onUnauthorized={onUnauthorized}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
