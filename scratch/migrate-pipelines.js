const { createClient } = require("@libsql/client");
require("dotenv").config();

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function runMigration() {
  const statements = [
    // 1. Add program and pipelineStageId to leads
    `ALTER TABLE leads ADD COLUMN program TEXT`,
    `ALTER TABLE leads ADD COLUMN pipelineStageId TEXT`,
    `CREATE INDEX IF NOT EXISTS leads_organizationId_pipelineStageId_idx ON leads(organizationId, pipelineStageId)`,

    // 2. Create pipeline_templates
    `CREATE TABLE IF NOT EXISTS pipeline_templates (
      id TEXT PRIMARY KEY,
      organizationId TEXT NOT NULL,
      name TEXT NOT NULL,
      program TEXT,
      isDefault INTEGER DEFAULT 0,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME,
      FOREIGN KEY (organizationId) REFERENCES organizations(id) ON DELETE CASCADE
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS pipeline_templates_organizationId_program_key ON pipeline_templates(organizationId, program)`,
    `CREATE INDEX IF NOT EXISTS pipeline_templates_organizationId_idx ON pipeline_templates(organizationId)`,

    // 3. Create pipeline_stages
    `CREATE TABLE IF NOT EXISTS pipeline_stages (
      id TEXT PRIMARY KEY,
      pipelineTemplateId TEXT NOT NULL,
      name TEXT NOT NULL,
      displayOrder INTEGER DEFAULT 0,
      color TEXT DEFAULT '#3b82f6',
      requiresReasonOnExit INTEGER DEFAULT 0,
      mapsToBucket TEXT NOT NULL,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME,
      FOREIGN KEY (pipelineTemplateId) REFERENCES pipeline_templates(id) ON DELETE CASCADE
    )`,
    `CREATE INDEX IF NOT EXISTS pipeline_stages_pipelineTemplateId_idx ON pipeline_stages(pipelineTemplateId)`,
    `CREATE INDEX IF NOT EXISTS pipeline_stages_pipelineTemplateId_displayOrder_idx ON pipeline_stages(pipelineTemplateId, displayOrder)`
  ];

  for (const s of statements) {
    try {
      await client.execute(s);
      console.log("✔ Executed migration statement");
    } catch (e) {
      console.log("ℹ Status:", e.message);
    }
  }

  console.log("✅ Turso pipeline tables and columns migrated successfully.");
}

runMigration();
