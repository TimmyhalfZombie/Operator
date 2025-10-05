import { router } from "expo-router";
import Signup from "../../src/auth/Signup";

export default function SignupScreen() {
  return (
    <Signup
      onCreate={() => router.replace("/(tabs)/home")}               // enter app (no back)
      onGoToSignIn={() => router.back()}                            // or router.replace("/(auth)/login")
    />
  );
}