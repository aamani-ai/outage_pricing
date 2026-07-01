"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { composePremium, routedForward } from "@/lib/pricing";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InfoHint } from "@/components/ui/info-hint";
import { ExpandBox } from "@/components/ui/expand-box";
import { AddressSearch } from "@/components/pricing/address-search";
import { Segmented } from "@/components/pricing/segmented";
import { effectiveFactors, useQuoteStore } from "@/lib/quote-store";
import { api } from "@/lib/base-path";
import type { StudioData } from "@/components/studio/shared";

// Map is browser-only (MapLibre) — load it client-side, after a location is picked.
const LocationMap = dynamic(() => import("@/components/pricing/location-map"), {
  ssr: false,
  loading: () => (
    <div className="text-muted-foreground flex h-full min-h-[440px] items-center justify-center text-sm">
      Loading map…
    </div>
  ),
});

const TRIGGERS = [4, 8, 12, 24] as const;
const PAYOUTS = [500, 1000, 2500, 5000, 10000] as const;
const TRIGGER_NOTE: Record<number, string> = { 4: "brief", 8: "half a workday", 12: "overnight", 24: "a full day+" };

type Status = "idle" | "loading" | "error" | "nodata";

const usd = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

export function PricingView() {
  const { current, setLocation, setT, setX, loadings, adjustmentsFor } = useQuoteStore();
  const loc = current.location;
  const T = current.T;
  const X = current.X;
  const ER = loadings.ER;
  const TM = loadings.TM;
  const [data, setData] = useState<StudioData | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [errMsg, setErrMsg] = useState("");

  // fetch whenever the shared location changes (incl. one set on the Studio)
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
          setErrMsg(j.error ?? "Lookup failed.");
          return;
        }
        setData(j);
        setStatus("idle");
      })
      .catch(() => {
        if (!cancelled) {
          setStatus("error");
          setErrMsg("Network error.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [loc?.lat, loc?.lon]);

  const adj = adjustmentsFor(data?.fips);
  const hasAdj = adj.some((a) => a.enabled);
  const cell = data?.county.T[String(T)];
  // the SAME model factors + routing as the Studio, so the outward quote equals the Studio premium:
  // within-county location relativity, and the ROUTED forward factor (weather governs the winners, else stat).
  const modelLocRel = data?.location?.relativityByT?.[String(T)] ?? 1;
  const statFwd = data?.forward?.factorByT?.[String(T)] ?? 1;
  const wxFactor = data?.weather?.byT?.[String(T)]?.weatherFactor ?? null;
  const { factor: modelFwd } = routedForward(statFwd, wxFactor, data?.weather?.route === "weather");
  const stack = useMemo(() => {
    if (!cell || cell.lam == null) return null;
    const rateBand = cell.lo != null && cell.hi != null ? { low: cell.lo, high: cell.hi } : undefined;
    const ef = effectiveFactors(adj);
    // model factors × any manual load (multiplicative), exactly as the Studio composes them.
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
  }, [cell, T, X, adj, ER, TM, modelLocRel, modelFwd, data?.forward]);

  const lam = stack?.adjustedRate ?? 0;
  const years = lam > 0 ? 1 / lam : 0;
  const annualPct = lam > 0 ? Math.max(1, Math.round((1 - Math.exp(-lam)) * 100)) : 0;
  const everyN = years < 1.5 ? "year" : `~${Math.round(years)} years`;

  // first-time view: just the hero search, no duplicated section header
  if (!loc) {
    return (
      <div className="mx-auto flex max-w-xl flex-col justify-center px-2 py-24 text-center">
        <h2 className="mb-1 text-lg font-medium">Price any U.S. address</h2>
        <p className="text-muted-foreground mb-6 text-sm">
          Outage insurance pays a fixed amount when the power is out long enough at your location.
        </p>
        <AddressSearch onResolve={setLocation} autoFocus />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-5">
        <h1 className="text-xl font-semibold tracking-tight">Pricing</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Search an address, choose a trigger and payout, get an annual premium.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        {/* left — search + result */}
        <div className="space-y-4">
          <AddressSearch onResolve={setLocation} />
          <div className="text-muted-foreground text-xs">
            Pricing for <span className="text-foreground">{loc.label}</span>
          </div>

          {status === "loading" && (
            <Card>
              <CardContent className="text-muted-foreground p-6 text-sm">Pricing…</CardContent>
            </Card>
          )}
          {status === "error" && (
            <Card>
              <CardContent className="text-tier-red p-6 text-sm">{errMsg}</CardContent>
            </Card>
          )}
          {status === "nodata" && (
            <Card>
              <CardContent className="text-muted-foreground p-6 text-sm">
                No priced outage history for this county yet.
              </CardContent>
            </Card>
          )}
          {status === "idle" && data && !stack && (
            <Card>
              <CardContent className="text-muted-foreground p-6 text-sm">
                Not available at a {T}h trigger for this county — try another duration.
              </CardContent>
            </Card>
          )}

          {stack && data && (
            <>
              {/* premium — number left, range fills the top-right */}
              <Card>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-muted-foreground text-[11px] font-medium uppercase tracking-wider">
                        Annual premium · indicative
                      </div>
                      <div className="mt-0.5 text-4xl font-semibold tabular-nums">{usd(stack.premium.point)}</div>
                    </div>
                    {stack.bandDriver !== "none" && (
                      <div className="text-right">
                        <div className="text-muted-foreground flex items-center justify-end gap-1 text-[11px] font-medium uppercase tracking-wider">
                          likely range
                          <InfoHint title="What the range means" className="size-5">
                            <p>
                              This range is how much this county&rsquo;s outage rate has actually bounced year to year —
                              wider where the history is noisy or thin, tighter where it&rsquo;s steady and rich.
                            </p>
                            <p>It&rsquo;s our confidence in the price — not the spread of who-pays-what across the county.</p>
                          </InfoHint>
                        </div>
                        <div className="mt-0.5 text-base tabular-nums">
                          {usd(stack.premium.low)}–{usd(stack.premium.high)}
                        </div>
                      </div>
                    )}
                  </div>
                  {hasAdj && (
                    <p className="text-muted-foreground/70 mt-3 text-xs">Includes underwriter adjustments (set in the Studio).</p>
                  )}
                </CardContent>
              </Card>

              {/* risk detail — collapsed by default so it never pops out; carrier-useful when opened */}
              <ExpandBox title="Risk detail">
                <div className="space-y-2 text-sm">
                  <div className="flex items-baseline justify-between">
                    <span className="text-muted-foreground">How often (≥{T}h)</span>
                    <span className="tabular-nums">
                      ~ once every {everyN} <span className="text-muted-foreground/70">(~{annualPct}%/yr)</span>
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-muted-foreground">Confidence band</span>
                    <span className="tabular-nums">
                      {stack.bandDriver !== "none" ? `${usd(stack.premium.low)}–${usd(stack.premium.high)}` : "—"}
                    </span>
                  </div>
                  <p className="text-muted-foreground/80 border-border/60 mt-1 border-t pt-2 text-xs leading-relaxed">
                    Premium = expected frequency × payout, grossed up for expenses &amp; margin. The band reflects
                    how much local outage history backs the rate. Priced from federal EAGLE-I records for{" "}
                    {data.county.name}, {data.county.state}.
                  </p>
                </div>
              </ExpandBox>

              {/* controls */}
              <Card>
                <CardContent className="space-y-4 p-5">
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-sm font-medium">Trigger</span>
                      <span className="text-muted-foreground text-xs">{TRIGGER_NOTE[T]}</span>
                    </div>
                    <Segmented
                      options={TRIGGERS}
                      value={T}
                      onChange={setT}
                      render={(v) => `${v}h`}
                      className="flex w-full [&>button]:flex-1"
                    />
                    <p className="text-muted-foreground mt-2 text-xs">Pays if an outage at this address lasts {T}h+.</p>
                  </div>
                  <div>
                    <div className="mb-2 text-sm font-medium">Payout</div>
                    <Segmented
                      options={PAYOUTS}
                      value={X}
                      onChange={setX}
                      render={(v) => usd(v)}
                      className="flex w-full [&>button]:flex-1"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* how this pays */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">How this pays</CardTitle>
                </CardHeader>
                <CardContent className="text-muted-foreground space-y-1.5 text-sm">
                  <p>
                    · Pays the full <span className="text-foreground">{usd(X)}</span> the moment an outage reaches{" "}
                    <span className="text-foreground">{T} hours</span> — regardless of cause or damage.
                  </p>
                  <p>
                    · Pays on outage <span className="text-foreground">duration</span> at this exact address.
                  </p>
                  <p>· A just-missed outage doesn’t pay — it’s a fixed trigger, not a sliding scale.</p>
                  <p className="text-muted-foreground/70 pt-1 text-xs">
                    Priced from federal EAGLE-I outage records for {data.county.name}, {data.county.state}.
                  </p>
                </CardContent>
              </Card>
            </>
          )}
        </div>

        {/* right — map (stable height, sticky so it stays in view while scrolling the result) */}
        <Card className="h-[560px] overflow-hidden lg:sticky lg:top-6">
          <LocationMap lon={loc.lon} lat={loc.lat} label={loc.label} />
        </Card>
      </div>
    </div>
  );
}
