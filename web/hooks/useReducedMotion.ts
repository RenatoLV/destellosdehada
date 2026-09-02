/**
 * hooks/useReducedMotion.ts
 * Sección 28/45 del mega prompt: theme/motion.ts ya tenía `shouldReduceMotion`
 * como stub que recibía un boolean de afuera. Este hook lo alimenta con el
 * valor real del sistema (AccessibilityInfo) y expone un boolean listo para
 * usar en cualquier componente animado.
 */
import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import { shouldReduceMotion } from '@/theme';

export function useReducedMotion(): boolean {
  const [systemPrefersReducedMotion, setSystemPrefersReducedMotion] = useState(false);

  useEffect(() => {
    let mounted = true;

    AccessibilityInfo.isReduceMotionEnabled?.().then((value) => {
      if (mounted) setSystemPrefersReducedMotion(value);
    });

    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', (value) => {
      setSystemPrefersReducedMotion(value);
    });

    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  return shouldReduceMotion(systemPrefersReducedMotion);
}
