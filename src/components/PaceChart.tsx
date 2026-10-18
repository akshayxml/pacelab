
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { TrendingUp } from "lucide-react";
import type { WeeklyStats } from "../types/activity";

interface PaceChartProps {
  data: WeeklyStats[];
}

function formatPace(minutes: number): string {
  const wholeMinutes = Math.floor(minutes);
  const seconds = Math.round((minutes - wholeMinutes) * 60);

  return `${wholeMinutes}:${String(seconds).padStart(2, "0")}`;
}

export default function PaceChart({ data }: PaceChartProps) {
  const latestPace = data[data.length - 1].averagePaceMinutes;

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
        <span className="positive">
          <TrendingUp size={15} /> Improving
        </span>
      </div>

      <div className="chart-container">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data}
            margin={{ top: 12, right: 4, left: -24, bottom: 0 }}
          >
            <defs>
              <linearGradient id="paceFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#d6a45c" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#d6a45c" stopOpacity={0.02} />
              </linearGradient>
            </defs>

            <CartesianGrid
              vertical={false}
              stroke="#e9e9e5"
              strokeDasharray="3 3"
            />
            <XAxis
              dataKey="week"
              tick={{ fontSize: 11, fill: "#92938e" }}
              axisLine={false}
              tickLine={false}
              dy={10}
            />
            <YAxis
              reversed
              domain={["dataMin - 0.1", "dataMax + 0.1"]}
              tickFormatter={formatPace}
              tick={{ fontSize: 11, fill: "#92938e" }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{
                borderRadius: 10,
                border: "1px solid #e7e8e2",
                fontSize: 12,
              }}
              formatter={(value) => [
                `${formatPace(Number(value))} /km`,
                "Pace",
              ]}
            />
            <Area
              type="monotone"
              dataKey="averagePaceMinutes"
              name="Average pace"
              stroke="#c38a3c"
              strokeWidth={2.5}
              fill="url(#paceFill)"
              dot={false}
              activeDot={{ r: 5, fill: "#c38a3c" }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
