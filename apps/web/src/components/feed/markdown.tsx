import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

// User-written Markdown. Raw HTML is never rendered (react-markdown escapes it without a raw
// plugin), unsafe URL schemes are dropped by its default URL transform, and only the elements
// below are allowed: no images (tracking pixels; uploads are deferred) and headings are rendered
// as bold text so a post can't out-shout the page.
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
];

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

export function Markdown({ children }: { children: string }) {
  return (
    <div className="markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        allowedElements={allowedElements}
        unwrapDisallowed
        components={components}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
