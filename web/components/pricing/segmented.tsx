"use client";

import type { ReactNode } from "react";
import { cn } from "@/components/ui/utils";

export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  render,
  className,
}: {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  render?: (v: T) => ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("border-border inline-flex rounded-md border p-0.5", className)} role="group">
      {options.map((o) => {
        const active = o === value;
        return (
          <button
            key={String(o)}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o)}
            className={cn(
              "rounded px-3 py-1.5 text-sm font-medium tabular-nums transition-colors",
              active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {render ? render(o) : String(o)}
          </button>
        );
      })}
    </div>
  );
}
