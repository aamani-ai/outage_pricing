import { cn } from "@/components/ui/utils";

/**
 * The per-component honesty pill — provenance is universal, not special-cased.
 * dot + one word. `placeholder` is a hollow ring, never red (red = broken).
 */
export type Status = "active" | "modeled" | "placeholder";

const DOT: Record<Status, string> = {
  active: "bg-status-active",
  modeled: "bg-status-modeled",
  placeholder: "bg-transparent ring-1 ring-status-placeholder",
};

export function StatusBadge({ status, className }: { status: Status; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[11px] font-medium text-muted-foreground",
        className,
      )}
    >
      <span className={cn("size-1.5 rounded-full", DOT[status])} />
      {status}
    </span>
  );
}
