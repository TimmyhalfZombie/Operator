// app/_layout.tsx
import React, { useCallback } from 'react';
import { View } from 'react-native';
import { Tabs } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import CurvedTabBar from '../src/components/CurvedTabBar';

// Keep splash until we say so (call this ONLY here)
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  // ✅ Path is correct for your tree: app/_layout.tsx -> ../assets/fonts/...
  const [fontsLoaded] = useFonts({
    Candal: require('../assets/fonts/Candal-Regular.ttf'),
  });

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded) await SplashScreen.hideAsync();
  }, [fontsLoaded]);

  if (!fontsLoaded) return null; // keep native splash until ready

  return (
    <View style={{ flex: 1 }} onLayout={onLayoutRootView}>
      <Tabs tabBar={(props) => <CurvedTabBar {...props} />} screenOptions={{ headerShown: false }}>
        <Tabs.Screen name="home" options={{ title: 'Home' }} />
        <Tabs.Screen name="messages" options={{ title: 'Messages' }} />
        <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
      </Tabs>
    </View>
  );
}
  