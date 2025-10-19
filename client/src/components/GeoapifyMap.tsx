// client/components/GeoapifyMap.tsx
import MapLibreGL from '@maplibre/maplibre-react-native';
import Constants from 'expo-constants';
import React from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { GEOAPIFY_KEY } from '../constants/geo';
import UserPin from './ClientPin';
import OperatorPin from './OperatorPin';

type Props = {
  /** Client/customer latitude */
  lat?: number | null;
  /** Client/customer longitude */
  lng?: number | null;
  zoom?: number;
  /** If provided, overrides the container style. */
  style?: StyleProp<ViewStyle>;
  /** Show operator pin only if request is accepted */
  showOperator?: boolean;
};

type OperatorLocation = { lat: number; lng: number; updated_at?: string };

function isNum(v: any): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

const extra: any =
  (Constants as any)?.expoConfig?.extra ??
  (Constants as any)?.manifest?.extra ??
  {};

const API_ROOT = 'http://192.168.1.6:3000'; // Use actual IP address

// Final URL used to fetch operator location from server
const OP_LOC_URL = API_ROOT ? `${API_ROOT}/api/users/me/location` : `/api/users/me/location`;

console.log('API_ROOT:', API_ROOT);
console.log('OP_LOC_URL:', OP_LOC_URL);

MapLibreGL.setAccessToken(null);

async function testGeoapifyKey(key: string): Promise<boolean> {
  if (!key) return false;
  try {
    const u = `https://maps.geoapify.com/v1/tile/osm-carto/1/1/1.png?apiKey=${key}`;
    const r = await fetch(u, { method: 'GET' });
    return r.ok;
  } catch {
    return false;
  }
}

/** Fetch the operator (current user) location from appdb */
async function fetchOperatorLocation(): Promise<OperatorLocation | null> {
  try {
    console.log('Fetching operator location from:', OP_LOC_URL);
    
    // Get auth token
    const { tokens } = await import('../auth/tokenStore');
    const accessToken = await tokens.getAccessAsync();
    
    if (!accessToken) {
      console.log('No access token available for operator location fetch');
      return null;
    }
    
    const res = await fetch(OP_LOC_URL, { 
      method: 'GET', 
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      }
    });
    
    console.log('Operator location response status:', res.status);
    
    if (!res.ok) {
      const errorText = await res.text();
      console.log('Operator location fetch failed:', res.status, res.statusText, errorText);
      return null;
    }
    
    const j = await res.json();
    console.log('Operator location response:', j);
    
    if (!isNum(j?.lat) || !isNum(j?.lng)) {
      console.log('Invalid operator location data:', j);
      return null;
    }
    
    const location = { lat: j.lat, lng: j.lng, updated_at: j.updated_at };
    console.log('Operator location found:', location);
    return location;
  } catch (error) {
    console.error('Error fetching operator location:', error);
    return null;
  }
}

/** Fetch a driving route (Geoapify) between two points, returns a GeoJSON FeatureCollection */
async function fetchDriveRoute(
  fromLng: number,
  fromLat: number,
  toLng: number,
  toLat: number,
  apiKey: string
): Promise<any | null> {
  if (!apiKey) return null;
  try {
    const url =
      `https://api.geoapify.com/v1/routing?waypoints=${fromLng},${fromLat}|${toLng},${toLat}&mode=drive&apiKey=${apiKey}`;
    const r = await fetch(url);
    const j = await r.json();
    const feat = j?.features?.[0];
    return feat ? { type: 'FeatureCollection', features: [feat] } : null;
  } catch {
    return null;
  }
}

