import { router } from "expo-router";
import ForgotPassword from "../../src/auth/Forgotpassword"; // or ../auth/ForgotPassword

export default function ForgotPasswordScreen() {
  return (
    <ForgotPassword
      onBack={() => router.back()}                                   // animates back
      onSend={() => { /* UI-only for now */ }}
    />
  );
}
