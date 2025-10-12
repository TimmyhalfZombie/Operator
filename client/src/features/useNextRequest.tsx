import { useCallback, useEffect, useState } from 'react';
import { AssistanceRequest } from './assistance/types';
import { acceptAssist, declineAssist, fetchNextAssist } from './assistance/api';

export function useNextAssist() {
  const [data, setData] = useState<AssistanceRequest | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const item = await fetchNextAssist(); // already normalized
      setData(item ?? null);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const accept = useCallback(
    async (explicitId?: string) => {
      const id = explicitId ?? data?.id;
      if (!id) throw new Error('Missing request id');
      try {
        await acceptAssist(id);
      } catch (e: any) {
        const msg = String(e?.message || '');
        if (msg.toLowerCase().includes('not found') || msg.toLowerCase().includes('not pending')) {
          throw new Error('This request is no longer pending (already handled).');
        }
        throw e;
      } finally {
        // Pull next request regardless of outcome
        await load();
      }
    },
    [data?.id, load]
  );

  const decline = useCallback(
    async (explicitId?: string) => {
      const id = explicitId ?? data?.id;
      if (!id) throw new Error('Missing request id');
      try {
        await declineAssist(id);
      } finally {
        await load();
      }
    },
    [data?.id, load]
  );

  useEffect(() => {
    load();
  }, [load]);

  return { data, loading, error, reload: load, accept, decline };
}
