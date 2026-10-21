
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  CalendarDays,
  ChartLine,
  Footprints,
  Gauge,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Route,
  Sun,
  Trophy,
  X,
} from "lucide-react";

import BestEfforts from "./components/BestEfforts";
import ConnectIntervals from "./components/ConnectIntervals";
import MetricCard from "./components/MetricCard";
import MileageChart from "./components/MileageChart";
import TrainingLoadChart from "./components/TrainingLoadChart";
import RecentRuns from "./components/RecentRuns";
import YearlyProgress from "./components/YearlyProgress";

import { ApiError } from "./api/apiClient";
import { STRAVA_LOGIN_URL } from "./api/authApi";
import { STANDALONE } from "./config";
import { useConnection } from "./hooks/useConnection";
import { useRunHistory } from "./hooks/useRunHistory";
import { useTheme } from "./hooks/useTheme";
import { previousPeriodToDate } from "./lib/mileage";
import { longestRuns, periodToDateKm } from "./lib/overviewMetrics";
import { LOAD_ZONE_LABELS, loadZone, trainingLoad } from "./lib/trainingLoad";
import { apiActivityRepository } from "./repositories/apiActivityRepository";
import { intervalsActivityRepository } from "./repositories/intervalsActivityRepository";
import { mockActivityRepository } from "./repositories/mockActivityRepository";
import type { RunActivity, WeeklyStats } from "./types/activity";


type Tab = "overview" | "activities" | "progress" | "best";

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
    subtitle: "How your running distance and time build up across each year.",
  },
  best: {
    label: "Best efforts",
    icon: Trophy,
    eyebrow: "PERSONAL RECORDS",
    title: "Best efforts",
    subtitle: "Your fastest times over standard distances, found inside every run.",
  },
} as const;

/** The active tab lives in the URL hash so it survives reloads and back/forward. */
function tabFromHash(): Tab {
  const hash = window.location.hash.slice(1);
  return hash in TABS ? (hash as Tab) : "overview";
}

