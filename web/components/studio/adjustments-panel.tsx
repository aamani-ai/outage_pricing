"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { useQuoteStore } from "@/lib/quote-store";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { InfoHint } from "@/components/ui/info-hint";
import { cn } from "@/components/ui/utils";

const field = "bg-card border-border h-9 rounded-md border px-2.5 text-sm outline-none";

export function AdjustmentsPanel({ fips }: { fips: string }) {
  const { adjustmentsFor, addAdjustment, updateAdjustment, removeAdjustment } = useQuoteStore();
  const adj = adjustmentsFor(fips);

  const [pct, setPct] = useState(10);
  const [reason, setReason] = useState("");

  function add() {
    addAdjustment(fips, {
      label: reason.trim() || "Manual load",
      kind: "manual",
      pct,
      reason: reason.trim() || undefined,
    });
    setReason("");
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-sm">Manual loads</CardTitle>
            <CardDescription>your judgment overlay on this county — each with a reason</CardDescription>
          </div>
          <InfoHint title="Manual loads">
            <p>
              A <b>manual load</b> is your underwriting judgment on this county — e.g. known local exposure the data
              can&rsquo;t see yet. Each is a ±% with a written reason and is fully audited.
            </p>
            <p>
              It flows into this premium <b>and</b> the outward quote for any address in this county. Location and
              forward factors come from the models (above) — they&rsquo;re not hand-set here.
            </p>
          </InfoHint>
        </div>
      </CardHeader>
      <CardContent className="space-y-2.5">
        {adj.length === 0 && (
          <p className="text-muted-foreground text-sm">No manual loads — the price is the model output.</p>
        )}
        {adj.map((a) => (
          <div key={a.id} className="flex items-center gap-2.5 text-sm">
            <input
              type="checkbox"
              checked={a.enabled}
              onChange={(e) => updateAdjustment(fips, a.id, { enabled: e.target.checked })}
              className="accent-primary size-4"
              aria-label={`Toggle ${a.label}`}
            />
            <span className={cn("min-w-0 flex-1", !a.enabled && "text-muted-foreground line-through")}>
              <span className="font-medium">{a.label}</span>
              <span className="text-muted-foreground">
                {" "}
                · {a.pct > 0 ? "+" : ""}
                {a.pct}%
              </span>
            </span>
            <button
              type="button"
              onClick={() => removeAdjustment(fips, a.id)}
              aria-label={`Remove ${a.label}`}
              className="text-muted-foreground hover:text-tier-red transition-colors"
            >
              <X className="size-4" />
            </button>
          </div>
        ))}

        <div className="border-border/60 flex flex-wrap items-center gap-2 border-t pt-3">
          <div className="flex items-center gap-1">
            <input
              type="number"
              value={pct}
              onChange={(e) => setPct(Number(e.target.value))}
              className={cn(field, "w-20 text-right tabular-nums")}
              aria-label="Percent"
            />
            <span className="text-muted-foreground text-sm">%</span>
          </div>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="reason (e.g. coastal exposure not in history)"
            className={cn(field, "min-w-0 flex-1")}
          />
          <button
            type="button"
            onClick={add}
            className="bg-primary text-primary-foreground inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-sm font-medium hover:opacity-90"
          >
            <Plus className="size-4" /> Add load
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
