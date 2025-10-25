import { useEffect, useState } from 'react';
import { fetchMyLocationFromServer, OperatorLocation } from '../../lib/operator.api';

export function useServerMyLocation(pollMs = 5000) {
  const [loc, setLoc] = useState<OperatorLocation | null>(null);

  useEffect(() => {
    let t: any;
    const tick = async () => {
      try {
        const data = await fetchMyLocationFromServer();
        setLoc(data);
      } catch {
        // ignore silently
      }
      t = setTimeout(tick, pollMs);
    };
    tick();
    return () => clearTimeout(t);
  }, [pollMs]);

  return loc;
}
