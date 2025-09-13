// app/_layout.tsx
import React from "react";
import { View, ActivityIndicator } from "react-native";
import { Tabs } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useFonts } from "expo-font";
import "react-native-reanimated";
import CurvedTabBar from "../src/components/CurvedTabBar";

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Candal: require("../assets/fonts/Candal-Regular.ttf"),
    Inter: require("../assets/fonts/Inter-VariableFont_opsz,wght.ttf"),
  });

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, backgroundColor: "#000", alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
<Tabs tabBar={(p) => <CurvedTabBar {...p} />} screenOptions={{ headerShown: false }}>
  <Tabs.Screen name="welcome" options={{ href: null, tabBarStyle: { display: "none" } }} />
  <Tabs.Screen name="home" options={{ title: "Home" }} />
  <Tabs.Screen name="messages" options={{ title: "Messages" }} />
  <Tabs.Screen name="profile" options={{ title: "Profile" }} />
</Tabs>
    </SafeAreaProvider>
  );
}
