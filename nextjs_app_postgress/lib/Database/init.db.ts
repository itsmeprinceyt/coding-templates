import type { Pool } from "pg";
import { ensureDatabaseExists, createPool } from "./connection.db";
import { runMigrations } from "./migration.runner.db";

let poolInstance: Pool | null = null;

/**
 * @brief Initializes PostgreSQL connection and migrations.
 *
 * - Ensures the target database exists.
 * - Creates the PostgreSQL connection pool.
 * - Runs pending migrations.
 * - Caches the pool instance.
 */
export const initializeDatabase = async (): Promise<Pool> => {
  if (poolInstance) return poolInstance;

  await ensureDatabaseExists();

  const pool = createPool();

  try {
    await runMigrations(pool);

    poolInstance = pool;

    return poolInstance;
  } catch (err) {
    await pool.end();
    throw err;
  }
};

/**
 * @brief Retrieves the initialized PostgreSQL connection pool.
 *
 * @returns {Pool} Active PostgreSQL pool.
 */
export const getDbPool = (): Pool => {
  if (!poolInstance) {
    throw new Error("[ERROR] Database not initialized yet.");
  }

  return poolInstance;
};
