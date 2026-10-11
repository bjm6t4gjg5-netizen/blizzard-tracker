# worker-results — live results relay

The Chicago Marathon results site (mika:timing) doesn't send CORS headers, so the
browser can't read it directly. This ~70-line Cloudflare Worker fetches the page
server-side and hands it back with CORS. No secrets, no KV, free tier.

## Deploy (3 minutes)

```bash
cd worker-results
npx wrangler login     # browser opens → sign in / sign up to Cloudflare (free)
npx wrangler deploy    # prints https://blizzard-results.<you>.workers.dev
```

Check it: open `https://blizzard-results.<you>.workers.dev/health` → `{"ok":true}`.

## Point the app at it

GitHub repo → Settings → Secrets and variables → Actions → **Variables** →
New variable: `VITE_RESULTS_PROXY` = `https://blizzard-results.<you>.workers.dev`,
then re-run the "Deploy to GitHub Pages" workflow (or push any commit).

Instant override on a single device, no rebuild: open the site, then in the
browser console run `localStorage.resultsProxy = 'https://blizzard-results.<you>.workers.dev'`
and reload.

## Next race

Add the new results host to `ALLOWED_HOSTS` in `worker.js` and redeploy.
