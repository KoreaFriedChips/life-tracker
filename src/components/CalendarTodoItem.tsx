"use client";

import { useRef } from "react";
import type { Todo } from "@/db/repo/todos";

/** Compact checkbox row for a calendar day cell. Checking it auto-submits a toggle server action. */
export default function CalendarTodoItem({
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
    <form ref={formRef} action={toggleTodo} className="flex items-center gap-1.5">
      <input type="hidden" name="id" value={todo.id} />
      <input
        type="checkbox"
        defaultChecked={todo.done}
        onChange={() => formRef.current?.requestSubmit()}
        aria-label={todo.done ? `Mark "${todo.title}" not done` : `Mark "${todo.title}" done`}
        className="size-3.5 shrink-0 cursor-pointer"
      />
      <span
        className={
          todo.done
            ? "min-w-0 flex-1 truncate text-xs text-muted line-through"
            : "min-w-0 flex-1 truncate text-xs text-foreground"
        }
      >
        {todo.title}
      </span>
      {overdue && todo.dueDate && (
        <span className="flex shrink-0 items-center gap-1 text-[10px] font-medium text-danger">
          <span className="size-1.5 rounded-full bg-danger" aria-hidden />
          <span className="sr-only">overdue since </span>
          {todo.dueDate}
        </span>
      )}
    </form>
  );
}
