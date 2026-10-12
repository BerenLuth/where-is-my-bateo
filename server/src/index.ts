import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FEEDS, STATIC_REFRESH_HOURS } from './feeds.js';
import { SnapshotService } from './realtime.js';
import { mergeSnapshots } from './snapshot.js';
import { loadStatic } from './static.js';

const PORT = Number(process.env.PORT ?? 3001);

const services = new Map<string, SnapshotService>();
for (const feed of Object.values(FEEDS)) {
  const service = new SnapshotService(feed, await loadStatic(feed));
  services.set(feed.mode, service);
  setInterval(
    () => loadStatic(feed).then((d) => service.setStatic(d), (e) => console.warn('static reload failed:', e)),
    STATIC_REFRESH_HOURS * 3600e3,
  ).unref();
}

const app = express();

/** All feeds merged into one snapshot; a feed that is down is skipped as long as another works. */
app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.get('/api/snapshot', async (_req, res) => {
  const results = await Promise.allSettled([...services.values()].map((s) => s.get()));
  const ok = results.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []));
  results.forEach((r) => r.status === 'rejected' && console.error(r.reason));
  if (ok.length === 0) return void res.status(502).json({ error: 'feeds unavailable' });
  res.json({ ...mergeSnapshots(ok), serverTime: Date.now() / 1000 });
});

/** Shape ids are `<mode>:<gtfs shape id>`. */
app.get('/api/shapes/:id', (req, res) => {
  const [mode, ...rest] = req.params.id.split(':');
  const shape = services.get(mode)?.staticData.shapes.get(rest.join(':'));
  if (!shape) return void res.status(404).json({ error: 'unknown shape' });
  res.set('Cache-Control', 'public, max-age=3600').json(shape.pts);
});

// In production the same process serves the built web app.
const webDist = process.env.WEB_DIST ?? path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'web', 'dist');
if (fs.existsSync(webDist)) {
  app.use(
    express.static(webDist, {
      setHeaders(res, file) {
        // The service worker and manifest must be revalidated on every load so updates reach installed apps.
        if (/(^|[\\/])(sw\.js|workbox-[^\\/]*\.js|manifest\.webmanifest|registerSW\.js)$/.test(file)) {
          res.setHeader('Cache-Control', 'no-cache');
        } else if (file.includes(`${path.sep}assets${path.sep}`)) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable'); // hashed filenames
        }
      },
    }),
  );
}

app.listen(PORT, () => console.log(`Where Is My Bateo server on http://localhost:${PORT}`));
