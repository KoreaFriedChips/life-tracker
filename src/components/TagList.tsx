/** Renders a list of tags as small pills. Renders nothing if there are no tags. */
export default function TagList({ tags }: { tags: string[] }) {
  if (tags.length === 0) return null;

  return (
    <ul className="flex flex-wrap gap-1">
      {tags.map((tag) => (
        <li
          key={tag}
          className="rounded-full border border-current/10 bg-surface-subtle px-2 py-px text-[11px] text-muted"
        >
          {tag}
        </li>
      ))}
    </ul>
  );
}
