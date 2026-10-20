
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  CalendarDays,
  ChartLine,
  Footprints,
  Gauge,
  LayoutDashboard,
  LogOut,
  Moon,
  Sun,
  TrendingUp,
  X,
} from "lucide-react";

import MetricCard from "./components/MetricCard";
import MileageChart from "./components/MileageChart";
import PaceChart from "./components/PaceChart";
import RecentRuns from "./components/RecentRuns";
import YearlyProgress from "./components/YearlyProgress";

import { ApiError } from "./api/apiClient";
import { STRAVA_LOGIN_URL } from "./api/authApi";
import { useConnection } from "./hooks/useConnection";
import { useTheme } from "./hooks/useTheme";
import { apiActivityRepository } from "./repositories/apiActivityRepository";
import { mockActivityRepository } from "./repositories/mockActivityRepository";
import type { RunActivity, WeeklyStats } from "./types/activity";


type Tab = "overview" | "activities" | "progress";

const TABS = {
  overview: {
    label: "Overview",
    icon: LayoutDashboard,
    eyebrow: "YOUR RUNNING JOURNAL",
    title: "Running overview",
    subtitle: "Track your training, understand your progress, and run smarter.",
  },
  activities: {
    label: "Recent activities",
    icon: Footprints,
    eyebrow: "TRAINING LOG",
    title: "Recent activities",
    subtitle: "Your latest running sessions, newest first.",
  },
  progress: {
    label: "Yearly progress",
    icon: ChartLine,
    eyebrow: "YEAR OVER YEAR",
    title: "Yearly progress",
    subtitle: "How your training time and distance build up across each year.",
  },
} as const;

/** The active tab lives in the URL hash so it survives reloads and back/forward. */
function tabFromHash(): Tab {
  const hash = window.location.hash.slice(1);
  return hash in TABS ? (hash as Tab) : "overview";
}

