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

  beforeEach(async () => {
    db = await createDb(":memory:");
  });

  it("round-trips tags and authors as string arrays", async () => {
    const created = await createKnowledgeEntry(db, {
      title: "Thinking, Fast and Slow",
      type: "book",
      authors: ["Daniel Kahneman"],
      tags: ["psychology", "economics"],
    });

    expect(created.authors).toEqual(["Daniel Kahneman"]);
    expect(created.tags).toEqual(["psychology", "economics"]);

    const fetched = await getKnowledgeEntry(db, created.id);
    expect(fetched).toEqual(created);
  });

  it("stores video entries with a url", async () => {
    const created = await createKnowledgeEntry(db, {
      title: "Attention Is All You Need — explained",
      type: "video",
      url: "https://www.youtube.com/watch?v=iDulhoQ2pro",
    });

    expect(created.type).toBe("video");
    expect(created.url).toBe("https://www.youtube.com/watch?v=iDulhoQ2pro");

    const fetched = await getKnowledgeEntry(db, created.id);
    expect(fetched).toEqual(created);
  });

  it("defaults url to null, sets it on update, and clears it with null", async () => {
    const created = await createKnowledgeEntry(db, { title: "Some Article", type: "article" });
    expect(created.url).toBeNull();

    const updated = await updateKnowledgeEntry(db, created.id, { url: "https://example.com/a" });
    expect(updated.url).toBe("https://example.com/a");

    const cleared = await updateKnowledgeEntry(db, created.id, { url: null });
    expect(cleared.url).toBeNull();
  });

  it("defaults authors, tags, notes, and status when omitted", async () => {
    const created = await createKnowledgeEntry(db, { title: "Some Paper", type: "paper" });
    expect(created.authors).toEqual([]);
    expect(created.tags).toEqual([]);
    expect(created.notes).toBe("");
    expect(created.status).toBe("next");
  });

  it("updates an entry's fields and bumps updatedAt", async () => {
    const created = await createKnowledgeEntry(db, { title: "Draft Title", type: "article" });

    const updated = await updateKnowledgeEntry(db, created.id, {
      title: "Final Title",
      status: "in_progress",
      tags: ["favorites"],
    });

    expect(updated.title).toBe("Final Title");
    expect(updated.status).toBe("in_progress");
    expect(updated.tags).toEqual(["favorites"]);
    expect(updated.updatedAt >= created.updatedAt).toBe(true);
  });

  it("canonicalizes a connection's pair order regardless of argument order", async () => {
    const ids: number[] = [];
    for (let i = 0; i < 5; i++) {
      ids.push((await createKnowledgeEntry(db, { title: `Entry ${i + 1}`, type: "book" })).id);
    }
    expect(ids).toEqual([1, 2, 3, 4, 5]);

    const connection = await addConnection(db, 5, 3, "cites");

    expect(connection.entryIdA).toBe(3);
    expect(connection.entryIdB).toBe(5);
    expect(connection.label).toBe("cites");
  });

  it("rejects a duplicate connection regardless of argument order", async () => {
    const a = await createKnowledgeEntry(db, { title: "A", type: "book" });
    const b = await createKnowledgeEntry(db, { title: "B", type: "article" });

    await addConnection(db, a.id, b.id);

    await expect(addConnection(db, a.id, b.id)).rejects.toThrow();
    await expect(addConnection(db, b.id, a.id)).rejects.toThrow();
  });

  it("rejects a self-connection", async () => {
    const a = await createKnowledgeEntry(db, { title: "A", type: "book" });
    await expect(addConnection(db, a.id, a.id)).rejects.toThrow();
  });

  it("cascades connection deletion when a connected entry is deleted", async () => {
    const a = await createKnowledgeEntry(db, { title: "A", type: "book" });
    const b = await createKnowledgeEntry(db, { title: "B", type: "paper" });
    await addConnection(db, a.id, b.id);

    await deleteKnowledgeEntry(db, a.id);

    const graph = await getGraphData(db);
    expect(graph.nodes.map((n) => n.id)).toEqual([b.id]);
    expect(graph.links).toEqual([]);
  });

  it("getGraphData returns all entries as nodes (including unconnected) plus correct links", async () => {
    const a = await createKnowledgeEntry(db, { title: "A", type: "book" });
    const b = await createKnowledgeEntry(db, { title: "B", type: "article" });
    const unconnected = await createKnowledgeEntry(db, { title: "C", type: "paper" });
    await addConnection(db, a.id, b.id, "similar concepts");

    const graph = await getGraphData(db);

    expect(graph.nodes.map((n) => n.id).sort((x, y) => x - y)).toEqual(
      [a.id, b.id, unconnected.id].sort((x, y) => x - y),
    );
    expect(graph.links).toEqual([{ source: a.id, target: b.id, label: "similar concepts" }]);
  });

  it("listConnectionsForEntry resolves the other entry's id/title from either side of the pair", async () => {
    const a = await createKnowledgeEntry(db, { title: "A", type: "book" });
    const b = await createKnowledgeEntry(db, { title: "B", type: "article" });
    await addConnection(db, b.id, a.id, "cites");

    const fromA = await listConnectionsForEntry(db, a.id);
    expect(fromA).toEqual([{ id: 1, otherEntryId: b.id, otherEntryTitle: "B", label: "cites" }]);

    const fromB = await listConnectionsForEntry(db, b.id);
    expect(fromB).toEqual([{ id: 1, otherEntryId: a.id, otherEntryTitle: "A", label: "cites" }]);
  });
});
