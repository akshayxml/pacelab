// Incremental activity sync: after one full download, only the last few
// weeks are re-fetched and merged into the cached list.
// Ported from backend/src/activities/activitySync.ts; keep in sync.

import type { SourceActivity } from "./types";

/**
 * Days re-fetched on an incremental sync. Edits or deletions of older
 * activities show up at the next full sync.
 */
export const SYNC_WINDOW_DAYS = 14;
/** How long a full download stays valid before the whole list is re-fetched. */
export const FULL_SYNC_MS = 24 * 60 * 60 * 1000;

const DAY_MS = 86_400_000;

export interface SyncWindow {
  /** Unix seconds to request activities after (two days before `replaceFrom`). */
  fetchAfter: number;
  /** Local date (YYYY-MM-DD); cached activities on/after it are replaced. */
  replaceFrom: string;
}

/**
 * Fetches from two days before `replaceFrom` (UTC midnight). An activity
 * whose local date is on/after `replaceFrom` started at most 14 h earlier
 * in UTC, so it is always in the fresh batch, whether the provider filters
 * by UTC time (Strava) or local date (Intervals.icu).
 */
export function syncWindow(now = Date.now()): SyncWindow {
  const replaceFrom = new Date(now - SYNC_WINDOW_DAYS * DAY_MS).toISOString().slice(0, 10);
  return {
    fetchAfter: Math.floor((Date.parse(replaceFrom) - 2 * DAY_MS) / 1000),
    replaceFrom,
  };
}

/** Cached activities before the window plus the fresh batch, newest first. */
export function mergeActivities(
  cached: SourceActivity[],
  fresh: SourceActivity[],
  replaceFrom: string,
): SourceActivity[] {
  const byId = new Map<string, SourceActivity>();
  for (const a of cached) {
    if (a.startDateLocal.slice(0, 10) < replaceFrom) byId.set(a.id, a);
  }
  for (const a of fresh) byId.set(a.id, a);
  return [...byId.values()].sort((a, b) => b.startDateLocal.localeCompare(a.startDateLocal));
}
