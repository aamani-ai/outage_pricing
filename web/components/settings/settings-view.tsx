"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Check } from "lucide-react";
import { useQuoteStore } from "@/lib/quote-store";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const pct = (n: number) => `${Math.round(n * 100)}%`;

export function SettingsView() {
  const { loadings, setLoadings } = useQuoteStore();
  const [draft, setDraft] = useState(loadings);
  const [flash, setFlash] = useState(false);
  // re-sync the draft if loadings change elsewhere (e.g. another tab)
  useEffect(() => setDraft(loadings), [loadings.ER, loadings.TM]);
  const dirty = draft.ER !== loadings.ER || draft.TM !== loadings.TM;
  const denom = 1 - draft.ER - draft.TM;

  function apply() {
    setLoadings(draft);
    setFlash(true);
    window.setTimeout(() => setFlash(false), 1800);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Platform-wide controls — loadings and data source, applied to every quote.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Pricing loadings</CardTitle>
          <CardDescription>
            Your standing expense ratio and target margin — applied to every premium across Pricing and the Studio.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5 pt-1">
          <label className="block">
            <div className="mb-1.5 flex items-center justify-between text-sm">
              <span className="font-medium">Expense ratio</span>
              <span className="text-muted-foreground tabular-nums">{pct(draft.ER)}</span>
            </div>
            <input
              type="range"
              min={0}
              max={40}
              value={Math.round(draft.ER * 100)}
              onChange={(e) => setDraft((d) => ({ ...d, ER: Number(e.target.value) / 100 }))}
              className="accent-primary w-full"
            />
          </label>
          <label className="block">
            <div className="mb-1.5 flex items-center justify-between text-sm">
              <span className="font-medium">Target margin</span>
              <span className="text-muted-foreground tabular-nums">{pct(draft.TM)}</span>
            </div>
            <input
              type="range"
              min={0}
              max={40}
              value={Math.round(draft.TM * 100)}
              onChange={(e) => setDraft((d) => ({ ...d, TM: Number(e.target.value) / 100 }))}
              className="accent-primary w-full"
            />
          </label>
          <p className="text-muted-foreground/70 text-xs tabular-nums">
            retail = pure ÷ (1 − expense − margin) = ÷ {denom.toFixed(2)}
          </p>
          <div className="flex items-center gap-3 pt-1">
            <button
              type="button"
              onClick={apply}
              disabled={!dirty}
              className="bg-primary text-primary-foreground inline-flex h-9 items-center rounded-md px-4 text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              Apply across the platform
            </button>
            {flash && (
              <span className="text-tier-green flex items-center gap-1 text-xs font-medium">
                <Check className="size-3.5" /> Applied everywhere
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Data source</CardTitle>
          <CardDescription>The EAGLE-I event catalog prices are built from.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border-border flex items-center justify-between rounded-md border px-3 py-2 text-sm">
            <span>
              EAGLE-I · 45 min <span className="text-muted-foreground">(default)</span>
            </span>
            <span className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-[10px]">30 / 60 min · soon</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Risk exposure adjustments</CardTitle>
          <CardDescription>Manual underwriting loads — applied per county, with a reason.</CardDescription>
        </CardHeader>
        <CardContent>
          <a
            href="/studio"
            className="border-border hover:bg-muted/40 flex items-center justify-between rounded-md border px-3 py-2.5 text-sm transition-colors"
          >
            <span className="text-muted-foreground">
              Set manual loads in the <span className="text-foreground font-medium">Studio → Adjusters</span> tab —
              they flow into both the quote and the outward price for that county.
            </span>
            <ArrowRight className="text-muted-foreground ml-3 size-4 shrink-0" />
          </a>
        </CardContent>
      </Card>
    </div>
  );
}
