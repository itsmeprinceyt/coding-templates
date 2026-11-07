import type { Pool, PoolClient, QueryResultRow } from "pg";

type PgQueryable = Pick<Pool, "query"> | Pick<PoolClient, "query">;

export function toPgPlaceholders(sql: string): string {
  let index = 0;

  return sql.replace(/\?/g, () => `$${++index}`);
}

export async function queryRows<T extends QueryResultRow = QueryResultRow>(
  executor: PgQueryable,
  text: string,
  values?: unknown[],
): Promise<T[]> {
  const result = await executor.query<T>(text, values);
  return result.rows;
}
