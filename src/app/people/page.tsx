import type { Metadata } from "next";
import { getDb } from "@/db/client";
import { listPeopleWithStaleness } from "@/db/repo/people";
import PeopleListFilter from "@/components/PeopleListFilter";
import { ButtonLink } from "@/components/ui/Button";

export const metadata: Metadata = {
  title: "People",
};

export const dynamic = "force-dynamic";

export default function PeoplePage() {
  const db = getDb();
  const people = listPeopleWithStaleness(db);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">People</h1>
        <ButtonLink href="/people/new" size="sm">
          Add person
        </ButtonLink>
      </div>

      <PeopleListFilter people={people} />
    </div>
  );
}
