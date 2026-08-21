import type { Metadata } from "next";
import EntryForm from "@/components/EntryForm";
import { createEntryAction } from "../actions";

export const metadata: Metadata = {
  title: "Add entry",
};

export default function NewKnowledgeEntryPage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Add entry</h1>
      <EntryForm action={createEntryAction} />
    </div>
  );
}
