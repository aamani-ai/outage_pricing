"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { InfoHint } from "@/components/ui/info-hint";
import { useQuoteStore } from "@/lib/quote-store";
import { api } from "@/lib/base-path";
import { money } from "@/lib/analytics/format";
import { stateName } from "@/lib/analytics/states";
import { cn } from "@/components/ui/utils";
import CENTROIDS from "@/lib/data/county-centroids.json";
import { PremiumMap } from "@/components/analytics/premium-map";
import { PremiumDistribution } from "@/components/analytics/premium-distribution";
import { FilterPanel, EMPTY_FILTER, type PremiumFilter } from "@/components/analytics/filter-panel";
import { KpiTile } from "@/components/analytics/kpi-tile";
import { QcPanel } from "@/components/analytics/qc-panel";
import type { AnalyticsResponse, AnalyticsRow, AnalyticsSummary } from "@/lib/analytics/types";

const T_OPTS = [2, 4, 8, 12, 24];
const X_OPTS = [500, 1000, 2500, 5000, 10000];
const usd0 = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
const centroids = CENTROIDS as unknown as Record<string, [number, number]>;

function Seg<V extends number>({ value, options, fmt, onChange }: { value: V; options: V[]; fmt: (v: V) => string; onChange: (v: V) => void }) {
  return (
    <div className="border-border inline-flex overflow-hidden rounded-md border">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => onChange(o)}
          className={cn(
            "px-3 py-1.5 text-sm font-medium tabular-nums transition-colors",
            o === value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
          )}
        >
          {fmt(o)}
        </button>
      ))}
    </div>
  );
}

/** Recompute the distribution summary client-side over a scoped set of rows (National or one state). */
function summarize(rows: AnalyticsRow[]): AnalyticsSummary | null {
  const priced = rows
    .filter((r) => !r.excluded && r.premium != null)
    .map((r) => r.premium as number)
    .sort((a, b) => a - b);
  if (!priced.length) return null;
  const q = (p: number) => {
    const i = (priced.length - 1) * p;
    const lo = Math.floor(i);
    const hi = Math.ceil(i);
    return lo === hi ? priced[lo]! : priced[lo]! + (priced[hi]! - priced[lo]!) * (i - lo);
  };
  return {
    totalCount: rows.length,
    pricedCount: priced.length,
    excludedCount: rows.length - priced.length,
    min: priced[0]!,
    p10: q(0.1),
    median: q(0.5),
    p90: q(0.9),
    max: priced[priced.length - 1]!,
    mean: priced.reduce((a, b) => a + b, 0) / priced.length,
  };
}

