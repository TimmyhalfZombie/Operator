import React from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import * as Icons from 'phosphor-react-native';
import { router, useLocalSearchParams } from 'expo-router';

const BG = '#000000ff';
const CARD = '#141414';
const BORDER = '#2B2B2B';
const GREEN = '#6EFF87';
const GREEN_DIM = '#9EF29E';
const SUB = '#B9B9B9';
const WHITE = '#FFFFFF';
const RED = '#ff5f5f';
const BLUE = '#4ea7ff';

export default function ActivityDetailScreen() {
  // Optional: accept params if you later pass real data
  const params = useLocalSearchParams<{
    startName?: string;
    startAddr?: string;
    endName?: string;
    endAddr?: string;
    customer?: string;
    timeRange?: string;
    status?: string;
    rating?: string; // "0-5"
  }>();

  const startName = params.startName || 'Balabago, Pavia';
  const startAddr = params.startAddr || 'QG6Q+G26, Pavia, Iloilo City, 5001 Iloilo';
  const endName = params.endName || 'Iloilo Merchant Marine School';
  const endAddr = params.endAddr || 'QGVM+MQ9, R-3 Rd., Cabugao Sur, Pavia, Iloilo City, 5001 Iloilo';
  const customer = params.customer || 'Leo John Molina';
  const timeRange = params.timeRange || '10:15 - 10:25 AM';
  const status = params.status || 'Repaired';
  const rating = Math.max(0, Math.min(5, Number(params.rating ?? 4)));

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      {/* Top bar */}
      <View style={styles.topbar}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={{ padding: 8 }}>
          <Icons.ArrowLeft size={22} color="#0E0E0E" weight="bold" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={{ paddingBottom: 24 }}>

        <Text style={styles.timeText}>{timeRange}</Text>
        <Text style={styles.statusText}>{status}</Text>

        {/* Customer Card */}
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.avatar} />
            <View style={{ flex: 1 }}>
              <Text style={styles.customerName}>{customer}</Text>
            </View>
            <TouchableOpacity hitSlop={10} style={styles.iconBtn}>
              <Icons.EnvelopeSimple size={18} color={GREEN_DIM} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Route Card */}
        <View style={styles.card}>
          <View style={styles.routeRow}>
            <View style={styles.bulletBlue} />
            <View style={styles.routeRight}>
              <Text style={styles.placeName}>{startName}</Text>
              <Text style={styles.addr}>{startAddr}</Text>
            </View>
          </View>

          <View style={styles.routeLine} />

          <View style={[styles.routeRow, { marginTop: 6 }]}>
            <View style={styles.bulletRed} />
            <View style={styles.routeRight}>
              <Text style={styles.placeName}>{endName}</Text>
              <Text style={styles.addr}>{endAddr}</Text>
            </View>
          </View>
        </View>

        {/* Rating Card (read-only for now) */}
        <View style={styles.card}>
          <Text style={styles.ratingTitle}>Customer rating</Text>
          <View style={styles.starsRow}>
            {Array.from({ length: 5 }).map((_, i) => {
              const filled = i < rating;
              return (
                <Icons.Star
                  key={i}
                  size={22}
                  weight={filled ? 'fill' : 'regular'}
                  color={filled ? GREEN : '#6b6b6b'}
                  style={{ marginHorizontal: 4 }}
                />
              );
            })}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  topbar: {
    height: 48,
    backgroundColor: GREEN,
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingHorizontal: 10,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
  },
  scroll: { paddingHorizontal: 14, paddingTop: 12 },
  timeText: { color: WHITE, opacity: 0.85, fontSize: 13, marginBottom: 2 },
  statusText: { color: GREEN, fontSize: 13, marginBottom: 12 },

  card: {
    backgroundColor: CARD,
    borderColor: BORDER,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginVertical: 8,
  },

  row: { flexDirection: 'row', alignItems: 'center' },
  avatar: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: '#d9d9d9', marginRight: 12,
  },
  customerName: { color: WHITE, fontWeight: '700' },
  iconBtn: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: BORDER,
  },

  routeRow: { flexDirection: 'row', alignItems: 'flex-start' },
  routeRight: { flex: 1, marginLeft: 10 },
  bulletBlue: { width: 10, height: 10, borderRadius: 6, backgroundColor: BLUE, marginTop: 3 },
  bulletRed: { width: 10, height: 10, borderRadius: 6, backgroundColor: RED, marginTop: 3 },
  routeLine: {
    height: 22, width: 2, backgroundColor: BORDER,
    marginLeft: 4, marginVertical: 2,
  },
  placeName: { color: WHITE, fontWeight: '800' },
  addr: { color: SUB, fontSize: 12, marginTop: 2 },

  ratingTitle: { color: WHITE, opacity: 0.9, marginBottom: 10, textAlign: 'center' },
  starsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
});
