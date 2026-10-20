import type { ActivitySource } from "../activities/activitySource.js";
import { UpstreamApiError } from "../errors.js";
import { computeBestEfforts } from "./bestEfforts.js";
import { bestEffortStore } from "./bestEffortStore.js";

/** Parallel stream requests; low to stay polite with upstream rate limits. */
const CONCURRENCY = 3;
/** After a 429, wait this long before the next attempt. */
const RATE_LIMIT_BACKOFF_MS = 15 * 60 * 1000;

interface JobState {
  running: boolean;
  rateLimitedUntil: number;
}

/** One job per provider; activity IDs are unique within a provider. */
const jobs = new Map<string, JobState>();

export function storeKey(provider: string, activityId: string): string {
  return `${provider}:${activityId}`;
}

export function jobStatus(provider: string) {
  const job = jobs.get(provider);
  return {
    running: job?.running ?? false,
    rateLimitedUntil:
      job && job.rateLimitedUntil > Date.now() ? job.rateLimitedUntil : null,
  };
}

/**
 * Fetches streams for `activityIds` not yet in the store and records their
 * best efforts. Fire-and-forget: callers poll the store for progress. A
 * second call while a job is running for the same provider is a no-op.
 */
export function ensureBestEfforts(
  source: ActivitySource,
  activityIds: string[],
): void {
  const job = jobs.get(source.provider) ?? { running: false, rateLimitedUntil: 0 };
  jobs.set(source.provider, job);
  if (job.running || job.rateLimitedUntil > Date.now()) return;

  const queue = activityIds.filter(
    (id) => !bestEffortStore.has(storeKey(source.provider, id)),
  );
  if (queue.length === 0) return;

  job.running = true;
  let stopped = false;

  const worker = async () => {
    while (!stopped) {
      const id = queue.shift();
      if (!id) return;
      try {
        const stream = await source.getDistanceStream(id);
        bestEffortStore.set(
          storeKey(source.provider, id),
          stream ? computeBestEfforts(stream) : null,
        );
      } catch (err) {
        if (err instanceof UpstreamApiError && err.status === 429) {
          stopped = true;
          job.rateLimitedUntil = Date.now() + RATE_LIMIT_BACKOFF_MS;
          console.warn(`${source.provider} rate limit hit; pausing best-effort analysis.`);
          return;
        }
        if (err instanceof UpstreamApiError && err.status === 401) {
          // Session expired mid-job; the next request will re-authenticate.
          stopped = true;
          return;
        }
        // Skip this activity for now; it will be retried on a later run.
        console.warn(`Best efforts for ${source.provider} activity ${id} failed:`, err);
      }
    }
  };

  void Promise.all(Array.from({ length: CONCURRENCY }, worker)).finally(() => {
    job.running = false;
  });
}
