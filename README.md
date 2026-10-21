# PaceLab

Running dashboard powered by Intervals.icu (Garmin) or Strava. Installable as
a PWA and usable offline.

```
pacelab/
├── frontend/   # Vite + React + TypeScript dashboard (PWA)
└── backend/    # Express + TypeScript API (activity proxy)
```

Two ways to run it:

| | Static site (recommended) | With backend |
|---|---|---|
| Hosting | GitHub Pages, free | Any Node host / Docker |
| Providers | Intervals.icu | Intervals.icu or Strava |
| API key | Entered in the browser, stored on that device | `backend/.env` |
| Best efforts cache | Per device (IndexedDB) | On the server |
| Setup | [Static site](#static-site-free-github-pages) | [Setup](#setup) |

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
| GET | `/api/activities/history` | `ActivityLogEntry[]`: every run (road, trail, virtual) for yearly progress |
| GET | `/api/activities/best-efforts` | Fastest 1K to 50K inside each run. Analysed in the background from activity streams and cached in `backend/.cache/`; poll while `progress.running` |

Credentials and tokens stay on the server; with Strava the browser only holds
an opaque `httpOnly` session cookie. Sessions are in-memory, so restart =
reconnect.

## Static site (free, GitHub Pages)

The frontend can run with no backend at all: your browser calls the
Intervals.icu API directly with your own API key. The hosted site contains no
data, so it's safe to publish. Strangers who open it only see demo data.

### Deploy
1. Push this repo to GitHub.
2. **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. Push to `main`. The [deploy workflow](.github/workflows/deploy-pages.yml)
   builds for the root of a custom domain (live at https://pacelab.akshayxml.com).
4. **Settings → Pages → Custom domain**: enter your domain, with a DNS
   `CNAME <subdomain> → <user>.github.io`, then tick **Enforce HTTPS**.

> Use a dedicated (sub)domain: every `<user>.github.io/*` site shares one
> origin, so their scripts could read the API key from local storage. To
> serve from `https://<user>.github.io/<repo>/` instead, add
> `-- --base=/<repo>/` to the build step.

> GitHub Pages is free for public repos. For a private repo, use Cloudflare
> Pages instead (free): build command
> `cd frontend && npm ci && npm run build:standalone`, output `frontend/dist`.

### Use it
1. Open the site and click **Connect Intervals.icu**.
2. Paste the API key from Intervals.icu → Settings → Developer Settings.
   Let your password manager save it to fill it in on other devices.
3. Install it: **Add to Home Screen** (iOS Safari) or **Install app**
   (Chrome/Edge). On iOS, enter the key inside the installed app, since home-screen
   apps don't share storage with Safari.

The key stays in that browser's local storage and is sent only to
Intervals.icu (enforced by the page's Content-Security-Policy). **Disconnect**
removes it and all cached runs from the device; you can also revoke the key
in Intervals.icu at any time. Best efforts are analysed once per device and
cached, so after the first run only new activities are fetched.

### Run locally
```bash
cd frontend
npm run dev:standalone          # no backend needed
npm run build:standalone        # production build in dist/
```

## Self-hosting with the backend (Docker + Tailscale)

Use this if you want Strava, or prefer the API key on a server. With a
server-side Intervals.icu key, PaceLab shows **your** data to anyone who can
reach it, so it must not be on the public internet. This setup costs nothing:
one small always-free VM, reachable only from your own devices via
[Tailscale](https://tailscale.com) (free for personal use).

```
Your phone / laptop ──Tailscale (HTTPS)──▶ VM: tailscale serve ──▶ 127.0.0.1:4000 (Docker)
```

### 1. Get a free VM
Any always-on Linux box works. Free options:
- **Google Cloud e2-micro**: free in `us-west1`, `us-central1` or `us-east1`
  with a 30 GB standard disk. Don't reserve a static IP (that's charged).
- **Oracle Cloud Always Free** (Ampere ARM, more RAM).
- An old laptop or Raspberry Pi at home.

Leave the cloud firewall closed: no inbound ports besides SSH are needed.

### 2. Install Docker and Tailscale on it
```bash
curl -fsSL https://get.docker.com | sudo sh
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up
```
Install Tailscale on your phone/laptop too and sign in with the same account.

### 3. Deploy
```bash
git clone https://github.com/akshayxml/pacelab.git && cd pacelab
cp backend/.env.example backend/.env   # set DATA_PROVIDER=intervals and INTERVALS_API_KEY
sudo docker compose up -d --build
sudo tailscale serve --bg 4000
```
`tailscale serve status` prints the URL, e.g. `https://<vm-name>.<tailnet>.ts.net`.
The container only listens on `127.0.0.1`, so it's unreachable except through
your tailnet. On a 1 GB VM, add swap first if the build runs out of memory.

### Updating
```bash
git pull && sudo docker compose up -d --build
```
Computed best efforts persist in the `pacelab-data` volume across updates.

## License

[MIT](LICENSE)
