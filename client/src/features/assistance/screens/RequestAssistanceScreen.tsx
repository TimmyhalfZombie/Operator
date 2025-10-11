import React from 'react';
import { View, ActivityIndicator, Text, StyleSheet, Alert } from 'react-native';
import GeoapifyMap from '../../../components/GeoapifyMap';
import RequestBottomCard from '../components/RequestBottomCard';
import { useNextAssist } from '../../useNextRequest';

export default function RequestAssistanceScreen() {
  const { data, loading, error, reload, accept, decline } = useNextAssist();

  if (loading && !data) {
    return <View style={styles.center}><ActivityIndicator /></View>;
  }
  if (error) {
    return (
      <View style={styles.center}>
        <Text style={{ color: 'white', marginBottom: 8 }}>{error}</Text>
        <Text onPress={reload} style={{ color: '#9EF29E' }}>Retry</Text>
      </View>
    );
  }
  if (!data) {
    return <View style={styles.center}><Text style={{ color: 'white' }}>No pending requests.</Text></View>;
  }

  const onAccept = async () => {
    try { await accept(); Alert.alert('Accepted'); }
    catch (e: any) { Alert.alert('Error', e?.message ?? 'Failed'); }
  };
  const onDecline = async () => {
    try { await decline(); Alert.alert('Declined'); }
    catch (e: any) { Alert.alert('Error', e?.message ?? 'Failed'); }
  };

  return (
    <View style={styles.container}>
      {/* Pass coords only if present; component can handle undefined */}
      <GeoapifyMap lat={data.coords?.lat} lng={data.coords?.lng} />
      <RequestBottomCard
        clientName={data.clientName}
        placeName={data.placeName}
        address={data.address}
        onAccept={onAccept}
        onDecline={onDecline}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'black' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'black' },
});
