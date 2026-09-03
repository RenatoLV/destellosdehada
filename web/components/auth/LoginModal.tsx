import { useState, type ComponentProps } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/theme';
import { useAuth } from '@/context/AuthContext';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { useToast } from '@/components/ui/Toast';
import { useWebModalFocusTrap } from '@/hooks/useWebModalFocusTrap';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function authErrorMessage(error: unknown) {
  const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : '';
  const messages: Record<string, string> = {
    invalid_credentials: 'El correo o la contraseña no coinciden.',
    email_not_confirmed: 'Debes confirmar tu correo antes de ingresar.',
    over_request_rate_limit: 'Hubo demasiados intentos. Espera un momento antes de volver a probar.',
  };
  if (messages[code]) return messages[code];
  return error instanceof Error ? error.message : 'No pudimos completar el acceso. Inténtalo nuevamente.';
}

export function LoginModal() {
  const theme = useTheme();
  const { isLoginModalOpen, closeLoginModal, login } = useAuth();
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  useWebModalFocusTrap(isLoginModalOpen, 'login-modal-card');

  if (!isLoginModalOpen) return null;

  const handleSubmit = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!EMAIL_PATTERN.test(normalizedEmail)) {
      toast.show({ message: 'Ingresa un correo electrónico válido.', type: 'error' });
      return;
    }
    if (password.length < 6) {
      toast.show({ message: 'La contraseña debe tener al menos 6 caracteres.', type: 'error' });
      return;
    }
    setSubmitting(true);
    try {
      await login(normalizedEmail, password);
      toast.show({ message: 'Sesión iniciada correctamente.', type: 'success' });
      setPassword('');
    } catch (error) {
      toast.show({ message: authErrorMessage(error), type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      visible={isLoginModalOpen}
      transparent
      animationType="fade"
      onRequestClose={closeLoginModal}
      accessibilityViewIsModal
    >
      <Pressable style={styles.backdrop} onPress={closeLoginModal}>
        <Pressable
          testID="login-modal-card"
          style={[
            styles.card,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
              borderRadius: theme.radius.xl,
              ...theme.shadows.dialog,
            },
          ]}
          onPress={(event) => event.stopPropagation()}
        >
          <View style={styles.closeBtn}>
            <IconButton icon="x" size={18} onPress={closeLoginModal} accessibilityLabel="Cerrar acceso" />
          </View>

          <ScrollView showsVerticalScrollIndicator={false} bounces={false} contentContainerStyle={styles.cardContent}>
          <View style={styles.header}>
            <BrandLogo variant="full" width={224} />
            <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
              Acceso seguro para miembros de la organización.
            </Text>
          </View>

          <View style={styles.form}>
            <Field
              label="Correo electrónico"
              icon="mail"
              value={email}
              onChangeText={setEmail}
              placeholder="tu@email.com"
              autoFocus
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />
            <Field
              label="Contraseña"
              icon="lock"
              value={password}
              onChangeText={setPassword}
              placeholder="Mínimo 6 caracteres"
              secureTextEntry
              autoComplete="current-password"
            />

            <View style={styles.submitWrap}>
              <Button
                label="Entrar a la organización"
                onPress={handleSubmit}
                variant="primary"
                size="lg"
                icon="arrow-right"
                loading={submitting}
              />
            </View>

            <Text style={[styles.accessNote, { color: theme.colors.textSecondary }]}>Las cuentas y permisos se administran mediante Supabase Memberships.</Text>
          </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

type FieldProps = ComponentProps<typeof TextInput> & {
  label: string;
  icon: keyof typeof Feather.glyphMap;
};

function Field({ label, icon, ...inputProps }: FieldProps) {
  const theme = useTheme();
  return (
    <View style={styles.inputWrap}>
      <Text style={[styles.inputLabel, { color: theme.colors.text }]}>{label}</Text>
      <View
        style={[
          styles.inputBox,
          { backgroundColor: theme.colors.ivory, borderColor: theme.colors.border },
        ]}
      >
        <Feather name={icon} size={17} color={theme.colors.textSecondary} />
        <TextInput
          {...inputProps}
          placeholderTextColor={theme.colors.textMuted}
          style={[styles.input, { color: theme.colors.text }]}
          returnKeyType="done"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(28, 14, 19, 0.62)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
  },
  card: {
    width: '100%',
    maxWidth: 430,
    maxHeight: '94%',
    position: 'relative',
    borderWidth: 1,
    overflow: 'hidden',
  },
  cardContent: { paddingHorizontal: 24, paddingVertical: 26 },
  closeBtn: { position: 'absolute', top: 12, right: 12, zIndex: 10 },
  header: { alignItems: 'center', marginBottom: 22, paddingTop: 4 },
  subtitle: { fontSize: 13, lineHeight: 19, marginTop: 10, textAlign: 'center' },
  tabsRow: { flexDirection: 'row', borderBottomWidth: 1, marginBottom: 18 },
  tabBtn: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  tabText: { fontSize: 14 },
  tabTextActive: { fontWeight: '700' },
  form: { gap: 13 },
  inputWrap: { gap: 6 },
  inputLabel: { fontSize: 12, fontWeight: '700' },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 13,
    minHeight: 48,
  },
  input: { flex: 1, minHeight: 46, fontSize: 14 },
  submitWrap: { marginTop: 8 },
  accessNote: { fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 4 },
  guestBtn: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
    borderRadius: 22,
  },
  guestBtnText: { fontSize: 13, fontWeight: '700' },
});
