// app/_layout.tsx
import { useFonts } from "expo-font";
import * as NavigationBar from "expo-navigation-bar";
import { Tabs } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import React, { useCallback, useEffect } from "react";
import { Platform } from "react-native";
import "react-native-reanimated";
import { SafeAreaProvider } from "react-native-safe-area-context";
import CurvedTabBar from "../src/components/CurvedTabBar";

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

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

  // Hide splash screen when fonts are loaded
  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded) {
      await SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null; // Keep showing the native splash screen
  }

  return (
    <SafeAreaProvider onLayout={onLayoutRootView}>
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
        <Tabs.Screen name="activity" options={{ title: "Activity" }} />
        <Tabs.Screen name="messages" options={{ title: "Messages" }} />
        <Tabs.Screen name="profile" options={{ title: "Profile" }} />
      </Tabs>
    </SafeAreaProvider>
  );
}
