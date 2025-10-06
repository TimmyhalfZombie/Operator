// app/_layout.tsx
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useCallback } from "react";


SplashScreen.preventAutoHideAsync().catch(() => {});


export default function RootLayout() {
  const [fontsLoaded] = useFonts({
  Candal: require("../assets/fonts/Candal-Regular.ttf"),
  Inter: require("../assets/fonts/Inter-VariableFont_opsz,wght.ttf"),
 });

 const onLayoutRootView = useCallback(async () => {
 if (fontsLoaded) await SplashScreen.hideAsync();
}, [fontsLoaded]);

 if (!fontsLoaded) return null; 

 return <Stack screenOptions={{ headerShown: false }} onLayout={onLayoutRootView} />;
}