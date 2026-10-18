
import { useEffect, useState } from "react";
import {
  Activity,
  BarChart3,
  CalendarDays,
  Footprints,
  Gauge,
  LayoutDashboard,
  Settings,
  TrendingUp,
} from "lucide-react";

import MetricCard from "./components/MetricCard";
import MileageChart from "./components/MileageChart";
import PaceChart from "./components/PaceChart";
import RecentRuns from "./components/RecentRuns";
import GoalCard from "./components/GoalCard";

import { mockActivityRepository } from "./repositories/mockActivityRepository";
import type { RunActivity, WeeklyStats } from "./types/activity";

import "./App.css";

function App() {
  const [recentRuns, setRecentRuns] = useState<RunActivity[]>([]);
  const [weeklyStats, setWeeklyStats] = useState<WeeklyStats[]>([]);
  const [loadingDashboard, setLoadingDashboard] = useState(true);
  const [dashboardError, setDashboardError] = useState<string | null>(null);

  useEffect(() => {
    async function loadDashboardData() {
      try {
        const [runs, stats] = await Promise.all([
          mockActivityRepository.getRecentRuns(),
          mockActivityRepository.getWeeklyStats(),
        ]);

        setRecentRuns(runs);
        setWeeklyStats(stats);
      } catch {
        setDashboardError("Failed to load dashboard data.");
      } finally {
        setLoadingDashboard(false);
      }
    }

    void loadDashboardData();
  }, []);

  const currentWeek = weeklyStats[weeklyStats.length - 1];
  const previousWeek = weeklyStats[weeklyStats.length - 2];

  const weeklyChange =
    currentWeek && previousWeek && previousWeek.distanceKm !== 0
      ? ((currentWeek.distanceKm - previousWeek.distanceKm) /
          previousWeek.distanceKm) *
      100
      : null;

  const averageHeartRate =
    recentRuns.length > 0
      ? Math.round(
        recentRuns.reduce(
          (total, run) => total + run.averageHeartRate,
          0,
        ) / recentRuns.length,
      )
      : null;

  const weeklyChangeLabel =
    weeklyChange === null
      ? "Weekly overview"
      : `${weeklyChange > 0 ? "+" : ""}${weeklyChange.toFixed(1)}% vs last week`;

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">
            <Activity size={22} />
          </div>
          <span>
            Pace<span className="brand-accent">Lab</span>
          </span>
        </div>

        <div className="nav-label">WORKSPACE</div>

        <nav>
          <a className="nav-item active" href="#overview">
            <LayoutDashboard size={18} />
            <span>Overview</span>
          </a>

          <a className="nav-item" href="#mileage">
            <BarChart3 size={18} />
            <span>Statistics</span>
          </a>

          <a className="nav-item" href="#recent-runs">
            <Footprints size={18} />
            <span>Activities</span>
          </a>

          <a className="nav-item" href="#goal">
            <TrendingUp size={18} />
            <span>Goals</span>
          </a>
        </nav>

        <div className="sidebar-bottom">
          <div className="nav-label">DATA SOURCE</div>
          <div className="sync-status">
            <span className="status-dot" />
            <div>
              <strong>Demo data</strong>
              <small>Repository connected</small>
            </div>
          </div>

          <a className="nav-item" href="#settings">
            <Settings size={18} />
            <span>Settings</span>
          </a>
        </div>
      </aside>

      <section className="main-content" id="overview">
        <header className="topbar">
          <div>
            <div className="eyebrow">YOUR RUNNING JOURNAL</div>
            <h1>Running overview</h1>
            <p className="subtitle">
              Track your training, understand your progress, and run smarter.
            </p>
          </div>

          <div className="date-pill">
            <CalendarDays size={16} />
            <span>Training dashboard</span>
          </div>
        </header>

        <div className="demo-banner">
          <div className="demo-banner-icon">
            <Activity size={18} />
          </div>
          <div>
            <strong>Your training at a glance</strong>
            <p>
              {loadingDashboard
                ? "Loading your activity data..."
                : dashboardError
                  ? dashboardError
                  : "You're viewing sample running data. Strava integration can be added later."}
            </p>
          </div>
        </div>

        {!loadingDashboard && !dashboardError && (
          <>
            <section className="metrics-grid">
              <MetricCard
                label="Weekly Distance"
                value={currentWeek?.distanceKm.toFixed(1) ?? "--"}
                unit="km"
                change={weeklyChangeLabel}
                icon={Footprints}
              />

              <MetricCard
                label="Average Pace"
                value={
                  currentWeek
                    ? `${Math.floor(currentWeek.averagePaceMinutes)}:${String(
                      Math.round(
                        (currentWeek.averagePaceMinutes % 1) * 60,
                      ) % 60,
                    ).padStart(2, "0")}`
                    : "--"
                }
                unit="/km"
                change="Weekly average"
                icon={Gauge}
              />

              <MetricCard
                label="Recent Runs"
                value={String(recentRuns.length)}
                unit="runs"
                change={`${recentRuns.reduce(
                  (sum, run) => sum + run.distanceKm,
                  0,
                ).toFixed(1)} km total`}
                icon={Activity}
              />

              <MetricCard
                label="Avg. Heart Rate"
                value={averageHeartRate?.toString() ?? "--"}
                unit="bpm"
                change="Across recent runs"
                icon={TrendingUp}
              />
            </section>

            <section className="charts-grid">
              <div className="panel mileage-panel" id="mileage">
                <div className="panel-heading">
                  <div>
                    <h2>Weekly mileage</h2>
                    <p>Your distance over the last several weeks</p>
                  </div>
                </div>
                <MileageChart data={weeklyStats} />
              </div>

              <div className="panel pace-panel">
                <div className="panel-heading">
                  <div>
                    <h2>Pace progression</h2>
                    <p>Track changes in your average running pace</p>
                  </div>
                </div>
                <PaceChart data={weeklyStats} />
              </div>
            </section>

            <section className="bottom-grid">
              <div className="panel runs-panel" id="recent-runs">
                <div className="panel-heading">
                  <div>
                    <h2>Recent activities</h2>
                    <p>Your latest running sessions</p>
                  </div>
                  <span className="activity-count">
                    {recentRuns.length} runs
                  </span>
                </div>

                <RecentRuns runs={recentRuns} />
              </div>

              <div className="panel goal-panel" id="goal">
                <div className="panel-heading">
                  <div>
                    <h2>Race goal</h2>
                    <p>Keep working toward your target</p>
                  </div>
                </div>

                <GoalCard />
              </div>
            </section>
          </>
        )}

        {loadingDashboard && (
          <div className="panel loading-panel">
            Loading dashboard data...
          </div>
        )}

        {dashboardError && (
          <div className="panel error-panel" role="alert">
            {dashboardError}
          </div>
        )}

        <footer className="footer">
          <span>PaceLab</span>
          <span>Built for better running</span>
        </footer>
      </section>
    </main>
  );
}

export default App;
