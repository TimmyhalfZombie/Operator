import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ActivityIndicator, Text } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import Constants from 'expo-constants';
import MapLibreRouteMap from '../../navigation/RouteMap';
import { fetchRoute } from '../../navigation/api';
import AcceptedRequestCard from '../../../components/AcceptedRequestCard';

type Params = {
  clientLat?: string;
  clientLng?: string;
  // Optional details for the accepted UI
  clientName?: string;
  placeName?: string;
  address?: string;
  vehicleType?: string;
  plateNumber?: string;
  phone?: string;
  otherInfo?: string;
};

type LatLng = { lat: number; lng: number };
type OperatorLocation = { lat: number; lng: number; updated_at?: string };

function num(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

const extra: any =
  (Constants as any)?.expoConfig?.extra ??
  (Constants as any)?.manifest?.extra ??
  {};

const API_BASE = (
  (process.env.EXPO_PUBLIC_API_BASE as string) ||
  (extra?.API_BASE as string) ||
  ''
).replace(/\/$/, '');

const OP_LOC_URL = API_BASE ? `${API_BASE}/api/users/me/location` : `/api/users/me/location`;

async function fetchOperatorLocation(): Promise<OperatorLocation | null> {
  try {
    const r = await fetch(OP_LOC_URL, { method: 'GET', credentials: 'include' as any });
    if (!r.ok) return null;
    const j = await r.json();
    const lat = num(j?.lat);
    const lng = num(j?.lng);
    if (lat === null || lng === null) return null;
    return { lat, lng, updated_at: j?.updated_at };
  } catch {
    return null;
  }
}

export default function RoutePreviewScreen() {
  const {
    clientLat, clientLng,
    clientName, placeName, address,
    vehicleType, plateNumber, phone, otherInfo,
  } = useLocalSearchParams<Params>();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string>('');
  const [from, setFrom] = useState<LatLng | null>(null); // operator (from appdb)
  const [to, setTo] = useState<LatLng | null>(null);     // client (from params)
  const [line, setLine] = useState<LatLng[]>([]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        // 1) Get operator location from appdb
        const op = await fetchOperatorLocation();
        if (!op) throw new Error('Operator location unavailable');

        // 2) Resolve client coordinates from params (fallback to operator if missing)
        const latParam = num(clientLat);
        const lngParam = num(clientLng);
        const client: LatLng =
          latParam !== null && lngParam !== null ? { lat: latParam, lng: lngParam } : op;

        if (!mounted) return;
        setFrom(op);
        setTo(client);

        // 3) Fetch a driving route between operator and client
        try {
          const r = await fetchRoute(op, client, 'drive');
          if (mounted && r?.points) setLine(r.points);
        } catch {
          // route optional; keep silent if it fails
        }
      } catch (e: any) {
        if (mounted) setErr(e?.message || 'Failed to load route');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [clientLat, clientLng]);

  if (loading) {
    return (
      <View style={styles.loaderWrap}>
        <ActivityIndicator />
      </View>
    );
  }

  if (err || !from || !to) {
    return (
      <View style={styles.loaderWrap}>
        <Text style={{ color: '#fff' }}>{err || 'No route available'}</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {/* Map absolutely fills the screen */}
      <MapLibreRouteMap from={from} to={to} line={line} style={StyleSheet.absoluteFillObject} />

      {/* Accepted-state card overlays the map */}
      <AcceptedRequestCard
        clientName={clientName || 'Customer'}
        placeName={placeName || 'Destination'}
        address={address || ''}
        vehicleType={vehicleType}
        plateNumber={plateNumber}
        phone={phone}
        otherInfo={otherInfo}
        onRepaired={() => {
          // TODO: call your "complete" API
        }}
        onCancelPress={() => {
          // TODO: call your "cancel/end" API
        }}
        absolute
        bottomOffset={12}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  loaderWrap: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
