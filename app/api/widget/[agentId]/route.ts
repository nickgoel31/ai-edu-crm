import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AgentChannel, AgentStatus } from "@/types";
import { parseAgentConfigSafe } from "@/lib/ai/agent-context";

// Public, unauthenticated: returns only what an embedded widget needs to
// render itself. Never include agent.config secrets here.
export async function GET(_req: Request, { params }: { params: { agentId: string } }) {
  const agent = await prisma.agent.findUnique({ where: { id: params.agentId } });

  if (!agent || agent.status !== AgentStatus.LIVE || agent.channel !== AgentChannel.WEBSITE_CHAT) {
    return NextResponse.json({ error: "This chat agent is not available." }, { status: 404 });
  }

  const config = parseAgentConfigSafe(agent.config);

  return NextResponse.json({
    id: agent.id,
    name: agent.name,
    welcomeMessage: config.welcomeMessage || "Hi! Ask me anything.",
    widgetColor: config.widgetColor || "#2563eb",
  });
}
