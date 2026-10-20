/**
 * Standalone build (`vite build --mode standalone`): a static site where the
 * browser talks to Intervals.icu directly with the user's own API key. No
 * backend is involved. Other builds use the Express backend under /api.
 */
export const STANDALONE = import.meta.env.MODE === "standalone";
