# Where Is My Bateo

> **Vibe-coded:** this project was built by prompting an AI coding assistant (Claude Code), not hand-written line by line. The server logic has unit tests, but the web UI has none and it has had only light manual testing. Expect rough edges and read the code before relying on it.

A rider-facing "where is my bus" map for ACTV (Venice) buses, trams and waterbuses. It shows every vehicle live on a map, how late each one is, and an estimated position between updates. The UI is in Italian.

Data comes from ACTV's open data catalogue: [actv.avmspa.it](https://actv.avmspa.it/it/content/catalogo-dei-dati-metadati-e-banche-dati-actv) (static GTFS plus GTFS-realtime vehiclePositions and tripUpdates for the `aut` and `nav` feeds). See `GLOSSARY.md` for the project vocabulary.

## Features

- **Live map** of buses, trams and boats, coloured with each line's own colour. Buses are circles, trams rounded squares and boats hull-shaped; a Bus / Tram / Battelli filter is in the legend.
- **Direction arrow** on each marker shows the vehicle's heading, outlined in white so it reads on any colour and on both themes.
- **Delay badge** on every vehicle: green up to 3 min late, amber up to 5, red beyond, blue when early.
- **Search** by line (`24H`, `T1`), fleet number (`587`) or destination (`Piazzale Roma`). A line shows all its vehicles and its route; a vehicle opens a card with delay, next stop and expected arrival.
- **Ghosts:** a lighter marker moves along the route toward the next stop, timed to its expected arrival, and glides to the real position on each update. Positions older than 2 minutes are greyed out and get no ghost.
- **Dark theme:** the ☾/☀ button in the header switches to a dark theme with a plain dark basemap (the standard tiles desaturated and inverted in the browser, so no API key is needed). It follows your system setting at first and remembers your choice; `?theme=dark` or `?theme=light` in the URL overrides it.
- **Mobile layout:** on small screens the search box and the ☾ / ⟳ / ⚙ buttons share one row; ⚙ opens a bottom sheet with the toggles (estimated positions, out-of-service, Bus / Tram / Battelli), the vehicle count and the feed age. Selecting a line or vehicle opens a bottom panel; pinch to zoom.
- **Installable (PWA):** can be installed to the home screen / desktop as a standalone app; see [Install as an app](#install-as-an-app-pwa).
- **Refresh:** polls every 30 s; the refresh button has a 5 s cooldown. Out-of-service vehicles are hidden unless you toggle them on. While the server is still starting, the page retries every 3 s.

## Quick start

Requires Node 22+.

```
npm install
npm run dev          # server on :3001, web on http://localhost:5173
npm run dev:host     # same, but reachable from other devices (e.g. your phone)
npm test             # server logic tests
npm run build        # production build of the web app into web/dist
```

The first start downloads and parses ACTV's static GTFS (~10–20 s); until the server is ready the page shows "Caricamento dati…" and retries every 3 s.

For phone testing, run `npm run dev:host` and open the `Network:` URL Vite prints (e.g. `http://192.168.1.25:5173`). The phone only talks to Vite, which forwards `/api` to the server, so port 3001 needn't be exposed. If the page doesn't load, check that your firewall allows port 5173.

## Install as an app (PWA)

The production build is a Progressive Web App: a manifest, icons and a service worker that precaches the app shell, so it opens instantly and can be installed.

- **Needs HTTPS** (or `localhost`). Browsers only register service workers and offer installation in a secure context, so the plain-HTTP LAN address (`http://192.168.x.x:8080`, or `npm run dev:host`) works as a normal web page but is not installable. For phone testing use the `cloudflared` HTTPS tunnel below, or any HTTPS deployment.
- **Android (Chrome):** menu → *Install app* / *Add to Home screen*.
- **iOS (Safari):** Share → *Add to Home Screen*.
- **Desktop (Chrome/Edge):** the install icon in the address bar.
- **What is cached:** the app shell, route shapes and a small number of recently viewed map tiles. **Live positions are never cached**, so stale data can't pass for live; offline you see the shell and an "offline" notice.
- The service worker is only built for production (`npm run build`, Docker); it is disabled in `npm run dev`. Updates are picked up automatically on the next launch.

## Run with Docker

```
docker compose up -d --build     # then open http://localhost:8080
PORT=9000 docker compose up -d   # use another port
docker compose down              # stop
```

One container serves both the API and the web app. It needs about 400 MB of RAM and takes ~10 s to start; downloaded ACTV data is cached in the `actv-cache` volume. The container uses `network_mode: host`, so it listens on the host's port directly (Linux only; on Docker Desktop for Mac/Windows remove that line and add `ports: ["8080:8080"]`).

**Sharing with friends**
- Same network: give them `http://<your-machine-ip>:8080`.
- Over the internet without opening ports: `cloudflared tunnel --url http://localhost:8080` prints a public https link.
- On a server or small VPS: copy the repo, run the same `docker compose` command and put Caddy or nginx in front for HTTPS.

**Map tiles:** the default uses the public OpenStreetMap tile servers, which is fine for a few friends but not for public traffic. To use another provider, set `VITE_TILE_URL` and `VITE_TILE_ATTRIBUTION` (and `VITE_TILE_URL_DARK` / `VITE_TILE_ATTRIBUTION_DARK` to use a real dark basemap instead of the built-in restyle) under `build.args` in `docker-compose.yml` and rebuild.

## How it works

```
ACTV feeds ──► server (Node/Express) ──► /api/snapshot ──► web (React + Leaflet)
 vehiclePositions   joins positions, trips          merged JSON,        polls every 30 s,
 tripUpdates        and static GTFS; caches 20 s    ids prefixed        animates ghosts
 static GTFS zip
```

- **`server/`** decodes the vehiclePositions and tripUpdates protobufs and joins them with the static GTFS (lines, headsigns, stops, route shapes). It caches the realtime feeds for 20 s, so any number of viewers causes at most one upstream request per feed per 20 s, and reloads the static data every 24 h. The `aut` (bus/tram) and `nav` (boat) feeds are served merged from `/api/snapshot` (plus `/api/shapes/:id` for route shapes and `/api/health`); ids are prefixed with the feed (`aut:`, `nav:`) so they can't clash. If one feed is down the other is still served.
- **Delay** is the delay reported for the vehicle's next unserved stop in tripUpdates. Vehicles with no trip are out of service and have no line or delay.
- **Ghosts** are computed on the server: the vehicle's position is projected onto its route shape and the path to the next stop is sent with the stop's expected arrival time. The browser interpolates along that path. The feed has no speed field, so this is how in-between positions are estimated.
- **Boat trip ids:** the boat realtime feed says `AUT_ACTV_653_123` where the static data says `NAV_ACTV_653_123`; `server/src/feeds.ts` maps between them.
- **`web/`** is Vite + React + TypeScript with Leaflet, drawn imperatively so the ghost animation doesn't re-render React.

## Configuration

| What | Where |
| --- | --- |
| Feed URLs, adding a new feed, realtime cache time, static refresh interval | `server/src/feeds.ts` |
| Poll and retry intervals, refresh cooldown, delay thresholds, stale-fix age, ghost glide time, map centre, tile URLs | `web/src/config.ts` |
| Marker, arrow and theme styling | `web/src/styles.css` |
| PWA manifest (name, colours, icons) and caching rules | `web/vite.config.ts` |
| UI strings (add an `en` dictionary here to translate) | `web/src/i18n/` |
| Server port, cache directory, web build directory | env `PORT` (3001), `CACHE_DIR`, `WEB_DIST` |
| Tile providers | build-time `VITE_TILE_URL`, `VITE_TILE_ATTRIBUTION`, `VITE_TILE_URL_DARK`, `VITE_TILE_ATTRIBUTION_DARK` |

## Project layout

```
server/src/   index.ts (API, serves web/dist)  realtime.ts (fetch + cache)  snapshot.ts (join, delay, ghosts)
              static.ts (GTFS loader)  geo.ts (shape projection)  feeds.ts  types.ts  *.test.ts
web/public/   icon.svg + generated PWA icons (pwa-192/512, maskable, apple-touch-icon)
web/src/      App.tsx  MapView.tsx  SearchBox.tsx  Panel.tsx  useSnapshot.ts  useTheme.ts
              delay.ts  search.ts  config.ts  styles.css  i18n/
Dockerfile, docker-compose.yml, GLOSSARY.md
```

## Notes and limits

- ACTV's catalogue page doesn't state a licence for the data. Check ACTV's terms for attribution and reuse before publishing publicly; the map credit already says "dati ACTV".
- v1 doesn't include stop-based search ("next buses at this stop"), service alerts (ACTV publishes none), or history.
