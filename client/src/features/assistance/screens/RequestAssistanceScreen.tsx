import React from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';
import GeoapifyMap from '../../../components/GeoapifyMap';
import useAcceptedJobUI from '../../useAcceptedJobUI';
import { useNextAssist } from '../../useNextRequest';
import RequestBottomCard from '../components/RequestBottomCard';

type LatLng = { lat: number; lng: number };

export default function RequestAssistanceScreen() {
  const { data, loading, error, reload, accept, decline } = useNextAssist();
  const acceptedUI = useAcceptedJobUI();
  const [accepted, setAccepted] = React.useState(false);
  const [acceptedCoords, setAcceptedCoords] = React.useState<LatLng | undefined>(undefined);

  // prevent duplicate "Repaired" calls
  const completingRef = React.useRef(false);

  if (loading && !data && !accepted) {
    return <View style={styles.center}><ActivityIndicator /></View>;
  }
  if (error && !accepted) {
    return (
      <View style={styles.center}>
        <Text style={{ color: 'white', marginBottom: 8 }}>{error}</Text>
        <Text onPress={reload} style={{ color: '#9EF29E' }}>Retry</Text>
      </View>
    );
  }
  if (!data && !accepted) {
    return <View style={styles.center}><Text style={{ color: 'white' }}>No pending requests.</Text></View>;
  }

  const onAccept = async () => {
    if (!data) return;

    acceptedUI.openFromRequest(data, {
      onRepaired: async () => {
        if (completingRef.current) return;
        completingRef.current = true;
        try {
          // Navigation is handled by useAcceptedJobUI.tsx
          // No need to navigate here to prevent double navigation
        } catch (e: any) {
          Alert.alert('Error', e?.message ?? 'Failed to complete.');
        } finally {
          completingRef.current = false;
        }
      },
      onCancel: () => Alert.alert('Ended', 'Job ended.'),
      bottomOffset: 12,
    });

    setAccepted(true);
    setAcceptedCoords(data.coords);

    try {
      await accept(data.id);
    } catch (e: any) {
      const msg = String(e?.message || '').toLowerCase();
      if (!msg.includes('no longer pending') && !msg.includes('already handled')) {
        Alert.alert('Error', e?.message ?? 'Failed');
        setAccepted(false);
      }
    }
  };

  const onDecline = async () => {
    try {
      if (data) await decline(data.id);
      Alert.alert('Declined');
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed');
    }
  };

  const lat = data?.coords?.lat ?? acceptedCoords?.lat;
  const lng = data?.coords?.lng ?? acceptedCoords?.lng;

  return (
    <View style={styles.container}>
      <GeoapifyMap lat={lat} lng={lng} />

      {/* PENDING state → ONLY Accept/Decline card */}
      {!accepted && data && (
        <RequestBottomCard
          clientName={data.clientName}
          placeName={data.placeName}
          address={data.address}
          onAccept={onAccept}
          onDecline={onDecline}
        />
      )}

      {/* ACCEPTED state → full card with pills + Repaired/Power */}
      {acceptedUI.element}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'black' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'black' },
});
