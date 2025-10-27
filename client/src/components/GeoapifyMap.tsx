import MapLibreGL from '@maplibre/maplibre-react-native';
import React from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import {
  GEOAPIFY_KEY,              // alias to MapTiler key
  MAPTILER_RASTER_TILES_512, // correct 512 template (no /512/ in path)
  OSM_RASTER_TILES_256,
  geoapifyRouteURL,
} from '../constants/geo';
import { API_URL } from '../lib/env';
import UserPin from './ClientPin';
import OperatorPin from './OperatorPin';

type Props = {
  /** Client latitude */
  lat?: number | null;
  /** Client longitude */
  lng?: number | null;
  /** Initial zoom when auto-centering to client */
  zoom?: number;
  /** Optional container style */
  style?: StyleProp<ViewStyle>;
  /** Show operator pin or not */
  showOperator?: boolean;
};

type OperatorLocation = { lat: number; lng: number; updated_at?: string };

function isNum(v: any): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

MapLibreGL.setAccessToken(null);

// Empty style we use while drawing raster tiles
const EMPTY_STYLE_JSON = JSON.stringify({ version: 8, sources: {}, layers: [] });

async function fetchOperatorLocation(): Promise<OperatorLocation | null> {
  try {
    const { tokens } = await import('../auth/tokenStore');
    const accessToken = await tokens.getAccessAsync();
    const res = await fetch(`${API_URL}/api/users/me/location`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
    });
    if (!res.ok) return null;
    const j = await res.json();
    if (!isNum(j?.lat) || !isNum(j?.lng)) return null;
    return { lat: j.lat, lng: j.lng, updated_at: j?.updated_at };
  } catch {
    return null;
  }
}

async function fetchDriveRoute(
  fromLng: number,
  fromLat: number,
  toLng: number,
  toLat: number,
  _apiKey: string
): Promise<any | null> {
  try {
    const url = geoapifyRouteURL(fromLng, fromLat, toLng, toLat, 'drive');
    const r = await fetch(url);
    if (!r.ok) return null;
    const j = await r.json();
    return j?.type ? j : null; // FeatureCollection
  } catch {
    return null;
  }
}

