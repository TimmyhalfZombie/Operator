// client/constants/geo.ts
import Constants from 'expo-constants';

const extra: any =
  (Constants?.expoConfig?.extra ??
    (Constants as any)?.manifest?.extra ?? {}) || {};

export const GEOAPIFY_KEY: string =
  process.env.EXPO_PUBLIC_GEOAPIFY_KEY || extra.GEOAPIFY_KEY || '';
