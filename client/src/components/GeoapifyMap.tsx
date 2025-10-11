import React from 'react';
import { View, StyleSheet, Text, ViewStyle, StyleProp } from 'react-native';
import MapLibreGL from '@maplibre/maplibre-react-native';
import { GEOAPIFY_KEY } from '../constants/geo';
import UserPin from './UserPin';

type Props = {
  lat?: number | null;
  lng?: number | null;
  zoom?: number;
  /** If provided, overrides the container style. */
  style?: StyleProp<ViewStyle>;
};

function isNum(v: any): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

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

export default function GeoapifyMap({ lat, lng, zoom = 16, style }: Props) {
  const ok = isNum(lat) && isNum(lng);
  const [useGeoapify, setUseGeoapify] = React.useState(false);

  React.useEffect(() => {
    let m = true;
    testGeoapifyKey(GEOAPIFY_KEY).then((good) => m && setUseGeoapify(good));
    return () => { m = false; };
  }, []);

  if (!ok) {
    return (
      <View style={[styles.wrap, style ?? styles.defaultSize, styles.placeholder]}>
        <Text style={styles.placeholderText}>Location unavailable</Text>
      </View>
    );
  }

  // MapLibre expects [lng, lat]
  const center: [number, number] = [lng!, lat!];

  // Geoapify raster tiles (no vector style URL so we avoid font/glyph endpoints).
  const geoapifyTiles = [
    `https://maps.geoapify.com/v1/tile/osm-carto/{z}/{x}/{y}.png?apiKey=${GEOAPIFY_KEY}`,
  ];
  // Fallback: OSM raster tiles
  const osmTiles = ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'];
  const tiles = useGeoapify ? geoapifyTiles : osmTiles;
  const maxZoom = useGeoapify ? 20 : 19;

  return (
    <View style={[styles.wrap, style ?? styles.defaultSize]}>
      <MapLibreGL.MapView
        style={StyleSheet.absoluteFillObject}
        compassEnabled={false}
        logoEnabled={false}
        attributionEnabled={false}
      >
        <MapLibreGL.Camera
          centerCoordinate={center}
          zoomLevel={zoom}
          animationMode="flyTo"
          animationDuration={400}
        />

        <MapLibreGL.RasterSource
          id="base"
          tileUrlTemplates={tiles}
          tileSize={256}
          minZoomLevel={0}
          maxZoomLevel={maxZoom}
        >
          <MapLibreGL.RasterLayer id="base-layer" />
        </MapLibreGL.RasterSource>

        <MapLibreGL.MarkerView id="user-pin" coordinate={center} anchor={{ x: 0.5, y: 1.0 }}>
          <UserPin />
        </MapLibreGL.MarkerView>
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
