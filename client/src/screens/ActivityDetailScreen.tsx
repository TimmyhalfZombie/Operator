import React from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import * as Icons from 'phosphor-react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { getAssistById } from '../features/assistance/api';

const BG = '#000000ff';
const CARD = '#141414';
const BORDER = '#2B2B2B';
const GREEN = '#6EFF87';
const GREEN_DIM = '#9EF29E';
const SUB = '#B9B9B9';
const WHITE = '#FFFFFF';
const RED = '#ff5f5f';
const BLUE = '#4ea7ff';

type Params = {
  id?: string;           // ← we’ll navigate with this
  startName?: string;
  startAddr?: string;
  endName?: string;
  endAddr?: string;
  customer?: string;
  timeRange?: string;
  status?: string;
  rating?: string;       // "0-5"
};

function fmtRange(a?: string, b?: string) {
  const dt = (s?: string) => (s ? new Date(s) : null);
  const toHM = (d: Date) =>
    d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const A = dt(a), B = dt(b);
  if (A && B) return `${toHM(A)} - ${toHM(B)}`;
  if (A) return toHM(A);
  return undefined;
}

export default function ActivityDetailScreen() {
  const p = useLocalSearchParams<Params>();
  const [loading, setLoading] = React.useState(!!p.id);
  const [err, setErr] = React.useState('');
  const [doc, setDoc] = React.useState<any | null>(null);

  React.useEffect(() => {
    let live = true;
    if (!p.id) return;
    (async () => {
      try {
        setLoading(true);
        const d = await getAssistById(p.id!);
        if (!live) return;
        setDoc(d);
      } catch (e: any) {
        if (live) setErr(e?.message ?? 'Failed to load');
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => { live = false; };
  }, [p.id]);

  // Prefer DB (doc), fall back to params, then sensible defaults
  const customer = doc?.clientName ?? p.customer ?? 'Customer';
  const startName = p.startName || doc?._raw?.origin?.name || 'Start';
  const startAddr = p.startAddr || doc?._raw?.origin?.address || '';
  const endName = p.endName || doc?.placeName || 'Destination';
  const endAddr = p.endAddr || doc?.address || '';
  const status = (doc?.status || p.status || 'Repaired') as string;
  const ratingNum = Number(
    doc?._raw?.rating ?? (doc?.rating as any) ?? p.rating ?? 0
  );
  const rating = Math.max(0, Math.min(5, Number.isFinite(ratingNum) ? ratingNum : 0));

  const timeRange =
    p.timeRange || fmtRange(doc?.createdAt, doc?.updatedAt) || '—';

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      {/* Top bar */}
      <View style={styles.topbar}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={{ padding: 8 }}>
          <Icons.ArrowLeft size={22} color="#0E0E0E" weight="bold" />
        </TouchableOpacity>
      </View>

      {loading && !doc ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: BG }}>
          <ActivityIndicator />
        </View>
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={{ paddingBottom: 24 }}>
          {err ? <Text style={{ color: '#ff9d9d', marginBottom: 8 }}>{err}</Text> : null}

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

          {/* Rating Card (read-only) */}
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
      )}
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
