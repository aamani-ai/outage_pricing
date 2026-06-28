"use client";

import { useEffect, useMemo, useState } from "react";
import { composePremium } from "@/lib/pricing";
import { Card, CardContent } from "@/components/ui/card";
import { AddressSearch } from "@/components/pricing/address-search";
import { ContextBar } from "@/components/studio/context-bar";
import { PriceBreakdownTab } from "@/components/studio/tabs/price-breakdown";
import { BaselineTab } from "@/components/studio/tabs/baseline";
import { CountyClusteringTab } from "@/components/studio/tabs/county-clustering";
import { LocationTab } from "@/components/studio/tabs/location";
import { ForecastTab } from "@/components/studio/tabs/forecast";
import { AdjustmentsTab } from "@/components/studio/tabs/adjustments";
import { effectiveFactors, useQuoteStore } from "@/lib/quote-store";
import { cn } from "@/components/ui/utils";
import { regimeLabel, type StudioData, type StudioTab } from "@/components/studio/shared";
import { api } from "@/lib/base-path";

const SECTION_LABEL: Record<string, string> = {
  breakdown: "Price Breakdown",
  baseline: "Baseline",
  clustering: "County Clustering",
  location: "Location",
  forecast: "Forecast",
  adjustments: "Adjustments",
};
// Two-level nav. Primary bar = four top-level items; "Factors" is a container that lands on the
// first factor and reveals a secondary sub-row. Keeps the summary / factors / regime / lever
// distinct instead of six flat parallel tabs.
const FACTOR_TABS: StudioTab[] = ["baseline", "location", "forecast"];
const TOP_TABS: { key: StudioTab; label: string; isFactors?: boolean }[] = [
  { key: "breakdown", label: "Price Breakdown" },
  { key: "baseline", label: "Factors", isFactors: true },
  { key: "clustering", label: "County Clustering" },
  { key: "adjustments", label: "Adjustments" },
];

