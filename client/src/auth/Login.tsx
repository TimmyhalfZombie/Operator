import React, { useState } from "react";
import { Pressable, SafeAreaView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

type Props = {
  onSignIn: () => void;
  onSignUp: () => void;
  onForgot: () => void;
};

export default function LoginView({ onSignIn, onSignUp, onForgot }: Props) {
  const [remember, setRemember] = useState(true);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={styles.header}>
        <Text style={styles.brandRow}>
          <Text style={{ color: '#44ff75', fontWeight: 'normal', fontFamily: 'Candal' }}>patch</Text>
          <Text style={{ color: '#fff', fontWeight: 'normal', fontFamily: 'Candal' }}> up.</Text>
        </Text>
        <Text style={styles.subTitle}>Welcome Back!</Text>
      </View>

      <View style={styles.form}>
        <Text style={styles.label}>Email or Phone</Text>
        <TextInput
          style={styles.input}
          placeholder="Email or Phone"
          placeholderTextColor="#6B7280"
          keyboardAppearance="dark"
        />

        <Text style={[styles.label, { marginTop: 16 }]}>Password</Text>
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor="#6B7280"
          secureTextEntry
          keyboardAppearance="dark"
        />

        <View style={styles.rowBetween}>
          <Pressable style={styles.rememberWrap} onPress={() => setRemember(!remember)}>
            <View style={[styles.checkbox, remember && styles.checkboxChecked]}>
              {remember ? <Text style={styles.check}>✓</Text> : null}
            </View>
            <Text style={styles.rememberText}>Remember Password</Text>
          </Pressable>

          <TouchableOpacity onPress={onForgot} activeOpacity={0.7}>
            <Text style={styles.linkDim}>Forget Password?</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.primaryBtn} onPress={onSignIn} activeOpacity={0.85}>
          <Text style={styles.primaryText}>Sign in</Text>
        </TouchableOpacity>

        <View style={styles.footerRow}>
          <Text style={styles.footerDim}>Don&apos;t have an account? </Text>
          <TouchableOpacity onPress={onSignUp} activeOpacity={0.7}>
            <Text style={styles.linkBright}>Sign up</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const GREEN = "#44ff75";
const BG = "#0B0B0B";
const CARD = "#111214";
const TEXT = "#ffffffff";
const MUTED = "#9CA3AF";

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: BG, 
    paddingHorizontal: 20 
},

  header: {
     marginTop: 170, 
     alignItems: "center" 
    },

  brandRow: { 
    fontSize: 32, 
    fontWeight: "800",
     letterSpacing: 0.5 
    },

  brandGreen: { 
    color: GREEN 
},

  brandWhite: { 
    color: TEXT 
},

  subTitle: { 
    marginTop: 4, 
    color: TEXT, 
    fontSize: 15 
},

  form: { 
    marginTop: 28
 },

  label: { 
    color: TEXT, 
    fontSize: 15,
    marginBottom: 6 
},

  input: {
    height: 48, 
    borderRadius: 10, 
    backgroundColor: CARD,
    borderWidth: 1, 
    borderColor: "#1F2937", 
    paddingHorizontal: 14, 
    color: TEXT,
  },

  rowBetween: { 
    marginTop: 12, 
    flexDirection: "row", 
    alignItems: "center", 
    justifyContent: "space-between" 
},

  rememberWrap: { 
    flexDirection: "row",
     alignItems: "center"
     },

  checkbox: {
    width: 20, 
    height: 20, 
    borderRadius: 4, 
    borderWidth: 1.5, 
    borderColor: "#374151",
    marginRight: 8, 
    alignItems: "center", 
    justifyContent: "center", 
    backgroundColor: "transparent",
  },

  checkboxChecked: { 
    backgroundColor: GREEN, 
    borderColor: GREEN 
},

  check: { 
    color: BG, 
    fontSize: 14, 
    lineHeight: 14, 
    fontWeight: "800" 
},

  rememberText: { 
    color: MUTED,
    fontSize: 15,
 },

  linkDim: { 
    color: TEXT, 
    fontSize: 15,
    textDecorationLine: 'underline'
},

  linkBright: { 
    color: GREEN, 
    fontSize: 15, 
    fontWeight: "600" 
},

  primaryBtn: {
    marginTop: 16, 
    backgroundColor: GREEN, 
    height: 48,
    borderRadius: 10, 
    alignItems: "center", 
    justifyContent: "center",
  },

  primaryText: { 
    color: "#0A0A0A", 
    fontSize: 16, fontWeight: "700" 
},

  footerRow: {
     marginTop: 14, 
     flexDirection: "row", 
     justifyContent: "center"
    },

  footerDim: { 
    color: MUTED, 
    fontSize: 15 
},
});
