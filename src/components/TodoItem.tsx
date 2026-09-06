"use client";

import { useRef, useState, type ReactNode } from "react";
import type { Category, Todo } from "@/db/repo/todos";
import Badge from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input, Select, Textarea } from "@/components/ui/fields";

/** Everything the inline editor needs. Omit it for read-only rows (Today, calendar). */
export interface TodoEditing {
  categories: Category[];
  updateTodo: (formData: FormData) => void | Promise<void>;
  deleteTodo: (formData: FormData) => void | Promise<void>;
}

/**
 * Row for a to-do. The checkbox auto-submits a toggle server action; when
 * `editing` is supplied, an "Edit" button expands an inline form for the
 * title, due date, category and notes.
 *
 * `notes` is the pre-rendered Markdown of `todo.notes`, rendered on the server
 * so react-markdown stays out of the client bundle.
 */
export default function TodoItem({
  todo,
  overdue,
  notes,
  toggleTodo,
  editing,
}: {
  todo: Todo;
  overdue: boolean;
  notes: ReactNode;
  toggleTodo: (formData: FormData) => void | Promise<void>;
  editing?: TodoEditing;
}) {
  const toggleFormRef = useRef<HTMLFormElement>(null);
  const [open, setOpen] = useState(false);

  async function save(formData: FormData) {
    await editing?.updateTodo(formData);
    setOpen(false);
  }

  return (
    <div className="py-2.5">
      <div className="flex items-start gap-3">
        <form ref={toggleFormRef} action={toggleTodo} className="flex">
          <input type="hidden" name="id" value={todo.id} />
          <input
            type="checkbox"
            defaultChecked={todo.done}
            onChange={() => toggleFormRef.current?.requestSubmit()}
            aria-label={`Mark "${todo.title}" done`}
            className="mt-0.5 size-5 shrink-0 cursor-pointer sm:size-4"
          />
        </form>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-2">
            <span className={todo.done ? "text-sm text-muted line-through" : "text-sm"}>
              {todo.title}
            </span>
            {todo.dueDate && (
              <Badge tone={overdue ? "danger" : "neutral"}>
                {overdue ? `overdue · ${todo.dueDate}` : todo.dueDate}
              </Badge>
            )}
          </div>
          {!open && todo.notes && (
            <div className="mt-0.5 [&>.markdown]:text-xs [&>.markdown]:text-muted">{notes}</div>
          )}
        </div>

        {editing && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-expanded={open}
            onClick={() => setOpen((wasOpen) => !wasOpen)}
          >
            {open ? "Cancel" : "Edit"}
          </Button>
        )}
      </div>

      {editing && open && (
        <div className="mt-3 flex flex-col gap-2 rounded-lg border border-border bg-surface-subtle p-3">
          <form action={save} className="flex flex-col gap-2">
            <input type="hidden" name="id" value={todo.id} />
            <Input
              type="text"
              name="title"
              defaultValue={todo.title}
              aria-label="Title"
              required
            />
            <div className="flex flex-wrap gap-2">
              <Input
                type="date"
                name="dueDate"
                defaultValue={todo.dueDate ?? ""}
                aria-label="Due date"
              />
              <Select
                name="categoryId"
                defaultValue={todo.categoryId}
                aria-label="Category"
                className="flex-1"
              >
                {editing.categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </Select>
            </div>
            <Textarea
              name="notes"
              rows={3}
              defaultValue={todo.notes}
              aria-label="Notes"
              placeholder="Notes and links — Markdown, e.g. [spec](https://…)"
            />
            <div className="flex justify-end">
              <Button type="submit" size="sm">
                Save
              </Button>
            </div>
          </form>

          <form
            action={editing.deleteTodo}
            className="flex justify-end border-t border-border pt-2"
          >
            <input type="hidden" name="id" value={todo.id} />
            <button
              type="submit"
              onClick={(e) => {
                if (!confirm(`Delete "${todo.title}"?`)) e.preventDefault();
              }}
              className="cursor-pointer text-xs font-medium text-danger hover:underline"
            >
              Delete to-do
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
