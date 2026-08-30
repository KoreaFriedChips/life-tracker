import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/db/client";
import { getKnowledgeEntry, listConnectionsForEntry, listKnowledgeEntries } from "@/db/repo/knowledge";
import Markdown from "@/components/Markdown";
import TagList from "@/components/TagList";
import DeleteButton from "@/components/DeleteButton";
import Badge from "@/components/ui/Badge";
import { Button, ButtonLink } from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { Input, Select } from "@/components/ui/fields";
import { addConnectionAction, deleteConnectionAction, deleteEntryAction } from "../actions";

export async function generateMetadata({
  params,
}: PageProps<"/knowledge/[id]">): Promise<Metadata> {
  const { id: idParam } = await params;
  const id = Number(idParam);
  const entry = Number.isFinite(id) ? await getKnowledgeEntry(await getDb(), id) : null;
  return { title: entry?.title ?? "Entry not found" };
}

export default async function KnowledgeEntryPage({
  params,
  searchParams,
}: PageProps<"/knowledge/[id]">) {
  const { id: idParam } = await params;
  const id = Number(idParam);
  const search = await searchParams;
  const error = typeof search.error === "string" ? search.error : null;

  const db = await getDb();
  const entry = Number.isFinite(id) ? await getKnowledgeEntry(db, id) : null;
  if (!entry) notFound();

  const entryConnections = await listConnectionsForEntry(db, entry.id);
  const otherEntries = (await listKnowledgeEntries(db)).filter((other) => other.id !== entry.id);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-8">
      {error && (
        <div className="rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger-soft-fg">
          {error}
        </div>
      )}

      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{entry.title}</h1>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="neutral">{entry.type}</Badge>
            <Badge tone="neutral">{entry.status.replaceAll("_", " ")}</Badge>
            <TagList tags={entry.tags} />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ButtonLink href={`/knowledge/${entry.id}/edit`} variant="secondary" size="sm">
            Edit
          </ButtonLink>
          <DeleteButton
            action={deleteEntryAction}
            hiddenId={entry.id}
            confirmMessage={`Delete "${entry.title}"? This also deletes its connections.`}
          >
            Delete
          </DeleteButton>
        </div>
      </div>

      {entry.authors.length > 0 && (
        <p className="text-sm text-muted">
          <span className="font-medium text-foreground">Authors:</span> {entry.authors.join(", ")}
        </p>
      )}

      {entry.notes && <Markdown>{entry.notes}</Markdown>}

      <section>
        <Card className="p-0">
          <h2 className="border-b border-border px-4 py-3 text-sm font-semibold">Connections</h2>

          {entryConnections.length === 0 ? (
            <p className="px-4 py-3 text-sm text-muted">No connections yet.</p>
          ) : (
            <div className="divide-y divide-border px-4">
              {entryConnections.map((connection) => (
                <div key={connection.id} className="flex items-center justify-between gap-2 py-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/knowledge/${connection.otherEntryId}`}
                      className="text-sm font-medium transition-colors hover:text-accent"
                    >
                      {connection.otherEntryTitle}
                    </Link>
                    {connection.label && (
                      <span className="text-sm text-muted">{connection.label}</span>
                    )}
                  </div>
                  <form action={deleteConnectionAction}>
                    <input type="hidden" name="id" value={connection.id} />
                    <input type="hidden" name="entryId" value={entry.id} />
                    <input type="hidden" name="otherEntryId" value={connection.otherEntryId} />
                    <Button type="submit" variant="danger" size="sm">
                      Remove
                    </Button>
                  </form>
                </div>
              ))}
            </div>
          )}

          {otherEntries.length > 0 && (
            <form
              action={addConnectionAction}
              className="flex flex-wrap items-center gap-2 border-t border-border px-4 py-3"
            >
              <input type="hidden" name="entryId" value={entry.id} />
              <Select name="otherEntryId" required>
                {otherEntries.map((other) => (
                  <option key={other.id} value={other.id}>
                    {other.title}
                  </option>
                ))}
              </Select>
              <Input type="text" name="label" placeholder="Label (optional)" />
              <Button type="submit" size="sm">
                Connect
              </Button>
            </form>
          )}
        </Card>
      </section>
    </div>
  );
}
