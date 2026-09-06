"use client";

import { useId, useState } from "react";
import { inputClassName } from "@/components/ui/fields";

export interface EntryOption {
  id: number;
  title: string;
}

/**
 * Searchable replacement for a <select> of knowledge entries: type to filter titles,
 * pick with mouse or arrows+Enter. Submits the chosen id via a hidden input under `name`.
 */
export default function EntryCombobox({
  name,
  options,
  placeholder = "Search entries...",
  className = "",
}: {
  name: string;
  options: EntryOption[];
  placeholder?: string;
  className?: string;
}) {
  const listId = useId();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<EntryOption | null>(null);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);

  const needle = query.trim().toLowerCase();
  const matches = needle
    ? options.filter((option) => option.title.toLowerCase().includes(needle))
    : options;

  function select(option: EntryOption) {
    setSelected(option);
    setQuery("");
    setOpen(false);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      const delta = event.key === "ArrowDown" ? 1 : -1;
      setHighlight((current) => Math.min(Math.max(current + delta, 0), matches.length - 1));
    } else if (event.key === "Enter" && open && matches.length > 0) {
      event.preventDefault();
      select(matches[Math.min(highlight, matches.length - 1)]);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className={`relative ${className}`}>
      <input
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        className={`${inputClassName} w-full`}
        placeholder={placeholder}
        value={selected ? selected.title : query}
        onChange={(event) => {
          setSelected(null);
          setQuery(event.target.value);
          setHighlight(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
      />
      <input type="hidden" name={name} value={selected?.id ?? ""} />
      {open && !selected && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-30 mt-1 max-h-56 w-full overflow-auto rounded-md border border-border bg-surface-raised py-1 shadow-pop"
          // preventDefault keeps the input focused so onBlur doesn't close the list before onClick fires
          onMouseDown={(event) => event.preventDefault()}
        >
          {matches.length === 0 ? (
            <li className="px-3 py-1.5 text-sm text-muted">No matches.</li>
          ) : (
            matches.map((option, index) => (
              <li
                key={option.id}
                role="option"
                aria-selected={index === highlight}
                className={`cursor-pointer px-3 py-1.5 text-sm ${
                  index === highlight ? "bg-surface-subtle" : ""
                }`}
                onMouseEnter={() => setHighlight(index)}
                onClick={() => select(option)}
              >
                {option.title}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
