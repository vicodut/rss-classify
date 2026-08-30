import "dotenv/config";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "pg";

/**
 * Applies pending SQL migrations from packages/db/migrations/ against
 * DATABASE_URL, tracked in a schema_migrations table so re-runs only apply
 * what's new. Bootstraps by marking 0001_init.sql as already-applied
 * without running it if the `articles` table already exists (true for every
 * project this repo has been used against so far, since 0001 predates this
 * tracking table).
 *
 * Run: pnpm --filter api run migrate
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(__dirname, "../../../../packages/db/migrations");

/**
 * Parsed manually rather than handed to `pg` as a connection string: Supabase
 * generates passwords that can contain characters like `#` which are URL
 * metacharacters (fragment delimiter) and break `new URL()`-based parsing.
 * The delimiter structure (postgres://user:password@host:port/db) is
 * unambiguous even with an unencoded password, since we split on the *last*
 * `@` before the host rather than URL-decoding.
 */
function parseConnectionString(raw: string) {
  const match = /^postgres(?:ql)?:\/\/([^:]+):(.+)@([^@]+):(\d+)\/(.+)$/.exec(raw);
  if (!match) throw new Error("DATABASE_URL is not in postgres://user:password@host:port/db form");
  const [, user, password, host, port, database] = match;
  return { user, password, host, port: Number(port), database };
}

async function main() {
  const raw = process.env.DATABASE_URL;
  if (!raw) {
    console.error("DATABASE_URL is not set (add it to apps/api/.env.local)");
    process.exit(1);
  }

  const client = new Client({ ...parseConnectionString(raw), ssl: { rejectUnauthorized: false } });
  await client.connect();

  try {
    await client.query(`
      create table if not exists schema_migrations (
        filename text primary key,
        applied_at timestamptz not null default now()
      );
    `);

    const { rows: appliedRows } = await client.query<{ filename: string }>(
      "select filename from schema_migrations",
    );
    const applied = new Set(appliedRows.map((r) => r.filename));

    if (!applied.has("0001_init.sql")) {
      const { rows } = await client.query(
        "select 1 from information_schema.tables where table_schema = 'public' and table_name = 'articles'",
      );
      if (rows.length > 0) {
        await client.query("insert into schema_migrations (filename) values ($1)", ["0001_init.sql"]);
        applied.add("0001_init.sql");
        console.log("Bootstrapped: marked 0001_init.sql as already applied (articles table already exists).");
      }
    }

    const files = readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith(".sql"))
      .sort();
    const pending = files.filter((f) => !applied.has(f));

    if (pending.length === 0) {
      console.log("No pending migrations.");
      return;
    }

    for (const file of pending) {
      console.log(`Applying ${file}...`);
      const sql = readFileSync(path.join(MIGRATIONS_DIR, file), "utf8");
      await client.query("begin");
      try {
        await client.query(sql);
        await client.query("insert into schema_migrations (filename) values ($1)", [file]);
        await client.query("commit");
        console.log(`  done: ${file}`);
      } catch (err) {
        await client.query("rollback");
        console.error(`  failed: ${file}`);
        throw err;
      }
    }

    console.log(`Applied ${pending.length} migration(s).`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
