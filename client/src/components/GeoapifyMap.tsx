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
  lat?: number | null;
  lng?: number | null;
  zoom?: number;
  style?: StyleProp<ViewStyle>;
  showOperator?: boolean;
};

type OperatorLocation = { lat: number; lng: number; updated_at?: string };

function isNum(v: any): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

MapLibreGL.setAccessToken(null);

// Toggle later if your network allows vector tiles/sprites/glyphs
const USE_VECTOR = false;
// Streets v4 vector style (used only if USE_VECTOR=true)
const VECTOR_STYLE_URL =
  'https://api.maptiler.com/maps/streets-v4/style.json?key=2qSQ9pofebFXsJIh7Nog';

// Empty style used whenever we render raster tiles
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

export default function GeoapifyMap({ lat, lng, zoom = 16, style, showOperator = true }: Props) {
  const clientOk = isNum(lat) && isNum(lng);
  const clientCenter: [number, number] = [lng ?? 0, lat ?? 0];

  // Force raster unless you enable vector above
  const [mode, setMode] = React.useState<'vector' | 'raster-mt' | 'raster-osm'>(USE_VECTOR ? 'vector' : 'raster-mt');
  const [mapReady, setMapReady] = React.useState(mode !== 'vector'); // raster usable immediately

  const [op, setOp] = React.useState<OperatorLocation | null>(null);
  const [routeFC, setRouteFC] = React.useState<any | null>(null);

  // Camera + guards (auto-zoom once, then never again after user interaction)
  const camRef = React.useRef<MapLibreGL.Camera>(null);
  const didInitView = React.useRef(false);
  const didFitTwoPoints = React.useRef(false);
  const userHasTakenControl = React.useRef(false);

  const onRegionWillChange = React.useCallback((e: any) => {
    const p = e?.nativeEvent?.properties ?? e?.properties ?? {};
    const byUser = p?.gesture === true || p?.isUserInteraction === true || p?.manualGesture === true;
    if (byUser) userHasTakenControl.current = true;
  }, []);

  // Vector: ready after style loads; Raster: ready now
  const onStyleLoaded = () => setMapReady(true);

  // Ignore harmless “Canceled”; only fallback for real failures
  const onMapError = (e: any) => {
    const msg = String(e?.nativeEvent?.message || '');
    const shouldFallback =
      /401|403|404|429|5\d\d|Unauthorized|Forbidden|Not Found|Too Many/i.test(msg);
    if (!shouldFallback) {
      console.log('Map error (ignored):', msg);
      return;
    }
    console.log('Map error (fallback to raster):', msg);
    setMapReady(true);
    setMode('raster-mt');
  };

  // Poll operator (for the red pin)
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

  // Route fetch (no camera move)
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

  // Auto-zoom once (or fit both once) before user interaction
  React.useEffect(() => {
    if (!mapReady || !clientOk || userHasTakenControl.current) return;

    if (!op && !didInitView.current) {
      didInitView.current = true;
      // Delay a tick to avoid racing initial map render
      setTimeout(() => {
        camRef.current?.setCamera?.({
          centerCoordinate: clientCenter,
          zoomLevel: zoom,
          animationDuration: 400,
          animationMode: 'flyTo',
        } as any);
      }, 50);
    }

    if (op && !didFitTwoPoints.current) {
      const sw: [number, number] = [Math.min(op.lng, clientCenter[0]), Math.min(op.lat, clientCenter[1])];
      const ne: [number, number] = [Math.max(op.lng, clientCenter[0]), Math.max(op.lat, clientCenter[1])];
      setTimeout(() => {
        camRef.current?.fitBounds?.(sw, ne, 60, 800);
      }, 50);
      didFitTwoPoints.current = true;
    }
  }, [mapReady, clientOk, op?.lat, op?.lng, clientCenter[0], clientCenter[1], zoom]);

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
        onDidFinishLoadingStyle={onStyleLoaded}
        onMapError={onMapError}
        {...(mode === 'vector'
          ? { styleURL: VECTOR_STYLE_URL }
          : { styleJSON: EMPTY_STYLE_JSON })}
      >
        <MapLibreGL.Camera ref={camRef as any} />

        {/* Base raster tiles when not in vector mode */}
        {mode !== 'vector' && (
          <MapLibreGL.RasterSource
            id="custom-base"
            tileUrlTemplates={mode === 'raster-mt' ? MAPTILER_RASTER_TILES_512 : OSM_RASTER_TILES_256}
            tileSize={mode === 'raster-mt' ? 512 : 256}
            minZoomLevel={0}
            maxZoomLevel={19}
          >
            <MapLibreGL.RasterLayer id="custom-base-layer" />
          </MapLibreGL.RasterSource>
        )}

        {/* Optional route overlay */}
        {routeFC && (
          <MapLibreGL.ShapeSource id="custom-route" shape={routeFC}>
            <MapLibreGL.LineLayer
              id="custom-route-line"
              style={{ lineColor: '#6EFF87', lineWidth: 5, lineCap: 'round', lineJoin: 'round', lineOpacity: 0.95 }}
            />
          </MapLibreGL.ShapeSource>
        )}

        {/* Client pin */}
        <MapLibreGL.MarkerView id="client-pin" coordinate={clientCenter} anchor={{ x: 0.5, y: 1.0 }}>
          <UserPin />
        </MapLibreGL.MarkerView>

        {/* Operator pin */}
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
