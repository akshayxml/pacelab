import type { SourceActivity } from "../types/activity.js";
import { FULL_SYNC_MS, mergeActivities, syncWindow } from "./activitySync.js";

/** Re-check the provider for new or edited activities at most this often. */
const SYNC_TTL_MS = 5 * 60 * 1000;

/** What the cache needs from an activity source. */
export interface HistoryFetcher {
  /** The athlete's entire activity history. */
  listAll(): Promise<SourceActivity[]>;
  /** All activities since `after` (Unix seconds). */
  listSince(after: number): Promise<SourceActivity[]>;
}

interface HistoryEntry {
  /** Every activity, newest first. */
  activities: SourceActivity[];
  /** Last full download. */
  fullSyncAt: number;
  /** Last full or incremental sync. */
  syncedAt: number;
}

/**
 * One cached activity history per scope (per Strava session, or per
 * provider for single-user providers like Intervals.icu). The full history
 * is downloaded once a day; in between, only the last few weeks are
 * re-fetched (at most every 5 min) and merged in. Recent runs, weekly
 * stats, history and best efforts all read from this one list.
 */
class ActivityCache {
  private readonly entries = new Map<string, HistoryEntry>();
  private readonly inflight = new Map<string, Promise<SourceActivity[]>>();

  getHistory(scope: string, source: HistoryFetcher): Promise<SourceActivity[]> {
    const entry = this.entries.get(scope);
    const now = Date.now();
    if (entry && now - entry.syncedAt < SYNC_TTL_MS) {
      return Promise.resolve(entry.activities);
    }

    // Concurrent requests share one upstream sync.
    let pending = this.inflight.get(scope);
    if (!pending) {
      pending = this.sync(scope, source, entry).finally(() => {
        this.inflight.delete(scope);
      });
      this.inflight.set(scope, pending);
    }
    return pending;
  }

  private async sync(
    scope: string,
    source: HistoryFetcher,
    entry: HistoryEntry | undefined,
  ): Promise<SourceActivity[]> {
    const now = Date.now();
    let next: HistoryEntry;
    if (entry && now - entry.fullSyncAt < FULL_SYNC_MS) {
      const { fetchAfter, replaceFrom } = syncWindow(now);
      const fresh = await source.listSince(fetchAfter);
      next = {
        activities: mergeActivities(entry.activities, fresh, replaceFrom),
        fullSyncAt: entry.fullSyncAt,
        syncedAt: now,
      };
    } else {
      const all = await source.listAll();
      next = {
        // Providers differ in ordering (Strava returns `after` pages oldest
        // first), so always sort.
        activities: [...all].sort((a, b) => b.startDateLocal.localeCompare(a.startDateLocal)),
        fullSyncAt: now,
        syncedAt: now,
      };
    }
    // Skip the write if the scope was cleared (e.g. logout) mid-request.
    if (this.inflight.has(scope)) this.entries.set(scope, next);
    return next.activities;
  }

  clear(scope: string): void {
    this.entries.delete(scope);
    this.inflight.delete(scope);
  }
}

export const activityCache = new ActivityCache();
