"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { GraphData, KnowledgeType } from "@/db/repo/knowledge";
import { buttonClassName } from "@/components/ui/Button";

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), { ssr: false });

const TYPE_COLORS: Record<KnowledgeType, string> = {
  book: "#3b82f6",
  article: "#22c55e",
  paper: "#f97316",
};

const TYPE_LABELS: Record<KnowledgeType, string> = {
  book: "Book",
  article: "Article",
  paper: "Paper",
};

function GraphLegend() {
  return (
    <div className="absolute left-3 top-3 z-10 flex flex-col gap-1.5 rounded-lg border border-border bg-surface/90 px-3 py-2 text-xs shadow-xs backdrop-blur">
      {(Object.keys(TYPE_COLORS) as KnowledgeType[]).map((type) => (
        <div key={type} className="flex items-center gap-2">
          <span
            className="inline-block h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: TYPE_COLORS[type] }}
          />
          <span className="text-muted">{TYPE_LABELS[type]}</span>
        </div>
      ))}
    </div>
  );
}

/** Canvas can't use CSS vars directly — resolve the --muted token and track theme changes. */
function useNodeLabelColor(): string {
  const [color, setColor] = useState("#71717a");

  useEffect(() => {
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () =>
      setColor(getComputedStyle(document.documentElement).getPropertyValue("--muted").trim());
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, []);

  return color;
}

/** Renders the knowledge graph: node/edge canvas, a type-color legend, and an empty-DB fallback. */
export default function KnowledgeGraph({ nodes, links }: GraphData) {
  const router = useRouter();
  const labelColor = useNodeLabelColor();

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

  return (
    <div className="relative h-[75vh] w-full overflow-hidden rounded-xl border border-border bg-surface shadow-xs">
      <GraphLegend />
      {/*
        react-force-graph-2d's props are generic over the node/link shape, but next/dynamic's
        wrapping collapses that to the library's untyped base object — so the accessor callbacks
        below take `unknown` and narrow internally to our known GraphData node/link shape.
      */}
      <ForceGraph2D
        graphData={{ nodes, links }}
        nodeLabel={(node: unknown) => (node as { title: string }).title}
        nodeColor={(node: unknown) => TYPE_COLORS[(node as { type: KnowledgeType }).type]}
        linkLabel={(link: unknown) => (link as { label: string | null }).label ?? ""}
        nodeCanvasObject={(node: unknown, ctx: CanvasRenderingContext2D, globalScale: number) => {
          const { x, y, title, type } = node as {
            x?: number;
            y?: number;
            title: string;
            type: KnowledgeType;
          };
          if (x === undefined || y === undefined) return;

          ctx.beginPath();
          ctx.arc(x, y, 4, 0, 2 * Math.PI, false);
          ctx.fillStyle = TYPE_COLORS[type];
          ctx.fill();

          const fontSize = 12 / globalScale;
          ctx.font = `${fontSize}px sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "top";
          ctx.fillStyle = labelColor;
          ctx.fillText(title, x, y + 6);
        }}
        onNodeClick={(node: unknown) => {
          const id = (node as { id?: string | number }).id;
          if (id !== undefined) router.push(`/knowledge/${id}`);
        }}
      />
    </div>
  );
}
