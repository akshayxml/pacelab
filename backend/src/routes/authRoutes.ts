import { randomBytes } from "node:crypto";
import { Router } from "express";
import { config } from "../config.js";
import {
  OAUTH_STATE_COOKIE,
  SESSION_COOKIE,
  cookieOptions,
  getAuth,
  requireStravaSession,
} from "../auth/requireStravaSession.js";
import { sessionStore } from "../auth/sessionStore.js";
import { activityCache } from "../activities/activityCache.js";
import { getAthlete as getIntervalsAthlete } from "../intervals/intervalsClient.js";
import {
  buildAuthorizeUrl,
  deauthorize,
  exchangeCodeForToken,
} from "../strava/stravaClient.js";
import type { Athlete, ConnectionStatus } from "../types/activity.js";

export const authRouter = Router();

const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const ATHLETE_CACHE_MS = 60 * 60 * 1000;

let intervalsAthleteCache: { athlete: Athlete; fetchedAt: number } | null = null;

async function getCachedIntervalsAthlete(): Promise<Athlete> {
  if (
    intervalsAthleteCache &&
    Date.now() - intervalsAthleteCache.fetchedAt < ATHLETE_CACHE_MS
  ) {
    return intervalsAthleteCache.athlete;
  }
  const athlete = await getIntervalsAthlete();
  intervalsAthleteCache = { athlete, fetchedAt: Date.now() };
  return athlete;
}

/**
 * Current connection status. Never returns 401 so the UI can poll it.
 * Intervals.icu is a single-user, server-configured provider, so it is
 * always "connected" if the API key works.
 */
authRouter.get("/me", async (req, res) => {
  if (config.provider === "intervals") {
    try {
      const athlete = await getCachedIntervalsAthlete();
      res.json({
        provider: "intervals",
        connected: true,
        athlete,
      } satisfies ConnectionStatus);
    } catch (err) {
      console.error("Intervals.icu athlete lookup failed:", err);
      res.json({
        provider: "intervals",
        connected: false,
        athlete: null,
      } satisfies ConnectionStatus);
    }
    return;
  }

  const sessionId: string | undefined = req.cookies?.[SESSION_COOKIE];
  const session = sessionId ? sessionStore.get(sessionId) : undefined;
  res.json({
    provider: "strava",
    connected: Boolean(session),
    athlete: session?.athlete ?? null,
  } satisfies ConnectionStatus);
});

/** Ends the PaceLab session but keeps the Strava authorization. */
authRouter.post("/logout", (req, res) => {
  const sessionId: string | undefined = req.cookies?.[SESSION_COOKIE];
  if (sessionId) {
    activityCache.clear(sessionId);
    sessionStore.delete(sessionId);
  }
  res.clearCookie(SESSION_COOKIE, cookieOptions);
  res.status(204).end();
});

// ---------- Strava OAuth (only when DATA_PROVIDER=strava) ----------

if (config.provider === "strava") {
  const redirectToFrontend = (status: string) => {
    const url = new URL(config.frontendUrl);
    url.searchParams.set("strava", status);
    return url.toString();
  };

  /** Step 1: send the user to Strava's consent screen. */
  authRouter.get("/strava/login", (_req, res) => {
    const state = randomBytes(16).toString("hex");
    res.cookie(OAUTH_STATE_COOKIE, state, {
      ...cookieOptions,
      maxAge: 10 * 60 * 1000,
    });
    res.redirect(buildAuthorizeUrl(state));
  });

  /** Step 2: Strava redirects back here with ?code=&state=&scope=. */
  authRouter.get("/strava/callback", async (req, res) => {
    const { code, state, scope, error } = req.query as Record<
      string,
      string | undefined
    >;
    const expectedState: string | undefined =
      req.cookies?.[OAUTH_STATE_COOKIE];
    res.clearCookie(OAUTH_STATE_COOKIE, cookieOptions);

    if (error) {
      res.redirect(redirectToFrontend("denied"));
      return;
    }
    if (!code || !state || state !== expectedState) {
      res.redirect(redirectToFrontend("invalid_state"));
      return;
    }
    // Users can untick permissions on the consent screen.
    if (!scope?.split(",").some((s) => s.startsWith("activity:read"))) {
      res.redirect(redirectToFrontend("missing_scope"));
      return;
    }

    try {
      const token = await exchangeCodeForToken(code);
      const athlete = token.athlete;
      if (!athlete) throw new Error("Token response missing athlete");

      const sessionId = sessionStore.create({
        athlete: {
          id: String(athlete.id),
          firstName: athlete.firstname,
          lastName: athlete.lastname,
          profileImageUrl: athlete.profile_medium ?? athlete.profile ?? null,
        },
        accessToken: token.access_token,
        refreshToken: token.refresh_token,
        expiresAt: token.expires_at,
      });

      res.cookie(SESSION_COOKIE, sessionId, {
        ...cookieOptions,
        maxAge: SESSION_MAX_AGE_MS,
      });
      res.redirect(redirectToFrontend("connected"));
    } catch (err) {
      console.error("Strava OAuth callback failed:", err);
      res.redirect(redirectToFrontend("error"));
    }
  });

  /** Revokes PaceLab's access on Strava and ends the session. */
  authRouter.post(
    "/strava/disconnect",
    requireStravaSession,
    async (_req, res) => {
      const { sessionId, session } = getAuth(res);
      await deauthorize(session.accessToken).catch((err) =>
        console.warn("Strava deauthorize failed:", err),
      );
      activityCache.clear(sessionId);
      sessionStore.delete(sessionId);
      res.clearCookie(SESSION_COOKIE, cookieOptions);
      res.status(204).end();
    },
  );
}