export default function GeoapifyMap({
  lat,
  lng,
  zoom = 16,
  style,
  showOperator = true,
}: Props) {
  const clientOk = isNum(lat) && isNum(lng);
  const clientCenter: [number, number] = [lng ?? 0, lat ?? 0];

  // We force raster for stability
  const [mode] = React.useState<'raster-mt' | 'raster-osm'>('raster-mt');
  const [mapReady, setMapReady] = React.useState(true); // raster is ready immediately

  const [op, setOp] = React.useState<OperatorLocation | null>(null);
  const [routeFC, setRouteFC] = React.useState<any | null>(null);

  // Camera (imperative) + guards
  const camRef = React.useRef<MapLibreGL.Camera>(null);
  const userHasTakenControl = React.useRef(false);
  const lastAutoCentered = React.useRef<string | null>(null); // `${lng},${lat}` we auto-centered to

  const onRegionWillChange = React.useCallback((e: any) => {
    const p = e?.nativeEvent?.properties ?? e?.properties ?? {};
    const byUser =
      p?.gesture === true ||
      p?.isUserInteraction === true ||
      p?.manualGesture === true;
    if (byUser) userHasTakenControl.current = true;
  }, []);

  // Poll operator pin (optional)
  React.useEffect(() => {
    if (!showOperator) {
      setOp(null);
      return;
    }
    let alive = true;
    let t: any;
    async function tick() {
      const loc = await fetchOperatorLocation();
      if (alive) setOp(loc ?? null);
      t = setTimeout(tick, 5000);
    }
    tick();
    return () => { alive = false; clearTimeout(t); };
  }, [showOperator]);

  // Fetch route (optional overlay)
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!clientOk || !op) {
        if (!cancelled) setRouteFC(null);
        return;
      }
      const fc = await fetchDriveRoute(op.lng, op.lat, clientCenter[0], clientCenter[1], GEOAPIFY_KEY);
      if (!cancelled) setRouteFC(fc);
    })();
    return () => { cancelled = true; };
  }, [clientOk, op?.lat, op?.lng, clientCenter[0], clientCenter[1]]);

  // 🔸 Auto-zoom ONCE to the CLIENT as soon as map is ready & coords exist
  React.useEffect(() => {
    if (!mapReady || !clientOk) return;
    const key = `${clientCenter[0]},${clientCenter[1]}`;
    if (userHasTakenControl.current) return;   // don't override user gesture
    if (lastAutoCentered.current === key) return; // already centered to this client

    lastAutoCentered.current = key;
    // small delay avoids racing first render
    setTimeout(() => {
      camRef.current?.setCamera?.({
        centerCoordinate: clientCenter,
        zoomLevel: zoom,
        animationDuration: 500,
        animationMode: 'flyTo',
      } as any);
    }, 50);
  }, [mapReady, clientOk, clientCenter[0], clientCenter[1], zoom]);

  if (!clientOk) {
    return (
      <View style={[styles.wrap, style ?? styles.defaultSize, styles.placeholder]}>
        <Text style={styles.placeholderText}>Location unavailable</Text>
      </View>
    );
  }

  return (
    <View style={[styles.wrap, style ?? styles.defaultSize]}>
      <MapLibreGL.MapView
        style={StyleSheet.absoluteFillObject}
        compassEnabled={false}
        logoEnabled={false}
        attributionEnabled={false}
        onRegionWillChange={onRegionWillChange}
        onDidFinishLoadingStyle={() => setMapReady(true)}
        onMapError={(e) => {
          const msg = String(e?.nativeEvent?.message || '');
          // ignore harmless "Canceled" during zoom/pan
          const realFail = /401|403|404|429|5\d\d|Unauthorized|Forbidden|Not Found|Too Many/i.test(msg);
          if (!realFail) {
            console.log('Map error (ignored):', msg);
            return;
          }
          console.log('Map error:', msg);
        }}
        // Raster mode: provide empty vector style JSON
        styleJSON={EMPTY_STYLE_JSON}
      >
        <MapLibreGL.Camera ref={camRef as any} />

        {/* Base raster tiles */}
        <MapLibreGL.RasterSource
          id="base"
          tileUrlTemplates={mode === 'raster-mt' ? MAPTILER_RASTER_TILES_512 : OSM_RASTER_TILES_256}
          tileSize={mode === 'raster-mt' ? 512 : 256}
          minZoomLevel={0}
          maxZoomLevel={19}
        >
          <MapLibreGL.RasterLayer id="base-layer" />
        </MapLibreGL.RasterSource>

        {/* Optional route overlay */}
        {routeFC && (
          <MapLibreGL.ShapeSource id="route" shape={routeFC}>
            <MapLibreGL.LineLayer
              id="route-line"
              style={{ lineColor: '#6EFF87', lineWidth: 5, lineCap: 'round', lineJoin: 'round', lineOpacity: 0.95 }}
            />
          </MapLibreGL.ShapeSource>
        )}

        {/* Client pin (blue) */}
        <MapLibreGL.MarkerView id="client-pin" coordinate={clientCenter} anchor={{ x: 0.5, y: 1.0 }}>
          <UserPin />
        </MapLibreGL.MarkerView>

        {/* Operator pin (red) */}
        {showOperator && op && isNum(op.lat) && isNum(op.lng) && (
          <MapLibreGL.MarkerView id="operator-pin" coordinate={[op.lng, op.lat]} anchor={{ x: 0.5, y: 0.5 }}>
            <OperatorPin />
          </MapLibreGL.MarkerView>
        )}
      </MapLibreGL.MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { overflow: 'hidden', borderTopLeftRadius: 12, borderTopRightRadius: 12, backgroundColor: '#000' },
  defaultSize: { flex: 1, width: '100%' },
  placeholder: { alignItems: 'center', justifyContent: 'center' },
  placeholderText: { color: '#aaa' },
});
