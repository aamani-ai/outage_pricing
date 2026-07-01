/**
 * Server-side WEATHER challenger reader (Step 05 — the "climate/weather" slot in FORWARD).
 * Reads the artifact promoted by build_data.py from
 * notebooks/05_forward_regime/weather_vs_stat_routing/outputs/weather_factor.json.
 *
 * SHADOW ONLY. This is Sarasi's EOF-XGB annual event-count forecast expressed as a forward factor
 * (same one-directional / credibility-shrunk / capped construction as the statistical factor) plus the
 * per-county routing verdict from the 2023–25 backtest. The dashboard SHOWS it in the Forecast detail
 * (the forecast + why it was / wasn't chosen) but does NOT price on it — the composed premium stays on
 * the statistical factor. Coverage is Northeast-only (Sarasi's model scope); non-NE counties return null.
 *
 * When a live current-year forecast lands, the 16 `weather`-routed counties can be flipped to govern the
 * forward factor here — until then this is display-only. Keep SERVER-ONLY (the API route).
 */
import data from "./forward/weather_factor.json";

/** How a county is routed by the weather backtest. */
export type WeatherRoute = "weather" | "statistical" | "excluded";

export interface WeatherReadT {
  /** the weather factor this forecast WOULD apply (≥1.0, one-directional); null if uncomputable. */
  weatherFactor: number | null;
  /** XGB point forecast of next-year ≥T county event count, + its 90% band. */
  weatherMean: number;
  weatherP5: number;
  weatherP95: number;
  /** the statistical factor for the same T (what actually prices today), for side-by-side. */
  statFactor: number | null;
  /** the long-run baseline mean the factors are expressed against. */
  lamFull: number | null;
}

export interface WeatherRead {
  /** weather governs (pilot, shadow) · shown but not chosen · excluded (chronic-grid cluster). */
  route: WeatherRoute;
  /** Sarasi's cluster label — NE_good (weather-scored) or NE_bad (chronic-grid, excluded). */
  cluster: string;
  countyName: string;
  state: string;
  /** plain-language reason for the route, grounded in the backtest WAPE. */
  why: string;
  /** per trigger T. */
  byT: Record<string, WeatherReadT>;
}

type Raw = Record<
  string,
  {
    route: WeatherRoute;
    cluster: string;
    county_name: string;
    state: string;
    why: string;
    T: Record<
      string,
      {
        weather_factor: number | null;
        weather_mean: number;
        weather_p5: number;
        weather_p95: number;
        stat_factor: number | null;
        lam_full: number | null;
      }
    >;
  }
>;
const WX = data as unknown as Raw;

/** county FIPS (5-digit) → its weather read, or null if the county is outside the weather model's scope. */
export function getWeather(fips: string): WeatherRead | null {
  const r = WX[fips];
  if (!r) return null;
  const byT: Record<string, WeatherReadT> = {};
  for (const [t, d] of Object.entries(r.T)) {
    byT[t] = {
      weatherFactor: d.weather_factor,
      weatherMean: d.weather_mean,
      weatherP5: d.weather_p5,
      weatherP95: d.weather_p95,
      statFactor: d.stat_factor,
      lamFull: d.lam_full,
    };
  }
  return { route: r.route, cluster: r.cluster, countyName: r.county_name, state: r.state, why: r.why, byT };
}
