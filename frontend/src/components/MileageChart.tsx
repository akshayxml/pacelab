import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { useRunHistory } from "../hooks/useRunHistory";
import {
  monthlyMileage,
  previousPeriodToDate,
  weeklyMileage,
  yearlyMileage,
  type MileageBar,
  type MileagePeriod,
} from "../lib/mileage";
import type { ActivityRepository } from "../repositories/activityRepository";
import type { WeeklyStats } from "../types/activity";

interface MileageChartProps {
  weekly: WeeklyStats[];
  /** Source of the full run history for the monthly and yearly views. */
  repository: ActivityRepository;
  /** Called when the backend reports the session is gone. */
  onUnauthorized: () => void;
}

const PERIODS: {
  value: MileagePeriod;
  label: string;
  title: string;
  subtitle: string;
  comparison: string;
}[] = [
  {
    value: "week",
    label: "Weekly",
    title: "Weekly mileage",
    subtitle: "Build consistency, one week at a time",
    comparison: "vs last week",
  },
  {
    value: "month",
    label: "Monthly",
    title: "Monthly mileage",
    subtitle: "Distance over the last 12 months",
    comparison: "vs this time last month",
  },
  {
    value: "year",
    label: "Yearly",
    title: "Yearly mileage",
    subtitle: "Distance for every year you've run",
    comparison: "vs this time last year",
  },
];

function formatKm(km: number): string {
  return km >= 100 ? Math.round(km).toLocaleString("en-US") : km.toFixed(1);
}

export default function MileageChart({ weekly, repository, onUnauthorized }: MileageChartProps) {
  const [period, setPeriod] = useState<MileagePeriod>("week");
  const config = PERIODS.find((p) => p.value === period) ?? PERIODS[0];

  // Monthly and yearly views need the full run history; it loads on first use
  // and is shared (cached) with the Yearly progress tab.
  const { entries, error } = useRunHistory(repository, onUnauthorized, period !== "week");

  const bars: MileageBar[] | null = useMemo(() => {
    if (period === "week") return weeklyMileage(weekly);
    if (!entries) return null;
    return period === "month" ? monthlyMileage(entries) : yearlyMileage(entries);
  }, [period, weekly, entries]);

  const current = bars?.[bars.length - 1];
  const previousKm =
    period === "week"
      ? bars?.[bars.length - 2]?.distanceKm
      : entries
        ? previousPeriodToDate(entries, period)
        : undefined;
  const change =
    current && previousKm
      ? Math.round(((current.distanceKm - previousKm) / previousKm) * 100)
      : null;

  return (
    <div className="panel mileage-panel">
      <div className="panel-heading">
        <div>
          <h2>{config.title}</h2>
          <p>{config.subtitle}</p>
        </div>
        <div className="segmented" role="group" aria-label="Mileage period">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              type="button"
              id={`mileage-${p.value}`}
              aria-pressed={p.value === period}
              onClick={() => setPeriod(p.value)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="chart-summary">
        <strong>
          {current ? formatKm(current.distanceKm) : "--"} <small>km</small>
        </strong>
        {change !== null && (
          <span className={change >= 0 ? "positive" : "negative"}>
            {change >= 0 ? <ArrowUpRight size={15} /> : <ArrowDownRight size={15} />}{" "}
            {change}% {config.comparison}
          </span>
        )}
      </div>

      <div className="chart-container">
        {error && period !== "week" ? (
          <p className="chart-message error" role="alert">
            {error}
          </p>
        ) : !bars ? (
          <p className="chart-message">Loading your run history...</p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={bars} margin={{ top: 12, right: 4, left: -16, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--chart-grid)" strokeDasharray="3 3" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: "var(--chart-tick)" }}
                axisLine={false}
                tickLine={false}
                dy={10}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "var(--chart-tick)" }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                cursor={{ fill: "var(--chart-cursor)" }}
                labelFormatter={(label, payload) =>
                  (payload?.[0]?.payload as MileageBar | undefined)?.tooltipLabel ?? label
                }
                formatter={(value) => [`${formatKm(Number(value))} km`, "Distance"]}
                contentStyle={{
                  borderRadius: 10,
                  border: "1px solid var(--border)",
                  background: "var(--surface-2)",
                  color: "var(--text)",
                  fontSize: 12,
                }}
              />
              <Bar
                dataKey="distanceKm"
                name="Distance"
                fill="var(--chart-bar)"
                radius={[5, 5, 0, 0]}
                maxBarSize={32}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
