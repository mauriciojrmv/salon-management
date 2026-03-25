import { useEffect, useState, useCallback, useRef } from 'react';

interface UseAsyncState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
}

export function useAsync<T>(
  fn: () => Promise<T>,
  deps?: React.DependencyList
): UseAsyncState<T> & { refetch: () => Promise<void> } {
  const [state, setState] = useState<UseAsyncState<T>>({
    data: null,
    loading: true,
    error: null,
  });

  const isMountedRef = useRef(true);

  const execute = useCallback(async () => {
    setState({ data: null, loading: true, error: null });
    try {
      const result = await fn();
      if (isMountedRef.current) {
        setState({ data: result, loading: false, error: null });
      }
    } catch (err) {
      if (isMountedRef.current) {
        setState({
          data: null,
          loading: false,
          error: err instanceof Error ? err : new Error('Unknown error'),
        });
      }
    }
  }, [fn]);

  useEffect(() => {
    isMountedRef.current = true;
    execute();

    return () => {
      isMountedRef.current = false;
    };
  }, deps || [execute]);

  return {
    ...state,
    refetch: execute,
  };
}
