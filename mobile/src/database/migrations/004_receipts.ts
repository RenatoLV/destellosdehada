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

/** v10 adds the local receipt projection. Storage paths are nullable locally
 * because the remote payment id and real organization can be unavailable
 * while a sale is offline. */
export async function applyReceiptMigrations(db: SQLiteDatabase): Promise<void> {
  const result = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const currentVersion = result?.user_version ?? 0;
  if (currentVersion >= 10) return;

  await db.withTransactionAsync(async () => {
    await addColumnIfMissing(db, 'sales', 'payment_id', 'TEXT');
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS receipts (
        id TEXT PRIMARY KEY NOT NULL,
        organization_id TEXT NOT NULL,
        sale_id TEXT NOT NULL,
        payment_id TEXT,
        local_uri TEXT NOT NULL,
        storage_path TEXT,
        mime_type TEXT NOT NULL
          CHECK (mime_type IN ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')),
        file_size INTEGER CHECK (file_size IS NULL OR (file_size > 0 AND file_size <= 10485760)),
        checksum TEXT,
        upload_status TEXT NOT NULL DEFAULT 'pending'
          CHECK (upload_status IN ('pending', 'uploading', 'uploaded', 'failed')),
        last_error TEXT,
        uploaded_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        created_by TEXT
      );

      CREATE UNIQUE INDEX IF NOT EXISTS uq_receipts_organization_sale
        ON receipts(organization_id, sale_id);
      CREATE UNIQUE INDEX IF NOT EXISTS uq_receipts_storage_path
        ON receipts(storage_path) WHERE storage_path IS NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_receipts_organization_status
        ON receipts(organization_id, upload_status, updated_at);
      CREATE INDEX IF NOT EXISTS idx_receipts_organization_sale
        ON receipts(organization_id, sale_id);

      PRAGMA user_version = 10;
    `);
  });
}
