import type { ReactNode } from "react";

/** A scannable label/value read row — replaces buried prose (communicate_to_share: scannable-first). */
export function ReadRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex gap-3 text-sm">
      <span className="text-muted-foreground w-20 shrink-0">{label}</span>
      <span className="text-foreground/90 min-w-0">{children}</span>
    </div>
  );
}

/** Small uppercase section heading — matches the Baseline tab's sub-section labels. */
export function SubLabel({ children }: { children: ReactNode }) {
  return <div className="text-muted-foreground mb-2 text-[10px] font-medium uppercase tracking-wider">{children}</div>;
}
