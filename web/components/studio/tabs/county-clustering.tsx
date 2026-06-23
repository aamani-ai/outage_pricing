"use client";

import { useMemo } from "react";
import type { EChartsOption } from "echarts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { InfoHint } from "@/components/ui/info-hint";
import { ExpandBox } from "@/components/ui/expand-box";
import { EChart, tooltipStyle, useChartColors } from "@/components/charts/echart";
import { cn } from "@/components/ui/utils";
import { parseLabels, REGIME_DISPLAY, regimeKey, type StudioData } from "@/components/studio/shared";
import REGIME_DIST from "@/lib/data/regime-dist.json";

const DIST = REGIME_DIST as Record<string, number>;
const REGIME_KEYS = ["stable", "trend", "shift", "episodic"]; // the four behavioral regimes
const ABSTAIN_KEYS = ["recent-change", "insufficient"]; // the honest abstention, two faces — NOT behaviors

const MEANING: Record<string, string> = {
  stable: "flat — no significant trend year to year.",
  trend: "a steady climb or decline over the record.",
  shift: "stepped to a new level and held there.",
  episodic: "a storm spike that reverts — one or two years dominate.",
  "recent-change":
    "plenty of history, but the rate recently moved — so we don't force a long-run label. Treat the long-run average with care, and check whether it's a real change or a reporting taper near the present.",
  insufficient: "genuinely too few events or too short a history to read a pattern.",
};
const TONE: Record<string, string> = {
  stable: "text-tier-green",
  trend: "text-tier-amber",
  shift: "text-tier-amber",
  episodic: "text-tier-amber",
  "recent-change": "text-tier-amber",
  insufficient: "text-muted-foreground",
};
const stripLabel = (l: string) => (l === "insufficient" ? "abstain" : l);

/** least-squares trend line — the simple line the classifier weighs, drawn over the bars. */
function trend(xs: number[], ys: number[]): number[] {
  const n = ys.length;
  if (n < 2) return ys.slice();
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    const x = xs[i] ?? 0;
    const y = ys[i] ?? 0;
    num += (x - mx) * (y - my);
    den += (x - mx) ** 2;
  }
  const slope = den ? num / den : 0;
  const b = my - slope * mx;
  return xs.map((x) => Math.max(0, slope * x + b));
}

function Stat({ label, v, pct }: { label: string; v: number | null; pct?: boolean }) {
  return (
    <div>
      <div className="text-muted-foreground text-[10px] font-medium uppercase tracking-wider">{label}</div>
      <div className="tabular-nums">{v == null ? "—" : pct ? `${Math.round(v * 100)}%` : v}</div>
    </div>
  );
}

