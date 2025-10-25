// client/constants/geo.ts
import Constants from 'expo-constants';

type Extra = {
  GEOAPIFY_KEY?: string;
  /** Optional: if you want to override the default style URL entirely */
  GEOAPIFY_STYLE?: string;
};

const extra: Extra =
  ((Constants as any)?.expoConfig?.extra ??
    (Constants as any)?.manifest?.extra ??
    {}) as Extra;

/**
 * Your Geoapify API key. We check env first (EAS preferred), then app.json/app.config.js "extra".
 */
export const GEOAPIFY_KEY: string =
  (process.env.EXPO_PUBLIC_GEOAPIFY_KEY as string) || extra.GEOAPIFY_KEY || "";

/**
 * A ready-to-use style URL for MapLibre. You can override via extra.GEOAPIFY_STYLE if desired.
 */
export const GEOAPIFY_STYLE_URL: string =
  extra.GEOAPIFY_STYLE ||
  (GEOAPIFY_KEY
    ? `https://maps.geoapify.com/v1/styles/osm-carto/style.json?apiKey=${GEOAPIFY_KEY}`
    : // keep the same shape even if key is missing (MapLibre will just fail to load tiles)
      `https://maps.geoapify.com/v1/styles/osm-carto/style.json?apiKey=`);

/**
 * Helper to build a routing URL (defaults to "drive").
 */
export function geoapifyRouteURL(
  fromLng: number,
  fromLat: number,
  toLng: number,
  toLat: number,
  mode: "drive" | "walk" | "bicycle" | "transit" = "drive"
): string {
  return `https://api.geoapify.com/v1/routing?waypoints=${fromLng},${fromLat}|${toLng},${toLat}&mode=${mode}&apiKey=${GEOAPIFY_KEY}`;
}

// Friendly warning in dev if the key is missing
if (!GEOAPIFY_KEY) {
  // eslint-disable-next-line no-console
  console.warn(
    "⚠️ GEOAPIFY_KEY missing. Set EXPO_PUBLIC_GEOAPIFY_KEY or add extra.GEOAPIFY_KEY in app.config.js/app.json."
  );
}
