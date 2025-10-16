import React from 'react';
import { listConversations, ConversationPreview } from './api';

export function useConversations() {
  const [items, setItems] = React.useState<ConversationPreview[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<unknown>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const data = await listConversations(100);
      setItems(data);
      setError(null);
    } catch (e) {
      setError(e);
    } finally { setLoading(false); }
  }, []);

  React.useEffect(() => { load(); }, [load]);

  return { items, loading, error, reload: load };
}
