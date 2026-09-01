import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDb } from "@/db/client";
import { getPerson, listTouchpoints } from "@/db/repo/people";
import { localToday } from "@/lib/dates";
import { getViewerTimeZone } from "@/lib/timezone";
import Markdown from "@/components/Markdown";
import TagList from "@/components/TagList";
import DeleteButton from "@/components/DeleteButton";
import { Button, ButtonLink } from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { Input } from "@/components/ui/fields";
import { addTouchpointAction, deletePersonAction, deleteTouchpointAction } from "../actions";

export async function generateMetadata({ params }: PageProps<"/people/[id]">): Promise<Metadata> {
  const { id: idParam } = await params;
  const id = Number(idParam);
  const person = Number.isFinite(id) ? await getPerson(await getDb(), id) : null;
  return { title: person?.name ?? "Person not found" };
}

export default async function PersonPage({ params }: PageProps<"/people/[id]">) {
  const { id: idParam } = await params;
  const id = Number(idParam);

  const tz = await getViewerTimeZone();
  const db = await getDb();
  const person = Number.isFinite(id) ? await getPerson(db, id) : null;
  if (!person) notFound();

  const touchpoints = await listTouchpoints(db, id);
  const today = localToday(tz);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-8">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{person.name}</h1>
          <TagList tags={person.relationshipTags} />
        </div>
        <div className="flex items-center gap-2">
          <ButtonLink href={`/people/${person.id}/edit`} variant="secondary" size="sm">
            Edit
          </ButtonLink>
          <DeleteButton
            action={deletePersonAction}
            hiddenId={person.id}
            confirmMessage={`Delete ${person.name}? This also deletes their touchpoints.`}
          >
            Delete
          </DeleteButton>
        </div>
      </div>

      {person.howWeMet && (
        <p className="text-sm text-muted">
          <span className="font-medium text-foreground">How we met:</span> {person.howWeMet}
        </p>
      )}

      {person.notes && <Markdown>{person.notes}</Markdown>}

      <section>
        <Card className="p-0">
          <h2 className="border-b border-border px-4 py-3 text-sm font-semibold">Touchpoints</h2>

          <form
            action={addTouchpointAction}
            className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3"
          >
            <input type="hidden" name="personId" value={person.id} />
            <Input type="date" name="date" required defaultValue={today} />
            <Input
              type="text"
              name="summary"
              placeholder="What happened..."
              required
              className="min-w-[10rem] flex-1"
            />
            <Button type="submit" size="sm">
              Add
            </Button>
          </form>

          {touchpoints.length === 0 ? (
            <p className="px-4 py-3 text-sm text-muted">No touchpoints yet.</p>
          ) : (
            <div className="divide-y divide-border px-4">
              {touchpoints.map((touchpoint) => (
                <div key={touchpoint.id} className="flex items-start justify-between gap-2 py-2.5">
                  <div>
                    <span className="text-sm font-medium">{touchpoint.date}</span>
                    <p className="text-sm text-muted">{touchpoint.summary}</p>
                  </div>
                  <form action={deleteTouchpointAction}>
                    <input type="hidden" name="id" value={touchpoint.id} />
                    <input type="hidden" name="personId" value={person.id} />
                    <Button type="submit" variant="danger" size="sm">
                      Delete
                    </Button>
                  </form>
                </div>
              ))}
            </div>
          )}
        </Card>
      </section>
    </div>
  );
}
