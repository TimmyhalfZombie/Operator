// client/app/(auth)/patching-up.tsx
import React, { useEffect, useState } from 'react';
import { SafeAreaView, View, Text, StyleSheet, StatusBar, BackHandler } from 'react-native';
import { router } from 'expo-router';

export default function PatchingUpScreen() {
  const [dots, setDots] = useState('');

  useEffect(() => {
    // cycle ".", "..", "..."
    const dotTimer = setInterval(() => {
      setDots((d) => (d.length < 3 ? d + '.' : ''));
    }, 300);

    // block back while we show the loader
    const onBack = () => true;
    const sub = BackHandler.addEventListener('hardwareBackPress', onBack);

    // navigate after 3 seconds
    const navTimer = setTimeout(() => {
      router.replace('/(tabs)/home');
    }, 5000);

    return () => {
      clearInterval(dotTimer);
      clearTimeout(navTimer);
      sub.remove();
    };
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={styles.center}>
        <Text style={styles.row}>
          <Text style={{ color: '#44ff75', fontWeight: 'normal', fontFamily: 'Candal' }}>patching</Text>
          <Text style={{ color: '#ffffffff', fontWeight: 'normal', fontFamily: 'Candal' }}>  up{dots}</Text>
        </Text>
      </View>
    </SafeAreaView>
  );
}

const BG = '#0B0B0B';
const GREEN = '#44ff75';
const WHITE = '#FFFFFF';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  row: {
    fontSize: 32,
    letterSpacing: 0.5,
    fontWeight: '800',
    // if you loaded this font already, uncomment:
    // fontFamily: 'Candal',
  },
  green: { color: GREEN /*, fontFamily: 'Candal'*/ },
  white: { color: WHITE /*, fontFamily: 'Candal'*/ },
});
