// app/_layout.tsx
import React, { useCallback, useEffect, useState } from 'react';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { tokens } from '../src/auth/tokenStore';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Candal: require('../assets/fonts/Candal-Regular.ttf'),
    Inter: require('../assets/fonts/Inter-VariableFont_opsz,wght.ttf'),
  });

  const [tokensReady, setTokensReady] = useState(false);

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

  return <Stack screenOptions={{ headerShown: false }} onLayout={onLayoutRootView} />;
}
