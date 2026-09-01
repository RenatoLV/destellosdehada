import { useState, useEffect } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../services/supabase';
import {
  clearOrganizationContext,
  getCurrentOrganization,
  Organization,
} from '../services/organizationContext';

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<'initializing' | 'authenticated' | 'unauthenticated'>('initializing');
  const [currentOrganization, setCurrentOrganization] = useState<Organization | null>(null);
  const [organizationLoading, setOrganizationLoading] = useState(true);

  useEffect(() => {
    let active = true;
    let organizationRequest = 0;

    const hydrateOrganization = async (nextSession: Session | null) => {
      const requestId = ++organizationRequest;
      if (active) {
        setCurrentOrganization(null);
        setOrganizationLoading(Boolean(nextSession));
      }
      if (!nextSession) {
        await clearOrganizationContext();
        if (active && requestId === organizationRequest) {
          setCurrentOrganization(null);
          setOrganizationLoading(false);
        }
        return;
      }

      if (active) setOrganizationLoading(true);
      try {
        const organization = await getCurrentOrganization();
        if (active && requestId === organizationRequest) {
          setCurrentOrganization(organization);
        }
      } catch {
        if (active && requestId === organizationRequest) {
          setCurrentOrganization(null);
        }
      } finally {
        if (active && requestId === organizationRequest) {
          setOrganizationLoading(false);
        }
      }
    };

    const loadSession = async () => {
      try {
        const { data: { session: currentSession }, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (active) {
          setSession(currentSession);
          setStatus(currentSession ? 'authenticated' : 'unauthenticated');
          void hydrateOrganization(currentSession);
        }
      } catch {
        if (active) {
          setSession(null);
          setStatus('unauthenticated');
          void hydrateOrganization(null);
        }
      }
    };

    void loadSession();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return;
      setSession(nextSession);
      setStatus(nextSession ? 'authenticated' : 'unauthenticated');
      void hydrateOrganization(nextSession);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  return {
    session,
    currentUser: session?.user ?? null,
    currentOrganization,
    organizationLoading,
    status,
    loading: status === 'initializing' || organizationLoading,
  };
}
