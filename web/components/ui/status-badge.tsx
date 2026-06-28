import { cn } from "@/components/ui/utils";

/**
 * The per-component honesty pill — provenance is universal, not special-cased.
 * dot + one word; a hollow ring is "not yet there", never red (red = broken).
 *
 * Two orthogonal axes share ONE visual grammar (communicate_to_share: define once):
 *   pricing-layer confidence → active / modeled / placeholder   (the premium chain)
 *   carrier-rules maturity   → loaded / house-default / not-configured   (the Rules Engine)
 * green = real/in-effect · amber = provisional/estimate · hollow = not plugged in.
 */
export type Status =
  | "active"
  | "modeled"
  | "placeholder"
  | "loaded"
  | "house-default"
  | "not-configured";

const DOT: Record<Status, string> = {
  active: "bg-status-active",
  modeled: "bg-status-modeled",
  placeholder: "bg-transparent ring-1 ring-status-placeholder",
  loaded: "bg-status-active",
  "house-default": "bg-status-modeled",
  "not-configured": "bg-transparent ring-1 ring-status-placeholder",
};

const LABEL: Record<Status, string> = {
  active: "active",
  modeled: "modeled",
  placeholder: "placeholder",
  loaded: "loaded",
  "house-default": "house default",
  "not-configured": "not configured",
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
      {LABEL[status]}
    </span>
  );
}
