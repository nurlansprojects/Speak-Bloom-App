import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db, googleProvider, signInWithPopup, signOut, handleFirestoreError, OperationType } from '../lib/firebase';
import { UserProfile, UserRole } from '../types';

interface AuthContextType {
  currentUser: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateRole: (role: UserRole) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Bootstrapped administrator emails
const BOOTSTRAP_ADMIN_EMAILS = ['cookingmaxxer@gmail.com', 'nurlandigital@gmail.com'];

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchOrCreateProfile = async (user: User) => {
    try {
      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);

      const isBootstrappedAdmin = !!user.email && BOOTSTRAP_ADMIN_EMAILS.includes(user.email.toLowerCase());

      if (userSnap.exists()) {
        const data = userSnap.data() as UserProfile;
        // If user is bootstrapped admin but document says student, upgrade seamlessly
        if (isBootstrappedAdmin && data.role !== 'admin') {
          const updatedProfile: UserProfile = {
            ...data,
            role: 'admin',
            updatedAt: new Date().toISOString(),
          };
          await setDoc(userRef, updatedProfile, { merge: true });
          // Ensure /admins record exists
          await setDoc(doc(db, 'admins', user.uid), {
            email: user.email,
            createdAt: new Date().toISOString(),
          });
          setUserProfile(updatedProfile);
        } else {
          setUserProfile(data);
        }
      } else {
        // First-time sign in: initialize profile
        const initialRole: UserRole = isBootstrappedAdmin ? 'admin' : 'student';
        const newProfile: UserProfile = {
          id: user.uid,
          email: user.email || '',
          displayName: user.displayName || 'Learner',
          photoURL: user.photoURL || null,
          role: initialRole,
          createdAt: new Date().toISOString(),
        };

        await setDoc(userRef, newProfile);

        if (isBootstrappedAdmin) {
          await setDoc(doc(db, 'admins', user.uid), {
            email: user.email,
            createdAt: new Date().toISOString(),
          });
        }

        setUserProfile(newProfile);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, `users/${user.uid}`);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        await fetchOrCreateProfile(user);
      } else {
        setUserProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      if (result.user) {
        await fetchOrCreateProfile(result.user);
      }
    } catch (error: any) {
      console.error('Google Sign-In Error:', error);
      throw error;
    }
  };

  const logout = async () => {
    await signOut(auth);
    setUserProfile(null);
    setCurrentUser(null);
  };

  const refreshProfile = async () => {
    if (currentUser) {
      await fetchOrCreateProfile(currentUser);
    }
  };

  const updateRole = async (newRole: UserRole) => {
    if (!currentUser || !userProfile) return;
    const userRef = doc(db, 'users', currentUser.uid);
    const updated = {
      ...userProfile,
      role: newRole,
      updatedAt: new Date().toISOString(),
    };
    await setDoc(userRef, updated, { merge: true });
    setUserProfile(updated);
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        userProfile,
        loading,
        signInWithGoogle,
        logout,
        refreshProfile,
        updateRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
