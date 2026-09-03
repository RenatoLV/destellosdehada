import { useEffect } from 'react';
import { Platform } from 'react-native';

export function useWebModalFocusTrap(visible: boolean, testId: string) {
  useEffect(() => {
    if (!visible || Platform.OS !== 'web' || typeof document === 'undefined') return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    let root: HTMLElement | null = null;

    const getFocusable = () =>
      root
        ? Array.from(
            root.querySelectorAll<HTMLElement>(
              'button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
            )
          ).filter((element) => !element.hasAttribute('disabled'))
        : [];

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab' || !root) return;
      const focusable = getFocusable();
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    const frame = requestAnimationFrame(() => {
      root = document.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
      getFocusable()[0]?.focus();
      document.addEventListener('keydown', handleKeyDown);
    });

    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('keydown', handleKeyDown);
      previouslyFocused?.focus?.();
    };
  }, [visible, testId]);
}
