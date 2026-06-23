"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, Check, ChevronsUpDown, CornerDownRight, Map as MapIcon } from "lucide-react";
import { NAV } from "@/components/shell/nav-config";
import { AccountMenu } from "@/components/shell/account-menu";
import { useQuoteStore, type StudioTab } from "@/lib/quote-store";
import { asset } from "@/lib/base-path";
import { cn } from "@/components/ui/utils";

const STUDIO_TABS: { key: StudioTab; label: string }[] = [
  { key: "breakdown", label: "Price Breakdown" },
  { key: "baseline", label: "Baseline" },
  { key: "clustering", label: "County Clustering" },
  { key: "adjusters", label: "Adjusters" },
];

export function Sidebar() {
  const pathname = usePathname();
  const { studioTab, setStudioTab } = useQuoteStore();
  const onStudio = pathname.startsWith("/studio");

  return (
    <aside className="bg-sidebar text-sidebar-foreground flex h-full w-[264px] shrink-0 flex-col border-r">
      {/* brand — official lockup (theme-swapped) · Outage Pricing, inline */}
      <div className="flex h-14 items-center gap-2 px-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={asset("/brand/lockup-on-light.svg")} alt="InfraSure" className="h-6 w-auto shrink-0 dark:hidden" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={asset("/brand/lockup-on-dark.svg")} alt="InfraSure" className="hidden h-6 w-auto shrink-0 dark:block" />
        <span className="text-muted-foreground whitespace-nowrap text-[13px]">· Outage Pricing</span>
      </div>

      {/* context selector — Single address today; portfolio / region are coming */}
      <div className="px-3 pb-3">
        <details className="group relative">
          <summary className="bg-card hover:bg-muted flex cursor-pointer list-none items-center justify-between rounded-md border px-3 py-2 text-sm transition-colors [&::-webkit-details-marker]:hidden">
            <span className="truncate">
              <span className="text-muted-foreground">Context · </span>Single address
            </span>
            <ChevronsUpDown className="text-muted-foreground size-4 shrink-0" />
          </summary>
          <div className="bg-card absolute inset-x-0 z-20 mt-1 rounded-md border p-1 shadow-md">
            <div className="bg-muted flex items-center gap-2 rounded px-2 py-1.5 text-sm">
              <Check className="text-primary size-3.5 shrink-0" /> Single address
            </div>
            <div className="text-muted-foreground/60 flex items-center justify-between rounded px-2 py-1.5 text-sm">
              <span className="flex items-center gap-2">
                <Building2 className="size-3.5 shrink-0" /> Portfolio
              </span>
              <span className="bg-muted rounded px-1.5 py-0.5 text-[10px]">soon</span>
            </div>
            <div className="text-muted-foreground/60 flex items-center justify-between rounded px-2 py-1.5 text-sm">
              <span className="flex items-center gap-2">
                <MapIcon className="size-3.5 shrink-0" /> Region / book of business
              </span>
              <span className="bg-muted rounded px-1.5 py-0.5 text-[10px]">soon</span>
            </div>
          </div>
        </details>
      </div>

      {/* grouped nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-1">
        {NAV.map((group) => (
          <div key={group.label} className="mb-6">
            <div className="text-muted-foreground px-2 pb-2 text-[11px] font-medium uppercase tracking-wider">
              {group.label}
            </div>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive =
                  !!item.href && (item.href === "/" ? pathname === "/" : pathname.startsWith(item.href));
                const base = "flex items-center gap-2.5 rounded-md px-2 py-2 text-sm transition-colors";

                if (item.soon || !item.href) {
                  return (
                    <li key={item.label}>
                      <span className={cn(base, "text-muted-foreground/55 cursor-default")}>
                        <Icon className="size-4" />
                        <span className="flex-1">{item.label}</span>
                        <span className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-[10px]">soon</span>
                      </span>
                    </li>
                  );
                }

                const isStudio = item.href === "/studio";
                return (
                  <li key={item.label}>
                    <Link
                      href={item.href}
                      className={cn(
                        base,
                        "text-foreground/75 hover:bg-muted hover:text-foreground border-l-2 border-transparent",
                        isActive && "border-primary bg-muted text-foreground font-medium",
                      )}
                    >
                      <Icon className="size-4" />
                      {item.label}
                    </Link>

                    {/* Studio sub-sections — nested, shown while in the Studio */}
                    {isStudio && onStudio && (
                      <ul className="mt-0.5 space-y-0.5 pl-3.5">
                        {STUDIO_TABS.map((t) => {
                          const active = studioTab === t.key;
                          return (
                            <li key={t.key}>
                              <button
                                type="button"
                                onClick={() => setStudioTab(t.key)}
                                className={cn(
                                  "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] transition-colors",
                                  active
                                    ? "bg-primary/10 text-foreground font-medium"
                                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                                )}
                              >
                                <CornerDownRight className="size-3.5 shrink-0 opacity-40" />
                                {t.label}
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t p-2">
        <AccountMenu />
      </div>
    </aside>
  );
}
