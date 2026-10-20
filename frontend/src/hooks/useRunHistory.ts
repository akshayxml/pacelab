import { useEffect, useState } from "react";
import { ApiError } from "../api/apiClient";
import type { ActivityRepository } from "../repositories/activityRepository";
import type { ActivityLogEntry } from "../types/activity";

/**
 * Loads every run in the athlete's history. The repository caches the
 * response, so using this in several places (or remounting) doesn't refetch.
 *
 * Pass `enabled = false` to defer loading until the data is actually needed.
 */
export function useRunHistory(
  repository: ActivityRepository,
  /** Called when the backend reports the session is gone. */
  onUnauthorized: () => void,
  enabled = true,
) {
  // Start from cached data when available so views render without a loading flash.
  const [entries, setEntries] = useState<ActivityLogEntry[] | null>(
    () => repository.peekHistory() ?? null,
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    // Resolves from the repository cache when already loaded (no request).
    repository
      .getHistory()
      .then((data) => {
        if (cancelled) return;
        setEntries(data);
        setError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.isUnauthorized) {
          onUnauthorized();
          return;
        }
        setError(
          err instanceof ApiError && err.status === 429
            ? "Rate limit reached. Please try again in a few minutes."
            : "Failed to load your run history.",
        );
      });

    return () => {
      cancelled = true;
    };
  }, [repository, onUnauthorized, enabled]);

  return { entries, error };
}
