import { SQLiteDatabase } from 'expo-sqlite';

async function addColumnIfMissing(
  db: SQLiteDatabase,
  table: string,
  column: string,
  definition: string,
): Promise<void> {
  const columns = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`);
  if (!columns.some(currentColumn => currentColumn.name === column)) {
    await db.execAsync(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

/** v11 stores the local payment intent as part of the same offline sale
 * transaction. It is a projection only; the remote payment is still created
 * by process_sale() and linked through remote_id after synchronization. */
export async function applyPaymentProjectionMigrations(db: SQLiteDatabase): Promise<void> {
  const result = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const currentVersion = result?.user_version ?? 0;
  if (currentVersion >= 11) return;

  await db.withTransactionAsync(async () => {
    await addColumnIfMissing(db, 'sales', 'local_payment_id', 'TEXT');
    await addColumnIfMissing(db, 'receipts', 'local_payment_id', 'TEXT');
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS payments (
        id TEXT PRIMARY KEY NOT NULL,
        organization_id TEXT NOT NULL,
        sale_id TEXT NOT NULL REFERENCES sales(id) ON DELETE RESTRICT,
        remote_id TEXT,
        method TEXT NOT NULL CHECK (method = 'transfer'),
        status TEXT NOT NULL DEFAULT 'pending'
          CHECK (status IN ('pending', 'confirmed', 'rejected')),
        amount INTEGER NOT NULL CHECK (amount >= 0),
        reference TEXT,
        created_at TEXT NOT NULL,
        confirmed_at TEXT,
        UNIQUE (organization_id, sale_id),
        UNIQUE (organization_id, remote_id)
      );

      CREATE INDEX IF NOT EXISTS idx_payments_organization_status
        ON payments(organization_id, status, created_at);
      CREATE INDEX IF NOT EXISTS idx_payments_organization_sale
        ON payments(organization_id, sale_id);
    `);

    await db.runAsync(
      `INSERT OR IGNORE INTO payments
       (id, organization_id, sale_id, remote_id, method, status, amount, reference, created_at, confirmed_at)
       SELECT 'legacy-payment-' || s.id, s.organization_id, s.id, s.payment_id,
              'transfer', CASE WHEN s.status = 'confirmed' THEN 'confirmed' ELSE 'pending' END,
              s.total, NULL, s.created_at, s.confirmed_at
       FROM sales s
       WHERE s.organization_id IS NOT NULL
         AND NOT EXISTS (
           SELECT 1 FROM payments p
           WHERE p.organization_id = s.organization_id AND p.sale_id = s.id
         )`,
    );
    await db.runAsync(
      `UPDATE sales SET local_payment_id = (
         SELECT id FROM payments WHERE payments.organization_id = sales.organization_id
           AND payments.sale_id = sales.id
       ) WHERE local_payment_id IS NULL`,
    );
    await db.runAsync(
      `UPDATE receipts SET local_payment_id = (
         SELECT local_payment_id FROM sales WHERE sales.organization_id = receipts.organization_id
           AND sales.id = receipts.sale_id
       ) WHERE local_payment_id IS NULL`,
    );
    await db.execAsync('PRAGMA user_version = 11');
  });
}
