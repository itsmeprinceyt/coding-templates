/* eslint-disable @typescript-eslint/no-explicit-any */
import fs from "fs";
import path from "path";
import type { Pool, PoolConnection } from "mysql2/promise";
import { setupIndexes } from "./create.index.db";
import MIGRATIONS_TABLE_SQL from "./migration.table.db";
import { getProduction } from "../../utils/ValueFetcher/getProduction.util";

/**
 * Splits a MySQL script into individual statements, honoring `DELIMITER`
 * directives, line comments (`--`, `#`), block comments, and quoted strings.
 */
function splitSqlStatements(sql: string): string[] {
  sql = sql.replace(/\r\n/g, "\n");
  const statements: string[] = [];
  let current = "";
  let delimiter = ";";
  let i = 0;
  const len = sql.length;

  const isSpace = (c: string) => c === " " || c === "\t" || c === "\n";

  while (i < len) {
    // DELIMITER directive (client-side, must be at line start)
    if (
      (i === 0 || sql[i - 1] === "\n") &&
      /^DELIMITER\s/i.test(sql.slice(i, i + 11))
    ) {
      const eol = sql.indexOf("\n", i);
      const line = eol === -1 ? sql.slice(i) : sql.slice(i, eol);
      const m = line.match(/^DELIMITER\s+(\S+)/i);
      if (m) {
        delimiter = m[1];
        i = eol === -1 ? len : eol + 1;
        continue;
      }
    }

    // `-- ` line comment (needs whitespace/control char after `--`)
    if (
      sql[i] === "-" &&
      sql[i + 1] === "-" &&
      (i + 2 >= len || isSpace(sql[i + 2]))
    ) {
      const eol = sql.indexOf("\n", i);
      current += "\n";
      i = eol === -1 ? len : eol + 1;
      continue;
    }

    // `#` line comment
    if (sql[i] === "#") {
      const eol = sql.indexOf("\n", i);
      current += "\n";
      i = eol === -1 ? len : eol + 1;
      continue;
    }

    // `/* ... */` block comment
    if (sql[i] === "/" && sql[i + 1] === "*") {
      const end = sql.indexOf("*/", i + 2);
      current += " ";
      i = end === -1 ? len : end + 2;
      continue;
    }

    // String / identifier literal — copy verbatim
    const q = sql[i];
    if (q === "'" || q === '"' || q === "`") {
      current += q;
      i++;
      while (i < len) {
        if (sql[i] === "\\" && q !== "`" && i + 1 < len) {
          current += sql[i] + sql[i + 1];
          i += 2;
          continue;
        }
        if (sql[i] === q && sql[i + 1] === q) {
          current += q + q;
          i += 2;
          continue;
        }
        if (sql[i] === q) {
          current += q;
          i++;
          break;
        }
        current += sql[i];
        i++;
      }
      continue;
    }

    // Delimiter match — end of current statement
    if (delimiter && sql.startsWith(delimiter, i)) {
      const stmt = current.trim();
      if (stmt) statements.push(stmt);
      current = "";
      i += delimiter.length;
      continue;
    }

    current += sql[i];
    i++;
  }

  const tail = current.trim();
  if (tail) statements.push(tail);
  return statements;
}

/**
 * Executes all SQL statements contained in a MySQL script using the provided connection.
 *
 * @async
 * @function runSqlFile
 * @param {PoolConnection} conn - Active MySQL connection used to execute the statements
 * @param {string} sql - MySQL script containing one or more SQL statements
 *
 * @description
 * Splits the provided SQL script into individual statements and executes them
 * sequentially using the supplied database connection.
 */
async function runSqlFile(conn: PoolConnection, sql: string) {
  const statements = splitSqlStatements(sql);
  for (const stmt of statements) {
    await conn.query(stmt);
  }
}

/**
 * Discovers and executes pending database migrations from the migrations directory.
 *
 * @async
 * @function runMigrations
 * @param {Pool} pool - MySQL connection pool used to acquire a database connection
 *
 * @description
 * Workflow:
 *   1. Resolve the database migrations directory
 *   2. Create the migrations directory if it does not exist
 *   3. Acquire a database connection from the pool
 *   4. Initialize the migrations tracking table
 *   5. Retrieve previously applied migration filenames
 *   6. Read and sort all `.sql` migration files
 *   7. Skip migrations that have already been applied
 *   8. Read and execute each pending migration file
 *   9. Record each successfully applied migration (timestamp auto-set by DB)
 *   10. Log migration processing status
 *   11. Determine the current production environment
 *   12. Setup database indexes based on the environment
 *   13. Release the database connection
 */
export async function runMigrations(pool: Pool) {
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
      `[MIGRATION - CREATE] ➤ Directory not found : ${migrationsDir} — creating it`,
    );
    fs.mkdirSync(migrationsDir, { recursive: true });
  }

  const conn: PoolConnection = await pool.getConnection();

  try {
    await conn.query(MIGRATIONS_TABLE_SQL);

    const [rows] = await conn.query("SELECT filename FROM migrations");
    const applied = new Set((rows as any[]).map((r) => r.filename));

    const files = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.toLowerCase().endsWith(".sql"))
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
      await runSqlFile(conn, sql);
      await conn.query("INSERT INTO migrations (filename) VALUES (?)", [file]);
      appliedCount++;
      console.log(`[MIGRATION - APPLIED] >_ ${file}`);
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

    const isProduction: boolean = getProduction();
    await setupIndexes(pool, isProduction);
  } finally {
    conn.release();
  }
}
