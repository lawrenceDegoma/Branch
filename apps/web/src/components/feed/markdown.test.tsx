import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Markdown } from "./markdown";

const render = (source: string) => renderToStaticMarkup(<Markdown>{source}</Markdown>);

describe("Markdown", () => {
  it("renders the formatting people use in posts", () => {
    const html = render("**bold** and `code`\n\n- one\n- two\n\n```\nx = 1\n```");
    expect(html).toContain("<strong>bold</strong>");
    expect(html).toContain("<code>code</code>");
    expect(html).toContain("<li>one</li>");
    expect(html).toContain("<pre><code>x = 1\n</code></pre>");
  });

  it("never renders raw HTML", () => {
    const html = render('<script>alert(1)</script>\n\n<img src=x onerror="alert(1)">\n\n<b>hi</b>');
    // Shown as inert text, never as elements.
    expect(html).not.toMatch(/<(script|img|b)[\s>]/i);
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
  });

  it("drops unsafe link targets and opens safe ones in a new tab without the opener", () => {
    expect(render("[x](javascript:alert(1))")).not.toContain("javascript:");
    expect(render("[x](data:text/html,hi)")).not.toContain("data:");
    const safe = render("[docs](https://example.com)");
    expect(safe).toContain('href="https://example.com"');
    expect(safe).toContain('rel="noopener noreferrer nofollow ugc"');
  });

  it("drops Markdown images and turns headings into bold text", () => {
    const html = render("![tracker](https://example.com/pixel.gif)\n\n# Shouting");
    expect(html).not.toContain("<img");
    expect(html).not.toContain("<h1");
    expect(html).toContain('<p class="font-semibold">Shouting</p>');
  });
});
