import type { Metadata } from "next";
import Link from "next/link";
import { getDb } from "@/db/client";
import { listKnowledgeEntries } from "@/db/repo/knowledge";
import TagList from "@/components/TagList";
import Badge, { type BadgeTone } from "@/components/ui/Badge";
import { Button, ButtonLink, buttonClassName } from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { Input, Select } from "@/components/ui/fields";

export const metadata: Metadata = {
  title: "Knowledge",
};

const STATUS_TONES: Record<string, BadgeTone> = {
  want_to_read: "neutral",
  reading: "accent",
  finished: "success",
};

export default async function KnowledgePage({ searchParams }: PageProps<"/knowledge">) {
  const params = await searchParams;
  const typeFilter = typeof params.type === "string" ? params.type : "";
  const statusFilter = typeof params.status === "string" ? params.status : "";
  const tagFilter = typeof params.tag === "string" ? params.tag.trim() : "";

  const db = getDb();
  const allEntries = listKnowledgeEntries(db);
  const entries = allEntries.filter((entry) => {
    if (typeFilter && entry.type !== typeFilter) return false;
    if (statusFilter && entry.status !== statusFilter) return false;
    if (tagFilter) {
      const needle = tagFilter.toLowerCase();
      if (!entry.tags.some((tag) => tag.toLowerCase().includes(needle))) return false;
    }
    return true;
  });

  const hasFilters = Boolean(typeFilter || statusFilter || tagFilter);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Knowledge</h1>
        <div className="flex items-center gap-2">
          <ButtonLink href="/knowledge/graph" variant="secondary" size="sm">
            View graph
          </ButtonLink>
          <ButtonLink href="/knowledge/new" size="sm">
            Add entry
          </ButtonLink>
        </div>
      </div>

      <form className="flex flex-wrap items-center gap-2">
        <Select name="type" defaultValue={typeFilter}>
          <option value="">All types</option>
          <option value="book">Book</option>
          <option value="article">Article</option>
          <option value="paper">Paper</option>
        </Select>

        <Select name="status" defaultValue={statusFilter}>
          <option value="">All statuses</option>
          <option value="want_to_read">Want to read</option>
          <option value="reading">Reading</option>
          <option value="finished">Finished</option>
        </Select>

        <Input type="text" name="tag" placeholder="Filter by tag..." defaultValue={tagFilter} />

        <Button type="submit" variant="secondary">
          Filter
        </Button>

        {hasFilters && (
          <Link href="/knowledge" className={buttonClassName("ghost", "sm")}>
            Clear
          </Link>
        )}
      </form>

      {entries.length === 0 ? (
        allEntries.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <p className="text-sm text-muted">No knowledge entries yet.</p>
            <ButtonLink href="/knowledge/new" size="sm">
              Add your first entry
            </ButtonLink>
          </div>
        ) : (
          <p className="text-sm text-muted">No entries found.</p>
        )
      ) : (
        <Card className="p-0">
          <div className="divide-y divide-border">
            {entries.map((entry) => (
              <div key={entry.id} className="flex flex-wrap items-center gap-2 px-4 py-3">
                <Link
                  href={`/knowledge/${entry.id}`}
                  className="text-sm font-medium transition-colors hover:text-accent"
                >
                  {entry.title}
                </Link>
                <Badge tone="neutral">{entry.type}</Badge>
                <Badge tone={STATUS_TONES[entry.status] ?? "neutral"}>
                  {entry.status.replaceAll("_", " ")}
                </Badge>
                <TagList tags={entry.tags} />
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
