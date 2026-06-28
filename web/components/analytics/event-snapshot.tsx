"use client";

import { useEffect, useMemo, useState } from "react";
import type { EChartsOption } from "echarts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { InfoHint } from "@/components/ui/info-hint";
import { EChart, tooltipStyle, useChartColors } from "@/components/charts/echart";
import { api } from "@/lib/base-path";

interface CountyEvents {
  fips: string;
  epoch: string;
  minDurationH: number;
  cols: string[];
  n: number;
  events: [number, number, number, number][]; // [mins, durH, meanCust, maxCust]
}

const EPOCH_MS = Date.UTC(2014, 0, 1);
const dateMs = (mins: number) => EPOCH_MS + mins * 60_000;
const fmtInt = (n: number) => Math.round(n).toLocaleString();
const kLabel = (x: number) => (x >= 1000 ? `${(x / 1000).toFixed(x < 10000 ? 1 : 0)}k` : `${Math.round(x)}`);
const dayStr = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const minStr = (ms: number) => new Date(ms).toISOString().slice(0, 16).replace("T", " ");

function quantile(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  const i = (sorted.length - 1) * p;
  const lo = Math.floor(i);
  const hi = Math.ceil(i);
  return lo === hi ? sorted[lo]! : sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (i - lo);
}

const TRACE_MAX = 150; // events offered in the drill-down dropdown (top by peak)

/**
 * The per-county event time series — the numerator lens. Overview: each qualifying ≥T event by its mean
 * customers-out (the share-out numerator), mean vs median made visible. Drill-down: pick one event and see its
 * raw 15-minute outage trace (ramp · plateau · restoration), extracted on demand from the raw EAGLE-I.
 */
