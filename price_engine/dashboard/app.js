/* price_engine v0 dashboard — vanilla JS + D3 + Observable Plot + MapLibre */

const T_GRID = [2, 4, 8, 12, 24];
const X_GRID = [500, 1000, 2500, 5000, 10000];

const state = {
  manifest: null,
  catalogId: null,
  catalog: null,
  drilldown: null,
  tiers: null,             // Map(fips -> row)
  premiums: null,          // Map(fips -> {T -> {S_T, lambda_T, X}})
  selectedFips: null,
  view: 'map',
  countiesGeo: null,
  eventEvidenceCache: new Map(),
  perCustomer: null,       // {meta: {...}, view: {fips_str: {T_str: {...}}}}
  matrixView: 'customer', // 'county' | 'customer' | 'multiplier' — Per-customer is the more reliable default
};

const fmt = {
  money: d3.format('$,.0f'),
  moneyCents: d3.format('$,.2f'),
  pct: d3.format('.2%'),
  pct3: d3.format('.3%'),
  pct4: d3.format('.4%'),
  num: d3.format(','),
  num1: d3.format(',.1f'),
  num2: d3.format(',.2f'),
  num3: d3.format(',.3f'),
};

const tierColors = {
  green: () => getComputedStyle(document.documentElement).getPropertyValue('--tier-green').trim(),
  amber: () => getComputedStyle(document.documentElement).getPropertyValue('--tier-amber').trim(),
  red:   () => getComputedStyle(document.documentElement).getPropertyValue('--tier-red').trim(),
  grey:  () => getComputedStyle(document.documentElement).getPropertyValue('--tier-grey').trim(),
};

const modelabilityDims = [
  {
    key: 'd1',
    code: 'D1',
    title: 'Event volume',
    short: 'total historical events',
    lead: 'Measures how many outage events exist for the county in the selected EAGLE-I pricing catalog.',
    bullets: ['Green: at least 200 events', 'Amber: 50 to 199 events', 'Red: fewer than 50 events'],
    note: 'This is credibility, not severity. A high-event county can still be Green because it gives the model more evidence.',
  },
  {
    key: 'd2',
    code: 'D2',
    title: 'Events / year',
    short: 'annual credibility',
    lead: 'Measures the annualized event rate using the corrected source exposure window.',
    bullets: ['Green: at least 20 events/year', 'Amber: 5 to 19.9 events/year', 'Red: fewer than 5 events/year'],
    note: 'This protects against counties that have events, but not enough recurring annual signal to price confidently.',
  },
  {
    key: 'd3',
    code: 'D3',
    title: 'Observation window',
    short: 'source exposure length',
    lead: 'Measures how much source history is available for annualization and seasonality.',
    bullets: ['Green: at least 5 source years', 'Amber: 3 to 4.9 source years', 'Red: fewer than 3 source years'],
    note: 'Current v0 uses the raw EAGLE-I source exposure window, not first-event to last-event span.',
  },
  {
    key: 'd4',
    code: 'D4',
    title: 'Tail credibility',
    short: 'duration p95 reaches trigger range',
    lead: 'Checks whether the county duration distribution reaches the deductible range we are pricing.',
    bullets: ['Green: p95 duration at least 4 hours', 'Amber: p95 duration 2 to 3.99 hours', 'Red: p95 duration below 2 hours'],
    note: 'This is a tail-support check. If almost all observed events are very short, long-duration pricing is weak.',
  },
  {
    key: 'd5',
    code: 'D5',
    title: 'Data quality',
    short: 'EAGLE-I / DQI signal',
    lead: 'Uses the available EAGLE-I data-quality signal as a source-quality gate.',
    bullets: ['Green: DQI at least 0.80 or unavailable', 'Amber: DQI 0.50 to 0.79', 'Red: DQI below 0.50'],
    note: 'In v0, missing DQI is neutral because D1-D3 already catch observed data gaps. This should be refined later.',
  },
];

const roadmapDims = [
  {
    key: 'regulatory',
    title: 'Regulatory readiness',
    short: 'filing / licensing path',
    lead: 'Tracks whether the product can be explained and filed as an insurance product.',
    bullets: ['policy form language', 'named trigger source and methodology', 'SERFF / state DOI filing path'],
    note: 'Not part of v0 pricing. This becomes important before launch or carrier filing.',
  },
  {
    key: 'trigger',
    title: 'Trigger evidence',
    short: 'utility or secondary validation',
    lead: 'Tracks whether the live payout trigger has enough evidence at or near the insured location.',
    bullets: ['primary oracle coverage', 'fallback or secondary source', 'audit logs and bridge validation'],
    note: 'This is separate from EAGLE-I pricing quality. A county can price well but still have weak trigger evidence.',
  },
  {
    key: 'underwriting',
    title: 'Underwriting appetite',
    short: 'limits / concentration',
    lead: 'Tracks whether the county fits carrier and reinsurer appetite after aggregation is considered.',
    bullets: ['per-policy and aggregate limits', 'regional concentration', 'excluded or constrained territories'],
    note: 'This is a portfolio decision, not a historical data-quality gate.',
  },
  {
    key: 'compliance',
    title: 'Compliance ops',
    short: 'taxes / forms / distribution',
    lead: 'Tracks whether the operational requirements are ready for sale and servicing.',
    bullets: ['producer and distribution rules', 'taxes and forms', 'payment, notice, and dispute operations'],
    note: 'This is intentionally grey in v0 because it is a launch-readiness dimension.',
  },
];

const evidenceColumns = [
  {
    key: 'start',
    title: 'Start UTC',
    lead: 'The wall-clock UTC time of the first 15-minute EAGLE-I scrape where this county had any customer without power.',
    bullets: ['Stored timezone-naive but is UTC by convention — not converted to county-local time', 'Derived from the first positive customers_out snapshot inside the event', 'Use UTC throughout so cross-county and DST boundaries do not distort duration math'],
    note: 'A snapshot timestamp represents the start of its 15-minute interval (e.g. 14:15 covers [14:15, 14:30)).',
  },
  {
    key: 'duration',
    title: 'Duration',
    lead: 'How long the event lasted in hours, from the first positive scrape to 15 minutes after the last positive scrape inside the event.',
    bullets: ['Formula: end_time − start_time, in hours', 'Includes bridged-gap intervals where scrapes were missing but within the catalog\'s gap tolerance', 'This is the value compared against the selected T deductible'],
    note: 'The 30 / 45 / 60-minute catalog choice changes how many gaps get bridged, which can shift this value.',
  },
  {
    key: 'max_out',
    title: 'Max out',
    lead: 'At the event’s worst 15-minute EAGLE-I scrape, this many customers in the county were without power.',
    bullets: ['A "customer" in EAGLE-I is a metered electric account (roughly one per household or small business) — not a person, not a grid node', 'Computed as the max customers_out across the event’s observed 15-minute snapshots', 'Not directly used in the v0 premium formula'],
    note: 'v0 prices event frequency and duration; outage size is preserved as evidence for review.',
  },
  {
    key: 'mean_out',
    title: 'Mean out',
    lead: 'Average count of customers without power across the event’s observed positive 15-minute scrapes.',
    bullets: ['Same "customer" units as Max out — metered electric accounts', 'Denominator is the count of observed positive snapshots; bridged-gap slots are not averaged in, so mean can be biased upward when scrapes are patchy', 'Not directly used in the v0 premium formula'],
    note: 'A long event with low mean outage can still trigger if its duration exceeds T.',
  },
  {
    key: 'peak_pct_mcc',
    title: 'Peak % MCC',
    lead: 'At the event’s worst snapshot, the share of the county’s customer base that was without power.',
    bullets: ['Numerator and denominator are both EAGLE-I "customers" — metered electric accounts — so the ratio is dimensionally clean', 'MCC = Modeled County Customers, a static per-county estimate from Moehl et al. 2023 (shipped with EAGLE-I as MCC.csv); not population, not refreshed per year', 'Displays n/a when MCC is missing or zero'],
    note: 'An indirect county-level severity intensity for the worst instant — not a spatial footprint, and not a time-integrated severity.',
  },
  {
    key: 'trigger',
    title: 'Trigger',
    lead: 'Yes if this event\'s duration was at least the selected T — meaning the contract would have paid out for it.',
    bullets: ['Yes when duration ≥ selected T, No otherwise', 'A county-level trigger: fires if ANY positive customers_out snapshot lasted ≥ T, regardless of how many customers were affected', 'Does not include the live-oracle basis risk that a future contract trigger would face'],
    note: 'This is the historical pricing-catalog trigger. The customer paying the policy may not have been one of the customers actually out — that gap is the basis-risk question, tracked separately in the adjustment framework.',
  },
  {
    key: 'hist_payout',
    title: 'Hist payout',
    lead: 'What the contract would have paid out for this single event, if a policy with the selected T and X had been in force.',
    bullets: ['Equals X when Trigger = yes, else $0', 'Before expense ratio, target margin, and uncertainty load', 'Per-event payout, not an annual figure'],
    note: 'This is one historical event\'s hypothetical payout, not the policy\'s expected annual loss.',
  },
  {
    key: 'pure_contrib',
    title: 'Pure contrib.',
    lead: 'This single event\'s slice of the annual pure premium — its historical payout spread evenly across the source observation window.',
    bullets: ['Formula: historical payout ÷ source observation years (~11.17 yrs for the 2014-2025 release)', 'Compact-evidence rows only — the table holds the longest events, not the full county event log', 'KPI summary cards use the full county history, not just visible rows'],
    note: 'Sum of visible rows is generally less than the full pure premium — visible rows are evidence examples, not an exhaustive total.',
  },
];

const evidenceKpis = [
  {
    key: 'trigger_count',
    title: 'History triggers',
    lead: 'Full-history count of county events that satisfy the selected deductible T.',
    bullets: ['Not annualized', 'Uses duration >= selected T', 'Computed from the full county event history'],
    note: 'This answers how many historical events would have triggered the selected contract.',
  },
  {
    key: 'survival',
    title: 'S(T)',
    lead: 'Empirical share of county events that last at least the selected deductible T.',
    bullets: ['Formula: qualifying events / all events', 'Not annualized', 'Feeds the annual trigger-rate calculation'],
    note: 'This is the survival probability used in the premium matrix.',
  },
  {
    key: 'lambda',
    title: 'Annual rate',
    lead: 'Annualized qualifying event frequency for the selected T.',
    bullets: ['Formula: n_per_year x S(T)', 'Units are events per year', 'Uses the corrected source exposure window'],
    note: 'This is the annual frequency term in pure premium.',
  },
  {
    key: 'pure',
    title: 'Pure premium / yr',
    lead: 'Annual expected payout before expense ratio, target margin, and uncertainty load.',
    bullets: ['Formula: lambda(T) x X', 'Annual value', 'Uses the selected payout X'],
    note: 'This is the clean historical expected payout under the selected catalog definition.',
  },
  {
    key: 'retail',
    title: 'Retail premium / yr',
    lead: 'Annual customer-facing premium after expense ratio and target margin.',
    bullets: ['Formula: pure / (1 - expense - margin)', 'Annual value', 'Updates when sliders change'],
    note: 'v0 uncertainty load is still $0, so this is pure premium grossed up by the denominator.',
  },
];

// ============ BOOT ============
async function boot() {
  const status = document.getElementById('loadStatus');
  status.textContent = 'loading…';

  try {
    state.manifest = await loadManifest();
    wireCatalogSelect();
    await loadCatalog(readCatalogIdFromUrl());
  } catch (err) {
    status.textContent = err.message;
    status.style.color = 'var(--tier-red)';
    console.error(err);
    return;
  }

  initTheme();
  populateSidebar();
  renderDimensionInfoBlocks();
  renderEvidenceHeader();
  wireTabs();
  wireMatrixControls();
  wireSearch();
  wireInlineInfo();
  wireLegendInfo();
  wireCatalogInfo();
  wireBackNav();
  await initMap();
  await initRouting();
}

