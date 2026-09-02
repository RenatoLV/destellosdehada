/**
 * components/ui/Toast.tsx
 * Sistema global de Toast con cola animada (hasta 3 visibles) y soporte de botones de acción (ej. Deshacer).
 */
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { useTheme } from '@/theme';

export type ToastType = 'success' | 'info' | 'warning' | 'error';

export type ToastAction = {
  label: string;
  onPress: () => void;
};

export type ToastInput = {
  message: string;
  type?: ToastType;
  durationMs?: number;
  action?: ToastAction;
};

type ToastItem = {
  id: string;
  message: string;
  type: ToastType;
  durationMs: number;
  action?: ToastAction;
};

type ToastContextValue = { show: (input: ToastInput) => void };

const ToastContext = createContext<ToastContextValue | null>(null);

const ICON_BY_TYPE: Record<ToastType, keyof typeof Feather.glyphMap> = {
  success: 'check-circle',
  info: 'info',
  warning: 'alert-triangle',
  error: 'alert-circle',
};

const MAX_VISIBLE_TOASTS = 3;

export function ToastProvider({ children }: { children: ReactNode }) {
  const theme = useTheme();
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const show = useCallback(({ message, type = 'success', durationMs = 3000, action }: ToastInput) => {
    const id = `toast-${idRef.current++}`;
    setToasts((prev) => [...prev, { id, message, type, durationMs, action }].slice(-MAX_VISIBLE_TOASTS));
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, durationMs);
  }, []);

  const dismiss = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <View style={[styles.stack, { zIndex: theme.zIndex.toast, pointerEvents: 'box-none' }]}>
        {toasts.map((toast) => (
          <ToastBubble key={toast.id} toast={toast} onDismiss={() => dismiss(toast.id)} />
        ))}
      </View>
    </ToastContext.Provider>
  );
}

function ToastBubble({ toast, onDismiss }: { toast: ToastItem; onDismiss: () => void }) {
  const theme = useTheme();
  const colorByType: Record<ToastType, string> = {
    success: theme.colors.success,
    info: theme.colors.primary,
    warning: theme.colors.warning,
    error: theme.colors.error,
  };

  return (
    <Animated.View
      entering={FadeInDown.duration(theme.duration.normal).springify()}
      exiting={FadeOutDown.duration(theme.duration.fast)}
      style={[
        styles.toast,
        {
          backgroundColor: theme.colors.text,
          borderRadius: theme.radius.full,
          paddingLeft: theme.spacing.md,
          paddingRight: toast.action ? theme.spacing.sm : theme.spacing.md,
          ...theme.shadows.dialog,
        },
      ]}
    >
      <Feather name={ICON_BY_TYPE[toast.type]} size={16} color={colorByType[toast.type]} />
      <Text style={[theme.typography.body, { color: '#FFFFFF', marginLeft: theme.spacing.xs }]} numberOfLines={2}>
        {toast.message}
      </Text>

      {toast.action && (
        <Pressable
          onPress={() => {
            toast.action?.onPress();
            onDismiss();
          }}
          style={({ pressed }) => [
            styles.actionButton,
            {
              backgroundColor: theme.colors.primary,
              opacity: pressed ? 0.8 : 1,
              borderRadius: theme.radius.full,
              marginLeft: theme.spacing.sm,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel={toast.action.label}
        >
          <Text style={[theme.typography.label, { color: '#FFFFFF', fontSize: 12 }]}>{toast.action.label}</Text>
        </Pressable>
      )}
    </Animated.View>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast debe usarse dentro de <ToastProvider>');
  return ctx;
}

const styles = StyleSheet.create({
  stack: {
    position: 'absolute',
    bottom: 90,
    left: 0,
    right: 0,
    alignItems: 'center',
    gap: 8,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
    maxWidth: '90%',
    paddingVertical: 6,
  },
  actionButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
});
