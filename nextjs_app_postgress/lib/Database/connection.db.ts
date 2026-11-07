import { Client, Pool } from "pg";
import { getProduction } from "../../utils/ValueFetcher/getProduction.util";

const isProduction: boolean = getProduction();

export const dbName = isProduction
  ? process.env.PROD_DB_NAME!
  : process.env.LOCAL_DB_NAME!;

const dbHost = isProduction
  ? process.env.PROD_DB_HOST!
  : process.env.LOCAL_DB_HOST!;

const dbUser = isProduction
  ? process.env.PROD_DB_USER!
  : process.env.LOCAL_DB_USER!;

const dbPass = isProduction
  ? process.env.PROD_DB_PASS!
  : process.env.LOCAL_DB_PASS!;

const dbPort = isProduction
  ? parseInt(process.env.PROD_DB_PORT || "5432", 10)
  : parseInt(process.env.LOCAL_DB_PORT || "5432", 10);

/**
 * @brief Ensures that the target PostgreSQL database exists.
 *
 * - Connects to the PostgreSQL maintenance database.
 * - Checks whether the configured database exists.
 * - Creates the database if it does not exist.
 * - Closes the maintenance connection.
 */
export async function ensureDatabaseExists(): Promise<void> {
  console.log("[DB - CHECKING] Verifying database availability");

  const client = new Client({
    host: dbHost,
    user: dbUser,
    password: dbPass,
    port: dbPort,
    database: "postgres",
  });

  try {
    // Prevent unsafe database identifiers.
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(dbName)) {
      throw new Error("Invalid PostgreSQL database name.");
    }

    await client.connect();

    const result = await client.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [dbName],
    );

    if (result.rowCount === 0) {
      await client.query(`CREATE DATABASE "${dbName}"`);
      console.log(`[DB - CREATE] >_ Database '${dbName}' created`);
    } else {
      console.log(`[DB - SKIP] ➤ Database '${dbName}' already exists`);
    }
  } catch (err) {
    console.error("[DB - FAILED] Failed to connect to PostgreSQL:", err);
    throw err;
  } finally {
    await client.end().catch(() => {});
  }
}

/**
 * @brief Creates and returns a PostgreSQL connection pool.
 *
 * - Uses environment-specific PostgreSQL credentials.
 * - Supports up to 10 simultaneous connections.
 * - Queues additional connection requests.
 * - Returns a reusable PostgreSQL Pool instance.
 */
export function createPool(): Pool {
  return new Pool({
    host: dbHost,
    user: dbUser,
    password: dbPass,
    database: dbName,
    port: dbPort,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });
}