function infoId(info, scope) {
  return `${scope}-${info.key}-info`;
}

function infoButtonMarkup(info, scope) {
  const id = infoId(info, scope);
  return `
    <button class="inline-info-btn" type="button" aria-label="Explain ${info.title}" aria-expanded="false" aria-controls="${id}">i</button>
  `;
}

function infoPanelMarkup(info, scope) {
  const id = infoId(info, scope);
  const readMore = info.readMore
    ? `<button class="info-read-more" type="button" data-library-section="${escapeHtml(info.readMore.section)}">${escapeHtml(info.readMore.label || 'Read more in library →')}</button>`
    : '';
  return `
    <div class="inline-info-pop" id="${id}" hidden>
      <strong>${info.title}</strong>
      <p>${info.lead}</p>
      <div class="info-rule-list">${info.bullets.map(item => `<span>${item}</span>`).join('')}</div>
      <em>${info.note}</em>
      ${readMore}
    </div>
  `;
}

function renderDimensionInfoBlocks() {
  const futureDims = document.getElementById('panelFutureDims');
  if (futureDims) {
    futureDims.innerHTML = `
      <div class="future-title">Future launch-readiness dimensions</div>
      <div class="future-dim-list">
        ${roadmapDims.map(dim => `
          <div>
            <span class="dot grey"></span>
            <div class="roadmap-copy">
              <div class="dim-title-row">
                <strong>${dim.title}</strong>
                ${infoButtonMarkup(dim, 'panel-roadmap')}
              </div>
              <span>${dim.short}</span>
              ${infoPanelMarkup(dim, 'panel-roadmap')}
            </div>
          </div>
        `).join('')}
      </div>
      <p class="future-note">These are not scored in v0 yet. They should become separate grey readiness gates once trigger, filing, underwriting, and compliance evidence exists.</p>
    `;
  }
}

function gateListMarkup(scope = 'legend-gate') {
  return modelabilityDims.map(dim => `
    <div>
      <div class="dim-title-row">
        <strong>${dim.code}</strong>
        ${infoButtonMarkup(dim, scope)}
      </div>
      <span>${dim.title}</span>
      <em>${dim.short}</em>
      ${infoPanelMarkup(dim, scope)}
    </div>
  `).join('');
}

function roadmapListMarkup(scope = 'legend-roadmap') {
  return roadmapDims.map(dim => `
    <div>
      <span class="dot grey"></span>
      <div class="roadmap-copy">
        <div class="dim-title-row">
          <strong>${dim.title}</strong>
          ${infoButtonMarkup(dim, scope)}
        </div>
        <span>${dim.short}</span>
        ${infoPanelMarkup(dim, scope)}
      </div>
    </div>
  `).join('');
}

function renderEvidenceHeader() {
  const head = document.getElementById('eventEvidenceHead');
  if (!head) return;
  head.innerHTML = evidenceColumns.map(col => `
    <th>
      <div class="evidence-th">
        <span>${col.title}</span>
        ${infoButtonMarkup(col, 'evidence-col')}
      </div>
      ${infoPanelMarkup(col, 'evidence-col')}
    </th>
  `).join('');
}

function closeInlineInfo(root = document) {
  root.querySelectorAll?.('.inline-info-btn[aria-expanded="true"]').forEach(btn => {
    const pop = document.getElementById(btn.getAttribute('aria-controls'));
    btn.setAttribute('aria-expanded', 'false');
    if (pop) {
      pop.hidden = true;
      // If the popover was re-parented to <body> for clean positioning,
      // move it back to its original DOM location so the markup tree stays
      // tidy and subsequent renders find it where they expect.
      restoreInlineInfoToOriginalParent(pop);
    }
  });
}

function wireInlineInfo() {
  document.body.addEventListener('click', event => {
    const btn = event.target.closest('.inline-info-btn');
    if (!btn) {
      if (!event.target.closest('.inline-info-pop')) closeInlineInfo();
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const pop = document.getElementById(btn.getAttribute('aria-controls'));
    if (!pop) return;

    const scope = btn.closest('.diag li, .gate-list > div, .roadmap-list > div, .future-dim-list > div, .legend-popover, .future-dims') || document;
    const isOpen = btn.getAttribute('aria-expanded') === 'true';
    closeInlineInfo(scope);
    btn.setAttribute('aria-expanded', String(!isOpen));
    pop.hidden = isOpen;
    if (!isOpen) positionInlineInfo(btn, pop);
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') closeInlineInfo();
  });
}

function positionInlineInfo(btn, pop) {
  // Re-parent to <body> so flex / overflow on the popover's original parent
  // can't constrain its natural width. Remember the original parent so we
  // can move it back when the popover closes (keeps the DOM tidy and the
  // delegated event scope intact).
  if (pop.parentElement !== document.body) {
    pop._originalParent = pop.parentElement;
    pop._originalNextSibling = pop.nextSibling;
    document.body.appendChild(pop);
  }

  pop.style.position = 'fixed';
  pop.style.left = '';
  pop.style.right = '';
  pop.style.top = '';
  pop.style.maxHeight = '';
  pop.style.overflowY = '';

  const btnRect = btn.getBoundingClientRect();
  const popRect = pop.getBoundingClientRect();
  const margin = 12;

  // Prefer right-aligning popover under the button. If that pushes past the
  // left edge, switch to left-anchored. Same logic for vertical.
  let left = btnRect.right - popRect.width;
  if (left < margin) left = btnRect.left;
  left = Math.max(margin, Math.min(left, window.innerWidth - popRect.width - margin));

  let top = btnRect.bottom + 8;
  if (top + popRect.height > window.innerHeight - margin) {
    const above = btnRect.top - popRect.height - 8;
    top = above >= margin ? above : margin;
  }

  pop.style.left = `${left}px`;
  pop.style.top = `${top}px`;
  pop.style.maxHeight = `${Math.max(220, window.innerHeight - top - margin)}px`;
  pop.style.overflowY = 'auto';
}

function restoreInlineInfoToOriginalParent(pop) {
  if (!pop || pop.parentElement === pop._originalParent) return;
  if (!pop._originalParent || !pop._originalParent.isConnected) return;
  // Reset the inline positioning so it doesn't leak when the element is
  // reattached and then re-opened from a different anchor.
  pop.style.position = '';
  pop.style.left = '';
  pop.style.right = '';
  pop.style.top = '';
  pop.style.maxHeight = '';
  pop.style.overflowY = '';
  if (pop._originalNextSibling && pop._originalNextSibling.isConnected) {
    pop._originalParent.insertBefore(pop, pop._originalNextSibling);
  } else {
    pop._originalParent.appendChild(pop);
  }
}

// ============ CATALOGS ============
async function loadManifest() {
  try {
    const resp = await fetch('../catalogs/manifest.json', { cache: 'no-store' });
    if (resp.ok) return await resp.json();
  } catch (err) {
    console.warn('catalog manifest failed; falling back to legacy output', err);
  }
  return {
    default_catalog: 'legacy-current',
    catalogs: [{
      id: 'legacy-current',
      label: 'Current output',
      short_label: 'current',
      status: 'legacy',
      description: 'Fallback to the single generated artifact set.',
      gap_tolerance_minutes: null,
      paths: {
        drilldown: '../pricing/county_drilldown.json',
        tiers: '../filtration/county_tiers.csv',
        event_evidence: '../pricing/event_evidence',
      },
    }],
  };
}

function catalogById(id) {
  return state.manifest?.catalogs?.find(c => c.id === id) || null;
}

function defaultCatalogId() {
  return state.manifest?.default_catalog || state.manifest?.catalogs?.[0]?.id || 'legacy-current';
}

function readCatalogIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const requested = params.get('catalog');
  return catalogById(requested) ? requested : defaultCatalogId();
}

async function loadCatalog(catalogId) {
  const catalog = catalogById(catalogId) || catalogById(defaultCatalogId());
  if (!catalog) throw new Error('no event catalogs available');

  const status = document.getElementById('loadStatus');
  status.textContent = `loading ${catalog.short_label || catalog.label}…`;
  status.style.color = '';

  const perCustomerUrl = perCustomerViewUrl(catalog);
  const [drillResp, tiersResp, perCustResp] = await Promise.all([
    fetch(catalog.paths.drilldown, { cache: 'no-store' }),
    fetch(catalog.paths.tiers, { cache: 'no-store' }),
    perCustomerUrl ? fetch(perCustomerUrl, { cache: 'no-store' }) : Promise.resolve(null),
  ]);
  if (!drillResp.ok) throw new Error(`${catalog.label}: county_drilldown.json missing — build catalogs`);
  if (!tiersResp.ok) throw new Error(`${catalog.label}: county_tiers.csv missing — build catalogs`);

  state.catalogId = catalog.id;
  state.catalog = catalog;
  state.drilldown = await drillResp.json();
  state.tiers = parseCsv(await tiersResp.text());
  state.perCustomer = (perCustResp && perCustResp.ok) ? await perCustResp.json() : null;
  state.eventEvidenceCache.clear();

  const nCounties = Object.keys(state.drilldown).length;
  status.textContent = `${fmt.num(nCounties)} counties · ${catalog.short_label || catalog.label}`;
  updateCatalogUi();
  populateSidebar();
  renderSearchResults();
  refreshMapColors();
}

function wireCatalogSelect() {
  const select = document.getElementById('catalogSelect');
  if (!select || !state.manifest) return;
  select.innerHTML = state.manifest.catalogs.map(c =>
    `<option value="${escapeHtml(c.id)}">${escapeHtml(c.label)}</option>`
  ).join('');
  select.addEventListener('change', async () => {
    const routeBefore = currentRoute();
    try {
      await loadCatalog(select.value);
      applyRoute(routeBefore, { push: false });
      pushRoute();
    } catch (err) {
      document.getElementById('loadStatus').textContent = err.message;
      document.getElementById('loadStatus').style.color = 'var(--tier-red)';
      console.error(err);
    }
  });
}

function updateCatalogUi() {
  const catalog = state.catalog;
  const select = document.getElementById('catalogSelect');
  const note = document.getElementById('catalogNote');
  const headerMeta = document.getElementById('headerMeta');
  if (select && catalog) select.value = catalog.id;
  if (note && catalog) {
    const gap = catalog.gap_tolerance_minutes ? `${catalog.gap_tolerance_minutes} min gap` : 'single output';
    note.textContent = `${catalog.status || 'catalog'} · ${gap}`;
    note.title = catalog.description || '';
  }
  if (headerMeta && catalog) {
    headerMeta.textContent = `v0 · ${catalog.short_label || catalog.label} catalog`;
    headerMeta.title = catalog.description || '';
  }
}

// ============ CSV ============
function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  const headers = lines[0].split(',');
  const m = new Map();
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(',');
    const row = {};
    for (let j = 0; j < headers.length; j++) row[headers[j]] = cells[j];
    if (row.fips) m.set(String(parseInt(row.fips, 10)), row);
  }
  return m;
}

// ============ THEME ============
function initTheme() {
  const root = document.documentElement;
  const prefers = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  root.setAttribute('data-theme', prefers);
  document.getElementById('themeToggle').addEventListener('click', () => {
    const cur = root.getAttribute('data-theme');
    const next = cur === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    if (map) {
      swapBasemap(next === 'dark');
      refreshMapColors();
    }
    if (state.selectedFips) renderMatrix(state.selectedFips);
  });
}

