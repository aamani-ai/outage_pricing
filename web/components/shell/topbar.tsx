"use client";

import { usePathname } from "next/navigation";
import { Bell, HelpCircle } from "lucide-react";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const iconBtn =
  "text-muted-foreground hover:bg-muted hover:text-foreground inline-flex size-8 items-center justify-center rounded-md transition-colors";

function titleFor(pathname: string): string {
  if (pathname === "/") return "Pricing";
  if (pathname.startsWith("/studio")) return "Underwriting Studio";
  if (pathname.startsWith("/rules-engine")) return "Rules Engine";
  return "InfraSure";
}

export function Topbar() {
  const pathname = usePathname();
  const title = titleFor(pathname);

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b px-6">
      <div className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">Power Outage</span>
        <span className="text-muted-foreground/50">/</span>
        <span className="font-medium">{title}</span>
      </div>
      <div className="flex items-center gap-2">
        <ThemeToggle />
        <Popover>
          <PopoverTrigger asChild>
            <button type="button" aria-label="Notifications" className={iconBtn}>
              <Bell className="size-4" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-64">
            <div className="text-sm font-medium">Notifications &amp; reminders</div>
            <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
              Coming soon — alerts on quotes, county regime changes, and saved-quote activity will land here.
            </p>
          </PopoverContent>
        </Popover>
        <Popover>
          <PopoverTrigger asChild>
            <button type="button" aria-label="About this tool" className={iconBtn}>
              <HelpCircle className="size-4" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-72">
            <div className="text-sm font-medium">About — Power Outage pricing</div>
            <p className="text-muted-foreground mt-1.5 text-xs leading-relaxed">
              Price <b>parametric outage insurance</b> for any U.S. address: it pays a fixed amount when an
              outage lasts past a chosen trigger. <b>Pricing</b> gives the quote; the{" "}
              <b>Underwriting Studio</b> opens the full breakdown.
            </p>
            <p className="text-muted-foreground/70 mt-2 text-[11px]">A guided tour is coming soon.</p>
          </PopoverContent>
        </Popover>
      </div>
    </header>
  );
}
