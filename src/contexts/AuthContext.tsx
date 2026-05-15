import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { UserProfile } from '../types';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  // loading is ONLY true during the very first auth check on page load.
  // It never goes back to true after that — login/logout don't trigger a full-page spinner.
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let profileUnsub: (() => void) | undefined;

    // Safety net: unblock the UI after 4s no matter what
    const timeout = setTimeout(() => setLoading(false), 4000);

    const authUnsub = onAuthStateChanged(auth, (firebaseUser) => {
      // Clean up previous profile listener before setting up a new one
      if (profileUnsub) {
        profileUnsub();
        profileUnsub = undefined;
      }

      setUser(firebaseUser);

      if (!firebaseUser) {
        setProfile(null);
        clearTimeout(timeout);
        setLoading(false);
        return;
      }

      // Listen to the user's Firestore profile in real-time
      profileUnsub = onSnapshot(
        doc(db, 'users', firebaseUser.uid),
        (snap) => {
          setProfile(snap.exists() ? (snap.data() as UserProfile) : null);
          clearTimeout(timeout);
          setLoading(false);
        },
        (err) => {
          // Rules may block read in some states — don't hang the app
          console.warn('[AuthContext] Could not load profile:', err.code);
          setProfile(null);
          clearTimeout(timeout);
          setLoading(false);
        }
      );
    });

    return () => {
      clearTimeout(timeout);
      authUnsub();
      if (profileUnsub) profileUnsub();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, profile, loading }}>
      {loading ? (
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-900" />
        </div>
      ) : (
        children
      )}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
