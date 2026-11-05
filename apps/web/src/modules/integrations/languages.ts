// LeetCode's language slugs: how to name them, and which highlighter language renders them.

const languages: Record<string, { label: string; highlight?: string }> = {
  python3: { label: "Python 3", highlight: "python" },
  python: { label: "Python", highlight: "python" },
  pythondata: { label: "Pandas", highlight: "python" },
  cpp: { label: "C++", highlight: "cpp" },
  c: { label: "C", highlight: "c" },
  java: { label: "Java", highlight: "java" },
  javascript: { label: "JavaScript", highlight: "javascript" },
  typescript: { label: "TypeScript", highlight: "typescript" },
  golang: { label: "Go", highlight: "go" },
  csharp: { label: "C#", highlight: "csharp" },
  kotlin: { label: "Kotlin", highlight: "kotlin" },
  swift: { label: "Swift", highlight: "swift" },
  rust: { label: "Rust", highlight: "rust" },
  ruby: { label: "Ruby", highlight: "ruby" },
  scala: { label: "Scala", highlight: "scala" },
  php: { label: "PHP", highlight: "php" },
  dart: { label: "Dart" },
  racket: { label: "Racket" },
  erlang: { label: "Erlang" },
  elixir: { label: "Elixir" },
  bash: { label: "Bash", highlight: "bash" },
  mysql: { label: "MySQL", highlight: "sql" },
  mssql: { label: "MS SQL Server", highlight: "sql" },
  oraclesql: { label: "Oracle", highlight: "sql" },
  postgresql: { label: "PostgreSQL", highlight: "sql" },
};

export function languageLabel(slug: string): string {
  return languages[slug]?.label ?? slug;
}

/** Code as a Markdown fence longer than any backtick run inside it, so it can't break out. */
export function codeFence(code: string, slug: string): string {
  const longest = Math.max(0, ...[...code.matchAll(/`+/g)].map((m) => m[0].length));
  const fence = "`".repeat(Math.max(3, longest + 1));
  return `${fence}${languages[slug]?.highlight ?? ""}\n${code}\n${fence}`;
}
