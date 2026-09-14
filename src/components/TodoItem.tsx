"use client";

import { useRef, useState, type ReactNode } from "react";
import type { Category, Todo } from "@/db/repo/todos";
import Badge from "@/components/ui/Badge";
import { Button, buttonClassName } from "@/components/ui/Button";
import { Input, Select, Textarea } from "@/components/ui/fields";

/** Agents the launcher can start for a to-do (see tools/agent-launcher). */
const AGENTS = [
  { id: "claude", label: "Claude" },
  { id: "codex", label: "Codex" },
] as const;

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
 * Notes stay collapsed behind a chevron so long notes don't crowd the list;
 * rows without notes show no chevron. `notes` is the pre-rendered Markdown of
 * `todo.notes`, rendered on the server so react-markdown stays out of the
 * client bundle.
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
  const [notesOpen, setNotesOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const notesId = `todo-${todo.id}-notes`;

  async function save(formData: FormData) {
    await editing?.updateTodo(formData);
    setEditOpen(false);
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
          {todo.notes && notesOpen && (
            <div
              id={notesId}
              className="mt-1 [&>.markdown]:text-xs [&>.markdown]:text-muted"
            >
              {notes}
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {todo.notes && (
            <button
              type="button"
              aria-expanded={notesOpen}
              aria-controls={notesId}
              aria-label={`${notesOpen ? "Hide" : "Show"} notes for "${todo.title}"`}
              onClick={() => setNotesOpen((wasOpen) => !wasOpen)}
              className="inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted transition hover:bg-surface-subtle hover:text-foreground active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <svg
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                className={`size-4 transition-transform ${notesOpen ? "rotate-180" : ""}`}
              >
                <path d="M6 8l4 4 4-4" />
              </svg>
            </button>
          )}

          {!todo.done && (
            // Desktop only: the lifetracker-agent:// scheme is handled by tools/agent-launcher on the Mac.
            <div className="hidden items-center gap-1 sm:flex">
              {AGENTS.map(({ id, label }) => (
                <a
                  key={id}
                  href={`lifetracker-agent://run?agent=${id}&todo=${todo.id}`}
                  title={`Open a ${label} session in cmux to work on this assignment (never submits)`}
                  aria-label={`Work on "${todo.title}" with ${label}`}
                  className={buttonClassName("ghost", "sm")}
                >
                  {label}
                </a>
              ))}
            </div>
          )}

          {editing && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-expanded={editOpen}
              onClick={() => {
                setEditOpen((wasOpen) => !wasOpen);
                setNotesOpen(false);
              }}
            >
              {editOpen ? "Cancel" : "Edit"}
            </Button>
          )}
        </div>
      </div>

      {editing && editOpen && (
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
