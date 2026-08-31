import { useState, useEffect } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../services/supabase';

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<'initializing' | 'authenticated' | 'unauthenticated'>('initializing');

  useEffect(() => {
    let active = true;

    const loadSession = async () => {
      try {
        const { data: { session: currentSession }, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (active) {
          setSession(currentSession);
          setStatus(currentSession ? 'authenticated' : 'unauthenticated');
        }
      } catch {
        if (active) {
          setSession(null);
          setStatus('unauthenticated');
        }
      }
    };

    void loadSession();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return;
      setSession(nextSession);
      setStatus(nextSession ? 'authenticated' : 'unauthenticated');
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  return { session, status, loading: status === 'initializing' };
}
