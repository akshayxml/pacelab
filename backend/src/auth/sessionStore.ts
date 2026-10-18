import { randomBytes } from "node:crypto";
import type { Athlete } from "../types/activity.js";

export interface StravaSession {
  athlete: Athlete;
  accessToken: string;
  refreshToken: string;
  /** Unix seconds. */
  expiresAt: number;
}

/**
 * In-memory session store. Sessions are lost on restart.
 * Swap for Redis/SQLite/Postgres before deploying.
 */
class SessionStore {
  private readonly sessions = new Map<string, StravaSession>();

  create(session: StravaSession): string {
    const id = randomBytes(32).toString("hex");
    this.sessions.set(id, session);
    return id;
  }

  get(id: string): StravaSession | undefined {
    return this.sessions.get(id);
  }

  update(id: string, session: StravaSession): void {
    this.sessions.set(id, session);
  }

  delete(id: string): void {
    this.sessions.delete(id);
  }
}

export const sessionStore = new SessionStore();
