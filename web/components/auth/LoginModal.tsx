import { useEffect, useState, type ComponentProps } from 'react';
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
type AuthMode = 'login' | 'register' | 'forgot' | 'newPassword';

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
  const {
    isLoginModalOpen,
    closeLoginModal,
    login,
    register,
    requestPasswordReset,
    updatePassword,
    isPasswordRecovery,
  } = useAuth();
  const toast = useToast();
  const [mode, setMode] = useState<AuthMode>('login');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  useWebModalFocusTrap(isLoginModalOpen, 'login-modal-card');

  useEffect(() => {
    if (isPasswordRecovery) setMode('newPassword');
  }, [isPasswordRecovery]);

  if (!isLoginModalOpen) return null;

  const handleSubmit = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedName = fullName.trim().replace(/\s+/g, ' ');
    setNotice(null);

    if (mode === 'newPassword') {
      if (password.length < 6) {
        toast.show({ message: 'La nueva contraseña debe tener al menos 6 caracteres.', type: 'error' });
        return;
      }
      if (password !== confirmPassword) {
        toast.show({ message: 'Las contraseñas no coinciden.', type: 'error' });
        return;
      }
      setSubmitting(true);
      try {
        await updatePassword(password);
        setPassword('');
        setConfirmPassword('');
        toast.show({ message: 'Tu contraseña fue actualizada correctamente.', type: 'success' });
      } catch (error) {
        toast.show({ message: authErrorMessage(error), type: 'error' });
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (mode === 'register' && normalizedName.length < 2) {
      toast.show({ message: 'Ingresa tu nombre completo.', type: 'error' });
      return;
    }
    if (!EMAIL_PATTERN.test(normalizedEmail)) {
      toast.show({ message: 'Ingresa un correo electrónico válido.', type: 'error' });
      return;
    }
    if (mode === 'forgot') {
      setSubmitting(true);
      try {
        await requestPasswordReset(normalizedEmail);
        setNotice('Te enviamos un enlace para cambiar tu contraseña. Revisa tu correo y la carpeta de spam.');
        setMode('login');
      } catch (error) {
        toast.show({ message: authErrorMessage(error), type: 'error' });
      } finally {
        setSubmitting(false);
      }
      return;
    }
    if (password.length < 6) {
      toast.show({ message: 'La contraseña debe tener al menos 6 caracteres.', type: 'error' });
      return;
    }
    setSubmitting(true);
    try {
      if (mode === 'register') {
        const result = await register(normalizedName, normalizedEmail, password);
        if (result.requiresEmailConfirmation) {
          setNotice('Cuenta creada. Te enviamos un correo: abre el enlace para confirmar tu cuenta y volver a Destellos de Hada.');
          toast.show({ message: 'Revisa tu correo para confirmar tu cuenta.', type: 'success' });
          setMode('login');
        } else {
          toast.show({ message: `¡Bienvenida, ${normalizedName}! Tu cuenta fue creada.`, type: 'success' });
        }
      } else {
        await login(normalizedEmail, password);
        toast.show({ message: 'Sesión iniciada correctamente.', type: 'success' });
      }
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
              {mode === 'newPassword'
                ? 'Crea una nueva contraseña para recuperar tu cuenta.'
                : 'Guarda tus favoritos, consulta tus compras y compra con tus datos protegidos.'}
            </Text>
          </View>

          <View style={styles.form}>
            {mode !== 'newPassword' && <View style={[styles.tabsRow, { borderBottomColor: theme.colors.border }]}>
              <Pressable onPress={() => setMode('login')} style={styles.tabBtn}>
                <Text style={[styles.tabText, { color: mode === 'login' || mode === 'forgot' ? theme.colors.primary : theme.colors.textSecondary }, (mode === 'login' || mode === 'forgot') && styles.tabTextActive]}>Iniciar sesión</Text>
              </Pressable>
              <Pressable onPress={() => setMode('register')} style={styles.tabBtn}>
                <Text style={[styles.tabText, { color: mode === 'register' ? theme.colors.primary : theme.colors.textSecondary }, mode === 'register' && styles.tabTextActive]}>Crear cuenta</Text>
              </Pressable>
            </View>}
            {mode === 'register' && (
              <Field
                label="Nombre completo"
                icon="user"
                value={fullName}
                onChangeText={setFullName}
                placeholder="Tu nombre y apellido"
                autoFocus
                autoCapitalize="words"
                autoComplete="name"
              />
            )}
            {mode !== 'newPassword' && <Field
              label="Correo electrónico"
              icon="mail"
              value={email}
              onChangeText={setEmail}
              placeholder="tu@email.com"
              autoFocus={mode === 'login' || mode === 'forgot'}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />}
            {mode !== 'forgot' && <Field
              label={mode === 'newPassword' ? 'Nueva contraseña' : 'Contraseña'}
              icon="lock"
              value={password}
              onChangeText={setPassword}
              placeholder="Mínimo 6 caracteres"
              secureTextEntry
              autoComplete={mode === 'newPassword' ? 'new-password' : 'current-password'}
              autoFocus={mode === 'newPassword'}
            />}
            {mode === 'newPassword' && <Field
              label="Confirmar nueva contraseña"
              icon="lock"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Repite tu nueva contraseña"
              secureTextEntry
              autoComplete="new-password"
            />}

            <View style={styles.submitWrap}>
              <Button
                label={mode === 'register'
                  ? 'Crear mi cuenta'
                  : mode === 'forgot'
                    ? 'Enviar enlace de recuperación'
                    : mode === 'newPassword'
                      ? 'Guardar nueva contraseña'
                      : 'Iniciar sesión'}
                onPress={handleSubmit}
                variant="primary"
                size="lg"
                icon="arrow-right"
                loading={submitting}
              />
            </View>

            {mode === 'login' && (
              <Pressable onPress={() => { setMode('forgot'); setNotice(null); }} style={styles.forgotButton}>
                <Text style={[styles.forgotText, { color: theme.colors.primary }]}>Olvidé mi contraseña</Text>
              </Pressable>
            )}

            {mode === 'forgot' && (
              <Pressable onPress={() => setMode('login')} style={styles.forgotButton}>
                <Text style={[styles.forgotText, { color: theme.colors.primary }]}>Volver a iniciar sesión</Text>
              </Pressable>
            )}

            {notice && (
              <View style={[styles.notice, { backgroundColor: theme.colors.lavender, borderColor: theme.colors.borderStrong }]}>
                <Feather name="mail" size={16} color={theme.colors.primary} />
                <Text style={[styles.noticeText, { color: theme.colors.text }]}>{notice}</Text>
              </View>
            )}

            <Text style={[styles.accessNote, { color: theme.colors.textSecondary }]}>
              {mode === 'register'
                ? 'Al crear tu cuenta podrás guardar favoritos y consultar el estado de tus compras.'
                : mode === 'forgot'
                  ? 'Escribe el correo con el que creaste tu cuenta.'
                  : mode === 'newPassword'
                    ? 'Después de guardar podrás continuar usando tu cuenta normalmente.'
                    : 'Accede con el correo y contraseña que utilizaste al registrarte.'}
            </Text>
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
  forgotButton: { minHeight: 36, alignItems: 'center', justifyContent: 'center' },
  forgotText: { fontSize: 12.5, fontWeight: '700' },
  notice: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, borderWidth: 1, borderRadius: 10, padding: 12 },
  noticeText: { flex: 1, fontSize: 12, lineHeight: 18 },
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
