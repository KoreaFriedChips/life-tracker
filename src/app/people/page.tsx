import type { Metadata } from "next";
import { getDb } from "@/db/client";
import { listPeopleWithStaleness } from "@/db/repo/people";
import { getViewerTimeZone } from "@/lib/timezone";
import PeopleListFilter from "@/components/PeopleListFilter";
import { ButtonLink } from "@/components/ui/Button";

export const metadata: Metadata = {
  title: "People",
};

export const dynamic = "force-dynamic";

export default async function PeoplePage() {
  const tz = await getViewerTimeZone();
  const db = await getDb();
  const people = await listPeopleWithStaleness(db, tz);

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
