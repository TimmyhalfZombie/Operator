import React from "react";
import { SafeAreaView, View, Text, TextInput, TouchableOpacity, StyleSheet, StatusBar } from "react-native";

type Props = {
  onCreate: () => void;
  onGoToSignIn: () => void;
};

export default function SignupView({ onCreate, onGoToSignIn }: Props) {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={styles.header}>
        <Text style={styles.brandRow}>
          <Text style={styles.brandGreen}>patch</Text>
          <Text style={styles.brandWhite}> up.</Text>
        </Text>
        <Text style={styles.subTitle}>Create an Account</Text>
      </View>

      <View style={styles.form}>
        <Text style={styles.label}>Username</Text>
        <TextInput style={styles.input} placeholder="Username" placeholderTextColor="#6B7280" keyboardAppearance="dark" />

        <Text style={[styles.label, { marginTop: 16 }]}>Email</Text>
        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#6B7280"
          keyboardType="email-address"
          autoCapitalize="none"
          keyboardAppearance="dark"
        />

        <Text style={[styles.label, { marginTop: 16 }]}>Phone</Text>
        <TextInput style={styles.input} placeholder="Phone" placeholderTextColor="#6B7280" keyboardType="phone-pad" keyboardAppearance="dark" />

        <Text style={[styles.label, { marginTop: 16 }]}>New Password</Text>
        <TextInput style={styles.input} placeholder="New Password" placeholderTextColor="#6B7280" secureTextEntry keyboardAppearance="dark" />

        <TouchableOpacity style={styles.primaryBtn} onPress={onCreate} activeOpacity={0.85}>
          <Text style={styles.primaryText}>Create</Text>
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
    marginTop: 100, 
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
    borderWidth: 1, borderColor: "#1F2937", paddingHorizontal: 14, color: TEXT,
  },

  primaryBtn: {
    marginTop: 18, 
    backgroundColor: GREEN, 
    height: 48,
    borderRadius: 10, 
    alignItems: "center", 
    justifyContent: "center",
  },

  primaryText: { 
    color: "#0A0A0A", 
    fontSize: 16, 
    fontWeight: "700" 
},

  footerRow: { 
    marginTop: 14, 
    flexDirection: "row", 
    justifyContent: "center", 
    alignItems: "center" 
},

  footerDim: { 
    color: MUTED, 
    fontSize: 15 
},

  linkBright: { 
    color: GREEN, 
    fontSize: 15, 
    fontWeight: "600"
 },
});
