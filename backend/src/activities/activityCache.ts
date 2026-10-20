import type { SourceActivity } from "../types/activity.js";

const DEFAULT_TTL_MS = 5 * 60 * 1000;

interface CacheEntry {
  activities: SourceActivity[];
  fetchedAt: number;
}

/**
 * Short-lived cache so dashboard reloads don't burn through upstream rate
 * limits. Entries are scoped (per Strava session, or per provider for
 * single-user providers like Intervals.icu).
 */
class ActivityCache {
  private readonly entries = new Map<string, CacheEntry>();

  async getOrFetch(
    scope: string,
    key: string,
    fetcher: () => Promise<SourceActivity[]>,
    ttlMs: number = DEFAULT_TTL_MS,
  ): Promise<SourceActivity[]> {
    const cacheKey = `${scope}:${key}`;
    const entry = this.entries.get(cacheKey);
    if (entry && Date.now() - entry.fetchedAt < ttlMs) {
      return entry.activities;
    }

    const activities = await fetcher();
    this.entries.set(cacheKey, { activities, fetchedAt: Date.now() });
    return activities;
  }

  clear(scope: string): void {
    for (const cacheKey of this.entries.keys()) {
      if (cacheKey.startsWith(`${scope}:`)) this.entries.delete(cacheKey);
    }
  }
}

export const activityCache = new ActivityCache();
