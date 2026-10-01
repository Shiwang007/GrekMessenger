import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { pool } from "../config/database.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const migrationsDir = path.resolve(__dirname, "../../../database/migrations");

async function runMigrations() {
  const client = await pool.connect();
  try {
    console.log("Checking migration tracking table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    const { rows: appliedRows } = await client.query("SELECT name FROM schema_migrations");
    const appliedSet = new Set(appliedRows.map((r) => r.name));

    const files = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    console.log(`Found ${files.length} migration files in ${migrationsDir}`);

    for (const file of files) {
      if (appliedSet.has(file)) {
        console.log(`- Skipping already applied migration: ${file}`);
        continue;
      }

      console.log(`Applying migration: ${file}...`);
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, "utf-8");

      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [file]);
        await client.query("COMMIT");
        console.log(`✓ Applied: ${file}`);
      } catch (err) {
        await client.query("ROLLBACK");
        console.error(`✗ Error applying ${file}:`, err.message);
        throw err;
      }
    }

    console.log("\nAll migrations applied successfully!");
  } finally {
    client.release();
    await pool.end();
  }
}

runMigrations().catch((err) => {
  console.error("Migration process failed:", err.message);
  process.exit(1);
});
