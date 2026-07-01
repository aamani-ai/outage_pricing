# Methodology Library — Plan

Date: 2026-05-30

## Status

Planning + Phase L1 + L2 landing in the same session (2026-05-30). v0
pricing math untouched.

## Goal

Make the project's methodology and assumptions reachable from inside the
dashboard so a reader can investigate "what is this number, exactly?"
without leaving the platform. A single header entry point opens a
**reading library** that renders the `docs/methodology/` folder live —
walkthroughs, step methodologies, and the stable-ID assumptions registry
— with navigation between sections.

This is the in-app reading surface that complements the file-system
methodology folder. The folder remains the source of truth; the library
is a presentation layer over it.

## Why

The per-customer view discussion (and every prior method choice we have
documented) reaches a quality bar that is wasted if readers have to
open a code editor to read it. Stakeholders, underwriters, future
teammates, regulators — none of them want to clone a repo to read
methodology. Surfacing the same content inside the dashboard turns the
methodology folder into a live knowledge base.

## Design choices

| Decision | Choice | Rationale |
|---|---|---|
| Entry point | Header right-edge button with an open-book icon | Matches existing icon-button language (back-btn, theme-toggle, info-btn). A small "library" affordance is unambiguous. |
| Surface | Right-side slide-out drawer (default) with an expand-to-full-screen toggle | Lets a reader read the docs and glance at the dashboard side-by-side. Full-screen for long-form reading sessions. Less disruptive than a modal. |
| Width | `min(720px, 58vw)` collapsed; `calc(100vw - 32px)` expanded | Comfortable reading column without hiding the dashboard. |
| Backdrop | Subtle dim with click-to-close | Standard drawer pattern. ESC also closes. |
| Markdown rendering | Vendor `marked.min.js` into `dashboard/vendor/` | Self-contained — no CDN dependency. Two prior incidents this session traced to CDN failures (see [[feedback-dashboard-cache-busting]]). 25 KB minified is acceptable for a self-contained dashboard. |
| Section nav | Left rail inside the drawer, 4 groups (Overview / Pipeline methodology / Walkthroughs / Assumptions registry) | Matches the conceptual structure of `docs/methodology/` so the dashboard mental model and the folder mental model agree. |
| Content source | Live `fetch()` of methodology files via the static server | No build step. Edits to methodology files are visible immediately on dashboard refresh. |
| Internal links | Relative-path links inside markdown resolved against the section that's rendering | So `[A001](../assumptions.md#a001-...)` from a walkthrough jumps to the assumptions section in the library. |
| Cache busting | Same `?v=YYYYMMDD-N` discipline as for app.js / styles.css | Drawer code lives in app.js so the existing scheme already covers it. |

## Phases

### Phase L1 — Drawer scaffold (open / close / expand)

Entry: this plan exists; current dashboard is at `?v=20260530-6`.

Deliverable:
- Open-book icon button in `header-actions` after the [Map][Matrix][Drill-down]
  segmented control.
- Drawer DOM (right slide-out aside + backdrop) added to `index.html`.
- CSS for drawer states (closed / open / expanded), section nav, content
  area, header bar, action buttons.
- JS handlers: open on header-button click, close on backdrop click /
  close-button click / ESC, expand toggle.
- Section navigation working between four left-rail sections — but
  content area shows a placeholder "Loading content…" until Phase L2.

Gate:
- Drawer opens and closes smoothly, ESC works, expand toggle works.
- Backdrop dims correctly on light + dark themes.
- Header button doesn't disrupt existing seg control.
- Existing dashboard features still work (regression check on Map view,
  Matrix view, Drilldown view, evidence table popovers).

### Phase L2 — Markdown rendering

Entry: Phase L1 gate passed.

Deliverable:
- `dashboard/vendor/marked.min.js` vendored locally (downloaded from
  jsdelivr at a pinned version).
- Section registry mapping nav-item keys to methodology file paths.
- On navigation, fetch the matching `.md` file, render via marked, inject
  into the content area.
- Markdown CSS — headings, body text, code, code blocks, tables, blockquotes,
  lists, links — using the existing token system (IBM Plex, `--ink`,
  `--surface-2`, etc.). No new colors.
- Special-case the "Overview" section to a hand-written intro that
  doesn't fetch a markdown file (introduces the library).
- Anchor scrolling: when a markdown link contains `#assumption-id`, scroll
  to that heading inside the rendered content.

Gate:
- All 8 sections render correctly (Overview, 5 pipeline methodology
  files, the per-customer walkthrough, assumptions).
- Internal links in walkthrough resolve to the matching section in the
  library (not a 404).
- Code blocks, tables, and blockquotes render with the dashboard's
  typography tokens.
- Performance: a section loads in under 200 ms on a warm cache (single
  fetch + marked render).

### Phase L1 + L2 Closure (2026-05-30)

Both phases landed in a single session.

**What shipped:**

- `dashboard/vendor/marked.min.js` (pinned at v13.0.3, 38.7 KB). No CDN dependency for the renderer.
- Header right-edge "Library" button with an open-book icon.
- Right slide-out drawer (`<aside id="libraryDrawer">`) + dimmed backdrop, with expand-to-full-screen toggle, close button, ESC handler, and click-outside-to-close.
- 9 navigable sections: Overview (welcome cards), Per-customer walkthrough, 5 pipeline methodology files, Assumptions registry.
- Markdown rendered live via `marked.parse()` with the dashboard's existing typography tokens (no new fonts, no new colors). Tables, blockquotes, code blocks, lists, anchor links all styled with IBM Plex + `--ink` / `--surface-2` / `--primary` family.
- Internal markdown links (`[A001](../assumptions.md#...)`) rewritten to navigate inside the library; external links open in a new tab.
- Section render cache so revisits are instant.
- **Symlink: `price_engine/dashboard/methodology → ../../docs/methodology`** so the static server can serve the methodology files without a build step. Edits to methodology files on disk show up on the next section load.

**Gate results:**

- Drawer opens, closes (X / ESC / backdrop click), expands to full screen ✓
- All 9 sections render correctly ✓
- Methodology files reachable via the symlink (verified 200 OK for walkthrough, pricing, assumptions) ✓
- Existing dashboard features (Map / Matrix / Drilldown / evidence-table popovers) unaffected ✓
- Cache-bust `?v=20260530-7` applied to app.js, styles.css, and the new vendor/marked.min.js ✓

### Phase L3 — Polish (deferred)

Pending after Phase L2 ships and the user has lived with it.

Possible items:
- Search across the methodology folder.
- Print-friendly view.
- Inline cross-links from the dashboard's existing eye-button popovers
  ("Read more →" opens the library at the relevant section).
- Mobile responsiveness if the dashboard ever needs it.
- Citation links: clicking a stable-ID assumption anywhere in the
  dashboard opens the library at that assumption.

## Cross-references

- [Methodology folder](../../methodology/) — the source of truth being
  rendered.
- [Walkthrough docs convention](../../methodology/02_per_customer/per_customer_view_walkthrough.md)
  — first walkthrough in the library.
- [Assumptions registry](../../methodology/assumptions.md) — featured
  section.

## Document discipline

When Phase L2 closes, this plan gets a Closure section and moves to
[`docs/plan/done/`](../done/) per the [archive convention](../done/README.md).
