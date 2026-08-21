import type { Metadata } from "next";
import { getDb } from "@/db/client";
import { getGraphData } from "@/db/repo/knowledge";
import KnowledgeGraph from "@/components/KnowledgeGraph";

export const metadata: Metadata = {
  title: "Graph",
};

export const dynamic = "force-dynamic";

export default function KnowledgeGraphPage() {
  const db = getDb();
  const graphData = getGraphData(db);

  return (
    <div className="flex w-full flex-1 flex-col gap-4 px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Knowledge graph</h1>
      <KnowledgeGraph nodes={graphData.nodes} links={graphData.links} />
    </div>
  );
}
