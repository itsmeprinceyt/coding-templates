import type { Pool } from "pg";
import { getProduction } from "../../utils/ValueFetcher/getProduction.util";
import { getDbPool, initializeDatabase } from "./init.db";

let initializedPromise: Promise<void> | null = null;

/**
 * @brief Initializes the server's PostgreSQL database connection.
 *
 * - Ensures initialization runs only once.
 * - Handles concurrent initialization requests.
 * - Runs database migrations.
 * - Logs the environment and initialization status.
 */
export async function initServer(): Promise<void> {
  if (!initializedPromise) {
    initializedPromise = (async () => {
      console.log("[SERVER - CHECKING] Initializing PostgreSQL connection");

      await initializeDatabase();

      const isProduction = getProduction();

      console.log("[SERVER - READY] >_ Database initialized");

      console.log(
        `[SERVER - ENV] ➤ Running in ${isProduction ? "production" : "development"} mode`,
      );
    })().catch((err) => {
      initializedPromise = null;
      throw err;
    });
  }

  return initializedPromise;
}

/**
 * @brief Retrieves the initialized PostgreSQL pool.
 *
 * - Requires initServer() to have completed.
 * - Returns the reusable PostgreSQL pool.
 */
export function db(): Pool {
  return getDbPool();
}

/**
 * @brief Initializes PostgreSQL and returns the connection pool.
 *
 * @returns {Promise<Pool>} Initialized PostgreSQL pool.
 */
export async function getPool(): Promise<Pool> {
  await initServer();
  return db();
}
