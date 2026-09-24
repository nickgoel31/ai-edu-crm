const { createClient } = require("@libsql/client");
require("dotenv").config();

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function syncAll() {
  const statements = [
    `CREATE TABLE IF NOT EXISTS tags (
      id TEXT PRIMARY KEY,
      organizationId TEXT NOT NULL,
      name TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT '#3b82f6',
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME,
      FOREIGN KEY (organizationId) REFERENCES organizations(id) ON DELETE CASCADE
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS tags_organizationId_name_key ON tags(organizationId, name)`,
    `CREATE TABLE IF NOT EXISTS entity_tags (
      id TEXT PRIMARY KEY,
      organizationId TEXT NOT NULL,
      entityType TEXT NOT NULL,
      entityId TEXT NOT NULL,
      tagId TEXT NOT NULL,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (organizationId) REFERENCES organizations(id) ON DELETE CASCADE,
      FOREIGN KEY (tagId) REFERENCES tags(id) ON DELETE CASCADE
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS entity_tags_organizationId_entityType_entityId_tagId_key ON entity_tags(organizationId, entityType, entityId, tagId)`,
    `CREATE TABLE IF NOT EXISTS scoring_rules (
      id TEXT PRIMARY KEY,
      organizationId TEXT NOT NULL,
      name TEXT NOT NULL,
      field TEXT NOT NULL,
      operator TEXT NOT NULL,
      value TEXT NOT NULL,
      points INTEGER NOT NULL,
      enabled INTEGER DEFAULT 1,
      displayOrder INTEGER DEFAULT 0,
      isArchived INTEGER DEFAULT 0,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME,
      FOREIGN KEY (organizationId) REFERENCES organizations(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS duplicate_matches (
      id TEXT PRIMARY KEY,
      organizationId TEXT NOT NULL,
      entityType TEXT NOT NULL,
      primaryEntityId TEXT NOT NULL,
      duplicateEntityId TEXT NOT NULL,
      matchedOn TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'PENDING',
      resolvedByUserId TEXT,
      resolvedAt DATETIME,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME,
      FOREIGN KEY (organizationId) REFERENCES organizations(id) ON DELETE CASCADE
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS sla_policies_organizationId_source_key ON sla_policies(organizationId, source)`,
    `CREATE TABLE IF NOT EXISTS custom_field_definitions (
      id TEXT PRIMARY KEY,
      organizationId TEXT NOT NULL,
      entityType TEXT NOT NULL,
      fieldKey TEXT NOT NULL,
      label TEXT NOT NULL,
      fieldType TEXT NOT NULL,
      options TEXT,
      required INTEGER DEFAULT 0,
      displayOrder INTEGER DEFAULT 0,
      isActive INTEGER DEFAULT 1,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME,
      FOREIGN KEY (organizationId) REFERENCES organizations(id) ON DELETE CASCADE
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS custom_field_definitions_organizationId_entityType_fieldKey_key ON custom_field_definitions(organizationId, entityType, fieldKey)`,
    `CREATE TABLE IF NOT EXISTS custom_field_values (
      id TEXT PRIMARY KEY,
      organizationId TEXT NOT NULL,
      entityType TEXT NOT NULL,
      entityId TEXT NOT NULL,
      fieldDefinitionId TEXT NOT NULL,
      value TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME,
      FOREIGN KEY (organizationId) REFERENCES organizations(id) ON DELETE CASCADE,
      FOREIGN KEY (fieldDefinitionId) REFERENCES custom_field_definitions(id) ON DELETE CASCADE
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS custom_field_values_fieldDefinitionId_entityId_key ON custom_field_values(fieldDefinitionId, entityId)`
  ];

  for (const s of statements) {
    try {
      await client.execute(s);
      console.log("✔ Executed SQL statement");
    } catch (e) {
      console.log("ℹ Statement status:", e.message);
    }
  }

  console.log("Done syncing Turso tables.");
}

syncAll();
