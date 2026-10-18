
import {
  Activity,
  ArrowUpRight,
  CalendarDays,
  Clock3,
  Footprints,
  Heart,
  Target,
  TrendingUp,
} from "lucide-react";

import MetricCard from "./components/MetricCard";
import MileageChart from "./components/MileageChart";
import PaceChart from "./components/PaceChart";
import RecentRuns from "./components/RecentRuns";
import GoalCard from "./components/GoalCard";

import { recentRuns, weeklyStats } from "./data/mockRuns";
import "./App.css";

export default function App() {
  const currentWeek = weeklyStats[weeklyStats.length - 1];
  const previousWeek = weeklyStats[weeklyStats.length - 2];

  const weeklyChange =
    previousWeek.distanceKm !== 0
      ? Math.round(
        ((currentWeek.distanceKm - previousWeek.distanceKm) /
          previousWeek.distanceKm) *
        100,
      )
      : 0;

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon"><Activity size={23} /></div>
          <span>Pace<span className="brand-accent">Lab</span></span>
        </div>

        <div className="nav-label">WORKSPACE</div>

        <nav>
          <a className="nav-item active" href="#overview">
            <Activity size={18} /> Overview
          </a>
          <a className="nav-item" href="#trends">
            <TrendingUp size={18} /> Performance
          </a>
          <a className="nav-item" href="#runs">
            <Footprints size={18} /> All runs
          </a>
          <a className="nav-item" href="#goal">
            <Target size={18} /> Race goals
          </a>
        </nav>

        <div className="sidebar-bottom">
          <div className="sync-status">
            <span className="status-dot" />
            <div>
              <strong>Demo mode</strong>
              <small>Sample running data</small>
            </div>
          </div>
          <p>PACE LAB <span>v0.1</span></p>
        </div>
      </aside>

      <section className="main-content" id="overview">
        <header className="topbar">
          <div>
            <div className="eyebrow">YOUR RUNNING, DECODED</div>
            <h1>Running overview<span className="period">.</span></h1>
            <p className="subtitle">
              Every kilometre tells a story. Here's yours.
            </p>
          </div>

          <div className="date-pill">
            <CalendarDays size={16} /> Week of Oct 19
          </div>
        </header>

        <div className="demo-banner">
          <Activity size={17} />
          <span>
            <strong>Preview data</strong> — these activities are illustrative,
            not synced from your watch.
          </span>
        </div>

        <section className="metrics-grid">
          <MetricCard
            label="Weekly distance"
            value={String(currentWeek.distanceKm)}
            unit="km"
            change={`${weeklyChange}% vs last week`}
            icon={Footprints}
          />
          <MetricCard
            label="Total runs"
            value="4"
            unit="runs"
            change="Across this week"
            icon={Activity}
          />
          <MetricCard
            label="Avg. pace"
            value="5:24"
            unit="/km"
            change="12 sec faster vs last month"
            icon={Clock3}
          />
          <MetricCard
            label="Avg. heart rate"
            value="148"
            unit="bpm"
            change="Across recent activities"
            icon={Heart}
          />
        </section>

        <section className="charts-grid" id="trends">
          <MileageChart data={weeklyStats} />
          <PaceChart data={weeklyStats} />
        </section>

        <section className="bottom-grid">
          <RecentRuns runs={recentRuns} />
          <GoalCard />
        </section>

        <footer className="footer">
          <span>PACE LAB <span className="footer-dot">·</span> BUILT FOR THE LONG RUN</span>
          <span>Run your own race.</span>
        </footer>
      </section>
    </main>
  );
}
