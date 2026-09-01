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

/** v13 persists the authoritative remote fingerprint and uncertain-result state. */
export async function applyRecoveryMigrations(db: SQLiteDatabase): Promise<void> {
  const result = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const currentVersion = result?.user_version ?? 0;
  if (currentVersion >= 13) return;

  await db.withTransactionAsync(async () => {
    await addColumnIfMissing(db, 'sales', 'server_payload_hash', 'TEXT');
    await addColumnIfMissing(db, 'sales', 'recovery_state', "TEXT NOT NULL DEFAULT 'none'");
    await addColumnIfMissing(db, 'sales', 'recovery_attempts', 'INTEGER NOT NULL DEFAULT 0');
    await addColumnIfMissing(db, 'sales', 'last_recovery_at', 'TEXT');
    await db.execAsync(`
      CREATE INDEX IF NOT EXISTS idx_sales_organization_recovery
        ON sales(organization_id, recovery_state, created_at);
      PRAGMA user_version = 13;
    `);
  });
}
