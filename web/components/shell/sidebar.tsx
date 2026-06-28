"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Building2, Check, ChevronRight, ChevronsUpDown, CornerDownRight, Map as MapIcon } from "lucide-react";
import { NAV } from "@/components/shell/nav-config";
import { AccountMenu } from "@/components/shell/account-menu";
import { useQuoteStore, type StudioTab } from "@/lib/quote-store";
import { asset } from "@/lib/base-path";
import { cn } from "@/components/ui/utils";

// The read-only FACTORS (the multiplicative price chain) — a collapsible group, collapsed by default.
const FACTORS: { key: StudioTab; label: string }[] = [
  { key: "baseline", label: "Baseline" },
  { key: "location", label: "Location" },
  { key: "forecast", label: "Forecast" },
];
const FACTOR_KEYS: StudioTab[] = FACTORS.map((f) => f.key);

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { studioTab, setStudioTab } = useQuoteStore();
  const onStudio = pathname.startsWith("/studio");

  // the sub-nav is always visible (the bar is short); clicking a sub-tab from another page
  // (e.g. Rules Engine) jumps into the Studio rather than silently doing nothing.
  const go = (key: StudioTab) => {
    setStudioTab(key);
    if (!onStudio) router.push("/studio");
  };
  const activeIsFactor = onStudio && FACTOR_KEYS.includes(studioTab);
  const [factorsOpen, setFactorsOpen] = useState(false);
  const showFactors = factorsOpen || activeIsFactor; // auto-open when a factor tab is active

  // one studio sub-item (a leaf nav row). `child` = nested under Factors (deeper indent, dot marker).
  const leaf = (key: StudioTab, label: string, child = false) => {
    const active = onStudio && studioTab === key;
    return (
      <li key={key}>
        <button
          type="button"
          onClick={() => go(key)}
          className={cn(
            "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] transition-colors",
            active ? "bg-primary/10 text-foreground font-medium" : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          {child ? (
            <span className="ml-1 size-1 shrink-0 rounded-full bg-current opacity-40" />
          ) : (
            <CornerDownRight className="size-3.5 shrink-0 opacity-40" />
          )}
          {label}
        </button>
      </li>
    );
  };

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

                    {/* Studio sub-nav — always visible (not gated on being in the Studio), so it
                        doesn't vanish on other pages. Factors is a collapsible folder (collapsed by
                        default) so the nav reads as four clean items: summary · Factors ▸ · regime · lever. */}
                    {isStudio && (
                      <ul className="mt-0.5 space-y-0.5 pl-3.5">
                        {leaf("breakdown", "Price Breakdown")}

                        <li>
                          <button
                            type="button"
                            onClick={() => setFactorsOpen((o) => !o)}
                            aria-expanded={showFactors}
                            className={cn(
                              "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] transition-colors",
                              activeIsFactor && !showFactors
                                ? "text-foreground font-medium"
                                : "text-muted-foreground hover:bg-muted hover:text-foreground",
                            )}
                          >
                            <ChevronRight className={cn("size-3.5 shrink-0 transition-transform", showFactors && "rotate-90")} />
                            Factors
                          </button>
                          {showFactors && <ul className="mt-0.5 space-y-0.5 pl-4">{FACTORS.map((f) => leaf(f.key, f.label, true))}</ul>}
                        </li>

                        {leaf("clustering", "County Clustering")}
                        {leaf("adjustments", "Adjustments")}
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
