/**
 * The pricing engine — the ONE place the premium formula lives.
 *
 * Every view (outward Pricing, Underwriting Studio) renders from this; no view
 * re-derives the math (the old dashboard duplicated it 5× — the divergence risk
 * we are ending). Pure: same inputs → same output, no side effects, no I/O.
 *
 * Discipline (principles/structural_verification.md): FAIL LOUD — never silently fall back to a
 * default that hides a broken input. A crash you notice today beats a wrong
 * premium discovered in three weeks.
 */
import type {
  BandDriver,
  LayerStatus,
  PremiumStack,
  PremiumStep,
  PricingLayers,
  PricingParams,
} from './types';

const EPS = 1e-9;

/**
 * The grid double-count firewall (A012/A013, disc 04): rescale a county's raw
 * exposure scores so their (optionally exposure-weighted) mean is exactly 1.
 * Mean-1 relativities can only *redistribute* risk inside a county — they can
 * never change the county total. Returns the renormalized relativities.
 */
export function renormalizeMeanOne(values: number[], weights?: number[]): number[] {
  const w = weights ?? values.map(() => 1);
  if (values.length !== w.length) {
    throw new Error('renormalizeMeanOne: values and weights length mismatch');
  }
  if (values.length === 0) {
    throw new Error('renormalizeMeanOne: empty input');
  }
  let wsum = 0;
  let dot = 0;
  for (let i = 0; i < values.length; i++) {
    const vi = values[i]!;
    const wi = w[i]!;
    if (!Number.isFinite(vi) || !Number.isFinite(wi)) {
      throw new Error('renormalizeMeanOne: non-finite value or weight');
    }
    if (wi < 0) throw new Error('renormalizeMeanOne: negative weight');
    wsum += wi;
    dot += vi * wi;
  }
  if (!(wsum > 0)) throw new Error('renormalizeMeanOne: weight sum must be > 0');
  const mean = dot / wsum;
  if (Math.abs(mean) < 1e-12) {
    throw new Error('renormalizeMeanOne: mean is ~0 — cannot renormalize');
  }
  return values.map((v) => v / mean);
}

/**
 * The routed forward factor — which forecast expert governs the forward slot for a county. The internal
 * dashboard prices on the BEST forecast: where the weather backtest routes a county to the weather expert
 * (the durable winners), the weather factor governs; otherwise the statistical factor does. This is a
 * routing choice (one OR the other), not a product — the two experts forecast the same annual frequency.
 * There is NO shadow: the internal dashboard shows the final composed premium, so the chosen factor is the
 * one that prices. Weather covers only a subset of triggers; where it doesn't cover T, statistical governs
 * by fallback (return source 'statistical').
 */
export function routedForward(
  statFactor: number,
  weatherFactor: number | null | undefined,
  isWeatherRouted: boolean,
): { factor: number; source: 'weather' | 'statistical' } {
  if (isWeatherRouted && weatherFactor != null && Number.isFinite(weatherFactor) && weatherFactor > 0) {
    return { factor: weatherFactor, source: 'weather' };
  }
  return { factor: statFactor, source: 'statistical' };
}

/**
 * Compose the full premium stack from the layered inputs. The headline is
 * `premium.point`; `premium.{low,high}` is the range (the precomputed rate band
 * carried linearly through the same factors). Omitted location/forward default
 * to a neutral 1.0 placeholder.
 */
export function composePremium(layers: PricingLayers, params: PricingParams): PremiumStack {
  const { baseline } = layers;
  const location = layers.location ?? { relativity: 1, status: 'placeholder' as LayerStatus };
  const forward = layers.forward ?? { factor: 1, status: 'placeholder' as LayerStatus };
  const { X, expenseRatio: ER, targetMargin: TM } = params;

  // ---- FAIL LOUD on bad inputs (no silent fallback) ----
  if (!Number.isFinite(baseline.lambdaCustomer) || baseline.lambdaCustomer < 0) {
    throw new Error(`composePremium: lambdaCustomer must be a finite, non-negative number (got ${baseline.lambdaCustomer})`);
  }
  if (!Number.isFinite(X) || X <= 0) {
    throw new Error(`composePremium: X (payout) must be > 0 (got ${X})`);
  }
  if (!Number.isFinite(location.relativity) || location.relativity <= 0) {
    throw new Error(`composePremium: location.relativity must be > 0 (got ${location.relativity})`);
  }
  if (!Number.isFinite(forward.factor) || forward.factor <= 0) {
    throw new Error(`composePremium: forward.factor must be > 0 (got ${forward.factor})`);
  }
  const denom = 1 - ER - TM;
  if (!(denom > 0)) {
    throw new Error(`composePremium: 1 − ER − TM must be > 0 (ER=${ER}, TM=${TM} → denom=${denom})`);
  }

  const retail = (rate: number): number => (rate * X) / denom;

  const adjustedRate = baseline.lambdaCustomer * location.relativity * forward.factor;
  const pure = adjustedRate * X;
  const point = retail(adjustedRate);

  // ---- the band: scale the precomputed rate band through the same factors ----
  let premium = { low: point, point, high: point };
  let bandDriver: BandDriver = 'none';
  if (baseline.rateBand) {
    const { low, high } = baseline.rateBand;
    if (!Number.isFinite(low) || !Number.isFinite(high) || low < 0 || high < low) {
      throw new Error(`composePremium: invalid rateBand {low:${low}, high:${high}}`);
    }
    if (low > baseline.lambdaCustomer + EPS || high < baseline.lambdaCustomer - EPS) {
      throw new Error('composePremium: rateBand must bracket lambdaCustomer');
    }
    const scale = location.relativity * forward.factor;
    premium = { low: retail(low * scale), point, high: retail(high * scale) };
    bandDriver = baseline.bandDriver ?? 'confidence';
  }

  const steps: PremiumStep[] = [
    { key: 'baseline', label: 'baseline λ_customer', factor: null, runningRate: baseline.lambdaCustomer, status: baseline.status },
    { key: 'location', label: 'location (within-county)', factor: location.relativity, runningRate: baseline.lambdaCustomer * location.relativity, status: location.status },
    { key: 'forward', label: 'forward (stat + climate + grid)', factor: forward.factor, runningRate: adjustedRate, status: forward.status },
    { key: 'loadings', label: '÷ (1 − ER − TM)', factor: 1 / denom, status: 'active' },
  ];

  return {
    baseline: { lambdaCustomer: baseline.lambdaCustomer, rateBand: baseline.rateBand ?? null, status: baseline.status },
    location: { relativity: location.relativity, status: location.status },
    forward: { factor: forward.factor, status: forward.status },
    adjustedRate,
    denom,
    pure,
    premium,
    bandDriver,
    steps,
  };
}
