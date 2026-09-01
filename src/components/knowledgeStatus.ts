import type { KnowledgeStatus } from "@/db/repo/knowledge";
import type { BadgeTone } from "@/components/ui/Badge";

/** Display labels and badge tones for knowledge statuses, shared by the list, detail, and form. */
export const STATUS_LABELS: Record<KnowledgeStatus, string> = {
  next: "Next",
  in_progress: "In Progress",
  completed: "Completed",
};

export const STATUS_TONES: Record<KnowledgeStatus, BadgeTone> = {
  next: "neutral",
  in_progress: "accent",
  completed: "success",
};

export const KNOWLEDGE_STATUSES = Object.keys(STATUS_LABELS) as KnowledgeStatus[];
