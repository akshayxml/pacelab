import type { Athlete, DataProvider } from "../types/activity";
import { apiClient } from "./apiClient";

export interface ConnectionStatus {
  provider: DataProvider;
  connected: boolean;
  athlete: Athlete | null;
}

export const PROVIDER_LABELS: Record<DataProvider, string> = {
  strava: "Strava",
  intervals: "Intervals.icu",
};

/** Full-page navigation: the backend redirects to Strava's consent screen. */
export const STRAVA_LOGIN_URL = "/api/auth/strava/login";

export const authApi = {
  getStatus: () => apiClient.get<ConnectionStatus>("/api/auth/me"),
  logout: () => apiClient.post<void>("/api/auth/logout"),
  disconnectStrava: () => apiClient.post<void>("/api/auth/strava/disconnect"),
};
