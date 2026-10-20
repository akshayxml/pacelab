import { existsSync } from "node:fs";
import path from "node:path";
import cookieParser from "cookie-parser";
import express, {
  type NextFunction,
  type Request,
  type Response,
} from "express";
import { config } from "./config.js";
import { UpstreamApiError } from "./errors.js";
import { activityRouter } from "./routes/activityRoutes.js";
import { authRouter } from "./routes/authRoutes.js";

/** Built frontend (`frontend/dist`); same relative path from src/ and dist/. */
const FRONTEND_DIST = path.resolve(
  process.env.FRONTEND_DIST ?? path.join(import.meta.dirname, "../../frontend/dist"),
);

const app = express();

app.disable("x-powered-by");
// Behind one reverse proxy (e.g. Tailscale Serve) in production.
app.set("trust proxy", 1);
app.use(express.json());
app.use(cookieParser());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", provider: config.provider });
});

app.use("/api/auth", authRouter);
app.use("/api/activities", activityRouter);

app.use("/api", (_req, res) => {
  res.status(404).json({ error: "not_found" });
});

// In production the API also serves the frontend, so everything is same-origin.
// Tabs live in the URL hash, so no SPA fallback route is needed.
if (existsSync(FRONTEND_DIST)) {
  app.use(
    express.static(FRONTEND_DIST, {
      setHeaders(res, filePath) {
        // Vite fingerprints files in assets/, so they can be cached forever;
        // index.html must be revalidated to pick up new deploys.
        res.setHeader(
          "Cache-Control",
          filePath.includes(`${path.sep}assets${path.sep}`)
            ? "public, max-age=31536000, immutable"
            : "no-cache",
        );
      },
    }),
  );
}

// Express 5 forwards rejected promises from async handlers here.
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof UpstreamApiError) {
    console.error(err.message);
    const prefix = err.provider;

    switch (err.status) {
      case 401:
        res.status(401).json({ error: `${prefix}_unauthorized` });
        return;
      case 403:
        // e.g. Strava "Application Status Inactive", or an API key without access.
        res.status(403).json({ error: `${prefix}_forbidden` });
        return;
      case 429:
        res.status(429).json({ error: `${prefix}_rate_limited` });
        return;
      default:
        res.status(502).json({ error: `${prefix}_unavailable` });
        return;
    }
  }

  console.error(err);
  res.status(500).json({ error: "internal_error" });
});

app.listen(config.port, () => {
  console.log(
    `PaceLab API listening on http://localhost:${config.port} (provider: ${config.provider})`,
  );
});
