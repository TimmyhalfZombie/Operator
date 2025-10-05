// app/(auth)/_layout.tsx
import { Stack } from "expo-router";

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        // try one of: 'fade', 'slide_from_right', 'slide_from_left', 'fade_from_bottom'
        animation: "slide_from_right",
        gestureEnabled: true,
        fullScreenGestureEnabled: true,
        contentStyle: { backgroundColor: "#0B0B0B" }, // match your dark bg to avoid flashes
      }}
    >
      {/* (optional) per-screen overrides */}
      <Stack.Screen name="login" options={{ animation: "fade" }} />
      <Stack.Screen name="signup" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="forgotpassword" options={{ animation: "slide_from_right" }} />
    </Stack>
  );
}
