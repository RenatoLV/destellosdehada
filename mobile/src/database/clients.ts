import * as Crypto from 'expo-crypto';
import { getDatabase } from './sqlite';
import { Client } from '../types/database';
import { getCurrentOrganizationId, getCurrentUserId } from '../services/organizationContext';
export { Client } from '../types/database';

export interface CreateClientInput {
  name: string;
  phone?: string;
  email?: string;
  rut?: string;
  notes?: string;
}

export async function getClientsLocal(): Promise<Client[]> {
  const organizationId = await getCurrentOrganizationId();
  const db = await getDatabase();
  return await db.getAllAsync<Client>(`
    SELECT * FROM clients 
    WHERE organization_id = ? AND deleted_at IS NULL
    ORDER BY name ASC
  `, [organizationId]);
}

export async function createClientLocal(input: CreateClientInput): Promise<Client> {
  const organizationId = await getCurrentOrganizationId();
  const userId = await getCurrentUserId();
  const db = await getDatabase();
  const id = Crypto.randomUUID();
  const now = new Date().toISOString();

  const client: Client = {
    id,
    name: input.name.trim(),
    phone: input.phone?.trim() || null,
    email: input.email?.trim() || null,
    rut: input.rut?.trim() || null,
    notes: input.notes?.trim() || null,
    organization_id: organizationId,
    owner_id: userId,
    deleted_at: null,
    created_at: now,
    updated_at: now,
  };

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO clients (id, organization_id, owner_id, name, phone, email, rut, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [client.id, organizationId, userId, client.name, client.phone ?? null, client.email ?? null,
        client.rut ?? null, client.notes ?? null, now, now]
    );

    const payload = JSON.stringify(client);
    await db.runAsync(
      `INSERT INTO sync_queue
       (id, organization_id, user_id, operation, entity, entity_id, payload, idempotency_key, created_at)
       VALUES (?, ?, ?, 'INSERT', 'clients', ?, ?, NULL, ?)`,
      [Crypto.randomUUID(), organizationId, userId, id, payload, now]
    );
  });

  return client;
}

export async function deleteClientLocal(id: string): Promise<void> {
  const organizationId = await getCurrentOrganizationId();
  const userId = await getCurrentUserId();
  const db = await getDatabase();
  const now = new Date().toISOString();

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `UPDATE clients SET deleted_at = ?, updated_at = ?
       WHERE id = ? AND organization_id = ?`,
      [now, now, id, organizationId]
    );

    const payload = JSON.stringify({ id, organization_id: organizationId, deleted_at: now, updated_at: now });
    await db.runAsync(
      `INSERT INTO sync_queue
       (id, organization_id, user_id, operation, entity, entity_id, payload, idempotency_key, created_at)
       VALUES (?, ?, ?, 'UPDATE', 'clients', ?, ?, NULL, ?)`,
      [Crypto.randomUUID(), organizationId, userId, id, payload, now]
    );
  });
}
