"use client";

import { Check, Copy } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { controlClassName } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/** Read-only value with a joined Copy button. Falls back to selecting the text. */
export function CopyField({ value, label }: { value: string; label: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      input.current?.select();
    }
  }

  return (
    <div className="flex">
      <input
        ref={input}
        readOnly
        value={value}
        aria-label={label}
        onFocus={(event) => event.currentTarget.select()}
        className={cn(
          controlClassName,
          "h-10 min-w-0 flex-1 rounded-r-none border-r-0 pointer-coarse:h-11",
        )}
      />
      <Button
        type="button"
        variant="outline"
        onClick={copy}
        className="h-10 shrink-0 rounded-l-none rounded-r-[10px] pointer-coarse:h-11"
      >
        {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
        <span aria-live="polite">{copied ? "Copied" : "Copy"}</span>
      </Button>
    </div>
  );
}
