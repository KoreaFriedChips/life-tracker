import { describe, expect, it } from "vitest";
import { PALETTE_GROUP_LIMIT, searchPaletteData } from "@/lib/paletteSearch";

const groceries = { id: 1, title: "Buy groceries", done: false };
const marcus = { id: 2, title: "Email Marcus", done: false };
const stamps = { id: 3, title: "Buy stamps", done: true };

const ana = { id: 1, name: "Ana Lopez", relationshipTags: ["climbing", "coworker"] };
const maria = { id: 2, name: "Maria Chu", relationshipTags: ["college friend"] };

const systems = {
  id: 1,
  title: "Thinking in Systems",
  type: "book" as const,
  authors: ["Donella Meadows"],
  tags: ["systems"],
};
const attention = {
  id: 2,
  title: "Attention Is All You Need",
  type: "paper" as const,
  authors: ["Vaswani"],
  tags: ["ml", "marketing"],
};

const source = {
  todos: [groceries, marcus, stamps],
  people: [ana, maria],
  entries: [systems, attention],
};

const empty = { todos: [], people: [], knowledge: [] };

describe("searchPaletteData", () => {
  it("returns empty groups for an empty query", () => {
    expect(searchPaletteData(source, "")).toEqual(empty);
  });

  it("returns empty groups for a whitespace-only query", () => {
    expect(searchPaletteData(source, "   ")).toEqual(empty);
  });

  it("matches a todo title substring case-insensitively, trimming the query", () => {
    expect(searchPaletteData(source, "  BUY  ").todos).toEqual([
      { id: 1, title: "Buy groceries" },
    ]);
  });

  it("never returns done todos", () => {
    expect(searchPaletteData(source, "stamps").todos).toEqual([]);
  });

  it("matches a person by name substring", () => {
    expect(searchPaletteData(source, "lopez").people).toEqual([ana]);
  });

  it("matches a person by relationship-tag substring", () => {
    expect(searchPaletteData(source, "college").people).toEqual([maria]);
  });

  it("matches knowledge by title", () => {
    expect(searchPaletteData(source, "thinking").knowledge).toEqual([
      { id: 1, title: "Thinking in Systems", type: "book" },
    ]);
  });

  it("matches knowledge by author", () => {
    expect(searchPaletteData(source, "meadows").knowledge).toEqual([
      { id: 1, title: "Thinking in Systems", type: "book" },
    ]);
  });

  it("matches knowledge by tag", () => {
    expect(searchPaletteData(source, "ml").knowledge).toEqual([
      { id: 2, title: "Attention Is All You Need", type: "paper" },
    ]);
  });

  it("returns each group independently for a query hitting all three", () => {
    expect(searchPaletteData(source, "mar")).toEqual({
      todos: [{ id: 2, title: "Email Marcus" }],
      people: [maria],
      knowledge: [{ id: 2, title: "Attention Is All You Need", type: "paper" }],
    });
  });

  it("caps each group at PALETTE_GROUP_LIMIT preserving input order", () => {
    const many = {
      todos: Array.from({ length: 7 }, (_, i) => ({ id: i + 1, title: `Task ${i + 1}`, done: false })),
      people: [],
      entries: [],
    };
    expect(searchPaletteData(many, "task").todos).toEqual(
      Array.from({ length: PALETTE_GROUP_LIMIT }, (_, i) => ({ id: i + 1, title: `Task ${i + 1}` })),
    );
  });

  it("returns empty groups when nothing matches", () => {
    expect(searchPaletteData(source, "zzz")).toEqual(empty);
  });
});
