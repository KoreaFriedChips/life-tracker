"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { GraphData, KnowledgeStatus, KnowledgeType } from "@/db/repo/knowledge";
import {
  collectTags,
  connectionsFor,
  degreesById,
  filterGraph,
  searchMatchIds,
  suggestConnections,
  type GraphFilters,
  type RuntimeGraphData,
} from "@/lib/knowledgeGraphView";
import GraphSidePanel from "@/components/GraphSidePanel";
import { KNOWLEDGE_STATUSES, STATUS_LABELS } from "@/components/knowledgeStatus";
import { buttonClassName } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/fields";

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), { ssr: false });

const TYPE_COLORS: Record<KnowledgeType, string> = {
  book: "#3b82f6",
  article: "#22c55e",
  paper: "#f97316",
  video: "#ef4444",
};

const TYPE_LABELS: Record<KnowledgeType, string> = {
  book: "Book",
  article: "Article",
  paper: "Paper",
  video: "Video",
};

const KNOWLEDGE_TYPES = Object.keys(TYPE_COLORS) as KnowledgeType[];

/** Zoom level below which node titles are hidden (except selected/search-matched nodes). */
const LABEL_MIN_ZOOM = 1.5;
const DIMMED_ALPHA = 0.15;
/** react-force-graph's hit-area radius = nodeRelSize * sqrt(nodeVal). */
const NODE_REL_SIZE = 4;

