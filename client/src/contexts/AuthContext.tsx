import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { User as FirebaseUser } from 'firebase/auth';
import { auth, onAuthStateChanged, signOut } from '../firebase';

interface AppUser {
  id: string;
  firebase_uid: string;
  lobby_id: string;
  display_name: string;
  profile_picture_url: string;
}

interface AuthContextType {
  currentUser: FirebaseUser | null;
  appUser: AppUser | null;
  loading: boolean;
  logout: () => Promise<void>;
  refreshAppUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchAppUser = async (user: FirebaseUser) => {
    try {
      const token = await user.getIdToken();
      // Call backend to sync user and get lobby_id
      const response = await fetch('http://localhost:3001/api/auth/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ firebase_token: token })
      });
      
      if (response.ok) {
        const data = await response.json();
        setAppUser(data.user);
      } else {
        console.error('Failed to verify with backend');
        setAppUser(null);
      }
    } catch (error) {
      console.error('Error syncing user with backend:', error);
      setAppUser(null);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        await fetchAppUser(user);
      } else {
        setAppUser(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const logout = async () => {
    await signOut(auth);
    setAppUser(null);
    setCurrentUser(null);
  };

  const refreshAppUser = async () => {
    if (currentUser) {
      await fetchAppUser(currentUser);
    }
  };

  const value = {
    currentUser,
    appUser,
    loading,
    logout,
    refreshAppUser
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
