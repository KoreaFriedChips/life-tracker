import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDb } from "@/db/client";
import { getKnowledgeEntry } from "@/db/repo/knowledge";
import EntryForm from "@/components/EntryForm";
import { updateEntryAction } from "../../actions";

export async function generateMetadata({
  params,
}: PageProps<"/knowledge/[id]/edit">): Promise<Metadata> {
  const { id: idParam } = await params;
  const id = Number(idParam);
  const entry = Number.isFinite(id) ? await getKnowledgeEntry(await getDb(), id) : null;
  return { title: entry ? `Edit ${entry.title}` : "Entry not found" };
}

export default async function EditKnowledgeEntryPage({ params }: PageProps<"/knowledge/[id]/edit">) {
  const { id: idParam } = await params;
  const id = Number(idParam);

  const entry = Number.isFinite(id) ? await getKnowledgeEntry(await getDb(), id) : null;
  if (!entry) notFound();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Edit {entry.title}</h1>
      <EntryForm entry={entry} action={updateEntryAction} />
    </div>
  );
}
