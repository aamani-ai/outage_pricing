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
};

const fmt = {
  money: d3.format('$,.0f'),
  moneyCents: d3.format('$,.2f'),
  pct: d3.format('.2%'),
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
  wireTabs();
  wireMatrixControls();
  wireSearch();
  wireLegendInfo();
  wireBackNav();
  await initMap();
  await initRouting();
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

  const [drillResp, tiersResp] = await Promise.all([
    fetch(catalog.paths.drilldown, { cache: 'no-store' }),
    fetch(catalog.paths.tiers, { cache: 'no-store' }),
  ]);
  if (!drillResp.ok) throw new Error(`${catalog.label}: county_drilldown.json missing — build catalogs`);
  if (!tiersResp.ok) throw new Error(`${catalog.label}: county_tiers.csv missing — build catalogs`);

  state.catalogId = catalog.id;
  state.catalog = catalog;
  state.drilldown = await drillResp.json();
  state.tiers = parseCsv(await tiersResp.text());

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
  return { color: tierColors.grey(), tier: 'grey' };
}

// sequential color ramps (interpolated)
const lambdaScale = d3.scaleSequential(d3.interpolateYlOrRd).domain([0, 50]).clamp(true);
const premiumScale = d3.scaleSequentialLog(d3.interpolateYlOrRd).domain([500, 50000]).clamp(true);

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
    el.innerHTML = `<span>0</span><div class="ramp" style="background:linear-gradient(to right,${stops.join(',')})"></div><span>50+/yr</span>`;
  } else {
    const stops = [500, 2500, 10000, 25000, 50000].map(v => premiumScale(v));
    el.innerHTML = `<span>$500</span><div class="ramp" style="background:linear-gradient(to right,${stops.join(',')})"></div><span>$50k+</span>`;
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
  pop.addEventListener('click', event => event.stopPropagation());
  window.addEventListener('resize', positionPopover);
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

  const refresh = () => {
    erVal.textContent = (+er.value * 100).toFixed(0) + '%';
    tmVal.textContent = (+tm.value * 100).toFixed(0) + '%';
    if (state.selectedFips) renderMatrix(state.selectedFips);
  };
  er.addEventListener('input', refresh);
  tm.addEventListener('input', refresh);
  kind.addEventListener('change', refresh);
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

  const er = +document.getElementById('expenseRatio').value;
  const tm = +document.getElementById('targetMargin').value;
  const kind = document.getElementById('premKind').value;
  const denom = Math.max(1e-6, 1 - er - tm);

  // header row
  const head = document.getElementById('mxHead');
  head.innerHTML = '<th>T \\ X</th>' + X_GRID.map(x => `<th>${fmt.money(x)}</th>`).join('');

  const body = document.getElementById('mxBody');
  body.innerHTML = '';
  for (const T of T_GRID) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<th>${T}h</th>`;
    const cell = d.grid?.[T] ?? null;
    for (const X of X_GRID) {
      const td = document.createElement('td');
      if (!cell || d.tier === 'red') {
        td.className = 'red';
        td.textContent = d.tier === 'red' ? '—' : 'no data';
      } else {
        const lam = cell.lambda_T;
        const pure = lam * X;
        const retail = pure / denom;
        const val = kind === 'pure' ? pure : retail;
        td.className = d.tier;
        td.textContent = fmt.money(val);
        td.addEventListener('click', () => openDrilldown(fips, T, X));
      }
      tr.appendChild(td);
    }
    body.appendChild(tr);
  }

  // defer chart rendering one frame to ensure containers have non-zero width
  requestAnimationFrame(() => {
    renderDurationChart(d);
    renderSurvivalChart(d);
  });
  updateCrumbs();
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

  // Panel A
  document.getElementById('panelA').innerHTML = `
    <dt>County</dt><dd>${d.county}, ${d.state} <span class="muted">· FIPS ${fips}</span></dd>
    <dt>Tier</dt><dd><span class="tierBadge ${d.tier}">${d.tier}</span> ${d.quotable ? 'quotable' : 'not quotable'}</dd>
    <dt>Deductible T</dt><dd>${T} hours</dd>
    <dt>Payout X</dt><dd>${fmt.money(X)}</dd>
    <dt>Expense ratio</dt><dd>${(er*100).toFixed(0)}%</dd>
    <dt>Target margin</dt><dd>${(tm*100).toFixed(0)}%</dd>
  `;

  // Panel B
  const qual = Math.round(sT * d.n_events_total);
  document.getElementById('panelB').innerHTML = `
    <dt>Historical events</dt><dd>${fmt.num(d.n_events_total)}</dd>
    <dt>Observation window</dt><dd>${(d.observation_years||0).toFixed(1)} years</dd>
    <dt>Modeled customers</dt><dd>${d.mcc ? fmt.num(d.mcc) : '—'}</dd>
    <dt>Annual event rate</dt><dd>${(d.n_per_year||0).toFixed(2)} /yr</dd>
    <dt>S(T=${T}h)</dt><dd>${fmt.pct(sT)}</dd>
    <dt>Qualifying events</dt><dd>${fmt.num(qual)}</dd>
    <dt>Duration p50 / p95</dt><dd>${d.duration_p50.toFixed(1)}h · ${d.duration_p95.toFixed(1)}h</dd>
    <dt>Duration max</dt><dd>${d.duration_max.toFixed(1)}h</dd>
  `;

  // Panel C — premium chain
  document.getElementById('panelC').innerHTML = `
    <div class="chain-row">
      <span class="label">λ(T=${T}h) = N/yr × S(T)</span>
      <span class="op">${(d.n_per_year||0).toFixed(2)} × ${fmt.pct(sT)}</span>
      <span class="val">${lam.toFixed(4)} /yr</span>
    </div>
    <div class="chain-row">
      <span class="label">Pure premium = λ(T) × X</span>
      <span class="op">${lam.toFixed(4)} × ${fmt.money(X)}</span>
      <span class="val">${fmt.moneyCents(pure)}</span>
    </div>
    <div class="chain-row">
      <span class="label">+ Uncertainty load (v0 stub)</span>
      <span class="op">+</span>
      <span class="val">${fmt.moneyCents(0)}</span>
    </div>
    <div class="chain-row">
      <span class="label">÷ (1 − expense − margin)</span>
      <span class="op">÷ ${denom.toFixed(2)}</span>
      <span class="val">${fmt.moneyCents(pure / denom)}</span>
    </div>
    <div class="chain-row total">
      <span class="label">Retail annual premium</span>
      <span class="op"></span>
      <span class="val">${fmt.money(retail)}</span>
    </div>
  `;

  // Panel D
  const tierRow = state.tiers.get(fips);
  if (tierRow) {
    const diag = (label, detail, cls) => `
      <li class="${cls}">
        <span class="check-icon">${cls === 'pass' ? '✓' : cls === 'warn' ? '!' : '✗'}</span>
        <span>
          <div class="d-label">${label}</div>
          <div class="d-detail">${detail}</div>
        </span>
        <span class="tierBadge ${tierClassFromStr(cls)}">${tierFromCls(cls)}</span>
      </li>
    `;
    const m = (v) => v === 'green' ? 'pass' : v === 'amber' ? 'warn' : 'fail';
    document.getElementById('panelD').innerHTML = [
      diag('D1 · Volume',         `${fmt.num(+tierRow.n_events_total)} events`,                m(tierRow.d1_volume)),
      diag('D2 · Events / year',  `${(+tierRow.n_per_year).toFixed(1)} events/yr`,             m(tierRow.d2_per_year)),
      diag('D3 · Window',         `${(+tierRow.observation_years).toFixed(1)} source years`, m(tierRow.d3_obs_years)),
      diag('D4 · Tail (p95)',     `${(+tierRow.duration_p95).toFixed(1)}h`,                    m(tierRow.d4_tail)),
      diag('D5 · DQI',            tierRow.dqi ? (+tierRow.dqi).toFixed(2) : 'n/a',             m(tierRow.d5_dqi)),
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

// ============ GO ============
boot();
wireOnboarding();
