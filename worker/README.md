# Blizzard Tracker — Strava worker setup

One-time setup, ~15 minutes. Free (Cloudflare Workers free tier + Strava personal API).

## 1. Create the Strava API app

1. Go to https://www.strava.com/settings/api (any Strava account works — one shared app is fine).
2. Create an application:
   - **Application name:** Blizzard Tracker
   - **Website:** https://bjm6t4gjg5-netizen.github.io/blizzard-tracker/
   - **Authorization Callback Domain:** `blizzard-tracker-api.<your-subdomain>.workers.dev` (fill in after step 2 if needed)
3. Note the **Client ID** and **Client Secret**.

## 2. Deploy the worker

```bash
cd worker
npx wrangler login                              # opens browser, sign in to Cloudflare (free account)
npx wrangler kv namespace create TOKENS         # copy the generated id into wrangler.toml
npx wrangler secret put STRAVA_CLIENT_ID        # paste from step 1
npx wrangler secret put STRAVA_CLIENT_SECRET    # paste from step 1
npx wrangler deploy
```

The deploy prints the worker URL, e.g. `https://blizzard-tracker-api.leon.workers.dev`.
Go back to the Strava API settings and make sure the **Authorization Callback
Domain** matches that hostname (no `https://`, no path).

## 3. Point the app at the worker

Add the URL as a build-time env var so GitHub Actions bakes it in. In the repo:
**Settings → Secrets and variables → Actions → Variables → New variable**

- Name: `VITE_STRAVA_API_BASE`
- Value: `https://blizzard-tracker-api.<your-subdomain>.workers.dev`

(For local dev: `VITE_STRAVA_API_BASE=https://... npm run dev`, or set
`localStorage.stravaApiBase` in the browser console.)

## 4. Connect the runners

Open the app → **Training** tab → each runner clicks **Connect Strava** and
approves. Done — every run they record shows up in the app within ~15 minutes
of uploading.

## Notes

- Tokens live only in Workers KV; the browser never sees them.
- Summaries are cached 15 min per athlete → ~2 Strava API calls per 15 min max,
  far under the 100-per-15-min limit.
- Disconnect anytime: `GET <worker>/api/disconnect?athlete=gf&confirm=1`
  (also revokes the token on Strava's side).
