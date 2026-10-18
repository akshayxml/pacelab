import { useCallback, useEffect, useState } from "react";
import { authApi, PROVIDER_LABELS } from "../api/authApi";
import type { Athlete, DataProvider } from "../types/activity";

export type ConnectionState =
  | "checking"
  | "connected"
  | "disconnected"
  /** Backend not reachable; app falls back to demo data. */
  | "unavailable";

const STRAVA_CALLBACK_MESSAGES: Record<string, string> = {
  connected: "Strava connected. Your latest runs are loaded below.",
  denied: "Strava authorization was cancelled.",
  missing_scope:
    "PaceLab needs permission to read your activities. Please reconnect and allow activity access.",
  invalid_state: "The Strava login session expired. Please try again.",
  error: "Something went wrong connecting to Strava. Please try again.",
};

/** Reads and strips the ?strava= param set by the backend OAuth callback. */
function consumeCallbackParam(): string | null {
  const url = new URL(window.location.href);
  const status = url.searchParams.get("strava");
  if (!status) return null;

  url.searchParams.delete("strava");
  window.history.replaceState(null, "", url.toString());
  return STRAVA_CALLBACK_MESSAGES[status] ?? null;
}

/** Tracks which data provider the backend uses and whether it's connected. */
export function useConnection() {
  const [state, setState] = useState<ConnectionState>("checking");
  const [provider, setProvider] = useState<DataProvider | null>(null);
  const [athlete, setAthlete] = useState<Athlete | null>(null);
  const [notice, setNotice] = useState<string | null>(consumeCallbackParam);

  useEffect(() => {
    let cancelled = false;

    authApi
      .getStatus()
      .then((status) => {
        if (cancelled) return;
        setProvider(status.provider);
        setAthlete(status.athlete);
        setState(status.connected ? "connected" : "disconnected");
      })
      .catch(() => {
        if (!cancelled) setState("unavailable");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  /** Call when an API request returns 401 (e.g. token revoked). */
  const markDisconnected = useCallback((message?: string) => {
    setAthlete(null);
    setState("disconnected");
    if (message) setNotice(message);
  }, []);

  const disconnectStrava = useCallback(async () => {
    try {
      await authApi.disconnectStrava();
    } finally {
      markDisconnected("Strava disconnected. Showing demo data.");
    }
  }, [markDisconnected]);

  const dismissNotice = useCallback(() => setNotice(null), []);

  return {
    state,
    provider,
    providerLabel: provider ? PROVIDER_LABELS[provider] : null,
    athlete,
    notice,
    isConnected: state === "connected",
    /** Strava needs a user OAuth login; Intervals.icu is configured server-side. */
    canConnect: provider === "strava" && state === "disconnected",
    canDisconnect: provider === "strava" && state === "connected",
    markDisconnected,
    disconnectStrava,
    dismissNotice,
  };
}