export function AnalyticsView() {
  const router = useRouter();
  const { current, loadings, setLocation, setT: setStoreT, setX: setStoreX } = useQuoteStore();
  const [T, setT] = useState(() => (T_OPTS.includes(current.T) ? current.T : 8));
  const [X, setX] = useState(() => (X_OPTS.includes(current.X) ? current.X : 2500));
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [status, setStatus] = useState<"loading" | "idle" | "error">("loading");

  const { ER, TM } = loadings;

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    fetch(api(`/api/analytics?T=${T}&X=${X}&er=${ER}&tm=${TM}`))
      .then(async (r) => {
        const j = (await r.json()) as AnalyticsResponse;
        if (cancelled) return;
        if (!r.ok) {
          setStatus("error");
          return;
        }
        setData(j);
        setStatus("idle");
      })
      .catch(() => !cancelled && setStatus("error"));
    return () => {
      cancelled = true;
    };
  }, [T, X, ER, TM]);

  // region scope (National | a state) — recompute everything on the scoped rows
  const [scope, setScope] = useState("");
  const states = useMemo(
    () => Array.from(new Set((data?.rows ?? []).map((r) => r.state))).sort((a, b) => stateName(a).localeCompare(stateName(b))),
    [data],
  );
  const scopedRows = useMemo(
    () => (scope ? (data?.rows ?? []).filter((r) => r.state === scope) : (data?.rows ?? [])),
    [data, scope],
  );
  const s = useMemo(() => summarize(scopedRows), [scopedRows]);

  const premiums = useMemo(
    () => scopedRows.filter((r) => !r.excluded && r.premium != null).map((r) => r.premium as number),
    [scopedRows],
  );

  // premium filter → highlight matching counties on the map (the rest dim)
  const [filter, setFilter] = useState<PremiumFilter>(EMPTY_FILTER);
  const matchActive = filter.min != null || filter.max != null;
  const matched = useMemo(() => {
    return scopedRows.filter((r) => {
      if (r.excluded || r.premium == null) return filter.includeExcluded;
      if (filter.min != null && r.premium < filter.min) return false;
      if (filter.max != null && r.premium > filter.max) return false;
      return true;
    });
  }, [scopedRows, filter]);
  const matchIds = useMemo(
    () => (matchActive ? new Set(matched.map((r) => Number(r.fips))) : null),
    [matched, matchActive],
  );
  const matchMedian = useMemo(() => {
    const ps = matched
      .filter((r) => !r.excluded && r.premium != null)
      .map((r) => r.premium as number)
      .sort((a, b) => a - b);
    return ps.length ? ps[Math.floor((ps.length - 1) * 0.5)]! : null;
  }, [matched]);

  // fit the map to the scoped state (interior centroids → bbox); null = National (CONUS)
  const focusBounds = useMemo<[[number, number], [number, number]] | null>(() => {
    if (!scope) return null;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const r of scopedRows) {
      const ll = centroids[r.fips];
      if (!ll) continue;
      if (ll[0] < minX) minX = ll[0];
      if (ll[0] > maxX) maxX = ll[0];
      if (ll[1] < minY) minY = ll[1];
      if (ll[1] > maxY) maxY = ll[1];
    }
    return Number.isFinite(minX) ? [[minX, minY], [maxX, maxY]] : null;
  }, [scope, scopedRows]);

  // open a county in the Underwriting Studio (centroid → /api/studio resolves the county)
  function openInStudio(fips: string) {
    const ll = centroids[fips];
    const row = data?.rows.find((r) => r.fips === fips);
    if (!ll) return;
    setStoreT(T);
    setStoreX(X);
    setLocation({ lon: ll[0], lat: ll[1], label: row ? `${row.name} County, ${row.state}` : fips });
    router.push("/studio");
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Analytics Studio</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          The whole book at once — every county priced at a chosen trigger and payout. See the spread, and check that
          every number is defensible.
        </p>
      </div>

      {/* controls */}
      <Card>
        <CardContent className="flex flex-wrap items-end gap-x-8 gap-y-3 py-4">
          <label className="space-y-1.5">
            <div className="text-muted-foreground text-[11px] font-medium uppercase tracking-wider">Trigger (≥ hours out)</div>
            <Seg value={T} options={T_OPTS} fmt={(v) => `${v}h`} onChange={setT} />
          </label>
          <label className="space-y-1.5">
            <div className="text-muted-foreground text-[11px] font-medium uppercase tracking-wider">Payout</div>
            <Seg value={X} options={X_OPTS} fmt={usd0} onChange={setX} />
          </label>
          <label className="space-y-1.5">
            <div className="text-muted-foreground text-[11px] font-medium uppercase tracking-wider">Region</div>
            <select
              value={scope}
              onChange={(e) => setScope(e.target.value)}
              className="bg-card border-border h-9 rounded-md border px-2 text-sm outline-none"
            >
              <option value="">National (CONUS)</option>
              {states.map((st) => (
                <option key={st} value={st}>
                  {stateName(st)}
                </option>
              ))}
            </select>
          </label>
          <div className="text-muted-foreground/70 ml-auto text-xs">
            loadings ER {Math.round(ER * 100)}% · TM {Math.round(TM * 100)}% · location held at county average
          </div>
        </CardContent>
      </Card>

      {status === "error" && (
        <Card>
          <CardContent className="text-tier-red p-6 text-sm">Couldn&rsquo;t run the batch. Try another trigger/payout.</CardContent>
        </Card>
      )}
      {status === "loading" && !data && (
        <Card>
          <CardContent className="text-muted-foreground p-6 text-sm">Pricing every county…</CardContent>
        </Card>
      )}
      {status !== "error" && data && !s && (
        <Card>
          <CardContent className="text-muted-foreground p-6 text-sm">No counties are offered at this trigger / payout.</CardContent>
        </Card>
      )}

      {status !== "error" && s && data && (
        <>
          {/* headline KPIs — the "what does the book look like" answer (an info button on each) */}
          <div className="space-y-2">
            <span className="text-muted-foreground text-[11px] font-medium uppercase tracking-wider">
              Across {scope ? scope : "the priced book"} · {T}h · {usd0(X)}
            </span>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <KpiTile
                label="median premium"
                value={money(s.median)}
                highlight
                hint={<p>The middle county&rsquo;s annual premium at this trigger &amp; payout — half the counties cost more, half less.</p>}
              />
              <KpiTile
                label="typical range (p10–p90)"
                value={`${money(s.p10)} – ${money(s.p90)}`}
                hint={<p>Where the middle 80% of counties land — the 10th to 90th percentile of premiums.</p>}
              />
              <KpiTile
                label="lowest offered"
                value={money(s.min)}
                hint={<p>The cheapest county we&rsquo;d actually quote. Excluded counties aren&rsquo;t counted, and an offered premium is never $0 (sub-$1 shows as &lt;$1).</p>}
              />
              <KpiTile
                label="excluded (not $0)"
                value={s.excludedCount.toLocaleString()}
                hint={<p>Counties we don&rsquo;t offer — insufficient data or red tier. Shown as excluded, never priced at $0.</p>}
              />
            </div>
          </div>

          {/* map (left) · filter + distribution stacked (right) — equal height */}
          <div className="grid gap-4 lg:grid-cols-5 lg:items-stretch">
            <div className="lg:col-span-3">
              <Card className="flex h-full flex-col overflow-hidden">
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <CardTitle className="text-sm">Premium across the country</CardTitle>
                      <CardDescription>county-representative annual premium at {T}h · {usd0(X)} · hover for detail, click to open</CardDescription>
                    </div>
                    <InfoHint title="The premium map">
                      <p>
                        Each CONUS county is shaded by its <b>county-representative</b> annual premium at the chosen
                        trigger &amp; payout (location held at county average). The color scale is <b>clamped to p10–p90</b>{" "}
                        so a few outliers don&rsquo;t wash out the middle.
                      </p>
                      <p>
                        <b>Hover</b> a county for its value; <b>click</b> to open it in the Underwriting Studio.
                      </p>
                    </InfoHint>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 p-0">
                  <div className="h-full min-h-[420px] w-full">
                    <PremiumMap rows={scopedRows} lo={s.p10} hi={s.p90} onPick={openInStudio} matchIds={matchIds} focusBounds={focusBounds} />
                  </div>
                </CardContent>
              </Card>
            </div>
            <div className="space-y-4 lg:col-span-2">
              <FilterPanel
                value={filter}
                onChange={setFilter}
                domain={{ lo: s.min, hi: s.p90 }}
                matchCount={matched.length}
                matchMedian={matchMedian}
              />
              <Card>
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <CardTitle className="text-sm">Premium distribution</CardTitle>
                      <CardDescription>spread across {s.pricedCount.toLocaleString()} priced counties (log scale)</CardDescription>
                    </div>
                    <InfoHint title="The distribution">
                      <p>
                        How the annual premium is spread across all priced CONUS counties (log scale). The dashed lines
                        mark <b>p10 / median / p90</b>. A handful of data-artifact outliers are clamped into the top bin
                        and listed in the QC tables below.
                      </p>
                    </InfoHint>
                  </div>
                </CardHeader>
                <CardContent>
                  <PremiumDistribution premiums={premiums} summary={s} />
                </CardContent>
              </Card>
            </div>
          </div>

          {/* QC — scoped to the same region as the map / distribution / summary */}
          <QcPanel rows={scopedRows} summary={s} onPick={openInStudio} scope={scope} />
        </>
      )}
    </div>
  );
}