export default function GeoapifyMap({ lat, lng, zoom = 16, style, showOperator = true }: Props) {
  const clientOk = isNum(lat) && isNum(lng);
  const [useGeoapify, setUseGeoapify] = React.useState(false);

  // Operator location (from appdb)
  const [op, setOp] = React.useState<OperatorLocation | null>(null);
  // Route feature collection between operator and client
  const [routeFC, setRouteFC] = React.useState<any | null>(null);

  // Decide which raster tiles to use (Geoapify vs OSM fallback)
  React.useEffect(() => {
    let alive = true;
    console.log('Testing Geoapify key:', GEOAPIFY_KEY ? 'Present' : 'Missing');
    console.log('GEOAPIFY_KEY value:', GEOAPIFY_KEY);
    testGeoapifyKey(GEOAPIFY_KEY).then((good) => {
      console.log('Geoapify key test result:', good);
      if (alive) setUseGeoapify(good);
    });
    return () => {
      alive = false;
    };
  }, []);

  // Poll operator location from server every 5 seconds (only if showOperator is true)
  React.useEffect(() => {
    console.log('showOperator changed:', showOperator);
    
    if (!showOperator) {
      console.log('showOperator is false, clearing operator location');
      setOp(null);
      return;
    }

    console.log('showOperator is true, starting operator location polling');
    let alive = true;
    let t: any;

    async function tick() {
      console.log('Polling operator location...');
      const loc = await fetchOperatorLocation();
      if (alive) {
        setOp(loc ?? null);
        if (loc) {
          console.log('Operator location updated on map:', loc);
        } else {
          console.log('No operator location available');
        }
      }
      t = setTimeout(tick, 5000);
    }

    tick();
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [showOperator]);

  // Fetch a route when both operator + client are available
  React.useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!clientOk || !op) {
        if (!cancelled) setRouteFC(null);
        return;
      }
      const fc = await fetchDriveRoute(op.lng, op.lat, lng!, lat!, GEOAPIFY_KEY);
      if (!cancelled) setRouteFC(fc);
    })();

    return () => {
      cancelled = true;
    };
  }, [clientOk, op?.lat, op?.lng, lat, lng]);

  if (!clientOk) {
    return (
      <View style={[styles.wrap, style ?? styles.defaultSize, styles.placeholder]}>
        <Text style={styles.placeholderText}>Location unavailable</Text>
      </View>
    );
  }

  // MapLibre expects [lng, lat]
  const clientCenter: [number, number] = [lng!, lat!];

  // Geoapify raster tiles (no vector style URL so we avoid font/glyph endpoints).
  const geoapifyTiles = [
    `https://maps.geoapify.com/v1/tile/osm-carto/{z}/{x}/{y}.png?apiKey=${GEOAPIFY_KEY}`,
  ];
  // Fallback: OSM raster tiles
  const osmTiles = ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'];
  const tiles = useGeoapify ? geoapifyTiles : osmTiles;
  const maxZoom = useGeoapify ? 20 : 19;
  
  console.log('Map tile configuration:', {
    useGeoapify,
    tileUrl: tiles[0],
    maxZoom
  });

  // Only set bounds on initial load, not on every render
  const [initialBounds, setInitialBounds] = React.useState<any>(null);
  
  React.useEffect(() => {
    if (op && !initialBounds) {
      setInitialBounds({
        sw: [Math.min(op.lng, lng!), Math.min(op.lat, lat!)],
        ne: [Math.max(op.lng, lng!), Math.max(op.lat, lat!)],
        padding: 60,
        animationDuration: 800,
      });
    }
  }, [op, lng, lat, initialBounds]);

  return (
    <View style={[styles.wrap, style ?? styles.defaultSize]}>
      <MapLibreGL.MapView
        style={StyleSheet.absoluteFillObject}
        compassEnabled={false}
        logoEnabled={false}
        attributionEnabled={false}
      >
        {initialBounds ? (
          <MapLibreGL.Camera bounds={initialBounds} />
        ) : (
          <MapLibreGL.Camera
            centerCoordinate={clientCenter}
            zoomLevel={zoom}
            animationMode="flyTo"
            animationDuration={400}
          />
        )}

        {/* Base raster tiles */}
        <MapLibreGL.RasterSource
          id="base"
          tileUrlTemplates={tiles}
          tileSize={256}
          minZoomLevel={0}
          maxZoomLevel={maxZoom}
        >
          <MapLibreGL.RasterLayer id="base-layer" />
        </MapLibreGL.RasterSource>

        {/* Route line on top (if available) */}
        {routeFC && (
          <MapLibreGL.ShapeSource id="route" shape={routeFC}>
            <MapLibreGL.LineLayer
              id="route-line"
              style={{
                lineColor: '#6EFF87',
                lineWidth: 5,
                lineCap: 'round',
                lineJoin: 'round',
                lineOpacity: 0.95,
              }}
            />
          </MapLibreGL.ShapeSource>
        )}

        {/* Client pin (blue pulsing) */}
        <MapLibreGL.MarkerView
          id="client-pin"
          coordinate={clientCenter}
          anchor={{ x: 0.5, y: 1.0 }}
        >
          <UserPin />
        </MapLibreGL.MarkerView>

        {/* Operator pin (red) from appdb - only show if showOperator is true */}
        {showOperator && op && isNum(op.lat) && isNum(op.lng) && (
          <MapLibreGL.MarkerView
            id="operator-pin"
            coordinate={[op.lng, op.lat]}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <OperatorPin />
          </MapLibreGL.MarkerView>
        )}
        
        {/* Debug info */}
        {console.log('Map render - showOperator:', showOperator, 'op:', op, 'op.lat:', op?.lat, 'op.lng:', op?.lng)}
      </MapLibreGL.MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    overflow: 'hidden',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    backgroundColor: '#000',
  },
  /**
   * ⬇️ FIX: make the default fill its parent instead of a fixed height.
   * Any screen that just does `<GeoapifyMap />` will now stretch the map.
   */
  defaultSize: { flex: 1, width: '100%' },

  // (Only used when lat/lng are missing)
  placeholder: { alignItems: 'center', justifyContent: 'center' },
  placeholderText: { color: '#aaa' },

});