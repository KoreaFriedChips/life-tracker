import type { Category } from "@/db/repo/todos";
import type { Goal } from "@/db/repo/goals";
import { Button } from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { Field, Input, Select, Textarea } from "@/components/ui/fields";
import { HORIZON_LABELS } from "@/lib/goals";

/** Shared form for creating and editing a goal. Pass `goal` to pre-fill for edit. */
export default function GoalForm({
  goal,
  categories,
  action,
}: {
  goal?: Goal;
  categories: Category[];
  action: (formData: FormData) => void | Promise<void>;
}) {
  return (
    <Card className="p-5">
      <form action={action} className="flex flex-col gap-4">
        {goal && <input type="hidden" name="id" value={goal.id} />}

        <Field label="Goal">
          <Input
            type="text"
            name="title"
            required
            placeholder="e.g. Run a 10k"
            defaultValue={goal?.title}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Horizon">
            <Select name="horizon" defaultValue={goal?.horizon ?? "short"}>
              <option value="short">{HORIZON_LABELS.short}</option>
              <option value="long">{HORIZON_LABELS.long}</option>
            </Select>
          </Field>

          <Field label="Life area">
            <Select name="categoryId" defaultValue={goal?.categoryId ?? ""}>
              <option value="">— none —</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label="Target date (optional)">
          <Input type="date" name="targetDate" defaultValue={goal?.targetDate ?? ""} />
        </Field>

        <Field label="Why this matters">
          <Textarea
            name="notes"
            placeholder="Markdown supported"
            rows={6}
            defaultValue={goal?.notes}
          />
        </Field>

        <div>
          <Button type="submit">{goal ? "Save" : "Add goal"}</Button>
        </div>
      </form>
    </Card>
  );
}
