import Anthropic from "@anthropic-ai/sdk";

export class AIConfigError extends Error {}

let client: Anthropic | null = null;

function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new AIConfigError(
      "ANTHROPIC_API_KEY is not configured. Add it to the environment to enable AI agents."
    );
  }
  if (!client) {
    client = new Anthropic({ apiKey });
  }
  return client;
}

// Agents store a provider-agnostic model choice (the UI still offers GPT-4o
// options for familiarity), but only an Anthropic key is wired up here, so
// every choice resolves to a real, callable Claude model. "mini"/"haiku"
// choices map to the fast/cheap tier, everything else to the higher-quality
// tier.
const FAST_MODEL = "claude-haiku-4-5-20251001";
const QUALITY_MODEL = "claude-sonnet-5";

export function resolveModel(aiModel: string | null | undefined): string {
  const key = (aiModel || "").toLowerCase();
  if (key.includes("mini") || key.includes("haiku")) return FAST_MODEL;
  if (key.startsWith("claude-")) return key; // already a real Claude model id
  return QUALITY_MODEL;
}

// USD per million tokens. Approximate published Anthropic pricing; used only
// for the org's internal cost-tracking display, not for billing the org.
const PRICING_USD_PER_MTOK: Record<string, { input: number; output: number }> = {
  "claude-haiku-4-5-20251001": { input: 1, output: 5 },
  "claude-sonnet-5": { input: 3, output: 15 },
  "claude-opus-5-5": { input: 15, output: 75 },
};

const USD_TO_INR = Number(process.env.AI_USD_TO_INR_RATE || 83);

export function estimateCostInPaise(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const pricing = PRICING_USD_PER_MTOK[model] || PRICING_USD_PER_MTOK[QUALITY_MODEL];
  const usd =
    (inputTokens / 1_000_000) * pricing.input + (outputTokens / 1_000_000) * pricing.output;
  const rupees = usd * USD_TO_INR;
  return Math.max(1, Math.round(rupees * 100));
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatCompletionResult {
  text: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costInPaise: number;
}

export async function generateChatCompletion(opts: {
  model: string;
  system: string;
  messages: ChatMessage[];
  maxTokens?: number;
}): Promise<ChatCompletionResult> {
  const anthropic = getClient();
  const response = await anthropic.messages.create({
    model: opts.model,
    system: opts.system,
    messages: opts.messages,
    max_tokens: opts.maxTokens ?? 1024,
  });

  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();

  const inputTokens = response.usage?.input_tokens ?? 0;
  const outputTokens = response.usage?.output_tokens ?? 0;

  return {
    text,
    model: opts.model,
    inputTokens,
    outputTokens,
    costInPaise: estimateCostInPaise(opts.model, inputTokens, outputTokens),
  };
}

/** True once ANTHROPIC_API_KEY is present, without throwing. */
export function isAIConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}
