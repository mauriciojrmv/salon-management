import { useEffect, useState, useCallback } from 'react';
import { User } from 'firebase/auth';
import { setupAuthlistener, getUserDocument } from '@/lib/firebase/auth';
import type { User as UserType } from '@/types/models';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const unsubscribe = setupAuthlistener(async (firebaseUser) => {
      try {
        setUser(firebaseUser);
        if (firebaseUser) {
          const docData = await getUserDocument(firebaseUser.uid);
          setUserData(docData);
        } else {
          setUserData(null);
        }
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error'));
      } finally {
        setLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  return { user, userData, loading, error };
}
