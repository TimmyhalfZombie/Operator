import { router, useLocalSearchParams } from 'expo-router';
import * as Icons from 'phosphor-react-native';
import React from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getAssistById } from '../features/assistance/api';

// Inter font families (ensure these are loaded in your app)
const INTER_BLACK = 'Inter-Black';
const INTER_MEDIUM = 'Inter-Medium';
const INTER_REGULAR = 'Inter-Regular';

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

  // Only calculate data when doc exists to prevent fallback flash
  let customer: string = 'Customer', contactName: string | null = null, customerPhone: string | null = null, startName: string = 'Start', startAddr: string = '', endName: string = 'Vehicle', endAddr: string = 'Location', status: string = 'Repaired', timeRepaired: string | null = null, rating: number = 0, timeRange: string = '—';
  
  if (doc) {
    // Prefer DB (doc), fall back to params, then sensible defaults
    customer = doc?.clientName ?? doc?.customerName ?? p.customer ?? 'Customer';
    contactName = doc?.contactName || null;
    customerPhone = doc?.customerPhone || null;
    
    // Use operator information based on request status
    startName = 'Start';
    startAddr = '';
    
    if (doc?.operator) {
      const operatorName = doc.operator.name || 'Operator';
      const operatorLocation = doc.operator.location || 'Location unknown';
      const operatorLastSeen = doc.operator.lastSeen ? new Date(doc.operator.lastSeen).toLocaleString() : 'Unknown time';
      const operatorAcceptedAt = doc.operator.acceptedAt ? new Date(doc.operator.acceptedAt).toLocaleString() : null;
      
      if (doc.status === 'completed') {
        // For completed requests, show the operator who completed it
        startName = `${operatorName} - ${operatorLocation}`;
        startAddr = `Completed at: ${operatorLastSeen}`;
      } else if (doc.status === 'accepted') {
        // For accepted requests, show the operator location and acceptance time
        startName = `${operatorName} - ${operatorLocation}`;
        startAddr = operatorAcceptedAt ? `Accepted at: ${operatorAcceptedAt}` : `Last seen: ${operatorLastSeen}`;
      } else {
        // For other statuses, show the assigned operator
        startName = `${operatorName} - ${operatorLocation}`;
        startAddr = `Last seen: ${operatorLastSeen}`;
      }
    } else {
      // For pending requests or when no operator is assigned
      startName = 'Start';
      startAddr = 'Waiting for operator assignment';
    }
    // Update destination to show vehicle model and client location
    const vehicleModel = doc?.vehicle?.model || 'Vehicle';
    const clientLocation = doc?.location?.address || doc?.address || 'Location';
    endName = `${vehicleModel}`;
    endAddr = `${clientLocation}`;
    
    status = (doc?.status || p.status || 'Repaired') as string;
    
    // Get time repaired for completed requests
    timeRepaired = doc?.completedAt ? new Date(doc.completedAt).toLocaleString() : null;
    const ratingNum = Number(
      doc?._raw?.rating ?? (doc?.rating as any) ?? p.rating ?? 0
    );
    rating = Math.max(0, Math.min(5, Number.isFinite(ratingNum) ? ratingNum : 0));

    timeRange = p.timeRange || fmtRange(doc?.createdAt, doc?.updatedAt) || '—';
  }

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
      ) : doc ? (
        <ScrollView style={styles.scroll} contentContainerStyle={{ paddingBottom: 24 }}>
          {err ? <Text style={{ color: '#ff9d9d', marginBottom: 8 }}>{err}</Text> : null}

          <Text style={styles.timeText}>{timeRange}</Text>
          {timeRepaired && (
            <Text style={styles.timeRepairedText}>Repaired at: {timeRepaired}</Text>
          )}
          <Text style={styles.statusText}>{status}</Text>

          {/* Customer Card */}
          <View style={styles.card}>
            <View style={styles.row}>
              <View style={styles.avatar} />
              <View style={{ flex: 1 }}>
                <Text style={styles.customerName}>{customer}</Text>
                {contactName && (
                  <Text style={styles.customerContact}>Contact: {contactName}</Text>
                )}
                {customerPhone && (
                  <Text style={styles.customerPhone}>Phone: {customerPhone}</Text>
                )}
              </View>
              <TouchableOpacity hitSlop={10} style={styles.iconBtn}>
                <Icons.EnvelopeSimple size={22} color={GREEN_DIM} weight="bold" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Route Card */}
          <View style={styles.routeCard}>
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
      ) : (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: BG }}>
          <Text style={{ color: '#ff9d9d' }}>No data available</Text>
        </View>
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
  timeText: { 
    color: WHITE, 
    opacity: 0.85, 
    fontSize: 13, 
    marginBottom: 2,
    fontFamily: INTER_BLACK,
  },
  statusText: { 
    color: GREEN, 
    fontSize: 18, 
    marginBottom: 12,
    fontFamily: INTER_BLACK,
  },
  timeRepairedText: {
    color: '#B0B0B0',
    fontSize: 14,
    marginBottom: 8,
    fontFamily: INTER_MEDIUM,
  },

  card: {
    backgroundColor: CARD,
    borderColor: BORDER,
    borderWidth: 1,
    borderRadius: 12,
    padding: 18,
    marginVertical: 10,
    minHeight: 80,
  },

  routeCard: {
    backgroundColor: CARD,
    borderColor: BORDER,
    borderWidth: 1,
    borderRadius: 12,
    padding: 18,
    marginVertical: 10,
    minHeight: 450,
  },

  row: { flexDirection: 'row', alignItems: 'center' },
  avatar: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: '#d9d9d9', marginRight: 12,
  },
  customerName: { 
    color: WHITE, 
    fontWeight: '700',
    fontFamily: INTER_BLACK,
    fontSize: 16,
    marginBottom: 4,
  },
  customerContact: {
    color: '#B0B0B0',
    fontSize: 14,
    fontFamily: INTER_MEDIUM,
    marginBottom: 2,
  },
  customerPhone: {
    color: '#B0B0B0',
    fontSize: 14,
    fontFamily: INTER_MEDIUM,
  },
  iconBtn: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: BORDER,
  },

  routeRow: { 
    flexDirection: 'row', 
    alignItems: 'flex-start',
    paddingVertical: 12,
    minHeight: 60,
  },
  routeRight: { 
    flex: 1, 
    marginLeft: 16,
    justifyContent: 'center',
    paddingVertical: 4,
  },
  bulletBlue: { 
    width: 14, 
    height: 14, 
    borderRadius: 7, 
    backgroundColor: BLUE, 
    marginTop: 8,
    marginRight: 6,
  },
  bulletRed: { 
    width: 14, 
    height: 14, 
    borderRadius: 7, 
    backgroundColor: RED, 
    marginTop: 8,
    marginRight: 6,
  },
  routeLine: {
    height: 240, 
    width: 3, 
    backgroundColor: BORDER,
    marginLeft: 6, 
    marginVertical: 6,
  },
  placeName: { 
    color: WHITE, 
    fontWeight: '800',
    fontFamily: INTER_BLACK,
    fontSize: 18,
    marginBottom: 6,
  },
  addr: { 
    color: SUB, 
    fontSize: 14, 
    marginTop: 4,
    fontFamily: INTER_MEDIUM,
    lineHeight: 20,
  },

  ratingTitle: { 
    color: WHITE, 
    opacity: 0.9, 
    marginBottom: 10, 
    textAlign: 'center',
    fontFamily: INTER_MEDIUM,
  },
  starsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
});
