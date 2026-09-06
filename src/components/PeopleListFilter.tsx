"use client";

import { useState } from "react";
import Link from "next/link";
import type { PersonWithStaleness } from "@/db/repo/people";
import { distinctTags, filterPeopleBySelectedTags, filterPeopleByQuery } from "@/lib/peopleSearch";
import TagList from "./TagList";
import { stalenessLabel, stalenessTone } from "@/components/staleness";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import { Input } from "@/components/ui/fields";
import { buttonClassName } from "@/components/ui/Button";

/**
 * Renders the people list with a client-side name/tag filter: a text query
 * plus toggleable tag chips (a person must carry every selected tag).
 * Receives the already-staleness-sorted list as props; does not re-sort.
 */
export default function PeopleListFilter({ people }: { people: PersonWithStaleness[] }) {
  const [query, setQuery] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const tags = distinctTags(people);
  const filtered = filterPeopleBySelectedTags(filterPeopleByQuery(people, query), selectedTags);

  function toggleTag(tag: string) {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by name or tag..."
        aria-label="Search people by name or tag"
      />

      {tags.length > 0 && (
        <ul className="flex flex-wrap gap-1">
          {tags.map((tag) => {
            const selected = selectedTags.includes(tag);
            return (
              <li key={tag}>
                <button
                  type="button"
                  onClick={() => toggleTag(tag)}
                  aria-pressed={selected}
                  className={`rounded-full px-2 py-0.5 text-xs transition-colors ${
                    selected
                      ? "bg-accent-soft font-medium text-accent-soft-fg"
                      : "bg-surface-subtle text-muted hover:text-foreground"
                  }`}
                >
                  {tag}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {filtered.length === 0 ? (
        people.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <p className="text-sm text-muted">No people yet.</p>
            <Link href="/people/new" className={buttonClassName("primary", "sm")}>
              Add your first person
            </Link>
          </div>
        ) : (
          <p className="text-sm text-muted">No people match your filters.</p>
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