export function StudioView() {
  const { current, setLocation, setT, setX, studioTab, setStudioTab, loadings, adjustmentsFor } = useQuoteStore();
  const loc = current.location;
  const T = current.T;
  const X = current.X;
  const ER = loadings.ER;
  const TM = loadings.TM;
  const [data, setData] = useState<StudioData | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error" | "nodata">("idle");

  // load whenever the shared location changes (incl. one set on the Pricing page)
  useEffect(() => {
    if (!loc) {
      setData(null);
      setStatus("idle");
      return;
    }
    let cancelled = false;
    setStatus("loading");
    setData(null);
    fetch(api(`/api/studio?lat=${loc.lat}&lon=${loc.lon}`))
      .then(async (r) => {
        const j = await r.json();
        if (cancelled) return;
        if (!r.ok) {
          setStatus(typeof j.error === "string" && j.error.includes("history") ? "nodata" : "error");
          return;
        }
        setData(j);
        setStatus("idle");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [loc?.lat, loc?.lon]);

  const adj = adjustmentsFor(data?.fips);
  const cell = data?.county.T[String(T)];
  // model factors for this county at the selected trigger: within-county relativity (post-guardrail)
  // and the statistical forward factor (the "stat" in stat + climate + grid)
  const modelLocRel = data?.location?.relativityByT?.[String(T)] ?? 1;
  const modelFwd = data?.forward?.factorByT?.[String(T)] ?? 1;
  const stack = useMemo(() => {
    if (!cell || cell.lam == null) return null;
    const rateBand = cell.lo != null && cell.hi != null ? { low: cell.lo, high: cell.hi } : undefined;
    const ef = effectiveFactors(adj);
    // model factors × any manual load (multiplicative, so the model and the lever never double-count).
    // Both compose into the ONE premium: location = within-county relativity; forward = the statistical
    // forward factor (the county's own-history forecast vs its long-run mean — the "stat" in stat+climate+grid).
    const locRel = modelLocRel * ef.location;
    const fwdF = modelFwd * ef.forward;
    return composePremium(
      {
        baseline: { lambdaCustomer: cell.lam, ...(rateBand ? { rateBand } : {}), status: "active" },
        location: { relativity: locRel, status: locRel !== 1 ? "modeled" : "placeholder" },
        forward: { factor: fwdF, status: data?.forward || fwdF !== 1 ? "modeled" : "placeholder" },
      },
      { T, X, expenseRatio: ER, targetMargin: TM },
    );
  }, [cell, T, X, ER, TM, adj, modelLocRel, modelFwd, data?.forward]);

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-4">
        <h1 className="text-xl font-semibold tracking-tight">Underwriting Studio</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          The same quote, opened up — the price breakdown, the baseline, the county regime, the model factors, and your adjustments.
        </p>
      </div>

      <AddressSearch onResolve={setLocation} autoFocus={!loc} />

      {status === "loading" && (
        <Card className="mt-4">
          <CardContent className="text-muted-foreground p-6 text-sm">Loading…</CardContent>
        </Card>
      )}
      {status === "error" && (
        <Card className="mt-4">
          <CardContent className="text-tier-red p-6 text-sm">Couldn’t resolve that location.</CardContent>
        </Card>
      )}
      {status === "nodata" && (
        <Card className="mt-4">
          <CardContent className="text-muted-foreground p-6 text-sm">No priced history for this county yet.</CardContent>
        </Card>
      )}

      {stack && data && (
        <div className="mt-4">
          <ContextBar
            county={data.county.name}
            state={data.county.state}
            address={loc?.label ?? ""}
            regime={data.studio ? regimeLabel(data.studio.regime, data.studio.sub) : null}
            T={T}
            X={X}
            setT={setT}
            setX={setX}
            premium={stack.premium.point}
            band={stack.bandDriver !== "none" ? { low: stack.premium.low, high: stack.premium.high } : null}
          />

          {/* primary tab bar — four top-level items; "Factors" is a container (mirrors the sidebar) */}
          <div className="border-border flex items-center gap-1 border-b">
            {TOP_TABS.map((t) => {
              const isActive = t.isFactors ? FACTOR_TABS.includes(studioTab) : studioTab === t.key;
              return (
                <button
                  key={t.label}
                  type="button"
                  onClick={() => setStudioTab(t.key)}
                  className={cn(
                    "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "border-primary text-foreground"
                      : "text-muted-foreground hover:text-foreground border-transparent",
                  )}
                >
                  {t.label}
                </button>
              );
            })}
          </div>

          {/* secondary sub-row — only while a Factor is active */}
          {FACTOR_TABS.includes(studioTab) ? (
            <div className="mb-5 mt-2 flex items-center gap-1">
              <span className="text-muted-foreground/50 pr-1 text-[10px] font-medium uppercase tracking-wider">Factors</span>
              {FACTOR_TABS.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setStudioTab(t)}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-[13px] font-medium transition-colors",
                    studioTab === t ? "bg-primary/10 text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  {SECTION_LABEL[t]}
                </button>
              ))}
            </div>
          ) : (
            <div className="mb-5" />
          )}

          <div>
            {studioTab === "breakdown" && (
              <PriceBreakdownTab data={data} stack={stack} T={T} X={X} ER={ER} TM={TM} onNavigate={setStudioTab} />
            )}
            {studioTab === "baseline" && <BaselineTab data={data} T={T} />}
            {studioTab === "clustering" && <CountyClusteringTab data={data} />}
            {studioTab === "location" && <LocationTab data={data} stack={stack} T={T} X={X} />}
            {studioTab === "forecast" && <ForecastTab data={data} stack={stack} T={T} X={X} />}
            {studioTab === "adjustments" && <AdjustmentsTab fips={data.fips} />}
          </div>
        </div>
      )}
    </div>
  );
}
