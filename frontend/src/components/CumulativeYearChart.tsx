import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  MONTH_TICKS,
  dayOfYear,
  finalValue,
  formatDay,
  formatMonthTick,
  localIsoDate,
  yearStyle,
  type CumulativeRow,
} from "../lib/yearlyCumulative";

interface CumulativeYearChartProps {
  id: string;
  title: string;
  subtitle: string;
  /** Unit shown in the panel chip, e.g. "hours". */
  unit: string;
  rows: CumulativeRow[];
  /** Newest first. */
  years: number[];
  hiddenYears: Set<number>;
  onToggleYear: (year: number) => void;
  /** Full value label, e.g. "12.5 h". */
  format: (value: number) => string;
  /** Compact Y-axis tick label. */
  formatAxis: (value: number) => string;
}

/** Cumulative-per-year line chart with a clickable year legend. */
export default function CumulativeYearChart({
  id,
  title,
  subtitle,
  unit,
  rows,
  years,
  hiddenYears,
  onToggleYear,
  format,
  formatAxis,
}: CumulativeYearChartProps) {
  // Year-to-date comparison against last year at the same point in time.
  const todayIndex = dayOfYear(localIsoDate(new Date())) - 1;
  const [currentYear, previousYear] = years;
  const currentYtd = rows[todayIndex]?.[String(currentYear)] ?? null;
  const previousYtd = previousYear
    ? rows[todayIndex]?.[String(previousYear)] ?? null
    : null;
  const ytdDelta =
    currentYtd !== null && previousYtd !== null ? currentYtd - previousYtd : null;

  return (
    <section className="panel progress-panel" id={id} aria-labelledby={`${id}-title`}>
      <div className="panel-heading">
        <div>
          <h2 id={`${id}-title`}>{title}</h2>
          <p>{subtitle}</p>
        </div>
        <span className="panel-chip">{unit}</span>
      </div>

      <div className="year-legend" role="group" aria-label={`Show or hide years in ${title}`}>
        {years.map((year, i) => {
          const hidden = hiddenYears.has(year);
          return (
            <button
              type="button"
              id={`${id}-year-${year}`}
              className={`year-legend-item ${hidden ? "is-hidden" : ""}`}
              key={year}
              aria-pressed={!hidden}
              title={hidden ? `Show ${year}` : `Hide ${year}`}
              onClick={() => onToggleYear(year)}
            >
              <span
                className="year-swatch"
                style={{ background: yearStyle(i).color }}
              />
              <strong>{year}</strong>
              <span>{format(finalValue(rows, year))}</span>
            </button>
          );
        })}
        {ytdDelta !== null && (
          <div className={`year-delta ${ytdDelta >= 0 ? "positive" : "negative"}`}>
            {ytdDelta >= 0 ? "+" : "−"}
            {format(Math.abs(ytdDelta))} vs {previousYear} at this point
          </div>
        )}
      </div>

      <div className="chart-container progress-chart">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={rows}
            margin={{ top: 12, right: 12, left: -8, bottom: 0 }}
          >
            <CartesianGrid
              vertical={false}
              stroke="var(--chart-grid)"
              strokeDasharray="3 3"
            />
            <XAxis
              dataKey="day"
              type="number"
              domain={[1, 366]}
              ticks={MONTH_TICKS}
              tickFormatter={formatMonthTick}
              tick={{ fontSize: 11, fill: "var(--chart-tick)" }}
              axisLine={false}
              tickLine={false}
              dy={10}
            />
            <YAxis
              tickFormatter={formatAxis}
              tick={{ fontSize: 11, fill: "var(--chart-tick)" }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              labelFormatter={(day) => formatDay(Number(day))}
              formatter={(value, name) => [format(Number(value)), String(name)]}
              itemSorter={(item) => -Number(item.name)}
              contentStyle={{
                borderRadius: 10,
                border: "1px solid var(--border)",
                background: "var(--surface-2)",
                color: "var(--text)",
                fontSize: 12,
              }}
            />
            {/* Oldest first so the current year is drawn on top. */}
            {[...years].reverse().map((year) => {
              const style = yearStyle(years.indexOf(year));
              return (
                <Line
                  key={year}
                  type="monotone"
                  dataKey={String(year)}
                  name={String(year)}
                  hide={hiddenYears.has(year)}
                  stroke={style.color}
                  strokeWidth={style.width}
                  strokeOpacity={style.opacity}
                  dot={false}
                  activeDot={{ r: 4 }}
                  isAnimationActive={false}
                  connectNulls={false}
                />
              );
            })}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
