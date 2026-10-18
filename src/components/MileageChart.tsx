
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowUpRight } from "lucide-react";
import type { WeeklyStats } from "../types/activity";

interface MileageChartProps {
  data: WeeklyStats[];
}

export default function MileageChart({ data }: MileageChartProps) {
  const current = data[data.length - 1];
  const previous = data[data.length - 2];

  const change =
    previous && previous.distanceKm !== 0
      ? Math.round(
        ((current.distanceKm - previous.distanceKm) /
          previous.distanceKm) *
        100,
      )
      : 0;

  return (
    <div className="panel mileage-panel">
      <div className="panel-heading">
        <div>
          <h2>Weekly mileage</h2>
          <p>Build consistency, one week at a time</p>
        </div>
        <span className="panel-chip">8 weeks</span>
      </div>

      <div className="chart-summary">
        <strong>{current.distanceKm} <small>km</small></strong>
        <span className="positive">
          <ArrowUpRight size={15} /> {change}%
        </span>
      </div>

      <div className="chart-container">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 12, right: 4, left: -24, bottom: 0 }}
          >
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
              tick={{ fontSize: 11, fill: "#92938e" }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              cursor={{ fill: "#f2f4ee" }}
              contentStyle={{
                borderRadius: 10,
                border: "1px solid #e7e8e2",
                fontSize: 12,
              }}
              formatter={(value) => [`${value} km`, "Distance"]}
            />
            <Bar
              dataKey="distanceKm"
              name="Distance"
              fill="#526c4e"
              radius={[5, 5, 0, 0]}
              maxBarSize={32}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
