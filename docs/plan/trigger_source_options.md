# Trigger Source Options for the Live Parametric Product

- **Status:** strategy / decision-framing doc — no implementation yet
- **First written:** 2026-06-16
- **Audience:** internal product + partner/LP conversations
- **Companion to:** [`trigger_source_implications.md`](trigger_source_implications.md) (pricing-vs-trigger architecture) and [`../dicsscssion/utility_oms_and_trigger_sources.md`](../dicsscssion/utility_oms_and_trigger_sources.md) (utility-OMS deep dive)

## Why this doc exists

A live parametric outage product needs a **trigger**: an objective signal that
says "an outage of duration ≥ T happened at the insured location," which fires
the payout. Choosing that source is a distinct, foundational decision — every
client, partner, and regulator will ask "what's your trigger, and why should we
trust it?" This doc lays out the full option space and a recommendation.

## The reframe that changes everything

**A trigger is not a pricing source.** They are different problems with different
best answers, and conflating them is the most common mistake:

| | Pricing source | Trigger source |
|---|---|---|
| Needs | **national, multi-year history** | **live signal at insured sites only** |
| Coverage bar | every county, 10+ years | the locations you actually write |
| Best answer | EAGLE-I (historical, county) | *(this doc)* |
| Grows with | the country | **your book** |

The consequence: "you'd have to deploy sensors everywhere" is a false objection.
A trigger only has to cover **insured sites**, and those are added one policy at a
time. Per-site approaches scale with the book, not the nation.

## The standard a parametric trigger must meet

A trigger index must be:

1. **Objective** — computed from data, not adjudicated.
2. **Independent / non-manipulable by any party with a stake in the *peril***
   — not just neutral between insurer and insured, but independent of the
   *utility whose outage causes the payout*.
3. **Auditable** — raw records retained for the policy + dispute window.
4. **Low basis risk** — the signal matches the insured's *actual* power status,
   not a proxy area.
5. **Timely** — detects and resolves within the contract's time resolution.

Dimension (2) is why the utility's own report fails — see below.

## The options

### 1. Independent premise sensor network — PARTNER (e.g. Whisker Labs / Ting)

- **How:** rent an existing third-party sensor network already deployed in homes/businesses. (Ting is sold as a fire-prevention device; outage detection is a derived capability — so the hardware is already in the field.)
- **Neutral?** ✅ Third-party, tamper-resistant, independent of the utility.
- **Granularity:** premise (lowest basis risk).
- **Hardware:** none to deploy — you partner.
- **Cons:** coverage limited to where sensors already exist; commercial dependency on the network owner; per-reading cost.
- **Verdict:** **segment-proven primary trigger** — this is what Adaptive Insurance uses. Strongest default.

### 2. Deploy-your-own premise sensors

- **How:** ship a simple power-presence sensor to each insured site.
- **Neutral?** ✅ Third-party (you/your device, not the utility).
- **Granularity:** premise.
- **Hardware:** yours — logistics, battery/connectivity maintenance, install friction. (A power sensor must still phone home *during* an outage → needs cellular + independent power, like Ting does.)
- **Verdict:** full control, scales with the book, but the **logistics/maintenance burden is the real cost.** Use only if no partner network covers your footprint.

### 3. Customer-authorized AMI / smart-meter data (Green Button Connect)

