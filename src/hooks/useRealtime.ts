import { useEffect, useState, useRef } from 'react';
import { subscribeToQuery, firebaseConstraints } from '@/lib/firebase/db';
import type { QueryConstraint } from 'firebase/firestore';

/**
 * Real-time Firestore subscription hook.
 * Returns live data that updates automatically when any user changes the data.
 * Replaces useAsync for collections that need multi-user sync (e.g., sessions).
 */
export function useRealtime<T>(
  collectionName: string,
  constraints: QueryConstraint[],
  enabled: boolean = true,
) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  // Serialize constraints to detect changes
  const constraintsKey = JSON.stringify(constraints.map(String));

  useEffect(() => {
    if (!enabled) {
      setData([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = subscribeToQuery(
      collectionName,
      constraints,
      (docs) => {
        setData(docs as T[]);
        setLoading(false);
        setError(null);
      },
      (err) => {
        setError(err);
        setLoading(false);
      },
    );

    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collectionName, constraintsKey, enabled]);

  return { data, loading, error };
}
