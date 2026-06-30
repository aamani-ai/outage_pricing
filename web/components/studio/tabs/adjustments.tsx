"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { useQuoteStore } from "@/lib/quote-store";
import { HOUSE_RULES } from "@/lib/rules";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { InfoHint } from "@/components/ui/info-hint";
import { AdjustmentsPanel } from "@/components/studio/adjustments-panel";

const pct = (n: number) => `${Math.round(n * 100)}%`;

/**
 * Adjustments — the underwriter LEVERS, set within the Rules-Engine bounds (carrier sets the bound,
 * underwriter picks the value — see the primer). Two levers: the platform-wide loadings (ER/TM) and
 * per-county manual loads. These are the ONLY hand-set knobs in the Studio; the factors above are
 * model outputs.
 */
export function AdjustmentsTab({ fips }: { fips: string }) {
  const { loadings, setLoadings } = useQuoteStore();
  const [draft, setDraft] = useState(loadings);
  const [flash, setFlash] = useState(false);
  // re-sync the draft if loadings change elsewhere (e.g. another tab)
  useEffect(() => setDraft(loadings), [loadings.ER, loadings.TM]);
  const dirty = draft.ER !== loadings.ER || draft.TM !== loadings.TM;
  const denom = 1 - draft.ER - draft.TM;

  // bound checks (context only — not enforced this pass)
  const erOverCap = draft.ER > HOUSE_RULES.expenseCap + 1e-9;
  const tmUnderFloor = draft.TM < HOUSE_RULES.marginFloor - 1e-9;

  function apply() {
    setLoadings(draft);
    setFlash(true);
    window.setTimeout(() => setFlash(false), 1800);
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardTitle className="text-sm">Loadings (expense &amp; margin)</CardTitle>
              <CardDescription>
                your standing expense ratio and target margin — applied to every premium across Pricing and the Studio
              </CardDescription>
            </div>
            <InfoHint title="Set within the carrier's bounds">
              <p>
                The capacity provider sets the <b>bounds</b> (expense cap, margin floor) in the <b>Rules Engine</b>;
                you pick the working <b>value</b> within them here.
              </p>
              <p>
                Today these are InfraSure house defaults — expense ≤ {pct(HOUSE_RULES.expenseCap)}, margin ≥{" "}
                {pct(HOUSE_RULES.marginFloor)} — shown as context, not yet hard-enforced.
              </p>
            </InfoHint>
          </div>
        </CardHeader>
        <CardContent className="space-y-5 pt-1">
          <label className="block">
            <div className="mb-1.5 flex items-center justify-between text-sm">
              <span className="font-medium">
                Expense ratio
                <span className="text-muted-foreground/60 text-xs font-normal"> · carrier cap ≤ {pct(HOUSE_RULES.expenseCap)} · house default</span>
              </span>
              <span className={erOverCap ? "text-tier-amber tabular-nums" : "text-muted-foreground tabular-nums"}>
                {pct(draft.ER)}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={40}
              value={Math.round(draft.ER * 100)}
              onChange={(e) => setDraft((d) => ({ ...d, ER: Number(e.target.value) / 100 }))}
              className="accent-primary w-full"
            />
            {erOverCap && <p className="text-tier-amber mt-1 text-xs">above the house expense cap — would need carrier sign-off</p>}
          </label>
          <label className="block">
            <div className="mb-1.5 flex items-center justify-between text-sm">
              <span className="font-medium">
                Target margin
                <span className="text-muted-foreground/60 text-xs font-normal"> · carrier floor ≥ {pct(HOUSE_RULES.marginFloor)} · house default</span>
              </span>
              <span className={tmUnderFloor ? "text-tier-amber tabular-nums" : "text-muted-foreground tabular-nums"}>
                {pct(draft.TM)}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={40}
              value={Math.round(draft.TM * 100)}
              onChange={(e) => setDraft((d) => ({ ...d, TM: Number(e.target.value) / 100 }))}
              className="accent-primary w-full"
            />
            {tmUnderFloor && <p className="text-tier-amber mt-1 text-xs">below the house margin floor — would need carrier sign-off</p>}
          </label>
          <p className="text-muted-foreground/70 text-xs tabular-nums">
            retail = expected loss ÷ (1 − expense − margin) = ÷ {denom.toFixed(2)}
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

      {/* per-county manual loads — the underwriter's judgment overlay */}
      <AdjustmentsPanel fips={fips} />
    </div>
  );
}
