import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDb } from "@/db/client";
import { getPerson } from "@/db/repo/people";
import PersonForm from "@/components/PersonForm";
import { updatePersonAction } from "../../actions";

export async function generateMetadata({
  params,
}: PageProps<"/people/[id]/edit">): Promise<Metadata> {
  const { id: idParam } = await params;
  const id = Number(idParam);
  const person = Number.isFinite(id) ? await getPerson(await getDb(), id) : null;
  return { title: person ? `Edit ${person.name}` : "Person not found" };
}

export default async function EditPersonPage({ params }: PageProps<"/people/[id]/edit">) {
  const { id: idParam } = await params;
  const id = Number(idParam);

  const person = Number.isFinite(id) ? await getPerson(await getDb(), id) : null;
  if (!person) notFound();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Edit {person.name}</h1>
      <PersonForm person={person} action={updatePersonAction} />
    </div>
  );
}
