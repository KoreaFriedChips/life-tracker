import type { Person } from "@/db/repo/people";
import { Button } from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { Field, Input, Textarea } from "@/components/ui/fields";

/** Shared form for creating and editing a person. Pass `person` to pre-fill for edit. */
export default function PersonForm({
  person,
  action,
}: {
  person?: Person;
  action: (formData: FormData) => void | Promise<void>;
}) {
  return (
    <Card className="p-5">
      <form action={action} className="flex flex-col gap-4">
        {person && <input type="hidden" name="id" value={person.id} />}

        <Field label="Name">
          <Input type="text" name="name" required defaultValue={person?.name} />
        </Field>

        <Field label="Relationship tags">
          <Input
            type="text"
            name="relationshipTags"
            placeholder="Comma-separated, e.g. friend, coworker"
            defaultValue={person?.relationshipTags.join(", ")}
          />
        </Field>

        <Field label="How we met">
          <Input type="text" name="howWeMet" defaultValue={person?.howWeMet} />
        </Field>

        <Field label="Birthday">
          <Input
            type="text"
            name="birthday"
            placeholder="YYYY-MM-DD, or --MM-DD if year unknown"
            pattern="\d{4}-\d{2}-\d{2}|--\d{2}-\d{2}"
            defaultValue={person?.birthday ?? ""}
          />
        </Field>

        <Field label="Impression notes">
          <Textarea
            name="notes"
            placeholder="Markdown supported"
            rows={6}
            defaultValue={person?.notes}
          />
        </Field>

        <div>
          <Button type="submit">{person ? "Save" : "Add person"}</Button>
        </div>
      </form>
    </Card>
  );
}
