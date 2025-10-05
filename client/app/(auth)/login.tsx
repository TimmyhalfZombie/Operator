import { router } from "expo-router";
import Login from "../../src/auth/Login"; // your UI-only component

export default function LoginScreen() {
  return (
    <Login
      onSignUp={() => router.push("/(auth)/signup")}               // animates to Signup
      onForgot={() => router.push("/(auth)/forgotpassword")}       // animates to Forgot
      onSignIn={() => router.replace("/(tabs)/home")}               // no back to auth
    />
  );
}
