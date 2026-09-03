import React, { createContext, useContext, useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { requireSupabaseConfiguration, supabase } from '@/services/supabase';
import { saleStorage } from '@/services/saleStorage';

export type UserProfile = {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  role: 'owner' | 'admin' | 'seller';
};

export type ActiveOrganization = {
  id: string;
  name: string;
  role: UserProfile['role'];
};

type AuthContextType = {
  user: UserProfile | null;
  organization: ActiveOrganization | null;
  initializing: boolean;
  organizationError: string | null;
  isAuthenticated: boolean;
  login: (email: string, password?: string) => Promise<void>;
  logout: () => Promise<void>;
  isLoginModalOpen: boolean;
  openLoginModal: () => void;
  closeLoginModal: () => void;
  favorites: string[];
  isFavorite: (id: string) => boolean;
  toggleFavorite: (id: string) => void;
};

type MembershipRow = {
  organization_id: string;
  role: UserProfile['role'];
};

type BootstrapResult = { success: boolean; code?: string };
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
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favorites));
  }
}

function profileFromUser(user: User, role: UserProfile['role']): UserProfile {
  const name = typeof user.user_metadata?.name === 'string'
    ? user.user_metadata.name
    : typeof user.user_metadata?.full_name === 'string'
      ? user.user_metadata.full_name
      : user.email?.split('@')[0] ?? 'Vendedor';
  return {
    id: user.id,
    name,
    email: user.email ?? '',
    avatarUrl: typeof user.user_metadata?.avatar_url === 'string' ? user.user_metadata.avatar_url : undefined,
    role,
  };
}

async function findOrganization(userId: string): Promise<ActiveOrganization | null> {
  const { data: memberships, error: membershipError } = await supabase
    .from('memberships')
    .select('organization_id, role')
    .eq('user_id', userId)
    .eq('active', true)
    .order('created_at', { ascending: true })
    .limit(1);
  if (membershipError) throw membershipError;
  const membership = (memberships?.[0] ?? null) as MembershipRow | null;
  if (!membership) return null;

  const { data: organization, error: organizationError } = await supabase
    .from('organizations')
    .select('id, name')
    .eq('id', membership.organization_id)
    .is('deleted_at', null)
    .single();
  if (organizationError) throw organizationError;
  return { id: organization.id, name: organization.name, role: membership.role };
}

async function resolveOrganization(userId: string): Promise<ActiveOrganization> {
  const existing = await findOrganization(userId);
  if (existing) return existing;

  const { data, error } = await supabase.rpc('bootstrap_first_organization', {
    p_name: 'Destellos de Hada',
  });
  if (error) throw error;
  const result = data as BootstrapResult | null;
  if (!result?.success) {
    throw new Error(result?.code === 'ORGANIZATION_BOOTSTRAP_CLOSED'
      ? 'Tu cuenta todavía no tiene acceso a una organización.'
      : 'No fue posible determinar la organización activa.');
  }
  const bootstrapped = await findOrganization(userId);
  if (!bootstrapped) throw new Error('La organización fue creada, pero no pudo validarse mediante RLS.');
  return bootstrapped;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [organization, setOrganization] = useState<ActiveOrganization | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [organizationError, setOrganizationError] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<string[]>(readLocalFavorites);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  useEffect(() => {
    let active = true;
    const applyUser = async (authUser: User | null) => {
      if (!active) return;
      if (!authUser) {
        setUser(null);
        setOrganization(null);
        setOrganizationError(null);
        saleStorage.clearContext();
        setInitializing(false);
        return;
      }
      setInitializing(true);
      try {
        const nextOrganization = await resolveOrganization(authUser.id);
        if (!active) return;
        setOrganization(nextOrganization);
        setUser(profileFromUser(authUser, nextOrganization.role));
        setOrganizationError(null);
        saleStorage.setContext(authUser.id, nextOrganization.id);
        void saleStorage.syncAllPending();
      } catch (cause) {
        if (!active) return;
        setOrganization(null);
        setUser(profileFromUser(authUser, 'seller'));
        setOrganizationError(cause instanceof Error ? cause.message : 'No existe una organización activa.');
        saleStorage.clearContext();
      } finally {
        if (active) setInitializing(false);
      }
    };

    void supabase.auth.getSession().then(({ data }) => applyUser(data.session?.user ?? null));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      void applyUser(session?.user ?? null);
    });
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const toggleFavorite = (productId: string) => {
    setFavorites((previous) => {
      const next = previous.includes(productId)
        ? previous.filter((id) => id !== productId)
        : [...previous, productId];
      saveLocalFavorites(next);
      return next;
    });
  };

  const login = async (email: string, password?: string) => {
    requireSupabaseConfiguration();
    if (!password) throw new Error('La contraseña es obligatoria.');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    setIsLoginModalOpen(false);
  };

  const logout = async () => {
    await supabase.auth.signOut();
    saleStorage.clearContext();
  };

  return (
    <AuthContext.Provider value={{
      user,
      organization,
      initializing,
      organizationError,
      isAuthenticated: Boolean(user && organization),
      login,
      logout,
      isLoginModalOpen,
      openLoginModal: () => setIsLoginModalOpen(true),
      closeLoginModal: () => setIsLoginModalOpen(false),
      favorites,
      isFavorite: (productId) => favorites.includes(productId),
      toggleFavorite,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth debe ser usado dentro de un AuthProvider');
  return context;
}
