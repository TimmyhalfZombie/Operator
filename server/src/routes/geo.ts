import { Router } from 'express';
import { requireAuth } from '../middleware/jwt';

const router = Router();

function toNum(n: any): number | null { const v = Number(n); return Number.isFinite(v) ? v : null; }

function parseLatLngParam(p?: string): { lat: number; lng: number } | null {
  if (!p) return null;
  const [a, b] = p.split(',').map((s) => s.trim());
  const lat = toNum(a), lng = toNum(b);
  if (lat == null || lng == null) return null;
  return { lat, lng };
}

/**
 * GET /api/geo/route?from=lat,lng&to=lat,lng&mode=drive|walk|bicycle
 * Returns: { points:[{lat,lng},...], distanceMeters, durationSec }
 */
router.get('/route', requireAuth, async (req, res) => {
  try {
    const from = parseLatLngParam(String(req.query.from || ''));
    const to = parseLatLngParam(String(req.query.to || ''));
    const mode = (String(req.query.mode || 'drive') as 'drive'|'walk'|'bicycle');

    if (!from || !to) return res.status(400).json({ message: 'from and to are required as "lat,lng"' });

    const key = process.env.GEOAPIFY_API_KEY;
    if (!key) return res.status(500).json({ message: 'Missing GEOAPIFY_API_KEY' });

    const waypoints = `${from.lat},${from.lng}|${to.lat},${to.lng}`;
    const url = `https://api.geoapify.com/v1/routing?waypoints=${encodeURIComponent(waypoints)}&mode=${mode}&apiKey=${key}`;

    const r = await fetch(url);
    if (!r.ok) return res.status(502).json({ message: `Geoapify ${r.status}` });
    const j = await r.json();

    // GeoJSON → flatten to lat/lng list
    const feat = j?.features?.[0];
    const coords = feat?.geometry?.coordinates; // could be LineString or MultiLineString
    let points: Array<{lat:number; lng:number}> = [];

    if (Array.isArray(coords) && Array.isArray(coords[0]) && typeof coords[0][0] === 'number') {
      // LineString [ [lng,lat], ... ]
      points = coords.map(([lng, lat]: number[]) => ({ lat, lng }));
    } else if (Array.isArray(coords) && Array.isArray(coords[0]) && Array.isArray(coords[0][0])) {
      // MultiLineString [ [ [lng,lat], ... ], ... ]
      points = coords.flat().map(([lng, lat]: number[]) => ({ lat, lng }));
    }

    const dist = feat?.properties?.distance || 0; // meters
    const dur = feat?.properties?.time || 0;      // seconds

    res.json({ points, distanceMeters: dist, durationSec: dur });
  } catch (e:any) {
    res.status(500).json({ message: e?.message || 'route failed' });
  }
});

/**
 * GET /api/geo/places?lat=..&lng=..&categories=fuel,service.vehicle.repair&radius=2000
 * Returns: { items:[{id,name,category,lat,lng,address}] }
 * Categories: https://www.geoapify.com/docs/places-api/
 */
router.get('/places', requireAuth, async (req, res) => {
  try {
    const lat = toNum(req.query.lat);
    const lng = toNum(req.query.lng);
    const categories = String(req.query.categories || 'fuel,service.vehicle.repair');
    const radius = Math.min(Math.max(Number(req.query.radius || 2000), 100), 10000);

    if (lat == null || lng == null) return res.status(400).json({ message: 'lat & lng required' });

    const key = process.env.GEOAPIFY_API_KEY;
    if (!key) return res.status(500).json({ message: 'Missing GEOAPIFY_API_KEY' });

    const url = `https://api.geoapify.com/v2/places?categories=${encodeURIComponent(categories)}&filter=circle:${lng},${lat},${radius}&bias=proximity:${lng},${lat}&limit=30&apiKey=${key}`;

    const r = await fetch(url);
    if (!r.ok) return res.status(502).json({ message: `Geoapify ${r.status}` });
    const j = await r.json();

    const items = (j?.features || []).map((f: any) => {
      const p = f.properties || {};
      const [lon, la] = (f.geometry?.coordinates || []);
      return {
        id: f.id || p.place_id || `${lon},${la}`,
        name: p.name || p.street || 'Place',
        category: (p.categories && p.categories[0]) || '',
        lat: la, lng: lon,
        address: p.formatted || [p.housenumber, p.street, p.city, p.state, p.country].filter(Boolean).join(', '),
      };
    });

    res.json({ items });
  } catch (e:any) {
    res.status(500).json({ message: e?.message || 'places failed' });
  }
});

/**
 * Reverse geocoding function to convert lat/lng to address
 */
export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  try {
    // Try Geoapify first if API key is available
    const geoapifyKey = process.env.GEOAPIFY_API_KEY;
    if (geoapifyKey) {
      const url = `https://api.geoapify.com/v1/geocode/reverse?lat=${lat}&lon=${lng}&apiKey=${geoapifyKey}`;
      const response = await fetch(url);
      
      if (response.ok) {
        const data = await response.json();
        const feature = data?.features?.[0];
        
        if (feature?.properties) {
          const props = feature.properties;
          const address = props.formatted || 
            [props.housenumber, props.street, props.city, props.state, props.country]
              .filter(Boolean)
              .join(', ');
          
          if (address) return address;
        }
      }
    }

    // Fallback to OpenStreetMap Nominatim (free service)
    try {
      const nominatimUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`;
      const response = await fetch(nominatimUrl, {
        headers: {
          'User-Agent': 'OperatorApp/1.0'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.display_name) {
          // Extract detailed location with subdivision/neighborhood
          const address = data.display_name;
          const parts = address.split(', ');
          
          // Build detailed address by including relevant parts
          const relevantParts = [];
          
          for (let i = 0; i < parts.length; i++) {
            const part = parts[i].trim();
            
            // Skip very specific parts like house numbers, postal codes, country
            if (part.match(/^\d+$/) || // Just numbers
                part.includes('Philippines') || 
                part.includes('5025') || // Postal codes
                part.includes('Western Visayas') ||
                part.includes('Region') ||
                part.includes('Capital District') ||
                part.includes('Metro Manila')) {
              continue;
            }
            
            // Include meaningful location parts (neighborhoods, districts, cities)
            if (part.length > 2 && 
                !part.includes('Street') && 
                !part.includes('Road') && 
                !part.includes('Avenue') &&
                !part.includes('Boulevard')) {
              relevantParts.push(part);
            }
          }
          
          // Return the relevant parts joined with commas
          if (relevantParts.length > 0) {
            return relevantParts.join(', ');
          }
          
          // Fallback to original address if no good parts found
          return address;
        }
      }
    } catch (nominatimError) {
      console.log('Nominatim geocoding failed:', nominatimError);
    }

    // Final fallback: Generate a readable address from coordinates
    return `Location: ${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  } catch (error) {
    console.error('Reverse geocoding error:', error);
    return `Location: ${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  }
}

/**
 * Test endpoint for reverse geocoding (for development)
 */
router.get('/test-reverse-geocode', async (req, res) => {
  try {
    const lat = Number(req.query.lat) || 10.7805;
    const lng = Number(req.query.lng) || 122.4752;
    
    const address = await reverseGeocode(lat, lng);
    
    res.json({
      lat,
      lng,
      address,
      success: !!address
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
