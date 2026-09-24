import React, { createContext, useContext, useEffect, useState } from 'react';
import type { User as FirebaseUser } from 'firebase/auth';
import {
  auth,
  googleProvider,
  signInWithPopup,
  firebaseSignOut,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  syncUserProfile,
  getClientDeviceInfo,
} from '../lib/firebase.js';
import { User } from '../types.js';


export interface LoginSessionDetails {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  providerId: string;
  device: string;
  lastSignInTime?: string;
  creationTime?: string;
  isAnonymous: boolean;
}

interface AuthContextType {
  firebaseUser: FirebaseUser | null;
  currentUser: User | null;
  sessionDetails: LoginSessionDetails | null;
  loading: boolean;
  authError: string | null;
  clearAuthError: () => void;
  signInWithGoogle: () => Promise<User | null>;
  signInWithEmail: (email: string, pass: string) => Promise<User | null>;
  signUpWithEmail: (email: string, pass: string, name: string) => Promise<User | null>;
  signInAsDemo: () => Promise<User>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Fallback guest profile when not logged in
const DEFAULT_GUEST_USER: User = {
  id: 'usr_guest_demo',
  name: 'Guest Traveler',
  email: 'guest@smartvoyager.ai',
  role: 'Traveler',
  provider: 'guest',
  preferences: {
    home_city: 'Chennai',
    preferred_currency: 'INR',
    travel_style: 'family',
    interests: ['Heritage', 'Food', 'Shopping', 'Nature'],
    food_preference: 'all',
    accommodation_preference: 'boutique',
    transport_preference: 'flight',
  },
  created_at: new Date().toISOString(),
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [sessionDetails, setSessionDetails] = useState<LoginSessionDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        setFirebaseUser(fbUser);
        try {
          const appUser = await syncUserProfile(fbUser);
          setCurrentUser(appUser);
          setSessionDetails({
            uid: fbUser.uid,
            email: fbUser.email,
            displayName: fbUser.displayName,
            photoURL: fbUser.photoURL,
            providerId: fbUser.providerData[0]?.providerId || 'password',
            device: getClientDeviceInfo(),
            lastSignInTime: fbUser.metadata.lastSignInTime,
            creationTime: fbUser.metadata.creationTime,
            isAnonymous: fbUser.isAnonymous,
          });
        } catch (err: any) {
          console.error('Failed to sync user profile:', err);
          // Fallback minimal user
          setCurrentUser({
            id: fbUser.uid,
            name: fbUser.displayName || fbUser.email?.split('@')[0] || 'Traveler',
            email: fbUser.email || '',
            photo_url: fbUser.photoURL || undefined,
            role: 'Organizer',
            provider: fbUser.providerData[0]?.providerId === 'google.com' ? 'google' : 'password',
            preferences: DEFAULT_GUEST_USER.preferences,
            created_at: new Date().toISOString(),
            last_login_at: new Date().toISOString(),
          });
        }
      } else {
        setFirebaseUser(null);
        setCurrentUser(null);
        setSessionDetails(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const clearAuthError = () => setAuthError(null);

  const signInWithGoogle = async (): Promise<User | null> => {
    setAuthError(null);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const appUser = await syncUserProfile(result.user);
      setCurrentUser(appUser);
      return appUser;
    } catch (err: any) {
      // Benign user action: user closed or dismissed the popup window before authenticating
      if (err?.code === 'auth/popup-closed-by-user' || err?.code === 'auth/cancelled-popup-request') {
        console.info('Google sign-in popup closed by user.');
        setAuthError(null);
        return null;
      }

      console.warn('Google Sign-in warning:', err?.message || err);
      let msg = err?.message || 'Google sign-in could not be completed. Please try again or use email sign-in.';
      if (err?.code === 'auth/popup-blocked') {
        msg = 'Sign-in popup was blocked by your browser. Please allow popups for this site or use email sign-in.';
      } else if (err?.code === 'auth/unauthorized-domain') {
        msg = 'This domain is not configured for Google OAuth. Please use email or demo sign-in.';
      }
      setAuthError(msg);
      return null;
    }
  };

  const signInAsDemo = async (): Promise<User> => {
    setAuthError(null);
    const demoUser: User = {
      id: 'usr_demo_01',
      name: 'Siddharth Rao',
      email: 'siddharth@smartvoyager.ai',
      role: 'Organizer',
      provider: 'demo',
      preferences: DEFAULT_GUEST_USER.preferences,
      created_at: new Date().toISOString(),
      last_login_at: new Date().toISOString(),
    };
    setCurrentUser(demoUser);
    setSessionDetails({
      uid: 'usr_demo_01',
      email: 'siddharth@smartvoyager.ai',
      displayName: 'Siddharth Rao',
      photoURL: null,
      providerId: 'demo',
      device: getClientDeviceInfo(),
      lastSignInTime: new Date().toISOString(),
      creationTime: new Date().toISOString(),
      isAnonymous: false,
    });
    return demoUser;
  };

  const signInWithEmail = async (email: string, pass: string): Promise<User | null> => {
    setAuthError(null);
    try {
      const cred = await signInWithEmailAndPassword(auth, email, pass);
      const appUser = await syncUserProfile(cred.user);
      setCurrentUser(appUser);
      return appUser;
    } catch (err: any) {
      console.error('Email sign-in error:', err);
      let msg = err.message || 'Failed to sign in with email.';
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        msg = 'Invalid email or password. Please check your credentials.';
      } else if (err.code === 'auth/invalid-email') {
        msg = 'Please enter a valid email address.';
      }
      setAuthError(msg);
      throw new Error(msg);
    }
  };

  const signUpWithEmail = async (email: string, pass: string, name: string): Promise<User | null> => {
    setAuthError(null);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, pass);
      if (name.trim()) {
        await updateProfile(cred.user, { displayName: name.trim() });
      }
      const appUser = await syncUserProfile(cred.user);
      setCurrentUser(appUser);
      return appUser;
    } catch (err: any) {
      console.error('Email sign-up error:', err);
      let msg = err.message || 'Failed to create account.';
      if (err.code === 'auth/email-already-in-use') {
        msg = 'An account with this email already exists. Please sign in instead.';
      } else if (err.code === 'auth/weak-password') {
        msg = 'Password is too weak. Please use at least 6 characters.';
      }
      setAuthError(msg);
      throw new Error(msg);
    }
  };

  const signOut = async (): Promise<void> => {
    setAuthError(null);
    try {
      await firebaseSignOut(auth);
      setFirebaseUser(null);
      setCurrentUser(null);
      setSessionDetails(null);
    } catch (err: any) {
      console.error('Sign-out error:', err);
      setAuthError(err.message || 'Failed to sign out.');
      throw err;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        currentUser,
        sessionDetails,
        loading,
        authError,
        clearAuthError,
        signInWithGoogle,
        signInWithEmail,
        signUpWithEmail,
        signInAsDemo,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
};
