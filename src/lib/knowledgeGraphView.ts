import type { GraphNode, KnowledgeStatus, KnowledgeType } from "@/db/repo/knowledge";

/** After the simulation starts, react-force-graph mutates link endpoints from ids into node refs. */
type LinkEndpoint = number | { id: number };

export interface RuntimeGraphLink {
  id: number;
  source: LinkEndpoint;
  target: LinkEndpoint;
  label: string | null;
}

export interface RuntimeGraphData {
  nodes: GraphNode[];
  links: RuntimeGraphLink[];
}

export interface GraphFilters {
  /** Empty means all types. */
  types: readonly KnowledgeType[];
  /** Empty string means all statuses. */
  status: KnowledgeStatus | "";
  /** Empty string means all tags; otherwise an exact tag. */
  tag: string;
}

export interface EntryConnection {
  connectionId: number;
  otherId: number;
  otherTitle: string;
  label: string | null;
}

export interface SuggestedConnection {
  id: number;
  title: string;
  /** The tags and authors this entry has in common with the selected one. */
  shared: string[];
}

function endpointId(endpoint: LinkEndpoint): number {
  return typeof endpoint === "number" ? endpoint : endpoint.id;
}

/** Nodes matching every active filter, plus only the links whose both ends survive. */
export function filterGraph(data: RuntimeGraphData, filters: GraphFilters): RuntimeGraphData {
  const nodes = data.nodes.filter(
    (node) =>
      (filters.types.length === 0 || filters.types.includes(node.type)) &&
      (filters.status === "" || node.status === filters.status) &&
      (filters.tag === "" || node.tags.includes(filters.tag)),
  );
  const keptIds = new Set(nodes.map((node) => node.id));
  const links = data.links.filter(
    (link) => keptIds.has(endpointId(link.source)) && keptIds.has(endpointId(link.target)),
  );
  return { nodes, links };
}

/** Ids of nodes whose title or tags contain the query, case-insensitively. Blank query matches nothing. */
export function searchMatchIds(nodes: GraphNode[], query: string): Set<number> {
  const needle = query.trim().toLowerCase();
  if (!needle) return new Set();
  return new Set(
    nodes
      .filter(
        (node) =>
          node.title.toLowerCase().includes(needle) ||
          node.tags.some((tag) => tag.toLowerCase().includes(needle)),
      )
      .map((node) => node.id),
  );
}

/** How many links touch each node id. Nodes without links are absent. */
export function degreesById(links: RuntimeGraphLink[]): Map<number, number> {
  const degrees = new Map<number, number>();
  for (const link of links) {
    for (const id of [endpointId(link.source), endpointId(link.target)]) {
      degrees.set(id, (degrees.get(id) ?? 0) + 1);
    }
  }
  return degrees;
}

/** Connections touching `entryId`, each resolved to the other node's id/title. */
export function connectionsFor(data: RuntimeGraphData, entryId: number): EntryConnection[] {
  const titlesById = new Map(data.nodes.map((node) => [node.id, node.title]));
  const result: EntryConnection[] = [];
  for (const link of data.links) {
    const source = endpointId(link.source);
    const target = endpointId(link.target);
    if (source !== entryId && target !== entryId) continue;
    const otherId = source === entryId ? target : source;
    result.push({
      connectionId: link.id,
      otherId,
      otherTitle: titlesById.get(otherId) ?? "Unknown entry",
      label: link.label,
    });
  }
  return result;
}

/** The node fields suggestion ranking actually needs — lets callers pass plain entries too. */
export type SuggestionSourceNode = Pick<GraphNode, "id" | "title" | "tags" | "authors">;

/**
 * Unconnected entries sharing at least one tag or author with `entryId`,
 * ranked by overlap size (ties broken by title).
 */
export function suggestConnections(
  data: { nodes: SuggestionSourceNode[]; links: RuntimeGraphLink[] },
  entryId: number,
  limit = 5,
): SuggestedConnection[] {
  const self = data.nodes.find((node) => node.id === entryId);
  if (!self) return [];
  const connectedIds = new Set<number>();
  for (const link of data.links) {
    const source = endpointId(link.source);
    const target = endpointId(link.target);
    if (source === entryId) connectedIds.add(target);
    else if (target === entryId) connectedIds.add(source);
  }
  const selfTags = new Set(self.tags);
  const selfAuthors = new Set(self.authors);

  return data.nodes
    .filter((node) => node.id !== entryId && !connectedIds.has(node.id))
    .map((node) => ({
      id: node.id,
      title: node.title,
      shared: [
        ...node.tags.filter((tag) => selfTags.has(tag)),
        ...node.authors.filter((author) => selfAuthors.has(author)),
      ],
    }))
    .filter((suggestion) => suggestion.shared.length > 0)
    .sort((a, b) => b.shared.length - a.shared.length || a.title.localeCompare(b.title))
    .slice(0, limit);
}

/** Sorted union of every node's tags, for the tag filter dropdown. */
export function collectTags(nodes: GraphNode[]): string[] {
  return [...new Set(nodes.flatMap((node) => node.tags))].sort();
}
