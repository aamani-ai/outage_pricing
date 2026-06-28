"use client";

import type { EChartsOption } from "echarts";
import relTable from "@/lib/data/location/relativity_table.json";
import { EChart, useChartColors, tooltipStyle } from "@/components/charts/echart";
import { ExpandBox } from "@/components/ui/expand-box";
import { ReadRow, SubLabel } from "@/components/studio/read-row";
import type { LocationRead } from "@/components/studio/shared";

const REL = relTable as unknown as { relativity: Record<string, { empirical: number[]; v0_shadow: number[] }> };
const TERCILES = ["rural", "mid", "urban"] as const;
/** subtle dotted underline (annotation, NOT a link) marking the physical grid-exposure signal. */
const SIG = "text-foreground/80 underline decoration-dotted decoration-muted-foreground/40 underline-offset-2";
const TERC_DESC: Record<string, { lead: string; sig?: string }> = {
  rural: { lead: "sparsest third —", sig: "long overhead radial feeders, more tree contact" },
  mid: { lead: "middle third — near the county average" },
  urban: { lead: "densest third —", sig: "undergrounded, looped, crew-dense" },
};
const relKey = (T: number) => `T${Math.min(T, 8)}`;

/**
 * The within-county location-basis detail — opened from the Location factor row in the Location tab.
 * Decision-read first (position · guardrail · one bar · trust); deep evidence in a nested ExpandBox.
 * Shadow: pilot-calibrated, nationally extrapolated; never moves the outward premium.
 */
