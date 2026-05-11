# Garmin / Strava integration — design doc

Status: **planning only — not implemented in v4**. Visible via the dev-only
"Training" tab.

## What we want to show

Catherine and Helaine both run with Garmin watches and auto-sync to Strava.
Once Brooklyn Half is over, the Training tab will replace the race-day
dashboard with:

1. **Weekly mileage bar chart** — last 12 weeks, stacked by workout type
   (easy / tempo / long / workout).
2. **Recent runs list** — last 5 activities with distance, moving time,
   average pace, average HR, elevation, and a small route preview.
3. **Geography map** — world map polylines of all runs, with 1–2 featured
   long runs highlighted (e.g. SPO, Munich, Boston).
4. **Training load** — acute vs chronic load (CTL/ATL/TSB), fitness/form
   curves, taper readiness indicator before the next race.

## Architecture

```
   Garmin Connect
        │ (existing auto-sync)
        ▼
       Strava
        │  Strava API v3 — OAuth 2.0
        ▼
  Cloudflare Worker  ←─── stores access + refresh tokens
        │  signs short-lived URLs · caches activities for 15 min
        ▼
   Blizzard Racing app  (Svelte client)
```

**Why Strava as middleware** rather than direct Garmin:

- Garmin's API uses **OAuth 1.0a** (ancient, painful), and their Connect IQ
  developer program is built for device apps not data export.
- Strava already has Catherine's full activity history from her Garmin
  auto-sync — same data, modern API.
- Strava API v3 is **OAuth 2.0**, well-documented, has generous personal-tier
  limits, and exposes everything we need (activities, streams, athlete
  zones, gear).

## OAuth flow

1. Catherine clicks "Connect Strava" in the Training tab settings.
2. Browser redirects to `https://www.strava.com/oauth/authorize` with our
   client ID + scopes (`read,activity:read_all,profile:read_all`).
3. Strava redirects back to our Cloudflare Worker at `/oauth/callback?code=…`.
4. Worker exchanges the code for an access + refresh token via the Strava
   token endpoint, stores them in Workers KV keyed by athlete ID.
5. Worker issues the client a short-lived signed cookie (`Set-Cookie:
   blzr-session=…; HttpOnly; Secure; SameSite=Lax; Max-Age=3600`).
6. Client makes authenticated requests to our Worker (NOT to Strava) — the
   Worker proxies + caches.

Refresh tokens auto-rotate every 6 hours via a Worker cron trigger so the
access token never expires during use.

## API endpoints we'll call

| Strava endpoint | Used for |
|---|---|
| `GET /athlete` | Athlete profile (name, FTP, weight) |
| `GET /athlete/activities?per_page=30` | Recent runs list |
| `GET /activities/:id` | Detailed activity (HR avg, splits) |
| `GET /activities/:id/streams?keys=latlng,altitude,heartrate` | Route polyline + HR overlay |
| `GET /athlete/zones` | Heart-rate zone configuration |

Our Worker exposes a slimmer surface to the client:

```
GET  /api/athlete/:id          → cached profile
GET  /api/athlete/:id/recent   → last 5 activities (cached 15 min)
GET  /api/athlete/:id/weekly   → 12-week mileage bars (cached 1 h)
GET  /api/athlete/:id/map      → all activity polylines (cached 1 h)
```

## Caching strategy

- KV (key-value) per athlete with 15-minute TTL on activities.
- Cron trigger every 6 hours rebuilds 12-week mileage summary.
- Activity polylines are cached as decoded GeoJSON in KV — saves the client
  from re-parsing Strava's encoded polylines.

Strava's rate limit is **100 requests per 15 minutes, 1000/day**. With
caching at the Worker, the app makes 1–2 requests per page-load max, well
under quota even for many viewers.

## Effort estimate

| Phase | Time |
|---|---|
| Cloudflare Worker boilerplate + KV setup | 1 h |
| OAuth flow (authorize → callback → token storage) | 2 h |
| Strava API client + cache wrappers | 2 h |
| `Training` tab UI: weekly chart, recent runs, map | 4 h |
| Testing across multiple athletes (Catherine + Helaine) | 1 h |
| **Total** | **~1 focused day** |

Cost: **free**. Cloudflare Workers free tier covers 100k requests/day and
1 KV namespace. Strava API is free for personal-scope use.

## Privacy / scope

- Tokens never leave the Worker; client only sees activity data.
- Worker logs are scrubbed of athlete IDs.
- Catherine and Helaine each connect their own Strava — no shared
  credentials.
- Add a "Disconnect Strava" button that deletes the KV entry and revokes
  the token via `POST https://www.strava.com/oauth/deauthorize`.

## Open questions before implementation

1. Do we want **both** Catherine and Helaine's training, or only Catherine
   (the more active racer)? Decision affects Worker storage layout.
2. **Featured long runs** — manually curated (Leon picks) or auto-detected
   (longest run per month)? My default: auto-detected longest run per
   month, with override capability.
3. **Geography map** — every run polyline gets messy fast at 200+ runs.
   Heatmap mode, or thinned-line mode? My default: thinned polylines for
   last 90 days, plus a "show all" toggle.

## Next steps after Brooklyn Half

1. Catherine + Helaine each register a Strava OAuth application (one
   shared "Blizzard Racing" app is fine; client ID lives in Worker env).
2. Deploy the Worker to a `blizzard-tracker-api.workers.dev` subdomain
   (free).
3. Wire client to the Worker, replace placeholders in Training tab.
4. First production data should appear within ~24 hours of OAuth connect.