export function CountyClusteringTab({ data }: { data: StudioData }) {
  const c = useChartColors();
  const s = data.studio;
  const series = s?.perT["8"] ?? [];
  const years = s?.years ?? [];
  const fit = useMemo(() => trend(years, series), [years, series]);

  const seriesOpt = useMemo<EChartsOption>(
    () => ({
      grid: { left: 6, right: 12, top: 16, bottom: 34, containLabel: true },
      legend: {
        data: ["≥8h outages", "trend"],
        bottom: 0,
        icon: "roundRect",
        itemWidth: 9,
        itemHeight: 9,
        selectedMode: false,
        textStyle: { color: c.text, fontSize: 11 },
      },
      tooltip: { trigger: "axis", axisPointer: { type: "shadow" }, ...tooltipStyle(c) },
      xAxis: {
        type: "category",
        data: years.map(String),
        axisTick: { show: false },
        axisLine: { lineStyle: { color: c.axis } },
        axisLabel: { color: c.sub, fontSize: 10 },
      },
      yAxis: { type: "value", axisLabel: { color: c.sub, fontSize: 10 }, splitLine: { lineStyle: { color: c.grid } } },
      series: [
        {
          name: "≥8h outages",
          type: "bar",
          data: series,
          barWidth: "55%",
          itemStyle: { color: c.bar, borderRadius: [3, 3, 0, 0] },
          emphasis: { itemStyle: { color: c.barHover } },
        },
        {
          name: "trend",
          type: "line",
          data: fit.map((v) => Math.round(v)),
          symbol: "none",
          lineStyle: { color: c.amber, width: 2, type: "dashed" },
          z: 3,
        },
      ],
    }),
    [c, series, years, fit],
  );

  if (!s)
    return (
      <Card>
        <CardContent className="text-muted-foreground p-6 text-sm">No regime classified for this county.</CardContent>
      </Card>
    );

  const key = regimeKey(s.regime, s.sub);
  const labels = parseLabels(s.labels_by_T);
  const order = ["2", "4", "8", "12", "24"];
  const distTotal = Object.values(DIST).reduce((a, b) => a + b, 0);
  const peerPct = distTotal ? Math.round(((DIST[key] ?? 0) / distTotal) * 100) : 0;
  const isAbstain = ABSTAIN_KEYS.includes(key);
  const typedTotal = REGIME_KEYS.reduce((a, k) => a + (DIST[k] ?? 0), 0);
  const abstainTotal = ABSTAIN_KEYS.reduce((a, k) => a + (DIST[k] ?? 0), 0);
  const distRow = (k: string) => {
    const pct = distTotal ? ((DIST[k] ?? 0) / distTotal) * 100 : 0;
    const here = k === key;
    return (
      <div key={k} className={cn("flex items-center gap-3 rounded-md px-2 py-1 text-sm", here && "bg-muted/50")}>
        <span className={cn("w-32 shrink-0", here ? "font-medium" : "text-muted-foreground")}>
          {REGIME_DISPLAY[k] ?? k}
          {here && " ◄"}
        </span>
        <div className="bg-muted h-2 flex-1 overflow-hidden rounded-full">
          <div
            className={cn("h-full rounded-full", here ? "bg-primary" : "bg-muted-foreground/30")}
            style={{ width: `${Math.max(2, pct)}%` }}
          />
        </div>
        <span className="text-muted-foreground w-10 shrink-0 text-right text-xs tabular-nums">{Math.round(pct)}%</span>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      {/* 1 — regime identity */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardTitle className="text-sm">County regime · {REGIME_DISPLAY[key] ?? key}</CardTitle>
              <CardDescription>how this county&rsquo;s outage history behaves — a read on its past, not a forecast</CardDescription>
            </div>
            <InfoHint title="The county’s risk identity">
              <p>How the county&rsquo;s annual ≥8h history <b>behaves</b> — its identity, not a price move:</p>
              <div className="space-y-1 pt-0.5">
                <div><b>Stable</b> — flat, no significant trend</div>
                <div><b>Trend</b> — a steady climb or decline</div>
                <div><b>Shift</b> — stepped to a new level</div>
                <div><b>Episodic</b> — a storm spike that reverts</div>
                <div className="text-muted-foreground/70 pt-1">— and when we can&rsquo;t type it, an honest abstention —</div>
                <div><b>Recent change</b> — data-rich, but the rate just shifted (too new to type)</div>
                <div><b>Insufficient data</b> — genuinely too few events / too short a history</div>
              </div>
              <p>The regime is a <b>router / diagnostic</b> — it never moves the price by itself.</p>
            </InfoHint>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className={cn("text-base font-semibold", TONE[key])}>{REGIME_DISPLAY[key] ?? key}</span>
            {isAbstain && <span className="text-muted-foreground text-sm">· abstained — not a behavioral regime</span>}
            {s.conf && s.conf !== "—" && <span className="text-muted-foreground text-sm">· {s.conf} confidence</span>}
          </div>
          <p className="text-muted-foreground text-sm">{MEANING[key]}</p>

          {/* cross-T strip */}
          <div className="border-border/60 border-t pt-3">
            <div className="text-muted-foreground mb-1.5 text-xs">
              Behaviour by trigger <span className="text-muted-foreground/60">· {s.xT ?? "—"}</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {order
                .filter((t) => labels[t])
                .map((t) => (
                  <span key={t} className="border-border rounded-md border px-2 py-1 text-xs">
                    <span className="text-muted-foreground">{t}h</span>{" "}
                    <span className="font-medium">{stripLabel(labels[t] ?? "")}</span>
                  </span>
                ))}
            </div>
          </div>

          {/* collapsed classifier detail */}
          <ExpandBox title="Classifier detail">
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
              <Stat label="Observed years" v={s.n_obs} />
              <Stat label="Total ≥8h events" v={s.total} />
              <Stat label="Trend t-stat" v={s.tstat} />
              <Stat label="Volatility (CV)" v={s.cv} />
              <Stat label="Peak-year share" v={s.peak_share} pct />
              <Stat label="Step-fit (r)" v={s.r_step} />
              <Stat label="Cross-T stability" v={s.stab4} />
            </div>
            <p className="text-muted-foreground/70 mt-3 text-xs leading-relaxed">
              The classifier <b>abstains rather than force a label</b> when the evidence won&rsquo;t support one — e.g. a
              sharp recent move. &ldquo;Recent change&rdquo; means the data is there but the latest years shifted; weigh
              the long-run average with care and check whether it&rsquo;s a real change or a reporting taper near the
              present.
            </p>
          </ExpandBox>

          <p className="text-muted-foreground/70 text-xs">
            Behaviour read from the EAGLE-I ≥8h history; it routes which forward view a county needs and never moves the
            price by itself.
          </p>
        </CardContent>
      </Card>

      {/* 2 — annual series + fitted trend */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Annual ≥8h outages, with fitted trend</CardTitle>
          <CardDescription>does the history match the label? — hover any bar</CardDescription>
        </CardHeader>
        <CardContent>
          <EChart option={seriesOpt} height={220} />
          <p className="text-muted-foreground/70 mt-1 text-xs">
            {years[0]}–{years[years.length - 1]} · {series.reduce((a, b) => a + b, 0)} events · dashed line =
            least-squares trend
          </p>
        </CardContent>
      </Card>

      {/* 3 — among peers */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Among peers · national regime mix</CardTitle>
          <CardDescription>how common this county&rsquo;s read is ({peerPct}% of U.S. counties)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <div className="text-muted-foreground text-[11px] font-medium uppercase tracking-wider">
              Behavioral regimes · {distTotal ? Math.round((typedTotal / distTotal) * 100) : 0}%
            </div>
            {REGIME_KEYS.filter((k) => DIST[k]).map(distRow)}
          </div>
          <div className="border-border/60 space-y-1.5 border-t pt-3">
            <div className="text-muted-foreground text-[11px] font-medium uppercase tracking-wider">
              Abstained — not typed · {distTotal ? Math.round((abstainTotal / distTotal) * 100) : 0}%
            </div>
            {ABSTAIN_KEYS.filter((k) => DIST[k]).map(distRow)}
          </div>
          <p className="text-muted-foreground/70 text-xs leading-relaxed">
            Four behavioral regimes; the remaining ~11% is an honest abstention — <b>recent change</b> (data-rich but
            too new to type) and <b>insufficient data</b> (genuinely sparse) — not a fifth and sixth behavior.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
