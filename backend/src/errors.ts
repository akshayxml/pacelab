/** Error from an upstream fitness API (Strava, Intervals.icu). */
export class UpstreamApiError extends Error {
  readonly provider: string;
  readonly status: number;

  constructor(provider: string, status: number, message: string) {
    super(message);
    this.name = "UpstreamApiError";
    this.provider = provider;
    this.status = status;
  }
}
