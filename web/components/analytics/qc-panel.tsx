"use client";

import { useMemo } from "react";
import { ArrowRight } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { InfoHint } from "@/components/ui/info-hint";
import { cn } from "@/components/ui/utils";
import { money } from "@/lib/analytics/format";
import { stateName } from "@/lib/analytics/states";
import type { AnalyticsRow, AnalyticsSummary } from "@/lib/analytics/types";

const rate = (n: number | null) => (n == null ? "—" : n >= 0.1 ? n.toFixed(2) : n >= 0.001 ? n.toFixed(3) : "<0.001");

const AMBER = "text-tier-amber";

/**
 * The flags for one row — each self-explanatory, no jargon. The customer-base denominator (A018) is
 * shown on EVERY row for honesty: a repaired base (housing-units / peak floor) is NOT "clean data".
 * Order: how we got the base → is the rate physically real → is the sample thin → is the history stable.
 */
function flags(r: AnalyticsRow): { label: string; tone: string }[] {
  const out: { label: string; tone: string }[] = [];

  // 1) customer-base denominator — what we divided by (the honesty flag). Terse; legend explains.
  //    green = raw/clean base · amber = repaired (look twice). Always shown.
  if (r.denomStatus === "peak_floor") out.push({ label: "peak base", tone: AMBER });
  else if (r.denomStatus === "housing_floor") out.push({ label: "housing base", tone: AMBER });
  else if (r.denomStatus === "mcc_ok") out.push({ label: "MCC base", tone: "text-tier-green" });

  // 2) per-customer rate too high to be physically real (data artifact)
  if (r.lam != null && r.lam > 5) out.push({ label: "implausible λ", tone: "text-tier-red" });

  // 3) thin sample at this trigger
  if (r.n != null && r.n < 20) out.push({ label: `only ${r.n} events`, tone: AMBER });
  else if (r.gate === "caution") out.push({ label: "thin @T", tone: AMBER });

  // 4) unstable / uncertain history (the clustering read)
  if (r.regime === "shift") out.push({ label: "shift", tone: AMBER });
  else if (r.regime === "episodic") out.push({ label: "episodic", tone: AMBER });
  if (r.conf === "low") out.push({ label: "uncertain", tone: AMBER });

  return out;
}

/** the flag legend — shared by the QC summary card and EACH watch table's "i", so the meaning of a
 *  flag is always one click away from where it's shown (info-on-every-section). */
const FLAG_LEGEND = (
  <>
    <p className="text-foreground/80">
      <b>What the flags mean</b>{" "}
      <span className="text-muted-foreground/70">(green = fine · amber = look twice · red = likely artifact)</span>:
    </p>
    <ul className="text-muted-foreground/90 ml-3 list-disc space-y-0.5">
      <li><b className="text-tier-green">MCC base</b> — denominator is the raw utility customer count (no repair). The clean case.</li>
      <li><b className="text-tier-amber">housing base</b> / <b className="text-tier-amber">peak base</b> — the denominator was <i>repaired</i> because MCC was too low / impossible (A018). Not raw data.</li>
      <li><b className="text-tier-amber">only N events</b> / <b className="text-tier-amber">thin @T</b> — small sample at the selected trigger.</li>
      <li><b className="text-tier-amber">shift</b> / <b className="text-tier-amber">episodic</b> — the county&rsquo;s outage history isn&rsquo;t stable (the clustering read).</li>
      <li><b className="text-tier-amber">uncertain</b> — the regime classifier had low confidence (borderline / thin history).</li>
      <li><b className="text-tier-red">implausible λ</b> — a per-customer rate too high to be physically real (data artifact).</li>
    </ul>
  </>
);