function App() {
  const connection = useConnection();
  const { theme, toggleTheme } = useTheme();
  const [activeTab, setActiveTab] = useState<Tab>(tabFromHash);
  const page = TABS[activeTab];

  // Per-tab browser title, e.g. "Best efforts · PaceLab".
  useEffect(() => {
    document.title = `${page.label} · PaceLab`;
  }, [page.label]);

  useEffect(() => {
    const onHashChange = () => {
      setActiveTab(tabFromHash());
      setNavOpen(false);
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  // Phone layout: the sidebar is a drawer opened from a menu button.
  const [navOpen, setNavOpen] = useState(false);
  const navToggleRef = useRef<HTMLButtonElement>(null);
  const navCloseRef = useRef<HTMLButtonElement>(null);
  const closeNav = useCallback(() => {
    setNavOpen(false);
    navToggleRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!navOpen) return;
    navCloseRef.current?.focus();
    document.body.classList.add("nav-open");
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeNav();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.classList.remove("nav-open");
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [navOpen, closeNav]);
  const { isConnected, markDisconnected } = connection;
  const providerLabel = connection.providerLabel ?? "your data source";
  const isCheckingConnection = connection.state === "checking";

  const handleHistoryUnauthorized = useCallback(
    () => markDisconnected(`Your ${providerLabel} session expired. Please reconnect.`),
    [markDisconnected, providerLabel],
  );

  const repository = useMemo(
    () =>
      !isConnected
        ? mockActivityRepository
        : STANDALONE
          ? intervalsActivityRepository
          : apiActivityRepository,
    [isConnected],
  );

  // API-key form (static build); shown on request while disconnected.
  const [showConnectForm, setShowConnectForm] = useState(false);
  // Avatar URL that failed to load (e.g. a host the CSP doesn't allow).
  const [failedAvatarUrl, setFailedAvatarUrl] = useState<string | null>(null);
  const connectWithKey = connection.connectWithKey;
  const handleConnectWithKey = useCallback(
    async (apiKey: string) => {
      await connectWithKey(apiKey);
      setShowConnectForm(false);
    },
    [connectWithKey],
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

  // Run history powers the overview cards (cached and shared with the charts).
  const { entries: history } = useRunHistory(
    repository,
    handleHistoryUnauthorized,
    !isCheckingConnection,
  );

  const overview = useMemo(() => {
    if (!history) return null;
    return {
      monthKm: periodToDateKm(history, "month"),
      previousMonthKm: previousPeriodToDate(history, "month"),
      yearKm: periodToDateKm(history, "year"),
      previousYearKm: previousPeriodToDate(history, "year"),
      longest: longestRuns(history, 28),
      ratio: trainingLoad(history, 1)[0]?.ratio ?? null,
    };
  }, [history]);

  const percentLabel = (current: number, previous: number, suffix: string) => {
    const pct = ((current - previous) / previous) * 100;
    return `${pct > 0 ? "+" : ""}${pct.toFixed(1)}% ${suffix}`;
  };

  const monthChangeLabel = !overview
    ? "Loading..."
    : overview.previousMonthKm > 0
      ? percentLabel(overview.monthKm, overview.previousMonthKm, "vs this time last month")
      : "This month so far";

  const yearChangeLabel = !overview
    ? "Loading..."
    : overview.previousYearKm > 0
      ? percentLabel(overview.yearKm, overview.previousYearKm, "vs this time last year")
      : "This year so far";

  const longestRunLabel = !overview
    ? "Loading..."
    : overview.longest.previousKm > 0
      ? `Last 4 weeks · was ${overview.longest.previousKm.toFixed(1)} km the 4 weeks prior`
      : "Last 4 weeks";

  const loadLabel = !overview
    ? "Loading..."
    : overview.ratio != null
      ? LOAD_ZONE_LABELS[loadZone(overview.ratio)]
      : "Not enough recent runs";

  const disconnectedMessage = STANDALONE
    ? "You're viewing sample running data. Connect Intervals.icu to see your own runs."
    : connection.provider === "intervals"
      ? "Couldn't reach Intervals.icu. Check INTERVALS_API_KEY in backend/.env. Showing sample data."
      : "You're viewing sample running data. Connect Strava to see your own runs.";

  // Opens the Strava consent screen, or the API-key form in the static build.
  const connectButton = (className: string) =>
    connection.connectMethod === "strava" ? (
      <a className={`strava-connect ${className}`} href={STRAVA_LOGIN_URL}>
        Connect with Strava
      </a>
    ) : connection.connectMethod === "api-key" && !showConnectForm ? (
      <button
        type="button"
        className={`button-primary connect-cta ${className}`}
        onClick={() => {
          setShowConnectForm(true);
          setNavOpen(false);
        }}
      >
        Connect Intervals.icu
      </button>
    ) : null;

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
      <button
        ref={navToggleRef}
        type="button"
        id="nav-toggle"
        className="nav-toggle"
        aria-label="Open menu"
        aria-expanded={navOpen}
        aria-controls="sidebar"
        onClick={() => setNavOpen(true)}
      >
        <Menu size={20} />
      </button>
      {navOpen && <div className="sidebar-backdrop" aria-hidden onClick={closeNav} />}

      <aside id="sidebar" className={`sidebar ${navOpen ? "open" : ""}`}>
        <div className="brand">
          <div className="brand-icon">
            <Activity size={22} />
          </div>
          <span>
            Pace<span className="brand-accent">Lab</span>
          </span>
          <button
            ref={navCloseRef}
            type="button"
            className="sidebar-close"
            aria-label="Close menu"
            onClick={closeNav}
          >
            <X size={18} />
          </button>
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
                // The current tab doesn't fire hashchange, so close here too.
                onClick={() => setNavOpen(false)}
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
            {isConnected &&
            connection.athlete?.profileImageUrl &&
            connection.athlete.profileImageUrl !== failedAvatarUrl ? (
              <img
                className="athlete-avatar"
                src={connection.athlete.profileImageUrl}
                alt=""
                onError={(e) => setFailedAvatarUrl(e.currentTarget.getAttribute("src"))}
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
              id="disconnect"
              className="nav-item strava-disconnect"
              onClick={() => void connection.disconnect()}
            >
              <LogOut size={18} />
              <span>Disconnect {providerLabel}</span>
            </button>
          )}
          {connectButton("")}

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
          {connectButton("banner-cta")}
          {connection.notice && (
            <button
              type="button"
              className="banner-dismiss"
              aria-label="Dismiss"
              onClick={connection.dismissNotice}
            >
              <X size={16} />
            </button>
          )}
        </div>

        {showConnectForm && connection.connectMethod === "api-key" && (
          <ConnectIntervals
            onConnect={handleConnectWithKey}
            onCancel={() => setShowConnectForm(false)}
          />
        )}

        {!loadingDashboard && !dashboardError && activeTab === "overview" && (
          <div className="tab-panel" key="overview">
            <section className="metrics-grid">
              <MetricCard
                label="Monthly Distance"
                value={overview ? overview.monthKm.toFixed(1) : "--"}
                unit="km"
                change={monthChangeLabel}
                icon={CalendarDays}
              />

              <MetricCard
                label="Yearly Distance"
                value={
                  overview
                    ? Math.round(overview.yearKm).toLocaleString("en-US")
                    : "--"
                }
                unit="km"
                change={yearChangeLabel}
                icon={ChartLine}
              />

              <MetricCard
                label="Longest Run"
                value={overview ? overview.longest.currentKm.toFixed(1) : "--"}
                unit="km"
                change={longestRunLabel}
                icon={Route}
              />

              <MetricCard
                label="Training Load"
                value={overview?.ratio != null ? overview.ratio.toFixed(2) : "--"}
                unit="ratio"
                change={loadLabel}
                icon={Gauge}
              />
            </section>

            <section className="charts-grid">
              <MileageChart
                weekly={weeklyStats}
                repository={repository}
                onUnauthorized={handleHistoryUnauthorized}
              />
              <TrainingLoadChart
                repository={repository}
                onUnauthorized={handleHistoryUnauthorized}
              />
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

        {activeTab === "best" && !isCheckingConnection && (
          <div className="tab-panel" key="best">
            <BestEfforts
              key={isConnected ? "live" : "demo"}
              repository={repository}
              onUnauthorized={handleHistoryUnauthorized}
            />
          </div>
        )}

        {loadingDashboard && activeTab !== "progress" && activeTab !== "best" && (
          <div className="panel loading-panel">
            Loading dashboard data...
          </div>
        )}

        {dashboardError && activeTab !== "progress" && activeTab !== "best" && (
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
