import { useEffect, useState, useRef } from 'react';
import { subscribeToQuery } from '@/lib/firebase/db';
import type { QueryConstraint } from 'firebase/firestore';

/**
 * Real-time Firestore subscription hook.
 * Returns live data that updates automatically when any user changes the data.
 * Replaces useAsync for collections that need multi-user sync (e.g., sessions).
 *
 * Pass `deps` containing the values that should retrigger the subscription
 * (e.g. salonId, selectedDate). Relying on constraint identity is unreliable
 * because Firebase QueryConstraint objects don't serialize their values.
 */
export function useRealtime<T>(
  collectionName: string,
  constraints: QueryConstraint[],
  enabled: boolean = true,
  deps: ReadonlyArray<unknown> = [],
) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const constraintsRef = useRef(constraints);
  constraintsRef.current = constraints;

  useEffect(() => {
    if (!enabled) {
      setData([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = subscribeToQuery(
      collectionName,
      constraintsRef.current,
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
  }, [collectionName, enabled, ...deps]);

  return { data, loading, error };
}
