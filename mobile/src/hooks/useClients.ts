import { useState, useEffect, useCallback } from 'react';
import { Client, createClientLocal, CreateClientInput } from '../database/clients';
import { listClients } from '../repositories/clientsRepository';

export function useClients() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchClients = useCallback(async () => {
    try {
      setLoading(true);
      setClients(await listClients());
    } catch (error) {
      console.error('Error al cargar clientes:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  const addClient = async (input: CreateClientInput): Promise<Client> => {
    const newClient = await createClientLocal(input);
    await fetchClients();
    return newClient;
  };

  return {
    clients,
    loading,
    refreshClients: fetchClients,
    addClient,
  };
}
