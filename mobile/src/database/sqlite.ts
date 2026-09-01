import * as SQLite from 'expo-sqlite';
import { applyMigrations } from './migrations/001_initial';
import { applyOrganizationMigrations } from './migrations/002_organization';
import { applySyncEngineMigrations } from './migrations/003_sync_engine';
import { applyReceiptMigrations } from './migrations/004_receipts';
import { applyPaymentProjectionMigrations } from './migrations/005_payments';
import { applyContractHardeningMigrations } from './migrations/006_contract_hardening';
import { applyRecoveryMigrations } from './migrations/007_recovery';

let dbInstance: SQLite.SQLiteDatabase | null = null;
let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (dbInstance) return dbInstance;

  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync('mi_inventario_v2.db');
      await applyMigrations(db);
      await applyOrganizationMigrations(db);
      await applySyncEngineMigrations(db);
      await applyReceiptMigrations(db);
      await applyPaymentProjectionMigrations(db);
      await applyContractHardeningMigrations(db);
      await applyRecoveryMigrations(db);
      dbInstance = db;
      return db;
    })();
  }

  return dbPromise;
}
