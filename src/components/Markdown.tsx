import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Server-renderable Markdown viewer with GitHub-flavored Markdown support.
 * Uses react-markdown's default sanitized rendering — no raw HTML pass-through.
 * Typography for the `markdown` class lives in globals.css.
 */
export default function Markdown({ children }: { children: string }) {
  return (
    <div className="markdown text-sm text-foreground/90">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  );
}
