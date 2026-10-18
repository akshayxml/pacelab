export type DataProvider = "strava" | "intervals";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function parseProvider(value: string | undefined): DataProvider {
  const provider = (value ?? "strava").toLowerCase();
  if (provider !== "strava" && provider !== "intervals") {
    throw new Error(
      `Invalid DATA_PROVIDER "${value}". Expected "strava" or "intervals".`,
    );
  }
  return provider;
}

const provider = parseProvider(process.env.DATA_PROVIDER);

export const config = {
  port: Number(process.env.PORT ?? 4000),
  frontendUrl: process.env.FRONTEND_URL ?? "http://localhost:5173",
  isProduction: process.env.NODE_ENV === "production",
  provider,
  // Only the active provider's credentials are required.
  strava:
    provider === "strava"
      ? {
        clientId: required("STRAVA_CLIENT_ID"),
        clientSecret: required("STRAVA_CLIENT_SECRET"),
        redirectUri: required("STRAVA_REDIRECT_URI"),
        scope: "read,activity:read_all",
      }
      : null,
  intervals:
    provider === "intervals"
      ? {
        apiKey: required("INTERVALS_API_KEY"),
        // "0" means "the athlete that owns the API key".
        athleteId: process.env.INTERVALS_ATHLETE_ID || "0",
      }
      : null,
} as const;

/** Narrowing helper for code paths that only run with Strava enabled. */
export function stravaConfig() {
  if (!config.strava) throw new Error("Strava provider is not enabled");
  return config.strava;
}

/** Narrowing helper for code paths that only run with Intervals enabled. */
export function intervalsConfig() {
  if (!config.intervals) throw new Error("Intervals provider is not enabled");
  return config.intervals;
}
