import { useMemo } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  LineChart,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useRunHistory } from "../hooks/useRunHistory";
import {
  LOAD_ZONE_LABELS,
  loadZone,
  trainingLoad,
  ZONE_BOUNDS,
  type LoadZone,
  type TrainingLoadPoint,
} from "../lib/trainingLoad";
import type { ActivityRepository } from "../repositories/activityRepository";

interface TrainingLoadChartProps {
  repository: ActivityRepository;
  /** Called when the backend reports the session is gone. */
  onUnauthorized: () => void;
}

const ZONES: Record<LoadZone, { label: string; color: string }> = {
  low: { label: LOAD_ZONE_LABELS.low, color: "var(--text-muted)" },
  optimal: { label: LOAD_ZONE_LABELS.optimal, color: "var(--year-5)" },
  caution: { label: LOAD_ZONE_LABELS.caution, color: "var(--year-3)" },
  high: { label: LOAD_ZONE_LABELS.high, color: "var(--negative)" },
};

const ACUTE_COLOR = "var(--chart-bar)";
const CHRONIC_COLOR = "var(--year-2)";
const RATIO_COLOR = "var(--text)";

/** Keep the ratio axis readable when a comeback week makes the ratio spike. */
const MIN_RATIO_AXIS = 2;
const MAX_RATIO_AXIS = 2.5;

/** Both charts share margins and axis width so their x-axes line up. */
const MARGIN = { top: 8, right: 8, left: -16, bottom: 0 };
const TICK = { fontSize: 11, fill: "var(--chart-tick)" };
const CURSOR = { stroke: "var(--chart-tick)", strokeWidth: 1, strokeDasharray: "3 3" };

function LoadTooltip({ active, payload }: { active?: boolean; payload?: { payload?: unknown }[] }) {
  const point = payload?.[0]?.payload as TrainingLoadPoint | undefined;
  if (!active || !point) return null;
  const zone = point.ratio != null ? ZONES[loadZone(point.ratio)] : null;
  return (
    <div className="load-tooltip">
      <strong>{point.tooltipLabel}</strong>
      <span>7-day: {point.acuteKm.toFixed(1)} km</span>
      <span>28-day weekly avg: {point.chronicKm.toFixed(1)} km</span>
      <span>
        Ratio {point.ratio != null ? point.ratio.toFixed(2) : "--"}
        {zone && <em style={{ color: zone.color }}> · {zone.label}</em>}
      </span>
    </div>
  );
}

export default function TrainingLoadChart({ repository, onUnauthorized }: TrainingLoadChartProps) {
  const { entries, error } = useRunHistory(repository, onUnauthorized);
  const points = useMemo(() => (entries ? trainingLoad(entries) : null), [entries]);

  const latest = points?.[points.length - 1];
  const zone = latest?.ratio != null ? ZONES[loadZone(latest.ratio)] : null;

  const ratioMax = useMemo(() => {
    const peak = Math.max(0, ...(points ?? []).map((p) => p.ratio ?? 0));
    return Math.min(MAX_RATIO_AXIS, Math.max(MIN_RATIO_AXIS, Math.ceil(peak * 10) / 10));
  }, [points]);

  const bands: { zone: LoadZone; y1: number; y2: number }[] = [
    { zone: "low", y1: 0, y2: ZONE_BOUNDS.low },
    { zone: "optimal", y1: ZONE_BOUNDS.low, y2: ZONE_BOUNDS.optimal },
    { zone: "caution", y1: ZONE_BOUNDS.optimal, y2: ZONE_BOUNDS.caution },
    { zone: "high", y1: ZONE_BOUNDS.caution, y2: ratioMax },
  ];

  return (
    <div className="panel load-panel">
      <div className="panel-heading">
        <div>
          <h2>Training load</h2>
          <p>
            <span className="legend-swatch" style={{ background: ACUTE_COLOR }} /> 7-day km
            <span className="legend-swatch" style={{ background: CHRONIC_COLOR }} /> 28-day weekly avg
          </p>
        </div>
        <span className="panel-chip">Acute : chronic</span>
      </div>

      <div className="chart-summary">
        <strong>
          {latest?.ratio != null ? latest.ratio.toFixed(2) : "--"} <small>ratio</small>
        </strong>
        {zone && (
          <span className="load-zone" style={{ color: zone.color }}>
            {zone.label}
          </span>
        )}
      </div>

      {error ? (
        <div className="chart-container">
          <p className="chart-message error" role="alert">
            {error}
          </p>
        </div>
      ) : !points ? (
        <div className="chart-container">
          <p className="chart-message">Loading your run history...</p>
        </div>
      ) : (
        <>
          {/* Distance: 7-day vs 28-day weekly average. */}
          <div className="chart-container load-distance">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={points} margin={MARGIN} syncId="training-load">
                <defs>
                  <linearGradient id="chronicFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={CHRONIC_COLOR} stopOpacity={0.25} />
                    <stop offset="100%" stopColor={CHRONIC_COLOR} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="var(--chart-grid)" strokeDasharray="3 3" />
                <XAxis dataKey="label" hide />
                <YAxis tick={TICK} axisLine={false} tickLine={false} />
                <Tooltip cursor={CURSOR} content={<LoadTooltip />} />
                <Area
                  type="monotone"
                  dataKey="chronicKm"
                  name="28-day weekly avg"
                  stroke={CHRONIC_COLOR}
                  strokeWidth={2}
                  fill="url(#chronicFill)"
                  dot={false}
                  activeDot={{ r: 4, fill: CHRONIC_COLOR }}
                />
                <Line
                  type="monotone"
                  dataKey="acuteKm"
                  name="7-day km"
                  stroke={ACUTE_COLOR}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: ACUTE_COLOR }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Ratio with the zone bands in the background. */}
          <div className="chart-container load-ratio">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={points} margin={MARGIN} syncId="training-load">
                {bands.map((band) => (
                  <ReferenceArea
                    key={band.zone}
                    y1={band.y1}
                    y2={band.y2}
                    fill={ZONES[band.zone].color}
                    fillOpacity={0.14}
                    stroke="none"
                    ifOverflow="hidden"
                    label={{
                      value: ZONES[band.zone].label,
                      position: "insideTopLeft",
                      fontSize: 9,
                      fontWeight: 600,
                      fill: ZONES[band.zone].color,
                    }}
                  />
                ))}
                <XAxis
                  dataKey="label"
                  tick={TICK}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                  minTickGap={24}
                  dy={10}
                />
                <YAxis
                  domain={[0, ratioMax]}
                  allowDataOverflow
                  ticks={[ZONE_BOUNDS.low, ZONE_BOUNDS.optimal, ZONE_BOUNDS.caution]}
                  tickFormatter={(v: number) => v.toFixed(1)}
                  tick={TICK}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip cursor={CURSOR} content={() => null} />
                <Line
                  type="monotone"
                  dataKey="ratio"
                  name="Ratio"
                  stroke={RATIO_COLOR}
                  strokeWidth={1.75}
                  dot={false}
                  activeDot={{ r: 3.5, fill: RATIO_COLOR }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  );
}
