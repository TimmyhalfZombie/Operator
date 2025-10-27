import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ActivityIndicator, Text } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import MapLibreRouteMap from '../../navigation/RouteMap';
import { fetchRoute } from '../../navigation/api';
import AcceptedRequestCard from '../../../components/AcceptedRequestCard';
import { API_URL } from '../../../lib/env';

type Params = {
  clientLat?: string;
  clientLng?: string;
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

async function fetchOperatorLocation(): Promise<OperatorLocation | null> {
  try {
    const { tokens } = await import('../../../auth/tokenStore');
    const accessToken = await tokens.getAccessAsync();

    const r = await fetch(`${API_URL}/api/users/me/location`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
    });
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
  const [from, setFrom] = useState<LatLng | null>(null);
  const [to,   setTo]   = useState<LatLng | null>(null);
  const [line, setLine] = useState<LatLng[]>([]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const op = await fetchOperatorLocation();
        if (!op) throw new Error('Operator location unavailable');

        const latParam = num(clientLat);
        const lngParam = num(clientLng);
        const client: LatLng =
          latParam !== null && lngParam !== null ? { lat: latParam, lng: lngParam } : op;

        if (!mounted) return;
        setFrom(op);
        setTo(client);

        try {
          const r = await fetchRoute(op, client, 'drive');
          if (mounted && r?.points) setLine(r.points);
        } catch {}
      } catch (e: any) {
        if (mounted) setErr(e?.message || 'Failed to load route');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
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
      <MapLibreRouteMap from={from} to={to} line={line} style={StyleSheet.absoluteFillObject} />
      <AcceptedRequestCard
        clientName={clientName || 'Customer'}
        placeName={placeName || 'Destination'}
        address={address || ''}
        vehicleType={vehicleType}
        plateNumber={plateNumber}
        phone={phone}
        otherInfo={otherInfo}
        onRepaired={() => {}}
        onCancelPress={() => {}}
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
