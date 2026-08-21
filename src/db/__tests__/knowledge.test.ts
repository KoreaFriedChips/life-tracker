import { beforeEach, describe, expect, it } from "vitest";
import { createDb, type AppDatabase } from "@/db/client";
import {
  addConnection,
  createKnowledgeEntry,
  deleteKnowledgeEntry,
  getGraphData,
  getKnowledgeEntry,
  listConnectionsForEntry,
  updateKnowledgeEntry,
} from "@/db/repo/knowledge";

describe("knowledge repo", () => {
  let db: AppDatabase;

  beforeEach(() => {
    db = createDb(":memory:");
  });

  it("round-trips tags and authors as string arrays", () => {
    const created = createKnowledgeEntry(db, {
      title: "Thinking, Fast and Slow",
      type: "book",
      authors: ["Daniel Kahneman"],
      tags: ["psychology", "economics"],
    });

    expect(created.authors).toEqual(["Daniel Kahneman"]);
    expect(created.tags).toEqual(["psychology", "economics"]);

    const fetched = getKnowledgeEntry(db, created.id);
    expect(fetched).toEqual(created);
  });

  it("defaults authors, tags, notes, and status when omitted", () => {
    const created = createKnowledgeEntry(db, { title: "Some Paper", type: "paper" });
    expect(created.authors).toEqual([]);
    expect(created.tags).toEqual([]);
    expect(created.notes).toBe("");
    expect(created.status).toBe("want_to_read");
  });

  it("updates an entry's fields and bumps updatedAt", () => {
    const created = createKnowledgeEntry(db, { title: "Draft Title", type: "article" });

    const updated = updateKnowledgeEntry(db, created.id, {
      title: "Final Title",
      status: "reading",
      tags: ["favorites"],
    });

    expect(updated.title).toBe("Final Title");
    expect(updated.status).toBe("reading");
    expect(updated.tags).toEqual(["favorites"]);
    expect(updated.updatedAt >= created.updatedAt).toBe(true);
  });

  it("canonicalizes a connection's pair order regardless of argument order", () => {
    const ids: number[] = [];
    for (let i = 0; i < 5; i++) {
      ids.push(createKnowledgeEntry(db, { title: `Entry ${i + 1}`, type: "book" }).id);
    }
    expect(ids).toEqual([1, 2, 3, 4, 5]);

    const connection = addConnection(db, 5, 3, "cites");

    expect(connection.entryIdA).toBe(3);
    expect(connection.entryIdB).toBe(5);
    expect(connection.label).toBe("cites");
  });

  it("rejects a duplicate connection regardless of argument order", () => {
    const a = createKnowledgeEntry(db, { title: "A", type: "book" });
    const b = createKnowledgeEntry(db, { title: "B", type: "article" });

    addConnection(db, a.id, b.id);

    expect(() => addConnection(db, a.id, b.id)).toThrow();
    expect(() => addConnection(db, b.id, a.id)).toThrow();
  });

  it("rejects a self-connection", () => {
    const a = createKnowledgeEntry(db, { title: "A", type: "book" });
    expect(() => addConnection(db, a.id, a.id)).toThrow();
  });

  it("cascades connection deletion when a connected entry is deleted", () => {
    const a = createKnowledgeEntry(db, { title: "A", type: "book" });
    const b = createKnowledgeEntry(db, { title: "B", type: "paper" });
    addConnection(db, a.id, b.id);

    deleteKnowledgeEntry(db, a.id);

    const graph = getGraphData(db);
    expect(graph.nodes.map((n) => n.id)).toEqual([b.id]);
    expect(graph.links).toEqual([]);
  });

  it("getGraphData returns all entries as nodes (including unconnected) plus correct links", () => {
    const a = createKnowledgeEntry(db, { title: "A", type: "book" });
    const b = createKnowledgeEntry(db, { title: "B", type: "article" });
    const unconnected = createKnowledgeEntry(db, { title: "C", type: "paper" });
    addConnection(db, a.id, b.id, "similar concepts");

    const graph = getGraphData(db);

    expect(graph.nodes.map((n) => n.id).sort((x, y) => x - y)).toEqual(
      [a.id, b.id, unconnected.id].sort((x, y) => x - y),
    );
    expect(graph.links).toEqual([{ source: a.id, target: b.id, label: "similar concepts" }]);
  });

  it("listConnectionsForEntry resolves the other entry's id/title from either side of the pair", () => {
    const a = createKnowledgeEntry(db, { title: "A", type: "book" });
    const b = createKnowledgeEntry(db, { title: "B", type: "article" });
    addConnection(db, b.id, a.id, "cites");

    const fromA = listConnectionsForEntry(db, a.id);
    expect(fromA).toEqual([{ id: 1, otherEntryId: b.id, otherEntryTitle: "B", label: "cites" }]);

    const fromB = listConnectionsForEntry(db, b.id);
    expect(fromB).toEqual([{ id: 1, otherEntryId: a.id, otherEntryTitle: "A", label: "cites" }]);
  });
});
