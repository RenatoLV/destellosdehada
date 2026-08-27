import { useState, useEffect, useCallback } from 'react';
import { Client, getClientsLocal, createClientLocal, CreateClientInput } from '../database/clients';

export function useClients() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchClients = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getClientsLocal();
      setClients(data);
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
