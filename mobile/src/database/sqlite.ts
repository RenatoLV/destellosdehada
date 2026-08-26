import * as SQLite from 'expo-sqlite';
import { applyMigrations } from './migrations/001_initial';

let dbInstance: SQLite.SQLiteDatabase | null = null;
let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (dbInstance) return dbInstance;

  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync('mi_inventario_v2.db');
      await applyMigrations(db);
      dbInstance = db;
      return db;
    })();
  }

  return dbPromise;
}