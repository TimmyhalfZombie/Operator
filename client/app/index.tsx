import { router } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

export default function Index() {
  useEffect(() => {
    // Add a small delay to ensure the navigation is ready
    const timer = setTimeout(() => {
      try {
        router.replace("/welcome");
      } catch (error) {
        console.log("Navigation error:", error);
      }
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  return null; // This screen should not render anything
}
