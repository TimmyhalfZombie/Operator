import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Device } from 'react-native-ble-plx';
import { Bluetooth } from 'phosphor-react-native';

type Props = {
  device: Device;
  isConnected: boolean;
  onConnect: () => void;
  showConnect?: boolean;
};

export default function BLEDeviceCard({ device, isConnected, onConnect, showConnect = true }: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Bluetooth color="#fff" size={22} />
        <Text style={styles.title}>Bluetooth</Text>
        {showConnect && !isConnected && (
          <TouchableOpacity style={styles.connectButton} onPress={onConnect}>
            <Text style={styles.connectButtonText}>Connect</Text>
          </TouchableOpacity>
        )}
      </View>
      <Text style={styles.name}>{device.name || 'Unknown'}</Text>
      <Text style={styles.id}>{device.id}</Text>
      <Text style={styles.status}>{isConnected ? 'BONDED' : 'NOT BONDED'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#161616',
    borderColor: '#444',
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginVertical: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  title: {
    color: '#fff',
    marginLeft: 8,
    fontWeight: 'bold',
    fontSize: 16,
  },
  connectButton: {
    backgroundColor: '#322F36',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 14,
    marginLeft: 'auto',
    marginRight: 0,
  },
  connectButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  name: {
    color: '#fff',
    fontSize: 18,
    marginTop: 6,
  },
  id: {
    color: '#aaa',
    fontSize: 13,
    marginVertical: 2,
  },
  status: {
    color: '#ccc',
    fontSize: 12,
    marginBottom: 8,
  },
});
