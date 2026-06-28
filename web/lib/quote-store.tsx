"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

/**
 * Shared client store (localStorage-backed) for underwriter adjustments and saved
 * quotes. Adjustments are keyed by county FIPS so an adjustment applied in the
 * Studio flows into the outward Pricing quote for ANY address in that county.
 */

export type AdjKind = "forward" | "location" | "manual";

/** which Underwriting Studio section is active — driven from the sidebar sub-nav.
 *  The old single "adjusters" tab is split into the two model FACTORS (location · forecast)
 *  and the underwriter LEVERS (adjustments) — see plan/dashboard_redesign/03. */
export type StudioTab = "breakdown" | "baseline" | "clustering" | "location" | "forecast" | "adjustments";

export interface Adjustment {
  id: string;
  label: string;
  kind: AdjKind;
  /** percent change; +10 → ×1.10, −20 → ×0.80. */
  pct: number;
  enabled: boolean;
  reason?: string;
}

export interface SavedQuote {
  id: string;
  label: string;
  lat: number;
  lon: number;
  fips: string;
  county: string;
  T: number;
  X: number;
  savedAt: number;
}

export interface Loc {
  lon: number;
  lat: number;
  label: string;
}

interface Store {
  /** the quote being worked on — shared across Pricing and the Studio. */
  current: { location: Loc | null; T: number; X: number };
  setLocation: (loc: Loc) => void;
  setT: (t: number) => void;
  setX: (x: number) => void;
  /** active Underwriting Studio section — shared with the sidebar sub-nav. */
  studioTab: StudioTab;
  setStudioTab: (t: StudioTab) => void;
  /** platform-wide pricing loadings — applied to every quote. */
  loadings: { ER: number; TM: number };
  setLoadings: (patch: Partial<{ ER: number; TM: number }>) => void;
  adjustmentsFor: (fips: string | undefined) => Adjustment[];
  addAdjustment: (fips: string, a: { label: string; kind: AdjKind; pct: number; reason?: string }) => void;
  updateAdjustment: (fips: string, id: string, patch: Partial<Adjustment>) => void;
  removeAdjustment: (fips: string, id: string) => void;
  saved: SavedQuote[];
  saveQuote: (q: Omit<SavedQuote, "id" | "savedAt">) => void;
  removeSaved: (id: string) => void;
}

const Ctx = createContext<Store | null>(null);
const LS_ADJ = "infrasure.adjustments.v1";
const LS_SAVED = "infrasure.savedQuotes.v1";
const LS_LOADINGS = "infrasure.loadings.v1";

export function QuoteProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<{ location: Loc | null; T: number; X: number }>({ location: null, T: 8, X: 2500 });
  const [loadings, setLoadingsState] = useState({ ER: 0.2, TM: 0.15 });
  const [studioTab, setStudioTab] = useState<StudioTab>("breakdown");
  const [byFips, setByFips] = useState<Record<string, Adjustment[]>>({});
  const [saved, setSaved] = useState<SavedQuote[]>([]);

  useEffect(() => {
    try {
      const a = localStorage.getItem(LS_ADJ);
      if (a) setByFips(JSON.parse(a));
      const s = localStorage.getItem(LS_SAVED);
      if (s) setSaved(JSON.parse(s));
      const l = localStorage.getItem(LS_LOADINGS);
      if (l) setLoadingsState(JSON.parse(l));
    } catch {
      /* ignore corrupt storage */
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(LS_LOADINGS, JSON.stringify(loadings));
    } catch {
      /* ignore */
    }
  }, [loadings]);

  useEffect(() => {
    try {
      localStorage.setItem(LS_ADJ, JSON.stringify(byFips));
    } catch {
      /* ignore */
    }
  }, [byFips]);
  useEffect(() => {
    try {
      localStorage.setItem(LS_SAVED, JSON.stringify(saved));
    } catch {
      /* ignore */
    }
  }, [saved]);

  const store: Store = {
    current,
    setLocation: (loc) => setCurrent((c) => ({ ...c, location: loc })),
    setT: (T) => setCurrent((c) => ({ ...c, T })),
    setX: (X) => setCurrent((c) => ({ ...c, X })),
    studioTab,
    setStudioTab,
    loadings,
    setLoadings: (patch) => setLoadingsState((l) => ({ ...l, ...patch })),
    adjustmentsFor: (fips) => (fips ? byFips[fips] ?? [] : []),
    addAdjustment: (fips, a) =>
      setByFips((prev) => ({
        ...prev,
        [fips]: [...(prev[fips] ?? []), { id: crypto.randomUUID(), enabled: true, ...a }],
      })),
    updateAdjustment: (fips, id, patch) =>
      setByFips((prev) => ({
        ...prev,
        [fips]: (prev[fips] ?? []).map((x) => (x.id === id ? { ...x, ...patch } : x)),
      })),
    removeAdjustment: (fips, id) =>
      setByFips((prev) => ({ ...prev, [fips]: (prev[fips] ?? []).filter((x) => x.id !== id) })),
    saved,
    saveQuote: (q) =>
      setSaved((prev) =>
        [
          { id: crypto.randomUUID(), savedAt: Date.now(), ...q },
          ...prev.filter((p) => !(p.fips === q.fips && p.T === q.T && p.X === q.X && p.label === q.label)),
        ].slice(0, 50),
      ),
    removeSaved: (id) => setSaved((prev) => prev.filter((p) => p.id !== id)),
  };

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export function useQuoteStore(): Store {
  const c = useContext(Ctx);
  if (!c) throw new Error("useQuoteStore must be used within QuoteProvider");
  return c;
}

/** Combine enabled adjustments into the multiplicative location & forward factors. */
export function effectiveFactors(adjustments: Adjustment[]): { location: number; forward: number; active: boolean } {
  let location = 1;
  let forward = 1;
  let active = false;
  for (const a of adjustments) {
    if (!a.enabled) continue;
    active = true;
    const f = 1 + a.pct / 100;
    if (a.kind === "location") location *= f;
    else forward *= f; // forward + manual both scale the forward factor
  }
  return { location, forward, active };
}
