import type { KnowledgeEntry, KnowledgeType } from "@/db/repo/knowledge";
import type { Todo } from "@/db/repo/todos";
import { filterPeopleByQuery, type PersonSearchFields } from "./peopleSearch";

export const PALETTE_GROUP_LIMIT = 5;

export const KNOWLEDGE_TYPES: KnowledgeType[] = ["book", "article", "paper", "video"];

export type CaptureResult = { ok: true } | { ok: false; error: string };

export interface PaletteSource {
  todos: Pick<Todo, "id" | "title" | "done">[];
  people: (PersonSearchFields & { id: number })[];
  entries: Pick<KnowledgeEntry, "id" | "title" | "type" | "authors" | "tags">[];
}

export interface PaletteResults {
  todos: { id: number; title: string }[];
  people: (PersonSearchFields & { id: number })[];
  knowledge: { id: number; title: string; type: KnowledgeType }[];
}

/**
 * Case-insensitive trimmed substring search across open todos (title), people
 * (name + relationship tags), and knowledge entries (title + authors + tags).
 * An empty or whitespace-only query returns empty groups. Each group is capped
 * at PALETTE_GROUP_LIMIT, input order preserved.
 */
export function searchPaletteData(source: PaletteSource, query: string): PaletteResults {
  const q = query.trim().toLowerCase();
  if (!q) return { todos: [], people: [], knowledge: [] };
  const matches = (text: string) => text.toLowerCase().includes(q);
  return {
    todos: source.todos
      .filter((t) => !t.done && matches(t.title))
      .slice(0, PALETTE_GROUP_LIMIT)
      .map((t) => ({ id: t.id, title: t.title })),
    people: filterPeopleByQuery(source.people, q)
      .slice(0, PALETTE_GROUP_LIMIT)
      .map((p) => ({ id: p.id, name: p.name, relationshipTags: p.relationshipTags })),
    knowledge: source.entries
      .filter((e) => matches(e.title) || e.authors.some(matches) || e.tags.some(matches))
      .slice(0, PALETTE_GROUP_LIMIT)
      .map((e) => ({ id: e.id, title: e.title, type: e.type })),
  };
}
