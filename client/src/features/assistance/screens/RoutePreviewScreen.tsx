import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ActivityIndicator, Text, StyleSheet as RNStyleSheet } from 'react-native';
import * as Location from 'expo-location';
import { useLocalSearchParams } from 'expo-router';
import MapLibreRouteMap from '../../navigation/RouteMap';
import { fetchRoute } from '../../navigation/api';
import RequestBottomCard from '../components/RequestBottomCard';

type Params = { clientLat?: string; clientLng?: string };
type LatLng = { lat: number; lng: number };

function num(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export default function RoutePreviewScreen() {
  const { clientLat, clientLng } = useLocalSearchParams<Params>();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string>('');
  const [from, setFrom] = useState<LatLng | null>(null);
  const [to, setTo] = useState<LatLng | null>(null);
  const [line, setLine] = useState<LatLng[]>([]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') throw new Error('Location permission denied');

        const last = await Location.getLastKnownPositionAsync();
        const pos = last ?? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
        const me: LatLng = { lat: pos.coords.latitude, lng: pos.coords.longitude };

        const latParam = num(clientLat);
        const lngParam = num(clientLng);
        const cl: LatLng = latParam !== null && lngParam !== null ? { lat: latParam, lng: lngParam } : me;

        if (!mounted) return;
        setFrom(me);
        setTo(cl);

        try {
          const r = await fetchRoute(me, cl, 'drive');
          if (mounted) setLine(r.points);
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
      {/* Map absolutely fills the screen */}
      <MapLibreRouteMap from={from} to={to} line={line} style={RNStyleSheet.absoluteFillObject} />

      {/* Bottom card overlays (so the map stays visible behind it) */}
      <RequestBottomCard
        clientName="Customer"
        placeName="Destination"
        address=" "
        onAccept={() => {}}
        onDecline={() => {}}
        absolute
        bottomOffset={12}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' }, // Important: parent must flex
  loaderWrap: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
