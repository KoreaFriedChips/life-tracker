import type { BadgeTone } from "@/components/ui/Badge";

/** ≤30 days: green. 31-90 days: amber. >90 days or never contacted: red. */
export function stalenessTone(daysSinceContact: number | null): BadgeTone {
  if (daysSinceContact !== null && daysSinceContact <= 30) return "success";
  if (daysSinceContact !== null && daysSinceContact <= 90) return "warning";
  return "danger";
}

export function stalenessLabel(daysSinceContact: number | null): string {
  return daysSinceContact === null ? "never" : `last talked: ${daysSinceContact} days ago`;
}
