import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { pool } from "../config/database.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const seedFile = path.resolve(__dirname, "../../../database/seed/seed.sql");

async function runSeed() {
  const client = await pool.connect();
  try {
    console.log(`Executing seed from ${seedFile}...`);
    const sql = fs.readFileSync(seedFile, "utf-8");

    await client.query("BEGIN");
    await client.query(sql);
    await client.query("COMMIT");

    const usersCount = await client.query("SELECT COUNT(*) FROM users");
    const convCount = await client.query("SELECT COUNT(*) FROM conversations");
    const msgCount = await client.query("SELECT COUNT(*) FROM messages");

    console.log("\n✓ Seed data successfully inserted!");
    console.log(`- Users: ${usersCount.rows[0].count}`);
    console.log(`- Conversations: ${convCount.rows[0].count}`);
    console.log(`- Messages: ${msgCount.rows[0].count}`);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("✗ Seeding failed:", err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

runSeed().catch((err) => {
  console.error("Seed execution failed:", err.message);
  process.exit(1);
});
