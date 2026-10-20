import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { BestEffortTimes } from "./bestEfforts.js";

/**
 * Persistent cache of computed best efforts, keyed by "provider:activityId".
 * A finished activity's best efforts never change, so each one is fetched
 * and analysed once. `null` marks activities without distance data so they
 * aren't re-fetched either.
 */
/** Bump when the algorithm changes so stale results are recomputed. */
const CACHE_VERSION = 2;
const CACHE_FILE = path.resolve(
  process.env.PACELAB_CACHE_DIR ?? ".cache",
  `best-efforts.v${CACHE_VERSION}.json`,
);
const WRITE_DEBOUNCE_MS = 2_000;

type StoredValue = BestEffortTimes | null;

class BestEffortStore {
  private entries = new Map<string, StoredValue>();
  private loaded: Promise<void> | null = null;
  private writeTimer: NodeJS.Timeout | null = null;

  private load(): Promise<void> {
    this.loaded ??= readFile(CACHE_FILE, "utf8")
      .then((text) => {
        const data = JSON.parse(text) as Record<string, StoredValue>;
        this.entries = new Map(Object.entries(data));
      })
      .catch((err: NodeJS.ErrnoException) => {
        // Missing file is expected on first run; anything else just starts fresh.
        if (err.code !== "ENOENT") {
          console.warn("Ignoring unreadable best-efforts cache:", err.message);
        }
      });
    return this.loaded;
  }

  async ready(): Promise<this> {
    await this.load();
    return this;
  }

  has(key: string): boolean {
    return this.entries.has(key);
  }

  get(key: string): StoredValue | undefined {
    return this.entries.get(key);
  }

  set(key: string, value: StoredValue): void {
    this.entries.set(key, value);
    this.scheduleWrite();
  }

  private scheduleWrite(): void {
    if (this.writeTimer) return;
    this.writeTimer = setTimeout(() => {
      this.writeTimer = null;
      void this.flush();
    }, WRITE_DEBOUNCE_MS);
  }

  /** Atomic write: temp file then rename, so a crash never corrupts the cache. */
  private async flush(): Promise<void> {
    try {
      await mkdir(path.dirname(CACHE_FILE), { recursive: true });
      const tmp = `${CACHE_FILE}.tmp`;
      await writeFile(tmp, JSON.stringify(Object.fromEntries(this.entries)));
      await rename(tmp, CACHE_FILE);
    } catch (err) {
      console.error("Failed to write best-efforts cache:", err);
    }
  }
}

export const bestEffortStore = new BestEffortStore();
