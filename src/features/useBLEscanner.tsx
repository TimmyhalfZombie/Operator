import { useEffect, useRef, useState } from 'react';
import { BleManager, Device, State } from 'react-native-ble-plx';
import { Platform, PermissionsAndroid } from 'react-native';
import { Buffer } from 'buffer';

export function useBleScanner() {
  const bleManager = useRef(new BleManager()).current;

  const [scanning, setScanning] = useState(false);
  const [devices, setDevices] = useState<Device[]>([]);
  const [connectedDeviceId, setConnectedDeviceId] = useState<string | null>(null);
  const [needsBluetooth, setNeedsBluetooth] = useState(false); // <-- use this to show your prompt

  // UUIDs
  const LED_SERVICE_UUID = 'c191e8aa-fb8a-4c7a-8750-5eb91c7c794a';
  const LED_CHAR_UUID    = 'c191e8ab-fb8a-4c7a-8750-5eb91c7c794a';

  // Write one byte (0x01 on, 0x00 off)
  const writeLed = async (device: Device, on: boolean) => {
    try {
      await device.writeCharacteristicWithResponseForService(
        LED_SERVICE_UUID,
        LED_CHAR_UUID,
        Buffer.from([on ? 0x01 : 0x00]).toString('base64')
      );
    } catch {}
  };

  useEffect(() => {
    return () => {
      bleManager.destroy();
    };
  }, []);

  async function requestPermissions() {
    if (Platform.OS === 'android') {
      const result = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      ]);
      console.log('Permissions result:', result);
    }
  }

  const startScan = async () => {
    await requestPermissions();

    // Check Bluetooth power state first
    const state = await bleManager.state();
    if (state !== State.PoweredOn) {
      // show your in-app modal/sheet using this flag
      setNeedsBluetooth(true);
      return;
    }

    setDevices([]);
    setConnectedDeviceId(null);
    setScanning(true);
    console.log('Starting BLE scan...');

    bleManager.startDeviceScan(null, null, (error, device) => {
      if (error) {
        console.log('Scan error:', error.message);
        setScanning(false);
        return;
      }
      if (device && device.name) {
        // Only add unique devices
        setDevices(prev =>
          prev.some(d => d.id === device.id) ? prev : [...prev, device]
        );
      }
    });

    // Stop after 20s
    setTimeout(() => {
      bleManager.stopDeviceScan();
      setScanning(false);
      console.log('Scan stopped.');
    }, 20000);
  };

  const stopScan = () => {
    bleManager.stopDeviceScan();
    setScanning(false);
    console.log('Manual scan stop.');
  };

  const connectToDevice = async (device: Device) => {
    try {
      stopScan();
      const connected = await device.connect();
      await connected.discoverAllServicesAndCharacteristics();
      setConnectedDeviceId(connected.id);
    } catch {
      setConnectedDeviceId(null);
    }
  };

  return {
    // data
    devices,
    scanning,
    connectedDeviceId,

    // actions
    startScan,
    stopScan,
    connectToDevice,
    writeLed,

    // bluetooth prompt control
    needsBluetooth,
    setNeedsBluetooth,
  };
}
