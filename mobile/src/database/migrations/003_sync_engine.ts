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

/**
 * v9 makes synchronization durable and auditable without changing the
 * remote schema. Legacy queue rows are preserved and new rows are guarded by
 * the active local organization context.
 */
export async function applySyncEngineMigrations(db: SQLiteDatabase): Promise<void> {
  const result = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const currentVersion = result?.user_version ?? 0;

  if (currentVersion < 9) {
    await db.withTransactionAsync(async () => {
      await addColumnIfMissing(db, 'sales', 'idempotency_key', 'TEXT');
      await addColumnIfMissing(db, 'sales', 'conflict_message', 'TEXT');
      await addColumnIfMissing(db, 'products', 'remote_stock', 'INTEGER');
      await addColumnIfMissing(db, 'products', 'pending_stock_delta', 'INTEGER NOT NULL DEFAULT 0');
      await addColumnIfMissing(db, 'products', 'stock_version', 'INTEGER NOT NULL DEFAULT 0');

      // The v1-v4 queue CHECK constraint did not include `blocked`. Rebuild it
      // once, preserving every legacy row and all existing timestamps.
      await db.execAsync(`
        DROP TRIGGER IF EXISTS trg_sync_queue_active_organization_insert;
        DROP TRIGGER IF EXISTS trg_sync_queue_active_organization_processing;

        CREATE TABLE sync_queue_v9 (
          id TEXT PRIMARY KEY NOT NULL,
          organization_id TEXT,
          user_id TEXT,
          operation TEXT NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
          entity TEXT NOT NULL,
          entity_id TEXT NOT NULL,
          payload TEXT NOT NULL,
          idempotency_key TEXT,
          depends_on TEXT,
          created_at TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending'
            CHECK (status IN ('pending', 'processing', 'synced', 'failed', 'blocked')),
          attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
          last_error TEXT,
          retry_at TEXT,
          next_attempt_at TEXT,
          processing_started_at TEXT,
          processed_at TEXT,
          updated_at TEXT
        );

        INSERT INTO sync_queue_v9
          (id, organization_id, operation, entity, entity_id, payload, created_at,
           status, attempts, last_error, retry_at, processed_at, updated_at)
        SELECT id, organization_id, operation, entity, entity_id, payload, created_at,
               status, attempts, last_error, retry_at, processed_at, updated_at
        FROM sync_queue;

        DROP TABLE sync_queue;
        ALTER TABLE sync_queue_v9 RENAME TO sync_queue;

        UPDATE sales SET idempotency_key = id WHERE idempotency_key IS NULL;
        UPDATE products SET remote_stock = stock WHERE remote_stock IS NULL;
        UPDATE sync_queue SET next_attempt_at = retry_at WHERE retry_at IS NOT NULL;
        UPDATE sync_queue
        SET user_id = (
          SELECT user_id FROM local_context WHERE id = 1
            AND local_context.organization_id = sync_queue.organization_id
        )
        WHERE user_id IS NULL AND organization_id IS NOT NULL;

        CREATE TABLE IF NOT EXISTS sync_lock (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          owner TEXT NOT NULL,
          acquired_at TEXT NOT NULL,
          heartbeat_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS sync_cursors (
          organization_id TEXT NOT NULL,
          entity TEXT NOT NULL,
          cursor TEXT,
          updated_at TEXT NOT NULL,
          PRIMARY KEY (organization_id, entity)
        );

        CREATE TABLE IF NOT EXISTS sync_conflicts (
          id TEXT PRIMARY KEY NOT NULL,
          organization_id TEXT NOT NULL,
          entity TEXT NOT NULL,
          entity_id TEXT NOT NULL,
          local_queue_id TEXT,
          remote_payload TEXT NOT NULL,
          conflict_code TEXT NOT NULL,
          message TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'open'
            CHECK (status IN ('open', 'resolved', 'dismissed')),
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_sync_queue_org_ready
          ON sync_queue(organization_id, status, retry_at, attempts, created_at);
        CREATE INDEX IF NOT EXISTS idx_sync_queue_processing
          ON sync_queue(organization_id, status, processing_started_at);
        CREATE INDEX IF NOT EXISTS idx_sync_cursors_org
          ON sync_cursors(organization_id, entity);
        CREATE INDEX IF NOT EXISTS idx_sync_conflicts_org_status
          ON sync_conflicts(organization_id, status, updated_at);
        CREATE UNIQUE INDEX IF NOT EXISTS uq_sales_organization_idempotency
          ON sales(organization_id, idempotency_key)
          WHERE organization_id IS NOT NULL AND idempotency_key IS NOT NULL;

        CREATE TRIGGER trg_sync_queue_context_insert
        BEFORE INSERT ON sync_queue
        WHEN NEW.organization_id IS NULL
          OR NEW.user_id IS NULL
          OR NEW.entity = ''
          OR NEW.entity_id = ''
          OR NEW.operation = ''
          OR NEW.payload = ''
          OR NOT EXISTS (
            SELECT 1 FROM local_context
            WHERE id = 1 AND user_id = NEW.user_id
              AND organization_id = NEW.organization_id
          )
          OR (NEW.entity = 'sale_transactions'
              AND (NEW.idempotency_key IS NULL OR NEW.idempotency_key = ''))
        BEGIN
          SELECT RAISE(ABORT, 'sync_queue_context_required');
        END;

        CREATE TRIGGER trg_sync_queue_context_processing
        BEFORE UPDATE OF status ON sync_queue
        WHEN NEW.status = 'processing'
          AND NOT EXISTS (
            SELECT 1 FROM local_context
            WHERE id = 1 AND user_id = NEW.user_id
              AND organization_id = NEW.organization_id
          )
        BEGIN
          SELECT RAISE(ABORT, 'sync_queue_organization_not_active');
        END;
      `);
      await db.execAsync('PRAGMA user_version = 9');
    });
  }
}
