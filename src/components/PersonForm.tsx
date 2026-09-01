"use client";

import type { Person } from "@/db/repo/people";
import { isFutureBirthday, parseBirthday } from "@/lib/birthdays";
import { localToday } from "@/lib/dates";
import { Button } from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { Field, Input, Textarea } from "@/components/ui/fields";

/**
 * Native-validation message for the birthday field, or "" when submittable.
 * Mirrors the server's checks (src/app/people/actions.ts) so an invalid
 * birthday blocks submit in place instead of round-tripping through the
 * ?error= redirect, which would discard every other field the user typed.
 */
function birthdayValidationMessage(value: string): string {
  const birthday = value.trim();
  if (birthday === "") return "";
  if (!parseBirthday(birthday)) return "Birthday must be YYYY-MM-DD or --MM-DD.";
  const today = localToday(Intl.DateTimeFormat().resolvedOptions().timeZone);
  return isFutureBirthday(birthday, today) ? "Birthday can't be in the future." : "";
}

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
            onChange={(e) =>
              e.currentTarget.setCustomValidity(birthdayValidationMessage(e.currentTarget.value))
            }
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