function swapBasemap(isDark) {
  const variant = isDark ? 'dark_nolabels' : 'light_nolabels';
  const tiles = [
    `https://a.basemaps.cartocdn.com/${variant}/{z}/{x}/{y}@2x.png`,
    `https://b.basemaps.cartocdn.com/${variant}/{z}/{x}/{y}@2x.png`,
  ];
  // remove and re-add the raster source so tiles refetch with new variant
  if (map.getLayer('carto')) map.removeLayer('carto');
  if (map.getSource('carto')) map.removeSource('carto');
  map.addSource('carto', { type: 'raster', tiles, tileSize: 256, attribution: '© OpenStreetMap · © CARTO' });
  map.addLayer({ id: 'carto', type: 'raster', source: 'carto' }, map.getStyle().layers[0]?.id);
}

// ============ SIDEBAR STATS ============
function populateSidebar() {
  const total = Object.keys(state.drilldown).length;
  let nEvents = 0, maxYears = 0;
  for (const f in state.drilldown) {
    const d = state.drilldown[f];
    nEvents += d.n_events_total || 0;
    if (d.observation_years > maxYears) maxYears = d.observation_years;
  }
  document.getElementById('statCounties').textContent = fmt.num(total);
  document.getElementById('statEvents').textContent = fmt.num(nEvents);
  document.getElementById('statYears').textContent = maxYears.toFixed(1);

  // tier mix
  let g = 0, a = 0, r = 0;
  for (const [, row] of state.tiers) {
    if (row.tier === 'green') g++;
    else if (row.tier === 'amber') a++;
    else r++;
  }
  const t = g + a + r;
  const bar = document.getElementById('tierBar');
  bar.innerHTML =
    `<div class="seg-green" style="width:${(g/t*100).toFixed(2)}%"></div>` +
    `<div class="seg-amber" style="width:${(a/t*100).toFixed(2)}%"></div>` +
    `<div class="seg-red"   style="width:${(r/t*100).toFixed(2)}%"></div>`;
  document.getElementById('tGreen').textContent = fmt.num(g);
  document.getElementById('tAmber').textContent = fmt.num(a);
  document.getElementById('tRed').textContent   = fmt.num(r);
}

// ============ TABS ============
function wireTabs() {
  document.querySelectorAll('[data-view]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.disabled) return;
      switchView(btn.dataset.view);
    });
  });
}
function switchView(name, opts = {}) {
  state.view = name;
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById('view-' + name).classList.add('active');
  document.querySelectorAll('[data-view]').forEach(t => t.classList.toggle('current', t.dataset.view === name));
  updateCrumbs();
  updateBackNav();
  // Toggle empty-state vs content for matrix / drill-down based on selection
  const hasFips = !!state.selectedFips;
  const hasDrill = hasFips && state.drilldown[state.selectedFips] && state.drilldown[state.selectedFips].lastCell;
  const mxEmpty = document.getElementById('matrixEmpty');
  const mxGrid  = document.getElementById('matrixGrid');
  const drEmpty = document.getElementById('drillEmpty');
  const drGrid  = document.getElementById('drillGrid');
  if (mxEmpty && mxGrid) {
    mxEmpty.hidden = hasFips;
    mxGrid.hidden  = !hasFips;
  }
  if (drEmpty && drGrid) {
    drEmpty.hidden = hasDrill;
    drGrid.hidden  = !hasDrill;
  }
  if (opts.push !== false) pushRoute();
}
function updateCrumbs() {
  const crumbs = document.getElementById('crumbs');
  const showCounty = state.selectedFips && state.view !== 'map';
  const parts = [`<span class="crumb-link" data-jump="map-root">United States</span>`];
  if (showCounty) {
    const d = state.drilldown[state.selectedFips];
    parts.push(`<span class="crumb-sep">/</span>`);
    parts.push(`<span class="crumb-link" data-jump="matrix">${escapeHtml(d.county)}, ${escapeHtml(d.state)}</span>`);
    if (state.view === 'drilldown') {
      parts.push(`<span class="crumb-sep">/</span>`);
      parts.push(`<span class="crumb current">Drill-down</span>`);
    }
  }
  crumbs.innerHTML = parts.join(' ');
  crumbs.querySelectorAll('[data-jump]').forEach(el => {
    el.addEventListener('click', () => {
      if (el.dataset.jump === 'map-root') goToMap({ clearSelection: true });
      else if (el.dataset.jump === 'matrix' && state.selectedFips) openMatrix(state.selectedFips);
      else switchView(el.dataset.jump);
    });
  });
}
// Tabs are always enabled — empty states handle the no-selection case.

function wireBackNav() {
  const btn = document.getElementById('backNav');
  if (!btn) return;
  btn.addEventListener('click', () => {
    if (state.view === 'drilldown' && state.selectedFips) {
      openMatrix(state.selectedFips);
    } else {
      goToMap({ clearSelection: true });
    }
  });
  updateBackNav();
}

function updateBackNav() {
  const btn = document.getElementById('backNav');
  if (!btn) return;
  const canGoBack = state.view !== 'map';
  btn.hidden = !canGoBack;
  btn.title = state.view === 'drilldown' ? 'Back to matrix' : 'Back to map';
}

function goToMap(opts = {}) {
  if (opts.clearSelection) state.selectedFips = null;
  switchView('map', { push: opts.push });
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[ch]));
}

// ============ ROUTING / HISTORY ============
async function initRouting() {
  window.addEventListener('popstate', () => {
    handleRoute().catch(err => {
      document.getElementById('loadStatus').textContent = err.message;
      document.getElementById('loadStatus').style.color = 'var(--tier-red)';
      console.error(err);
    });
  });
  await handleRoute({ replace: true });
}

async function handleRoute(opts = {}) {
  const catalogId = readCatalogIdFromUrl();
  if (catalogId !== state.catalogId) {
    await loadCatalog(catalogId);
  }
  applyRoute(readRoute(), opts);
}

function readRoute() {
  const params = new URLSearchParams(window.location.search);
  const view = ['map', 'matrix', 'drilldown'].includes(params.get('view')) ? params.get('view') : 'map';
  const rawFips = params.get('fips');
  const fips = rawFips && state.drilldown[String(parseInt(rawFips, 10))]
    ? String(parseInt(rawFips, 10))
    : null;
  const T = params.has('T') ? parseInt(params.get('T'), 10) : null;
  const X = params.has('X') ? parseInt(params.get('X'), 10) : null;
  return { view, fips, T, X };
}

function applyRoute(route, opts = {}) {
  if (route.view === 'map') {
    state.selectedFips = null;
    switchView('map', { push: false });
    if (opts.replace) history.replaceState(currentRoute(), '', routeUrl(currentRoute()));
    return;
  }

  if (route.fips) {
    state.selectedFips = route.fips;
    const hasCell = route.view === 'drilldown' &&
      route.T && route.X &&
      state.drilldown[route.fips]?.grid?.[route.T]?.X?.[route.X];

    if (hasCell) {
      openDrilldown(route.fips, route.T, route.X, { push: false });
    } else {
      if (route.view === 'drilldown' && state.drilldown[route.fips]) {
        delete state.drilldown[route.fips].lastCell;
      }
      switchView(route.view, { push: false });
      requestAnimationFrame(() => renderMatrix(route.fips));
    }
  } else {
    state.selectedFips = null;
    switchView(route.view, { push: false });
  }

  if (opts.replace) {
    history.replaceState(currentRoute(), '', routeUrl(currentRoute()));
  }
}

function currentRoute() {
  const route = { view: state.view };
  if (state.view !== 'map' && state.selectedFips) {
    route.fips = state.selectedFips;
  }
  const lastCell = route.fips ? state.drilldown[route.fips]?.lastCell : null;
  if (state.view === 'drilldown' && lastCell) {
    route.T = lastCell.T;
    route.X = lastCell.X;
  }
  return route;
}

function routeUrl(route) {
  const url = new URL(window.location.href);
  url.search = '';
  if (state.catalogId && state.catalogId !== defaultCatalogId()) {
    url.searchParams.set('catalog', state.catalogId);
  }
  if (route.view && route.view !== 'map') url.searchParams.set('view', route.view);
  if (route.fips) url.searchParams.set('fips', route.fips);
  if (route.view === 'drilldown' && route.T && route.X) {
    url.searchParams.set('T', route.T);
    url.searchParams.set('X', route.X);
  }
  return url.pathname + url.search + url.hash;
}

function pushRoute() {
  const route = currentRoute();
  const next = routeUrl(route);
  const cur = window.location.pathname + window.location.search + window.location.hash;
  if (next === cur) {
    history.replaceState(route, '', next);
    return;
  }
  history.pushState(route, '', next);
}

// ============ SEARCH ============
function wireSearch() {
  const input = document.getElementById('search');
  input.addEventListener('input', renderSearchResults);
  renderSearchResults();
}

function renderSearchResults() {
  const input = document.getElementById('search');
  const out = document.getElementById('searchResults');
  if (!input || !out || !state.drilldown) return;

  let allEntries = Object.entries(state.drilldown).map(([fips, d]) => ({ fips, ...d }));
  // sort by events desc for default order
  allEntries.sort((a, b) => (b.n_events_total || 0) - (a.n_events_total || 0));

  const q = input.value.trim().toLowerCase();
  const matches = q
    ? allEntries.filter(e =>
        e.county.toLowerCase().includes(q) ||
        e.state.toLowerCase().includes(q) ||
        String(e.fips).includes(q)
      ).slice(0, 30)
    : allEntries.slice(0, 12);
  out.innerHTML = matches.map(e =>
    `<button data-fips="${e.fips}">
       <span><span class="dot ${e.tier}"></span> ${escapeHtml(e.county)}, ${escapeHtml(e.state)}</span>
       <span class="res-meta">${fmt.num(e.n_events_total)}ev · ${e.n_per_year ? e.n_per_year.toFixed(0) : '—'}/y</span>
     </button>`
  ).join('');
  out.querySelectorAll('button').forEach(b =>
    b.addEventListener('click', () => openMatrix(b.dataset.fips))
  );
}

// ============ MAP ============
let map;
async function initMap() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  map = new maplibregl.Map({
    container: 'map',
    style: {
      version: 8,
      glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
      sources: {
        carto: {
          type: 'raster',
          tiles: [
            `https://a.basemaps.cartocdn.com/${isDark ? 'dark_nolabels' : 'light_nolabels'}/{z}/{x}/{y}@2x.png`,
            `https://b.basemaps.cartocdn.com/${isDark ? 'dark_nolabels' : 'light_nolabels'}/{z}/{x}/{y}@2x.png`,
          ],
          tileSize: 256,
          attribution: '© OpenStreetMap · © CARTO',
        },
      },
      layers: [{ id: 'carto', type: 'raster', source: 'carto' }],
    },
    center: [-96.5, 39.0],
    zoom: 3.6,
    minZoom: 2.5,
    maxZoom: 10,
    attributionControl: true,
  });
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');

  await new Promise(res => map.on('load', res));

  // load county polygons
  try {
    const resp = await fetch('https://raw.githubusercontent.com/plotly/datasets/master/geojson-counties-fips.json');
    const counties = await resp.json();
    state.countiesGeo = counties;

    // promote id from feature.id (string '01001') to feature.properties.fips (int)
    for (const f of counties.features) {
      const id = parseInt(f.id, 10);
      f.id = id; // numeric id so feature-state works
      f.properties = f.properties || {};
      f.properties.fips = id;
    }

    map.addSource('counties', { type: 'geojson', data: counties });

    map.addLayer({
      id: 'counties-fill',
      type: 'fill',
      source: 'counties',
      paint: {
        'fill-color': ['coalesce', ['feature-state', 'color'], '#cfd5dc'],
        'fill-opacity': 0.72,
      },
    });
    map.addLayer({
      id: 'counties-line',
      type: 'line',
      source: 'counties',
      paint: {
        'line-color': ['case',
          ['boolean', ['feature-state', 'hover'], false], '#0b6e74',
          'rgba(0,0,0,0)'
        ],
        'line-width': 1.5,
      },
    });

    refreshMapColors();
    wireMapHover();
    wireMapClick();
    wireMapFilters();
  } catch (err) {
    console.error('counties geojson failed', err);
    document.getElementById('loadStatus').textContent = 'map boundaries failed — search still works';
  }
}

