"use client";

import { useMemo, useState } from "react";
import { ArrowRight, ChevronRight } from "lucide-react";
import type { EChartsOption } from "echarts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { STATUS_DOT } from "@/components/ui/status-badge";
import { InfoHint } from "@/components/ui/info-hint";
import { cn } from "@/components/ui/utils";
import { EChart, tooltipStyle, useChartColors } from "@/components/charts/echart";
import { forwardComponents, forwardRouting, usd, pct, type Stack, type StudioData, type StudioTab } from "@/components/studio/shared";

export function PriceBreakdownTab({
  data,
  stack,
  T,
  X,
  ER,
  TM,
  onNavigate,
}: {
  data: StudioData;
  stack: NonNullable<Stack>;
  T: number;
  X: number;
  ER: number;
  TM: number;
  onNavigate: (tab: StudioTab) => void;
}) {
  const c = useChartColors();
  const cell = data.county.T[String(T)];

  // pure-risk decomposition (baseline × location × forward → additive $ buckets) + exact dollar split
  const baseLam = cell?.lam ?? 0;
  const locF = stack.location.relativity;
  const retail = stack.premium.point;
  const retailR = Math.round(retail);
  const pureR = Math.round(stack.pure);
  const baselineR = Math.round(baseLam * X);
  const locR = Math.round(baseLam * (locF - 1) * X);
  const fwdR = pureR - baselineR - locR; // residual keeps the pure-risk buckets summing to pureR
  const loadR = Math.max(0, retailR - pureR);
  const expR = ER + TM > 0 ? Math.round((loadR * ER) / (ER + TM)) : 0;
  const mgnR = loadR - expR;

  const waterfall = useMemo<EChartsOption>(() => {
    const cats = ["Expected loss", "+ Expenses", "+ Margin", "Retail"];
    const lbl = (idx: number, val: number) => ({
      show: true,
      position: "top" as const,
      color: c.text,
      fontSize: 10,
      formatter: (p: { dataIndex: number }) => (p.dataIndex === idx ? usd(val) : ""),
    });
    return {
      grid: { left: 6, right: 12, top: 16, bottom: 34, containLabel: true },
      legend: {
        data: ["Baseline", "Location basis", "Forward", "Expenses", "Margin", "Retail"],
        bottom: 0,
        icon: "roundRect",
        itemWidth: 9,
        itemHeight: 9,
        selectedMode: false,
        textStyle: { color: c.text, fontSize: 11 },
      },
      tooltip: { trigger: "item", valueFormatter: (v) => usd(Number(v)), ...tooltipStyle(c) },
      xAxis: {
        type: "category",
        data: cats,
        axisTick: { show: false },
        axisLine: { lineStyle: { color: c.axis } },
        axisLabel: { color: c.text, fontSize: 11 },
      },
      yAxis: {
        type: "value",
        axisLabel: { color: c.sub, fontSize: 10, formatter: (v: number) => `$${v}` },
        splitLine: { lineStyle: { color: c.grid } },
      },
      series: [
        { name: "base", type: "bar", stack: "t", silent: true, itemStyle: { color: "transparent" }, data: [0, pureR, pureR + expR, 0] },
        { name: "Baseline", type: "bar", stack: "t", barWidth: "52%", itemStyle: { color: c.bar }, data: [baselineR, 0, 0, 0] },
        { name: "Location basis", type: "bar", stack: "t", barWidth: "52%", itemStyle: { color: c.loc }, data: [locR, 0, 0, 0] },
        { name: "Forward", type: "bar", stack: "t", barWidth: "52%", itemStyle: { color: c.fwd }, data: [fwdR, 0, 0, 0], label: lbl(0, pureR) },
        { name: "Expenses", type: "bar", stack: "t", barWidth: "52%", itemStyle: { color: c.barSoft }, data: [0, expR, 0, 0], label: lbl(1, expR) },
        { name: "Margin", type: "bar", stack: "t", barWidth: "52%", itemStyle: { color: c.amber }, data: [0, 0, mgnR, 0], label: lbl(2, mgnR) },
        { name: "Retail", type: "bar", stack: "t", barWidth: "52%", itemStyle: { color: c.green }, data: [0, 0, 0, retailR], label: lbl(3, retailR) },
      ],
    };
  }, [c, baselineR, locR, fwdR, expR, mgnR, pureR, retailR]);

  // each row's $ is its contribution to the expected loss (baseline = the base $; location & forward =
  // the marginal +/− $ they add). Same buckets that drive the waterfall, so the chain reads additively:
  // baseline → +location → +forward = expected loss → +expense → +margin = annual premium.
  const factors = [
    {
      label: `Baseline λ_customer (${T}h)`,
      val: `${cell?.lam.toFixed(3)} /yr`,
      status: stack.baseline.status,
      note: "per-customer annual frequency",
      tab: "baseline" as StudioTab,
      cta: "Baseline",
      dollar: baselineR,
      base: true,
    },
    {
      label: "× Location basis (within-county)",
      val: `×${stack.location.relativity.toFixed(2)}`,
      status: stack.location.status,
      note: stack.location.relativity === 1 ? "not yet applied" : "adjusted",
      tab: "location" as StudioTab,
      cta: "Location basis",
      dollar: locR,
      base: false,
    },
    {
      label: "× Forecast",
      val: `×${stack.forward.factor.toFixed(2)}`,
      status: stack.forward.status,
      note: stack.forward.factor > 1.005 ? "statistical — county’s own history" : "holds at county average",
      tab: "forecast" as StudioTab,
      cta: "Forecast",
      dollar: fwdR,
      base: false,
    },
  ];

  // the Forecast row expands in place to reveal its three components (stat · climate · grid) without
  // leaving the page — same shared decomposition as the Forecast tab; collapsed by default.
  const [fwdOpen, setFwdOpen] = useState(false);
  const fwdRouting = forwardRouting(data, T);
  const fwdComponents = forwardComponents({
    routedFactor: stack.forward.factor,
    source: fwdRouting.source,
    statFactor: fwdRouting.statFactor,
    weatherFactor: fwdRouting.weatherFactor,
    statStatus: stack.forward.status,
  });

  return (
    <div className="space-y-5">
      {/* factor build-up — multiplicative chain into the expected loss */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardTitle className="text-sm">Factor build-up</CardTitle>
              <CardDescription>baseline → location basis → forward → expected loss → expense + margin → annual premium</CardDescription>
            </div>
            <InfoHint title="How the premium is built">
              <p>
                We start from the county&rsquo;s per-customer outage frequency (the <b>baseline</b> λ), apply the
                within-county <b>location basis</b> factor and the <b>forward</b> (stat + climate + grid) factor, multiply by
                the payout, then divide by (1 − expenses − margin).
              </p>
              <p>
                Each row shows its <b>dollar contribution</b> to the expected loss — the baseline $, then the +/− each
                factor adds — so the chain adds up to the annual premium. The small dot is data maturity:{" "}
                <b>active</b> (in the price today), <b>modeled</b> (an estimate), <b>placeholder</b> (not plugged in yet,
                ×1.00). Open a row to see its evidence.
              </p>
            </InfoHint>
          </div>
        </CardHeader>
        <CardContent className="space-y-0">
          {factors.map((row) => {
            const expandable = row.tab === "forecast";
            return (
              <div key={row.label}>
                <div className="border-border/60 flex items-center justify-between gap-3 border-b py-2.5 text-sm">
                  <span className="text-foreground/80 flex min-w-0 items-center gap-1.5">
                    {expandable ? (
                      <button
                        type="button"
                        onClick={() => setFwdOpen((o) => !o)}
                        aria-expanded={fwdOpen}
                        aria-label="Toggle forward components"
                        className="text-muted-foreground hover:text-foreground -ml-1 shrink-0"
                      >
                        <ChevronRight className={cn("size-3.5 transition-transform", fwdOpen && "rotate-90")} />
                      </button>
                    ) : (
                      <span className="size-3.5 shrink-0" aria-hidden />
                    )}
                    <span className="min-w-0">
                      {row.label}
                      <span className="text-muted-foreground/60 text-xs"> · {row.note}</span>
                    </span>
                  </span>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="text-muted-foreground/70 text-xs tabular-nums">{row.val}</span>
                    <span className="flex w-20 items-center justify-end gap-1.5 text-sm" title={`${row.status} — data maturity`}>
                      <span className={cn("size-1.5 shrink-0 rounded-full", STATUS_DOT[row.status])} />
                      <span className="font-medium tabular-nums">
                        {row.base ? usd(row.dollar) : `${row.dollar < 0 ? "−" : "+"}${usd(Math.abs(row.dollar))}`}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => onNavigate(row.tab)}
                      className="text-primary hover:bg-muted inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-xs"
                    >
                      {row.cta} <ArrowRight className="size-3" />
                    </button>
                  </div>
                </div>
                {expandable && fwdOpen && (
                  <div className="border-border/60 border-b pb-2">
                    {fwdComponents.map((comp) => (
                      <div key={comp.key} className="flex items-center justify-between gap-3 py-1 pl-6 text-xs">
                        <span className="flex min-w-0 items-center gap-2">
                          <span
                            className={cn(
                              "size-1.5 shrink-0 rounded-full",
                              comp.active ? "bg-status-active" : "ring-status-placeholder bg-transparent ring-1",
                            )}
                          />
                          <span className="text-foreground/70 shrink-0">{comp.name}</span>
                          <span className="text-muted-foreground/50 truncate">· {comp.blurb}</span>
                        </span>
                        <span className={cn("shrink-0 tabular-nums", comp.active ? "text-foreground/80" : "text-muted-foreground/40")}>
                          ×{comp.factor.toFixed(2)}
                        </span>
                      </div>
                    ))}
                    <p className="text-muted-foreground/60 pl-6 pt-1 text-[11px] leading-relaxed">
                      Statistical × Climate/Weather × Grid = {row.val} ·{" "}
                      {fwdRouting.source === "weather"
                        ? "weather governs here (won the backtest); statistical & grid stand down to ×1.00"
                        : "statistical governs here; climate/weather & grid stand down to ×1.00"}.
                    </p>
                  </div>
                )}
              </div>
            );
          })}
          {/* expected loss — the loss cost (emphasized) */}
          <div className="border-border mt-3 flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5">
            <span className="text-sm font-medium">
              Expected loss
              <span className="text-muted-foreground/70 text-xs font-normal"> · adjusted λ × {usd(X)} / yr</span>
            </span>
            <span className="text-base font-semibold tabular-nums">{usd(stack.pure)}</span>
          </div>

          {/* gross-up to retail — expenses + margin (platform-wide, set in Studio → Adjustments) */}
          <div className="flex items-center justify-between py-2 pl-3 text-sm">
            <span className="text-muted-foreground">
              + Expense load <span className="text-muted-foreground/60 text-xs">· ER {pct(ER)}</span>
            </span>
            <span className="text-muted-foreground tabular-nums">+{usd(expR)}</span>
          </div>
          <div className="flex items-center justify-between py-2 pl-3 text-sm">
            <span className="text-muted-foreground">
              + Margin <span className="text-muted-foreground/60 text-xs">· TM {pct(TM)}</span>
            </span>
            <span className="text-muted-foreground tabular-nums">+{usd(mgnR)}</span>
          </div>

          {/* annual premium — what the customer actually pays (hero) */}
          <div className="border-primary bg-primary/5 mt-1 flex items-center justify-between gap-3 rounded-lg border px-3 py-3">
            <div className="min-w-0">
              <div className="text-sm font-semibold">
                Annual premium
                <span className="text-muted-foreground/70 text-xs font-normal"> · expected loss ÷ (1 − ER − TM) · what the customer pays</span>
              </div>
              {stack.bandDriver !== "none" && (
                <div className="text-muted-foreground/70 mt-0.5 text-xs tabular-nums">
                  likely {usd(stack.premium.low)}–{usd(stack.premium.high)} ·{" "}
                  <button type="button" onClick={() => onNavigate("baseline")} className="text-primary hover:underline">
                    why?
                  </button>
                </div>
              )}
            </div>
            <span className="text-lg font-bold tabular-nums">{usd(retail)}</span>
          </div>
        </CardContent>
      </Card>

      {/* dollar waterfall — pure → expenses → margin → retail (ECharts, hover for values) */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardTitle className="text-sm">Where the premium goes</CardTitle>
              <CardDescription>expected loss grossed up to the retail premium · hover any bar</CardDescription>
            </div>
            <InfoHint title="Expected loss · expenses · margin">
              <p>
                The <b>expected loss</b> (expected annual payouts) is grossed up by an{" "}
                <b>expenses</b> load and a <b>target margin</b> to the retail premium.
              </p>
              <p>
                Expense ratio and margin are platform-wide — set them in the <b>Adjustments</b> tab. (Currently {pct(ER)} /{" "}
                {pct(TM)}.)
              </p>
            </InfoHint>
          </div>
        </CardHeader>
        <CardContent>
          <EChart option={waterfall} height={260} />
        </CardContent>
      </Card>
    </div>
  );
}
