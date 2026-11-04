import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Markdown } from "./markdown";

const render = (source: string, spoiler = false) =>
  renderToStaticMarkup(<Markdown spoiler={spoiler}>{source}</Markdown>);

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

  it("highlights fenced code that names its language", () => {
    const html = render("```python\ndef two_sum(nums):\n    # one pass\n    return []\n```");
    expect(html).toContain('<code class="hljs language-python">');
    expect(html).toContain('<span class="hljs-keyword">def</span>');
    expect(html).toContain('<span class="hljs-comment"># one pass</span>');
  });

  it("leaves code plain when the language is missing or unknown", () => {
    expect(render("```\nreturn 1\n```")).toContain("<pre><code>return 1\n</code></pre>");
    const unknown = render("```notalanguage\nreturn 1\n```");
    expect(unknown).not.toContain("hljs-");
    expect(unknown).toContain("return 1");
  });

  it("folds code blocks behind a disclosure in a spoiler post, leaving the text visible", () => {
    const html = render("Stuck on the edge case.\n\n```js\nreturn seen.has(x);\n```", true);
    expect(html).toMatch(/^<div class="markdown"><p>Stuck on the edge case.<\/p>/);
    // Closed by default: no `open` attribute.
    expect(html).toContain('<details class="spoiler"><summary>');
    expect(html).toContain("Show spoiler code");
    expect(html).toMatch(/<\/summary><pre><code class="hljs language-js">/);
    expect(render("```js\nx\n```")).not.toContain("<details");
  });
});
