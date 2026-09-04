import { getSalesLocal } from '../database/sales';
import { getCurrentOrganizationId } from '../services/organizationContext';
import { supabase } from '../services/supabase';
import { SaleSummary } from '../types/database';

export async function listSales(): Promise<SaleSummary[]> {
  const localSales = await getSalesLocal();
  try {
    const organizationId = await getCurrentOrganizationId();
    const { data, error } = await supabase
      .from('sales')
      .select('id, organization_id, created_by, owner_id, discount, total, notes, client_id, client_name, status, idempotency_key, payload_hash, server_payload_hash, confirmed_at, rejected_at, conflict_code, conflict_message, created_at')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const remoteSales: SaleSummary[] = (data ?? []).map((row) => ({
      id: row.id,
      organization_id: row.organization_id,
      created_by: row.created_by,
      owner_id: row.owner_id ?? null,
      discount: Number(row.discount ?? 0),
      total: Number(row.total ?? 0),
      notes: row.notes ?? null,
      client_id: row.client_id ?? null,
      client_name: row.client_name ?? null,
      status: row.status,
      idempotency_key: row.idempotency_key ?? row.id,
      payload_hash: row.payload_hash ?? null,
      server_payload_hash: row.server_payload_hash ?? null,
      confirmed_at: row.confirmed_at ?? null,
      rejected_at: row.rejected_at ?? null,
      conflict_code: row.conflict_code ?? null,
      conflict_message: row.conflict_message ?? null,
      created_at: row.created_at,
      first_product_name: 'Venta web',
      total_items: 0,
      sync_status: 'synced',
    }));

    // La fila local conserva prioridad cuando todavía está pendiente de
    // sincronización; las ventas web confirmadas aparecen desde Supabase.
    const merged = new Map<string, SaleSummary>();
    [...remoteSales, ...localSales].forEach((sale) => merged.set(sale.id, sale));
    return [...merged.values()].sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  } catch (error) {
    // El historial sigue funcionando offline con la proyección local.
    console.warn('No fue posible consultar ventas remotas; usando SQLite.', error);
    return localSales;
  }
}

export async function approvePublicSale(saleId: string): Promise<void> {
  const organizationId = await getCurrentOrganizationId();
  const { data, error } = await supabase.rpc('approve_public_order', {
    p_organization_id: organizationId,
    p_sale_id: saleId,
  });
  if (error) throw error;
  const result = data as { success?: boolean; code?: string } | null;
  if (!result?.success) throw new Error(result?.code ?? 'No fue posible aprobar el pedido web.');
}
