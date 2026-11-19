// The 3D map (Map → 3D map): satellite, terrain and buildings, territory counts that open into offices,
// and a tilted view of the office you pick. It runs in an iframe on the CRM page; the CRM hands it the
// accounts (with their territory), today's route and callbacks for Log drop, Route, Open and planning.
import { esc, icon, prepareZones, zoomTo } from './core.js';
import { createRenderer } from './renderer.js';

const TYPE_LABEL = { prospect: 'Prospect', client: 'Client', partner: 'Partner' };

export async function mountAtlas(root, options) {
  let zones = []; let zoneByN = new Map();
  let recs = []; let byId = new Map(); let route = []; let todayLabel = '';
  let tab = 'accounts'; let sel = ''; let area = null; let q = ''; let type = 'all'; let reserve = false;
  let expanded = false; let layer = false; let map = null; let dead = false; let markerFrame = 0; let toastTimer = 0;
  const $ = (s) => root.querySelector(s);
  const btn = (act, title, ic, txt = '', cls = '') => `<button type="button" class="${cls}" data-a="${act}" title="${esc(title)}" aria-label="${esc(title)}">${ic ? icon(ic) : ''}${txt}</button>`;

  function update(data) {
    if (data.zones) { zones = prepareZones(data.zones); zoneByN = new Map(zones.map((z) => [z.n, z])); }
    recs = (data.accounts || []).map((a) => ({ ...a, z: zoneByN.get(a.terr) || null }));
    byId = new Map(recs.map((a) => [a.id, a]));
    route = [...new Set(data.route || [])].filter((id) => byId.has(id));
    todayLabel = data.todayLabel || 'Today';
    if (!byId.has(sel)) sel = '';
  }
  update(options.data);

  root.innerHTML = `<main class="shell"><div class="work"><aside class="side">
      <div class="sidehead"><h1>Southern California</h1><div class="tabs" role="tablist" aria-label="Lists">
        ${[['accounts', 'Accounts'], ['route', 'Today'], ['territories', 'Territories']].map(([k, l]) => `<button type="button" data-tab="${k}">${l}</button>`).join('')}
      </div></div>
      <div class="filters"><label class="search">${icon('search', 16)}<input id="find" type="search" aria-label="Search the map" placeholder="Search accounts or cities"></label><div class="chips"></div></div>
      <div class="listtitle"></div><div class="rows"></div><div class="sidefoot"></div>
    </aside>
    <div class="mapframe"><div class="basemap" role="region" aria-label="Southern California satellite map"></div><div class="pins"></div>
      <div class="mapbar"><div class="mapmode">${btn('2d', 'Flat, from overhead', '', '2D')}${btn('3d', 'Tilted, with hills and buildings', 'box', '3D')}</div>
        <div class="maptools">${btn('near', 'Near me', 'locate', '<span class="neartext">Near me</span>')}${btn('layers', 'Territory outlines', 'zones')}</div></div>
      <div class="zoomtools">${btn('fit', 'Fit Southern California', 'fit')}${btn('plus', 'Zoom in', 'plus', '', 'zbtn')}${btn('minus', 'Zoom out', 'minus', '', 'zbtn')}${btn('north', 'Face north', 'compass', '', 'zbtn')}</div>
      <div class="legend"><span><i class="shape"></i>Prospect</span><span><i class="shape client"></i>Client</span><span><i class="shape partner"></i>Partner</span><span><i class="shape renew"></i>Renewing ≤ 90 d</span></div>
      <div class="cardwrap"></div><div class="status" hidden role="status"></div>
    </div>
    <button type="button" class="sheetbutton" data-a="sheet"></button></div></main>`;
  const work = $('.mapframe'); const pins = $('.pins');
  const showStatus = (s) => { const el = $('.status'); el.hidden = false; el.textContent = s; clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.hidden = true; }, 3700); };
  const fitTo = (points, pad = 90) => zoomTo(points, work.clientWidth, work.clientHeight, pad);
  const cameraFor = (z) => fitTo([[z.box[0], z.box[1]], [z.box[2], z.box[3]]], 80);
  const zoneName = (a) => (a.z ? a.z.name : 'No territory');
  const matches = () => recs.filter((a) => (reserve || !a.reserve) && (type === 'all' || a.type === type)
    && (!q || `${a.name} ${a.city} ${zoneName(a)}`.toLowerCase().includes(q.toLowerCase()))
    && (!area || (a.z && a.z.n === area.n)));
  async function storeRoute(ids) {
    const cleaned = [...new Set(ids)].filter((id) => byId.has(id));
    if (options.onRoute) await options.onRoute(cleaned, route);
    route = cleaned; refresh();
  }
  // A street-level pin tilts in over the buildings; a city-only pin stays at neighborhood level.
  // The card covers the bottom of the map, so the camera leaves room for it and the office sits above it.
  function frame(a) {
    const precise = !a.approx;
    const cardH = $('.cardwrap').offsetHeight || 0;
    const padding = { top: 40, bottom: Math.min(work.clientHeight * 0.6, cardH + 30), left: 0, right: 0 };
    map.move({ center: a.coords, zoom: precise ? 16.6 : 12.2, pitch: precise ? 55 : 0, bearing: precise ? -18 : 0, padding });
  }
  function office(id) { const a = byId.get(id); if (!a) return; sel = id; expanded = false; refresh(); frame(a); }
  function territory(n) {
    area = zoneByN.get(Number(n)) || null;
    if (!area) return;
    sel = ''; tab = 'accounts'; q = ''; $('#find').value = ''; expanded = false;
    map.move({ ...cameraFor(area), pitch: 20, bearing: 0, padding: { top: 0, bottom: 0, left: 0, right: 0 } });
    refresh();
  }
  function fit() {
    area = null; sel = '';
    const pts = tab === 'route' && route.length ? route.map((id) => byId.get(id).coords) : zones.flatMap((t) => [[t.box[0], t.box[1]], [t.box[2], t.box[3]]]);
    map.move({ ...fitTo(pts, 105), pitch: 0, bearing: 0, padding: { top: 0, bottom: 0, left: 0, right: 0 } });
    refresh();
  }
  const fmt = (d) => { if (!d) return ''; const dt = new Date(`${d}T12:00:00`); return Number.isNaN(dt.getTime()) ? '' : dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); };
  const daysTo = (d) => (d ? Math.round((new Date(`${d}T12:00:00`) - new Date(new Date().toDateString())) / 864e5) : null);
  const renewSoon = (a) => a.type !== 'partner' && a.renewal && daysTo(a.renewal) >= 0 && daysTo(a.renewal) <= 90;

  function card() {
    const el = $('.cardwrap');
    const a = byId.get(sel);
    if (!a) {
      if (!area) { el.innerHTML = ''; return; }
      const st = options.terrStats ? options.terrStats(area.n) : null;
      const fig = (n, l) => `<span><b>${n}</b> ${l}</span>`;
      el.innerHTML = `<article class="info zone"><div class="cardtop"><span>#${area.n} · ${esc(area.region || '')}</span>${btn('clear', 'Close territory', 'close')}</div>
        <h2>${esc(area.name)}</h2>
        ${st ? `<div class="figs">${fig(st.pros, 'prospects')}${fig(st.ptn, 'partners')}${fig(st.cli, 'clients')}${fig(st.renew, 'renewing ≤ 90 d')}${fig(st.due, 'due')}</div>
        <p>${st.lastVisit ? `Last field day ${esc(st.lastVisit)}` : 'No field day logged here yet'}</p>` : ''}
        <div class="actions">${options.host ? btn('plan', 'Plan a field day here', 'route', 'Plan a field day', 'primary') : ''}</div></article>`;
      return;
    }
    const on = route.includes(a.id);
    const soon = renewSoon(a);
    const renewal = a.type === 'partner' ? `Partner${a.stage ? ` · ${esc(a.stage)}` : ''}`
      : a.renewal ? `${esc(a.renewWhat || 'Renewal')} renews ${esc(fmt(a.renewal))}${soon ? ` <b class="soon">in ${daysTo(a.renewal)} d</b>` : ''}` : 'No renewal date';
    const where = a.noDrop ? `<span class="warn">${esc(a.noDrop)}</span>`
      : a.approx ? `Pinned to the city only · ${btn('fixaddr', 'Confirm the street address', '', 'Confirm street address', 'linkish')}`
      : esc(a.address || a.city);
    el.innerHTML = `<article class="info acct ${soon ? 'is-soon' : ''}"><div class="cardtop"><span>${esc(TYPE_LABEL[a.type] || 'Account')}${a.type !== 'partner' && a.stage ? ` · ${esc(a.stage)}` : ''} · ${esc(zoneName(a))}</span>${btn('clear', 'Close', 'close')}</div>
      <h2>${esc(a.name)}</h2>
      <p class="addr">${where}</p>
      <p class="meta">${renewal} · ${a.visit ? `Last drop ${esc(fmt(a.visit))}` : 'No drop logged'}</p>
      <div class="actions">
        ${a.approx || a.noDrop || !a.nav ? '' : `<a class="primary" target="_blank" rel="noopener" href="${esc(a.nav)}">${icon('target', 15)}Navigate</a>`}
        ${a.noDrop ? '' : btn('drop', 'Log drop', null, 'Log drop')}
        ${(a.approx || a.noDrop) && !on ? '' : btn('toggleRoute', on ? 'Take off today\'s route' : 'Add to today\'s route', on ? 'check' : 'plus', on ? 'On route' : 'Route')}
        ${btn('record', 'Open the account', null, 'Open')}
      </div></article>`;
  }

  function refresh() {
    if (dead) return;
    const filtered = matches();
    $('.shell').classList.toggle('expanded', expanded);
    root.querySelectorAll('[data-tab]').forEach((b) => { const on = b.dataset.tab === tab; b.classList.toggle('active', on); b.setAttribute('aria-pressed', String(on)); });
    $('.filters').hidden = tab === 'route';
    $('#find').placeholder = tab === 'territories' ? 'Find a territory or county' : 'Search accounts or cities';
    const chipNames = { all: 'All', prospect: 'Prospects', client: 'Clients', partner: 'Partners', reserve: 'Reserve' };
    $('.chips').innerHTML = tab === 'accounts' ? Object.keys(chipNames).map((k) => `<button type="button" data-type="${k}" aria-pressed="${k === 'reserve' ? reserve : type === k}">${chipNames[k]}</button>`).join('') : '';
    const tours = route.map((id) => byId.get(id));
    const zoneCounts = new Map();
    for (const a of recs) if (!a.reserve && a.z) zoneCounts.set(a.z.n, (zoneCounts.get(a.z.n) || 0) + 1);
    const zs = zones.filter((z) => !q || `${z.name} ${z.county} ${z.region}`.toLowerCase().includes(q.toLowerCase()))
      .sort((a, b) => (zoneCounts.get(b.n) || 0) - (zoneCounts.get(a.n) || 0) || a.n - b.n);
    const title = tab === 'accounts' ? (area ? area.name : 'Mapped accounts') : tab === 'territories' ? 'Sales territories' : todayLabel;
    const count = tab === 'accounts' ? filtered.length : tab === 'territories' ? zs.length : route.length;
    $('.listtitle').innerHTML = `<span>${esc(title)}</span><span class="daycount">${count}</span>`;
    $('.sheetbutton').innerHTML = `<span>${icon('list', 14)} &nbsp;${esc(title)} · ${count}</span><span>${expanded ? 'Hide' : 'Show list'}</span>`;
    $('.sheetbutton').setAttribute('aria-expanded', String(expanded));
    let html = '';
    if (tab === 'territories') {
      html = zs.map((z) => `<button type="button" class="row" data-zone="${z.n}"><span class="tagicon">${icon('zones')}</span><span class="rowbody"><strong>${esc(z.name)}</strong><small>#${z.n} · ${esc(z.region)} · ${zoneCounts.get(z.n) || 0} accounts</small></span>${icon('chevron', 14)}</button>`).join('');
    } else {
      const list = tab === 'route' ? tours : filtered.slice(0, 300);
      list.forEach((a, i) => {
        const main = `<span class="tagicon ${esc(a.type)}">${tab === 'route' ? i + 1 : `<i class="shape ${a.type === 'partner' ? 'partner' : a.type === 'client' ? 'client' : ''} ${renewSoon(a) ? 'renew' : ''}"></i>`}</span><span class="rowbody"><strong>${esc(a.name)}</strong><small>${esc(`${a.industry || TYPE_LABEL[a.type]} · ${a.city || zoneName(a)}`)}</small></span>`;
        html += tab === 'route'
          ? `<div class="row"><button type="button" class="rowbody routepick" data-id="${esc(a.id)}">${main}</button><span class="controls-mini">${i ? `<button type="button" data-move="${esc(a.id)}" title="Move earlier" aria-label="Move ${esc(a.name)} earlier">${icon('up', 14)}</button>` : ''}<button type="button" data-remove="${esc(a.id)}" aria-label="Take ${esc(a.name)} off the route">${icon('trash', 14)}</button></span></div>`
          : `<button type="button" class="row ${sel === a.id ? 'selected' : ''}" data-id="${esc(a.id)}">${main}${icon('chevron', 14)}</button>`;
      });
      if (tab === 'accounts' && filtered.length > 300) html += `<div class="empty">Showing 300 of ${filtered.length}. Search or pick a territory to narrow it.</div>`;
    }
    if (!html) html = `<div class="empty">${tab === 'route' ? 'Nothing on today\'s route yet. Pick an account and tap + Route.' : tab === 'accounts' ? 'No mapped accounts match.' : 'No territories match.'}</div>`;
    if (tab === 'route') {
      const url = tours.length && options.routeUrl ? options.routeUrl(route) : '';
      html = `<div class="actions routeactions">${tours.length ? btn('fit', 'Fit the stops', 'fit', 'Fit stops') : ''}${url ? `<a href="${esc(url)}" rel="noopener" target="_blank">Drive route</a>` : ''}${options.host ? btn('planner', 'Open the day planner', 'route', 'Day planner') : ''}</div>
        <p class="routenote">Lines show stop order. Other days, start point, times and the optimizer are in the day planner.</p>${html}`;
    }
    $('.rows').innerHTML = html;
    const none = recs.filter((a) => !a.reserve && !a.z).length;
    $('.sidefoot').innerHTML = `<span>${zones.length} territories</span><span>${recs.filter((a) => !a.reserve).length} active accounts${none ? ` · ${none} outside` : ''}</span>`;
    $('[data-a="layers"]').setAttribute('aria-pressed', String(layer || tab === 'territories'));
    card();
    map?.layers(zones, area ? area.n : 0, layer || tab === 'territories', tab === 'route' ? tours.map((a) => a.coords) : []);
    queueMarkers();
  }

  function queueMarkers() { if (!markerFrame && !dead) markerFrame = requestAnimationFrame(() => { markerFrame = 0; markers(); }); }
  // Pins are buttons over the map. Ones that would sit on top of another don't vanish: the one underneath shows "+N",
  // and tapping it zooms in to pull them apart.
  function markers() {
    if (!map || dead) return;
    const st = map.state(); const w = work.clientWidth; const h = work.clientHeight; const z = st.zoom;
    const placed = [];
    const overlap = (r, x) => r[0] < x[2] + 3 && r[2] > x[0] - 3 && r[1] < x[3] + 3 && r[3] > x[1] - 3;
    function slot(pos, width, height, force = false) {
      const p = map.project(pos);
      const r = [p.x - width / 2, p.y - height / 2, p.x + width / 2, p.y + height / 2];
      if (r[2] < 0 || r[0] > w || r[3] < 0 || r[1] > h) return { off: true };
      if (!force) { const hit = placed.find((x) => overlap(r, x.r)); if (hit) return { hit }; }
      const s = { r, x: p.x, y: p.y, more: 0, html: '' };
      placed.push(s);
      return { s };
    }
    const at = (s) => ` style="left:${s.x.toFixed(1)}px;top:${s.y.toFixed(1)}px"`;
    const ms = matches();
    if (tab === 'route') {
      route.forEach((id, i) => { const a = byId.get(id); const { s } = slot(a.coords, 32, 32, true); if (s) s.html = `<button type="button" class="mark seq" data-id="${esc(id)}" aria-label="Stop ${i + 1}: ${esc(a.name)}"${at(s)}>${i + 1}</button>`; });
    } else if ((z < 11.6 && !area) || tab === 'territories') {
      const useRegion = z < 8.1 && tab !== 'territories';
      const groups = new Map();
      for (const a of ms) {
        const key = a.z ? (useRegion ? `r:${a.z.region}` : `t:${a.z.n}`) : 'none';
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(a);
      }
      for (const [key, list] of [...groups.entries()].sort((a, b) => b[1].length - a[1].length)) {
        const a = list[0];
        const name = key === 'none' ? 'No territory' : useRegion ? a.z.region : a.z.name.split(' & ')[0];
        const pos = list.reduce((v, x) => [v[0] + x.coords[0] / list.length, v[1] + x.coords[1] / list.length], [0, 0]);
        const data = key === 'none' ? 'data-none="1"' : useRegion ? `data-region="${esc(a.z.region)}"` : `data-zone="${a.z.n}"`;
        let res = slot(pos, 44 + name.length * 6.7, 34);
        if (res.s) { res.s.html = `<button type="button" class="mark cluster" ${data}${at(res.s)}><b>${list.length}</b>${esc(name)}</button>`; continue; }
        if (res.off) continue;
        res = slot(pos, 30, 30); // no room for the name: the count alone
        if (res.s) res.s.html = `<button type="button" class="mark cluster bare" ${data} title="${esc(name)}" aria-label="${esc(`${list.length} in ${name}`)}"${at(res.s)}><b>${list.length}</b></button>`;
        else if (res.hit) res.hit.more += list.length;
      }
    } else {
      for (const a of [...ms].sort((x, y) => (y.id === sel) - (x.id === sel))) {
        const res = slot(a.coords, 24, 24, a.id === sel);
        if (res.hit) { res.hit.more += 1; continue; }
        if (!res.s) continue;
        const cls = `mark dot ${a.type === 'partner' ? 'diamond' : a.type === 'client' ? 'client' : ''} ${renewSoon(a) ? 'renew' : ''} ${a.id === sel ? 'picked' : ''}`;
        res.s.html = `<button type="button" class="${cls}" data-id="${esc(a.id)}" title="${esc(a.name)}" aria-label="${esc(a.name)}"${at(res.s)}></button>`;
        res.s.coords = a.coords;
      }
    }
    let content = '';
    for (const s of placed) {
      if (!s.more) { content += s.html; continue; }
      // the pin underneath carries the count; a pin with company zooms in when tapped
      content += s.html.replace('<button type="button" class="mark', `<button type="button" data-more="${s.more}"${s.coords ? ` data-zoomto="${s.coords.join(',')}"` : ''} class="mark has-more`)
        .replace(/<\/button>$/, `<i class="more">+${s.more}</i></button>`);
    }
    if (pins.innerHTML !== content) pins.innerHTML = content;
    $('[data-a="2d"]').setAttribute('aria-pressed', String(st.pitch < 5));
    $('[data-a="3d"]').setAttribute('aria-pressed', String(st.pitch >= 5));
  }

  async function click(ev) {
    const b = ev.target.closest('button');
    if (!b || !root.contains(b)) return;
    const d = b.dataset; const a = byId.get(sel);
    if (d.zoomto && map.state().zoom < 17.5) { const [x, y] = d.zoomto.split(',').map(Number); map.move({ center: [x, y], zoom: Math.min(18.5, map.state().zoom + 2) }); return; }
    if (d.id) { office(d.id); return; }
    if (d.zone) { territory(d.zone); return; }
    if (d.none) { const ms = matches().filter((x) => !x.z); if (ms.length) map.move({ ...fitTo(ms.map((x) => x.coords), 100), pitch: 0 }); return; }
    if (d.region) { const ms = matches().filter((x) => x.z && x.z.region === d.region); const c = fitTo(ms.map((x) => x.coords), 100); map.move({ ...c, zoom: Math.max(9, c.zoom), pitch: 12 }); return; }
    if (d.type) { if (d.type === 'reserve') reserve = !reserve; else type = d.type; sel = ''; refresh(); return; }
    if (d.tab) {
      tab = d.tab; type = 'all'; area = null; sel = ''; q = ''; $('#find').value = ''; expanded = tab !== 'accounts';
      if (tab === 'route' && route.length) map.move({ ...fitTo(route.map((id) => byId.get(id).coords), 100), pitch: 0, bearing: 0 });
      refresh(); return;
    }
    if (d.remove) { await storeRoute(route.filter((i) => i !== d.remove)); return; }
    if (d.move) { const ids = [...route]; const i = ids.indexOf(d.move); if (i > 0) { [ids[i - 1], ids[i]] = [ids[i], ids[i - 1]]; await storeRoute(ids); } return; }
    switch (d.a) {
      case 'record': if (a) options.host?.('record', sel); break;
      case 'fixaddr': if (a) options.host?.('fixaddr', sel); break;
      case 'plan': if (area) options.host?.('terr', area.n); break;
      case 'planner': options.host?.('planner'); break;
      case 'drop': if (a) { await options.onDrop(a); refresh(); } break;
      case 'toggleRoute':
        if (a) { const on = route.includes(sel); await storeRoute(on ? route.filter((i) => i !== sel) : [...route, sel]); showStatus(on ? 'Taken off today\'s route' : 'Added to today\'s route'); }
        break;
      case 'sheet': expanded = !expanded; refresh(); break;
      case 'clear': if (sel) sel = ''; else area = null; refresh(); break;
      case 'fit': fit(); break;
      case 'layers': if (tab === 'territories') { tab = 'accounts'; layer = false; } else layer = !layer; refresh(); break;
      case 'near':
        if (!navigator.geolocation) { showStatus('Location isn\'t available here. Pick a territory instead.'); break; }
        navigator.geolocation.getCurrentPosition((p) => {
          if (dead) return;
          area = null; tab = 'accounts'; sel = ''; q = ''; $('#find').value = '';
          map.move({ center: [p.coords.longitude, p.coords.latitude], zoom: 13, pitch: 0 });
          refresh();
        }, () => showStatus('Location unavailable. Pick a territory instead.'), { timeout: 10000 });
        break;
      case '2d': map.move({ pitch: 0, bearing: 0 }); break;
      case '3d': map.move({ pitch: 55, bearing: -15 }); break;
      case 'plus': case 'minus': map.move({ zoom: map.state().zoom + (d.a === 'plus' ? 1 : -1) }); break;
      case 'north': map.move({ bearing: 0 }); break;
      default: break;
    }
  }
  root.addEventListener('click', click);
  // Typing searches every account, not just the territory that's open.
  $('#find').oninput = (e) => { q = e.target.value; sel = ''; if (q && tab === 'accounts') area = null; refresh(); };
  map = await createRenderer($('.basemap'), { camera: { center: [-118.3, 34.03], zoom: work.clientWidth < 600 ? 8.4 : 9.1 }, token: options.token, move: queueMarkers });
  refresh();
  return {
    update(data) { update(data); refresh(); },
    focus(id) { if (byId.has(id)) office(id); },
    destroy() { dead = true; clearTimeout(toastTimer); cancelAnimationFrame(markerFrame); map?.destroy(); root.removeEventListener('click', click); root.replaceChildren(); },
  };
}
