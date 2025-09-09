import React, { useEffect, useRef, useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import TemperatureDial from '../components/TemperatureDial';
import { useBleScanner } from '../features/useBLEscanner';

type Phase = 'idle' | 'extending' | 'heating' | 'retracting';

export default function OperateScreen() {
  const { sendByte, subscribeToNotifications, isConnected } = useBleScanner();
  const pressRef = useRef(0);
  const [phase, setPhase] = useState<Phase>('idle');

  const busy = phase !== 'idle';

  const label = (() => {
    switch (phase) {
      case 'idle': return 'START';
      case 'extending': return 'EXTENDING…';
      case 'heating': return 'HEATING…';
      case 'retracting': return 'RETRACTING…';
    }
  })();

  const handleStart = async () => {
    if (busy) return;
    try {
      if (!isConnected) {
        Alert.alert('Not connected', 'Please connect to a device first.');
        return;
      }
      // 1..100 then wrap
      pressRef.current = (pressRef.current % 100) + 1;
      await sendByte(pressRef.current);

      // Optimistic UI: show EXTENDING immediately; ESP32 will confirm via notify
      setPhase('extending');
    } catch (e) {
      console.log('sendByte error:', e);
      Alert.alert('Error', 'Failed to send START. Check connection.');
    }
  };

  // Listen for ESP32 status notifications to drive the button state
  useEffect(() => {
    const unsub = subscribeToNotifications?.((msg: string) => {
      const m = msg.trim().toUpperCase();
      // Expect: EXTEND / HOLD / RETRACT / COMPLETE / READY / SAFE:...
      if (m.startsWith('EXTEND')) setPhase('extending');
      else if (m.startsWith('HOLD')) setPhase('heating');
      else if (m.startsWith('RETRACT')) setPhase('retracting');
      else if (m.includes('COMPLETE') || m.includes('READY') || m.includes('SAFE:DONE')) {
        setPhase('idle'); // allow starting again
      }
      // If a safety triggers, keep it disabled until SAFE:DONE/READY
      else if (m.startsWith('SAFE') || m.startsWith('ERROR')) {
        // keep current non-idle phase; ESP32 will send SAFE:DONE/READY when cleared
      }
    });

    return () => { try { unsub && unsub(); } catch {} };
  }, [subscribeToNotifications]);

  return (
    <View style={styles.container}>
      <Text style={styles.brand}>
        <Text style={{ color: '#6EFF87' }}>patch</Text>
        <Text style={{ color: '#fff' }}> up</Text>
      </Text>

      <View style={{ marginTop: 40 }}>
        <TemperatureDial />
      </View>

      <TouchableOpacity
        style={[styles.startBtn, busy && styles.startBtnDisabled]}
        onPress={handleStart}
        disabled={busy}
        activeOpacity={0.8}
      >
        <Text style={styles.startTxt}>{label}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#0F0F0F', 
    alignItems: 'center', 
    paddingTop: 60 
  },

  brand: { fontSize: 28, fontWeight: 'bold', marginBottom: 20 },
  startBtn: {
    marginTop: 24,
    backgroundColor: '#6E686A',
    paddingVertical: 16,
    paddingHorizontal: 28,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#8C8386',
  },
  startBtnDisabled: { opacity: 0.55 },
  startTxt: { color: '#fff', fontWeight: '700', fontSize: 16, letterSpacing: 1 },
});