function colorFor(fips, mode) {
  const d = state.drilldown[fips];
  if (!d) return null;

  const minEvents = +document.getElementById('minEvents').value || 0;
  const minObsYears = +document.getElementById('minObsYears').value || 0;
  const quotableOnly = document.getElementById('quotableOnly').checked;

  if ((d.n_events_total || 0) < minEvents) return { color: tierColors.grey(), tier: 'grey' };
  if ((d.observation_years || 0) < minObsYears) return { color: tierColors.grey(), tier: 'grey' };
  if (quotableOnly && !(d.tier === 'green' || d.tier === 'amber')) return { color: tierColors.grey(), tier: 'grey' };

  if (mode === 'tier') return { color: tierColors[d.tier] ? tierColors[d.tier]() : tierColors.grey(), tier: d.tier };
  if (mode === 'lambda') {
    const lam = d.grid?.[8]?.lambda_T ?? null;
    if (lam == null) return { color: tierColors.grey(), tier: 'grey' };
    return { color: lambdaScale(lam), tier: d.tier };
  }
  if (mode === 'retail') {
    const cell = d.grid?.[8]?.X?.[2500];
    if (!cell) return { color: tierColors.grey(), tier: 'grey' };
    return { color: premiumScale(cell.retail), tier: d.tier };
  }
  if (mode === 'events') {
    const events = d.n_events_total ?? null;
    if (events == null || events <= 0) return { color: tierColors.grey(), tier: 'grey' };
    return { color: eventCountScale(events), tier: d.tier };
  }
  return { color: tierColors.grey(), tier: 'grey' };
}

// sequential color ramps (interpolated)
const lambdaScale = d3.scaleSequential(d3.interpolateYlOrRd).domain([0, 50]).clamp(true);
const premiumScale = d3.scaleSequentialLog(d3.interpolateYlOrRd).domain([500, 50000]).clamp(true);
const eventCountScale = d3.scaleSequentialLog(d3.interpolateYlGnBu).domain([1, 10000]).clamp(true);

function refreshMapColors() {
  if (!state.countiesGeo) return;
  const mode = document.getElementById('mapColorBy').value;
  for (const f of state.countiesGeo.features) {
    const c = colorFor(String(f.id), mode);
    if (c) map.setFeatureState({ source: 'counties', id: f.id }, { color: c.color, tier: c.tier });
  }
  renderMapLegend(mode);
}

function renderMapLegend(mode) {
  const el = document.getElementById('mapLegend');
  if (mode === 'tier') {
    el.innerHTML = `
      <div><span class="sw" style="background:${tierColors.green()}"></span>Green</div>
      <div><span class="sw" style="background:${tierColors.amber()}"></span>Amber</div>
      <div><span class="sw" style="background:${tierColors.red()}"></span>Red</div>
      <div><span class="sw" style="background:${tierColors.grey()}"></span>Filtered</div>`;
  } else if (mode === 'lambda') {
    const stops = [0, 12.5, 25, 37.5, 50].map(v => lambdaScale(v));
    el.innerHTML = rampLegendMarkup('λ(8h)', '0', '50+/yr', stops);
  } else if (mode === 'retail') {
    const stops = [500, 2500, 10000, 25000, 50000].map(v => premiumScale(v));
    el.innerHTML = rampLegendMarkup('Retail', '$500', '$50k+/yr', stops);
  } else if (mode === 'events') {
    const stops = [1, 50, 200, 1000, 10000].map(v => eventCountScale(v));
    el.innerHTML = rampLegendMarkup('Historical events', '1', '10k+', stops);
  }
  renderLegendPopover(mode);
}

function rampLegendMarkup(title, low, high, stops) {
  return `
    <span class="legend-kicker">${title}</span>
    <span>${low}</span>
    <div class="ramp" style="background:linear-gradient(to right,${stops.join(',')})"></div>
    <span>${high}</span>
    <div class="legend-filtered"><span class="sw" style="background:${tierColors.grey()}"></span>Filtered</div>
  `;
}

function legendMetricRows(rows) {
  return `
    <div class="pop-metric-list">
      ${rows.map(row => `
        <div>
          <strong>${row[0]}</strong>
          <span>${row[1]}</span>
        </div>
      `).join('')}
    </div>
  `;
}

function renderLegendPopover(mode) {
  const pop = document.getElementById('legendPopover');
  const btn = document.getElementById('legendInfo');
  if (!pop) return;

  const labels = {
    tier: 'Explain map tiers',
    lambda: 'Explain annual trigger-rate layer',
    retail: 'Explain retail premium layer',
    events: 'Explain event evidence layer',
  };
  if (btn) btn.setAttribute('aria-label', labels[mode] || 'Explain map layer');

  if (mode === 'tier') {
    pop.innerHTML = `
      <div class="pop-title">Tier meaning</div>
      <p class="pop-lede">Colors describe modelability, not outage severity. The overall county tier is the weakest current v0 gate.</p>
      <div class="pop-row tier-row"><span class="dot green"></span><strong>Green</strong><span>Priced normally in v0.</span></div>
      <div class="pop-row tier-row"><span class="dot amber"></span><strong>Amber</strong><span>Quoteable baseline, with a weaker credibility or quality gate.</span></div>
      <div class="pop-row tier-row"><span class="dot red"></span><strong>Red</strong><span>No quote in v0 because at least one modelability gate failed.</span></div>
      <div class="pop-row tier-row"><span class="dot grey"></span><strong>Grey</strong><span>No engine record, hidden by filters, or not evaluated in v0.</span></div>

      <div class="pop-section-title">Current v0 gates</div>
      <div class="gate-list">${gateListMarkup('legend-gate')}</div>
      <p class="pop-note">D1, D2, and D4 are county-event driven. D3 uses the raw source exposure window. D5 uses a FEMA-region source proxy in v0.</p>

      <div class="pop-section-title">Roadmap dimensions</div>
      <div class="roadmap-list">${roadmapListMarkup('legend-roadmap')}</div>
      <p class="pop-note">These are intentionally grey: useful launch-readiness dimensions, but not part of the v0 county tier.</p>
    `;
  } else if (mode === 'lambda') {
    pop.innerHTML = `
      <div class="pop-title">Annual trigger rate</div>
      <p class="pop-lede">Colors show annualized qualifying outage frequency for the selected catalog at <strong>T = 8h</strong>. Darker counties have more expected 8h+ events per year.</p>
      ${legendMetricRows([
        ['Formula', 'lambda(8h) = n_per_year x S(8h)'],
        ['Meaning', 'Expected qualifying events per year, not premium and not modelability tier.'],
        ['Grey', 'Filtered by toolbar controls, missing engine record, or unavailable value.'],
      ])}
      <p class="pop-note">This layer is a risk-frequency diagnostic. Confidence still depends on the amount of historical event evidence behind the empirical survival curve.</p>
    `;
  } else if (mode === 'retail') {
    pop.innerHTML = `
      <div class="pop-title">Retail premium</div>
      <p class="pop-lede">Colors show annual retail premium for <strong>T = 8h</strong> and <strong>X = $2,500</strong> under the current v0 load assumptions.</p>
      ${legendMetricRows([
        ['Formula', 'retail = lambda(8h) x $2,500 / (1 - expense - margin)'],
        ['Default loads', 'Expense ratio 20%, target margin 15%, uncertainty load $0 in v0.'],
        ['Grey', 'Filtered by toolbar controls, missing engine record, or unavailable value.'],
      ])}
      <p class="pop-note">This layer is a pricing-output diagnostic. Quotability is still governed by the tier layer and modelability gates.</p>
    `;
  } else if (mode === 'events') {
    pop.innerHTML = `
      <div class="pop-title">Event evidence volume</div>
      <p class="pop-lede">Colors show total historical outage events in the selected EAGLE-I catalog. This is a first-pass confidence proxy for the empirical survival curve.</p>
      ${legendMetricRows([
        ['Why it matters', 'v0 estimates S(T) by direct counting, so more historical events usually means a more stable empirical curve.'],
        ['D1 reference', 'Green starts at 200 total events; Amber is 50 to 199; Red is fewer than 50.'],
        ['Not severity', 'High event volume can include many short routine outages. It does not mean the county is worse by itself.'],
        ['For a specific T', 'Qualifying event count at that T also matters; this map is the national overview layer.'],
      ])}
      <p class="pop-note">Grey still means hidden by filters, missing engine record, or not evaluated in v0.</p>
    `;
  }
}

function wireLegendInfo() {
  const btn = document.getElementById('legendInfo');
  const pop = document.getElementById('legendPopover');
  if (!btn || !pop) return;

  const positionPopover = () => {
    if (pop.hidden) return;
    pop.style.transform = 'translateX(0)';
    const mainLeft = document.querySelector('.main')?.getBoundingClientRect().left ?? 16;
    const maxRight = window.innerWidth - 16;
    const rect = pop.getBoundingClientRect();
    let dx = 0;
    if (rect.left < mainLeft) dx += mainLeft - rect.left;
    if (rect.right + dx > maxRight) dx -= rect.right + dx - maxRight;
    const toolbarTop = document.querySelector('.map-toolbar')?.getBoundingClientRect().top ?? rect.top;
    const minTop = toolbarTop + 8;
    const available = window.innerHeight - rect.top - 16;
    const overflow = Math.max(0, pop.scrollHeight - available);
    const dy = -Math.min(Math.max(0, rect.top - minTop), overflow);
    pop.style.transform = `translate(${dx}px, ${dy}px)`;
    const top = pop.getBoundingClientRect().top;
    pop.style.maxHeight = `${Math.max(280, window.innerHeight - top - 16)}px`;
  };

  const close = () => {
    pop.hidden = true;
    btn.setAttribute('aria-expanded', 'false');
  };
  const toggle = (event) => {
    event.stopPropagation();
    const isOpen = !pop.hidden;
    pop.hidden = isOpen;
    btn.setAttribute('aria-expanded', String(!isOpen));
    if (isOpen) return;
    requestAnimationFrame(positionPopover);
  };

  btn.addEventListener('click', toggle);
  pop.addEventListener('click', event => {
    if (!event.target.closest('.inline-info-btn')) event.stopPropagation();
  });
  window.addEventListener('resize', positionPopover);
  document.addEventListener('click', close);
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') close();
  });
}

function wireCatalogInfo() {
  const btn = document.getElementById('catalogInfo');
  const pop = document.getElementById('catalogPopover');
  if (!btn || !pop) return;

  const close = () => {
    pop.hidden = true;
    btn.setAttribute('aria-expanded', 'false');
  };

  btn.addEventListener('click', event => {
    event.preventDefault();
    event.stopPropagation();
    const isOpen = !pop.hidden;
    pop.hidden = isOpen;
    btn.setAttribute('aria-expanded', String(!isOpen));
  });

  pop.addEventListener('click', event => event.stopPropagation());
  document.addEventListener('click', close);
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') close();
  });
}

function wireMapFilters() {
  ['quotableOnly', 'minEvents', 'minObsYears', 'mapColorBy'].forEach(id => {
    const e = document.getElementById(id);
    e.addEventListener('input', refreshMapColors);
    e.addEventListener('change', refreshMapColors);
  });
}

