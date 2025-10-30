// client/src/components/GeoapifyMap.tsx
import MapLibreGL from '@maplibre/maplibre-react-native';
import React from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { http } from '../lib/http';
import { getRouteORS, toFeatureCollection } from '../lib/routing';
import UserPin from './ClientPin';
import OperatorPin from './OperatorPin';

type Props = {
  /** Client/customer latitude (blue dot) */
  lat?: number | null;
  /** Client/customer longitude (blue dot) */
  lng?: number | null;
  zoom?: number;
  style?: StyleProp<ViewStyle>;
  /** Show operator pin and route only once accepted */
  showOperator?: boolean;
  /** Skip auto-zoom if true */
  disableAutoZoom?: boolean;
};

type OperatorLocation = { lat: number; lng: number; updated_at?: string };

function isNum(v: any): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

MapLibreGL.setAccessToken(null);

// Fetch the operator (current user) location (server returns from appdb.users)
async function fetchOperatorLocation(): Promise<OperatorLocation | null> {
  try {
    const data = await http.get('/api/users/me/location', { auth: true });
    if (!isNum((data as any)?.lat) || !isNum((data as any)?.lng)) return null;
    return { lat: (data as any).lat, lng: (data as any).lng, updated_at: (data as any).updated_at };
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
  disableAutoZoom = false,
}: Props) {
  const clientOk = isNum(lat) && isNum(lng);
  const clientCenter: [number, number] = [lng ?? 0, lat ?? 0];

  const [mapReady, setMapReady] = React.useState(false);
  const [op, setOp] = React.useState<OperatorLocation | null>(null);
  const [routeFC, setRouteFC] = React.useState<any | null>(null);

  const camRef = React.useRef<MapLibreGL.Camera>(null);
  const userHasTakenControl = React.useRef(false);
  const lastAutoCentered = React.useRef<string | null>(null);
  const autoZoomRetryRef = React.useRef(0);

  const onRegionWillChange = React.useCallback((e: any) => {
    const p = e?.nativeEvent?.properties ?? e?.properties ?? {};
    const byUser = p?.gesture || p?.isUserInteraction || p?.manualGesture;
    if (byUser) userHasTakenControl.current = true;
  }, []);

  // Poll operator location only when we should show the operator (i.e., after Accept)
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
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [showOperator]);

  // Route overlay when both ends exist (operator -> client blue dot)
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!clientOk || !op) {
        if (!cancelled) setRouteFC(null);
        return;
      }
      // ORS expects [lng,lat]
      const route = await getRouteORS(
        [
          [op.lng, op.lat],
          [clientCenter[0], clientCenter[1]],
        ],
        'driving-car'
      );
      if (!cancelled) setRouteFC(toFeatureCollection(route));
    })();
    return () => {
      cancelled = true;
    };
  }, [clientOk, op?.lat, op?.lng, clientCenter[0], clientCenter[1]]);

  // One-time auto-zoom / fit-bounds
  React.useEffect(() => {
    if (disableAutoZoom) return;
    if (!mapReady || !clientOk) return;
    const key =
      showOperator && op && isNum(op.lat) && isNum(op.lng)
        ? `${clientCenter[0]},${clientCenter[1]}|${op.lng},${op.lat}`
        : `${clientCenter[0]},${clientCenter[1]}`;

    if (userHasTakenControl.current) return;
    if (lastAutoCentered.current === key) return;

    lastAutoCentered.current = key;

    const doZoom = () => {
      const cam = camRef.current as any;
      if (!cam) {
        if (autoZoomRetryRef.current < 10) {
          autoZoomRetryRef.current += 1;
          setTimeout(doZoom, 100);
        }
        return;
      }
      const hasOp = showOperator && op && isNum(op.lat) && isNum(op.lng);
      if (hasOp && cam.fitBounds) {
        const sw: [number, number] = [
          Math.min(clientCenter[0], (op as OperatorLocation).lng),
          Math.min(clientCenter[1], (op as OperatorLocation).lat),
        ];
        const ne: [number, number] = [
          Math.max(clientCenter[0], (op as OperatorLocation).lng),
          Math.max(clientCenter[1], (op as OperatorLocation).lat),
        ];
        cam.fitBounds(sw, ne, 60, 700);
      } else if (cam.setCamera) {
        cam.setCamera({
          centerCoordinate: clientCenter,
          zoomLevel: zoom,
          animationDuration: 500,
          animationMode: 'flyTo',
        } as any);
      }
    };
    autoZoomRetryRef.current = 0;
    setTimeout(doZoom, 100);
  }, [disableAutoZoom, mapReady, clientOk, clientCenter[0], clientCenter[1], zoom, showOperator, op?.lat, op?.lng]);

  if (!clientOk) {
    return (
      <View style={[styles.wrap, style ?? styles.defaultSize, styles.placeholder]}>
        <Text style={styles.placeholderText}>Location unavailable</Text>
      </View>
    );
  }

  const osmTiles = ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'];

  return (
    <View style={[styles.wrap, style ?? styles.defaultSize]}>
      <MapLibreGL.MapView
        style={StyleSheet.absoluteFillObject}
        compassEnabled={false}
        logoEnabled={false}
        attributionEnabled={false}
        onRegionWillChange={onRegionWillChange}
        onDidFinishLoadingStyle={() => setMapReady(true)}
      >
        <MapLibreGL.Camera ref={camRef as any} />

        <MapLibreGL.RasterSource id="base" tileUrlTemplates={osmTiles} tileSize={256} minZoomLevel={0} maxZoomLevel={19}>
          <MapLibreGL.RasterLayer id="base-layer" />
        </MapLibreGL.RasterSource>

        {routeFC && (
          <MapLibreGL.ShapeSource id="route" shape={routeFC}>
            <MapLibreGL.LineLayer
              id="route-line"
              style={{ lineColor: '#00B3FF', lineWidth: 5, lineCap: 'round', lineJoin: 'round', lineOpacity: 0.95 }}
            />
          </MapLibreGL.ShapeSource>
        )}

        {/* Client = blue dot location */}
        <MapLibreGL.MarkerView id="client-pin" coordinate={clientCenter} anchor={{ x: 0.5, y: 1.0 }}>
          <UserPin />
        </MapLibreGL.MarkerView>

        {/* Operator = your app device location */}
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
