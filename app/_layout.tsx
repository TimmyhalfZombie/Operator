// app/_layout.tsx
import { useFonts } from "expo-font";
import * as NavigationBar from "expo-navigation-bar";
import { Tabs } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useEffect } from "react";
import { ActivityIndicator, Platform, View } from "react-native";
import "react-native-reanimated";
import { SafeAreaProvider } from "react-native-safe-area-context";
import CurvedTabBar from "../src/components/CurvedTabBar";

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Candal: require("../assets/fonts/Candal-Regular.ttf"),
    Inter: require("../assets/fonts/Inter-VariableFont_opsz,wght.ttf"),
  });

  // Hide / style Android nav bar (guarded so it won't throw)
  useEffect(() => {
    if (Platform.OS === "android") {
      (async () => {
        try {
          await NavigationBar.setVisibilityAsync("hidden");      // hide buttons
          await NavigationBar.setBehaviorAsync("overlay-swipe"); // swipe to reveal;
        } catch (e) {
          console.log("[nav-bar] skipped:", e?.message ?? e);
        }
      })();
    }
  }, []);

  if (!fontsLoaded) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: "#000",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <StatusBar hidden />
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar hidden />
      <Tabs
        tabBar={(p) => <CurvedTabBar {...p} />}
        screenOptions={{ headerShown: false }}
        initialRouteName="home"
      >
        {/* Keep welcome routed but hidden from tabs */}
        <Tabs.Screen
          name="welcome"
          options={{ href: null, tabBarStyle: { display: "none" } }}
        />
        {/* Make sure these files exist:
            app/home.tsx, app/messages.tsx, app/profile.tsx */}
        <Tabs.Screen name="home" options={{ title: "Home" }} />
        <Tabs.Screen name="messages" options={{ title: "Messages" }} />
        <Tabs.Screen name="profile" options={{ title: "Profile" }} />
      </Tabs>
    </SafeAreaProvider>
  );
}