export function LocationDetail({ loc, T, county }: { loc: LocationRead; T: number; county: string }) {
  const c = useChartColors();
  const Tc = Math.min(T, 8); // relativity is calibrated to T8; T≥8 reuses it
  const row = REL.relativity[relKey(T)] ?? REL.relativity.T8;
  const capped = row?.v0_shadow ?? [1, 1, 1];
  const idx = TERCILES.indexOf(loc.tercile);
  const pctile = Math.round(loc.pct * 100);
  const desc = TERC_DESC[loc.tercile] ?? { lead: loc.tercile };

  const barOption: EChartsOption = {
    grid: { left: 6, right: 14, top: 8, bottom: 20, containLabel: true },
    tooltip: { trigger: "axis", ...tooltipStyle(c), valueFormatter: (v) => `×${Number(v).toFixed(2)}` },
    xAxis: { type: "category", data: ["rural", "mid", "urban"], axisTick: { show: false }, axisLine: { lineStyle: { color: c.axis } }, axisLabel: { color: c.text } },
    yAxis: { type: "value", splitLine: { lineStyle: { color: c.grid } }, axisLabel: { color: c.sub, formatter: (v) => `×${v}` } },
    series: [
      {
        type: "bar",
        barWidth: "46%",
        data: capped.map((v, i) => ({ value: v, itemStyle: { color: i === idx ? c.loc : c.barSoft } })),
        markLine: { silent: true, symbol: "none", lineStyle: { color: c.sub, type: "dashed" }, data: [{ yAxis: 1 }], label: { formatter: "county avg", color: c.sub, fontSize: 10 } },
      },
    ],
  };

  const Ts = ["1", "2", "4", "8"];
  const evOption: EChartsOption = {
    grid: { left: 6, right: 14, top: 26, bottom: 20, containLabel: true },
    legend: { data: ["empirical", "capped (v0)"], textStyle: { color: c.text }, top: 0, right: 0, itemWidth: 10, itemHeight: 10 },
    tooltip: { trigger: "axis", ...tooltipStyle(c), valueFormatter: (v) => `×${Number(v).toFixed(2)}` },
    xAxis: { type: "category", data: Ts.map((t) => `${t}h`), axisTick: { show: false }, axisLine: { lineStyle: { color: c.axis } }, axisLabel: { color: c.text } },
    yAxis: { type: "value", splitLine: { lineStyle: { color: c.grid } }, axisLabel: { color: c.sub, formatter: (v) => `×${v}` } },
    series: [
      { name: "empirical", type: "bar", barGap: 0, barWidth: "32%", itemStyle: { color: c.barSoft }, data: Ts.map((t) => REL.relativity[`T${t}`]?.empirical?.[idx] ?? null) },
      { name: "capped (v0)", type: "bar", barWidth: "32%", itemStyle: { color: c.loc }, data: Ts.map((t) => REL.relativity[`T${t}`]?.v0_shadow?.[idx] ?? null) },
    ],
  };

  return (
    <div className="space-y-5 text-sm">
      {/* position — scannable read (the factor + $ effect lead in the headline above) */}
      <div>
        <SubLabel>Position in {county}</SubLabel>
        <div className="space-y-1.5">
          <ReadRow label="Tercile">
            <span className="text-foreground capitalize">{loc.tercile}</span> · {desc.lead}
            {desc.sig && (
              <>
                {" "}
                <span className={SIG}>{desc.sig}</span>
              </>
            )}
          </ReadRow>
          <ReadRow label="Density">
            <span className="tabular-nums">{Math.round(loc.density).toLocaleString("en-US")}</span> /km² · denser than{" "}
            <span className="tabular-nums">{pctile}%</span> of the county
          </ReadRow>
        </div>
      </div>

      {/* guardrail — only when it fired (no emoji, no colour literal: the box + label carry it) */}
      {loc.guardrail.triggered && (
        <div className="border-border/60 bg-muted/30 text-muted-foreground rounded-md border p-3">
          <span className="text-foreground/80 font-medium">Guardrail applied ({loc.guardrail.type === "A" ? "Type A" : "Type B"}). </span>
          {loc.guardrail.type === "A" ? (
            <>
              Residential density read “{loc.baseTercile}”, but this block is{" "}
              <span className="text-foreground tabular-nums">{loc.guardrail.impervious}%</span>{" "}
              <span className={SIG}>built-up</span> (NLCD impervious) — reclassified{" "}
              <span className="text-foreground">{loc.tercile}</span>. The Midtown-reads-rural fix, on demand for this address.
            </>
          ) : (
            <>
              Density read “{loc.baseTercile}”, but this block is only{" "}
              <span className="text-foreground tabular-nums">{loc.guardrail.impervious}%</span>{" "}
              <span className={SIG}>built-up</span> — conservatively moved toward{" "}
              <span className="text-foreground">{loc.tercile}</span>.
            </>
          )}
        </div>
      )}

      {/* the within-county gradient at the selected trigger */}
      <div>
        <SubLabel>Within-county gradient · density tercile · T≥{Tc}h (mean-1)</SubLabel>
        <EChart option={barOption} height={150} />
      </div>

      {/* trust — honest maturity, split from the factor */}
      <p className="text-muted-foreground/70 text-xs leading-relaxed">
        Trust: <span className="text-foreground/70">shadow</span> — calibrated on the CT/MA/RI pilot (one quiet season);
        {loc.validated ? " this county is in the validated set." : " this county is nationally extrapolated, not independently validated."}
        {loc.dispersion != null && (
          <> Within-county density spread here is <span className="tabular-nums">{loc.dispersion.toFixed(2)}</span> — higher means location matters more.</>
        )}{" "}
        Assumptions A018–A023.
      </p>

      {/* deep evidence — demoted to detail per communicate-to-share */}
      <ExpandBox title={<span className="text-muted-foreground text-sm font-normal">Methodology &amp; evidence</span>}>
        <div className="space-y-3">
          <div className="text-muted-foreground/80 text-xs leading-relaxed">
            Empirical (raw) vs capped (v0) for the <span className="capitalize">{loc.tercile}</span> tercile across triggers — the cap{" "}
            (<span className="tabular-nums">0.80–1.40</span>) is a deliberate attribution-confidence throttle (A022), not the signal size.
          </div>
          <EChart option={evOption} height={170} />
          <p className="text-muted-foreground/70 text-xs leading-relaxed">
            Conservation (A018): within every county the exposure-weighted mean of these relativities is{" "}
            <span className="text-foreground/70">1.00 by construction</span> — location only redistributes risk inside a county, it never changes the county total.
          </p>
        </div>
      </ExpandBox>
    </div>
  );
}
