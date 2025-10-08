import React, { useState } from 'react';
import { router } from 'expo-router';
import SignupView from '../../src/auth/views/Signup';
import { registerUser } from '../../src/auth/views/functions/auth';

export default function SignupScreen() {
  const [values, setValues] = useState({ username: '', email: '', phone: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function onCreate() {
    setError('');
    const { username, email, phone, password } = values;
    if (!username.trim() || !email.trim() || !phone.trim() || !password.trim()) {
      setError('Fill all fields');
      return;
    }
    setLoading(true);
    try {
      await registerUser({
        username: username.trim(),
        email: email.trim(),
        phone: phone.trim(),
        password,
      });
      router.replace('/(tabs)/home');
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