- **How:** the **insured consents** to share their smart-meter data; AMI meters emit a "last gasp" signal on power loss.
- **Neutral?** ✅ The utility-neutrality problem **evaporates via customer consent** — the insured authorizes their own data.
- **Granularity:** **per-meter** (the best possible — it *is* the insured's power status).
- **Hardware:** none.
- **Cons:** requires the utility to have AMI + a working Green Button Connect / data-sharing path; data latency varies; not all utilities expose it.
- **Verdict:** **underrated sleeper option.** Where AMI + consent flow exists, it's per-meter truth with clean neutrality and no hardware. Evaluate seriously.

### 4. Connected-device heartbeat / IoT proxy

- **How:** watch devices already at the site (router, thermostat, alarm panel, smart-home hub) — they go silent when power drops.
- **Neutral?** ⚠️ Indirect — a silence could be an *internet* outage, not a *power* outage.
- **Granularity:** per-site.
- **Hardware:** none (reuses existing devices).
- **Verdict:** cheap and clever, but the power-vs-connectivity ambiguity makes it a **secondary/corroborating** signal, not a clean primary trigger.

### 5. Satellite night-lights (NASA VIIRS / Black Marble)

- **How:** satellite detects lit-vs-dark areas at night.
- **Neutral?** ✅✅ Fully independent (NASA), no commercial dependency.
- **Granularity:** coarse (~500 m), **night-only**, cloud-obscured.
- **Hardware:** none; national; free.
- **Verdict:** too coarse + night-only to be a **primary** trigger, but a free, fully-independent **corroborating** signal for large-area events.

### 6. Licensed aggregator (PowerOutage.US commercial)

- **How:** licensed feed of scraped utility-map data, live, sub-county.
- **Neutral?** ◑ Independent *aggregator*, but it ultimately reflects utility self-reported map data (inherits utility reporting quality).
- **Granularity:** city / per-outage (live API has OutageId + geometry).
- **Hardware:** none; national (licensed).
- **Cons:** duration is *derived* not delivered; sub-county not premise; basis risk vs the actual address; needs commercial-grade SLA/audit terms.
- **Verdict:** viable **national fallback / consensus input**, weaker on basis risk than a premise sensor.

### 7. Contracted single-utility OMS / AMI (pilot)

- **How:** a formal data agreement with one utility for its OMS/AMI feed.
- **Neutral?** ❌ on the peril dimension (the utility is the interested party) — but a **contract** with audit terms mitigates it for a bounded market.
- **Granularity:** premise/feeder (best raw truth).
- **Verdict:** the right way to use utility data — a **utility-backed pilot market**, not national scraping. Best truth, smallest footprint.

### 8. Multi-source consensus

- **How:** trigger only when **two independent sources agree** (e.g. Ting + PoUS).
- **Neutral?** ✅✅ Cross-checks kill single-source manipulation and false positives.
- **Granularity:** the min of its inputs.
- **Verdict:** the **robustness architecture** a mature product likely adopts — defensible to regulators and reinsurers.

## What is NOT a viable primary trigger

- **Utility's own public outage map (scraped) / utility self-report.** Fails neutrality (the utility is the party whose failure triggers the payout, and it controls the "restored" declaration that a duration trigger hinges on), fails legality (ToS prohibits commercial/payout use), fails scale (~1,000+ different sites). Best raw truth, worst trigger.

## The comparison

```
                    neutral?         granularity      hardware   scale path           role
sensor (partner)    ✅ third-party   premise          none       rent network         PRIMARY ✓
deploy sensors      ✅ third-party   premise          yours      grows with book      primary (if no partner)
AMI (Green Button)  ✅ via consent   per-meter        none       utility-by-utility   primary (evaluate) ✓
device heartbeat    ⚠️ indirect      per-site         reuse      per-site             secondary
satellite VIIRS     ✅✅ independent  coarse / night   none       national, free       corroborating
PoUS commercial     ◑ aggregator     city / per-outage none      national (licensed)  fallback / consensus
single-utility OMS  ❌ peril party   premise          —          pilot only           pilot market
consensus           ✅✅             min of inputs    depends    hybrid               robustness layer
utility map scraped ❌ peril party   premise          —          (blocked)            NOT viable
```

## Recommendation / sequencing

1. **Primary:** partner with an **independent premise sensor network** (Ting-style) — premise-level + neutral + no deployment. Segment-proven.
2. **Evaluate in parallel:** **customer-authorized AMI (Green Button)** — per-meter, neutral via consent, no hardware.
3. **Robustness (mature product):** **multi-source consensus** (sensor + aggregator must agree).
4. **Corroborating:** satellite for large events.
5. **Pilot exception:** a contracted single-utility OMS feed for a utility-backed pilot.
6. **Explicitly rejected as primary:** utility self-report / scraped maps.

## How this connects to the rest of the project

- **Pricing stays on EAGLE-I** (national history). The trigger is a *separate* layer — this doc is only about the trigger.
- **The bridge factor** in [`trigger_source_implications.md`](trigger_source_implications.md) calibrates the gap between the EAGLE-I-priced event frequency and whatever trigger source is chosen here.
- **Duration** from any of these is *derived*, and is a **location/site** duration, not per-customer — see the PoUS lab's deriving-duration note for the mechanics and the per-customer ceiling.

## Caveats

- This is a **framing** doc, not a vendor selection. Each option needs its own commercial/technical diligence (SLA, audit, latency, coverage, cost).
- Neutrality and basis-risk are the two dimensions partners/regulators probe hardest — lead with those.
- "Best raw truth" (utility) and "best trigger" (independent + premise) are different rankings; do not let the data-quality argument override the neutrality requirement.

## Cross-references

- [Trigger Source Implications](trigger_source_implications.md) — pricing-vs-trigger architecture + the bridge factor
- [Utility OMS and Trigger Sources](../dicsscssion/utility_oms_and_trigger_sources.md) — the utility-OMS deep dive
- [Competitive Landscape](../methodology/competitive_landscape.md) — Adaptive/Ting and why the segment uses sensors
- Green Button Connect My Data — https://www.greenbuttonalliance.org/green-button-connect-my-data-cmd
- NASA Black Marble / VIIRS nighttime lights — https://blackmarble.gsfc.nasa.gov/
