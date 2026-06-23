# Competitive Landscape

- **Status:** living reference — update when new players, capital, or coverage facts emerge
- **First written:** 2026-05-31
- **Last reviewed:** 2026-05-31
- **Audience:** internal pitch prep (clients, LPs, partners), team onboarding

## Market context

The parametric insurance market is **~$21–24 B globally in 2026, growing ~13 % CAGR**
([InsureTech Trends 2026](https://insuretechtrends.com/parametric-insurance-climate-protection-gap-2026/)). The **power-outage** segment within it is nascent — one named carrier-platform (Adaptive Insurance / GridProtect) is the only meaningful US entrant as of this writing, backed by Tokio Marine HCC paper.

The market trend named explicitly in industry coverage is **collaborative ecosystems** — carriers, MGAs, quote-and-bind platforms, and data providers working together rather than competing directly ([Insurance Journal · March 2026](https://www.insurancejournal.com/magazines/mag-features/2026/03/09/860648.htm)). That trend matters for our positioning: we lean into it.

## Direct outage-segment players

### 1 · Adaptive Insurance / GridProtect — primary outage-segment entrant

- **Product:** [GridProtect](https://www.adaptiveinsurance.com/broker), short-term parametric power-outage coverage for businesses. Predefined trigger, fixed payout, 2–4 day claims.
- **Capital / paper:** $5 M seed led by Congruent Ventures ([Reinsurance News](https://www.reinsurancene.ws/adaptive-insurance-secures-5m-in-seed-funding-led-by-congruent-ventures/)). Carrier paper from Tokio Marine HCC ([Reinsurance News · 18-state launch](https://www.reinsurancene.ws/tokio-marine-hcc-teams-up-with-adaptive-insurance-to-launch-short-term-power-outage-coverage-in-18-states/)).
- **Coverage limits:** $5 K – $50 K per policy.
- **Footprint:** **18 US states** — AL, AZ, CO, FL, GA, IL, IN, KS, MD, MN, MO, NJ, NV, NY, PA, TX, UT, WI ([Reinsurance News · 18-state launch](https://www.reinsurancene.ws/tokio-marine-hcc-teams-up-with-adaptive-insurance-to-launch-short-term-power-outage-coverage-in-18-states/)).
- **Distribution:** broker channel + Bold Penguin marketplace partnership ([Bold Penguin · December 2025](https://www.boldpenguin.com/news-insights/bold-penguin-adds-parametric-insurance-coverage-through-partnership-with-adaptive); [Insurance Journal · December 2025](https://www.insurancejournal.com/news/national/2025/12/05/849997.htm)).
- **Stated ambition:** parametric resilience products covering ~80 % of US SMEs within 2 years ([Insurance Business America launch story](https://www.insurancebusinessmag.com/us/news/catastrophe/adaptive-insurance-launches-gridprotect-to-combat-power-outage-risks-508586.aspx)).
- **Trigger source:** Whisker Labs Ting sensor network (see §2 below).
- **Pricing methodology:** **closed** — not published. No public materials describe whether the rate is calibrated at premise level (against sensor history) or at coarser geographic aggregates with the sensor used only for live trigger detection. Industry default for parametric products is the latter; absent evidence we assume Adaptive follows convention.

**How we relate.** Complementary, not head-to-head. Adaptive is the MGA layer plus distribution; we are the pricing layer underneath that any MGA / carrier / reinsurer can compose against. Plausible relationship modes: benchmark partner, methodology validator, regulator-facing audit trail provider. Adaptive itself could be a *customer* of our rate card if they wanted to expand beyond their 18-state footprint without re-deriving the historical baseline.

### 2 · Whisker Labs Ting Insights — trigger-network infrastructure provider, not a carrier

Not an insurer — included because the Adaptive partnership makes Ting the de facto sensor-network reference for the segment, and because clients/LPs will ask about them.

- **Network size:** **>1 M sensors** in US homes, **94 % of US homes within 1 mile of a Ting sensor** ([Whisker Labs · Ting Insights page](https://www.whiskerlabs.com/ting-insights/); [Newsworthy.ai · grid intelligence coverage](https://www.newsworthy.ai/curated/whisker-labs-ting-technology-revolutionizes-grid-monitoring-and/202519453)).
- **Origin product:** in-home electrical-fire prevention sensor; outage detection is a derived secondary capability ([tingfire.com](https://www.tingfire.com/)).
- **Outage capabilities:** sub-minute, neighborhood-level outage and restoration detection. Hyperlocal outage alerts are now **free in the Ting app for end users** ([Disaster Recovery Journal · launch](https://drj.com/industry_news/whisker-labs-introduces-first-ever-nationwide-hyperlocal-power-outage-alerts-now-free-in-the-ting-app/)).
- **Stated positioning:** the "last-mile" grid visibility that utilities don't have (utility monitoring typically stops at substation; Ting covers poles, transformers, premise-level events).
- **Insurance use:** Adaptive partnership is the first named insurance use case ([IT Brief · Adaptive + Whisker Labs](https://itbrief.news/story/adaptive-whisker-labs-bring-real-time-data-to-outage-insurance)).

**How we relate.** Ting is a **trigger-source candidate** for our roadmap's *Trigger source alignment* track — it is not a competitor to our pricing layer. Any future product that needs a live payout oracle will likely contract Ting (or a similar sensor network) for the trigger and price against a historical-baseline layer (which is what we build). The roadmap entry for trigger-source alignment already names Ting as a candidate ([trigger_source_implications.md](../../plan/cross_cutting/trigger_source_implications.md)).

### 3 · PowerOutage.US — public data vendor, possible pricing / trigger source

- **Public product:** live + historical US outage data via [poweroutage.us](https://poweroutage.us/) (the public site) and [poweroutage.com](https://poweroutage.com/products) (the commercial offering). API access, CSV downloads, historical extracts.
- **Coverage:** national, sourced from utility outage maps. Granularity varies — city / county / sometimes ZIP depending on the utility.
- **Commercial license:** real terms restrict ordinary use to non-commercial; commercial use needs a separate written agreement.
- **Insurance use:** no named insurance partnership we're aware of publicly. We've evaluated their API + a historical extract under NDA (results local-only — see [`docs/extra/poweroutage_us/`](../../extra/poweroutage_us/)).

**How we relate.** Candidate **bridge** data source — useful both as a pricing-baseline cross-check (against EAGLE-I) and as a live trigger source if licensed for insurance use. Not a head-to-head competitor — they are upstream data, not a pricing product.

## Adjacent-vertical players (validate the parametric model)

These don't compete directly but answer the "does parametric work?" question with strong public proof:

### 4 · Parametrix — parametric for cloud-service outages

[Parametrix](https://www.parametrixinsurance.com/) writes parametric policies for cloud-provider outages (AWS, GCP, Azure). Public proof of payout speed: paid claims **within two weeks of an AWS outage in October 2025** ([Insurance Journal · March 2026](https://www.insurancejournal.com/magazines/mag-features/2026/03/09/860648.htm)). Same mechanism (predefined trigger, fixed payout, fast claims), different peril.

**How we relate.** No overlap. Mention in pitches as proof that parametric *as a product class* works at scale and that buyers value fast verifiable payouts.

### 5 · Ki Insurance — parametric supply-chain coverage via GPS

[Ki Insurance](https://ki-insurance.com/) tracks supply-chain shipments via GPS and triggers parametric payouts on disruption events. Hybrid pattern: parametric speed + shipment-specific loss data. Same model lineage; different exposure.

**How we relate.** Mention in pitches as another validation of the parametric infrastructure thesis — and as a hint that *sensor-derived triggers with parametric mechanics* are a general pattern across exposure types, not unique to power outages.

## Players we do NOT see in the outage segment (yet)

We have searched and not found public materials for:

- **Major reinsurers** (Munich Re, Swiss Re, Hannover Re) with named parametric outage products. They write parametric paper in adjacent verticals (climate, agriculture, cyber) but have not publicly entered US outage.
- **Major brokers** (Marsh, Aon, WTW) with named outage-specific MGAs. They distribute Adaptive's GridProtect through their broker channels but have not put their own paper on the segment.
- **Insure-tech entrants** beyond Adaptive specifically targeting outage parametric for SMB.

These absences are themselves informative: the segment is young, the white space is real, and a methodology-defensible pricing layer has no named competitor today.

## How we position — short version

> **The market has one carrier-platform (Adaptive), one sensor-network trigger provider (Ting), and one public outage data vendor (PowerOutage.US) playing in this segment today. We sit underneath all three: a methodology-transparent national pricing baseline that any carrier can quote against, any sensor network can trigger against, and any reinsurer can benchmark against. We are complementary to every named player, competitive to none.**

## How we use this document

- **Pitch context.** When a client or LP asks "what about Adaptive" or "how do you compete with sensor companies", point at this document. The §1 / §2 distinction — that Adaptive is an MGA and Ting is a trigger network — is the load-bearing reframe.
- **Library section.** Rendered as a section in the in-app methodology library, so a viewer of the dashboard can reach it in two clicks.
- **Refresh cadence.** Re-read every 60–90 days. Bump `Last reviewed` and update specific facts (capital, coverage states, product names) as they change.

## Gaps in our intelligence

Things we'd want to know but don't yet:

- Adaptive's actual rating methodology — coarse / per-customer / per-sensor? (Closed product; would need to ask directly.)
- Whether Ting is used for pricing as well as trigger by anyone, or only for trigger. (Industry convention says only trigger, but verifying matters.)
- Reinsurance pricing on US parametric outage paper — is TMHCC's pricing on GridProtect publicly available in filings?
- Any non-US parametric outage entrants (UK, EU, Australia, Japan) using methodologies we should learn from.
- Whether Adaptive's 18-state expansion is filing-constrained (regulatory) or data-constrained (their pricing only covers those states).

Close any of these and we tighten the positioning.

## Cross-references

- [Trigger Source Implications](../../plan/cross_cutting/trigger_source_implications.md) — earlier internal notes on Ting / PoUS / utility OMS as trigger candidates
- [Utility OMS and Trigger Sources](../../dicsscssion/utility_oms_and_trigger_sources.md) — broader trigger-source landscape
- [Roadmap](../roadmap.md) — where the trigger-source-alignment track sits in our sequencing
- [PowerOutage.US trial](../../extra/poweroutage_us/) — NDA-scoped local-only — vendor-evaluation specifics
