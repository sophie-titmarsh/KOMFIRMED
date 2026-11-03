# KOMfirmed

Tells a rider when the weather gives them the best shot at a Strava KOM, QOM or PR.

For each of your starred Strava segments it pulls a 7-day hourly forecast for the segment's location and works out, hour by hour:

- **Wind along the segment.** The route polyline is split into short pieces, each with its own heading. The 10 m forecast wind is scaled to rider height and resolved along every piece, so a twisting climb gets partial credit for a crosswind.
- **Air density** from temperature, pressure and humidity (warm, low-pressure air is faster).
- **Rain and road state.** Rain now, or more than 0.4 mm in the previous 3 hours, rules the hour out. A 50%+ rain chance downgrades it.
- **Seconds gained or lost** for a rider of your weight and position riding exactly the target time in still, dry 15°C air, plus the **watts the KOM/QOM needs** in that hour.
- **Gusts over 55 km/h and darkness** rule an hour out.

Verdicts: **Go** ≥ 2% faster than still air, **Maybe** 0.6–2%, otherwise **No**. The best windows in the next 7 days are listed, and a day × hour grid shows the whole week.

Without a Strava connection it runs in demo mode with example segments.

## Setup (about 10 minutes)

1. **Create a Strava API app** at https://www.strava.com/settings/api
   - *Authorization Callback Domain*: the domain you deploy to (e.g. `komfirmed.vercel.app`), or `localhost` for local testing.
   - Note the **Client ID** and **Client Secret**.
2. **Run locally**
   ```bash
   cp .env.example .env      # paste your Client ID and Secret
   npm start                 # http://localhost:3000
   ```
   No dependencies to install; needs Node 18+.
3. **Deploy to Vercel** (or any Node host)
   ```bash
   npx vercel                # then add STRAVA_CLIENT_ID and STRAVA_CLIENT_SECRET in Project → Settings → Environment Variables
   npx vercel --prod
   ```
   Vercel serves `public/` and turns `api/*.js` into functions automatically. On Render, Railway or Fly, run `npm start` with the two environment variables set.

## How it fits together

| Part | What it does |
| --- | --- |
| `public/index.html` | The whole app: UI, Strava calls, forecast, wind/physics model. |
| `api/token.js` | Exchanges the OAuth code and refreshes tokens. Holds the client secret, so it must run server-side. |
| `api/config.js` | Gives the page the public Client ID. |
| `server.js` | Zero-dependency server for local dev and non-Vercel hosts. |

- **Strava**: OAuth scope `read`. Uses `GET /segments/starred` and `GET /segments/{id}` (polyline, KOM/QOM times, your PR). Segment details are cached in the browser for a day to stay inside Strava's rate limits.
- **Weather**: [Open-Meteo](https://open-meteo.com) hourly forecast, no API key. It blends national weather-service models (in the UK that includes the Met Office UKV model). Free for non-commercial use; commercial use needs a paid plan.

## Before sharing it widely

- New Strava API apps are limited to **1 connected athlete** (you) until Strava approves a capacity increase. Apply from the API settings page.
- Check the current [Strava API Agreement](https://www.strava.com/legal/api) and brand guidelines before a public launch, especially around showing leaderboard data.
- The model uses the segment's average gradient throughout and a fixed rider-height wind factor (0.65 × 10 m wind). Sheltered lanes get less help than predicted; exposed roads get more. `WIND_AT_RIDER` in `index.html` is the knob to tune.

## Next steps worth building

- Strava elevation streams for per-piece gradient (steep ramps gain less from wind).
- A push notification when a Go window opens on a starred segment.
- A per-segment "sheltered / open" setting to adjust the wind factor.
