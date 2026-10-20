
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { TrendingDown, TrendingUp } from "lucide-react";
import type { WeeklyStats } from "../types/activity";

interface PaceChartProps {
  data: WeeklyStats[];
}

function formatPace(minutes: number | null | undefined): string {
  if (minutes == null || !Number.isFinite(minutes)) return "--";
  const totalSeconds = Math.round(minutes * 60);
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, "0")}`;
}

export default function PaceChart({ data }: PaceChartProps) {
  // Weeks without runs have a null pace; ignore them for the summary.
  const paces = data
    .map((week) => week.averagePaceMinutes)
    .filter((pace): pace is number => pace !== null);
  const latestPace = paces[paces.length - 1];
  const firstPace = paces[0];
  // Lower min/km is faster.
  const isImproving =
    paces.length >= 2 ? latestPace < firstPace : null;

  return (
    <div className="panel pace-panel">
      <div className="panel-heading">
        <div>
          <h2>Pace progression</h2>
          <p>Average pace per week</p>
        </div>
        <span className="panel-chip">min/km</span>
      </div>

      <div className="chart-summary">
        <strong>{formatPace(latestPace)} <small>/km</small></strong>
        {isImproving !== null && (
          <span className={isImproving ? "positive" : "negative"}>
            {isImproving ? (
              <TrendingUp size={15} />
            ) : (
              <TrendingDown size={15} />
            )}{" "}
            {isImproving ? "Improving" : "Slower"}
          </span>
        )}
      </div>

      <div className="chart-container">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data}
            margin={{ top: 12, right: 4, left: -24, bottom: 0 }}
          >
            <defs>
              <linearGradient id="paceFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--chart-line)" stopOpacity={0.3} />
                <stop offset="100%" stopColor="var(--chart-line)" stopOpacity={0.02} />
              </linearGradient>
            </defs>

            <CartesianGrid
              vertical={false}
              stroke="var(--chart-grid)"
              strokeDasharray="3 3"
            />
            <XAxis
              dataKey="week"
              tick={{ fontSize: 11, fill: "var(--chart-tick)" }}
              axisLine={false}
              tickLine={false}
              dy={10}
            />
            <YAxis
              reversed
              domain={["dataMin - 0.1", "dataMax + 0.1"]}
              tickFormatter={formatPace}
              tick={{ fontSize: 11, fill: "var(--chart-tick)" }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{
                borderRadius: 10,
                border: "1px solid var(--border)",
                background: "var(--surface-2)",
                color: "var(--text)",
                fontSize: 12,
              }}
              formatter={(value) => [
                `${formatPace(value == null ? null : Number(value))} /km`,
                "Pace",
              ]}
            />
            <Area
              type="monotone"
              dataKey="averagePaceMinutes"
              name="Average pace"
              stroke="var(--chart-line)"
              strokeWidth={2.5}
              fill="url(#paceFill)"
              dot={false}
              activeDot={{ r: 5, fill: "var(--chart-line)" }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
