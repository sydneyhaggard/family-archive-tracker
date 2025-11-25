import React, { createContext, useContext, useState, useEffect } from 'react';
import { onAuthStateChanged, getIdTokenResult } from 'firebase/auth';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../config/firebase';

/**
 * AuthContext - Provides authentication state, user profile, and admin status throughout the app
 */
const AuthContext = createContext({
  user: null,
  userProfile: null,
  loading: true,
  isAdmin: false,
  systemConfig: null,
  refreshToken: () => {},
  getDisplayName: () => 'Unknown User'
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
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
        setUserProfile(null);
      }
      
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Listen for user profile changes
  useEffect(() => {
    if (!user) {
      setUserProfile(null);
      return;
    }

    const userRef = doc(db, 'users', user.uid);
    
    const unsubscribe = onSnapshot(
      userRef,
      (snapshot) => {
        if (snapshot.exists()) {
          setUserProfile({
            id: snapshot.id,
            ...snapshot.data()
          });
        } else {
          // Default profile
          setUserProfile({
            id: user.uid,
            email: user.email,
            displayName: user.displayName || '',
            photoURL: user.photoURL || ''
          });
        }
      },
      (error) => {
        console.error('Error fetching user profile:', error);
      }
    );

    return () => unsubscribe();
  }, [user]);

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

  /**
   * Get display name for a user profile object
   * Falls back to email prefix if no display name is set
   */
  const getDisplayName = (profile) => {
    if (!profile) return 'Unknown User';
    if (profile.displayName) return profile.displayName;
    if (profile.email) return profile.email.split('@')[0];
    if (profile.ownerName) return profile.ownerName;
    if (profile.ownerEmail) return profile.ownerEmail.split('@')[0];
    return 'Unknown User';
  };

  const value = {
    user,
    userProfile,
    loading,
    isAdmin,
    systemConfig,
    refreshToken,
    getDisplayName
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export default AuthContext;
