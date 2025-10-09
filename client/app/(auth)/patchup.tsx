import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, Easing, StatusBar, StyleSheet } from 'react-native';
import { router } from 'expo-router';

const GREEN = '#44ff75';

function Dots() {
  const a = [useRef(new Animated.Value(0)).current,
             useRef(new Animated.Value(0)).current,
             useRef(new Animated.Value(0)).current];

  useEffect(() => {
    const start = (val: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(val, { toValue: 1, duration: 320, easing: Easing.out(Easing.quad), useNativeDriver: true, delay }),
          Animated.timing(val, { toValue: 0, duration: 320, easing: Easing.in(Easing.quad), useNativeDriver: true }),
        ])
      ).start();

    const s1 = start(a[0], 0);
    const s2 = start(a[1], 120);
    const s3 = start(a[2], 240);
    return () => { s1?.stop?.(); s2?.stop?.(); s3?.stop?.(); };
  }, [a]);

  return (
    <>
      {a.map((val, i) => (
        <Animated.Text
          key={i}
          style={{
            color: '#fff',
            fontSize: 22,
            fontWeight: '700',
            transform: [{ translateY: val.interpolate({ inputRange: [0, 1], outputRange: [0, -4] }) }],
            opacity: val.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }),
          }}
        >
          .
        </Animated.Text>
      ))}
    </>
  );
}

export default function PatchingUp() {
  useEffect(() => {
    const t = setTimeout(() => router.replace('/(tabs)/home'), 3000); // 3s
    return () => clearTimeout(t);
  }, []);

  return (
    <View style={styles.wrap}>
      <StatusBar barStyle="light-content" />
      <View style={styles.row}>
        <Text style={[styles.text, { color: GREEN }]}>patching</Text>
        <Text style={[styles.text, { marginHorizontal: 6 }]}>up</Text>
        <Dots />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center' },
  text: { fontSize: 22, fontWeight: '700', color: '#fff' },
});
