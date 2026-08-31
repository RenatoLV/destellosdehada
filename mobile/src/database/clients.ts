import * as Crypto from 'expo-crypto';
import { getDatabase } from './sqlite';
import { Client } from '../types/database';
export { Client } from '../types/database';

export interface CreateClientInput {
  name: string;
  phone?: string;
  email?: string;
  rut?: string;
  notes?: string;
}

export async function ensureClientsTable(): Promise<void> {
  const db = await getDatabase();
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS clients (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      rut TEXT,
      notes TEXT,
      owner_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      deleted_at TEXT
    );
  `);
}

export async function getClientsLocal(): Promise<Client[]> {
  await ensureClientsTable();
  const db = await getDatabase();
  return await db.getAllAsync<Client>(`
    SELECT * FROM clients 
    WHERE deleted_at IS NULL 
    ORDER BY name ASC
  `);
}

export async function createClientLocal(input: CreateClientInput): Promise<Client> {
  await ensureClientsTable();
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
    owner_id: null,
    deleted_at: null,
    created_at: now,
    updated_at: now,
  };

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO clients (id, name, phone, email, rut, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [client.id, client.name, client.phone ?? null, client.email ?? null, client.rut ?? null, client.notes ?? null, now, now]
    );

    const payload = JSON.stringify(client);
    await db.runAsync(
      `INSERT INTO sync_queue (id, operation, entity, entity_id, payload, created_at)
       VALUES (?, 'INSERT', 'clients', ?, ?, ?)`,
      [Crypto.randomUUID(), id, payload, now]
    );
  });

  return client;
}

export async function deleteClientLocal(id: string): Promise<void> {
  await ensureClientsTable();
  const db = await getDatabase();
  const now = new Date().toISOString();

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `UPDATE clients SET deleted_at = ?, updated_at = ? WHERE id = ?`,
      [now, now, id]
    );

    const payload = JSON.stringify({ id, deleted_at: now, updated_at: now });
    await db.runAsync(
      `INSERT INTO sync_queue (id, operation, entity, entity_id, payload, created_at)
       VALUES (?, 'UPDATE', 'clients', ?, ?, ?)`,
      [Crypto.randomUUID(), id, payload, now]
    );
  });
}
