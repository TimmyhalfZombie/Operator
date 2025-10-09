import { router } from 'expo-router';
import React, { useState } from 'react';
import SignupView from '../../src/auth/views/Signup';
import { registerUser } from '../../src/auth/views/functions/auth';

export default function SignupScreen() {
  const [values, setValues] = useState({ username: '', email: '', phone: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function onCreate() {
    setError('');
    const { username, email, phone, password } = values;

    // Require only username, phone, and password. Email is optional.
    if (!username.trim() || !phone.trim() || !password.trim()) {
      setError('Please fill username, phone, and password.');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        username: username.trim(),
        phone: phone.trim(),
        password, // already validated in SignupView
        ...(email.trim() ? { email: email.trim() } : {}), // include only if provided
      };

      await registerUser(payload as {
        username: string;
        phone: string;
        password: string;
        email?: string;
      });

      // after first create-account, show the loading screen
      router.replace('/(auth)/patching-up');
    } catch (e: any) {
      setError(e?.message || 'Sign up failed');
      console.log('signup error:', e);
    } finally {
      setLoading(false);
    }
  }

  return (
    <SignupView
      values={values}
      onChange={(k, v) => setValues((s) => ({ ...s, [k]: v }))}
      onCreate={onCreate}
      onGoToSignIn={() => router.replace('/(auth)/login')}
      error={error}
      loading={loading}
    />
  );
}
