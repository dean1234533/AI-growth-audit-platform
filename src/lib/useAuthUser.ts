import { useEffect, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth } from './firebaseClient';

/** Redirects to /login if signed out. Returns null while the auth state is still loading. */
export function useAuthUser(): User | null {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      if (u) {
        setUser(u);
      } else {
        window.location.href = '/login';
      }
    });
    return unsubscribe;
  }, []);

  return user;
}
