import React, { useEffect, useState } from 'react';
import { Dimensions, ScrollView, StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import * as Icons from 'phosphor-react-native';
import { useRouter } from 'expo-router';
import { fetchProfile, doLogout, type ProfileData } from './functions/profile';

const colors = {
  bg: '#101010',
  header: '#44ff75',
  chipBg: '#c7f7da',
  chipText: '#0b0b0b',
  text: '#ffffff',
  sub: '#bdbdbd',
  border: '#222',
};

const { width } = Dimensions.get('window');

export default function ProfileScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<ProfileData>({ username: '', phone: '', email: '' });

  useEffect(() => {
    (async () => {
      try {
        const p = await fetchProfile();
        setProfile({
          username: p.username ?? '',
          phone: p.phone ?? '',
          email: p.email ?? '',
        });
      } catch (e) {
        console.log('profile load failed:', e);
      }
    })();
  }, []);

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      {/* header with V cut */}
      <View style={styles.headerWrap}>
        <Svg width={width} height={160}>
          <Path d={`M0 0 H${width} V140 L${width / 2} 160 L0 140 Z`} fill={colors.header} />
        </Svg>

        {/* avatar */}
        <View style={styles.avatar}>
          <Icons.User size={32} color={colors.sub} />
        </View>
      </View>

      {/* spacer to move all boxes down */}
      <View style={styles.topSpacer} />

      {/* info chips */}
      <View style={styles.chip}>
        <View style={styles.chipIcon}>
          <Icons.User size={18} color={colors.chipText} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.chipLabel}>Name</Text>
          <Text style={styles.chipValue}>{profile.username || '—'}</Text>
        </View>
      </View>

      <View style={styles.chip}>
        <View style={styles.chipIcon}>
          <Icons.Phone size={18} color={colors.chipText} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.chipLabel}>Phone</Text>
          <Text style={styles.chipValue}>{profile.phone || '—'}</Text>
        </View>
      </View>

      <View style={styles.chip}>
        <View style={styles.chipIcon}>
          <Icons.EnvelopeSimple size={18} color={colors.chipText} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.chipLabel}>Email</Text>
          <Text style={styles.chipValue}>{profile.email || '—'}</Text>
        </View>
      </View>

      {/* logout */}
      <TouchableOpacity activeOpacity={0.8} onPress={() => doLogout(router)}>
        <Text style={styles.logout}>LOG OUT</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const AVATAR = 84;
// ⬇️ Adjust this to move the chips further down or up
const TOP_SPACER = AVATAR / 2 + 74; // try 32/40/etc.

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
  chipValue: { color: colors.chipText, fontSize: 14, fontWeight: '700' },
  logout: {
    textAlign: 'center',
    color: colors.header,
    fontWeight: '900',
    marginTop: 200,
    textDecorationLine: 'underline',
  },
});
