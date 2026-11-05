"use client";

import { MessageCircle } from "lucide-react";
import { createContext, useContext, useState } from "react";
import { Button } from "@/components/ui/button";
import { commentsToggleId, panelId } from "./comment-ids";

// A post's comments open inside its card. The toggle sits in the post's footer and the thread
// below it, so they share open state through context rather than being one element.

const Context = createContext<{ open: boolean; setOpen: (open: boolean) => void } | null>(null);

export function CommentsDisclosure({
  defaultOpen = false,
  children,
}: {
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return <Context value={{ open, setOpen }}>{children}</Context>;
}

function useDisclosure() {
  const value = useContext(Context);
  if (!value) throw new Error("Comments toggle and thread must be inside CommentsDisclosure.");
  return value;
}

export function CommentsToggle({ postId, count }: { postId: string; count: number }) {
  const { open, setOpen } = useDisclosure();
  return (
    <Button
      id={commentsToggleId(postId)}
      variant="ghost"
      size="sm"
      className="text-ink-muted"
      aria-expanded={open}
      aria-controls={panelId(postId)}
      onClick={() => setOpen(!open)}
    >
      <MessageCircle aria-hidden className="size-4" />
      {count === 0 ? "Comment" : `${count} ${count === 1 ? "comment" : "comments"}`}
    </Button>
  );
}

/** The thread, mounted only while open so a feed of closed posts stays light. */
export function CommentsPanel({ postId, children }: { postId: string; children: React.ReactNode }) {
  const { open } = useDisclosure();
  return (
    <div id={panelId(postId)} hidden={!open}>
      {open ? children : null}
    </div>
  );
}
