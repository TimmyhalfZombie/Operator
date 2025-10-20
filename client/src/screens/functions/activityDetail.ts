// Helpers and hook for ActivityDetailScreen logic (no UI here)
import { router, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { AppState } from 'react-native';
import { getAssistByAnyId } from '../../features/assistance/api';
import { getCompletedByAnyId } from '../../lib/completedCache';

export function fmtRange(a?: string, b?: string) {
  const dt = (s?: string) => (s ? new Date(s) : null);
  const toHM = (d: Date) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const A = dt(a), B = dt(b);
  if (A && B) return `${toHM(A)} - ${toHM(B)}`;
  if (A) return toHM(A);
  return undefined;
}

export const first = (v?: string | string[]) => (Array.isArray(v) ? v[0] : v);

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

export function useActivityDetail() {
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
        console.log('Fresh data from server:', Object.keys(fresh));
        console.log('Fresh data userId:', fresh.userId);
        console.log('Fresh data user:', fresh.user);
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

  // ---- render prep values
  let customer: string = 'Customer', contactName: string | null = null, customerPhone: string | null = null, startName: string = 'Start', startAddr: string = '', endName: string = 'Vehicle', endAddr: string = 'Location', status: string = 'Repaired', timeRepaired: string | null = null, rating: number = 0, timeRange: string = '—', clientAvatar: string | null = null;
  
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
    
    // Get client avatar from user data
    clientAvatar = doc?.user?.avatar || doc?.client?.avatar || doc?.customer?.avatar || null;
    
    // Debug logging (once)
    if (clientAvatar) {
      console.log('Client avatar found:', clientAvatar);
    } else {
      console.log('No client avatar found. User data:', doc?.user);
      console.log('Full doc keys:', Object.keys(doc || {}));
      console.log('Doc userId:', doc?.userId);
    }

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
      // Always navigate immediately; let ChatScreen resolve/create the conversation
      const peerUserId =
        doc?.customerId ||
        doc?.clientId ||
        doc?.userId ||
        doc?.user?._id ||
        doc?.client?._id ||
        doc?.customer?._id ||
        undefined;
      router.push({ pathname: '/chat/[id]', params: { id: 'new', requestId: String(requestId), ...(peerUserId ? { peer: String(peerUserId) } : {}) } });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.log('handleMessagePress error:', e);
    } finally {
      setMsgBusy(false);
    }
  }

  return {
    loading,
    err,
    doc,
    msgBusy,
    customer,
    contactName,
    customerPhone,
    startName,
    startAddr,
    endName,
    endAddr,
    status,
    timeRepaired,
    rating,
    timeRange,
    clientAvatar,
    handleMessagePress,
  } as const;
}


