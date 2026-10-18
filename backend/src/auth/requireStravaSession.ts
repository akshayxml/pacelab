import type { NextFunction, Request, Response } from "express";
import { config } from "../config.js";
import { refreshAccessToken } from "../strava/stravaClient.js";
import { sessionStore, type StravaSession } from "./sessionStore.js";

export const SESSION_COOKIE = "pacelab_sid";
export const OAUTH_STATE_COOKIE = "pacelab_oauth_state";

/** Refresh slightly before actual expiry to avoid races. */
const REFRESH_MARGIN_SECONDS = 120;

export const cookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  secure: config.isProduction,
  path: "/",
} as const;

export interface AuthedLocals {
  sessionId: string;
  session: StravaSession;
}

export function getAuth(res: Response): AuthedLocals {
  return res.locals as AuthedLocals;
}

/**
 * Ensures the request has a valid Strava session and a non-expired access
 * token, refreshing it transparently when needed.
 */
export async function requireStravaSession(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const sessionId: string | undefined = req.cookies?.[SESSION_COOKIE];
  const session = sessionId ? sessionStore.get(sessionId) : undefined;

  if (!sessionId || !session) {
    res.status(401).json({ error: "not_connected" });
    return;
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (session.expiresAt - REFRESH_MARGIN_SECONDS <= nowSeconds) {
    try {
      const token = await refreshAccessToken(session.refreshToken);
      session.accessToken = token.access_token;
      session.refreshToken = token.refresh_token;
      session.expiresAt = token.expires_at;
      sessionStore.update(sessionId, session);
    } catch {
      // Refresh token revoked or invalid: force re-auth.
      sessionStore.delete(sessionId);
      res.clearCookie(SESSION_COOKIE, cookieOptions);
      res.status(401).json({ error: "session_expired" });
      return;
    }
  }

  res.locals.sessionId = sessionId;
  res.locals.session = session;
  next();
}
