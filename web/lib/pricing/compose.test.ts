/**
 * Canary suite for the pricing engine — written BEFORE any UI (engine-first,
 * principles/structural_verification.md "ask for the test, not the feature").
 *
 * The anchor fixtures are REAL values from the source of truth
 * (price_engine/catalogs/eagle-i-45min/pricing/per_customer_view.json, the
 * `default_catalog`, mean estimator), so a canary failure means the formula —
 * or our understanding of the data — drifted.
 *
 * NOTE: the deck (slide 4) shows ≈$154 for Alachua T=4h/X=$500, implying
 * λ_customer ≈ 0.20. The current catalog gives λ_customer(4h) = 0.102387 →
 * retail $78.76 (the multiplier roughly halved since the deck). We anchor on the
 * live catalog value; the deck is stale and flagged for refresh.
 */
import { describe, expect, it } from 'vitest';
import { composePremium, renormalizeMeanOne } from './compose';
import type { PricingLayers, PricingParams } from './types';

const STD = { expenseRatio: 0.2, targetMargin: 0.15 } as const;

describe('composePremium — anchors (real eagle-i-45min, mean)', () => {
  it('Alachua FL · T=4h · X=$500 → retail ≈ $78.76', () => {
    const stack = composePremium(
      { baseline: { lambdaCustomer: 0.102387, status: 'active' } },
      { T: 4, X: 500, ...STD },
    );
    expect(stack.premium.point).toBeCloseTo(78.76, 1);
    expect(stack.pure).toBeCloseTo(51.19, 1);
  });

  it('Alachua FL · T=8h · X=$2500 → retail ≈ $244.04', () => {
    const stack = composePremium(
      { baseline: { lambdaCustomer: 0.063451, status: 'active' } },
      { T: 8, X: 2500, ...STD },
    );
    expect(stack.premium.point).toBeCloseTo(244.04, 1);
  });
});

describe('composePremium — formula invariants', () => {
  const base: PricingLayers = { baseline: { lambdaCustomer: 0.1, status: 'active' } };
  const p: PricingParams = { T: 8, X: 2500, ...STD };

  it('GROSS-UP: point === pure / (1 − ER − TM) exactly', () => {
    const s = composePremium(base, p);
    expect(s.premium.point).toBeCloseTo(s.pure / s.denom, 12);
    expect(s.denom).toBeCloseTo(0.65, 12);
  });

  it('IDENTITY: omitted location & forward default to neutral 1.0 placeholders', () => {
    const s = composePremium(base, p);
    expect(s.location.relativity).toBe(1);
    expect(s.forward.factor).toBe(1);
    expect(s.location.status).toBe('placeholder');
    expect(s.forward.status).toBe('placeholder');
    expect(s.premium.point).toBeCloseTo((0.1 * 2500) / 0.65, 9);
  });

  it('MONOTONE: premium strictly increases in X', () => {
    const lo = composePremium(base, { ...p, X: 1000 }).premium.point;
    const hi = composePremium(base, { ...p, X: 10000 }).premium.point;
    expect(hi).toBeGreaterThan(lo);
  });

  it('LOCATION: a 1.2× relativity scales the point by exactly 1.2', () => {
    const flat = composePremium(base, p).premium.point;
    const up = composePremium(
      { baseline: { lambdaCustomer: 0.1, status: 'active' }, location: { relativity: 1.2, status: 'modeled' } },
      p,
    ).premium.point;
    expect(up / flat).toBeCloseTo(1.2, 9);
  });

  it('FORWARD: a 1.5× factor scales the point by exactly 1.5 and is surfaced in steps', () => {
    const flat = composePremium(base, p).premium.point;
    const s = composePremium(
      { baseline: { lambdaCustomer: 0.1, status: 'active' }, forward: { factor: 1.5, status: 'modeled' } },
      p,
    );
    expect(s.premium.point / flat).toBeCloseTo(1.5, 9);
    expect(s.steps.find((x) => x.key === 'forward')?.factor).toBe(1.5);
  });
});

