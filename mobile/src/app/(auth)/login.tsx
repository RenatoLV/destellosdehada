import React, { useState } from 'react';
import { 
  StyleSheet, Text, View, TextInput, 
  TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform, Alert, ScrollView 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, Ionicons } from '@expo/vector-icons';
import { supabase } from '../../services/supabase';
import { useRouter } from 'expo-router';

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function signInWithEmail() {
    if (!email || !password) {
      Alert.alert("Campos requeridos", "Por favor ingresa tu correo y contraseña.");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: password,
    });

    if (error) {
      let errorMsg = error.message;
      if (errorMsg === "Invalid login credentials" || errorMsg.includes("credentials")) {
        errorMsg = "Correo o contraseña incorrectos. Por favor, revisa tus datos e intenta nuevamente.";
      }
      Alert.alert("Error de inicio de sesión", errorMsg);
    }
    setLoading(false);
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
        style={styles.keyboardView}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          {/* Logo & Marca */}
          <View style={styles.header}>
            <View style={styles.logoCircle}>
              <Ionicons name="sparkles" size={42} color="#7B5CF6" />
            </View>
            <Text style={styles.title}>Destellos de Hada</Text>
            <Text style={styles.subtitle}>Gestión de Joyería e Inventario Offline-First</Text>
          </View>

          {/* Formulario */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Iniciar Sesión</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Correo electrónico</Text>
              <View style={styles.inputWrapper}>
                <Feather name="mail" size={18} color="#94A3B8" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  onChangeText={setEmail}
                  value={email}
                  placeholder="ejemplo@correo.com"
                  placeholderTextColor="#94A3B8"
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Contraseña</Text>
              <View style={styles.inputWrapper}>
                <Feather name="lock" size={18} color="#94A3B8" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  onChangeText={setPassword}
                  value={password}
                  secureTextEntry={!showPassword}
                  placeholder="••••••••"
                  placeholderTextColor="#94A3B8"
                  autoCapitalize="none"
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                  <Feather name={showPassword ? "eye-off" : "eye"} size={18} color="#94A3B8" />
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity 
              style={[styles.loginBtn, loading && styles.loginBtnDisabled]}
              onPress={signInWithEmail}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <View style={styles.btnRow}>
                  <Text style={styles.loginBtnText}>Ingresar al Sistema</Text>
                  <Feather name="arrow-right" size={18} color="#FFFFFF" style={{ marginLeft: 8 }} />
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* Footer Informativo */}
          <View style={styles.footerNote}>
            <View style={styles.offlinePill}>
              <Feather name="shield" size={13} color="#059669" style={{ marginRight: 6 }} />
              <Text style={styles.offlinePillText}>Sincronizado con Supabase • Respaldado localmente</Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  keyboardView: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: 'center', padding: 20 },
  header: { alignItems: 'center', marginBottom: 28 },
  logoCircle: { 
    width: 80, 
    height: 80, 
    backgroundColor: '#F5F3FF', 
    borderRadius: 24, 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#EDE9FE',
    boxShadow: '0px 4px 8px rgba(62, 31, 92, 0.12)',
    elevation: 3,
  },
  title: { fontSize: 26, fontWeight: '900', color: '#0F172A', letterSpacing: -0.5, marginBottom: 4 },
  subtitle: { fontSize: 13, color: '#64748B', textAlign: 'center', fontWeight: '500' },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    boxShadow: '0px 2px 6px rgba(36, 21, 54, 0.04)',
    elevation: 2,
  },
  cardTitle: { fontSize: 18, fontWeight: '800', color: '#0F172A', marginBottom: 20 },
  inputGroup: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '700', color: '#334155', marginBottom: 8 },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 52,
  },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, fontSize: 15, color: '#0F172A' },
  eyeBtn: { padding: 6 },
  loginBtn: { 
    backgroundColor: '#7B5CF6', 
    borderRadius: 14, 
    height: 52, 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginTop: 10,
    boxShadow: '0px 3px 5px rgba(62, 31, 92, 0.25)',
    elevation: 3,
  },
  loginBtnDisabled: { backgroundColor: '#A78BFA' },
  btnRow: { flexDirection: 'row', alignItems: 'center' },
  loginBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  footerNote: { alignItems: 'center', marginTop: 24 },
  offlinePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  offlinePillText: { fontSize: 11, fontWeight: '600', color: '#065F46' },
});
