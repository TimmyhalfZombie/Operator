// server/src/routes/geo.ts
import { Router } from 'express';
// If you're on Node < 18, uncomment next line and `npm i node-fetch`
// import fetch from 'node-fetch';

const router = Router();

/**
 * GET /api/geo/route?from=lng,lat&to=lng,lat&mode=drive|walk|bicycle
 * Returns a GeoJSON FeatureCollection (LineString), similar to Geoapify.
 */
router.get('/route', async (req, res) => {
  try {
    const from = String(req.query.from || '');
    const to = String(req.query.to || '');
    const mode = String(req.query.mode || 'drive');

    const parse = (s: string) => {
      const [lngStr, latStr] = s.split(',');
      const lng = Number(lngStr);
      const lat = Number(latStr);
      if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
      return { lng, lat };
    };

    const a = parse(from);
    const b = parse(to);
    if (!a || !b) return res.status(400).json({ error: 'Invalid from/to' });

    const profile =
      mode === 'walk' || mode === 'foot' ? 'foot'
      : mode === 'bicycle' || mode === 'bike' ? 'bike'
      : 'driving';

    const url =
      `https://router.project-osrm.org/route/v1/${profile}/` +
      `${a.lng},${a.lat};${b.lng},${b.lat}?overview=full&geometries=geojson`;

    const r = await fetch(url);
    if (!r.ok) {
      const t = await r.text();
      return res.status(502).json({ error: 'Routing upstream error', detail: t });
    }

    const j = await r.json();
    const route = j?.routes?.[0];
    if (!route?.geometry) return res.status(404).json({ error: 'No route' });

    const feature = {
      type: 'Feature',
      geometry: route.geometry, // GeoJSON LineString
      properties: { distance: route.distance, duration: route.duration },
    };

    return res.json({ type: 'FeatureCollection', features: [feature] });
  } catch (e: any) {
    return res.status(500).json({ error: 'Route failed', detail: e?.message || String(e) });
  }
});

export default router;
