"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import { useMounted } from "@/hooks/use-mounted";

/**
 * Folds a long post at about 13 lines in a feed, with "Show more" to open it. The fold goes away
 * when the post turns out to fit (the server only guesses from its length). Focus moving into the
 * folded part (a link, say) opens it, so nothing focusable is ever hidden. Before JavaScript runs,
 * the control is a link to the post's own page, where it's shown whole.
 */
export function LongPostFold({ postId, children }: { postId: string; children: React.ReactNode }) {
  const mounted = useMounted();
  const [open, setOpen] = useState(false);
  const [fits, setFits] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const outer = box.current;
    const inner = content.current;
    if (!outer || !inner || open) return;
    // The content's own size changes too (a spoiler opening), so both are watched. Once a post
    // fits it stays unfolded, so opening a spoiler never folds what someone is reading.
    const observer = new ResizeObserver(() =>
      setFits((fit) => fit || inner.offsetHeight <= outer.clientHeight + 1),
    );
    observer.observe(outer);
    observer.observe(inner);
    return () => observer.disconnect();
  }, [open]);

  const folded = !open && !fits;
  const id = `post-${postId}-body`;
  return (
    <div className="flex flex-col gap-2">
      <div
        id={id}
        ref={box}
        onFocus={() => {
          if (folded) setOpen(true);
        }}
        className={folded ? "max-h-80 overflow-hidden" : undefined}
      >
        <div ref={content}>{children}</div>
      </div>
      {fits ? null : mounted ? (
        <button
          ref={toggle}
          type="button"
          aria-expanded={open}
          aria-controls={id}
          onClick={() => {
            setOpen(!open);
            // Folding moves the button up; keep it in view.
            if (open)
              requestAnimationFrame(() => toggle.current?.scrollIntoView({ block: "nearest" }));
          }}
          className={buttonVariants({
            variant: "ghost",
            size: "sm",
            className: "-ml-2 self-start",
          })}
        >
          {open ? "Show less" : "Show more"}
        </button>
      ) : (
        <Link
          href={`/posts/${postId}`}
          className={buttonVariants({
            variant: "ghost",
            size: "sm",
            className: "-ml-2 self-start",
          })}
        >
          Read the whole post
        </Link>
      )}
    </div>
  );
}
