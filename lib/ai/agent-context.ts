import { prisma } from "@/lib/prisma";
import { AgentRole, AGENT_ROLE_META } from "@/types";

const MAX_KNOWLEDGE_CHARS = 12000;

/** Concatenates every document from every knowledge base attached to an agent. */
export async function fetchAgentKnowledgeText(agentId: string): Promise<string> {
  const links = await prisma.agentKnowledgeBase.findMany({
    where: { agentId },
    include: {
      knowledgeBase: {
        include: { documents: true },
      },
    },
  });

  const chunks: string[] = [];
  for (const link of links) {
    for (const doc of link.knowledgeBase.documents) {
      chunks.push(`### ${doc.title}\n${doc.content}`);
    }
  }

  const combined = chunks.join("\n\n");
  return combined.length > MAX_KNOWLEDGE_CHARS
    ? combined.slice(0, MAX_KNOWLEDGE_CHARS) + "\n\n[...knowledge base truncated]"
    : combined;
}

/**
 * Builds the full system prompt sent to the LLM for a given agent: its
 * configured instructions, plus role/channel context, language, working
 * hours, and any attached knowledge base content.
 */
export function buildAgentSystemPrompt(opts: {
  role: AgentRole;
  agentName: string;
  organizationName: string;
  config: Record<string, any>;
  knowledgeText: string;
  extraContext?: string;
}): string {
  const { role, agentName, organizationName, config, knowledgeText, extraContext } = opts;
  const roleMeta = AGENT_ROLE_META[role];

  const parts: string[] = [];

  parts.push(
    `You are "${agentName}", an AI ${roleMeta?.label || "assistant"} agent working for ${organizationName}, an educational institution using an admissions/student CRM.`
  );

  if (config.systemPrompt) {
    parts.push(config.systemPrompt);
  }

  parts.push(
    [
      "Guardrails:",
      "- Never invent facts about programs, fees, dates, or policies that are not given to you below.",
      "- If you don't know something, say so and offer to connect the visitor with a human counselor.",
      "- Never promise admission, a discount, or a refund on your own authority.",
      "- Keep replies concise and conversational, suitable for chat or a phone call transcript.",
    ].join("\n")
  );

  if (config.language) {
    parts.push(`Respond primarily in: ${config.language}.`);
  }
  if (config.workingHours) {
    parts.push(`Normal working hours for human hand-off: ${config.workingHours}.`);
  }

  if (knowledgeText) {
    parts.push(`Knowledge base (use this to answer factual questions):\n${knowledgeText}`);
  }

  if (extraContext) {
    parts.push(extraContext);
  }

  return parts.join("\n\n");
}

export function parseAgentConfigSafe(raw: string | null | undefined): Record<string, any> {
  if (!raw) return {};
  try {
    return JSON.parse(raw) || {};
  } catch {
    return {};
  }
}