let hoverFips = null;
function wireMapHover() {
  const tip = document.getElementById('hoverTip');
  map.on('mousemove', 'counties-fill', (e) => {
    const f = e.features[0];
    const fips = String(f.id);
    const d = state.drilldown[fips];
    if (hoverFips != null && hoverFips !== f.id) {
      map.setFeatureState({ source: 'counties', id: hoverFips }, { hover: false });
    }
    hoverFips = f.id;
    map.setFeatureState({ source: 'counties', id: f.id }, { hover: true });
    map.getCanvas().style.cursor = d ? 'pointer' : '';
    if (!d) { tip.classList.add('hidden'); return; }

    const lam8 = d.grid?.[8]?.lambda_T?.toFixed(2) ?? '—';
    const ret8 = d.grid?.[8]?.X?.[2500]?.retail;
    tip.innerHTML = `
      <div class="tip-title">
        <span>${d.county}, ${d.state}</span>
        <span class="tip-tier ${d.tier}">${d.tier}</span>
      </div>
      <div class="tip-row"><span>FIPS</span><span>${fips}</span></div>
      <div class="tip-row"><span>events</span><span>${fmt.num(d.n_events_total)}</span></div>
      <div class="tip-row"><span>obs years</span><span>${(d.observation_years||0).toFixed(1)}</span></div>
      <div class="tip-row"><span>p95 duration</span><span>${d.duration_p95.toFixed(1)}h</span></div>
      <div class="tip-row"><span>λ(8h)</span><span>${lam8}/yr</span></div>
      <div class="tip-row"><span>$2.5k @ 8h</span><span>${ret8 ? fmt.money(ret8) : '—'}</span></div>`;
    tip.style.left = (e.originalEvent.clientX + 14) + 'px';
    tip.style.top  = (e.originalEvent.clientY + 14) + 'px';
    tip.classList.remove('hidden');
  });
  map.on('mouseleave', 'counties-fill', () => {
    if (hoverFips != null) map.setFeatureState({ source: 'counties', id: hoverFips }, { hover: false });
    hoverFips = null;
    tip.classList.add('hidden');
    map.getCanvas().style.cursor = '';
  });
}

function wireMapClick() {
  map.on('click', 'counties-fill', (e) => {
    const fips = String(e.features[0].id);
    if (state.drilldown[fips]) openMatrix(fips);
  });
}

// ============ MATRIX ============
function wireMatrixControls() {
  const er = document.getElementById('expenseRatio');
  const tm = document.getElementById('targetMargin');
  const kind = document.getElementById('premKind');
  const erVal = document.getElementById('expenseRatioVal');
  const tmVal = document.getElementById('targetMarginVal');
  const seg = document.getElementById('matrixViewSeg');
  const evidenceControls = ['evidenceT', 'evidenceX', 'evidenceSort', 'evidenceQualOnly']
    .map(id => document.getElementById(id))
    .filter(Boolean);

  const refresh = () => {
    erVal.textContent = (+er.value * 100).toFixed(0) + '%';
    tmVal.textContent = (+tm.value * 100).toFixed(0) + '%';
    if (state.selectedFips) renderMatrix(state.selectedFips);
  };
  er.addEventListener('input', refresh);
  tm.addEventListener('input', refresh);
  kind.addEventListener('change', refresh);
  if (seg) {
    seg.addEventListener('click', (ev) => {
      const btn = ev.target.closest('.seg-item');
      if (!btn || btn.disabled) return;
      const mode = btn.dataset.mxview;
      if (!mode || mode === state.matrixView) return;
      setMatrixView(mode);
    });
  }
  evidenceControls.forEach(control => {
    const eventName = control.type === 'checkbox' ? 'change' : 'change';
    control.addEventListener(eventName, () => {
      if (state.selectedFips) renderEventEvidence(state.selectedFips);
    });
  });
}

function setMatrixView(mode) {
  state.matrixView = mode;
  syncMatrixViewSeg();
  // Show toggle is moot in Multiplier view — the number is dimensionless.
  const kind = document.getElementById('premKind');
  if (kind) kind.disabled = (mode === 'multiplier');
  if (state.selectedFips) renderMatrix(state.selectedFips);
}

function syncMatrixViewSeg() {
  // Defensive: every render of the matrix re-asserts that the toggle's
  // current button matches state.matrixView. Prevents the toggle from
  // drifting out of sync if state was changed without going through
  // setMatrixView (e.g. on initial boot when the JS state default may not
  // match the HTML default-current class).
  const seg = document.getElementById('matrixViewSeg');
  if (!seg) return;
  seg.querySelectorAll('.seg-item').forEach(b => {
    b.classList.toggle('current', b.dataset.mxview === state.matrixView);
  });
}

const matrixModeNotes = {
  county: 'v0 baseline. Annual per-policy premium that triggers on any qualifying county-event ≥ T.',
  customer: 'Shadow estimate of per-customer expected loss. Not currently used in pricing — see Per-Customer Pricing Plan.',
  multiplier: 'Customer-impact multiplier per cell — `mean(mean_customers / MCC | duration ≥ T)`. Converts county-trigger rate to per-customer.',
};

const coverageGateInfo = {
  key: 'coverage-gate',
  title: 'Coverage gate · what the cell colors mean',
  lead: 'Each (county, T) cell is classified by how much evidence backs the per-customer estimate. Color tells you whether to lean on the number.',
  bullets: [
    'Available · ≥ 100 qualifying events at T AND ≥ 500 total county events. The multiplier is computed on a credible sample.',
    'Caution · 10–99 qualifying events at T, OR < 500 total events. The value is shown but flagged as thin evidence — read with sensitivity bands in mind.',
    'Not available · < 10 qualifying events at T, or MCC missing. Cell is blanked because the estimate would be noise.',
  ],
  note: 'Thresholds are tunable at the top of compute_per_customer_lambda.py. They exist because the per-event mean_customers / MCC distribution is heavy-tailed — small samples can swing the mean by a lot. Hover any caution / blank cell for the specific reason; click for the drill-down.',
  readMore: { section: 'per-customer-walkthrough', label: 'Read the full per-customer walkthrough →' },
};

function gateClassName(status) {
  if (status === 'available') return 'available';
  if (status === 'caution') return 'caution';
  return 'not-available';
}

function gateReasonText(reason) {
  switch (reason) {
    case 'mcc_missing': return 'MCC missing';
    case 'insufficient_qualifying_events': return 'too few qualifying events';
    case 'low_qualifying_event_count': return 'low qualifying-event count';
    case 'low_total_event_count': return 'low total event count';
    default: return reason || '';
  }
}

function renderMatrixLegend() {
  const el = document.getElementById('matrixLegend');
  if (!el) return;
  if (state.matrixView === 'county') {
    el.innerHTML = `
      <div><span class="dot green"></span>Green</div>
      <div><span class="dot amber"></span>Amber</div>
      <div><span class="dot red"></span>No-quote</div>
      <div class="legend-hint">Click any cell for the full premium drill-down.</div>
    `;
  } else {
    el.innerHTML = `
      <div><span class="dot shadow"></span>Available</div>
      <div class="legend-with-info">
        <span class="dot caution-stripe"></span>Caution · thin evidence
        ${infoButtonMarkup(coverageGateInfo, 'matrix-legend')}
      </div>
      <div><span class="dot not-available"></span>Not available</div>
      <div class="legend-hint">Coverage-gate status per (county, T). Hover a cell for the reason; click for the full drill-down.</div>
      ${infoPanelMarkup(coverageGateInfo, 'matrix-legend')}
    `;
  }
}

function openMatrix(fips, opts = {}) {
  state.selectedFips = String(fips);
  switchView('matrix', { push: false });
  // defer to next frame so view is laid out before charts measure width
  requestAnimationFrame(() => renderMatrix(state.selectedFips));
  if (opts.push !== false) pushRoute();
}

