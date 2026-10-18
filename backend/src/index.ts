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

const app = express();

app.disable("x-powered-by");
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
