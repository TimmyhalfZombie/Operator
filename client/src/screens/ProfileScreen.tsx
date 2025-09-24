import React from 'react';
import { Dimensions, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import * as Icons from 'phosphor-react-native';

const colors = {
  bg: '#101010',
  header: '#44ff75',
  chipBg: '#c7f7da', // soft mint
  chipText: '#0b0b0b',
  text: '#ffffff',
  sub: '#bdbdbd',
  border: '#222',
};

const { width } = Dimensions.get('window');

export default function ProfileScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      {/* header with V cut */}
      <View style={styles.headerWrap}>
        <Svg width={width} height={160}>
          {/* simple V dip */}
          <Path
            d={`M0 0 H${width} V140 L${width / 2} 160 L0 140 Z`}
            fill={colors.header}
          />
        </Svg>

        {/* back icon (no action; pure UI) */}
        <View style={styles.backBtn}>
          <Icons.CaretLeft size={20} color="#0b0b0b" />
        </View>

        {/* avatar */}
        <View style={styles.avatar}>
          <Icons.User size={32} color={colors.sub} />
        </View>
      </View>

      {/* title */}
      <Text style={styles.sectionTitle}>
        <Text style={{ color: colors.header }}>Operator</Text> <Text style={{ color: colors.text }}>Detail</Text>
      </Text>

      {/* info chips */}
      <View style={styles.chip}>
        <View style={styles.chipIcon}>
          <Icons.User size={18} color={colors.chipText} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.chipLabel}>Name</Text>
          <Text style={styles.chipValue}>Lorem Ipsum</Text>
        </View>
      </View>

      <View style={styles.chip}>
        <View style={styles.chipIcon}>
          <Icons.Phone size={18} color={colors.chipText} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.chipLabel}>Phone</Text>
          <Text style={styles.chipValue}>09123456789</Text>
        </View>
      </View>

      <View style={styles.chip}>
        <View style={styles.chipIcon}>
          <Icons.EnvelopeSimple size={18} color={colors.chipText} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.chipLabel}>Email</Text>
          <Text style={styles.chipValue}>lorem.epsom@gmail.com</Text>
        </View>
      </View>

      <Text style={styles.logout}>LOG OUT</Text>
    </ScrollView>
  );
}

const AVATAR = 84;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  headerWrap: { position: 'relative' },
  backBtn: {
    position: 'absolute',
    top: 14,
    left: 14,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#d0ffd6',
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  sectionTitle: {
    marginTop: AVATAR / 2 + 24,
    marginBottom: 16,
    fontSize: 18,
    fontWeight: '900',
    paddingHorizontal: 18,
  },
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
  chipLabel: { color: '#3d4b40', fontSize: 11, marginBottom: 2 },
  chipValue: { color: colors.chipText, fontSize: 14, fontWeight: '700' },
  logout: {
    textAlign: 'center',
    color: colors.header,
    fontWeight: '900',
    marginTop: 18,
    textDecorationLine: 'underline',
  },
});