function renderMatrix(fips) {
  const d = state.drilldown[fips];
  if (!d) return;
  document.getElementById('mxCounty').textContent = `${d.county}, ${d.state}`;
  document.getElementById('mxMeta').innerHTML =
    `<span class="tierBadge ${d.tier}">${d.tier}</span>` +
    `FIPS ${fips} · ${fmt.num(d.n_events_total)} events over ${(d.observation_years || 0).toFixed(1)} years · ` +
    `${(d.n_per_year || 0).toFixed(1)} events/yr · p50 duration ${d.duration_p50.toFixed(1)}h · p95 ${d.duration_p95.toFixed(1)}h` +
    (d.mcc ? ` · MCC ${fmt.num(d.mcc)}` : '');

  const modeNoteEl = document.getElementById('mxModeNote');
  if (modeNoteEl) {
    const mode = state.matrixView;
    const text = matrixModeNotes[mode] || '';
    const tag = mode === 'customer' ? '<strong>Per-customer (shadow) · </strong>'
              : mode === 'multiplier' ? '<strong>Multiplier · </strong>'
              : '<strong>County trigger · </strong>';
    modeNoteEl.innerHTML = tag + text;
    modeNoteEl.hidden = false;
  }

  const er = +document.getElementById('expenseRatio').value;
  const tm = +document.getElementById('targetMargin').value;
  const kind = document.getElementById('premKind').value;
  const denom = Math.max(1e-6, 1 - er - tm);
  const view = state.matrixView;

  // header row
  const head = document.getElementById('mxHead');
  head.innerHTML = '<th>T \\ X</th>' + X_GRID.map(x => `<th>${fmt.money(x)}</th>`).join('');

  const body = document.getElementById('mxBody');
  body.innerHTML = '';
  for (const T of T_GRID) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<th>${T}h</th>`;
    const cell = d.grid?.[T] ?? null;
    const pcCell = perCustomerCell(fips, T);

    for (const X of X_GRID) {
      const td = document.createElement('td');

      // RED no-quote always wins
      if (!cell || d.tier === 'red') {
        td.className = 'red';
        td.textContent = d.tier === 'red' ? '—' : 'no data';
        tr.appendChild(td);
        continue;
      }

      if (view === 'county') {
        const lam = cell.lambda_T;
        const pure = lam * X;
        const retail = pure / denom;
        const val = kind === 'pure' ? pure : retail;
        td.className = d.tier;
        td.textContent = fmt.money(val);
        td.addEventListener('click', () => openDrilldown(fips, T, X));
      } else if (view === 'customer') {
        const status = pcCell?.coverage_gate_status;
        if (!pcCell || status === 'not_available') {
          td.className = 'not-available';
          td.textContent = '—';
          td.title = pcCell ? gateReasonText(pcCell.coverage_gate_reason) : 'no per-customer view';
        } else {
          const lamCust = pcCell.lambda_customer_mean;
          const pure = lamCust * X;
          const retail = pure / denom;
          const val = kind === 'pure' ? pure : retail;
          td.className = status === 'caution' ? 'caution' : 'shadow';
          td.textContent = fmt.moneyCents(val);
          if (status === 'caution') {
            td.title = `caution · ${gateReasonText(pcCell.coverage_gate_reason)}`;
          }
          td.addEventListener('click', () => openDrilldown(fips, T, X));
        }
      } else if (view === 'multiplier') {
        const status = pcCell?.coverage_gate_status;
        if (!pcCell || status === 'not_available') {
          td.className = 'not-available';
          td.textContent = '—';
          td.title = pcCell ? gateReasonText(pcCell.coverage_gate_reason) : 'no per-customer view';
        } else {
          td.className = status === 'caution' ? 'caution' : 'shadow';
          td.textContent = fmt.pct4(pcCell.multiplier_mean);
          if (status === 'caution') {
            td.title = `caution · ${gateReasonText(pcCell.coverage_gate_reason)}`;
          }
          td.addEventListener('click', () => openDrilldown(fips, T, X));
        }
      }
      tr.appendChild(td);
    }
    body.appendChild(tr);
  }

  renderMatrixLegend();
  syncMatrixViewSeg();

  // defer chart rendering one frame to ensure containers have non-zero width
  requestAnimationFrame(() => {
    renderDurationChart(d);
    renderSurvivalChart(d);
  });
  renderEventEvidence(fips);
  updateCrumbs();
}

function eventEvidenceBasePath() {
  if (state.catalog?.paths?.event_evidence) {
    return state.catalog.paths.event_evidence.replace(/\/$/, '');
  }
  const drillPath = state.catalog?.paths?.drilldown;
  if (drillPath) {
    return drillPath.replace(/county_drilldown\.json$/, 'event_evidence').replace(/\/$/, '');
  }
  return null;
}

function perCustomerViewUrl(catalog) {
  // Derive sibling URL from the catalog's drilldown path. The pipeline mirrors
  // per_customer_view.json into the catalog pricing folder; we never need to
  // touch manifest.json for this.
  const drillPath = catalog?.paths?.drilldown;
  if (!drillPath) return null;
  return drillPath.replace(/county_drilldown\.json$/, 'per_customer_view.json');
}

function perCustomerCell(fips, T) {
  // Returns {lambda_county, multiplier_mean, multiplier_median, multiplier_max,
  //          lambda_customer_mean, ..., coverage_gate_status, coverage_gate_reason}
  // or null if the per-customer view is unavailable or the cell is missing.
  const view = state.perCustomer?.view;
  if (!view) return null;
  const perFips = view[String(fips)];
  if (!perFips) return null;
  return perFips[String(T)] || null;
}

async function loadEventEvidence(fips) {
  const key = `${state.catalogId}:${fips}`;
  if (state.eventEvidenceCache.has(key)) return state.eventEvidenceCache.get(key);

  const base = eventEvidenceBasePath();
  if (!base) return null;

  const resp = await fetch(`${base}/${fips}.json`, { cache: 'no-store' });
  if (!resp.ok) {
    state.eventEvidenceCache.set(key, null);
    return null;
  }
  const data = await resp.json();
  state.eventEvidenceCache.set(key, data);
  return data;
}

function evidenceContract() {
  return {
    T: +document.getElementById('evidenceT').value,
    X: +document.getElementById('evidenceX').value,
    sort: document.getElementById('evidenceSort').value,
    qualifyingOnly: document.getElementById('evidenceQualOnly').checked,
    er: +document.getElementById('expenseRatio').value,
    tm: +document.getElementById('targetMargin').value,
  };
}

function fmtUtc(value) {
  return String(value || '').replace('T', ' ').replace(/:\d{2}(?:\.\d+)?$/, '');
}

function renderEvidenceShell(message) {
  const sub = document.getElementById('eventEvidenceSub');
  const summary = document.getElementById('eventEvidenceSummary');
  const body = document.getElementById('eventEvidenceBody');
  const note = document.getElementById('eventEvidenceNote');
  if (sub) sub.textContent = 'Top historical events for the selected county';
  if (summary) summary.innerHTML = '';
  if (body) body.innerHTML = `<tr><td colspan="8"><div class="evidence-empty">${message}</div></td></tr>`;
  if (note) note.textContent = '';
}

async function renderEventEvidence(fips) {
  const d = state.drilldown[fips];
  if (!d) {
    renderEvidenceShell('Select a county to view event evidence.');
    return;
  }

  renderEvidenceShell('Loading event evidence...');
  const evidence = await loadEventEvidence(fips);
  if (state.selectedFips !== String(fips) || state.view !== 'matrix') return;
  if (!evidence) {
    renderEvidenceShell('Event evidence files are not generated for this catalog yet. Re-run the pricing/catalog pipeline to create per-county evidence JSON.');
    return;
  }

  const { T, X, sort, qualifyingOnly, er, tm } = evidenceContract();
  const denom = Math.max(1e-6, 1 - er - tm);
  const threshold = evidence.threshold_summary?.[String(T)] || {};
  const lam = threshold.lambda_T ?? d.grid?.[T]?.lambda_T ?? 0;
  const qualifyingEvents = threshold.qualifying_events ?? Math.round((d.grid?.[T]?.S_T ?? 0) * d.n_events_total);
  const pure = lam * X;
  const retail = pure / denom;
  const observationYears = evidence.observation_years || d.observation_years || 1;

  const rows = (evidence.events || []).map(event => {
    const qualifies = +event.duration_hours >= T;
    const payout = qualifies ? X : 0;
    return {
      ...event,
      qualifies,
      payout,
      contribution: payout / observationYears,
    };
  }).filter(event => !qualifyingOnly || event.qualifies);

  rows.sort((a, b) => {
    if (sort === 'start_desc') return String(b.start_time_utc).localeCompare(String(a.start_time_utc));
    if (sort === 'max_customers_desc') return (+b.max_customers_out || 0) - (+a.max_customers_out || 0);
    if (sort === 'contribution_desc') return (+b.contribution || 0) - (+a.contribution || 0) || (+b.duration_hours || 0) - (+a.duration_hours || 0);
    return (+b.duration_hours || 0) - (+a.duration_hours || 0);
  });

  const sub = document.getElementById('eventEvidenceSub');
  const summary = document.getElementById('eventEvidenceSummary');
  const body = document.getElementById('eventEvidenceBody');
  const note = document.getElementById('eventEvidenceNote');

  if (sub) {
    sub.textContent = `${evidence.county}, ${evidence.state} · ${evidence.rows_policy.replaceAll('_', ' ')}`;
  }

  if (summary) {
    const sT = threshold.S_T ?? d.grid?.[T]?.S_T ?? 0;
    const kpis = [
      {
        ...evidenceKpis[0],
        value: `${fmt.num(qualifyingEvents)} / ${fmt.num(evidence.n_events_total)}`,
        meta: 'full history',
      },
      {
        ...evidenceKpis[1],
        value: fmt.pct(sT),
        meta: 'qualifying share',
      },
      {
        ...evidenceKpis[2],
        value: `${fmt.num3(lam)} /yr`,
        meta: 'annualized',
      },
      {
        ...evidenceKpis[3],
        value: fmt.moneyCents(pure),
        meta: 'annual',
      },
      {
        ...evidenceKpis[4],
        value: fmt.money(retail),
        meta: 'annual',
      },
    ];
    summary.innerHTML = `
      ${kpis.map(kpi => `
        <div class="evidence-stat">
          <div class="evidence-stat-head">
            <span>${kpi.title}</span>
            ${infoButtonMarkup(kpi, 'evidence-kpi')}
          </div>
          <strong class="evidence-stat-value">${kpi.value}</strong>
          <small>${kpi.meta}</small>
          ${infoPanelMarkup(kpi, 'evidence-kpi')}
        </div>
      `).join('')}
    `;
  }

  if (body) {
    if (!rows.length) {
      body.innerHTML = '<tr><td colspan="8"><div class="evidence-empty">No rows in the compact evidence file match this filter.</div></td></tr>';
    } else {
      body.innerHTML = rows.map(event => `
        <tr class="${event.qualifies ? 'qualifies' : ''}">
          <td>${escapeHtml(fmtUtc(event.start_time_utc))}</td>
          <td>${fmt.num2(+event.duration_hours)}h</td>
          <td>${fmt.num(+event.max_customers_out)}</td>
          <td>${fmt.num1(+event.mean_customers_out)}</td>
          <td>${event.peak_out_pct_mcc == null ? 'n/a' : fmt.pct(+event.peak_out_pct_mcc)}</td>
          <td>${event.qualifies ? 'yes' : 'no'}</td>
          <td>${fmt.money(event.payout)}</td>
          <td>${fmt.moneyCents(event.contribution)}</td>
        </tr>
      `).join('');
    }
  }

  if (note) {
    note.textContent = `Showing ${fmt.num(rows.length)} of ${fmt.num(evidence.rows_returned)} compact evidence rows. Pure contribution is historical payout divided by ${fmt.num2(observationYears)} source years. The table is not the full ${fmt.num(evidence.n_events_total)}-row county event log; the KPIs above use the full county history.`;
  }
}

function renderDurationChart(d) {
  // synthesize a duration histogram from the cumulative S(T) values
  // we know S at T=2,4,8,12,24 → reconstruct event-count buckets
  const totN = d.n_events_total;
  const pts = T_GRID.map(T => ({ T, S: d.grid?.[T]?.S_T ?? 0 }));
  // count above each T
  const aboveCounts = pts.map(p => p.S * totN);
  // buckets defined by consecutive thresholds — use [0,2),[2,4),[4,8),[8,12),[12,24),[24,inf)
  const edges = [0, 2, 4, 8, 12, 24, 96];
  const buckets = edges.slice(0, -1).map((lo, i) => {
    const hi = edges[i + 1];
    let above_lo = lo === 0 ? totN : (aboveCounts[T_GRID.indexOf(lo)] ?? null);
    let above_hi = hi >= 96 ? 0 : (aboveCounts[T_GRID.indexOf(hi)] ?? 0);
    if (above_lo == null) above_lo = totN;
    const count = Math.max(0, above_lo - above_hi);
    return { lo, hi, count, label: hi >= 96 ? `${lo}+` : `${lo}-${hi}` };
  });

  const w = Math.max(320, document.getElementById('durChart').clientWidth || 600);
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const ink = isDark ? '#cdccca' : '#0e1620';
  const muted = isDark ? '#797876' : '#6c7989';

  const plot = Plot.plot({
    width: w,
    height: 220,
    marginLeft: 50,
    marginBottom: 38,
    style: { background: 'transparent', color: ink, fontFamily: 'inherit', fontSize: 11 },
    x: { label: 'Event duration (hours)', tickFormat: d => d, labelAnchor: 'center', tickSize: 0 },
    y: { label: '# events', grid: true, tickFormat: '~s' },
    marks: [
      Plot.barY(buckets, {
        x: 'label',
        y: 'count',
        fill: tierColors[d.tier] ? tierColors[d.tier]() : tierColors.grey(),
        fillOpacity: 0.85,
        title: dd => `${dd.label}h · ${fmt.num(Math.round(dd.count))} events`,
        sort: { x: null },
      }),
      Plot.ruleY([0], { stroke: muted }),
    ],
  });
  const c = document.getElementById('durChart');
  c.innerHTML = '';
  c.appendChild(plot);
}

function renderSurvivalChart(d) {
  const pts = T_GRID.map(T => ({ T, S: d.grid?.[T]?.S_T ?? 0 }));
  const w = Math.max(280, document.getElementById('survChart').clientWidth || 380);
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const ink = isDark ? '#cdccca' : '#0e1620';
  const muted = isDark ? '#797876' : '#6c7989';
  const accent = isDark ? '#4fb3bf' : '#0b6e74';

  const plot = Plot.plot({
    width: w,
    height: 220,
    marginLeft: 56,
    marginBottom: 38,
    style: { background: 'transparent', color: ink, fontFamily: 'inherit', fontSize: 11 },
    x: { label: 'Deductible T (hours)', tickFormat: d => d, domain: [0, 28] },
    y: { label: 'S(T) = P(duration ≥ T)', tickFormat: '.0%', grid: true, domain: [0, 1] },
    marks: [
      Plot.areaY(pts, { x: 'T', y: 'S', fill: accent, fillOpacity: 0.12, curve: 'monotone-x' }),
      Plot.lineY(pts, { x: 'T', y: 'S', stroke: accent, strokeWidth: 2, curve: 'monotone-x' }),
      Plot.dot(pts, { x: 'T', y: 'S', fill: accent, stroke: 'white', strokeWidth: 1.5, r: 4 }),
      Plot.text(pts, { x: 'T', y: 'S', text: dd => fmt.pct(dd.S), dy: -10, fontSize: 11, fill: ink }),
      Plot.ruleY([0], { stroke: muted }),
    ],
  });
  const c = document.getElementById('survChart');
  c.innerHTML = '';
  c.appendChild(plot);
}

// ============ DRILL-DOWN ============
function openDrilldown(fips, T, X, opts = {}) {
  const d = state.drilldown[fips];
  if (!d) return;
  const er = +document.getElementById('expenseRatio').value;
  const tm = +document.getElementById('targetMargin').value;
  const denom = Math.max(1e-6, 1 - er - tm);
  const cell = d.grid[T];
  const lam = cell.lambda_T;
  const sT = cell.S_T;
  const pure = lam * X;
  const retail = pure / denom;

  // Per-customer view for this (FIPS, T) cell. Always look up; may be null
  // if curated view is unavailable for this catalog.
  const pcCell = perCustomerCell(fips, T);
  const gateStatus = pcCell?.coverage_gate_status;
  const gateClass = gateStatus ? gateClassName(gateStatus) : null;

  // Panel A
  const gateChip = gateClass
    ? `<span class="gateBadge ${gateClass}">${gateStatus.replace('_', ' ')}</span>`
    : '';
  document.getElementById('panelA').innerHTML = `
    <dt>County</dt><dd>${d.county}, ${d.state} <span class="muted">· FIPS ${fips}</span></dd>
    <dt>Tier</dt><dd><span class="tierBadge ${d.tier}">${d.tier}</span> ${d.quotable ? 'quotable' : 'not quotable'}</dd>
    <dt>Per-customer gate</dt><dd>${gateChip || '<span class="muted">unavailable for this catalog</span>'}${pcCell?.coverage_gate_reason ? `<span class="muted">${gateReasonText(pcCell.coverage_gate_reason)}</span>` : ''}</dd>
    <dt>Deductible T</dt><dd>${T} hours</dd>
    <dt>Payout X</dt><dd>${fmt.money(X)}</dd>
    <dt>Expense ratio</dt><dd>${(er*100).toFixed(0)}%</dd>
    <dt>Target margin</dt><dd>${(tm*100).toFixed(0)}%</dd>
  `;

  // Panel B
  const qual = Math.round(sT * d.n_events_total);
  const multBlock = (pcCell && gateStatus !== 'not_available')
    ? `<dt>Cust. impact multiplier · mean</dt><dd>${fmt.pct4(pcCell.multiplier_mean)} <span class="muted">· median ${fmt.pct4(pcCell.multiplier_median)} · max ${fmt.pct4(pcCell.multiplier_max)}</span></dd>`
    : '';
  document.getElementById('panelB').innerHTML = `
    <dt>Historical events</dt><dd>${fmt.num(d.n_events_total)}</dd>
    <dt>Observation window</dt><dd>${(d.observation_years||0).toFixed(1)} years</dd>
    <dt>Modeled customers</dt><dd>${d.mcc ? fmt.num(d.mcc) : '—'}</dd>
    <dt>Annual event rate</dt><dd>${(d.n_per_year||0).toFixed(2)} /yr</dd>
    <dt>S(T=${T}h)</dt><dd>${fmt.pct(sT)}</dd>
    <dt>Qualifying events</dt><dd>${fmt.num(qual)}</dd>
    <dt>Duration p50 / p95</dt><dd>${d.duration_p50.toFixed(1)}h · ${d.duration_p95.toFixed(1)}h</dd>
    <dt>Duration max</dt><dd>${d.duration_max.toFixed(1)}h</dd>
    ${multBlock}
  `;

  // Panel C — premium chain. v0 chain on top, per-customer (shadow) below.
  // Every dollar value carries an explicit "/ yr" unit so the annual nature
  // of the number is unambiguous at every step (intermediate AND total).
  const v0Chain = `
    <div class="chain-row">
      <span class="label">λ(T=${T}h) = N/yr × S(T)</span>
      <span class="op">${(d.n_per_year||0).toFixed(2)} × ${fmt.pct(sT)}</span>
      <span class="val">${lam.toFixed(4)} / yr</span>
    </div>
    <div class="chain-row">
      <span class="label">Pure premium = λ(T) × X</span>
      <span class="op">${lam.toFixed(4)} × ${fmt.money(X)}</span>
      <span class="val">${fmt.moneyCents(pure)} / yr</span>
    </div>
    <div class="chain-row">
      <span class="label">+ Uncertainty load (v0 stub)</span>
      <span class="op">+</span>
      <span class="val">${fmt.moneyCents(0)} / yr</span>
    </div>
    <div class="chain-row">
      <span class="label">÷ (1 − expense − margin)</span>
      <span class="op">÷ ${denom.toFixed(2)}</span>
      <span class="val">${fmt.moneyCents(pure / denom)} / yr</span>
    </div>
    <div class="chain-row total">
      <span class="label">Retail annual premium · v0 county trigger</span>
      <span class="op"></span>
      <span class="val">${fmt.money(retail)} / yr</span>
    </div>
  `;

  let shadowSection = '';
  if (!pcCell) {
    shadowSection = `
      <div class="chain-section">
        <div class="chain-section-title"><span>Per-customer view (shadow)</span></div>
        <div class="chain-empty">Per-customer view not loaded for this catalog. Re-run <code>curated_outage_data/pipelines/per_customer_rate/compute_per_customer_lambda.py</code> to regenerate.</div>
      </div>
    `;
  } else if (gateStatus === 'not_available') {
    shadowSection = `
      <div class="chain-section">
        <div class="chain-section-title">
          <span>Per-customer view (shadow)</span>
          <span class="gateBadge not-available">not available</span>
        </div>
        <div class="chain-empty">No per-customer estimate for this (county, T). Reason: <strong>${gateReasonText(pcCell.coverage_gate_reason)}</strong>.</div>
      </div>
    `;
  } else {
    const m = pcCell.multiplier_mean;
    const lamCust = pcCell.lambda_customer_mean;
    const pureCust = lamCust * X;
    const retailCust = pureCust / denom;
    const lamCustMedian = pcCell.lambda_customer_median;
    const retailMedian = (lamCustMedian * X) / denom;
    const lamCustMax = pcCell.lambda_customer_max;
    const retailMax = (lamCustMax * X) / denom;
    shadowSection = `
      <div class="chain-section">
        <div class="chain-section-title">
          <span>Per-customer view (shadow)</span>
          <span class="gateBadge ${gateClass}">${gateStatus.replace('_', ' ')}</span>
        </div>
        <div class="chain-section-note">Headline: mean of <code>mean_customers / MCC</code> over qualifying events. Not used in v0 pricing. ${gateStatus === 'caution' ? `<strong>Caution:</strong> ${gateReasonText(pcCell.coverage_gate_reason)}.` : ''}</div>
        <div class="chain-row shadow">
          <span class="label">customer-impact multiplier · mean</span>
          <span class="op">E[mean_cust / MCC | dur ≥ T]</span>
          <span class="val">${fmt.pct4(m)}</span>
        </div>
        <div class="chain-row shadow">
          <span class="label">λ<sub>customer</sub>(T) = λ<sub>county</sub> × mult</span>
          <span class="op">${lam.toFixed(4)} × ${fmt.pct4(m)}</span>
          <span class="val">${lamCust.toFixed(6)} / yr</span>
        </div>
        <div class="chain-row shadow">
          <span class="label">Pure (per-customer)</span>
          <span class="op">${lamCust.toFixed(6)} × ${fmt.money(X)}</span>
          <span class="val">${fmt.moneyCents(pureCust)} / yr</span>
        </div>
        <div class="chain-row shadow">
          <span class="label">÷ (1 − expense − margin)</span>
          <span class="op">÷ ${denom.toFixed(2)}</span>
          <span class="val">${fmt.moneyCents(retailCust)} / yr</span>
        </div>
        <div class="chain-row total shadow">
          <span class="label">Retail · per-customer (shadow)</span>
          <span class="op"></span>
          <span class="val">${fmt.moneyCents(retailCust)} / yr</span>
        </div>
        <div class="chain-section-note">Sensitivity at this X: median estimator → ${fmt.moneyCents(retailMedian)} / yr · max estimator → ${fmt.moneyCents(retailMax)} / yr.</div>
      </div>
    `;
  }
  document.getElementById('panelC').innerHTML = v0Chain + shadowSection;

  // Panel D
  const tierRow = state.tiers.get(fips);
  if (tierRow) {
    const diag = (label, detail, cls, dimKey) => {
      const dim = modelabilityDims.find(d => d.key === dimKey);
      return `
      <li class="${cls}">
        <span class="check-icon">${cls === 'pass' ? '✓' : cls === 'warn' ? '!' : '✗'}</span>
        <span>
          <div class="d-label-row">
            <div class="d-label">${label}</div>
            ${dim ? infoButtonMarkup(dim, `diag-${fips}`) : ''}
          </div>
          <div class="d-detail">${detail}</div>
          ${dim ? infoPanelMarkup(dim, `diag-${fips}`) : ''}
        </span>
        <span class="tierBadge ${tierClassFromStr(cls)}">${tierFromCls(cls)}</span>
      </li>
    `;
    };
    const m = (v) => v === 'green' ? 'pass' : v === 'amber' ? 'warn' : 'fail';
    document.getElementById('panelD').innerHTML = [
      diag('D1 · Volume',         `${fmt.num(+tierRow.n_events_total)} events`,                m(tierRow.d1_volume), 'd1'),
      diag('D2 · Events / year',  `${(+tierRow.n_per_year).toFixed(1)} events/yr`,             m(tierRow.d2_per_year), 'd2'),
      diag('D3 · Window',         `${(+tierRow.observation_years).toFixed(1)} source years`, m(tierRow.d3_obs_years), 'd3'),
      diag('D4 · Tail (p95)',     `${(+tierRow.duration_p95).toFixed(1)}h`,                    m(tierRow.d4_tail), 'd4'),
      diag('D5 · DQI',            tierRow.dqi ? (+tierRow.dqi).toFixed(2) : 'n/a',             m(tierRow.d5_dqi), 'd5'),
    ].join('');
  } else {
    document.getElementById('panelD').innerHTML = '<li class="warn"><span></span><span><div class="d-label">No tier diagnostics</div></span><span></span></li>';
  }

  // mark that drill-down has data so future switchView calls show the grid
  if (state.drilldown[fips]) state.drilldown[fips].lastCell = { T, X };
  switchView('drilldown', { push: false });
  if (opts.push !== false) pushRoute();
}
function tierFromCls(c) { return c === 'pass' ? 'green' : c === 'warn' ? 'amber' : 'red'; }
function tierClassFromStr(c) { return tierFromCls(c); }

// ============ ONBOARDING WIRES ============
function wireOnboarding() {
  const dismiss = document.getElementById('introDismiss');
  if (dismiss) {
    dismiss.addEventListener('click', () => {
      const banner = document.getElementById('introBanner');
      if (banner) banner.style.display = 'none';
    });
  }
  const searchBtn = document.getElementById('emptyMatrixFocusSearch');
  if (searchBtn) {
    searchBtn.addEventListener('click', () => {
      switchView('map');
      const s = document.getElementById('search');
      if (s) { s.focus(); s.select(); }
    });
  }
  // [data-jump] inside empty-states
  document.querySelectorAll('.empty-state [data-jump]').forEach(b => {
    b.addEventListener('click', () => switchView(b.dataset.jump));
  });
}

// ============ METHODOLOGY LIBRARY ============
// Live reader of docs/methodology/ files inside the dashboard. The folder
// is the source of truth; the library is just a presentation layer over
// it. Vendored marked.min.js (no CDN) renders the markdown.

const LIBRARY_SECTIONS = {
  'overview': {
    title: 'What\'s in this library',
    path: null,           // hand-rendered welcome page
  },
  'roadmap': {
    title: 'Forward-looking roadmap',
    path: './methodology/roadmap.md',
  },
  'per-customer-walkthrough': {
    title: 'Per-customer view — end-to-end',
    path: './methodology/per_customer_view_walkthrough.md',
  },
  'data-ingestion': {
    title: 'Data ingestion',
    path: './methodology/data_ingestion_methodology.md',
  },
  'event-catalog': {
    title: 'Event catalog creation',
    path: './methodology/event_catalog_creation_methodology.md',
  },
  'aggregation': {
    title: 'Aggregation & annualization',
    path: './methodology/aggregation_and_annualization_methodology.md',
  },
  'filtration': {
    title: 'Filtration',
    path: './methodology/filtration_methodology.md',
  },
  'pricing': {
    title: 'Pricing',
    path: './methodology/pricing_methodology.md',
  },
  'assumptions': {
    title: 'Assumptions registry',
    path: './methodology/assumptions.md',
  },
};

const libraryState = {
  current: 'overview',
  cache: new Map(),    // section_key -> rendered HTML
  open: false,
};

function openLibrary() {
  const drawer = document.getElementById('libraryDrawer');
  const backdrop = document.getElementById('libraryBackdrop');
  if (!drawer || !backdrop) return;
  backdrop.hidden = false;
  // next frame so the hidden->visible transition can run
  requestAnimationFrame(() => {
    backdrop.classList.add('open');
    drawer.classList.add('open');
    drawer.setAttribute('aria-hidden', 'false');
    libraryState.open = true;
    if (!libraryState.cache.has(libraryState.current)) {
      navigateLibrary(libraryState.current);
    }
  });
}

function closeLibrary() {
  const drawer = document.getElementById('libraryDrawer');
  const backdrop = document.getElementById('libraryBackdrop');
  if (!drawer || !backdrop) return;
  backdrop.classList.remove('open');
  drawer.classList.remove('open');
  drawer.setAttribute('aria-hidden', 'true');
  libraryState.open = false;
  setTimeout(() => { backdrop.hidden = true; }, 220);
}

function toggleLibraryExpand() {
  const drawer = document.getElementById('libraryDrawer');
  if (!drawer) return;
  drawer.classList.toggle('expanded');
}

function setLibraryTitle(text) {
  const t = document.getElementById('libraryTitle');
  if (t) t.textContent = text;
}

function renderLibraryOverview() {
  const sections = [
    { key: 'roadmap', meta: 'What\'s next', desc: 'Forward-looking tracks organized by bias-correction vs forward-regime. Status, why it matters, what unlocks each one.' },
    { key: 'per-customer-walkthrough', meta: 'Walkthrough', desc: 'End-to-end nuance-by-nuance walk through the per-customer shadow rate, with a worked Boone, MO example.' },
    { key: 'pricing', meta: 'Pipeline · pricing', desc: 'The v0 pricing math (λ(T) → Pure → Retail) plus the per-customer view evidence.' },
    { key: 'event-catalog', meta: 'Pipeline · events', desc: 'The event-construction algorithm (three knobs: threshold / gap tolerance / minimum duration).' },
    { key: 'aggregation', meta: 'Pipeline · rate', desc: 'How per-event records roll up to per-county summaries and how the annualization denominator is defined.' },
    { key: 'filtration', meta: 'Pipeline · tiers', desc: 'The five-gate Green / Amber / Red modelability classification (D1 through D5).' },
    { key: 'data-ingestion', meta: 'Pipeline · sources', desc: 'How raw EAGLE-I data is acquired, and what sources we deliberately do not use as the base layer.' },
    { key: 'assumptions', meta: 'Cross-cutting', desc: 'Stable-ID registry of every explicit assumption (A001–A010). Cite by ID; never restate.' },
  ];
  const cardsHtml = sections.map(s => `
    <button type="button" class="welcome-card" data-section="${s.key}">
      <div class="welcome-card-meta">${escapeHtml(s.meta)}</div>
      <div class="welcome-card-title">${escapeHtml(LIBRARY_SECTIONS[s.key]?.title || s.key)}</div>
      <div class="welcome-card-desc">${escapeHtml(s.desc)}</div>
    </button>
  `).join('');
  return `
    <div class="library-welcome">
      <h1>Methodology library</h1>
      <p>
        A reading surface over the project's <code>docs/methodology/</code> folder.
        Use the left nav to jump between pipeline-step methodology files,
        walkthroughs, and the assumptions registry.
      </p>
      <p>
        The folder is the source of truth — this library renders it live.
        Any edit to a methodology file on disk shows up here on the next
        section load.
      </p>
      <div class="welcome-grid">${cardsHtml}</div>
    </div>
  `;
}

function rewriteLibraryMarkdownLinks(html) {
  // Methodology markdown uses relative paths like
  //   [A001](assumptions.md#a001--...)
  //   [walkthrough](per_customer_view_walkthrough.md)
  //   [plan](../plan/per_customer_pricing_plan.md)
  // For in-library links to other methodology files we want to navigate
  // inside the library; everything else opens in a new tab.
  const filenameToSection = {
    'assumptions.md': 'assumptions',
    'pricing_methodology.md': 'pricing',
    'event_catalog_creation_methodology.md': 'event-catalog',
    'aggregation_and_annualization_methodology.md': 'aggregation',
    'filtration_methodology.md': 'filtration',
    'data_ingestion_methodology.md': 'data-ingestion',
    'per_customer_view_walkthrough.md': 'per-customer-walkthrough',
    'roadmap.md': 'roadmap',
  };
  return html.replace(/<a\s+href="([^"]+)"([^>]*)>/g, (match, href, attrs) => {
    if (/^https?:/i.test(href)) {
      return `<a href="${href}"${attrs} target="_blank" rel="noopener">`;
    }
    // Strip optional ./ and any leading ../methodology/ prefix
    const fileMatch = href.match(/([a-z_]+\.md)(#.*)?$/i);
    if (fileMatch && filenameToSection[fileMatch[1]]) {
      const section = filenameToSection[fileMatch[1]];
      const hash = fileMatch[2] || '';
      return `<a href="#" data-library-section="${section}" data-library-hash="${hash}"${attrs}>`;
    }
    // Plan files etc. — link out (won't resolve inside library)
    return `<a href="${href}"${attrs} target="_blank" rel="noopener">`;
  });
}

async function navigateLibrary(sectionKey) {
  const config = LIBRARY_SECTIONS[sectionKey];
  if (!config) return;
  libraryState.current = sectionKey;

  // Highlight the nav item
  document.querySelectorAll('.library-nav-item').forEach(b => {
    b.classList.toggle('current', b.dataset.section === sectionKey);
  });
  setLibraryTitle(config.title);

  const content = document.getElementById('libraryContent');
  if (!content) return;

  // Overview is hand-rendered
  if (sectionKey === 'overview' || !config.path) {
    content.innerHTML = renderLibraryOverview();
    content.scrollTop = 0;
    return;
  }

  // Cache hit
  if (libraryState.cache.has(sectionKey)) {
    content.innerHTML = libraryState.cache.get(sectionKey);
    content.scrollTop = 0;
    return;
  }

  content.innerHTML = '<div class="library-loading">Loading…</div>';
  try {
    const resp = await fetch(config.path, { cache: 'no-store' });
    if (!resp.ok) throw new Error(`${resp.status} ${resp.statusText}`);
    const md = await resp.text();
    if (typeof marked === 'undefined') {
      throw new Error('Markdown renderer (marked.min.js) failed to load.');
    }
    let html = marked.parse(md, { gfm: true, breaks: false });
    html = rewriteLibraryMarkdownLinks(html);
    libraryState.cache.set(sectionKey, html);
    content.innerHTML = html;
    content.scrollTop = 0;
  } catch (err) {
    console.error('library load failed:', err);
    content.innerHTML = `<div class="library-error">Could not load this section: ${escapeHtml(err.message)}</div>`;
  }
}

// ============ SIDEBAR · WHAT'S NEXT WIDGET ============
// Compact roadmap surface in the sidebar. Mirrors docs/methodology/roadmap.md
// at-a-glance. Click any item to open the library at the full roadmap.
//
// Statuses shown here MUST stay in sync with the roadmap.md doc — if a track
// status changes there, change it here too. The library section is the long
// form; this is the glanceable summary.

const ROADMAP_ITEMS = [
  {
    name: 'Per-customer rate',
    status: 'shadow',
    desc: 'Bias-correction · live in dashboard',
  },
  {
    name: 'Customer-impact graduation',
    status: 'next',
    desc: 'Bias-correction · post-deploy review + Phase 4 validation',
  },
  {
    name: 'Trigger source alignment',
    status: 'blocked',
    desc: 'Bias-correction · blocked on vendor data',
  },
  {
    name: 'Location basis',
    status: 'research',
    desc: 'Bias-correction · per-premise vs county',
  },
  {
    name: 'Grid condition',
    status: 'planned',
    desc: 'Forward-regime · utility reliability + capex',
  },
  {
    name: 'Hazard & weather',
    status: 'planned',
    desc: 'Forward-regime · storm regime + climate',
  },
];

function renderRoadmapList() {
  const list = document.getElementById('roadmapList');
  if (!list) return;
  list.innerHTML = ROADMAP_ITEMS.map(item => `
    <button type="button" class="roadmap-item" data-library-section="roadmap" title="Open in library">
      <span class="roadmap-status ${item.status}">${escapeHtml(item.status)}</span>
      <div class="roadmap-item-body">
        <div class="roadmap-name">${escapeHtml(item.name)}</div>
        <div class="roadmap-desc">${escapeHtml(item.desc)}</div>
      </div>
    </button>
  `).join('');
}

function wireLibrary() {
  const trigger = document.getElementById('libraryBtn');
  if (trigger) trigger.addEventListener('click', openLibrary);

  const closeBtn = document.getElementById('libraryCloseBtn');
  if (closeBtn) closeBtn.addEventListener('click', closeLibrary);

  const expandBtn = document.getElementById('libraryExpandBtn');
  if (expandBtn) expandBtn.addEventListener('click', toggleLibraryExpand);

  const backdrop = document.getElementById('libraryBackdrop');
  if (backdrop) backdrop.addEventListener('click', closeLibrary);

  // Section nav (delegated so clicks on the welcome-card buttons, sidebar
  // roadmap items, and inline library-deep-link buttons all work).
  document.addEventListener('click', (e) => {
    // 1. In-library nav items and welcome cards
    const navBtn = e.target.closest('.library-nav-item, .welcome-card');
    if (navBtn && navBtn.dataset.section) {
      e.preventDefault();
      navigateLibrary(navBtn.dataset.section);
      return;
    }
    // 2. Buttons / links anywhere in the dashboard that point at a library
    //    section via data-library-section (sidebar widget, eye-button "Read
    //    more" links, "view all" buttons, etc.).
    const deepLink = e.target.closest('[data-library-section]');
    if (deepLink) {
      e.preventDefault();
      e.stopPropagation();
      const section = deepLink.dataset.librarySection;
      if (!libraryState.open) openLibrary();
      navigateLibrary(section);
      return;
    }
    // 3. Rewritten <a data-library-section> inside rendered markdown
    const linkBtn = e.target.closest('a[data-library-section]');
    if (linkBtn) {
      e.preventDefault();
      navigateLibrary(linkBtn.dataset.librarySection);
      const hash = linkBtn.dataset.libraryHash;
      if (hash) {
        requestAnimationFrame(() => {
          const target = document.querySelector(`#libraryContent ${hash.replace('#', '#')}`);
          if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      }
    }
  });

  // ESC closes
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && libraryState.open) closeLibrary();
  });
}

// ============ GO ============
boot();
wireOnboarding();
wireLibrary();
renderRoadmapList();
