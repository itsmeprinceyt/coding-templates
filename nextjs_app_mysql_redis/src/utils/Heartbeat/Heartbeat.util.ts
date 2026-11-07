import { getPool } from "../../lib/Database/main.db";
import { getRedis } from "../../lib/Redis/redis.config";
import { RedisKeyService } from "../../services/RedisKey.service";
import { HeartbeatResponseDTO } from "../../types/Heartbeat.types";
import { getCurrentDateTime } from "../ValueFetcher/getDateTime.util";
import { generateULID } from "../generateULID.util";
import type { Pool } from "mysql2/promise";

/**
 * @brief Ensures the heartbeat table matches the current schema.
 *
 * @description
 * Kept in sync with the main SQL schema:
 * - `id` is VARCHAR(40) to match every other table's primary key
 * - `created_at` follows the project-wide naming convention
 * - No `service` column — this table only ever stores heartbeats
 */
async function ensureHeartbeatTable(pool: Pool): Promise<void> {
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS heartbeat (
      id VARCHAR(40) NOT NULL PRIMARY KEY,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

/**
 * @brief Performs MySQL + Redis health checks to keep connections alive.
 *
 * @description
 * - Initializes server connections
 * - Pings MySQL and ensures heartbeat table exists
 * - Inserts a heartbeat row and trims old rows (keeps last 10)
 * - Pings Redis and writes a heartbeat key with TTL
 *
 * @returns A HeartbeatResponseDTO describing success/failure.
 */
export async function runHeartbeat(): Promise<HeartbeatResponseDTO> {
  try {
    const pool = await getPool();
    const redis = getRedis();

    await pool.query("SELECT 1");

    await ensureHeartbeatTable(pool);

    const id = generateULID("HB");
    await pool.execute("INSERT INTO heartbeat (id, created_at) VALUES (?, ?)", [
      id,
      getCurrentDateTime(),
    ]);

    await pool.execute(`
      DELETE FROM heartbeat
      WHERE id NOT IN (
        SELECT id FROM (
          SELECT id FROM heartbeat
          ORDER BY created_at DESC, id DESC
          LIMIT 10
        ) AS latest
      )
    `);

    const { redis_key, redis_ttl } = RedisKeyService.heartbeat();
    await redis.ping();
    await redis.set(redis_key, new Date().toISOString(), {
      ex: redis_ttl,
    });

    return {
      success: true,
      timestamp: new Date().toISOString(),
    };
  } catch (error: unknown) {
    console.error("Heartbeat error:", error);

    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
