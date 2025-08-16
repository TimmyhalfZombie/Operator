import React from 'react';
import { Tabs } from 'expo-router';
import { useFonts } from 'expo-font';
import { View } from 'react-native';
import CurvedTabBar from '../src/components/CurvedTabBar'; // ✅ path from app/ to src/components

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Candal: require('../assets/fonts/Candal-Regular.ttf'),
  });

  if (!fontsLoaded) return <View />;

  return (
    <Tabs tabBar={(props) => <CurvedTabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="home" options={{ title: 'Home' }} />
      <Tabs.Screen name="messages" options={{ title: 'Messages' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}
