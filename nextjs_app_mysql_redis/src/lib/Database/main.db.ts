import { Pool } from "mysql2/promise";
import { getProduction } from "../../utils/ValueFetcher/getProduction.util";
import { getDbPool, initializeDatabase } from "./init.db";

let initializedPromise: Promise<void> | null = null;

/**
 * @brief Initializes the server by setting up the database connection and running any necessary migrations.
 * - Ensures that initialization is only performed **once** per application lifecycle.
 * - Stores the initialization promise so concurrent calls will wait for the same process.
 */
export async function initServer() {
  if (!initializedPromise) {
    initializedPromise = (async () => {
      console.log("[SERVER - CHECKING] Initializing database connection");
      await initializeDatabase();
      const isProduction: boolean = getProduction();
      console.log(`[SERVER - READY] >_ Database initialized`);
      console.log(
        `[SERVER - ENV] ➤ Running in ${isProduction ? "production" : "development"} mode`,
      );
    })();
  }
  return initializedPromise;
}

/**
 * @brief Retrieves the current database connection pool.
 * - Assumes `initServer()` has been called before use, so the pool is already initialized.
 * - Provides a reusable connection pool for queries throughout the application.
 */
export function db() {
  return getDbPool();
}

export async function getPool(): Promise<Pool> {
  let pool: Pool | null = null;
  if (!pool) {
    await initServer();
    pool = db();
  }
  return pool;
}
