"use client";

import type { ReactNode } from "react";
import { Info } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/components/ui/utils";

/**
 * A quiet "what does this mean?" affordance — a small info button that opens a
 * plain-language explainer. Chrome that stays out of the way until asked
 * (communicate_to_share: say what it means, on demand).
 */
export function InfoHint({
  children,
  title,
  label = "What does this mean?",
  className,
}: {
  children: ReactNode;
  title?: string;
  label?: string;
  className?: string;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={label}
          className={cn(
            "text-muted-foreground/50 hover:text-foreground hover:bg-muted inline-flex size-6 shrink-0 items-center justify-center rounded-md transition-colors",
            className,
          )}
        >
          <Info className="size-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72">
        {title && <div className="mb-1.5 text-sm font-medium">{title}</div>}
        <div className="text-muted-foreground space-y-1.5 text-xs leading-relaxed">{children}</div>
      </PopoverContent>
    </Popover>
  );
}
