import fs from "fs";
import path from "path";
import type { Pool, PoolClient } from "pg";
import { setupIndexes } from "./create.index.db";
import MIGRATIONS_TABLE_SQL from "./migration.table.db";
import { getProduction } from "../../utils/ValueFetcher/getProduction.util";

/**
 * @brief Executes a PostgreSQL migration SQL file.
 *
 * - Executes the complete SQL script.
 * - Supports multiple PostgreSQL statements.
 * - Does not support DELIMITER directives.
 *
 * @param {PoolClient} client - Active PostgreSQL client.
 * @param {string} sql - PostgreSQL SQL script.
 */
async function runSqlFile(client: PoolClient, sql: string): Promise<void> {
  if (!sql.trim()) return;

  await client.query(sql);
}

/**
 * @brief Executes all pending PostgreSQL database migrations.
 *
 * Workflow:
 * 1. Resolve migration directory.
 * 2. Create directory if missing.
 * 3. Acquire PostgreSQL client.
 * 4. Initialize migration tracking table.
 * 5. Retrieve previously applied migrations.
 * 6. Discover and sort migration SQL files.
 * 7. Skip already applied migrations.
 * 8. Execute pending migration scripts.
 * 9. Record successfully applied migrations.
 * 10. Setup database indexes.
 * 11. Release PostgreSQL client.
 *
 * @param {Pool} pool - PostgreSQL connection pool.
 */
export async function runMigrations(pool: Pool): Promise<void> {
  console.log("[MIGRATION - CHECKING] Scanning for pending migrations");

  const migrationsDir = path.join(
    process.cwd(),
    "src",
    "lib",
    "Database",
    "Migrations",
  );

  if (!fs.existsSync(migrationsDir)) {
    console.warn(
      `[MIGRATION - CREATE] ➤ Directory not found: ${migrationsDir} — creating it`,
    );

    fs.mkdirSync(migrationsDir, { recursive: true });
  }

  const client = await pool.connect();

  try {
    await client.query(MIGRATIONS_TABLE_SQL);

    const result = await client.query("SELECT filename FROM migrations");

    const applied = new Set(result.rows.map((row) => row.filename));

    const files = fs
      .readdirSync(migrationsDir)
      .filter((file) => file.toLowerCase().endsWith(".sql"))
      .sort();

    let appliedCount = 0;
    let skippedCount = 0;

    for (const file of files) {
      if (applied.has(file)) {
        skippedCount++;

        console.log(`[MIGRATION - SKIP] ➤ ${file} already applied`);

        continue;
      }

      const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");

      console.log(`[MIGRATION - APPLY] >_ Applying ${file}`);

      // Each migration and its tracking entry are atomic.
      await client.query("BEGIN");

      try {
        await runSqlFile(client, sql);

        await client.query("INSERT INTO migrations (filename) VALUES ($1)", [
          file,
        ]);

        await client.query("COMMIT");

        appliedCount++;

        console.log(`[MIGRATION - APPLIED] >_ ${file}`);
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      }
    }

    if (appliedCount === 0 && skippedCount > 0) {
      console.log("[MIGRATION - SKIP] ➤ All migrations already applied");
    } else if (appliedCount === 0 && skippedCount === 0) {
      console.log("[MIGRATION - SKIP] ➤ No migration files found");
    } else {
      console.log(
        `[MIGRATION - READY] >_ Migrations processed (applied: ${appliedCount}, skipped: ${skippedCount})`,
      );
    }

    const isProduction = getProduction();

    await setupIndexes(pool, isProduction);
  } finally {
    client.release();
  }
}
