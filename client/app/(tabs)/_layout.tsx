import { Tabs } from "expo-router";
import React from "react";
import CurvedTabBar from "../../src/components/CurvedTabBar";

export default function TabsLayout() {
  return (
    <Tabs tabBar={(p) => <CurvedTabBar {...p} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="home" options={{ title: "Home" }} />
      <Tabs.Screen name="activity" options={{ title: "Activity" }} />
      <Tabs.Screen name="messages" options={{ title: "Messages" }} />
      <Tabs.Screen name="profile" options={{ title: "Profile" }} />
    </Tabs>
  );
}