function formatPaceMinutes(minutes: number | null | undefined): string {
  if (minutes == null) return "--";
  const totalSeconds = Math.round(minutes * 60);
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, "0")}`;
}

function App() {
  const connection = useConnection();
  const { theme, toggleTheme } = useTheme();
  const [activeTab, setActiveTab] = useState<Tab>(tabFromHash);
  const page = TABS[activeTab];

  useEffect(() => {
    const onHashChange = () => setActiveTab(tabFromHash());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);
  const { isConnected, markDisconnected } = connection;
  const providerLabel = connection.providerLabel ?? "your data source";
  const isCheckingConnection = connection.state === "checking";

  const handleHistoryUnauthorized = useCallback(
    () => markDisconnected(`Your ${providerLabel} session expired. Please reconnect.`),
    [markDisconnected, providerLabel],
  );

  const repository = useMemo(
    () => (isConnected ? apiActivityRepository : mockActivityRepository),
    [isConnected],
  );

  const [recentRuns, setRecentRuns] = useState<RunActivity[]>([]);
  const [weeklyStats, setWeeklyStats] = useState<WeeklyStats[]>([]);
  const [loadingDashboard, setLoadingDashboard] = useState(true);
  const [dashboardError, setDashboardError] = useState<string | null>(null);

  useEffect(() => {
    // Wait until we know which data source to use.
    if (isCheckingConnection) return;

    let cancelled = false;

    async function loadDashboardData() {
      setLoadingDashboard(true);
      setDashboardError(null);

      try {
        const [runs, stats] = await Promise.all([
          repository.getRecentRuns(),
          repository.getWeeklyStats(),
        ]);
        if (cancelled) return;

        setRecentRuns(runs);
        setWeeklyStats(stats);
      } catch (error) {
        if (cancelled) return;

        if (error instanceof ApiError && error.isUnauthorized) {
          // Token revoked or session lost: fall back to demo data.
          markDisconnected(
            `Your ${providerLabel} session expired. Please reconnect.`,
          );
          return;
        }
        setDashboardError(
          error instanceof ApiError && error.status === 429
            ? `${providerLabel} rate limit reached. Please try again in a few minutes.`
            : error instanceof ApiError && error.status === 403
              ? `${providerLabel} refused access. Check the app/API key status in your ${providerLabel} settings.`
              : "Failed to load dashboard data.",
        );
      } finally {
        if (!cancelled) setLoadingDashboard(false);
      }
    }

    void loadDashboardData();

    return () => {
      cancelled = true;
    };
  }, [repository, isCheckingConnection, markDisconnected, providerLabel]);

  const currentWeek = weeklyStats[weeklyStats.length - 1];
  const previousWeek = weeklyStats[weeklyStats.length - 2];

  const weeklyChange =
    currentWeek && previousWeek && previousWeek.distanceKm !== 0
      ? ((currentWeek.distanceKm - previousWeek.distanceKm) /
          previousWeek.distanceKm) *
      100
      : null;

  // Only average runs that were recorded with a heart-rate monitor.
  const heartRates = recentRuns
    .map((run) => run.averageHeartRate)
    .filter((hr): hr is number => hr !== null);
  const averageHeartRate =
    heartRates.length > 0
      ? Math.round(
        heartRates.reduce((total, hr) => total + hr, 0) / heartRates.length,
      )
      : null;

  const weeklyChangeLabel =
    weeklyChange === null
      ? "Weekly overview"
      : `${weeklyChange > 0 ? "+" : ""}${weeklyChange.toFixed(1)}% vs last week`;

  const disconnectedMessage =
    connection.provider === "intervals"
      ? "Couldn't reach Intervals.icu. Check INTERVALS_API_KEY in backend/.env. Showing sample data."
      : "You're viewing sample running data. Connect Strava to see your own runs.";

  const bannerMessage =
    connection.notice ??
    (loadingDashboard
      ? "Loading your activity data..."
      : dashboardError
        ? dashboardError
        : isConnected
          ? `Showing your latest runs from ${providerLabel}.`
          : connection.state === "unavailable"
            ? "Backend is offline, so you're viewing sample running data."
            : disconnectedMessage);

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
          {(Object.keys(TABS) as Tab[]).map((tab) => {
            const { label, icon: Icon } = TABS[tab];
            return (
              <a
                key={tab}
                id={`tab-${tab}`}
                className={`nav-item ${activeTab === tab ? "active" : ""}`}
                href={`#${tab}`}
                aria-current={activeTab === tab ? "page" : undefined}
              >
                <Icon size={18} />
                <span>{label}</span>
              </a>
            );
          })}
        </nav>

        <div className="sidebar-bottom">
          <div className="nav-label">DATA SOURCE</div>
          <div className={`sync-status ${isConnected ? "connected" : ""}`}>
            {isConnected && connection.athlete?.profileImageUrl ? (
              <img
                className="athlete-avatar"
                src={connection.athlete.profileImageUrl}
                alt=""
              />
            ) : (
              <span className="status-dot" />
            )}
            <div>
              <strong>
                {isConnected
                  ? `${providerLabel} · ${connection.athlete?.firstName || "Connected"}`
                  : "Demo data"}
              </strong>
              <small>
                {isCheckingConnection
                  ? "Checking connection..."
                  : isConnected
                    ? `Synced from ${providerLabel}`
                    : connection.state === "unavailable"
                      ? "Backend offline"
                      : `${providerLabel} not connected`}
              </small>
            </div>
          </div>

          {connection.canDisconnect && (
            <button
              type="button"
              className="nav-item strava-disconnect"
              onClick={() => void connection.disconnectStrava()}
            >
              <LogOut size={18} />
              <span>Disconnect Strava</span>
            </button>
          )}
          {connection.canConnect && (
            <a className="strava-connect" href={STRAVA_LOGIN_URL}>
              Connect with Strava
            </a>
          )}

          <button
            type="button"
            id="theme-toggle"
            className="nav-item theme-toggle"
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
          >
            {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
            <span>{theme === "dark" ? "Light mode" : "Dark mode"}</span>
          </button>
        </div>
      </aside>

      <section className="main-content">
        <header className="topbar">
          <div>
            <div className="eyebrow">{page.eyebrow}</div>
            <h1>{page.title}</h1>
            <p className="subtitle">{page.subtitle}</p>
          </div>

          <div className="date-pill">
            <CalendarDays size={16} />
            <span>
              {activeTab === "activities"
                ? `${recentRuns.length} runs`
                : "Training dashboard"}
            </span>
          </div>
        </header>

        <div className="demo-banner">
          <div className="demo-banner-icon">
            <Activity size={18} />
          </div>
          <div className="demo-banner-text">
            <strong>Your training at a glance</strong>
            <p>{bannerMessage}</p>
          </div>
          {connection.notice ? (
            <button
              type="button"
              className="banner-dismiss"
              aria-label="Dismiss"
              onClick={connection.dismissNotice}
            >
              <X size={16} />
            </button>
          ) : (
            connection.canConnect && (
              <a className="strava-connect banner-cta" href={STRAVA_LOGIN_URL}>
                Connect with Strava
              </a>
            )
          )}
        </div>

        {!loadingDashboard && !dashboardError && activeTab === "overview" && (
          <div className="tab-panel" key="overview">
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
                value={formatPaceMinutes(currentWeek?.averagePaceMinutes)}
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
              <MileageChart data={weeklyStats} />
              <PaceChart data={weeklyStats} />
            </section>
          </div>
        )}

        {!loadingDashboard && !dashboardError && activeTab === "activities" && (
          <div className="tab-panel" key="activities">
            <RecentRuns runs={recentRuns} />
          </div>
        )}

        {activeTab === "progress" && !isCheckingConnection && (
          <div className="tab-panel" key="progress">
            <YearlyProgress
              key={isConnected ? "live" : "demo"}
              repository={repository}
              onUnauthorized={handleHistoryUnauthorized}
            />
          </div>
        )}

        {loadingDashboard && activeTab !== "progress" && (
          <div className="panel loading-panel">
            Loading dashboard data...
          </div>
        )}

        {dashboardError && activeTab !== "progress" && (
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
