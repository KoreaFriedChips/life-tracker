"use client";

import { useRouter } from "next/navigation";
import {
  Fragment,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import {
  createPaletteKnowledge,
  createPaletteTodo,
  createPaletteTouchpoint,
  getCaptureCategories,
  searchPalette,
} from "@/app/actions";
import type { Category } from "@/db/repo/todos";
import type { CaptureResult, PaletteResults } from "@/lib/paletteSearch";
import Badge from "@/components/ui/Badge";
import { Button, buttonClassName } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/fields";

const EMPTY_RESULTS: PaletteResults = { todos: [], people: [], knowledge: [] };

type Mode = "search" | "todo" | "knowledge" | "touchpoint";

interface Row {
  key: string;
  /** Group header emitted above the first row of each named group. */
  group: string | null;
  content: ReactNode;
  run: () => void;
}

/**
 * Global Cmd/Ctrl+K command palette: search across todos/people/knowledge plus
 * quick-create flows. Rendered in Nav (absent on /login); the dialog portals to
 * document.body because Nav's backdrop-blur header is a containing block that
 * would trap a position:fixed overlay inside the header strip.
 */
export default function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("search");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PaletteResults>(EMPTY_RESULTS);
  const [active, setActive] = useState(0);
  const [title, setTitle] = useState("");
  const [categories, setCategories] = useState<Category[] | null>(null);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [knowledgeType, setKnowledgeType] = useState("book");
  const [pinned, setPinned] = useState<{ id: number; name: string } | null>(null);
  const [summary, setSummary] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  function openPalette() {
    previousFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setMode("search");
    setQuery("");
    setResults(EMPTY_RESULTS);
    setActive(0);
    setError(null);
    setAdded(false);
    setOpen(true);
  }

  function closePalette() {
    setOpen(false);
    previousFocusRef.current?.focus();
    previousFocusRef.current = null;
  }

  function backToSearch() {
    setMode("search");
    setPinned(null);
    setError(null);
  }

  // Cmd/Ctrl+K toggles the palette from anywhere.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (open) closePalette();
        else openPalette();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  // Escape and Tab are handled at the window level while open, so they keep
  // working when focus leaves the panel (e.g. after clicking a non-interactive
  // area) and Tab can never reach the page hidden behind the aria-modal overlay.
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.isComposing) return;
      if (e.key === "Escape") {
        e.preventDefault();
        if (mode === "search") closePalette();
        else backToSearch();
        return;
      }
      if (e.key !== "Tab" || !panelRef.current) return;
      e.preventDefault();
      const focusables = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>("a[href], button, input, select, textarea"),
      ).filter((el) => !el.matches(":disabled"));
      if (focusables.length === 0) return;
      const current = focusables.indexOf(document.activeElement as HTMLElement);
      const next =
        current === -1
          ? e.shiftKey
            ? focusables.length - 1
            : 0
          : (current + (e.shiftKey ? -1 : 1) + focusables.length) % focusables.length;
      focusables[next].focus();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, mode]);

  // Focus the search input on open and when returning from a capture mode.
  useEffect(() => {
    if (open && mode === "search") inputRef.current?.focus();
  }, [open, mode]);

  // Lock background scroll while open; cleanup also covers unmount.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  // Debounced search; previous results stay visible while the next fetch runs.
  // `stale` (set by the cleanup on any query/open/mode change) drops in-flight
  // responses for superseded queries, so a late result can't repopulate a
  // cleared input or a reopened palette; rejections keep the prior results.
  useEffect(() => {
    if (!open || mode !== "search" || !query.trim()) return;
    let stale = false;
    const timer = setTimeout(() => {
      void searchPalette(query)
        .then((next) => {
          if (stale) return;
          setResults(next);
          setActive(0);
        })
        .catch(() => {});
    }, 200);
    return () => {
      stale = true;
      clearTimeout(timer);
    };
  }, [query, open, mode]);

  // Load categories once, on first entering todo capture. On failure categories
  // stays null, so backing out and re-entering todo capture retries the load.
  useEffect(() => {
    if (!open || mode !== "todo" || categories) return;
    void getCaptureCategories()
      .then((list) => {
        setCategories(list);
        setCategoryId((current) => current ?? list[0]?.id ?? null);
      })
      .catch(() => setError("Couldn't load categories. Go back and retry."));
  }, [open, mode, categories]);

  // Keep the active option visible when arrowing through a scrolled list.
  useEffect(() => {
    if (!open || mode !== "search") return;
    document.getElementById(`palette-option-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [active, open, mode]);

  function go(href: string) {
    router.push(href);
    closePalette();
  }

  function enterCapture(next: "todo" | "knowledge") {
    setMode(next);
    setTitle(query.trim());
    setError(null);
    setAdded(false);
  }

  /** Pins a person from the search results and swaps the input to a touchpoint summary. */
  function pinPerson(person: { id: number; name: string }) {
    setMode("touchpoint");
    setPinned(person);
    setSummary("");
    setError(null);
    setAdded(false);
  }

  function finishCapture(result: CaptureResult) {
    if (result.ok) {
      setMode("search");
      setPinned(null);
      setQuery("");
      setResults(EMPTY_RESULTS);
      setError(null);
      setAdded(true);
    } else {
      setError(result.error);
    }
  }

  // Each submit resets `pending` in a finally: a transport-level rejection
  // (offline, dropped connection) would otherwise leave every capture submit
  // disabled for the rest of the session, since nothing else resets it.
  async function submitTodo(e: FormEvent) {
    e.preventDefault();
    if (pending || categoryId === null) return;
    setPending(true);
    try {
      finishCapture(await createPaletteTodo({ title, categoryId }));
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setPending(false);
    }
  }

  async function submitKnowledge(e: FormEvent) {
    e.preventDefault();
    if (pending) return;
    setPending(true);
    try {
      finishCapture(await createPaletteKnowledge({ title, type: knowledgeType }));
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setPending(false);
    }
  }

  async function submitTouchpoint(e: FormEvent) {
    e.preventDefault();
    if (pending || !pinned) return;
    setPending(true);
    try {
      finishCapture(await createPaletteTouchpoint({ personId: pinned.id, summary }));
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setPending(false);
    }
  }

  const q = query.trim();
  const rows: Row[] = [
    ...results.todos.map((todo) => ({
      key: `todo-${todo.id}`,
      group: "To-dos",
      content: <span>{todo.title}</span>,
      run: () => go("/todos"),
    })),
    ...results.people.map((person) => ({
      key: `person-${person.id}`,
      group: "People",
      content: (
        <>
          <span className="min-w-0 flex-1 truncate">{person.name}</span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              pinPerson({ id: person.id, name: person.name });
            }}
            className={buttonClassName("ghost", "sm")}
          >
            Log touchpoint
          </button>
        </>
      ),
      run: () => go(`/people/${person.id}`),
    })),
    ...results.knowledge.map((entry) => ({
      key: `knowledge-${entry.id}`,
      group: "Knowledge",
      content: (
        <>
          <span className="min-w-0 flex-1 truncate">{entry.title}</span>
          <Badge tone="neutral">{entry.type}</Badge>
        </>
      ),
      run: () => go(`/knowledge/${entry.id}`),
    })),
    {
      key: "action-todo",
      group: null,
      content: <span className="text-muted">{q ? `New to-do "${q}"` : "New to-do…"}</span>,
      run: () => enterCapture("todo"),
    },
    {
      key: "action-knowledge",
      group: null,
      content: (
        <span className="text-muted">
          {q ? `New knowledge entry "${q}"` : "New knowledge entry…"}
        </span>
      ),
      run: () => enterCapture("knowledge"),
    },
  ];
  const noMatches =
    q !== "" &&
    results.todos.length === 0 &&
    results.people.length === 0 &&
    results.knowledge.length === 0;

  // Escape is handled by the window-level listener above. List navigation only
  // reacts to keys from the search input or the panel itself (focused by
  // padding clicks): Enter on a focused control (e.g. "Log touchpoint") must
  // keep its native activation, and Enter committing IME text must not run a row.
  function onPanelKeyDown(e: ReactKeyboardEvent) {
    if (mode !== "search" || e.nativeEvent.isComposing) return;
    if (e.target !== inputRef.current && e.target !== e.currentTarget) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => (a + 1) % rows.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (a - 1 + rows.length) % rows.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      rows[active]?.run();
    }
  }

  const errorBox = error && (
    <div className="rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger-soft-fg">
      {error}
    </div>
  );

  return (
    <>
      <button
        type="button"
        onClick={openPalette}
        className="flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-muted transition-colors hover:bg-surface-subtle hover:text-foreground"
      >
        Search
        <kbd className="hidden text-xs text-faint sm:inline">⌘K</kbd>
      </button>
      {/* `open` only flips true from client events, so document exists here. */}
      {open &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex flex-col items-center bg-black/50 px-4"
            onClick={closePalette}
          >
            <div
              ref={panelRef}
              role="dialog"
              aria-modal="true"
              aria-label="Command palette"
              // Clicks on non-interactive areas keep focus inside the dialog,
              // so key handling stays alive and aria-modal stays honest.
              tabIndex={-1}
              className="mt-12 w-full max-w-lg rounded-xl border border-border bg-surface shadow-xs outline-none sm:mt-24"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={onPanelKeyDown}
            >
              {mode === "search" && (
                <>
                  <div className="border-b border-border p-3">
                    <Input
                      ref={inputRef}
                      type="text"
                      role="combobox"
                      aria-expanded="true"
                      aria-controls="palette-listbox"
                      aria-activedescendant={`palette-option-${active}`}
                      placeholder="Search todos, people, knowledge..."
                      value={query}
                      onChange={(e) => {
                        setQuery(e.target.value);
                        setActive(0);
                        setAdded(false);
                        if (!e.target.value.trim()) setResults(EMPTY_RESULTS);
                      }}
                      className="w-full"
                    />
                  </div>
                  {added && <p className="px-4 pt-2 text-sm text-success-soft-fg">Added ✓</p>}
                  {q === "" && <p className="px-4 pt-2 text-sm text-muted">Type to search…</p>}
                  {noMatches && <p className="px-4 pt-2 text-sm text-muted">No matches.</p>}
                  <ul
                    id="palette-listbox"
                    role="listbox"
                    aria-label="Results"
                    className="max-h-80 overflow-y-auto p-1.5"
                  >
                    {rows.map((row, index) => (
                      <Fragment key={row.key}>
                        {row.group !== null && rows[index - 1]?.group !== row.group && (
                          <li role="presentation" className="px-3 pt-2 text-xs font-medium text-muted">
                            {row.group}
                          </li>
                        )}
                        <li
                          id={`palette-option-${index}`}
                          role="option"
                          aria-selected={index === active}
                          onClick={row.run}
                          onMouseMove={() => setActive(index)}
                          className={`flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm ${
                            index === active ? "bg-surface-subtle" : ""
                          }`}
                        >
                          {row.content}
                        </li>
                      </Fragment>
                    ))}
                  </ul>
                </>
              )}
              {mode === "todo" && (
                <form onSubmit={submitTodo} className="flex flex-col gap-4 p-4">
                  <Field label="Title">
                    <Input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      autoFocus
                    />
                  </Field>
                  {categories && categories.length === 0 ? (
                    <>
                      <p className="text-sm text-muted">
                        No categories yet — create one on the To-dos page.
                      </p>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          onClick={() => {
                            // Drop the cached empty list so reopening refetches
                            // after a category is created; go() also closes the
                            // palette, which a plain link would leave open.
                            setCategories(null);
                            go("/todos#manage-categories");
                          }}
                        >
                          Go to To-dos
                        </Button>
                        <Button type="button" variant="ghost" onClick={backToSearch}>
                          Back
                        </Button>
                      </div>
                    </>
                  ) : (
                    <>
                      <Field label="Category">
                        {categories ? (
                          <Select
                            value={categoryId ?? ""}
                            onChange={(e) => setCategoryId(Number(e.target.value))}
                          >
                            {categories.map((category) => (
                              <option key={category.id} value={category.id}>
                                {category.name}
                              </option>
                            ))}
                          </Select>
                        ) : (
                          <Select disabled>
                            <option>Loading…</option>
                          </Select>
                        )}
                      </Field>
                      {errorBox}
                      <div className="flex gap-2">
                        <Button
                          type="submit"
                          disabled={pending || !title.trim() || categoryId === null}
                        >
                          Add to-do
                        </Button>
                        <Button type="button" variant="ghost" onClick={backToSearch}>
                          Back
                        </Button>
                      </div>
                    </>
                  )}
                </form>
              )}
              {mode === "touchpoint" && pinned && (
                <form onSubmit={submitTouchpoint} className="flex flex-col gap-4 p-4">
                  <div className="flex items-center gap-2">
                    <Badge tone="accent">{pinned.name}</Badge>
                    <span className="text-xs text-muted">Touchpoint dated today</span>
                  </div>
                  <Field label="Summary">
                    <Input
                      type="text"
                      value={summary}
                      onChange={(e) => setSummary(e.target.value)}
                      autoFocus
                    />
                  </Field>
                  {errorBox}
                  <div className="flex gap-2">
                    <Button type="submit" disabled={pending || !summary.trim()}>
                      Log
                    </Button>
                    <Button type="button" variant="ghost" onClick={backToSearch}>
                      Back
                    </Button>
                  </div>
                </form>
              )}
              {mode === "knowledge" && (
                <form onSubmit={submitKnowledge} className="flex flex-col gap-4 p-4">
                  <Field label="Title">
                    <Input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      autoFocus
                    />
                  </Field>
                  <Field label="Type">
                    <Select value={knowledgeType} onChange={(e) => setKnowledgeType(e.target.value)}>
                      <option value="book">Book</option>
                      <option value="article">Article</option>
                      <option value="paper">Paper</option>
                      <option value="video">Video</option>
                    </Select>
                  </Field>
                  {errorBox}
                  <div className="flex gap-2">
                    <Button type="submit" disabled={pending || !title.trim()}>
                      Add entry
                    </Button>
                    <Button type="button" variant="ghost" onClick={backToSearch}>
                      Back
                    </Button>
                  </div>
                </form>
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
