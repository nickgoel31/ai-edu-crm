import { createServer, LogLevel } from "pglite-server";
import { PGlite } from "@electric-sql/pglite";
import path from "path";

const dbPath = path.join(process.cwd(), "prisma", "dev-db");
console.log(`[Dev-DB] Initializing PGlite database at ${dbPath}...`);

const pg = new PGlite(dbPath);
const server = createServer(pg, { logLevel: LogLevel.Debug });

const PORT = 5432;

server.listen(PORT, () => {
  console.log(`[Dev-DB] PostgreSQL Wire Server running at 127.0.0.1:${PORT}`);
  console.log(`[Dev-DB] Connect with: postgresql://postgres:password@127.0.0.1:${PORT}/ai_edu_crm`);
});

process.on("uncaughtException", (err: any) => {
  if (err?.code === "ECONNRESET" || err?.code === "ECONNABORTED") {
    // Expected when client disconnects abruptly
    return;
  }
  console.error("[Dev-DB] Error:", err);
});

process.on("SIGINT", async () => {
  console.log("\n[Dev-DB] Shutting down database server...");
  server.close();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("\n[Dev-DB] Shutting down database server...");
  server.close();
  process.exit(0);
});
