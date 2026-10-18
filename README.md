# PaceLab

Running dashboard powered by Intervals.icu (Garmin) or Strava.

```
pacelab/
├── frontend/   # Vite + React + TypeScript dashboard
└── backend/    # Express + TypeScript API (activity proxy)
```

## Data providers

Pick one with `DATA_PROVIDER` in `backend/.env`.

| Provider | Auth | Notes |
|---|---|---|
| `intervals` | Personal API key (server-side) | Single user. Sync Garmin → Intervals.icu. |
| `strava` | OAuth per user | App owner may need an active Strava subscription. |

### Intervals.icu (recommended for Garmin)
1. Create a free account at https://intervals.icu
2. In **Settings → Connections**, connect Garmin Connect
3. In **Settings → Developer Settings**, generate an API key
4. Set `DATA_PROVIDER=intervals` and `INTERVALS_API_KEY=...`

> Activities that reach Intervals.icu *via Strava* are returned as stubs by its
> API and are skipped. Connect Garmin directly.

### Strava
1. Go to https://www.strava.com/settings/api
2. Set **Authorization Callback Domain** to `localhost`
3. Set `DATA_PROVIDER=strava`, `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET`

## Setup

### Backend
```bash
cd backend
cp .env.example .env   # choose a provider and fill in its credentials
npm install
npm run dev            # http://localhost:4000
```

Restart the backend after editing `.env`.

### Frontend
```bash
cd frontend
npm install
npm run dev            # http://localhost:5173 (proxies /api -> :4000)
```

## API

| Method | Path | Description |
|---|---|---|
| GET | `/api/health` | `{ status, provider }` |
| GET | `/api/auth/me` | `{ provider, connected, athlete }` |
| POST | `/api/auth/logout` | End PaceLab session (Strava) |
| GET | `/api/auth/strava/login` | Strava only: redirect to consent screen |
| GET | `/api/auth/strava/callback` | Strava only: OAuth callback |
| POST | `/api/auth/strava/disconnect` | Strava only: revoke access + end session |
| GET | `/api/activities/recent?limit=10` | `RunActivity[]` |
| GET | `/api/activities/weekly-stats?weeks=8` | `WeeklyStats[]` |

Credentials and tokens stay on the server; with Strava the browser only holds
an opaque `httpOnly` session cookie. Sessions are in-memory, so restart =
reconnect.
