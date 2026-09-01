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
 * Organization migrations are kept separate from the original v1-v4
 * migration so existing installations are upgraded incrementally.
 */
export async function applyOrganizationMigrations(db: SQLiteDatabase): Promise<void> {
  const result = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const currentVersion = result?.user_version ?? 0;

  if (currentVersion < 5) {
    await db.withTransactionAsync(async () => {
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS organizations (
          id TEXT PRIMARY KEY NOT NULL,
          name TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now')),
          deleted_at TEXT
        );

        CREATE TABLE IF NOT EXISTS memberships (
          organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
          user_id TEXT NOT NULL,
          role TEXT NOT NULL DEFAULT 'seller'
            CHECK (role IN ('owner', 'admin', 'seller')),
          active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now')),
          PRIMARY KEY (organization_id, user_id)
        );

        CREATE TABLE IF NOT EXISTS local_context (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          user_id TEXT NOT NULL,
          organization_id TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        PRAGMA user_version = 5;
      `);
    });
  }

  if (currentVersion < 6) {
    await db.withTransactionAsync(async () => {
      const organizationColumns = [
        ['categories', 'organization_id', 'TEXT'],
        ['products', 'organization_id', 'TEXT'],
        ['product_images', 'organization_id', 'TEXT'],
        ['clients', 'organization_id', 'TEXT'],
        ['sales', 'organization_id', 'TEXT'],
        ['sale_items', 'organization_id', 'TEXT'],
        ['inventory_movements', 'organization_id', 'TEXT'],
        ['sync_queue', 'organization_id', 'TEXT'],
      ] as const;

      for (const [table, column, definition] of organizationColumns) {
        await addColumnIfMissing(db, table, column, definition);
      }

      // Compatibility columns used by the current Supabase migration and
      // current sync payloads. They are not the tenancy boundary.
      await addColumnIfMissing(db, 'sales', 'owner_id', 'TEXT');
      await addColumnIfMissing(db, 'inventory_movements', 'owner_id', 'TEXT');
      await addColumnIfMissing(db, 'sales', 'created_by', 'TEXT');
      await addColumnIfMissing(db, 'sales', 'client_id', 'TEXT');
      await addColumnIfMissing(db, 'sales', 'client_name', 'TEXT');

      await db.execAsync('PRAGMA user_version = 6');
    });
  }

  if (currentVersion < 7) {
    await db.withTransactionAsync(async () => {
      await db.execAsync(`
        CREATE INDEX IF NOT EXISTS idx_organizations_updated
          ON organizations(updated_at);
        CREATE INDEX IF NOT EXISTS idx_memberships_user_active
          ON memberships(user_id, active);
        CREATE INDEX IF NOT EXISTS idx_memberships_organization_active
          ON memberships(organization_id, active);
        CREATE INDEX IF NOT EXISTS idx_categories_organization_name
          ON categories(organization_id, name);
        CREATE INDEX IF NOT EXISTS idx_products_organization_active
          ON products(organization_id, active, deleted_at);
        CREATE INDEX IF NOT EXISTS idx_products_organization_updated
          ON products(organization_id, updated_at);
        CREATE INDEX IF NOT EXISTS idx_product_images_organization_product
          ON product_images(organization_id, product_id);
        CREATE INDEX IF NOT EXISTS idx_clients_organization_name
          ON clients(organization_id, name);
        CREATE INDEX IF NOT EXISTS idx_clients_organization_updated
          ON clients(organization_id, updated_at);
        CREATE INDEX IF NOT EXISTS idx_sales_organization_created
          ON sales(organization_id, created_at);
        CREATE INDEX IF NOT EXISTS idx_sale_items_organization_sale
          ON sale_items(organization_id, sale_id);
        CREATE INDEX IF NOT EXISTS idx_inventory_organization_created
          ON inventory_movements(organization_id, created_at);
        CREATE INDEX IF NOT EXISTS idx_sync_queue_organization_ready
          ON sync_queue(organization_id, status, retry_at, attempts, created_at);

        CREATE UNIQUE INDEX IF NOT EXISTS uq_memberships_organization_user
          ON memberships(organization_id, user_id);
        CREATE TRIGGER IF NOT EXISTS trg_categories_derive_organization_insert
        AFTER INSERT ON categories
        WHEN NEW.organization_id IS NULL AND NEW.owner_id IS NOT NULL
          AND (SELECT COUNT(DISTINCT organization_id) FROM memberships
               WHERE user_id = NEW.owner_id AND active = 1) = 1
        BEGIN
          UPDATE categories SET organization_id = (
            SELECT organization_id FROM memberships
            WHERE user_id = NEW.owner_id AND active = 1 LIMIT 1
          ) WHERE id = NEW.id AND organization_id IS NULL;
        END;

        CREATE TRIGGER IF NOT EXISTS trg_categories_derive_organization_update
        AFTER UPDATE OF owner_id ON categories
        WHEN NEW.organization_id IS NULL AND NEW.owner_id IS NOT NULL
          AND (SELECT COUNT(DISTINCT organization_id) FROM memberships
               WHERE user_id = NEW.owner_id AND active = 1) = 1
        BEGIN
          UPDATE categories SET organization_id = (
            SELECT organization_id FROM memberships
            WHERE user_id = NEW.owner_id AND active = 1 LIMIT 1
          ) WHERE id = NEW.id AND organization_id IS NULL;
        END;

        CREATE TRIGGER IF NOT EXISTS trg_products_derive_organization_insert
        AFTER INSERT ON products
        WHEN NEW.organization_id IS NULL AND NEW.owner_id IS NOT NULL
          AND (SELECT COUNT(DISTINCT organization_id) FROM memberships
               WHERE user_id = NEW.owner_id AND active = 1) = 1
        BEGIN
          UPDATE products SET organization_id = (
            SELECT organization_id FROM memberships
            WHERE user_id = NEW.owner_id AND active = 1 LIMIT 1
          ) WHERE id = NEW.id AND organization_id IS NULL;
        END;

        CREATE TRIGGER IF NOT EXISTS trg_products_derive_organization_update
        AFTER UPDATE OF owner_id ON products
        WHEN NEW.organization_id IS NULL AND NEW.owner_id IS NOT NULL
          AND (SELECT COUNT(DISTINCT organization_id) FROM memberships
               WHERE user_id = NEW.owner_id AND active = 1) = 1
        BEGIN
          UPDATE products SET organization_id = (
            SELECT organization_id FROM memberships
            WHERE user_id = NEW.owner_id AND active = 1 LIMIT 1
          ) WHERE id = NEW.id AND organization_id IS NULL;
        END;

        CREATE TRIGGER IF NOT EXISTS trg_product_images_derive_organization_insert
        AFTER INSERT ON product_images
        WHEN NEW.organization_id IS NULL AND NEW.owner_id IS NOT NULL
          AND (SELECT COUNT(DISTINCT organization_id) FROM memberships
               WHERE user_id = NEW.owner_id AND active = 1) = 1
        BEGIN
          UPDATE product_images SET organization_id = (
            SELECT organization_id FROM memberships
            WHERE user_id = NEW.owner_id AND active = 1 LIMIT 1
          ) WHERE id = NEW.id AND organization_id IS NULL;
        END;

        CREATE TRIGGER IF NOT EXISTS trg_product_images_derive_organization_update
        AFTER UPDATE OF owner_id ON product_images
        WHEN NEW.organization_id IS NULL AND NEW.owner_id IS NOT NULL
          AND (SELECT COUNT(DISTINCT organization_id) FROM memberships
               WHERE user_id = NEW.owner_id AND active = 1) = 1
        BEGIN
          UPDATE product_images SET organization_id = (
            SELECT organization_id FROM memberships
            WHERE user_id = NEW.owner_id AND active = 1 LIMIT 1
          ) WHERE id = NEW.id AND organization_id IS NULL;
        END;

        CREATE TRIGGER IF NOT EXISTS trg_clients_derive_organization_insert
        AFTER INSERT ON clients
        WHEN NEW.organization_id IS NULL AND NEW.owner_id IS NOT NULL
          AND (SELECT COUNT(DISTINCT organization_id) FROM memberships
               WHERE user_id = NEW.owner_id AND active = 1) = 1
        BEGIN
          UPDATE clients SET organization_id = (
            SELECT organization_id FROM memberships
            WHERE user_id = NEW.owner_id AND active = 1 LIMIT 1
          ) WHERE id = NEW.id AND organization_id IS NULL;
        END;

        CREATE TRIGGER IF NOT EXISTS trg_clients_derive_organization_update
        AFTER UPDATE OF owner_id ON clients
        WHEN NEW.organization_id IS NULL AND NEW.owner_id IS NOT NULL
          AND (SELECT COUNT(DISTINCT organization_id) FROM memberships
               WHERE user_id = NEW.owner_id AND active = 1) = 1
        BEGIN
          UPDATE clients SET organization_id = (
            SELECT organization_id FROM memberships
            WHERE user_id = NEW.owner_id AND active = 1 LIMIT 1
          ) WHERE id = NEW.id AND organization_id IS NULL;
        END;

        CREATE TRIGGER IF NOT EXISTS trg_sales_derive_organization_insert
        AFTER INSERT ON sales
        WHEN NEW.organization_id IS NULL AND NEW.owner_id IS NOT NULL
          AND (SELECT COUNT(DISTINCT organization_id) FROM memberships
               WHERE user_id = NEW.owner_id AND active = 1) = 1
        BEGIN
          UPDATE sales SET organization_id = (
            SELECT organization_id FROM memberships
            WHERE user_id = NEW.owner_id AND active = 1 LIMIT 1
          ) WHERE id = NEW.id AND organization_id IS NULL;
        END;

        CREATE TRIGGER IF NOT EXISTS trg_sales_derive_organization_update
        AFTER UPDATE OF owner_id ON sales
        WHEN NEW.organization_id IS NULL AND NEW.owner_id IS NOT NULL
          AND (SELECT COUNT(DISTINCT organization_id) FROM memberships
               WHERE user_id = NEW.owner_id AND active = 1) = 1
        BEGIN
          UPDATE sales SET organization_id = (
            SELECT organization_id FROM memberships
            WHERE user_id = NEW.owner_id AND active = 1 LIMIT 1
          ) WHERE id = NEW.id AND organization_id IS NULL;
        END;

        CREATE TRIGGER IF NOT EXISTS trg_inventory_derive_organization_insert
        AFTER INSERT ON inventory_movements
        WHEN NEW.organization_id IS NULL AND NEW.owner_id IS NOT NULL
          AND (SELECT COUNT(DISTINCT organization_id) FROM memberships
               WHERE user_id = NEW.owner_id AND active = 1) = 1
        BEGIN
          UPDATE inventory_movements SET organization_id = (
            SELECT organization_id FROM memberships
            WHERE user_id = NEW.owner_id AND active = 1 LIMIT 1
          ) WHERE id = NEW.id AND organization_id IS NULL;
        END;

        CREATE TRIGGER IF NOT EXISTS trg_inventory_derive_organization_update
        AFTER UPDATE OF owner_id ON inventory_movements
        WHEN NEW.organization_id IS NULL AND NEW.owner_id IS NOT NULL
          AND (SELECT COUNT(DISTINCT organization_id) FROM memberships
               WHERE user_id = NEW.owner_id AND active = 1) = 1
        BEGIN
          UPDATE inventory_movements SET organization_id = (
            SELECT organization_id FROM memberships
            WHERE user_id = NEW.owner_id AND active = 1 LIMIT 1
          ) WHERE id = NEW.id AND organization_id IS NULL;
        END;

        CREATE TRIGGER IF NOT EXISTS trg_sale_items_same_organization_insert
        BEFORE INSERT ON sale_items
        WHEN NEW.organization_id IS NOT NULL AND (
          NOT EXISTS (
            SELECT 1 FROM sales
            WHERE id = NEW.sale_id AND organization_id = NEW.organization_id
          ) OR NOT EXISTS (
            SELECT 1 FROM products
            WHERE id = NEW.product_id AND organization_id = NEW.organization_id
          )
        )
        BEGIN
          SELECT RAISE(ABORT, 'sale_item_organization_mismatch');
        END;

        CREATE TRIGGER IF NOT EXISTS trg_sale_items_same_organization_update
        BEFORE UPDATE OF organization_id, sale_id, product_id ON sale_items
        WHEN NEW.organization_id IS NOT NULL AND (
          NOT EXISTS (
            SELECT 1 FROM sales
            WHERE id = NEW.sale_id AND organization_id = NEW.organization_id
          ) OR NOT EXISTS (
            SELECT 1 FROM products
            WHERE id = NEW.product_id AND organization_id = NEW.organization_id
          )
        )
        BEGIN
          SELECT RAISE(ABORT, 'sale_item_organization_mismatch');
        END;

        CREATE TRIGGER IF NOT EXISTS trg_sale_items_derive_organization_insert
        AFTER INSERT ON sale_items
        WHEN NEW.organization_id IS NULL
        BEGIN
          UPDATE sale_items
          SET organization_id = (
            SELECT organization_id FROM sales WHERE id = NEW.sale_id
          )
          WHERE id = NEW.id AND organization_id IS NULL;
        END;

        CREATE TRIGGER IF NOT EXISTS trg_sale_items_derive_organization_update
        AFTER UPDATE OF sale_id ON sale_items
        WHEN NEW.organization_id IS NULL
        BEGIN
          UPDATE sale_items
          SET organization_id = (
            SELECT organization_id FROM sales WHERE id = NEW.sale_id
          )
          WHERE id = NEW.id AND organization_id IS NULL;
        END;

        -- Safety barrier for the current Sync Engine, which still scans the
        -- queue globally. A queue item from another active context can never
        -- reach the processing state.
        CREATE TRIGGER IF NOT EXISTS trg_sync_queue_active_organization_insert
        BEFORE INSERT ON sync_queue
        WHEN NEW.organization_id IS NULL
          OR EXISTS (SELECT 1 FROM local_context WHERE id = 1
                     AND organization_id <> NEW.organization_id)
        BEGIN
          SELECT RAISE(ABORT, 'sync_queue_requires_active_organization');
        END;

        CREATE TRIGGER IF NOT EXISTS trg_sync_queue_active_organization_processing
        BEFORE UPDATE OF status ON sync_queue
        WHEN NEW.status = 'processing'
          AND EXISTS (SELECT 1 FROM local_context WHERE id = 1
                      AND (organization_id IS NULL OR organization_id <> NEW.organization_id))
        BEGIN
          SELECT RAISE(ABORT, 'sync_queue_organization_not_active');
        END;
      `);

      const duplicateSku = await db.getFirstAsync<{ duplicate: number }>(
        `SELECT 1 AS duplicate FROM products
         WHERE organization_id IS NOT NULL AND sku IS NOT NULL AND deleted_at IS NULL
         GROUP BY organization_id, sku HAVING COUNT(*) > 1 LIMIT 1`,
      );
      if (!duplicateSku) {
        await db.execAsync(`
          CREATE UNIQUE INDEX IF NOT EXISTS uq_products_organization_sku
            ON products(organization_id, sku)
            WHERE sku IS NOT NULL AND deleted_at IS NULL;
        `);
      }

      const duplicateCategory = await db.getFirstAsync<{ duplicate: number }>(
        `SELECT 1 AS duplicate FROM categories
         WHERE organization_id IS NOT NULL AND deleted_at IS NULL
         GROUP BY organization_id, name HAVING COUNT(*) > 1 LIMIT 1`,
      );
      if (!duplicateCategory) {
        await db.execAsync(`
          CREATE UNIQUE INDEX IF NOT EXISTS uq_categories_organization_name
            ON categories(organization_id, name)
            WHERE deleted_at IS NULL;
        `);
      }
      await db.execAsync('PRAGMA user_version = 7');
    });
  }

  if (currentVersion < 8) {
    await db.withTransactionAsync(async () => {
      await addColumnIfMissing(db, 'sales', 'status', "TEXT NOT NULL DEFAULT 'pending'");
      await addColumnIfMissing(db, 'sales', 'sync_error', 'TEXT');
      await addColumnIfMissing(db, 'sales', 'confirmed_at', 'TEXT');
      await addColumnIfMissing(db, 'sales', 'rejected_at', 'TEXT');
      await addColumnIfMissing(db, 'sales', 'conflict_code', 'TEXT');
      await db.execAsync(`
        CREATE INDEX IF NOT EXISTS idx_sales_organization_status
          ON sales(organization_id, status, created_at);
        PRAGMA user_version = 8;
      `);
    });
  }
}
