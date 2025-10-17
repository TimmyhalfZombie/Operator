// client/src/screens/ActivityDetailScreen.tsx
import { router, useLocalSearchParams } from 'expo-router';
import * as Icons from 'phosphor-react-native';
import React from 'react';
import { ActivityIndicator, AppState, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getAssistByAnyId } from '../features/assistance/api';
import { ensureConversation } from '../features/messages/api';
import { getCompletedByAnyId } from '../lib/completedCache';

const INTER_BLACK = 'Inter-Black';
const INTER_MEDIUM = 'Inter-Medium';

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
  id?: string | string[];
  activityId?: string | string[];
  startName?: string;
  startAddr?: string;
  endName?: string;
  endAddr?: string;
  customer?: string;
  timeRange?: string;
  status?: string;
  rating?: string;
};

function fmtRange(a?: string, b?: string) {
  const dt = (s?: string) => (s ? new Date(s) : null);
  const toHM = (d: Date) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const A = dt(a), B = dt(b);
  if (A && B) return `${toHM(A)} - ${toHM(B)}`;
  if (A) return toHM(A);
  return undefined;
}

const first = (v?: string | string[]) => (Array.isArray(v) ? v[0] : v);

export default function ActivityDetailScreen() {
  const p = useLocalSearchParams<Params>();

  const assistId = first(p.id);
  const actId = first(p.activityId);
  const requestId = assistId ?? actId;

  const [loading, setLoading] = React.useState(!!requestId);
  const [err, setErr] = React.useState('');
  const [doc, setDoc] = React.useState<any | null>(null);
  const [msgBusy, setMsgBusy] = React.useState(false);

  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const runningRef = React.useRef(false);

  const loadData = React.useCallback(async (silent = false) => {
    if (!requestId) {
      setErr('No request ID provided');
      setLoading(false);
      return;
    }

    if (runningRef.current) return; // skip overlapping runs
    runningRef.current = true;

    try {
      if (!silent) {
        setLoading(true);
        setErr('');
      }
      const id = String(requestId);

      // 1) Try cache first for instant UI (only on first load)
      if (!silent) {
        try {
          const cached = await getCompletedByAnyId(id);
          if (cached) {
            setDoc({
              ...cached,
              clientName: cached.clientName ?? cached.customerName ?? 'Customer',
              vehicle: cached.vehicle ?? (cached.vehicleType ? { model: cached.vehicleType, plate: cached.plateNumber } : undefined),
              address: cached.address ?? cached.location?.address,
            });
          }
        } catch {}
      }

      // 2) Then try server (refresh)
      let fresh: any | null = null;
      try {
        fresh = await getAssistByAnyId(id);
      } catch {
        fresh = null;
      }

      if (fresh) {
        setDoc(fresh);             // overwrite cache version with authoritative server doc
        setErr('');
      } else if (!doc && !silent) {
        // only show error if we also missed the cache
        if (!await getCompletedByAnyId(id)) {
          setErr('No data returned for this item.');
        }
      }
    } catch (e: any) {
      if (!silent) setErr(`Error: ${e?.message ?? 'Failed to load'}`);
    } finally {
      if (!silent) setLoading(false);
      runningRef.current = false;
    }
  }, [requestId, doc]);

  // Auto-refresh polling
  const schedule = React.useCallback((ms: number) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async function tick() {
      if (runningRef.current) return schedule(ms); // skip overlapping runs
      try {
        await loadData(true); // silent refresh
      } finally {
        timerRef.current = setTimeout(tick, ms);
      }
    }, ms);
  }, [loadData]);

  React.useEffect(() => {
    // Initial load
    loadData(false);
    
    // Start polling every 0.5 seconds
    schedule(500);

    const sub = AppState.addEventListener('change', (s) => {
      const active = s === 'active';
      // refresh immediately when user returns
      if (active) {
        loadData(true);
        schedule(500);
      } else {
        schedule(1_000); // 1 second polling in background
      }
    });

    return () => {
      sub.remove();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [loadData, schedule]);

  // ---- render prep
  let customer: string = 'Customer', contactName: string | null = null, customerPhone: string | null = null, startName: string = 'Start', startAddr: string = '', endName: string = 'Vehicle', endAddr: string = 'Location', status: string = 'Repaired', timeRepaired: string | null = null, rating: number = 0, timeRange: string = '—';
  
  if (doc) {
    customer = doc?.clientName ?? (p as any).customer ?? 'Customer';
    contactName = doc?.contactName || null;
    customerPhone = doc?.customerPhone || doc?.phone || null;

    // Operator info → start
    startName = 'Start';
    startAddr = '';

    // Always try to get operator location from database
    const operatorLocation = doc?.operator?.initial_address || 
                            doc?.operator?.location || 
                            doc?._raw?.operator?.initial_address ||
                            doc?._raw?.operator?.location ||
                            'Location unknown';
    const requestReceivedTime = doc?.createdAt ? new Date(doc.createdAt).toLocaleString() : 'Unknown time';
    
    // Debug logs removed to avoid spamming the console during auto-refresh

    if (doc?.operator) {
      const operatorName = doc.operator.name || 'Operator';
      const operatorLastSeen = doc.operator.lastSeen ? new Date(doc.operator.lastSeen).toLocaleString() : 'Unknown time';
      const operatorAcceptedAt = doc.operator.acceptedAt ? new Date(doc.operator.acceptedAt).toLocaleString() : null;

      if (doc.status === 'completed') {
        startName = `${operatorName} - ${operatorLocation}`;
        startAddr = `Completed at: ${operatorLastSeen}`;
      } else if (doc.status === 'accepted') {
        startName = `${operatorName} - ${operatorLocation}`;
        startAddr = operatorAcceptedAt ? `Accepted at: ${operatorAcceptedAt}` : `Last seen: ${operatorLastSeen}`;
      } else {
        startName = `${operatorName} - ${operatorLocation}`;
        startAddr = `Last seen: ${operatorLastSeen}`;
      }
    } else {
      // Show operator location from database
      // Format the operator location display
      if (operatorLocation && operatorLocation !== 'Location unknown') {
        startName = operatorLocation;
      } else {
        startName = 'Location Unknown';
      }
      startAddr = requestReceivedTime;
    }

    const vehicleModel = doc?.vehicle?.model || doc?.vehicleType || 'Vehicle';
    const clientLocation = doc?.location?.address || doc?.address || 'Location';
    endName = `${vehicleModel}`;
    endAddr = `${clientLocation}`;

    status = (doc?.status || (p as any).status || 'Repaired') as string;
    timeRepaired = doc?.completedAt ? new Date(doc.completedAt).toLocaleString() : null;

    const ratingNum = Number(doc?._raw?.rating ?? (doc?.rating as any) ?? (p as any).rating ?? 0);
    rating = Math.max(0, Math.min(5, Number.isFinite(ratingNum) ? ratingNum : 0));

    timeRange = (p as any).timeRange || fmtRange(doc?.createdAt, doc?.updatedAt) || '—';
  }

  async function handleMessagePress() {
    try {
      if (!doc) return;
      setMsgBusy(true);
      // Try to derive the peer (customer) user id from common fields
      const peerUserId =
        doc?.customerId ||
        doc?.clientId ||
        doc?.userId ||
        doc?.user?._id ||
        doc?.client?._id ||
        doc?.customer?._id ||
        null;
      // If peer id is missing, navigate to ChatScreen and let it ensure using requestId
      if (!peerUserId) {
        router.push({ pathname: '/chat/[id]', params: { id: 'new', requestId: String(requestId) } });
        return;
      }
      const ensured = await ensureConversation(String(peerUserId), requestId ? String(requestId) : undefined).catch(() => null);
      if (ensured?.id) {
        router.push({ pathname: '/chat/[id]', params: { id: ensured.id } });
      } else {
        // Fallback: navigate and let ChatScreen ensure
        router.push({ pathname: '/chat/[id]', params: { id: 'new', requestId: String(requestId), peer: String(peerUserId) } });
      }
    } catch (e) {
      console.log('handleMessagePress error:', e);
    } finally {
      setMsgBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.topbar}>
        <TouchableOpacity onPress={() => router.push('/activity')} hitSlop={12} style={{ padding: 8 }}>
          <Icons.ArrowLeft size={22} color="#0E0E0E" weight="bold" />
        </TouchableOpacity>
      </View>

      {loading && !doc ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: BG }}>
          <ActivityIndicator />
        </View>
      ) : doc ? (
        <ScrollView style={styles.scroll} contentContainerStyle={{ paddingBottom: 24 }}>
          {err ? <Text style={{ color: '#ff9d9d', marginBottom: 8, fontFamily: INTER_MEDIUM }}>{err}</Text> : null}

          <Text style={styles.timeText}>{timeRange}</Text>
          {timeRepaired && <Text style={styles.timeRepairedText}>Repaired at: {timeRepaired}</Text>}
          <Text style={styles.statusText}>{status}</Text>

          {/* Customer Card */}
          <View style={styles.card}>
            <View style={styles.row}>
              <View style={styles.avatar} />
              <View style={{ flex: 1 }}>
                <Text style={styles.customerName}>{customer}</Text>
                {contactName && <Text style={styles.customerContact}>Contact: {contactName}</Text>}
                {customerPhone && <Text style={styles.customerPhone}>Phone: {customerPhone}</Text>}
              </View>
              <TouchableOpacity hitSlop={10} style={styles.iconBtn} onPress={handleMessagePress} disabled={msgBusy}>
                <Icons.EnvelopeSimple size={22} color={msgBusy ? '#7fd190' : GREEN_DIM} weight="bold" />
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

          {/* Rating Card */}
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
          <Text style={{ color: '#ff9d9d', fontFamily: INTER_MEDIUM }}>{err || 'No data available'}</Text>
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
  timeText: { color: WHITE, opacity: 0.85, fontSize: 13, marginBottom: 2, fontFamily: INTER_BLACK },
  statusText: { color: GREEN, fontSize: 18, marginBottom: 12, fontFamily: INTER_BLACK },
  timeRepairedText: { color: '#B0B0B0', fontSize: 14, marginBottom: 8, fontFamily: INTER_MEDIUM },
  card: { backgroundColor: CARD, borderColor: BORDER, borderWidth: 1, borderRadius: 12, padding: 18, marginVertical: 10, minHeight: 80 },
  routeCard: { backgroundColor: CARD, borderColor: BORDER, borderWidth: 1, borderRadius: 12, padding: 18, marginVertical: 10, minHeight: 450 },
  row: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#d9d9d9', marginRight: 12 },
  customerName: { color: WHITE, fontFamily: INTER_BLACK, fontSize: 20, marginBottom: 4 },
  customerContact: { color: '#B0B0B0', fontSize: 14, fontFamily: INTER_MEDIUM, marginBottom: 2 },
  customerPhone: { color: '#B0B0B0', fontSize: 14, fontFamily: INTER_MEDIUM },
  iconBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: BORDER },
  routeRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 12, minHeight: 60 },
  routeRight: { flex: 1, marginLeft: 16, justifyContent: 'center', paddingVertical: 4 },
  bulletBlue: { width: 14, height: 14, borderRadius: 7, backgroundColor: BLUE, marginTop: 8, marginRight: 6 },
  bulletRed: { width: 14, height: 14, borderRadius: 7, backgroundColor: RED, marginTop: 8, marginRight: 6 },
  routeLine: { height: 240, width: 3, backgroundColor: BORDER, marginLeft: 6, marginVertical: 6 },
  placeName: { color: WHITE, fontWeight: '800', fontFamily: INTER_BLACK, fontSize: 18, marginBottom: 6 },
  addr: { color: SUB, fontSize: 14, marginTop: 4, fontFamily: INTER_BLACK, lineHeight: 20 },
  ratingTitle: { color: WHITE, opacity: 0.9, marginBottom: 10, textAlign: 'center', fontFamily: INTER_MEDIUM },
  starsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
});
