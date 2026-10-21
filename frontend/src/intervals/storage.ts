// Everything the static app keeps on this device: the Intervals.icu API key
// (localStorage) and cached activities / best efforts (IndexedDB).

import { clear, createStore, get, getMany, set, setMany } from "idb-keyval";
import type { Athlete } from "../types/activity";
import type { BestEffortTimes } from "./bestEfforts";
import type { SourceActivity } from "./types";

const API_KEY = "pacelab-intervals-key";
const ATHLETE = "pacelab-intervals-athlete";

// Opened on first use so builds that never touch it don't create the database.
let db: ReturnType<typeof createStore> | undefined;
const store = () => (db ??= createStore("pacelab", "cache"));

/** Cached data is tagged with its athlete so a different account never sees it. */
const OWNER = "owner";
const ACTIVITIES = "activities";
const ACTIVITIES_FULL_SYNC = "activities-full-sync";
const BEST_EFFORTS = "best-efforts";

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export const apiKeyStore = {
  get: (): string | null => localStorage.getItem(API_KEY),
  set: (key: string) => localStorage.setItem(API_KEY, key),
  clear: () => localStorage.removeItem(API_KEY),
};

/** Last known athlete, so the app can start offline. */
export const athleteStore = {
  get: () => readJson<Athlete>(ATHLETE),
  set: (athlete: Athlete) => localStorage.setItem(ATHLETE, JSON.stringify(athlete)),
  clear: () => localStorage.removeItem(ATHLETE),
};

/** Drops cached data if it belongs to a different athlete than `athleteId`. */
export async function claimCache(athleteId: string): Promise<void> {
  if ((await get<string>(OWNER, store())) === athleteId) return;
  await clear(store());
  await set(OWNER, athleteId, store());
}

export interface CachedActivities {
  activities: SourceActivity[];
  /** When the full history was last downloaded (0 if unknown). */
  fullSyncAt: number;
}

export const activityCacheStore = {
  async get(): Promise<CachedActivities | undefined> {
    const [activities, fullSyncAt] = (await getMany(
      [ACTIVITIES, ACTIVITIES_FULL_SYNC],
      store(),
    )) as [SourceActivity[] | undefined, number | undefined];
    // Caches written before full-sync tracking get a full download next time.
    return activities ? { activities, fullSyncAt: fullSyncAt ?? 0 } : undefined;
  },
  set: ({ activities, fullSyncAt }: CachedActivities) =>
    setMany(
      [
        [ACTIVITIES, activities],
        [ACTIVITIES_FULL_SYNC, fullSyncAt],
      ],
      store(),
    ),
};

export const bestEffortCacheStore = {
  get: () => get<Record<string, BestEffortTimes | null>>(BEST_EFFORTS, store()),
  set: (entries: Record<string, BestEffortTimes | null>) => set(BEST_EFFORTS, entries, store()),
};

/** Removes the API key and every cached activity from this browser. */
export async function clearDeviceData(): Promise<void> {
  apiKeyStore.clear();
  athleteStore.clear();
  await clear(store());
}
