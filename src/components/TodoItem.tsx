"use client";

import { useRef } from "react";
import type { Todo } from "@/db/repo/todos";
import Badge from "@/components/ui/Badge";

/** Checkbox row for an open to-do. Checking it auto-submits a toggle server action. */
export default function TodoItem({
  todo,
  overdue,
  toggleTodo,
}: {
  todo: Todo;
  overdue: boolean;
  toggleTodo: (formData: FormData) => void | Promise<void>;
}) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form ref={formRef} action={toggleTodo} className="flex items-start gap-3 py-2.5">
      <input type="hidden" name="id" value={todo.id} />
      <input
        type="checkbox"
        defaultChecked={todo.done}
        onChange={() => formRef.current?.requestSubmit()}
        aria-label={`Mark "${todo.title}" done`}
        className="mt-0.5 size-4 shrink-0 cursor-pointer"
      />
      <div className="flex-1">
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
        {todo.notes && <p className="mt-0.5 text-xs text-muted">{todo.notes}</p>}
      </div>
    </form>
  );
}
