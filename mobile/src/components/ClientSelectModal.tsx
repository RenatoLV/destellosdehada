import React, { useState } from 'react';
import { 
  StyleSheet, Text, View, Modal, TouchableOpacity, 
  TextInput, ScrollView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform 
} from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useClients } from '../hooks/useClients';
import { Client } from '../database/clients';

interface Props {
  visible: boolean;
  selectedClient: Client | null;
  onSelectClient: (client: Client | null) => void;
  onClose: () => void;
}

export function ClientSelectModal({ visible, selectedClient, onSelectClient, onClose }: Props) {
  const { clients, loading, addClient } = useClients();
  const [busqueda, setBusqueda] = useState('');
  const [modoCrear, setModoCrear] = useState(false);

  // Formulario nuevo cliente
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [rut, setRut] = useState('');
  const [email, setEmail] = useState('');
  const [guardando, setGuardando] = useState(false);

  const clientesFiltrados = clients.filter(c => {
    const q = busqueda.toLowerCase();
    return (c.name || '').toLowerCase().includes(q) ||
           (c.phone || '').toLowerCase().includes(q) ||
           (c.rut || '').toLowerCase().includes(q);
  });

  const handleCrearCliente = async () => {
    if (!nombre.trim()) {
      Alert.alert('Campo requerido', 'Por favor ingresa el nombre del cliente.');
      return;
    }

    try {
      setGuardando(true);
      const nuevo = await addClient({
        name: nombre.trim(),
        phone: telefono.trim() || undefined,
        rut: rut.trim() || undefined,
        email: email.trim() || undefined,
      });

      // Reset y selección
      setNombre('');
      setTelefono('');
      setRut('');
      setEmail('');
      setModoCrear(false);
      onSelectClient(nuevo);
      onClose();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'No se pudo guardar el cliente.');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <View style={styles.modalContent}>
          {/* Header del Modal */}
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>
                {modoCrear ? 'Nuevo Cliente ✨' : 'Gestionar Cliente 👤'}
              </Text>
              <Text style={styles.subtitle}>
                {modoCrear 
                  ? 'Registra datos para asociar esta venta' 
                  : 'Selecciona un cliente o continúa como venta anónima'}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Feather name="x" size={20} color="#64748B" />
            </TouchableOpacity>
          </View>

          {modoCrear ? (
            /* FORMULARIO CREAR CLIENTE */
            <ScrollView style={styles.formScroll} keyboardShouldPersistTaps="handled">
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Nombre completo *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ej. María González"
                  placeholderTextColor="#94A3B8"
                  value={nombre}
                  onChangeText={setNombre}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Teléfono / WhatsApp</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ej. +56 9 1234 5678"
                  placeholderTextColor="#94A3B8"
                  value={telefono}
                  onChangeText={setTelefono}
                  keyboardType="phone-pad"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>RUT / DNI (Opcional)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ej. 12.345.678-9"
                  placeholderTextColor="#94A3B8"
                  value={rut}
                  onChangeText={setRut}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Correo electrónico (Opcional)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="ejemplo@correo.com"
                  placeholderTextColor="#94A3B8"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.createActionsRow}>
                <TouchableOpacity 
                  style={styles.cancelBtn} 
                  onPress={() => setModoCrear(false)}
                >
                  <Text style={styles.cancelBtnText}>Volver a lista</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.saveBtn, guardando && { opacity: 0.7 }]} 
                  onPress={handleCrearCliente}
                  disabled={guardando}
                >
                  {guardando ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={styles.saveBtnText}>Guardar y Asignar</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          ) : (
            /* LISTA Y SELECCIÓN DE CLIENTES */
            <View style={styles.listWrapper}>
              {/* Opción Venta Rápida (Sin Cliente) */}
              <TouchableOpacity 
                style={[styles.anonymousCard, !selectedClient && styles.anonymousCardActive]}
                onPress={() => {
                  onSelectClient(null);
                  onClose();
                }}
                activeOpacity={0.75}
              >
                <View style={styles.anonIconBox}>
                  <Feather name="zap" size={18} color="#7B5CF6" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.anonTitle}>Venta Rápida (Sin Cliente)</Text>
                  <Text style={styles.anonSub}>No asociar a ningún cliente específico</Text>
                </View>
                {!selectedClient && (
                  <Ionicons name="checkmark-circle" size={20} color="#7B5CF6" />
                )}
              </TouchableOpacity>

              {/* Buscador */}
              <View style={styles.searchBox}>
                <Feather name="search" size={16} color="#94A3B8" style={{ marginRight: 8 }} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Buscar cliente por nombre o teléfono..."
                  placeholderTextColor="#94A3B8"
                  value={busqueda}
                  onChangeText={setBusqueda}
                />
                {busqueda.length > 0 && (
                  <TouchableOpacity onPress={() => setBusqueda('')}>
                    <Feather name="x" size={14} color="#94A3B8" />
                  </TouchableOpacity>
                )}
              </View>

              {/* Botón para crear cliente */}
              <TouchableOpacity 
                style={styles.newClientBtn}
                onPress={() => setModoCrear(true)}
                activeOpacity={0.8}
              >
                <Feather name="user-plus" size={16} color="#7B5CF6" style={{ marginRight: 8 }} />
                <Text style={styles.newClientBtnText}>+ Registrar nuevo cliente</Text>
              </TouchableOpacity>

              {/* Lista de clientes */}
              {loading ? (
                <View style={styles.centerBox}>
                  <ActivityIndicator color="#7B5CF6" />
                </View>
              ) : clientesFiltrados.length === 0 ? (
                <View style={styles.emptyClientsBox}>
                  <Feather name="users" size={28} color="#CBD5E1" />
                  <Text style={styles.emptyClientsText}>
                    {busqueda ? 'No hay clientes que coincidan' : 'No tienes clientes registrados'}
                  </Text>
                </View>
              ) : (
                <ScrollView style={styles.clientsScroll} showsVerticalScrollIndicator={false}>
                  {clientesFiltrados.map((c) => {
                    const isSelected = selectedClient?.id === c.id;
                    return (
                      <TouchableOpacity
                        key={c.id}
                        style={[styles.clientCard, isSelected && styles.clientCardActive]}
                        onPress={() => {
                          onSelectClient(c);
                          onClose();
                        }}
                        activeOpacity={0.7}
                      >
                        <View style={styles.clientAvatar}>
                          <Text style={styles.clientInitial}>{c.name.charAt(0).toUpperCase()}</Text>
                        </View>
                        <View style={styles.clientInfo}>
                          <Text style={styles.clientName}>{c.name}</Text>
                          {c.phone ? (
                            <Text style={styles.clientPhone}>📞 {c.phone}</Text>
                          ) : c.rut ? (
                            <Text style={styles.clientPhone}>ID: {c.rut}</Text>
                          ) : null}
                        </View>
                        {isSelected && (
                          <Ionicons name="checkmark-circle" size={22} color="#10B981" />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 20,
    maxHeight: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: { fontSize: 20, fontWeight: '900', color: '#0F172A' },
  subtitle: { fontSize: 12, color: '#64748B', marginTop: 2, fontWeight: '500' },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  listWrapper: {
    maxHeight: 480,
  },
  anonymousCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
  },
  anonymousCardActive: {
    backgroundColor: '#F5F3FF',
    borderColor: '#DDD6FE',
  },
  anonIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#EDE9FE',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  anonTitle: { fontSize: 14, fontWeight: '800', color: '#0F172A' },
  anonSub: { fontSize: 11, color: '#64748B', marginTop: 1 },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 10,
  },
  searchInput: { flex: 1, fontSize: 13, color: '#0F172A' },
  newClientBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FAF5FF',
    borderWidth: 1,
    borderColor: '#E9D5FF',
    borderRadius: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  newClientBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#7B5CF6',
  },
  clientsScroll: {
    maxHeight: 280,
  },
  clientCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F1F5F9',
    marginBottom: 8,
  },
  clientCardActive: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  clientAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EDE9FE',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  clientInitial: {
    fontSize: 14,
    fontWeight: '800',
    color: '#7B5CF6',
  },
  clientInfo: { flex: 1 },
  clientName: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  clientPhone: { fontSize: 11, color: '#64748B', marginTop: 1 },
  centerBox: { padding: 30, alignItems: 'center' },
  emptyClientsBox: { padding: 24, alignItems: 'center' },
  emptyClientsText: { fontSize: 13, color: '#94A3B8', marginTop: 8 },
  formScroll: {
    maxHeight: 460,
  },
  inputGroup: { marginBottom: 12 },
  label: { fontSize: 13, fontWeight: '700', color: '#334155', marginBottom: 6 },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0F172A',
  },
  createActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
    marginBottom: 16,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
  saveBtn: {
    flex: 1.5,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#7B5CF6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
