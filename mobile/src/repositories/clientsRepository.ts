import { getClientsLocal } from '../database/clients';
import { Client } from '../types/database';

export async function listClients(): Promise<Client[]> {
  return getClientsLocal();
}
