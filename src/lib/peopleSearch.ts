export interface PersonSearchFields {
  name: string;
  relationshipTags: string[];
}

/**
 * Case-insensitive substring filter over a person's name and relationship
 * tags. An empty or whitespace-only query returns the list unchanged.
 */
export function filterPeopleByQuery<T extends PersonSearchFields>(people: T[], query: string): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return people;
  return people.filter(
    (p) => p.name.toLowerCase().includes(q) || p.relationshipTags.some((t) => t.toLowerCase().includes(q)),
  );
}

/** Every tag in use across the given people, deduplicated and sorted alphabetically. */
export function distinctTags(people: PersonSearchFields[]): string[] {
  return [...new Set(people.flatMap((p) => p.relationshipTags))].sort();
}

/**
 * Keeps people carrying every selected tag (exact match). An empty selection
 * returns the list unchanged.
 */
export function filterPeopleBySelectedTags<T extends PersonSearchFields>(
  people: T[],
  selectedTags: string[],
): T[] {
  if (selectedTags.length === 0) return people;
  return people.filter((p) => selectedTags.every((tag) => p.relationshipTags.includes(tag)));
}
