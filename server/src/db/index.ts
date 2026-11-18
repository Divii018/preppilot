import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { config } from "../config.js";

export const pool = new pg.Pool({ connectionString: config.DATABASE_URL, max: 10 });

export async function query<T extends pg.QueryResultRow = any>(text: string, params: unknown[] = []) {
  return pool.query<T>(text, params);
}

/** Run a set of statements atomically. */
export async function withTransaction<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function migrate() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  // schema.sql sits next to this file in src/; the build copies it to dist/db/.
  const sql = fs.readFileSync(path.join(here, "schema.sql"), "utf8");
  await pool.query(sql);
}
