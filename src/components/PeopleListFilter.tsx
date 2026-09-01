"use client";

import { useState } from "react";
import Link from "next/link";
import type { PersonWithStaleness } from "@/db/repo/people";
import { filterPeopleByQuery } from "@/lib/peopleSearch";
import TagList from "./TagList";
import Badge, { type BadgeTone } from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import { Input } from "@/components/ui/fields";
import { buttonClassName } from "@/components/ui/Button";

/** ≤30 days: green. 31-90 days: amber. >90 days or never contacted: red. */
function stalenessTone(daysSinceContact: number | null): BadgeTone {
  if (daysSinceContact !== null && daysSinceContact <= 30) return "success";
  if (daysSinceContact !== null && daysSinceContact <= 90) return "warning";
  return "danger";
}

function stalenessLabel(daysSinceContact: number | null): string {
  return daysSinceContact === null ? "never" : `last talked: ${daysSinceContact} days ago`;
}

/**
 * Renders the people list with a client-side name/tag filter.
 * Receives the already-staleness-sorted list as props; does not re-sort.
 */
export default function PeopleListFilter({ people }: { people: PersonWithStaleness[] }) {
  const [query, setQuery] = useState("");

  const filtered = filterPeopleByQuery(people, query);

  return (
    <div className="flex flex-col gap-4">
      <Input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by name or tag..."
        aria-label="Search people by name or tag"
      />

      {filtered.length === 0 ? (
        people.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <p className="text-sm text-muted">No people yet.</p>
            <Link href="/people/new" className={buttonClassName("primary", "sm")}>
              Add your first person
            </Link>
          </div>
        ) : (
          <p className="text-sm text-muted">No people match your search.</p>
        )
      ) : (
        <Card className="p-0">
          <div className="divide-y divide-border">
            {filtered.map((person) => (
              <div
                key={person.id}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/people/${person.id}`}
                    className="text-sm font-medium transition-colors hover:text-accent"
                  >
                    {person.name}
                  </Link>
                  <TagList tags={person.relationshipTags} />
                </div>
                <Badge tone={stalenessTone(person.daysSinceContact)}>
                  {stalenessLabel(person.daysSinceContact)}
                </Badge>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
