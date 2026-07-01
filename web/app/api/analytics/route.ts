import { NextResponse } from "next/server";
import { composePremium, routedForward } from "@/lib/pricing";
import { allCountyEntries } from "@/lib/data/pricing";
import { getForward } from "@/lib/data/forward";
import { getWeather } from "@/lib/data/weather";
import { getStudio } from "@/lib/data/studio";
import { getCustomerBase } from "@/lib/data/customer-base";
import { isConus } from "@/lib/analytics/conus";
import type { AnalyticsResponse, AnalyticsRow, AnalyticsSummary } from "@/lib/analytics/types";

/**
 * The national batch: price EVERY county for a chosen (T, X, ER, TM) and attach QC fields.
 * Reads the server-only catalogs (pricing/forward/studio) and composes per county — location is held
 * at 1.00 (a national batch is county-representative; location is mean-1 within-county redistribution).
 * Returns compact rows + a premium-distribution summary.
 */

const TS = new Set([2, 4, 8, 12, 24]);

/** linear-interpolated percentile of an ascending-sorted array. */
function pctile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo]!;
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (idx - lo);
}

export function GET(req: Request) {
  const u = new URL(req.url);
  const T = Number(u.searchParams.get("T") ?? 8);
  const X = Number(u.searchParams.get("X") ?? 2500);
  const ER = Number(u.searchParams.get("er") ?? 0.2);
  const TM = Number(u.searchParams.get("tm") ?? 0.15);

  if (!TS.has(T)) return NextResponse.json({ error: `T must be one of ${[...TS].join(", ")}` }, { status: 400 });
  if (!Number.isFinite(X) || X <= 0) return NextResponse.json({ error: "X (payout) must be > 0" }, { status: 400 });
  if (!Number.isFinite(ER) || !Number.isFinite(TM) || !(1 - ER - TM > 0))
    return NextResponse.json({ error: "1 − ER − TM must be > 0" }, { status: 400 });

  const Tk = String(T);
  const rows: AnalyticsRow[] = [];

  for (const [fips, c] of allCountyEntries()) {
    if (!isConus(fips)) continue; // CONUS only (AK/HI/territories out — by FIPS prefix, robust to name)
    const cell = c.T[Tk];
    const s = getStudio(fips);
    const fwd = getForward(fips);
    const wx = getWeather(fips);
    // routed forward: weather governs where the backtest routes to it (the durable winners), else statistical
    const { factor: fwdF, source: fwdSrc } = routedForward(
      fwd?.factorByT[Tk] ?? 1,
      wx?.byT[Tk]?.weatherFactor ?? null,
      wx?.route === "weather",
    );

    // exclusion — priority order → a single human reason. Excluded ≠ $0; it's "not offered".
    let exclReason: string | null = null;
    if (!cell || cell.lam == null) exclReason = "no price at this trigger";
    else if (c.quotable === false) exclReason = "not quotable";
    else if (c.tier === "red") exclReason = "red tier";
    else if (s?.regime === "insufficient") exclReason = s.sub ? `insufficient data · ${s.sub}` : "insufficient data";
    const excluded = exclReason != null;

    let premium: number | null = null;
    if (cell && cell.lam != null) {
      const stack = composePremium(
        {
          baseline: { lambdaCustomer: cell.lam, status: "active" },
          forward: { factor: fwdF, status: fwd || fwdSrc === "weather" ? "modeled" : "placeholder" },
          // location omitted → 1.00 (county-representative; mean-1 by construction)
        },
        { T, X, expenseRatio: ER, targetMargin: TM },
      );
      premium = stack.premium.point;
    }

    rows.push({
      fips,
      name: c.name,
      state: c.state,
      premium,
      lam: cell?.lam ?? null,
      n: cell?.n ?? null,
      gate: cell?.gate ?? null,
      tier: c.tier,
      quotable: c.quotable,
      regime: s?.regime ?? null,
      sub: s?.sub ?? null,
      conf: s?.conf ?? null,
      nObs: s?.n_obs ?? null,
      total: s?.total ?? null,
      forward: cell ? fwdF : null,
      excluded,
      exclReason,
      denomStatus: getCustomerBase(fips)?.status ?? null,
    });
  }

  const priced = rows
    .filter((r) => !r.excluded && r.premium != null)
    .map((r) => r.premium as number)
    .sort((a, b) => a - b);

  const summary: AnalyticsSummary | null = priced.length
    ? {
        totalCount: rows.length,
        pricedCount: priced.length,
        excludedCount: rows.length - priced.length,
        min: priced[0]!,
        p10: pctile(priced, 0.1),
        median: pctile(priced, 0.5),
        p90: pctile(priced, 0.9),
        max: priced[priced.length - 1]!,
        mean: priced.reduce((a, b) => a + b, 0) / priced.length,
      }
    : null;

  const body: AnalyticsResponse = { meta: { T, X, ER, TM }, rows, summary };
  return NextResponse.json(body);
}
