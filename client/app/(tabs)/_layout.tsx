import { Tabs } from 'expo-router';
import React from 'react';
import CurvedTabBar from '../../src/components/CurvedTabBar';
import { SocketProvider } from '../../src/contexts/SocketProvider';

export default function TabsLayout() {
  return (
    <SocketProvider>
      <Tabs
        tabBar={(p) => <CurvedTabBar {...p} />}
        screenOptions={{ headerShown: false }}
      >
        <Tabs.Screen name="home" options={{ title: 'Home' }} />
        <Tabs.Screen name="activity" options={{ title: 'Activity' }} />
        <Tabs.Screen name="messages" options={{ title: 'Messages' }} />
        <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
      </Tabs>
    </SocketProvider>
  );
}
