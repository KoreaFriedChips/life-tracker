import type { KnowledgeEntry } from "@/db/repo/knowledge";
import { Button } from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { Field, Input, Select, Textarea } from "@/components/ui/fields";

/** Shared form for creating and editing a knowledge entry. Pass `entry` to pre-fill for edit. */
export default function EntryForm({
  entry,
  action,
}: {
  entry?: KnowledgeEntry;
  action: (formData: FormData) => void | Promise<void>;
}) {
  return (
    <Card className="p-5">
      <form action={action} className="flex flex-col gap-4">
        {entry && <input type="hidden" name="id" value={entry.id} />}

        <Field label="Title">
          <Input type="text" name="title" required defaultValue={entry?.title} />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Type">
            <Select name="type" defaultValue={entry?.type ?? "book"}>
              <option value="book">Book</option>
              <option value="article">Article</option>
              <option value="paper">Paper</option>
            </Select>
          </Field>

          <Field label="Status">
            <Select name="status" defaultValue={entry?.status ?? "want_to_read"}>
              <option value="want_to_read">Want to read</option>
              <option value="reading">Reading</option>
              <option value="finished">Finished</option>
            </Select>
          </Field>
        </div>

        <Field label="Authors">
          <Input
            type="text"
            name="authors"
            placeholder="Comma-separated"
            defaultValue={entry?.authors.join(", ")}
          />
        </Field>

        <Field label="Tags">
          <Input
            type="text"
            name="tags"
            placeholder="Comma-separated"
            defaultValue={entry?.tags.join(", ")}
          />
        </Field>

        <Field label="Notes">
          <Textarea
            name="notes"
            placeholder="Markdown supported"
            rows={6}
            defaultValue={entry?.notes}
          />
        </Field>

        <div>
          <Button type="submit">{entry ? "Save" : "Add entry"}</Button>
        </div>
      </form>
    </Card>
  );
}
