import React, { useState } from 'react';
import { SafeAreaView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View, ActivityIndicator, Pressable } from 'react-native';
import * as Icons from 'phosphor-react-native';

type Values = { username: string; email: string; phone: string; password: string };
type Props = {
  values: Values;
  onChange: (field: keyof Values, value: string) => void;
  onCreate: () => void;
  onGoToSignIn: () => void;
  error?: string;
  loading?: boolean;
};

export default function SignupView({ values, onChange, onCreate, onGoToSignIn, error, loading }: Props) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={styles.header}>
        <Text style={styles.brandRow}>
          <Text style={{ color: '#44ff75', fontWeight: 'normal', fontFamily: 'Candal' }}>patch</Text>
          <Text style={{ color: '#fff', fontWeight: 'normal', fontFamily: 'Candal' }}> up</Text>
        </Text>
        <Text style={styles.subTitle}>Create an Account</Text>
      </View>

      <View style={styles.form}>
        {!!error && <Text style={styles.errorText}>{error}</Text>}

        <Text style={styles.label}>Username</Text>
        <TextInput
          style={styles.input}
          placeholder="Username"
          placeholderTextColor="#6B7280"
          keyboardAppearance="dark"
          value={values.username}
          onChangeText={(t) => onChange('username', t)}
        />

        <Text style={[styles.label, { marginTop: 16 }]}>Email</Text>
        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#6B7280"
          keyboardType="email-address"
          autoCapitalize="none"
          keyboardAppearance="dark"
          value={values.email}
          onChangeText={(t) => onChange('email', t)}
        />

        <Text style={[styles.label, { marginTop: 16 }]}>Phone</Text>
        <TextInput
          style={styles.input}
          placeholder="Phone"
          placeholderTextColor="#6B7280"
          keyboardType="phone-pad"
          keyboardAppearance="dark"
          value={values.phone}
          onChangeText={(t) => onChange('phone', t)}
        />

        <Text style={[styles.label, { marginTop: 16 }]}>New Password</Text>
        <View style={styles.inputWrap}>
          <TextInput
            style={[styles.input, { paddingRight: 44 }]} // space for the eye
            placeholder="New Password"
            placeholderTextColor="#6B7280"
            secureTextEntry={!showPassword}
            keyboardAppearance="dark"
            value={values.password}
            onChangeText={(t) => onChange('password', t)}
          />
          <Pressable
            style={styles.eyeBtn}
            onPress={() => setShowPassword((s) => !s)}
            accessibilityRole="button"
            accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
            hitSlop={12}
          >
            {showPassword ? <Icons.Eye size={20} color={MUTED} /> : <Icons.EyeSlash size={20} color={MUTED} />}
          </Pressable>
        </View>

        <TouchableOpacity style={styles.primaryBtn} onPress={onCreate} activeOpacity={0.85} disabled={loading}>
          {loading ? <ActivityIndicator /> : <Text style={styles.primaryText}>Create</Text>}
        </TouchableOpacity>

        <View style={styles.footerRow}>
          <Text style={styles.footerDim}>Already have an account? </Text>
          <TouchableOpacity activeOpacity={0.7} onPress={onGoToSignIn}>
            <Text style={styles.linkBright}>Log in</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const GREEN = '#44ff75';
const BG = '#0B0B0B';
const CARD = '#111214';
const TEXT = '#ffffffff';
const MUTED = '#9CA3AF';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG, paddingHorizontal: 20 },
  header: { marginTop: 100, alignItems: 'center' },
  brandRow: { fontSize: 32, fontWeight: '800', letterSpacing: 0.5 },
  brandGreen: { color: GREEN },
  brandWhite: { color: TEXT },
  subTitle: { marginTop: 4, color: TEXT, fontSize: 15 },
  form: { marginTop: 28 },
  errorText: { color: '#ff4d4f', marginBottom: 10, fontSize: 14, fontWeight: '600' },
  label: { color: TEXT, fontSize: 15, marginBottom: 6 },

  inputWrap: { position: 'relative' },
  input: {
    height: 48,
    borderRadius: 10,
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: '#1F2937',
    paddingHorizontal: 14,
    color: TEXT,
  },
  eyeBtn: {
    position: 'absolute',
    right: 12,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },

  primaryBtn: { marginTop: 18, backgroundColor: GREEN, height: 48, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: '#0A0A0A', fontSize: 16, fontWeight: '700' },
  footerRow: { marginTop: 14, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  footerDim: { color: MUTED, fontSize: 15 },
  linkBright: { color: GREEN, fontSize: 15, fontWeight: '600' },
});
