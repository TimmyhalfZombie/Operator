// app/_layout.tsx
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useState } from 'react';
import { tokens } from '../src/auth/tokenStore';
import { useImmersiveMode } from '../src/hooks/useImmersiveMode';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Candal: require('../assets/fonts/Candal-Regular.ttf'),
    'Inter-Black': require('../assets/fonts/static/Inter_18pt-Black.ttf'),
    'Inter-Medium': require('../assets/fonts/static/Inter_18pt-Medium.ttf'),
    'Inter-Regular': require('../assets/fonts/static/Inter_18pt-Regular.ttf'),
  });

  const [tokensReady, setTokensReady] = useState(false);
  
  // Enable immersive mode
  useImmersiveMode();

  // Load persisted tokens once on app start
  useEffect(() => {
    (async () => {
      try {
        await tokens.loadFromStorage();
      } finally {
        setTokensReady(true);
      }
    })();
  }, []);

  const ready = fontsLoaded && tokensReady;

  const onLayoutRootView = useCallback(async () => {
    if (ready) {
      await SplashScreen.hideAsync();
    }
  }, [ready]);

  if (!ready) return null;

  return (
    <>
      <StatusBar style="light" hidden={false} />
      <Stack screenOptions={{ headerShown: false }} onLayout={onLayoutRootView} />
    </>
  );
}
