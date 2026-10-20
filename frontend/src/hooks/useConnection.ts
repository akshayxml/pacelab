import { useCallback, useEffect, useState } from "react";
import { ApiError } from "../api/apiClient";
import { authApi, PROVIDER_LABELS } from "../api/authApi";
import { STANDALONE } from "../config";
import { getAthlete } from "../intervals/client";
import {
  apiKeyStore,
  athleteStore,
  claimCache,
  clearDeviceData,
} from "../intervals/storage";
import { clearActivityCache } from "../repositories/apiActivityRepository";
import { resetIntervalsRepository } from "../repositories/intervalsActivityRepository";
import type { Athlete, DataProvider } from "../types/activity";

export type ConnectionState =
  | "checking"
  | "connected"
  | "disconnected"
  /** Backend not reachable; app falls back to demo data. */
  | "unavailable";

/**
 * How the user connects: Strava's OAuth redirect (backend build) or pasting
 * an Intervals.icu API key (static build). null when there's nothing to do.
 */
export type ConnectMethod = "strava" | "api-key" | null;

export interface Connection {
  state: ConnectionState;
  provider: DataProvider | null;
  providerLabel: string | null;
  athlete: Athlete | null;
  notice: string | null;
  isConnected: boolean;
  connectMethod: ConnectMethod;
  canDisconnect: boolean;
  /** Validates and saves an Intervals.icu API key; throws a user-facing Error. */
  connectWithKey: (apiKey: string) => Promise<void>;
  disconnect: () => Promise<void>;
  /** Call when an API request returns 401 (e.g. token or key revoked). */
  markDisconnected: (message?: string) => void;
  dismissNotice: () => void;
}

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

/** Backend build: tracks which provider the backend uses and whether it's connected. */
function useBackendConnection(): Connection {
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

  const markDisconnected = useCallback((message?: string) => {
    clearActivityCache();
    setAthlete(null);
    setState("disconnected");
    if (message) setNotice(message);
  }, []);

  const disconnect = useCallback(async () => {
    try {
      await authApi.disconnectStrava();
    } finally {
      markDisconnected("Strava disconnected. Showing demo data.");
    }
  }, [markDisconnected]);

  const connectWithKey = useCallback(async () => {
    throw new Error("API keys are configured on the backend.");
  }, []);

  const dismissNotice = useCallback(() => setNotice(null), []);

  return {
    state,
    provider,
    providerLabel: provider ? PROVIDER_LABELS[provider] : null,
    athlete,
    notice,
    isConnected: state === "connected",
    // Intervals.icu is configured server-side; only Strava needs a user login.
    connectMethod: provider === "strava" && state === "disconnected" ? "strava" : null,
    canDisconnect: provider === "strava" && state === "connected",
    connectWithKey,
    disconnect,
    markDisconnected,
    dismissNotice,
  };
}

function isAuthError(err: unknown): boolean {
  return err instanceof ApiError && (err.status === 401 || err.status === 403);
}

/** Static build: the user's Intervals.icu API key lives in this browser. */
function useBrowserConnection(): Connection {
  const [state, setState] = useState<ConnectionState>(() =>
    apiKeyStore.get() ? "checking" : "disconnected",
  );
  const [athlete, setAthlete] = useState<Athlete | null>(() =>
    apiKeyStore.get() ? athleteStore.get() : null,
  );
  const [notice, setNotice] = useState<string | null>(null);

  // Re-validate the saved key on start (and refresh the athlete's name/photo).
  useEffect(() => {
    const apiKey = apiKeyStore.get();
    if (!apiKey) return;
    let cancelled = false;

    getAthlete(apiKey)
      .then((current) => {
        if (cancelled) return;
        athleteStore.set(current);
        setAthlete(current);
        setState("connected");
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (isAuthError(err)) {
          apiKeyStore.clear();
          resetIntervalsRepository();
          setAthlete(null);
          setState("disconnected");
          setNotice("Intervals.icu no longer accepts your saved API key. Please connect again.");
          return;
        }
        // Offline or Intervals.icu is down: keep the key and show cached data.
        setState("connected");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const connectWithKey = useCallback(async (input: string) => {
    const apiKey = input.trim();
    if (!apiKey) throw new Error("Paste your API key first.");

    let current: Athlete;
    try {
      current = await getAthlete(apiKey);
    } catch (err) {
      throw new Error(
        isAuthError(err)
          ? "Intervals.icu didn't accept that API key. Copy it again from your Intervals.icu settings."
          : "Couldn't reach Intervals.icu. Check your connection and try again.",
      );
    }

    await claimCache(current.id).catch(() => {});
    resetIntervalsRepository();
    apiKeyStore.set(apiKey);
    athleteStore.set(current);
    setAthlete(current);
    setState("connected");
    setNotice(null);
    // Ask the browser not to evict the key and cached analysis under storage pressure.
    void navigator.storage?.persist?.().catch(() => {});
  }, []);

  const markDisconnected = useCallback((message?: string) => {
    apiKeyStore.clear();
    resetIntervalsRepository();
    setAthlete(null);
    setState("disconnected");
    if (message) setNotice(message);
  }, []);

  const disconnect = useCallback(async () => {
    resetIntervalsRepository();
    await clearDeviceData().catch(() => {});
    setAthlete(null);
    setState("disconnected");
    setNotice("Disconnected. Your API key and cached runs were removed from this browser.");
  }, []);

  const dismissNotice = useCallback(() => setNotice(null), []);

  return {
    state,
    provider: "intervals",
    providerLabel: PROVIDER_LABELS.intervals,
    athlete,
    notice,
    isConnected: state === "connected",
    connectMethod: state === "disconnected" ? "api-key" : null,
    canDisconnect: state === "connected",
    connectWithKey,
    disconnect,
    markDisconnected,
    dismissNotice,
  };
}

/** Connection to the user's data, via the backend or directly from the browser. */
export const useConnection = STANDALONE ? useBrowserConnection : useBackendConnection;
