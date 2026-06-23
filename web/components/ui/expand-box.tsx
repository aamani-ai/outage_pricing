import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";

/** A bordered, collapsible disclosure (arrow rotates open). Native <details> — no JS. */
export function ExpandBox({
  title,
  children,
  defaultOpen,
}: {
  title: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details open={defaultOpen} className="group border-border bg-card rounded-lg border">
      <summary className="hover:bg-muted/40 flex cursor-pointer list-none items-center justify-between gap-2 rounded-lg px-4 py-3 text-sm font-medium transition-colors [&::-webkit-details-marker]:hidden">
        {title}
        <ChevronDown className="text-muted-foreground size-4 shrink-0 transition-transform group-open:rotate-180" />
      </summary>
      <div className="border-border/60 border-t px-4 py-3">{children}</div>
    </details>
  );
}
