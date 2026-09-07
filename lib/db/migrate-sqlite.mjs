import { DatabaseSync } from "node:sqlite";
import { resolve } from "node:path";
import pg from "pg";
import { registrationSchemaSql } from "./src/storage-schema.ts";

if (!process.env.DATABASE_URL || !process.argv[2]) {
  throw new Error(
    "Set DATABASE_URL and pass the path to the existing registrations.sqlite file.",
  );
}
const source = new DatabaseSync(resolve(process.argv[2]), { readOnly: true });
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 1,
  connectionTimeoutMillis: 15000,
});
const client = await pool.connect();
try {
  await client.query("BEGIN");
  await client.query("SELECT pg_advisory_xact_lock(73519244)");
  await client.query(registrationSchemaSql);
  let imported = 0;
  for (const row of source
    .prepare(
      "SELECT rowid AS public_id, id, email, mobile, password, record FROM registrations ORDER BY rowid",
    )
    .all()) {
    const result = await client.query(
      "INSERT INTO registrations (id, public_id, email, mobile, password, record) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO NOTHING",
      [row.id, row.public_id, row.email, row.mobile, row.password, row.record],
    );
    imported += result.rowCount;
  }
  const settingsTable = source
    .prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'registration_settings'",
    )
    .get();
  if (settingsTable) {
    for (const row of source
      .prepare("SELECT id, value FROM registration_settings")
      .all()) {
      await client.query(
        "INSERT INTO registration_settings (id, value) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING",
        [row.id, row.value],
      );
    }
  }
  await client.query(
    "SELECT setval(pg_get_serial_sequence('registrations', 'public_id'), GREATEST(COALESCE((SELECT MAX(public_id) FROM registrations), 0), 1), EXISTS (SELECT 1 FROM registrations))",
  );
  await client.query("COMMIT");
  console.log(
    `Imported ${imported} registrations. Existing IDs were preserved; existing destination records and settings were not overwritten. Sign in again to create new sessions.`,
  );
} catch {
  await client.query("ROLLBACK");
  console.error(
    "Import failed and was rolled back. Check the connection and possible email, mobile or public ID conflicts.",
  );
  process.exitCode = 1;
} finally {
  source.close();
  client.release();
  await pool.end();
}
