import type { BadgeTone } from "@/components/ui/Badge";
import type { GoalHorizon, GoalStatus } from "@/db/repo/goals";

export const HORIZON_LABELS: Record<GoalHorizon, string> = {
  short: "Short term",
  long: "Long term",
};

export const STATUS_LABELS: Record<GoalStatus, string> = {
  active: "Active",
  achieved: "Achieved",
  dropped: "Dropped",
};

export interface TargetBadge {
  tone: BadgeTone;
  text: string;
}

/**
 * How a goal's target date should read next to its title, or null when it has none.
 * Mirrors the overdue treatment to-dos give their due dates.
 */
export function targetBadge(targetDate: string | null, today: string): TargetBadge | null {
  if (!targetDate) return null;
  if (targetDate < today) return { tone: "danger", text: `overdue · ${targetDate}` };
  if (targetDate === today) return { tone: "warning", text: `due today` };
  return { tone: "neutral", text: `by ${targetDate}` };
}
