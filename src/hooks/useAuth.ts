import { useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import { onSnapshot, doc } from 'firebase/firestore';
import { setupAuthlistener } from '@/lib/firebase/auth';
import { db } from '@/lib/firebase/config';
import type { User as UserType } from '@/types/models';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let userDocUnsub: (() => void) | null = null;

    const unsubscribe = setupAuthlistener((firebaseUser) => {
      setUser(firebaseUser);

      // Clean up previous user doc listener
      if (userDocUnsub) {
        userDocUnsub();
        userDocUnsub = null;
      }

      if (firebaseUser) {
        // Real-time listener on user document — picks up salonId changes instantly
        userDocUnsub = onSnapshot(
          doc(db, 'users', firebaseUser.uid),
          (snapshot) => {
            if (snapshot.exists()) {
              setUserData({ id: snapshot.id, ...snapshot.data() } as UserType);
            } else {
              setUserData(null);
            }
            setLoading(false);
          },
          (err) => {
            setError(err instanceof Error ? err : new Error('Unknown error'));
            setLoading(false);
          }
        );
      } else {
        setUserData(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribe();
      if (userDocUnsub) userDocUnsub();
    };
  }, []);

  return { user, userData, loading, error };
}
