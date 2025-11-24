import React, { createContext, useContext, useState, useEffect } from 'react';
import { onAuthStateChanged, getIdTokenResult } from 'firebase/auth';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../config/firebase';

/**
 * AuthContext - Provides authentication state and admin status throughout the app
 */
const AuthContext = createContext({
  user: null,
  loading: true,
  isAdmin: false,
  systemConfig: null,
  refreshToken: () => {}
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [systemConfig, setSystemConfig] = useState(null);

  // Function to refresh the user's token and check admin claim
  const refreshToken = async () => {
    if (auth.currentUser) {
      try {
        // Force token refresh
        await auth.currentUser.getIdToken(true);
        const tokenResult = await getIdTokenResult(auth.currentUser);
        setIsAdmin(!!tokenResult.claims.admin);
      } catch (error) {
        console.error('Error refreshing token:', error);
      }
    }
  };

  // Listen for auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      
      if (currentUser) {
        try {
          // Check for admin custom claim
          const tokenResult = await getIdTokenResult(currentUser);
          setIsAdmin(!!tokenResult.claims.admin);
        } catch (error) {
          console.error('Error getting token result:', error);
          setIsAdmin(false);
        }
      } else {
        setIsAdmin(false);
      }
      
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Listen for system config changes
  useEffect(() => {
    const configRef = doc(db, 'system', 'config');
    
    const unsubscribe = onSnapshot(
      configRef,
      (snapshot) => {
        if (snapshot.exists()) {
          setSystemConfig(snapshot.data());
        } else {
          // Default config if not set
          setSystemConfig({
            allowRegistration: true,
            enableGeminiAI: true,
            defaultStorageLimitMB: 500
          });
        }
      },
      (error) => {
        console.error('Error fetching system config:', error);
        // Default config on error
        setSystemConfig({
          allowRegistration: true,
          enableGeminiAI: true,
          defaultStorageLimitMB: 500
        });
      }
    );

    return () => unsubscribe();
  }, []);

  const value = {
    user,
    loading,
    isAdmin,
    systemConfig,
    refreshToken
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export default AuthContext;
