import React, { useState } from 'react';
import { 
  StyleSheet, Text, View, TextInput, 
  TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform, Alert 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { supabase } from '../../services/supabase';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function signInWithEmail() {
    if (!email || !password) {
      Alert.alert("Campos vacíos", "Por favor ingresa tu correo y contraseña.");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: password,
    });

    if (error) {
      Alert.alert("Error al entrar", error.message);
    }
    setLoading(false);
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
        style={styles.keyboardView}
      >
        <View style={styles.content}>
          <View style={styles.iconContainer}>
            <Feather name="box" size={48} color="#7B5CF6" />
          </View>
          
          <Text style={styles.title}>Destellos de Hada</Text>
          <Text style={styles.subtitle}>Ingresa para administrar tu catálogo e inventario</Text>

          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Correo electrónico</Text>
              <TextInput
                style={styles.input}
                onChangeText={(text) => setEmail(text)}
                value={email}
                placeholder="ejemplo@correo.com"
                placeholderTextColor="#9CA3AF"
                autoCapitalize="none"
                keyboardType="email-address"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Contraseña</Text>
              <TextInput
                style={styles.input}
                onChangeText={(text) => setPassword(text)}
                value={password}
                secureTextEntry
                placeholder="********"
                placeholderTextColor="#9CA3AF"
                autoCapitalize="none"
              />
            </View>

            <TouchableOpacity 
              style={[styles.loginBtn, loading && styles.loginBtnDisabled]}
              onPress={signInWithEmail}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.loginBtnText}>Entrar</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  keyboardView: { flex: 1 },
  content: { flex: 1, justifyContent: 'center', padding: 32 },
  iconContainer: { width: 80, height: 80, backgroundColor: '#F5F3FF', borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginBottom: 24 },
  title: { fontSize: 30, fontWeight: '800', color: '#0F172A', marginBottom: 8 },
  subtitle: { fontSize: 15, color: '#64748B', marginBottom: 36, lineHeight: 22 },
  form: { width: '100%' },
  inputGroup: { marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '700', color: '#334155', marginBottom: 8 },
  input: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 16, paddingHorizontal: 16, paddingVertical: 16, fontSize: 16, color: '#0F172A' },
  loginBtn: { backgroundColor: '#7B5CF6', borderRadius: 16, paddingVertical: 18, alignItems: 'center', marginTop: 12, elevation: 2 },
  loginBtnDisabled: { backgroundColor: '#A78BFA' },
  loginBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});