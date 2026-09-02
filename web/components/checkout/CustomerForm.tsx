/**
 * components/checkout/CustomerForm.tsx
 * Paso 1 del Checkout — Formulario de datos del cliente (Nombre, Teléfono, Email, Notas).
 */
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/theme';
import { Button } from '@/components/ui/Button';
import type { CustomerData } from '@/services/saleStorage';

type Props = {
  data: CustomerData;
  onChange: (data: CustomerData) => void;
  onNext: () => void;
};

export function CustomerForm({ data, onChange, onNext }: Props) {
  const theme = useTheme();

  const updateField = (field: keyof CustomerData, value: string) => {
    onChange({ ...data, [field]: value });
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={[theme.typography.sectionTitle, { color: theme.colors.text, fontSize: 20 }]}>
          Tus datos <Text style={{ color: theme.colors.textSecondary, fontSize: 16, fontWeight: '400' }}>(opcional)</Text>
        </Text>
        <Text style={[theme.typography.body, { color: theme.colors.textSecondary, marginTop: 4 }]}>
          Para registrar la venta, emitir comprobante o agregar notas de regalo.
        </Text>
      </View>

      <View style={styles.form}>
        {/* Nombre completo */}
        <View style={styles.field}>
          <Text style={[theme.typography.label, { color: theme.colors.text, marginBottom: 6 }]}>
            Nombre completo
          </Text>
          <View style={[styles.inputBox, { borderColor: theme.colors.border, borderRadius: theme.radius.md, backgroundColor: theme.colors.surface }]}>
            <Feather name="user" size={16} color={theme.colors.textSecondary} style={{ marginRight: 10 }} />
            <TextInput
              value={data.fullName}
              onChangeText={(text) => updateField('fullName', text)}
              placeholder="Ej. María José"
              placeholderTextColor={theme.colors.textSecondary}
              style={[theme.typography.body, { flex: 1, color: theme.colors.text }]}
            />
          </View>
        </View>

        {/* Teléfono */}
        <View style={styles.field}>
          <Text style={[theme.typography.label, { color: theme.colors.text, marginBottom: 6 }]}>
            Teléfono
          </Text>
          <View style={[styles.inputBox, { borderColor: theme.colors.border, borderRadius: theme.radius.md, backgroundColor: theme.colors.surface }]}>
            <Feather name="phone" size={16} color={theme.colors.textSecondary} style={{ marginRight: 10 }} />
            <TextInput
              value={data.phone}
              onChangeText={(text) => updateField('phone', text)}
              placeholder="+56 9 1234 5678"
              keyboardType="phone-pad"
              placeholderTextColor={theme.colors.textSecondary}
              style={[theme.typography.body, { flex: 1, color: theme.colors.text }]}
            />
          </View>
        </View>

        {/* Email */}
        <View style={styles.field}>
          <Text style={[theme.typography.label, { color: theme.colors.text, marginBottom: 6 }]}>
            Email
          </Text>
          <View style={[styles.inputBox, { borderColor: theme.colors.border, borderRadius: theme.radius.md, backgroundColor: theme.colors.surface }]}>
            <Feather name="mail" size={16} color={theme.colors.textSecondary} style={{ marginRight: 10 }} />
            <TextInput
              value={data.email}
              onChangeText={(text) => updateField('email', text)}
              placeholder="mariajose@email.com"
              keyboardType="email-address"
              autoCapitalize="none"
              placeholderTextColor={theme.colors.textSecondary}
              style={[theme.typography.body, { flex: 1, color: theme.colors.text }]}
            />
          </View>
        </View>

        {/* Notas */}
        <View style={styles.field}>
          <Text style={[theme.typography.label, { color: theme.colors.text, marginBottom: 6 }]}>
            Notas o dedicatoria
          </Text>
          <View style={[styles.textAreaBox, { borderColor: theme.colors.border, borderRadius: theme.radius.md, backgroundColor: theme.colors.surface }]}>
            <TextInput
              value={data.notes}
              onChangeText={(text) => updateField('notes', text)}
              placeholder="Ej: Regalo de cumpleaños con dedicatoria especial"
              multiline
              numberOfLines={3}
              placeholderTextColor={theme.colors.textSecondary}
              style={[theme.typography.body, { flex: 1, color: theme.colors.text, textAlignVertical: 'top' }]}
            />
          </View>
        </View>
      </View>

      <View style={styles.footer}>
        <Button label="Continuar →" onPress={onNext} variant="primary" size="lg" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    maxWidth: 520,
    width: '100%',
    alignSelf: 'center',
  },
  header: {
    marginBottom: 20,
  },
  form: {
    gap: 16,
  },
  field: {
    marginBottom: 4,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    height: 48,
    paddingHorizontal: 14,
  },
  textAreaBox: {
    borderWidth: 1,
    padding: 12,
    minHeight: 84,
  },
  footer: {
    marginTop: 28,
  },
});
