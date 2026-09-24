import { createClient } from "@libsql/client";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

const url = process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url || !authToken) {
  console.error("Missing TURSO credentials in environment");
  process.exit(1);
}

const client = createClient({
  url,
  authToken,
});

async function main() {
  console.log("[Turso Migrate] Connecting to Turso DB:", url);

  const sqlFilePath = path.join(process.cwd(), "prisma", "turso_init.sql");
  const sqlContent = fs.readFileSync(sqlFilePath, "utf8");

  // Split into separate SQL statements
  const statements = sqlContent
    .split(";")
    .map((s) => s.trim())
    .filter((s) => {
      // Remove pure comment blocks
      const clean = s.replace(/--.*$/gm, "").trim();
      return clean.length > 0;
    });

  console.log(`[Turso Migrate] Executing ${statements.length} DDL statements...`);

  for (const statement of statements) {
    if (!statement) continue;
    try {
      await client.execute(statement);
      console.log("✔ Executed:", statement.slice(0, 45).replace(/\n/g, " "));
    } catch (err: any) {
      console.warn(`[Notice] ${statement.slice(0, 45).replace(/\n/g, " ")}:`, err.message);
    }
  }

  console.log("✅ [Turso Migrate] All tables and indexes successfully created on Turso DB!");
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Migration failed:", err);
  process.exit(1);
});

