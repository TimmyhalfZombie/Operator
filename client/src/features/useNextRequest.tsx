import { useCallback, useEffect, useState } from 'react';
import { AssistanceRequest } from './assistance/types';
import { acceptAssist, declineAssist, fetchNextAssist } from './assistance/api';

export function useNextAssist() {
  const [data, setData] = useState<AssistanceRequest | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const d = await fetchNextAssist();
      setData(d);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  const accept = useCallback(async () => {
    if (!data) return;
    await acceptAssist(data.id);
  }, [data]);

  const decline = useCallback(async () => {
    if (!data) return;
    await declineAssist(data.id);
  }, [data]);

  useEffect(() => { load(); }, [load]);

  return { data, loading, error, reload: load, accept, decline };
}
