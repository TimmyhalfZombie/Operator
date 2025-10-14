import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useDeclinedRequests } from '../contexts/DeclinedRequestsContext';
import { AssistItem, fetchOperatorInbox } from '../lib/activity.api';

export function useActivity() {
  const [items, setItems] = useState<AssistItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const { declinedIds, markAsDeclined } = useDeclinedRequests();

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) {
      setLoading(true);
      setError(null);
    }
    try {
      const data = await fetchOperatorInbox({ limit: 100 });
      setItems(data);
      if (!silent) setError(null);
    } catch (e) {
      if (!silent) {
        setError(e);
        setItems([]);
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Initial load
    load(false);
    
    // Start polling every 500ms for instant updates
    intervalRef.current = setInterval(() => {
      load(true);
    }, 500);

    // Handle app state changes
    const sub = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        load(true);
      }
    });

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      sub.remove();
    };
  }, [load]);


  // Split into "New" (pending) vs "Recent" (non-pending)
  // Hide requests that this operator has declined locally, but keep database status as pending
  const newItems = useMemo(() => 
    items.filter(i => 
      (i.status || 'pending') === 'pending' && 
      !declinedIds.has(i.id)
    ), [items, declinedIds]
  );
  const recentItems = useMemo(() => 
    items.filter(i => 
      (i.status || 'pending') !== 'pending' && 
      (i.status || 'pending') !== 'declined' &&
      !declinedIds.has(i.id)
    ), [items, declinedIds]
  );

  return { items, newItems, recentItems, loading, error, markAsDeclined };
}
