"use client";

import { Lock, Upload } from "lucide-react";
import { HOUSE_RULES } from "@/lib/rules";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge, type Status } from "@/components/ui/status-badge";
import { InfoHint } from "@/components/ui/info-hint";

const pct = (n: number) => `${Math.round(n * 100)}%`;

/** one rule row: label · note · value · maturity pill. value optional (scaffold rows have none). */
function Row({ label, note, value, status }: { label: string; note?: string; value?: string; status: Status }) {
  return (
    <div className="border-border/60 flex items-center justify-between gap-3 border-b pb-3 text-sm last:border-0 last:pb-0">
      <span className="text-foreground/80 min-w-0">
        {label}
        {note && <span className="text-muted-foreground/60 text-xs"> · {note}</span>}
      </span>
      <div className="flex shrink-0 items-center gap-3">
        {value && <span className="text-muted-foreground tabular-nums">{value}</span>}
        <StatusBadge status={status} />
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">{children}</CardContent>
    </Card>
  );
}

/**
 * Rules Engine — the carrier's rules table (binding/delegated authority): the BOUNDS the underwriter
 * must work within. See dicsscssion/rules_engine_governance/00. Honest scaffold: no carrier table is
 * loaded yet, so we render the full binding-authority shape with InfraSure house defaults, each row
 * marked loaded / house-default / not-configured (one badge grammar; never red). The working ER/TM
 * VALUES are set by the underwriter in Studio → Adjustments, within these bounds.
 */
export function RulesEngineView() {
  const triggers = HOUSE_RULES.triggersOffered.join(", ");
  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <div className="flex items-center gap-2">
          <Lock className="text-muted-foreground size-4" />
          <h1 className="text-xl font-semibold tracking-tight">Rules Engine</h1>
        </div>
        <p className="text-muted-foreground mt-1 text-sm">
          The capacity provider&rsquo;s rules table — the bounds we underwrite within. Locked: changes go through a
          formal governance process, not edited here.
        </p>
      </div>

      {/* honest scaffold banner — don't show authoritative "carrier rules" when nothing is loaded */}
      <Card className="border-dashed">
        <CardContent className="flex items-center justify-between gap-3 py-4">
          <p className="text-muted-foreground text-sm">
            <span className="text-foreground font-medium">No carrier rules table loaded.</span> Showing InfraSure house
            defaults — replaced when a capacity provider uploads their table.
          </p>
          <button
            type="button"
            disabled
            className="border-border text-muted-foreground inline-flex h-9 shrink-0 cursor-default items-center gap-1.5 rounded-md border px-3 text-sm"
          >
            <Upload className="size-3.5" /> Upload rules table
            <span className="bg-muted rounded px-1.5 py-0.5 text-[10px]">soon</span>
          </button>
        </CardContent>
      </Card>

      <Section title="Eligibility">
        <Row label="Eligible territories" note="all counties with sufficient EAGLE-I history" status="loaded" />
        <Row label="Excluded counties" note="insufficient data (~7%) — not priced at zero, declined" status="loaded" />
      </Section>

      <Section title="Limits & capacity">
        <Row label="Max line per location" note="largest payout bindable on one risk" status="not-configured" />
        <Row label="Minimum premium" status="not-configured" />
        <Row label="Regional accumulation cap" note="aggregation limit per region" status="not-configured" />
      </Section>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-sm">Rating bounds</CardTitle>
            <InfoHint title="Bounds vs values">
              <p>
                The carrier sets the <b>bound</b> (a cap or floor); the underwriter picks the working <b>value</b>{" "}
                within it. The working expense ratio and target margin are set in <b>Studio → Adjustments</b>.
              </p>
            </InfoHint>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <Row label="Target-margin floor" note="chosen margin must be ≥ this" value={`≥ ${pct(HOUSE_RULES.marginFloor)}`} status="house-default" />
          <Row label="Expense-allowance cap" note="chosen expense ratio must be ≤ this" value={`≤ ${pct(HOUSE_RULES.expenseCap)}`} status="house-default" />
          <Row label="Rate floor / cap" note="min/max rate-on-line" status="not-configured" />
        </CardContent>
      </Card>

      <Section title="Triggers allowed">
        <Row
          label="Insurable trigger durations"
          note={`minimum ≥ ${HOUSE_RULES.triggerMinHours}h`}
          value={`${triggers} h`}
          status="loaded"
        />
      </Section>

      <Section title="Referral">
        <Row label="Out-of-guidelines thresholds" note="risks beyond authority → refer to carrier" status="not-configured" />
      </Section>

      <Section title="Reporting">
        <Row label="Bordereaux cadence" note="policies + claims report to the carrier" status="not-configured" />
      </Section>

      {/* platform config — InfraSure's, clearly NOT a carrier rule */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Platform data</CardTitle>
          <CardDescription>InfraSure&rsquo;s data configuration — not a carrier rule.</CardDescription>
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
    </div>
  );
}