/** Canvas can't use CSS vars directly — resolve the tokens it needs and track theme changes. */
function useGraphColors(): { label: string; highlight: string } {
  const [colors, setColors] = useState({ label: "#71717a", highlight: "#3b82f6" });

  useEffect(() => {
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => {
      const styles = getComputedStyle(document.documentElement);
      setColors({
        label: styles.getPropertyValue("--muted").trim(),
        highlight: styles.getPropertyValue("--accent").trim(),
      });
    };
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, []);

  return colors;
}

/**
 * Renders the knowledge graph: filter/search toolbar, node/edge canvas with
 * degree-sized nodes, a side panel for the selected entry, and an empty-DB fallback.
 */
export default function KnowledgeGraph({ nodes, links }: GraphData) {
  const colors = useGraphColors();
  const [types, setTypes] = useState<KnowledgeType[]>([]);
  const [status, setStatus] = useState<KnowledgeStatus | "">("");
  const [tag, setTag] = useState("");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const data: RuntimeGraphData = useMemo(() => ({ nodes, links }), [nodes, links]);
  const filters: GraphFilters = useMemo(() => ({ types, status, tag }), [types, status, tag]);
  const filtered = useMemo(() => filterGraph(data, filters), [data, filters]);
  const degrees = useMemo(() => degreesById(filtered.links), [filtered]);
  const matchIds = useMemo(() => searchMatchIds(filtered.nodes, search), [filtered, search]);
  const allTags = useMemo(() => collectTags(nodes), [nodes]);
  const searching = search.trim().length > 0;

  const selected = selectedId === null ? null : (nodes.find((n) => n.id === selectedId) ?? null);
  const selectedConnections = useMemo(
    () => (selectedId === null ? [] : connectionsFor(data, selectedId)),
    [data, selectedId],
  );
  const selectedSuggestions = useMemo(
    () => (selectedId === null ? [] : suggestConnections(data, selectedId)),
    [data, selectedId],
  );
  const connectOptions = useMemo(() => {
    if (selectedId === null) return [];
    const connectedIds = new Set(selectedConnections.map((c) => c.otherId));
    return nodes
      .filter((n) => n.id !== selectedId && !connectedIds.has(n.id))
      .map((n) => ({ id: n.id, title: n.title }))
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [nodes, selectedId, selectedConnections]);

  if (nodes.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 py-24 text-center">
        <p className="text-sm text-muted">No knowledge entries yet — log some entries first.</p>
        <Link href="/knowledge/new" className={buttonClassName("primary", "sm")}>
          Add entry
        </Link>
      </div>
    );
  }

  const nodeRadius = (id: number) => 3 + 1.5 * Math.sqrt(degrees.get(id) ?? 0);

  return (
    <div className="flex flex-1 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {KNOWLEDGE_TYPES.map((type) => {
          const active = types.includes(type);
          return (
            <button
              key={type}
              type="button"
              aria-pressed={active}
              onClick={() =>
                setTypes((current) =>
                  active ? current.filter((t) => t !== type) : [...current, type],
                )
              }
              className={`inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-xs font-medium shadow-xs transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
                active
                  ? "border-accent bg-accent/10 text-foreground"
                  : "border-border bg-surface text-muted hover:border-border-strong hover:text-foreground"
              }`}
            >
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: TYPE_COLORS[type] }}
              />
              {TYPE_LABELS[type]}
            </button>
          );
        })}

        <Select
          value={status}
          onChange={(e) => setStatus(e.target.value as KnowledgeStatus | "")}
          aria-label="Filter by status"
        >
          <option value="">All statuses</option>
          {KNOWLEDGE_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </Select>

        <Select value={tag} onChange={(e) => setTag(e.target.value)} aria-label="Filter by tag">
          <option value="">All tags</option>
          {allTags.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </Select>

        <Input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search title or tag..."
          className="min-w-40"
          aria-label="Search nodes"
        />
      </div>

      <div className="relative h-[75vh] w-full overflow-hidden rounded-lg border border-border bg-surface shadow-card">
        {/*
          react-force-graph-2d's props are generic over the node/link shape, but next/dynamic's
          wrapping collapses that to the library's untyped base object — so the accessor callbacks
          below take `unknown` and narrow internally to our known GraphData node/link shape.
        */}
        {filtered.nodes.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-muted">No entries match the filters.</p>
          </div>
        ) : (
          <ForceGraph2D
            graphData={filtered}
            nodeRelSize={NODE_REL_SIZE}
            nodeVal={(node: unknown) => {
              const radius = nodeRadius((node as { id: number }).id);
              return (radius / NODE_REL_SIZE) ** 2;
            }}
            nodeLabel={(node: unknown) => (node as { title: string }).title}
            linkLabel={(link: unknown) => (link as { label: string | null }).label ?? ""}
            nodeCanvasObject={(
              node: unknown,
              ctx: CanvasRenderingContext2D,
              globalScale: number,
            ) => {
              const { x, y, id, title, type } = node as {
                x?: number;
                y?: number;
                id: number;
                title: string;
                type: KnowledgeType;
              };
              if (x === undefined || y === undefined) return;

              const isSelected = id === selectedId;
              const isMatch = matchIds.has(id);
              const radius = nodeRadius(id);

              ctx.globalAlpha = searching && !isMatch && !isSelected ? DIMMED_ALPHA : 1;

              ctx.beginPath();
              ctx.arc(x, y, radius, 0, 2 * Math.PI, false);
              ctx.fillStyle = TYPE_COLORS[type];
              ctx.fill();

              if (isSelected) {
                ctx.beginPath();
                ctx.arc(x, y, radius + 2, 0, 2 * Math.PI, false);
                ctx.lineWidth = 2 / globalScale;
                ctx.strokeStyle = colors.highlight;
                ctx.stroke();
              }

              if (globalScale >= LABEL_MIN_ZOOM || isSelected || (searching && isMatch)) {
                const fontSize = 12 / globalScale;
                ctx.font = `${fontSize}px sans-serif`;
                ctx.textAlign = "center";
                ctx.textBaseline = "top";
                ctx.fillStyle = colors.label;
                ctx.fillText(title, x, y + radius + 2);
              }

              ctx.globalAlpha = 1;
            }}
            onNodeClick={(node: unknown) => {
              const id = (node as { id?: number }).id;
              if (id !== undefined) setSelectedId(id);
            }}
            onBackgroundClick={() => setSelectedId(null)}
          />
        )}

        {selected && (
          <GraphSidePanel
            node={selected}
            connections={selectedConnections}
            suggestions={selectedSuggestions}
            connectOptions={connectOptions}
            onClose={() => setSelectedId(null)}
            onSelectEntry={setSelectedId}
          />
        )}
      </div>
    </div>
  );
}
