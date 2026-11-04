import { ChevronRight } from "lucide-react";
import ReactMarkdown, { type Components, type Options } from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";

// User-written Markdown. Raw HTML is never rendered (react-markdown escapes it without a raw
// plugin), unsafe URL schemes are dropped by its default URL transform, and only the elements
// below are allowed: no images (tracking pixels; uploads are deferred) and headings are rendered
// as bold text so a post can't out-shout the page. Spans come only from the highlighter.
const allowedElements = [
  "p",
  "br",
  "strong",
  "em",
  "del",
  "a",
  "code",
  "pre",
  "blockquote",
  "ul",
  "ol",
  "li",
  "hr",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
  "span",
];

// Fenced code is highlighted only when the author names a language (```python); guessing is
// unreliable on short snippets. Unknown languages stay plain. Token colours are theme tokens
// (.hljs-* in globals.css).
const rehypePlugins: Options["rehypePlugins"] = [[rehypeHighlight, { detect: false }]];

const Heading = ({ children }: { children?: React.ReactNode }) => (
  <p className="font-semibold">{children}</p>
);

const components: Components = {
  h1: Heading,
  h2: Heading,
  h3: Heading,
  h4: Heading,
  h5: Heading,
  h6: Heading,
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer nofollow ugc"
      className="font-medium text-ink underline underline-offset-4"
    >
      {children}
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  ),
};

/** A code block folded behind a native disclosure: works without JavaScript and by keyboard. */
const SpoilerCode: Components["pre"] = ({ children }) => (
  <details className="spoiler">
    <summary>
      <ChevronRight aria-hidden className="spoiler-chevron size-4" />
      <span className="spoiler-closed">Show spoiler code</span>
      <span className="spoiler-open">Hide spoiler code</span>
    </summary>
    <pre>{children}</pre>
  </details>
);

const spoilerComponents: Components = { ...components, pre: SpoilerCode };

/** `spoiler` folds every code block until the reader opens it; the text around stays visible. */
export function Markdown({ children, spoiler = false }: { children: string; spoiler?: boolean }) {
  return (
    <div className="markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={rehypePlugins}
        allowedElements={allowedElements}
        unwrapDisallowed
        components={spoiler ? spoilerComponents : components}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
