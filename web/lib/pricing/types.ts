/**
 * The pricing data contract — the single shared shape both the outward Pricing
 * view and the Underwriting Studio render from. No React, no DOM, no fetch.
 *
 * Premium = λ_customer(T) × location_relativity × forward_factor × X ÷ (1 − ER − TM).
 * See docs/dicsscssion/done/dashboard_redesign/04_pricing_model_in_ui.md and 07_outward_range.md.
 */

/** Per-component honesty badge — provenance is universal, not special-cased. */
export type LayerStatus = 'active' | 'modeled' | 'placeholder';

/** Why the band is the width it is (kept distinct from heterogeneity — A017). */
export type BandDriver = 'confidence' | 'placement-widened' | 'none';

/** Baseline: the per-customer annual frequency at the chosen trigger T. */
export interface BaselineLayer {
  /** Per-customer annual rate of qualifying outages (the point estimate). */
  lambdaCustomer: number;
  /**
   * Precomputed confidence interval on `lambdaCustomer` (year-based bootstrap, A017).
   * Computed upstream in the pipeline (the bootstrap needs the per-year counts), not here.
   * Must bracket `lambdaCustomer`. Omit when no band is available.
   */
  rateBand?: { low: number; high: number };
  /** Optional override for how the band should be labelled (else derived). */
  bandDriver?: BandDriver;
  status: LayerStatus;
}

/** Location: a mean-1 within-county relativity for a specific address. */
export interface LocationLayer {
  /** Mean-1 multiplier; 1.0 = county average. Redistributes, never changes the county total. */
  relativity: number;
  status: LayerStatus;
  validated?: boolean;
}

/** Forward: climate + county-level grid, combined. 1.0 = neutral / placeholder. */
export interface ForwardLayer {
  factor: number;
  status: LayerStatus;
}

export interface PricingLayers {
  baseline: BaselineLayer;
  /** Defaults to a neutral 1.0 placeholder when omitted. */
  location?: LocationLayer;
  /** Defaults to a neutral 1.0 placeholder when omitted. */
  forward?: ForwardLayer;
}

export interface PricingParams {
  /** Trigger duration in hours (carried as metadata; the formula is linear in X). */
  T: number;
  /** Payout. */
  X: number;
  /** Expense ratio (0–1). */
  expenseRatio: number;
  /** Target margin (0–1). */
  targetMargin: number;
}

/** One row of the factor waterfall (baseline → location → forward → loadings). */
export interface PremiumStep {
  key: 'baseline' | 'location' | 'forward' | 'loadings';
  label: string;
  /** The multiplier applied at this step (null for the baseline anchor row). */
  factor: number | null;
  /** Running per-customer rate after this step (omitted for the loadings row). */
  runningRate?: number;
  status: LayerStatus;
}

export interface PremiumBand {
  low: number;
  point: number;
  high: number;
}

/** The full computed object — the headline is `premium.point`; the band is the range. */
export interface PremiumStack {
  baseline: { lambdaCustomer: number; rateBand: { low: number; high: number } | null; status: LayerStatus };
  location: { relativity: number; status: LayerStatus };
  forward: { factor: number; status: LayerStatus };
  /** λ_customer × relativity × forward — the rate the premium is built on. */
  adjustedRate: number;
  /** 1 − ER − TM. */
  denom: number;
  /** adjustedRate × X (the point expected loss — a.k.a. pure premium / loss cost). */
  pure: number;
  /** Retail band {low, point, high}. */
  premium: PremiumBand;
  bandDriver: BandDriver;
  steps: PremiumStep[];
}
