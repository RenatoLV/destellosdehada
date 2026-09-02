/**
 * context/AuthContext.tsx
 * Contexto de autenticación para clientes de Destellos de Hada usando Firebase Auth.
 * Maneja estado de sesión (cliente logueado o invitado), login, registro y logout.
 */
import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signOut,
  User as FirebaseUser
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '@/services/firebase';

export type UserProfile = {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  role: 'cliente';
};

type AuthContextType = {
  user: UserProfile | null;
  isAuthenticated: boolean;
  login: (email: string, password?: string, name?: string) => Promise<void>;
  logout: () => Promise<void>;
  isLoginModalOpen: boolean;
  openLoginModal: () => void;
  closeLoginModal: () => void;
  favorites: string[];
  isFavorite: (id: string) => boolean;
  toggleFavorite: (id: string) => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const FAVORITES_STORAGE_KEY = 'destellos_favorites_v1';

function readLocalFavorites(): string[] {
  if (typeof window === 'undefined' || !window.localStorage) return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(FAVORITES_STORAGE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

function saveLocalFavorites(favorites: string[]) {
  if (typeof window === 'undefined' || !window.localStorage) return;
  window.localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favorites));
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [favorites, setFavorites] = useState<string[]>(readLocalFavorites);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  useEffect(() => {
    // Suscripción al estado de Firebase Auth
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      if (firebaseUser) {
        setUser({
          id: firebaseUser.uid,
          name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Cliente',
          email: firebaseUser.email || '',
          avatarUrl: firebaseUser.photoURL || undefined,
          role: 'cliente'
        });

        const localFavorites = readLocalFavorites();
        try {
          const profileRef = doc(db, 'clientes', firebaseUser.uid);
          const snapshot = await getDoc(profileRef);
          const remoteFavorites = snapshot.data()?.favorites;
          const resolvedFavorites = Array.isArray(remoteFavorites)
            ? [...new Set([
                ...remoteFavorites.filter((id): id is string => typeof id === 'string'),
                ...localFavorites,
              ])]
            : localFavorites;

          setFavorites(resolvedFavorites);
          saveLocalFavorites(resolvedFavorites);

          await setDoc(
            profileRef,
            {
              name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Cliente',
              email: firebaseUser.email || '',
              favorites: resolvedFavorites,
              updatedAt: new Date().toISOString(),
            },
            { merge: true }
          );
        } catch (error) {
          console.warn('No fue posible sincronizar favoritos', error);
          setFavorites(localFavorites);
        }
      } else {
        setUser(null);
        setFavorites(readLocalFavorites());
      }
    });

    return () => unsubscribe();
  }, []);

  const toggleFavorite = (productId: string) => {
    setFavorites((prev) => {
      const next = prev.includes(productId)
        ? prev.filter((id) => id !== productId)
        : [...prev, productId];
      saveLocalFavorites(next);
      const firebaseUser = auth.currentUser;
      if (firebaseUser) {
        setDoc(
          doc(db, 'clientes', firebaseUser.uid),
          { favorites: next, updatedAt: new Date().toISOString() },
          { merge: true }
        ).catch((error) => console.warn('No fue posible actualizar favoritos', error));
      }
      return next;
    });
  };

  const isFavorite = (productId: string) => favorites.includes(productId);

  const login = async (email: string, password?: string, name?: string) => {
    if (!password) {
       throw new Error('Password is required');
    }

    try {
      if (name) {
        // Register mode
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(userCredential.user, { displayName: name });
        setUser({
          id: userCredential.user.uid,
          name,
          email: userCredential.user.email || email,
          avatarUrl: userCredential.user.photoURL || undefined,
          role: 'cliente',
        });
      } else {
        // Login mode
        await signInWithEmailAndPassword(auth, email, password);
      }
      setIsLoginModalOpen(false);
    } catch (error) {
      console.error("Auth error:", error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const openLoginModal = () => setIsLoginModalOpen(true);
  const closeLoginModal = () => setIsLoginModalOpen(false);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: Boolean(user),
        login,
        logout,
        isLoginModalOpen,
        openLoginModal,
        closeLoginModal,
        favorites,
        isFavorite,
        toggleFavorite,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe ser usado dentro de un AuthProvider');
  }
  return context;
}
