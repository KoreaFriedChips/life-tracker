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
