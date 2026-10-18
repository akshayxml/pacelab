
import type { LucideIcon } from "lucide-react";
import { ArrowUpRight } from "lucide-react";

interface MetricCardProps {
  label: string;
  value: string;
  unit: string;
  change: string;
  icon: LucideIcon;
}

export default function MetricCard({
  label,
  value,
  unit,
  change,
  icon: Icon,
}: MetricCardProps) {
  return (
    <div className="metric-card">
      <div className="metric-top">
        <span>{label}</span>
        <span className="metric-icon">
          <Icon size={18} />
        </span>
      </div>

      <div className="metric-value">
        {value}<small> {unit}</small>
      </div>

      <div className="metric-change">
        <ArrowUpRight size={15} />
        {change}
      </div>
    </div>
  );
}
