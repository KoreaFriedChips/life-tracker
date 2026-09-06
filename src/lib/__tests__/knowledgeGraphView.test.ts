import { describe, expect, it } from "vitest";
import type { GraphLink, GraphNode } from "@/db/repo/knowledge";
import {
  collectTags,
  connectionsFor,
  degreesById,
  filterGraph,
  searchMatchIds,
  suggestConnections,
} from "@/lib/knowledgeGraphView";

function node(id: number, title: string, overrides: Partial<GraphNode> = {}): GraphNode {
  return {
    id,
    title,
    type: "book",
    status: "next",
    tags: [],
    authors: [],
    notesExcerpt: "",
    ...overrides,
  };
}

let nextLinkId = 1;
function link(source: number, target: number, label: string | null = null): GraphLink {
  return { id: nextLinkId++, source, target, label };
}

const NO_FILTERS = { types: [], status: "", tag: "" } as const;

describe("filterGraph", () => {
  it("returns all nodes and links when no filters are set", () => {
    const data = { nodes: [node(1, "A"), node(2, "B")], links: [link(1, 2)] };
    expect(filterGraph(data, NO_FILTERS)).toEqual(data);
  });

  it("keeps only nodes matching any of the selected types", () => {
    const data = {
      nodes: [node(1, "A"), node(2, "B", { type: "video" }), node(3, "C", { type: "paper" })],
      links: [],
    };
    const filtered = filterGraph(data, { ...NO_FILTERS, types: ["book", "video"] });
    expect(filtered.nodes.map((n) => n.id)).toEqual([1, 2]);
  });

  it("keeps only nodes matching the selected status", () => {
    const data = {
      nodes: [node(1, "A", { status: "completed" }), node(2, "B")],
      links: [],
    };
    const filtered = filterGraph(data, { ...NO_FILTERS, status: "completed" });
    expect(filtered.nodes.map((n) => n.id)).toEqual([1]);
  });

  it("keeps only nodes carrying the selected tag", () => {
    const data = {
      nodes: [node(1, "A", { tags: ["ml", "math"] }), node(2, "B", { tags: ["ml"] }), node(3, "C")],
      links: [],
    };
    const filtered = filterGraph(data, { ...NO_FILTERS, tag: "math" });
    expect(filtered.nodes.map((n) => n.id)).toEqual([1]);
  });

  it("drops links that touch a filtered-out node", () => {
    const kept = link(1, 3);
    const data = {
      nodes: [node(1, "A"), node(2, "B", { type: "video" }), node(3, "C")],
      links: [link(1, 2), kept],
    };
    const filtered = filterGraph(data, { ...NO_FILTERS, types: ["book"] });
    expect(filtered.links).toEqual([kept]);
  });
});

describe("searchMatchIds", () => {
  it("matches titles case-insensitively by substring", () => {
    const nodes = [node(1, "Deep Learning"), node(2, "Sleep")];
    expect(searchMatchIds(nodes, "deep")).toEqual(new Set([1]));
  });

  it("matches tags as well as titles", () => {
    const nodes = [node(1, "A", { tags: ["psychology"] }), node(2, "B")];
    expect(searchMatchIds(nodes, "PSYCH")).toEqual(new Set([1]));
  });

  it("returns an empty set for a blank query", () => {
    const nodes = [node(1, "A")];
    expect(searchMatchIds(nodes, "   ")).toEqual(new Set());
  });
});

describe("degreesById", () => {
  it("counts how many links touch each node", () => {
    const degrees = degreesById([link(1, 2), link(1, 3)]);
    expect(degrees.get(1)).toBe(2);
    expect(degrees.get(2)).toBe(1);
    expect(degrees.get(4)).toBeUndefined();
  });

  it("reads endpoints force-graph has mutated into node object refs", () => {
    const mutated = [{ id: 1, source: { id: 1 }, target: { id: 2 }, label: null }];
    const degrees = degreesById(mutated);
    expect(degrees.get(1)).toBe(1);
    expect(degrees.get(2)).toBe(1);
  });
});

describe("connectionsFor", () => {
  it("resolves the other node's id/title and the connection id from either side of a link", () => {
    const first = link(1, 2, "cites");
    const second = link(3, 1);
    const data = {
      nodes: [node(1, "A"), node(2, "B"), node(3, "C")],
      links: [first, second],
    };
    expect(connectionsFor(data, 1)).toEqual([
      { connectionId: first.id, otherId: 2, otherTitle: "B", label: "cites" },
      { connectionId: second.id, otherId: 3, otherTitle: "C", label: null },
    ]);
  });
});

describe("suggestConnections", () => {
  it("suggests unconnected entries sharing tags or authors, listing what is shared", () => {
    const data = {
      nodes: [
        node(1, "A", { tags: ["ml"], authors: ["Sutton"] }),
        node(2, "B", { tags: ["ml"] }),
        node(3, "C", { authors: ["Sutton"] }),
        node(4, "D", { tags: ["cooking"] }),
      ],
      links: [],
    };
    expect(suggestConnections(data, 1)).toEqual([
      { id: 2, title: "B", shared: ["ml"] },
      { id: 3, title: "C", shared: ["Sutton"] },
    ]);
  });

  it("excludes the entry itself and entries already connected in either direction", () => {
    const data = {
      nodes: [
        node(1, "A", { tags: ["ml"] }),
        node(2, "B", { tags: ["ml"] }),
        node(3, "C", { tags: ["ml"] }),
      ],
      links: [link(2, 1)],
    };
    expect(suggestConnections(data, 1)).toEqual([{ id: 3, title: "C", shared: ["ml"] }]);
  });

  it("ranks by overlap size, breaks ties by title, and respects the limit", () => {
    const data = {
      nodes: [
        node(1, "A", { tags: ["ml", "rl"], authors: ["Sutton"] }),
        node(2, "Zeta", { tags: ["ml"] }),
        node(3, "Both shared", { tags: ["ml", "rl"] }),
        node(4, "Alpha", { tags: ["ml"] }),
      ],
      links: [],
    };
    expect(suggestConnections(data, 1, 2)).toEqual([
      { id: 3, title: "Both shared", shared: ["ml", "rl"] },
      { id: 4, title: "Alpha", shared: ["ml"] },
    ]);
  });
});

describe("collectTags", () => {
  it("returns the sorted union of all node tags", () => {
    const nodes = [node(1, "A", { tags: ["ml", "math"] }), node(2, "B", { tags: ["ml", "art"] })];
    expect(collectTags(nodes)).toEqual(["art", "math", "ml"]);
  });
});
