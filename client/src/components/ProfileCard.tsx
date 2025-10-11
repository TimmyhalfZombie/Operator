import React from 'react';
import { Dimensions, StyleSheet, Text, View, TouchableOpacity, ScrollView } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import * as Icons from 'phosphor-react-native';
import type { ProfileData } from '../screens/functions/profile';

const colors = {
  bg: '#101010',
  header: '#44ff75',
  chipBg: '#c7f7da',
  chipText: '#0b0b0b',
  text: '#ffffff',
  sub: '#bdbdbd',
  logout: '#ff3b30', // red
};

const { width } = Dimensions.get('window');
const AVATAR = 84;
const TOP_SPACER = AVATAR / 2 + 74;

type Props = {
  profile: ProfileData;
  // renamed to reflect that this only opens the confirm modal
  onLogoutPress: () => void;
};

export default function ProfileCard({ profile, onLogoutPress }: Props) {
  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={styles.headerWrap}>
        <Svg width={width} height={160}>
          <Path d={`M0 0 H${width} V140 L${width / 2} 160 L0 140 Z`} fill={colors.header} />
        </Svg>
        <View style={styles.avatar}>
          <Icons.User size={32} color={colors.sub} />
        </View>
      </View>

      <View style={styles.topSpacer} />

      <InfoChip icon={<Icons.User size={18} color={colors.chipText} />} label="Name"  value={profile.username || '—'} />
      <InfoChip icon={<Icons.Phone size={18} color={colors.chipText} />} label="Phone" value={profile.phone || '—'} />
      <InfoChip icon={<Icons.EnvelopeSimple size={18} color={colors.chipText} />} label="Email" value={profile.email || '—'} />

      {/* Logout button styled like the screenshot */}
      <LogoutButton onPress={onLogoutPress} />
    </ScrollView>
  );
}

function InfoChip({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <View style={styles.chip}>
      <View style={styles.chipIcon}>{icon}</View>
      <View style={{ flex: 1 }}>
        <Text style={styles.chipLabel}>{label}</Text>
        <Text style={styles.chipValue}>{value}</Text>
      </View>
    </View>
  );
}

function LogoutButton({ onPress }: { onPress: () => void }) {
  // Some phosphor versions don’t include SignOut; fallback to ArrowRight.
  const SignOutIcon = (Icons as any).SignOut ?? Icons.ArrowRight;
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      style={logoutStyles.wrap}
      accessibilityRole="button"
      accessibilityLabel="Logout"
    >
      <View style={logoutStyles.iconPill}>
        <SignOutIcon size={18} color="#ffffff" weight="bold" />
      </View>
      <Text style={logoutStyles.label}>Logout</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  headerWrap: { position: 'relative' },
  avatar: {
    position: 'absolute',
    bottom: -AVATAR / 2,
    alignSelf: 'center',
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
    backgroundColor: '#2a2a2a',
    borderWidth: 4,
    borderColor: colors.header,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topSpacer: { height: TOP_SPACER },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.chipBg,
    marginHorizontal: 18,
    marginBottom: 14,
    borderRadius: 24,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  chipIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#e8ffee',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  chipLabel: { color: '#3d4b40', fontSize: 11, marginTop: 2 },
  chipValue: { color: colors.chipText, fontSize: 16, fontWeight: '900' }, // bolder
});

const logoutStyles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    marginTop: 185,          // avoid huge fixed spacing; lets content grow naturally
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 10,
  },
  iconPill: {
    backgroundColor: colors.logout,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '900',
  },
});
