import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

const { Pool } = createRequire(
  new URL("../lib/db/package.json", import.meta.url),
)("pg");
test("SQLite import preserves registrations, photos and settings without overwriting", async () => {
  const adminUrl = new URL(process.env.TEST_DATABASE_URL || "");
  assert.ok(
    ["localhost", "127.0.0.1"].includes(adminUrl.hostname),
    "Use a local test PostgreSQL server",
  );
  const name = "ram_import_test_" + randomUUID().replaceAll("-", "");
  const admin = new Pool({ connectionString: adminUrl.href });
  await admin.query(
    "CREATE DATABASE " + name + " ENCODING 'UTF8' TEMPLATE template0",
  );
  const destination = new URL(adminUrl);
  destination.pathname = "/" + name;
  const target = new Pool({ connectionString: destination.href });
  const dir = await mkdtemp(path.join(tmpdir(), "ram-import-"));
  const sourcePath = path.join(dir, "legacy.sqlite");
  const source = new DatabaseSync(sourcePath);
  const record = {
    id: "legacy-id",
    reviewStatus: "Approved",
    photos: [{ dataUrl: "data:image/jpeg;base64,dGVzdA==" }],
    displayName: "Legacy Member",
  };
  source.exec(
    "CREATE TABLE registrations (id TEXT PRIMARY KEY, email TEXT, mobile TEXT, password TEXT, record TEXT); CREATE TABLE registration_settings (id INTEGER PRIMARY KEY, value TEXT);",
  );
  source
    .prepare("INSERT INTO registrations VALUES (?, ?, ?, ?, ?)")
    .run(
      record.id,
      "legacy@example.invalid",
      "+919999999999",
      "salt:stored-hash",
      JSON.stringify(record),
    );
  source
    .prepare("INSERT INTO registration_settings VALUES (1, ?)")
    .run(JSON.stringify({ plans: [{ id: "weekly", price: 999 }] }));
  source.close();
  const runImport = () =>
    new Promise((resolve, reject) => {
      const child = spawn(
        process.execPath,
        ["--experimental-strip-types", "lib/db/migrate-sqlite.mjs", sourcePath],
        {
          env: { ...process.env, DATABASE_URL: destination.href },
          windowsHide: true,
          stdio: ["ignore", "pipe", "pipe"],
        },
      );
      child.on("error", reject);
      child.on("exit", (code) =>
        code === 0 ? resolve() : reject(new Error("Import failed")),
      );
    });
  try {
    await runImport();
    const saved = (await target.query("SELECT * FROM registrations")).rows[0];
    assert.equal(Number(saved.public_id), 1);
    assert.equal(saved.password, "salt:stored-hash");
    assert.deepEqual(saved.record, record);
    assert.equal(
      (await target.query("SELECT value FROM registration_settings")).rows[0]
        .value.plans[0].price,
      999,
    );
    await target.query(
      'UPDATE registrations SET record = record || \'{"displayName":"Changed on Neon"}\'::jsonb',
    );
    await runImport();
    const records = (await target.query("SELECT record FROM registrations"))
      .rows;
    assert.equal(records.length, 1);
    assert.equal(records[0].record.displayName, "Changed on Neon");
    assert.equal(
      (
        await target.query(
          "SELECT COUNT(*) AS count FROM registration_sessions",
        )
      ).rows[0].count,
      "0",
    );
    const unchangedSource = new DatabaseSync(sourcePath, { readOnly: true });
    assert.equal(
      JSON.parse(
        unchangedSource.prepare("SELECT record FROM registrations").get()
          .record,
      ).displayName,
      "Legacy Member",
    );
    unchangedSource.close();
  } finally {
    await target.end();
    await admin.query("DROP DATABASE " + name + " WITH (FORCE)");
    await admin.end();
  }
});