/** one watch table (lowest or highest priced), each row → opens the county in the Underwriting Studio. */
function WatchTable({
  title,
  desc,
  rows,
  onPick,
}: {
  title: string;
  desc: string;
  rows: AnalyticsRow[];
  onPick: (fips: string) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-sm">{title}</CardTitle>
            <CardDescription>{desc}</CardDescription>
          </div>
          <InfoHint title="What the flags mean">{FLAG_LEGEND}</InfoHint>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted-foreground border-border border-b text-xs">
                <th className="py-1.5 text-left font-medium">County</th>
                <th className="py-1.5 text-right font-medium">Premium</th>
                <th className="py-1.5 text-right font-medium">λ/cust</th>
                <th className="py-1.5 text-right font-medium">Events</th>
                <th className="py-1.5 pl-4 text-left font-medium">Flags</th>
                <th className="py-1.5" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const fs = flags(r);
                return (
                  <tr
                    key={r.fips}
                    onClick={() => onPick(r.fips)}
                    className="border-border/50 hover:bg-muted/40 cursor-pointer border-b last:border-0"
                  >
                    <td className="py-2">
                      <span className="font-medium">{r.name}</span>
                      <span className="text-muted-foreground">, {r.state}</span>
                    </td>
                    <td className="py-2 text-right font-semibold tabular-nums">{money(r.premium as number)}</td>
                    <td className="text-muted-foreground py-2 text-right tabular-nums">{rate(r.lam)}</td>
                    <td className="text-muted-foreground py-2 text-right tabular-nums">{r.n?.toLocaleString() ?? "—"}</td>
                    <td className="py-2 pl-4">
                      <span className="flex flex-wrap gap-1">
                        {fs.map((f) => (
                          <span key={f.label} className={cn("bg-muted rounded px-1.5 py-0.5 text-[11px]", f.tone)}>
                            {f.label}
                          </span>
                        ))}
                      </span>
                    </td>
                    <td className="py-2 pr-1 text-right">
                      <ArrowRight className="text-muted-foreground/50 inline size-3.5" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

export function QcPanel({
  rows,
  summary,
  onPick,
  scope,
}: {
  rows: AnalyticsRow[];
  summary: AnalyticsSummary;
  onPick: (fips: string) => void;
  /** "" = National (CONUS); a state abbr scopes the watch tables + excluded list to that state. */
  scope?: string;
}) {
  const where = scope ? `in ${stateName(scope)}` : "nationwide";
  const offered = useMemo(
    () => rows.filter((r) => !r.excluded && r.premium != null).sort((a, b) => (a.premium as number) - (b.premium as number)),
    [rows],
  );
  const lowest = offered.slice(0, 15);
  const highest = useMemo(() => offered.slice(-15).reverse(), [offered]);

  const excludedByReason = useMemo(() => {
    const m = new Map<string, AnalyticsRow[]>();
    for (const r of rows.filter((r) => r.excluded)) {
      const key = (r.exclReason ?? "excluded").split(" · ")[0]!; // root reason
      const arr = m.get(key) ?? (m.set(key, []), m.get(key)!);
      arr.push(r);
    }
    return [...m.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [rows]);

  return (
    <div className="space-y-5">
      {/* the assertion — model_to_consequence: nothing nonsensical reaches a carrier */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardTitle className="text-sm">Quality control</CardTitle>
              <CardDescription>every county is priced defensibly or excluded — and the tails are surfaced, not hidden</CardDescription>
            </div>
            <InfoHint title="Why this matters">
              <p>
                An offered county is <b>never shown as $0</b> — thin / insufficient counties are <b>excluded</b>, and a
                very small offered premium (low payout × high trigger) reads <b>&lt;$1</b>. Every row carries flags so a
                high or low price is never presented as &ldquo;clean&rdquo; when it isn&rsquo;t — they link into the Studio.
              </p>
              {FLAG_LEGEND}
              <p className="text-muted-foreground/70">
                Regime / exclusion is assessed at the <b>county level</b> (the ≥8h history), not re-evaluated per selected
                trigger.
              </p>
            </InfoHint>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            <span className="text-foreground font-medium">{summary.pricedCount.toLocaleString()}</span> counties priced ·{" "}
            <span className="text-foreground font-medium">{summary.excludedCount.toLocaleString()}</span> excluded (declined,
            not $0) · offered range{" "}
            <span className="text-foreground font-medium tabular-nums">
              {money(summary.min)} – {money(summary.max)}
            </span>
            . Both ends are listed below so every number is traceable.
          </p>
        </CardContent>
      </Card>

      <WatchTable
        title="Lowest-priced — defensible?"
        desc={`the ${lowest.length} cheapest offered counties ${where} at this trigger · click to open in the Underwriting Studio`}
        rows={lowest}
        onPick={onPick}
      />
      <WatchTable
        title="Highest-priced — defensible?"
        desc={`the ${highest.length} priciest offered counties ${where} · an implausible λ (data artifact) shows up here`}
        rows={highest}
        onPick={onPick}
      />

      {/* excluded — shown as excluded, with the reason */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Excluded — not offered</CardTitle>
          <CardDescription>shown as excluded (declined), never priced at $0 · grouped by reason</CardDescription>
        </CardHeader>
        <CardContent className="space-y-1">
          {excludedByReason.map(([reason, list]) => (
            <details key={reason} className="group">
              <summary className="hover:bg-muted/40 flex cursor-pointer list-none items-center justify-between rounded-md px-2 py-1.5 text-sm [&::-webkit-details-marker]:hidden">
                <span className="capitalize">{reason}</span>
                <span className="text-muted-foreground tabular-nums">{list.length}</span>
              </summary>
              <div className="text-muted-foreground flex flex-wrap gap-x-3 gap-y-1 px-2 py-2 text-xs">
                {list.slice(0, 60).map((r) => (
                  <button key={r.fips} type="button" onClick={() => onPick(r.fips)} className="hover:text-foreground transition-colors">
                    {r.name}, {r.state}
                  </button>
                ))}
                {list.length > 60 && <span className="text-muted-foreground/60">+{list.length - 60} more</span>}
              </div>
            </details>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
