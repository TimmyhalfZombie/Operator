import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchOperatorInbox, AssistItem } from '../lib/activity.api';

export function useActivity() {
  const [items, setItems] = useState<AssistItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // For an inbox feel, show newest first; you can pass status='pending' to only show new items.
      const data = await fetchOperatorInbox({ limit: 100 });
      setItems(data);
    } catch (e) {
      setError(e);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  // Split into "New" (pending) vs "Recent" (non-pending)
  const newItems = useMemo(() => items.filter(i => (i.status || 'pending') === 'pending'), [items]);
  const recentItems = useMemo(() => items.filter(i => (i.status || 'pending') !== 'pending'), [items]);

  return { items, newItems, recentItems, loading, error, refresh };
}
