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

/** v12 persists the exact hash sent to process_sale() on the local sale. */
export async function applyContractHardeningMigrations(db: SQLiteDatabase): Promise<void> {
  const result = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const currentVersion = result?.user_version ?? 0;
  if (currentVersion >= 12) return;

  await db.withTransactionAsync(async () => {
    await addColumnIfMissing(db, 'sales', 'payload_hash', 'TEXT');
    await db.execAsync('PRAGMA user_version = 12');
  });
}
