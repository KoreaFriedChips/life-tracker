"use client";

import { useActionState } from "react";
import type { GraphNode } from "@/db/repo/knowledge";
import type { EntryConnection, SuggestedConnection } from "@/lib/knowledgeGraphView";
import {
  connectEntriesAction,
  deleteConnectionAction,
  type ConnectEntriesState,
} from "@/app/knowledge/actions";
import EntryCombobox, { type EntryOption } from "@/components/EntryCombobox";
import { STATUS_LABELS, STATUS_TONES } from "@/components/knowledgeStatus";
import TagList from "@/components/TagList";
import Badge from "@/components/ui/Badge";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Input } from "@/components/ui/fields";

const INITIAL_CONNECT_STATE: ConnectEntriesState = { error: null, succeededAt: 0 };

function SectionHeading({ children }: { children: string }) {
  return <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">{children}</h3>;
}

/**
 * Detail panel for the node selected in the knowledge graph: entry summary, its
 * connections (removable), an inline connect form, and suggested connections.
 * Anchored to the right edge on desktop, a bottom sheet on mobile.
 */
export default function GraphSidePanel({
  node,
  connections,
  suggestions,
  connectOptions,
  onClose,
  onSelectEntry,
}: {
  node: GraphNode;
  connections: EntryConnection[];
  suggestions: SuggestedConnection[];
  connectOptions: EntryOption[];
  onClose: () => void;
  onSelectEntry: (id: number) => void;
}) {
  const [connectState, connectFormAction, connectPending] = useActionState(
    connectEntriesAction,
    INITIAL_CONNECT_STATE,
  );

  return (
    <div className="absolute z-20 flex flex-col gap-4 overflow-y-auto border-border bg-surface-raised p-4 shadow-pop max-sm:inset-x-0 max-sm:bottom-0 max-sm:max-h-[60%] max-sm:rounded-t-lg max-sm:border-t sm:bottom-3 sm:right-3 sm:top-3 sm:w-80 sm:rounded-lg sm:border">
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-base font-semibold">{node.title}</h2>
        <Button type="button" variant="ghost" size="sm" aria-label="Close panel" onClick={onClose}>
          ✕
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="neutral">{node.type}</Badge>
        <Badge tone={STATUS_TONES[node.status]}>{STATUS_LABELS[node.status]}</Badge>
        <TagList tags={node.tags} />
      </div>

      {node.notesExcerpt && (
        <p className="text-sm whitespace-pre-wrap text-muted">{node.notesExcerpt}</p>
      )}

      <ButtonLink href={`/knowledge/${node.id}`} variant="secondary" size="sm">
        Open entry
      </ButtonLink>

      <section className="flex flex-col gap-2">
        <SectionHeading>Connections</SectionHeading>
        {connections.length === 0 ? (
          <p className="text-sm text-muted">None yet.</p>
        ) : (
          connections.map((connection) => (
            <div key={connection.connectionId} className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => onSelectEntry(connection.otherId)}
                className="min-w-0 text-left text-sm font-medium transition-colors hover:text-accent"
              >
                {connection.otherTitle}
                {connection.label && (
                  <span className="ml-1.5 font-normal text-muted">{connection.label}</span>
                )}
              </button>
              <form action={deleteConnectionAction} className="shrink-0">
                <input type="hidden" name="id" value={connection.connectionId} />
                <input type="hidden" name="entryId" value={node.id} />
                <input type="hidden" name="otherEntryId" value={connection.otherId} />
                <Button type="submit" variant="danger" size="sm" aria-label="Remove connection">
                  ✕
                </Button>
              </form>
            </div>
          ))
        )}
      </section>

      {connectOptions.length > 0 && (
        <form action={connectFormAction} className="flex flex-col gap-2">
          <SectionHeading>Connect</SectionHeading>
          <input type="hidden" name="entryId" value={node.id} />
          {/* key remounts the combobox after a successful connect, clearing the picked entry */}
          <EntryCombobox
            key={connectState.succeededAt}
            name="otherEntryId"
            options={connectOptions}
          />
          <Input type="text" name="label" placeholder="Label (optional)" />
          <Button type="submit" size="sm" disabled={connectPending}>
            Connect
          </Button>
          {connectState.error && <p className="text-sm text-danger">{connectState.error}</p>}
        </form>
      )}

      {suggestions.length > 0 && (
        <section className="flex flex-col gap-2">
          <SectionHeading>Suggested</SectionHeading>
          {suggestions.map((suggestion) => (
            <div key={suggestion.id} className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <button
                  type="button"
                  onClick={() => onSelectEntry(suggestion.id)}
                  className="text-left text-sm font-medium transition-colors hover:text-accent"
                >
                  {suggestion.title}
                </button>
                <p className="truncate text-xs text-muted">shares {suggestion.shared.join(", ")}</p>
              </div>
              <form action={connectFormAction} className="shrink-0">
                <input type="hidden" name="entryId" value={node.id} />
                <input type="hidden" name="otherEntryId" value={suggestion.id} />
                <Button type="submit" variant="secondary" size="sm" disabled={connectPending}>
                  Connect
                </Button>
              </form>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