export function EventSnapshot({ fips, T, label }: { fips: string; T: number; label: string }) {
  const c = useChartColors();
  const [data, setData] = useState<CountyEvents | null>(null);
  const [status, setStatus] = useState<"loading" | "idle" | "error">("loading");

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    setData(null);
    fetch(api(`/api/county-events?fips=${fips}`))
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("no events"))))
      .then((j) => {
        if (!cancelled) {
          setData(j as CountyEvents);
          setStatus("idle");
        }
      })
      .catch(() => !cancelled && setStatus("error"));
    return () => {
      cancelled = true;
    };
  }, [fips]);

  const m = useMemo(() => {
    if (!data) return null;
    const ev = data.events.filter((e) => e[1] >= T);
    const means = ev.map((e) => e[2]);
    const sorted = [...means].sort((a, b) => a - b);
    const mean = means.length ? means.reduce((a, b) => a + b, 0) / means.length : 0;
    return { ev, n: ev.length, mean, median: quantile(sorted, 0.5), p90: quantile(sorted, 0.9), max: sorted.at(-1) ?? 0 };
  }, [data, T]);

  // events offered in the drill-down: the ≥T events, biggest peak first (the interesting/suspicious ones)
  const topEvents = useMemo(() => (m ? [...m.ev].sort((a, b) => b[3] - a[3]).slice(0, TRACE_MAX) : []), [m]);
  const [selIdx, setSelIdx] = useState(0);
  useEffect(() => setSelIdx(0), [fips, T]); // reset to the biggest event when county / trigger changes
  const sel = topEvents[selIdx] ?? null;
  const selMins = sel?.[0];
  const selDurH = sel?.[1];

  // the selected event's raw 15-minute trace (on-demand grep of the raw EAGLE-I)
  const [trace, setTrace] = useState<{ points: [number, number][]; startMs: number; endMs: number; n: number } | null>(null);
  const [traceStatus, setTraceStatus] = useState<"loading" | "idle" | "error">("idle");
  useEffect(() => {
    if (selMins == null || selDurH == null) {
      setTrace(null);
      return;
    }
    let cancelled = false;
    setTraceStatus("loading");
    fetch(api(`/api/event-trace?fips=${fips}&startMin=${selMins}&durH=${selDurH}`))
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("no trace"))))
      .then((j) => {
        if (!cancelled) {
          setTrace(j);
          setTraceStatus("idle");
        }
      })
      .catch(() => !cancelled && setTraceStatus("error"));
    return () => {
      cancelled = true;
    };
  }, [fips, selMins, selDurH]);

  // plot 1 — each event over time (log y); mean + median reference lines
  const scatter = useMemo<EChartsOption | null>(() => {
    if (!m || !m.n) return null;
    return {
      grid: { left: 6, right: 14, top: 18, bottom: 24, containLabel: true },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tooltip: { trigger: "item", ...tooltipStyle(c), formatter: (p: any) => `${dayStr(p.value[0])}<br/><b>${fmtInt(p.value[1])}</b> customers out (avg)` },
      xAxis: { type: "time", axisLine: { lineStyle: { color: c.axis } }, axisLabel: { color: c.sub, fontSize: 10 } },
      yAxis: { type: "log", min: 1, axisLabel: { color: c.sub, fontSize: 10, formatter: (v: number) => kLabel(v) }, splitLine: { lineStyle: { color: c.grid } } },
      series: [
        {
          type: "scatter",
          symbolSize: 5,
          large: true,
          itemStyle: { color: c.bar, opacity: 0.5 },
          data: m.ev.map((e) => [dateMs(e[0]), Math.max(e[2], 1)]),
          markLine: {
            symbol: "none",
            silent: true,
            data: [
              { yAxis: Math.max(m.mean, 1), lineStyle: { color: c.fwd, width: 1.5 }, label: { formatter: `avg ${fmtInt(m.mean)}`, color: c.fwd, fontSize: 10, position: "insideEndTop" } },
              { yAxis: Math.max(m.median, 1), lineStyle: { color: c.sub, type: "dashed", width: 1 }, label: { formatter: `median ${fmtInt(m.median)}`, color: c.sub, fontSize: 10, position: "insideEndBottom" } },
            ],
          },
        },
      ],
    };
  }, [m, c]);

  // plot 2 — per-event distribution (log-spaced bins)
  const hist = useMemo<EChartsOption | null>(() => {
    if (!m || !m.n) return null;
    const vals = m.ev.map((e) => Math.max(e[2], 1));
    const hi = Math.max(m.max, 2);
    const nb = 14;
    const edges = Array.from({ length: nb + 1 }, (_, i) => Math.pow(hi, i / nb));
    const counts = new Array(nb).fill(0);
    for (const v of vals) {
      let b = Math.floor((nb * Math.log(v)) / Math.log(hi));
      b = Math.min(Math.max(b, 0), nb - 1);
      counts[b]++;
    }
    const labels = edges.slice(0, nb).map((e, i) => `${kLabel(e)}–${kLabel(edges[i + 1]!)}`);
    return {
      grid: { left: 6, right: 12, top: 18, bottom: 42, containLabel: true },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tooltip: { trigger: "axis", ...tooltipStyle(c), valueFormatter: (v: any) => `${v} events` },
      xAxis: { type: "category", data: labels, name: "customers out (avg)", nameLocation: "middle", nameGap: 30, nameTextStyle: { color: c.sub, fontSize: 10 }, axisLine: { lineStyle: { color: c.axis } }, axisLabel: { color: c.sub, fontSize: 9, rotate: 40 }, axisTick: { show: false } },
      yAxis: { type: "value", axisLabel: { color: c.sub, fontSize: 10 }, splitLine: { lineStyle: { color: c.grid } } },
      series: [{ type: "bar", data: counts, barWidth: "90%", itemStyle: { color: c.bar, borderRadius: [2, 2, 0, 0] }, emphasis: { itemStyle: { color: c.barHover } } }],
    };
  }, [m, c]);

  // plot 3 — the selected event's raw 15-minute trace
  const traceOpt = useMemo<EChartsOption | null>(() => {
    if (!trace || !trace.points.length) return null;
    const dataMax = trace.points.reduce((mx, p) => (p[1] > mx ? p[1] : mx), 0);
    return {
      grid: { left: 6, right: 16, top: 30, bottom: 24, containLabel: true }, // headroom for the peak pin
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tooltip: { trigger: "axis", ...tooltipStyle(c), formatter: (ps: any) => `${minStr(ps[0].value[0])}<br/><b>${fmtInt(ps[0].value[1])}</b> customers out` },
      xAxis: { type: "time", axisLine: { lineStyle: { color: c.axis } }, axisLabel: { color: c.sub, fontSize: 10 } },
      yAxis: { type: "value", max: Math.max(Math.ceil((dataMax * 1.2) / 10) * 10, 1), axisLabel: { color: c.sub, fontSize: 10, formatter: (v: number) => kLabel(v) }, splitLine: { lineStyle: { color: c.grid } } },
      series: [
        {
          type: "line",
          showSymbol: false,
          smooth: false,
          data: trace.points,
          lineStyle: { color: c.bar, width: 1.5 },
          itemStyle: { color: c.bar },
          areaStyle: { color: c.bar, opacity: 0.12 },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          markPoint: { symbol: "pin", symbolSize: 42, data: [{ type: "max", name: "peak", label: { fontSize: 9, color: "#fff", formatter: (p: any) => fmtInt(Number(p.value)) } }], itemStyle: { color: c.fwd } },
        },
      ],
    };
  }, [trace, c]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-sm">County snapshot — event time series · ≥{T}h</CardTitle>
            <CardDescription>{label} · every qualifying outage, the distribution behind the share-out, and any one event&rsquo;s 15-min trace</CardDescription>
          </div>
          <InfoHint title="Why this view">
            <p>
              Each dot is one qualifying event; the y-axis is <b>customers out (average during the event)</b> — the
              numerator of the share-out. The <b>avg</b> line is what the per-customer rate uses; the <b>median</b> is the
              typical event. A big avg-vs-median gap means a few storms drive the rate (the A011 estimator question).
            </p>
            <p>
              The drill-down pulls one event&rsquo;s <b>raw 15-minute trace</b> straight from EAGLE-I — the actual outage
              shape (ramp, plateau, restoration), and where data-glitch spikes live.
            </p>
          </InfoHint>
        </div>
      </CardHeader>
      <CardContent>
        {status === "loading" && <p className="text-muted-foreground text-sm">Loading events…</p>}
        {status === "error" && <p className="text-muted-foreground text-sm">No event series for this county.</p>}
        {status === "idle" && m && (
          <>
            <div className="mb-3 flex flex-wrap gap-x-5 gap-y-1 text-sm">
              <span>
                <span className="text-muted-foreground">events ≥{T}h </span>
                <b className="tabular-nums">{fmtInt(m.n)}</b>
              </span>
              <span className="text-tier-green">
                <span className="text-muted-foreground">avg out (numerator) </span>
                <b className="tabular-nums">{fmtInt(m.mean)}</b>
              </span>
              <span>
                <span className="text-muted-foreground">median </span>
                <b className="tabular-nums">{fmtInt(m.median)}</b>
              </span>
              <span>
                <span className="text-muted-foreground">p90 </span>
                <b className="tabular-nums">{fmtInt(m.p90)}</b>
              </span>
              <span>
                <span className="text-muted-foreground">max </span>
                <b className="tabular-nums">{fmtInt(m.max)}</b>
              </span>
            </div>

            {m.n === 0 ? (
              <p className="text-muted-foreground text-sm">No events at ≥{T}h for this county.</p>
            ) : (
              <>
                <div className="grid gap-4 lg:grid-cols-2">
                  <div>
                    <div className="text-muted-foreground mb-1 text-[10px] font-medium uppercase tracking-wider">Each event over time</div>
                    {scatter && <EChart option={scatter} height={230} />}
                  </div>
                  <div>
                    <div className="text-muted-foreground mb-1 text-[10px] font-medium uppercase tracking-wider">Per-event distribution</div>
                    {hist && <EChart option={hist} height={230} />}
                  </div>
                </div>

                {/* drill-down — one event's raw 15-minute trace */}
                <div className="border-border/50 mt-4 border-t pt-3">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="text-muted-foreground text-[10px] font-medium uppercase tracking-wider">Drill into one event — raw 15-min trace</span>
                    <select
                      value={selIdx}
                      onChange={(e) => setSelIdx(Number(e.target.value))}
                      className="bg-card border-border h-8 max-w-full rounded-md border px-2 text-xs outline-none"
                      aria-label="pick an event"
                    >
                      {topEvents.map((e, i) => (
                        <option key={i} value={i}>
                          {minStr(dateMs(e[0]))} · peak {fmtInt(e[3])} · {e[1]}h
                        </option>
                      ))}
                    </select>
                    <span className="text-muted-foreground/60 text-[10px]">top {topEvents.length} by peak</span>
                  </div>
                  {traceStatus === "loading" && <p className="text-muted-foreground text-sm">Loading 15-min trace…</p>}
                  {traceStatus === "error" && <p className="text-muted-foreground text-sm">Couldn&rsquo;t load the raw trace (localhost only).</p>}
                  {traceStatus === "idle" && traceOpt && <EChart option={traceOpt} height={220} />}
                  {traceStatus === "idle" && trace && trace.points.length === 0 && (
                    <p className="text-muted-foreground text-sm">No raw snapshots found in this event&rsquo;s window.</p>
                  )}
                </div>
              </>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