describe('composePremium — the range band (A017)', () => {
  it('scales linearly with the precomputed rate band and brackets the point', () => {
    const s = composePremium(
      { baseline: { lambdaCustomer: 0.1, rateBand: { low: 0.08, high: 0.13 }, status: 'active' } },
      { T: 8, X: 2500, ...STD },
    );
    expect(s.premium.low).toBeLessThan(s.premium.point);
    expect(s.premium.high).toBeGreaterThan(s.premium.point);
    expect(s.premium.low / s.premium.point).toBeCloseTo(0.08 / 0.1, 9);
    expect(s.premium.high / s.premium.point).toBeCloseTo(0.13 / 0.1, 9);
    expect(s.bandDriver).toBe('confidence');
  });

  it('with no rateBand, the band collapses to the point (driver = none)', () => {
    const s = composePremium({ baseline: { lambdaCustomer: 0.1, status: 'active' } }, { T: 8, X: 2500, ...STD });
    expect(s.premium.low).toBe(s.premium.point);
    expect(s.premium.high).toBe(s.premium.point);
    expect(s.bandDriver).toBe('none');
  });

  it('the band carries through location & forward identically to the point', () => {
    const s = composePremium(
      {
        baseline: { lambdaCustomer: 0.1, rateBand: { low: 0.08, high: 0.13 }, status: 'active' },
        location: { relativity: 1.2, status: 'modeled' },
        forward: { factor: 1.1, status: 'modeled' },
      },
      { T: 8, X: 2500, ...STD },
    );
    // relative width is invariant to the multiplicative layers
    expect((s.premium.high - s.premium.low) / s.premium.point).toBeCloseTo((0.13 - 0.08) / 0.1, 9);
  });
});

describe('composePremium — fail loud (no silent fallback)', () => {
  const p: PricingParams = { T: 8, X: 2500, ...STD };
  it('throws when ER + TM ≥ 1', () => {
    expect(() => composePremium({ baseline: { lambdaCustomer: 0.1, status: 'active' } }, { T: 8, X: 2500, expenseRatio: 0.6, targetMargin: 0.5 })).toThrow();
  });
  it('throws on non-finite / negative lambdaCustomer', () => {
    expect(() => composePremium({ baseline: { lambdaCustomer: Number.NaN, status: 'active' } }, p)).toThrow();
    expect(() => composePremium({ baseline: { lambdaCustomer: -0.1, status: 'active' } }, p)).toThrow();
  });
  it('throws on X ≤ 0', () => {
    expect(() => composePremium({ baseline: { lambdaCustomer: 0.1, status: 'active' } }, { ...p, X: 0 })).toThrow();
  });
  it('throws when a rateBand does not bracket lambdaCustomer', () => {
    expect(() => composePremium({ baseline: { lambdaCustomer: 0.1, rateBand: { low: 0.12, high: 0.2 }, status: 'active' } }, p)).toThrow();
  });
});

describe('renormalizeMeanOne — the grid double-count firewall', () => {
  it('produces an exposure-weighted mean of exactly 1', () => {
    const weights = [3, 1, 1];
    const rels = renormalizeMeanOne([0.4, 1.0, 2.5], weights);
    const wsum = weights.reduce((a, b) => a + b, 0);
    const weightedMean = (rels[0]! * 3 + rels[1]! * 1 + rels[2]! * 1) / wsum;
    expect(weightedMean).toBeCloseTo(1, 9);
  });

  it('redistributes within a county without changing the county total', () => {
    const weights = [3, 1, 1];
    const rels = renormalizeMeanOne([0.4, 1.0, 2.5], weights);
    const lambdaCounty = 0.08;
    const redistributedTotal = lambdaCounty * rels[0]! * 3 + lambdaCounty * rels[1]! * 1 + lambdaCounty * rels[2]! * 1;
    const wsum = weights.reduce((a, b) => a + b, 0);
    expect(redistributedTotal).toBeCloseTo(lambdaCounty * wsum, 9);
  });

  it('throws on bad input (length mismatch, all-zero weights, non-finite)', () => {
    expect(() => renormalizeMeanOne([1, 2], [1])).toThrow();
    expect(() => renormalizeMeanOne([1, 2], [0, 0])).toThrow();
    expect(() => renormalizeMeanOne([1, Number.NaN])).toThrow();
  });
});
