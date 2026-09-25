"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import {
  Database,
  Plus,
  FileText,
  Link2,
  Trash2,
  ChevronDown,
  ChevronRight,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Bot,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";
import { Dialog, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";

interface KbDocument {
  id: string;
  title: string;
  sourceType: string;
  content?: string;
  createdAt: string;
}

interface KnowledgeBaseItem {
  id: string;
  name: string;
  description: string | null;
  documentCount: number;
  documents: KbDocument[];
  agents: { id: string; name: string; role: string }[];
  createdAt: string;
}

export default function KnowledgeBasePage() {
  const { data: session } = useSession();
  const canMutate = session?.user?.role === "ADMIN" || session?.user?.role === "COUNSELOR";

  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBaseItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [creating, setCreating] = useState(false);

  const [docTitle, setDocTitle] = useState("");
  const [docContent, setDocContent] = useState("");
  const [addingDocFor, setAddingDocFor] = useState<string | null>(null);

  const fetchKnowledgeBases = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/knowledge-bases");
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to load knowledge bases.");
      setKnowledgeBases(data.knowledgeBases || []);
    } catch (err: any) {
      setError(err?.message || "Failed to load knowledge bases.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchKnowledgeBases();
  }, []);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/knowledge-bases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), description: newDescription.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to create knowledge base.");
      setShowCreateDialog(false);
      setNewName("");
      setNewDescription("");
      setSuccess("Knowledge base created.");
      setTimeout(() => setSuccess(null), 3000);
      fetchKnowledgeBases();
    } catch (err: any) {
      setError(err?.message || "Failed to create knowledge base.");
    } finally {
      setCreating(false);
    }
  };

  const handleAddDocument = async (kbId: string) => {
    if (!docTitle.trim() || !docContent.trim()) return;
    setError(null);
    try {
      const res = await fetch(`/api/knowledge-bases/${kbId}/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: docTitle.trim(), content: docContent.trim(), sourceType: "TEXT" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to add document.");
      setDocTitle("");
      setDocContent("");
      setAddingDocFor(null);
      fetchKnowledgeBases();
    } catch (err: any) {
      setError(err?.message || "Failed to add document.");
    }
  };

  const handleDeleteDocument = async (kbId: string, docId: string) => {
    setError(null);
    try {
      const res = await fetch(`/api/knowledge-bases/${kbId}/documents/${docId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to delete document.");
      fetchKnowledgeBases();
    } catch (err: any) {
      setError(err?.message || "Failed to delete document.");
    }
  };

  const handleDeleteKb = async (kbId: string) => {
    if (!window.confirm("Delete this knowledge base? Agents using it will lose access to its documents.")) return;
    setError(null);
    try {
      const res = await fetch(`/api/knowledge-bases/${kbId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to delete knowledge base.");
      fetchKnowledgeBases();
    } catch (err: any) {
      setError(err?.message || "Failed to delete knowledge base.");
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold tracking-tight text-foreground">Knowledge Base</h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/15 text-indigo-500 dark:text-indigo-400 border border-indigo-500/30">
              Global
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Shared knowledge sources any AI agent can answer from — create once, attach to as many agents as you like.
          </p>
        </div>

        {canMutate && (
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="w-3.5 h-3.5" />
            <span>New Knowledge Base</span>
          </Button>
        )}
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="w-4 h-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {success && (
        <Alert className="border-emerald-500/20 text-emerald-400 [&_svg]:text-emerald-400">
          <CheckCircle2 className="w-4 h-4" />
          <AlertDescription className="text-emerald-400/90">{success}</AlertDescription>
        </Alert>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      ) : knowledgeBases.length === 0 ? (
        <EmptyState
          icon={Database}
          title="No knowledge bases yet"
          description="Create a knowledge base with FAQs, program info, or policies — every AI agent in this workspace can be attached to it."
          primaryAction={
            canMutate ? { label: "New Knowledge Base", icon: Plus, onClick: () => setShowCreateDialog(true) } : undefined
          }
        />
      ) : (
        <div className="space-y-3">
          {knowledgeBases.map((kb) => {
            const isExpanded = expandedId === kb.id;
            return (
              <Card key={kb.id} className="p-0 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setExpandedId(isExpanded ? null : kb.id)}
                  className="w-full flex items-center justify-between gap-3 p-4 text-left hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2 rounded-lg bg-indigo-500/15 text-indigo-400 border border-indigo-500/25 shrink-0">
                      <Database className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-foreground text-sm truncate">{kb.name}</h3>
                      {kb.description && (
                        <p className="text-xs text-muted-foreground truncate">{kb.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <Badge variant="outline" className="bg-muted/40 text-zinc-400 border-border">
                      {kb.documentCount} doc(s)
                    </Badge>
                    {kb.agents.length > 0 && (
                      <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/20">
                        <Bot className="w-3 h-3" />
                        <span>{kb.agents.length} agent(s)</span>
                      </Badge>
                    )}
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    )}
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-border p-4 space-y-4">
                    {kb.agents.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {kb.agents.map((a) => (
                          <Badge key={a.id} variant="outline" className="text-[10px] bg-muted/30">
                            {a.name}
                          </Badge>
                        ))}
                      </div>
                    )}

                    <div className="space-y-2">
                      {kb.documents.length === 0 ? (
                        <p className="text-xs text-muted-foreground py-2">No documents yet.</p>
                      ) : (
                        kb.documents.map((doc) => (
                          <div
                            key={doc.id}
                            className="flex items-center justify-between gap-2 p-2.5 rounded-lg border border-border/60 text-xs"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              {doc.sourceType === "URL" ? (
                                <Link2 className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                              ) : (
                                <FileText className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                              )}
                              <span className="font-medium text-zinc-200 truncate">{doc.title}</span>
                            </div>
                            {canMutate && (
                              <button
                                type="button"
                                onClick={() => handleDeleteDocument(kb.id, doc.id)}
                                className="text-zinc-500 hover:text-rose-400 transition-colors shrink-0"
                                aria-label="Delete document"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        ))
                      )}
                    </div>

                    {canMutate && (
                      <>
                        {addingDocFor === kb.id ? (
                          <div className="space-y-2 p-3 rounded-lg border border-dashed border-border">
                            <Input
                              placeholder="Document title (e.g. Fee Structure FAQ)"
                              value={docTitle}
                              onChange={(e) => setDocTitle(e.target.value)}
                            />
                            <Textarea
                              placeholder="Paste the text content the agent should be able to answer from..."
                              value={docContent}
                              onChange={(e) => setDocContent(e.target.value)}
                              rows={4}
                            />
                            <div className="flex gap-2">
                              <Button size="sm" onClick={() => handleAddDocument(kb.id)} isDisabled={!docTitle.trim() || !docContent.trim()}>
                                Save Document
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => setAddingDocFor(null)}>
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between">
                            <Button size="sm" variant="outline" onClick={() => setAddingDocFor(kb.id)}>
                              <Plus className="w-3.5 h-3.5" />
                              <span>Add Document</span>
                            </Button>
                            <button
                              type="button"
                              onClick={() => handleDeleteKb(kb.id)}
                              className="text-[11px] text-zinc-500 hover:text-rose-400 transition-colors flex items-center gap-1"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>Delete Knowledge Base</span>
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <Dialog isOpen={showCreateDialog} onOpenChange={setShowCreateDialog} isDismissable={!creating}>
        <DialogHeader>
          <DialogTitle>New Knowledge Base</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-xs">
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Programs & Fees FAQ" />
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea value={newDescription} onChange={(e) => setNewDescription(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setShowCreateDialog(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={handleCreate} isDisabled={creating || !newName.trim()}>
            {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Create"}
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
