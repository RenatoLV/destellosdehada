import { getDatabase } from '../database/sqlite';
import { supabase } from './supabase';

export interface Organization {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface Membership {
  organization_id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'seller';
  active: number;
  created_at: string;
  updated_at: string;
}

export interface ActiveOrganizationContext {
  userId: string;
  organizationId: string;
  role: Membership['role'];
}

interface RemoteMembership {
  organization_id: string;
  user_id: string;
  role: Membership['role'];
  active: boolean;
  created_at: string;
  updated_at: string;
}

interface BootstrapOrganizationResult {
  success: boolean;
  code?: string;
  organization_id?: string;
  name?: string;
  role?: Membership['role'];
}

const LOCAL_ORGANIZATION_PREFIX = 'local:';
let cachedContext: { userId: string; organization: Organization; role: Membership['role'] } | null = null;

export async function getCurrentUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.user.id) {
    throw new Error('No existe una sesión autenticada.');
  }
  return data.session.user.id;
}

async function persistOrganizationContext(
  userId: string,
  organization: Organization,
  role: Membership['role'],
): Promise<void> {
  const db = await getDatabase();
  const previousContext = await db.getFirstAsync<{ organization_id: string }>(
    `SELECT organization_id FROM local_context WHERE id = 1 AND user_id = ?`,
    [userId],
  );
  const now = new Date().toISOString();

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO organizations (id, name, created_at, updated_at, deleted_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET name = excluded.name,
       updated_at = excluded.updated_at, deleted_at = excluded.deleted_at`,
      [organization.id, organization.name, organization.created_at, organization.updated_at, organization.deleted_at],
    );
    await db.runAsync(
      `INSERT INTO memberships (organization_id, user_id, role, active, created_at, updated_at)
       VALUES (?, ?, ?, 1, ?, ?)
       ON CONFLICT(organization_id, user_id) DO UPDATE SET role = excluded.role,
       active = 1, updated_at = excluded.updated_at`,
      [organization.id, userId, role, now, now],
    );
    await db.runAsync(
      `INSERT INTO local_context (id, user_id, organization_id, updated_at)
       VALUES (1, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET user_id = excluded.user_id,
       organization_id = excluded.organization_id, updated_at = excluded.updated_at`,
      [userId, organization.id, now],
    );

    // Only migrate data created under the local compatibility organization.
    // A real organization switch must never relabel another organization's
    // rows or queue entries, otherwise pending operations from A could be
    // sent while B is the active context.
    if (previousContext
      && previousContext.organization_id !== organization.id
      && previousContext.organization_id.startsWith(LOCAL_ORGANIZATION_PREFIX)) {
      for (const table of [
        'categories', 'products', 'product_images', 'clients',
        'sales', 'inventory_movements',
      ]) {
        await db.runAsync(
          `UPDATE ${table}
           SET organization_id = ?
           WHERE organization_id = ? AND owner_id = ?`,
          [organization.id, previousContext.organization_id, userId],
        );
      }
      await db.runAsync(
        `UPDATE sale_items SET organization_id = ?
         WHERE organization_id = ?
           AND sale_id IN (SELECT id FROM sales WHERE organization_id = ?)`,
        [organization.id, previousContext.organization_id, organization.id],
      );
      // Receipts can be created while the app is using its offline
      // compatibility organization. Rebind only receipts attached to sales
      // that were safely moved above; their remote path must be regenerated
      // for the real organization before upload.
      await db.runAsync(
        `UPDATE receipts SET organization_id = ?, storage_path = NULL, updated_at = ?
         WHERE organization_id = ?
           AND sale_id IN (
             SELECT id FROM sales
             WHERE organization_id = ? AND owner_id = ?
           )`,
        [organization.id, now, previousContext.organization_id, organization.id, userId],
      );
      await db.runAsync(
        `UPDATE sync_queue SET organization_id = ?, user_id = ?
         WHERE organization_id = ?`,
        [organization.id, userId, previousContext.organization_id],
      );
    }

    // Compatibility repair for rows created by the pre-tenancy app. Only rows
    // explicitly owned by this authenticated user are associated.
    for (const table of [
      'categories', 'products', 'product_images', 'clients',
      'sales', 'inventory_movements',
    ]) {
      await db.runAsync(
        `UPDATE ${table}
         SET organization_id = ?
         WHERE organization_id IS NULL AND owner_id = ?`,
        [organization.id, userId],
      );
    }
    await db.runAsync(
      `UPDATE categories SET organization_id = ?
       WHERE id = 'cat_general' AND organization_id IS NULL`,
      [organization.id],
    );
    await db.runAsync(
      `UPDATE sales SET created_by = ?
       WHERE organization_id = ? AND created_by IS NULL`,
      [userId, organization.id],
    );
    await db.runAsync(
      `UPDATE sale_items
       SET organization_id = (
         SELECT organization_id FROM sales WHERE sales.id = sale_items.sale_id
       )
       WHERE organization_id IS NULL
         AND EXISTS (
           SELECT 1 FROM sales
           WHERE sales.id = sale_items.sale_id
             AND sales.organization_id = ?
         )`,
      [organization.id],
    );
    await db.runAsync(
      `UPDATE sync_queue
       SET organization_id = ?, user_id = ?
       WHERE organization_id IS NULL
         AND (
           (entity IN ('clients', 'products', 'categories', 'inventory_movements')
             AND entity_id IN (
               SELECT id FROM products WHERE organization_id = ?
               UNION SELECT id FROM clients WHERE organization_id = ?
               UNION SELECT id FROM categories WHERE organization_id = ?
               UNION SELECT id FROM inventory_movements WHERE organization_id = ?
             ))
           OR (entity IN ('sale_transactions', 'sales')
             AND entity_id IN (SELECT id FROM sales WHERE organization_id = ?))
         )`,
      [organization.id, userId, organization.id, organization.id, organization.id, organization.id, organization.id],
    );
  });
}

async function findRemoteOrganization(
  userId: string,
): Promise<{ organization: Organization; role: Membership['role'] } | null> {
  const { data: memberships, error: membershipsError } = await supabase
    .from('memberships')
    .select('organization_id, user_id, role, active, created_at, updated_at')
    .eq('user_id', userId)
    .eq('active', true)
    .order('created_at', { ascending: true });

  if (membershipsError || !memberships?.length) return null;

  for (const membership of memberships as RemoteMembership[]) {
    const { data: organization, error } = await supabase
      .from('organizations')
      .select('id, name, created_at, updated_at, deleted_at')
      .eq('id', membership.organization_id)
      .is('deleted_at', null)
      .maybeSingle();

    if (!error && organization) {
      return {
        organization: organization as Organization,
        role: membership.role,
      };
    }
  }

  return null;
}

async function bootstrapFirstRemoteOrganization(
  userId: string,
): Promise<{ organization: Organization; role: Membership['role'] } | null> {
  const { data, error } = await supabase.rpc('bootstrap_first_organization', {
    p_name: 'Destellos de Hada',
  });
  if (error) throw error;

  const result = data as BootstrapOrganizationResult | null;
  if (!result?.success) return null;

  // Read the organization through normal RLS after the SECURITY DEFINER RPC.
  // This proves the membership exists and avoids trusting response fields as
  // the long-lived local tenancy context.
  return findRemoteOrganization(userId);
}

export async function getCurrentOrganization(): Promise<Organization> {
  const userId = await getCurrentUserId();
  if (cachedContext?.userId === userId) return cachedContext.organization;

  const db = await getDatabase();
  const localContext = await db.getFirstAsync<{ organization_id: string }>(
    `SELECT organization_id FROM local_context WHERE id = 1 AND user_id = ?`,
    [userId],
  );

  if (localContext && !localContext.organization_id.startsWith(LOCAL_ORGANIZATION_PREFIX)) {
    const localOrganization = await db.getFirstAsync<Organization>(
      `SELECT * FROM organizations WHERE id = ? AND deleted_at IS NULL`,
      [localContext.organization_id],
    );
    if (localOrganization) {
      const membership = await db.getFirstAsync<{ role: Membership['role'] }>(
        `SELECT role FROM memberships
         WHERE organization_id = ? AND user_id = ? AND active = 1`,
        [localOrganization.id, userId],
      );
      if (membership) {
        cachedContext = { userId, organization: localOrganization, role: membership.role };
        return localOrganization;
      }
    }
  }

  try {
    const remote = await findRemoteOrganization(userId)
      ?? await bootstrapFirstRemoteOrganization(userId);
    if (remote) {
      await persistOrganizationContext(userId, remote.organization, remote.role);
      cachedContext = { userId, organization: remote.organization, role: remote.role };
      return remote.organization;
    }
  } catch {
    // Offline startup falls back to a local compatibility organization.
  }

  const fallbackId = `${LOCAL_ORGANIZATION_PREFIX}${userId}`;
  const now = new Date().toISOString();
  const fallbackOrganization: Organization = {
    id: fallbackId,
    name: 'Organización local pendiente de sincronización',
    created_at: now,
    updated_at: now,
    deleted_at: null,
  };
  await persistOrganizationContext(userId, fallbackOrganization, 'seller');
  cachedContext = { userId, organization: fallbackOrganization, role: 'seller' };
  return fallbackOrganization;
}

export async function getCurrentOrganizationId(): Promise<string> {
  return (await getCurrentOrganization()).id;
}

export async function getActiveOrganizationContext(): Promise<ActiveOrganizationContext> {
  let organization = await getCurrentOrganization();
  const userId = await getCurrentUserId();

  // A synthetic local organization permits offline compatibility, but it is
  // never a valid remote synchronization tenant. Refresh it when connectivity
  // is available so a first login can acquire its real membership later.
  if (organization.id.startsWith(LOCAL_ORGANIZATION_PREFIX)) {
    const remote = await findRemoteOrganization(userId);
    if (!remote) {
      throw new Error('El usuario no tiene una organización activa para sincronizar.');
    }
    await persistOrganizationContext(userId, remote.organization, remote.role);
    cachedContext = { userId, organization: remote.organization, role: remote.role };
    organization = remote.organization;
  }
  if (!cachedContext) {
    throw new Error('El contexto organizacional no está disponible.');
  }
  return {
    userId,
    organizationId: organization.id,
    role: cachedContext.role,
  };
}

export async function clearOrganizationContext(): Promise<void> {
  cachedContext = null;
  try {
    const db = await getDatabase();
    await db.runAsync('DELETE FROM local_context');
  } catch {
    // Logout must remain possible even if local cleanup is unavailable.
  }
}
