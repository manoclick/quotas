import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserProfile } from '../types';
import { doc, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth';

interface UserContextType {
  userProfile: UserProfile | null;
  permissions: any;
  loading: boolean;
  login: (profile: UserProfile) => void;
  logout: () => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(() => {
    const saved = localStorage.getItem('quotas_session');
    return saved ? JSON.parse(saved) : null;
  });
  const [permissions, setPermissions] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubPermissions = onSnapshot(doc(db, 'system_configs', 'permissions'), (docSnap) => {
      if (docSnap.exists()) {
        setPermissions(docSnap.data());
      } else {
        // Default permissions if not set
        setPermissions({
          admin: { home: true, teachers: true, payments: true, reports: true, settings: true, users: true, zones: true, circles: true, cells: true, functions: true },
          gestor: { home: true, teachers: true, payments: true, reports: true, settings: true, users: false, zones: true, circles: true, cells: true, functions: true },
          gestor_celula: { home: true, teachers: true, payments: true, reports: false, settings: false, users: false, zones: false, circles: false, cells: false, functions: false },
          professor: { home: true, teachers: false, payments: false, reports: true, settings: false, users: false, zones: false, circles: false, cells: false, functions: false }
        });
      }
    });

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        try {
          await signInAnonymously(auth);
        } catch (error) {
          console.error('Anonymous sign-in error:', error);
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (userProfile) {
      localStorage.setItem('quotas_session', JSON.stringify(userProfile));
      
      const unsubProfile = onSnapshot(doc(db, 'users', userProfile.id), (docSnap) => {
        if (docSnap.exists()) {
          const updatedProfile = { id: docSnap.id, ...docSnap.data() } as UserProfile;
          setUserProfile(updatedProfile);
          localStorage.setItem('quotas_session', JSON.stringify(updatedProfile));
        } else {
          logout();
        }
      });

      return () => unsubProfile();
    } else {
      localStorage.removeItem('quotas_session');
    }
  }, [userProfile?.id]);

  const login = (profile: UserProfile) => {
    setUserProfile(profile);
  };

  const logout = () => {
    setUserProfile(null);
    localStorage.removeItem('quotas_session');
  };

  return (
    <UserContext.Provider value={{ userProfile, permissions, loading, login, logout }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}
