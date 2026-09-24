"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bot,
  Phone,
  MessageSquare,
  Mail,
  Globe,
  Clock,
  Languages,
  Key,
  Webhook,
  Code2,
  Loader2,
  AlertCircle,
  Rocket,
} from "lucide-react";
import { AgentChannel, AGENT_ROLE_META } from "@/types";
import type { AgentCatalogEntry } from "@/lib/agent-catalog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const CHANNEL_ICONS: Record<AgentChannel, typeof Phone> = {
  VOICE: Phone,
  WHATSAPP: MessageSquare,
  EMAIL: Mail,
  WEBSITE_CHAT: Globe,
};

function generateEmbedSnippet(orgSlug: string, role: string) {
  return `<script src="https://cdn.apextech.edu/widget.js" data-agent="${role.toLowerCase()}" data-org="${orgSlug}" async></script>`;
}

export function AgentSetupForm({ entry, orgSlug }: { entry: AgentCatalogEntry; orgSlug?: string }) {
  const router = useRouter();
  const meta = AGENT_ROLE_META[entry.role];
  const Icon = CHANNEL_ICONS[meta.channel] || Bot;

  const [name, setName] = useState(entry.name);
  const [workingHours, setWorkingHours] = useState("09:00 - 20:00 IST");
  const [language, setLanguage] = useState("en-IN");
  const [scriptPromptVersion, setScriptPromptVersion] = useState("v1.0");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [embedSnippet, setEmbedSnippet] = useState(generateEmbedSnippet(orgSlug || "your-org", entry.role));
  const [isDeploying, setIsDeploying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isChatChannel = meta.channel === AgentChannel.WEBSITE_CHAT;

  const handleDeploy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Agent name is required.");
      return;
    }

    setIsDeploying(true);
    setError(null);
    try {
      const res = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          role: entry.role,
          channel: meta.channel,
          status: "LIVE",
          workingHours,
          language,
          scriptPromptVersion,
          outboundWebhookUrl: isChatChannel ? undefined : webhookUrl.trim() || undefined,
          extraConfig: isChatChannel
            ? { embedSnippet: embedSnippet.trim() }
            : apiKey.trim()
            ? { apiKey: apiKey.trim() }
            : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to deploy agent.");

      router.push("/agents");
      router.refresh();
    } catch (err: any) {
      setError(err?.message || "Failed to deploy agent.");
    } finally {
      setIsDeploying(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Card className="p-6 flex items-start gap-4">
        <div className="p-3 rounded-2xl bg-blue-500/15 text-blue-400 border border-blue-500/25 shadow-sm shrink-0">
          <Icon className="w-7 h-7" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">{entry.name}</h1>
          <p className="text-xs text-zinc-400 mt-1 leading-relaxed">{entry.description}</p>
          <span className="inline-block mt-2 text-[10px] font-medium text-zinc-500 uppercase tracking-wider px-2 py-0.5 rounded-full border border-border bg-muted/40">
            Not deployed · {meta.channel.replace(/_/g, " ")}
          </span>
        </div>
      </Card>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="w-4 h-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card className="p-5">
        <div className="border-b border-border/60 pb-2 mb-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">
            Deployment Configuration
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Set these once — they can be edited later from the agent's Config panel.
          </p>
        </div>

        <form onSubmit={handleDeploy} className="space-y-4 text-xs">
          <div className="space-y-1.5">
            <Label className="font-semibold text-zinc-300">
              <Bot className="w-3.5 h-3.5 text-zinc-500" />
              <span>Agent Name</span>
            </Label>
            <Input type="text" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>

          {isChatChannel ? (
            <div className="space-y-1.5">
              <Label className="font-semibold text-zinc-300">
                <Code2 className="w-3.5 h-3.5 text-zinc-500" />
                <span>Website Embed Snippet</span>
              </Label>
              <Textarea
                value={embedSnippet}
                onChange={(e) => setEmbedSnippet(e.target.value)}
                className="font-mono text-[11px]"
                rows={3}
              />
              <p className="text-[10px] text-zinc-500">
                Paste this script tag before the closing &lt;/body&gt; on your site once deployed.
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label className="font-semibold text-zinc-300">
                  <Webhook className="w-3.5 h-3.5 text-zinc-500" />
                  <span>Outbound Webhook URL</span>
                </Label>
                <Input
                  type="url"
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  placeholder="https://api.retellai.com/... or https://your-dograh-instance/webhook"
                />
                <p className="text-[10px] text-zinc-500">
                  Retell / Dograh endpoint this agent calls out to when triggered by a CRM event.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label className="font-semibold text-zinc-300">
                  <Key className="w-3.5 h-3.5 text-zinc-500" />
                  <span>API Key</span>
                </Label>
                <Input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk-••••••••••••••••"
                  autoComplete="off"
                />
              </div>
            </>
          )}

          <div className="space-y-1.5">
            <Label className="font-semibold text-zinc-300">
              <Clock className="w-3.5 h-3.5 text-zinc-500" />
              <span>Working Hours</span>
            </Label>
            <Input
              type="text"
              value={workingHours}
              onChange={(e) => setWorkingHours(e.target.value)}
              placeholder="e.g. 09:00 - 20:00 IST"
            />
            <div className="flex gap-1 pt-1">
              {["09:00 - 20:00 IST", "24/7 Active", "10:00 - 18:00 IST"].map((preset) => (
                <Button
                  key={preset}
                  type="button"
                  variant="outline"
                  size="xs"
                  onClick={() => setWorkingHours(preset)}
                >
                  {preset}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="font-semibold text-zinc-300">
              <Languages className="w-3.5 h-3.5 text-zinc-500" />
              <span>Primary Language</span>
            </Label>
            <Select selectedKey={language} onSelectionChange={(key) => setLanguage(String(key))}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem id="en-IN">English (India - en-IN)</SelectItem>
                <SelectItem id="hi-IN">Hindi (hi-IN)</SelectItem>
                <SelectItem id="hi-Latn">Hinglish (Colloquial - hi-Latn)</SelectItem>
                <SelectItem id="mr-IN">Marathi (mr-IN)</SelectItem>
                <SelectItem id="ta-IN">Tamil (ta-IN)</SelectItem>
                <SelectItem id="te-IN">Telugu (te-IN)</SelectItem>
                <SelectItem id="kn-IN">Kannada (kn-IN)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="font-semibold text-zinc-300">
              <Bot className="w-3.5 h-3.5 text-zinc-500" />
              <span>Script / Prompt Version</span>
            </Label>
            <Input
              type="text"
              value={scriptPromptVersion}
              onChange={(e) => setScriptPromptVersion(e.target.value)}
              placeholder="e.g. v1.0"
              className="font-mono"
            />
          </div>

          <Button type="submit" isDisabled={isDeploying} className="w-full">
            {isDeploying ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Deploying...</span>
              </>
            ) : (
              <>
                <Rocket className="w-3.5 h-3.5" />
                <span>Deploy Agent</span>
              </>
            )}
          </Button>
        </form>
      </Card>
    </div>
  );
}
