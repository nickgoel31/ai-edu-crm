const { createClient } = require("@libsql/client");
require("dotenv").config();

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function runMigration() {
  const statements = [
    `CREATE TABLE IF NOT EXISTS message_templates (
      id TEXT PRIMARY KEY,
      organizationId TEXT NOT NULL,
      name TEXT NOT NULL,
      channel TEXT NOT NULL,
      subject TEXT,
      body TEXT NOT NULL DEFAULT '',
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME,
      FOREIGN KEY (organizationId) REFERENCES organizations(id) ON DELETE CASCADE
    )`,
    `CREATE INDEX IF NOT EXISTS message_templates_organizationId_idx ON message_templates(organizationId)`,
    `CREATE INDEX IF NOT EXISTS message_templates_organizationId_channel_idx ON message_templates(organizationId, channel)`,
  ];

  for (const s of statements) {
    try {
      await client.execute(s);
      console.log("OK: " + s.slice(0, 60));
    } catch (e) {
      console.log("Skip:", e.message);
    }
  }

  console.log("Done: message_templates table ready.");
}

runMigration();
