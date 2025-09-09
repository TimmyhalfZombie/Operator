import React, { useEffect, useState } from 'react';
import { Alert, PermissionsAndroid, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import BLEDeviceCard from '../components/BLEDeviceCard';
import TemperatureDial from '../components/TemperatureDial';
import { useBleScanner } from '../features/useBLEscanner';
import OperateScreen from '../screens/OperateScreen';

export default function HomeScreen() {
  const {
    devices,
    scanning,
    startScan,
    stopScan,
    connectToDevice,
    connectedDeviceId,
    needsBluetooth,
  } = useBleScanner();

  const [showOperator, setShowOperator] = useState(false);

  // If the device disconnects, go back to scanner view automatically
  useEffect(() => {
    if (!connectedDeviceId) setShowOperator(false);
  }, [connectedDeviceId]);

  // Ask runtime permissions before scanning
  const handleScanPress = async () => {
    if (Platform.OS === 'android') {
      const result = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      ]);

      const allGranted =
        result[PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION] === PermissionsAndroid.RESULTS.GRANTED &&
        result[PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN] === PermissionsAndroid.RESULTS.GRANTED &&
        result[PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT] === PermissionsAndroid.RESULTS.GRANTED;

      if (!allGranted) {
        Alert.alert('Permissions needed','Please grant Bluetooth & Location permissions to scan for devices.');
        return;
      }
    }
    startScan();
  };

  const handleStart = () => {
    if (!connectedDeviceId) {
      Alert.alert('Not connected', 'Connect to a device first.');
      return;
    }
    setShowOperator(true); // ← switch Home to show the Operator panel
  };

  // ── If we’re showing the operator panel, render it and keep the Home tab active
  if (connectedDeviceId && showOperator) {
    return <OperateScreen />; // same UI you showed on your separate operator route
  }

  // ── Otherwise show the scanner UI (original Home content)
  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* App Title */}
      <View style={{ width: '100%', alignItems: 'flex-start', paddingHorizontal: 24 }}>
        <Text style={styles.title}>
          <Text style={{ color: '#44ff75', fontWeight: 'bold', fontFamily: 'Candal-Regular' }}>patch</Text>
          <Text style={{ color: '#fff', fontWeight: 'bold', fontFamily: 'Candal-Regular' }}> up</Text>
        </Text>
      </View>

      {/* Temperature Dial */}
      <View style={{ marginTop: 60 }}>
        <TemperatureDial />
      </View>

      {/* BLE Section */}
      <View style={styles.bleSection}>
        {devices.length === 0 && !scanning && (
          <View>
            <Text style={styles.bleLabel}>
              {needsBluetooth ? 'Please turn on Bluetooth to scan.' : 'No BLE device found.'}
            </Text>
            <TouchableOpacity style={styles.bleButton} onPress={handleScanPress}>
              <Text style={styles.bleButtonText}>Scan for device</Text>
            </TouchableOpacity>
          </View>
        )}

        {scanning && devices.length === 0 && (
          <Text style={styles.bleLabel}>Scanning...</Text>
        )}

        {devices.length > 0 && (
          <View>
            {devices.map((device) => (
              <BLEDeviceCard
                key={device.id}
                device={device}
                isConnected={connectedDeviceId === device.id}
                onConnect={() => connectToDevice(device)}
                showConnect={true}
              />
            ))}

            {/* Show START only when connected */}
            {connectedDeviceId && (
              <TouchableOpacity style={styles.bleButton} onPress={handleStart}>
                <Text style={styles.bleButtonText}>START</Text>
              </TouchableOpacity>
            )}

            {/* Scan toggle */}
            <TouchableOpacity
              style={styles.bleButton}
              onPress={scanning ? stopScan : handleScanPress}
            >
              <Text style={styles.bleButtonText}>
                {scanning ? 'Stop Scanning' : 'Scan for device'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { paddingTop: 50, paddingVertical: 32, alignItems: 'center', backgroundColor: '#181818', flexGrow: 1, minHeight: '100%' },
  title: { fontSize: 34, marginBottom: 14, marginTop: 14, letterSpacing: 1, flexDirection: 'row' },
  bleSection: { width: '92%', marginTop: 42, backgroundColor: '#101010', borderRadius: 16, padding: 18, borderWidth: 1, borderColor: '#222', minHeight: 130, alignSelf: 'center', marginBottom: 40 },
  bleLabel: { color: '#fff', textAlign: 'center', marginBottom: 18 },
  bleButton: { backgroundColor: '#44ff75', paddingHorizontal: 22, paddingVertical: 10, borderRadius: 8, alignSelf: 'center', marginTop: 10 },
  bleButtonText: { color: '#181818', fontWeight: 'bold', fontSize: 15 },
});
