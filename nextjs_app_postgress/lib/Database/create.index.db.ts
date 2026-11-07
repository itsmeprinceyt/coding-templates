import type { Pool } from "pg";
import { createIndexStatements, dropIndexStatements } from "./Index/Indexing";
import { getProduction } from "../../utils/ValueFetcher/getProduction.util";

const manualSkipIndexing: boolean = true;

/**
 * @brief Checks whether an index exists in the current PostgreSQL database.
 * @param {Pool} connection - PostgreSQL connection pool.
 * @param {string} tableName - Target table name.
 * @param {string} indexName - Target index name.
 * @returns {Promise<boolean>} Whether the index exists.
 */
async function indexExists(
  connection: Pool,
  tableName: string,
  indexName: string,
): Promise<boolean> {
  const result = await connection.query(
    `SELECT EXISTS (
      SELECT 1
      FROM pg_indexes
      WHERE schemaname = current_schema()
      AND tablename = $1
      AND indexname = $2
    ) AS exists`,
    [tableName, indexName],
  );

  return result.rows[0].exists;
}

/**
 * @brief Logs indexes that have recorded zero scans.
 *
 * - Uses PostgreSQL pg_stat_user_indexes.
 * - Skips primary-key indexes.
 */
async function logUnusedIndexes(connection: Pool): Promise<void> {
  console.log("[INDEX - CHECKING] Detecting unused indexes");

  try {
    const result = await connection.query(`
      SELECT
        s.relname AS table_name,
        i.relname AS index_name,
        COALESCE(stat.idx_scan, 0) AS usage_count
      FROM pg_stat_user_indexes stat
      JOIN pg_class i ON i.oid = stat.indexrelid
      JOIN pg_class s ON s.oid = stat.relid
      JOIN pg_index pi ON pi.indexrelid = i.oid
      WHERE NOT pi.indisprimary
      ORDER BY s.relname, i.relname;
    `);

    const unusedIndexes = result.rows.filter(
      (row) => Number(row.usage_count) === 0,
    );

    if (unusedIndexes.length > 0) {
      console.warn("[INDEX] Unused indexes detected:");

      unusedIndexes.forEach((row) => {
        console.warn(`  - ${row.table_name}.${row.index_name} -> not used`);
      });
    } else {
      console.log("[INDEX] No unused indexes detected.");
    }
  } catch (err) {
    console.error("[INDEX] Failed to detect unused indexes:", err);
  }
}

/**
 * @brief Handles PostgreSQL indexes based on environment.
 *
 * - Development: Drops configured indexes and recreates them.
 * - Production: Creates missing indexes without dropping existing ones.
 * - Checks existing indexes before creation.
 * - Logs indexes with zero recorded scans.
 *
 * @param {Pool} connection - PostgreSQL connection pool.
 * @param {boolean} isProduction - Production environment flag.
 */
export async function setupIndexes(
  connection: Pool,
  isProduction: boolean,
): Promise<void> {
  const skipIndexing = getProduction() ? false : manualSkipIndexing;

  if (skipIndexing) {
    console.log(
      "[INDEX - SKIPPED] Indexing is disabled via manualSkipIndexing.",
    );
    return;
  }

  console.log("[INDEX] Handling indexes");

  if (!isProduction) {
    console.log("[INDEX] Dropping existing indexes");

    for (const dropStmt of dropIndexStatements) {
      try {
        await connection.query(dropStmt);
        console.log(`[INDEX - DROP] </> ${dropStmt}`);
      } catch (err) {
        console.warn(
          `[INDEX - DROP] [ ${dropStmt} ]:`,
          err instanceof Error ? err.message : err,
        );
      }
    }
  }

  console.log("[INDEX] Creating missing indexes");

  let createdCount = 0;
  let skippedCount = 0;

  for (const createStmt of createIndexStatements) {
    const match = createStmt.match(
      /CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?("?[\w]+"?)\s+ON\s+("?[\w]+"?)/i,
    );

    if (match) {
      const indexName = match[1].replace(/"/g, "");
      const tableName = match[2].replace(/"/g, "");

      if (await indexExists(connection, tableName, indexName)) {
        skippedCount++;

        console.log(
          `[INDEX - SKIP] ➤ Index ${indexName} already exists on ${tableName}.`,
        );

        continue;
      }
    }

    try {
      await connection.query(createStmt);
      createdCount++;
      console.log(`[INDEX] >_ ${createStmt}`);
    } catch (err) {
      console.warn(
        `[INDEX] [ ${createStmt} ]:`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  if (isProduction && createdCount === 0 && skippedCount > 0) {
    console.log("[INDEX - SKIP] ➤ All indexes already exist in production.");
  }

  await logUnusedIndexes(connection);
}
