// src/navigation/RouteMap.tsx
import MapLibreGL from '@maplibre/maplibre-react-native';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';

import ClientPin from '../../components/ClientPin'; // blue client pin
import { GEOAPIFY_KEY } from '../../constants/geo';
import { fetchClientLocation, LatLng } from './api';

type Props = {
  from: LatLng;
  to?: LatLng;
  clientId?: string;
  line?: LatLng[];
  style?: StyleProp<ViewStyle>;
};

MapLibreGL.setAccessToken(null);

async function testGeoapifyKey(key: string): Promise<boolean> {
  if (!key) return false;
  try {
    const r = await fetch(
      `https://maps.geoapify.com/v1/tile/osm-carto/1/1/1.png?apiKey=${key}`
    );
    return r.ok;
  } catch {
    return false;
  }
}

export default function MapLibreRouteMap({
  from,
  to,
  clientId,
  line = [],
  style,
}: Props) {
  const [useGeoapify, setUseGeoapify] = useState(false);
  const [decided, setDecided] = useState(false);

  const [client, setClient] = useState<LatLng | null>(to ?? null);
  const [loadingClient, setLoadingClient] = useState(!to && !!clientId);
  const [clientErr, setClientErr] = useState<string | null>(null);

  useEffect(() => {
    let m = true;
    testGeoapifyKey(GEOAPIFY_KEY).then((ok) => {
      if (!m) return;
      setUseGeoapify(ok);
      setDecided(true);
    });
    return () => {
      m = false;
    };
  }, []);

  // fetch client location if not provided
  useEffect(() => {
    let m = true;
    if (!to && clientId) {
      setLoadingClient(true);
      setClientErr(null);
      fetchClientLocation(clientId)
        .then((loc) => {
          if (m) setClient(loc);
        })
        .catch((e) => {
          if (m) setClientErr(e?.message || 'Failed to load client');
        })
        .finally(() => {
          if (m) setLoadingClient(false);
        });
    }
    return () => {
      m = false;
    };
  }, [clientId, to]);

  const effectiveClient = client ?? to ?? from; // used for centering
  const maybeClient = client ?? to ?? null;     // used for rendering client pin

  // MapLibre expects [lng, lat]
  const center = useMemo<[number, number]>(
    () => [
      (from.lng + effectiveClient.lng) / 2,
      (from.lat + effectiveClient.lat) / 2,
    ],
    [from, effectiveClient]
  );

  // Optional route line
  const routeFeature = useMemo(() => {
    if (!line.length) return null;
    return {
      type: 'Feature' as const,
      geometry: {
        type: 'LineString' as const,
        coordinates: line.map((p) => [p.lng, p.lat]),
      },
      properties: {},
    };
  }, [line]);

  const EMPTY_STYLE_JSON = JSON.stringify({ version: 8, sources: {}, layers: [] });
  const geoStyleURL = `https://maps.geoapify.com/v1/styles/dark-matter/style.json?apiKey=${GEOAPIFY_KEY}`;

  // OSM tiles for raster fallback
  const fallbackTiles = ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'];

  if (!decided) {
    return (
      <View style={[styles.fill, style]}>
        <View style={{ padding: 8 }}>
          <Text style={{ color: '#bbb', fontSize: 12 }}>Preparing map…</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.fill, style]}>
      <MapLibreGL.MapView
        style={StyleSheet.absoluteFill}
        {...(useGeoapify
          ? { styleURL: geoStyleURL }
          : { styleJSON: EMPTY_STYLE_JSON })}
        compassEnabled={false}
        logoEnabled={false}
        attributionEnabled={false}
      >
        <MapLibreGL.Camera centerCoordinate={center} zoomLevel={13} />

        {!useGeoapify && (
          <MapLibreGL.RasterSource
            id="osm"
            tileUrlTemplates={fallbackTiles}
            tileSize={256}
            maxZoomLevel={19}
          >
            <MapLibreGL.RasterLayer id="osm-layer" />
          </MapLibreGL.RasterSource>
        )}

        {routeFeature && (
          <MapLibreGL.ShapeSource id="route" shape={routeFeature}>
            <MapLibreGL.LineLayer
              id="routeLine"
              style={{
                lineWidth: 5,
                lineOpacity: 0.9,
                lineColor: '#00B3FF',
                lineCap: 'round',
                lineJoin: 'round',
              }}
            />
          </MapLibreGL.ShapeSource>
        )}

        {/* Client — blue circle pin */}
        {maybeClient && (
          <MapLibreGL.MarkerView
            id="client-pin"
            coordinate={[maybeClient.lng, maybeClient.lat]}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <ClientPin />
          </MapLibreGL.MarkerView>
        )}
      </MapLibreGL.MapView>

      {(loadingClient || clientErr) && (
        <View style={styles.hud}>
          {loadingClient ? <ActivityIndicator size="small" /> : null}
          <Text style={[styles.hudText, clientErr ? { color: '#ff6b6b' } : null]}>
            {clientErr ? 'Client location error' : 'Loading client…'}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: '#000' },
  hud: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
  },
  hudText: { marginLeft: 6, color: '#eee', fontSize: 12 },
});
