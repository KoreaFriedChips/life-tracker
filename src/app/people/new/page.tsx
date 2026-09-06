import type { Metadata } from "next";
import PersonForm from "@/components/PersonForm";
import { createPersonAction } from "../actions";

export const metadata: Metadata = {
  title: "Add person",
};

export default async function NewPersonPage({ searchParams }: PageProps<"/people/new">) {
  const params = await searchParams;
  const error = typeof params.error === "string" ? params.error : null;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Add person</h1>

      {error && (
        <div className="rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger-soft-fg">
          {error}
        </div>
      )}

      <PersonForm action={createPersonAction} />
    </div>
  );
}
