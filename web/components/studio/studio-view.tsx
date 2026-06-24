"use client";

import { useEffect, useMemo, useState } from "react";
import { composePremium } from "@/lib/pricing";
import { Card, CardContent } from "@/components/ui/card";
import { AddressSearch } from "@/components/pricing/address-search";
import { ContextBar } from "@/components/studio/context-bar";
import { PriceBreakdownTab } from "@/components/studio/tabs/price-breakdown";
import { BaselineTab } from "@/components/studio/tabs/baseline";
import { CountyClusteringTab } from "@/components/studio/tabs/county-clustering";
import { AdjustersTab } from "@/components/studio/tabs/adjusters";
import { effectiveFactors, useQuoteStore } from "@/lib/quote-store";
import { cn } from "@/components/ui/utils";
import { regimeLabel, type StudioData } from "@/components/studio/shared";
import { api } from "@/lib/base-path";

const SECTION_LABEL: Record<string, string> = {
  breakdown: "Price Breakdown",
  baseline: "Baseline",
  clustering: "County Clustering",
  adjusters: "Adjusters",
};
const TAB_ORDER = ["breakdown", "baseline", "clustering", "adjusters"] as const;

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
  // the model's within-county relativity for this address at the selected trigger (shadow, post-guardrail)
  const modelLocRel = data?.location?.relativityByT?.[String(T)] ?? 1;
  const stack = useMemo(() => {
    if (!cell || cell.lam == null) return null;
    const rateBand = cell.lo != null && cell.hi != null ? { low: cell.lo, high: cell.hi } : undefined;
    const ef = effectiveFactors(adj);
    // location = the MODELED within-county relativity × any manual location load (multiplicative,
    // so the model factor and the manual lever never double-count). The Studio HEADLINES this composed
    // shadow relativity (with the maturity banner); the outward /api/price path never applies it, so
    // the buyer's premium stays unmoved while location basis is shadow (D3).
    const locRel = modelLocRel * ef.location;
    return composePremium(
      {
        baseline: { lambdaCustomer: cell.lam, ...(rateBand ? { rateBand } : {}), status: "active" },
        location: { relativity: locRel, status: locRel !== 1 ? "modeled" : "placeholder" },
        forward: { factor: ef.forward, status: ef.forward !== 1 ? "modeled" : "placeholder" },
      },
      { T, X, expenseRatio: ER, targetMargin: TM },
    );
  }, [cell, T, X, ER, TM, adj, modelLocRel]);

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-4">
        <h1 className="text-xl font-semibold tracking-tight">Underwriting Studio</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          The same quote, opened up — the price breakdown, the baseline, the county regime, and the adjusters.
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

          {/* top tabs — a second, always-visible way to navigate; mirrors the sidebar sub-nav */}
          <div className="border-border mb-5 flex gap-1 border-b">
            {TAB_ORDER.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setStudioTab(t)}
                className={cn(
                  "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                  studioTab === t
                    ? "border-primary text-foreground"
                    : "text-muted-foreground hover:text-foreground border-transparent",
                )}
              >
                {SECTION_LABEL[t]}
              </button>
            ))}
          </div>

          <div>
            {studioTab === "breakdown" && (
              <PriceBreakdownTab data={data} stack={stack} T={T} X={X} ER={ER} TM={TM} onNavigate={setStudioTab} />
            )}
            {studioTab === "baseline" && <BaselineTab data={data} T={T} />}
            {studioTab === "clustering" && <CountyClusteringTab data={data} />}
            {studioTab === "adjusters" && <AdjustersTab data={data} stack={stack} T={T} />}
          </div>
        </div>
      )}
    </div>
  );
}
