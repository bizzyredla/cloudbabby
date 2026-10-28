/* Mini CRM — partner & prospect accounts with history, key dates and a daily planner.
   All data lives in localStorage; use Export/Import for backups or moving between devices. */
(() => {
  'use strict';

  const STORAGE_KEY = 'minicrm.v1';

  const STAGES = {
    prospect: ['New', 'Contacted', 'Qualified', 'Proposal', 'Negotiation', 'Won', 'Lost'],
    partner: ['Onboarding', 'Active', 'Strategic', 'At Risk', 'Inactive'],
  };
  const ACTIVITY_KINDS = ['Call', 'Email', 'LinkedIn', 'Visit', 'Meeting', 'Demo', 'Note', 'Other'];
  // Daily activity plan targets shown on the planner.
  const PLAN_SECTIONS = [
    { key: 'outreach', label: 'Calls / Emails / LinkedIn', short: 'Outreach', count: 25, kinds: ['Call', 'Email', 'LinkedIn'] },
    { key: 'visits', label: 'Visits', short: 'Visit', count: 5, kinds: ['Visit'] },
    { key: 'channel', label: 'Channel accounts', short: 'Channel account touch', count: 5, kinds: ['Call', 'Email', 'LinkedIn', 'Visit', 'Meeting'], partners: true },
    { key: 'revisits', label: 'Revisits', short: 'Revisit', count: 5, kinds: ['Visit'] },
  ];
  const PRIORITIES = { high: 'High', med: 'Medium', low: 'Low' };
  // Top TriNet competitors (PEOs and HR/payroll platforms), offered as "current vendor" choices.
  const COMPETITORS = [
    'ADP TotalSource', 'Insperity', 'Paychex PEO', 'Justworks', 'Rippling PEO', 'Gusto', 'Vensure Employer Services',
    'CoAdvantage', 'Sequoia One', 'G&A Partners', 'Engage PEO', 'BBSI', 'Extensis Group', 'Questco', 'Infiniti HR',
    'ADP Workforce Now', 'Paycor', 'Paylocity', 'Paycom', 'Deel',
  ];
  const NO_VENDOR = 'None / in-house';
  const CONTACT_ROLES = ['Decision maker', 'Champion', 'Influencer', 'HR', 'Finance', 'Operations', 'Executive', 'Other'];
  const DAY_START = 7;
  const DAY_END = 19;

  // ---------- dates ----------
  const pad = (n) => String(n).padStart(2, '0');
  const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const fromISO = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const today = () => toISO(new Date());
  const addDays = (iso, n) => { const d = fromISO(iso); d.setDate(d.getDate() + n); return toISO(d); };
  const daysBetween = (a, b) => Math.round((fromISO(b) - fromISO(a)) / 86400000);
  const fmtDate = (iso, opts = { month: 'short', day: 'numeric', year: 'numeric' }) =>
    iso ? fromISO(iso).toLocaleDateString(undefined, opts) : '—';
  const fmtLongDate = (iso) =>
    fromISO(iso).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const fmtTime = (t) => {
    if (!t) return '';
    const [h, m] = t.split(':').map(Number);
    const d = new Date(); d.setHours(h, m);
    return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  };
  const relDays = (iso) => {
    const n = daysBetween(today(), iso);
    if (n === 0) return 'today';
    if (n === 1) return 'tomorrow';
    if (n === -1) return 'yesterday';
    return n > 0 ? `in ${n} days` : `${-n} days ago`;
  };
  const dueClass = (iso) => {
    if (!iso) return '';
    const n = daysBetween(today(), iso);
    return n < 0 ? 'overdue' : n === 0 ? 'today' : '';
  };

  // ---------- utils ----------
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const money = (v) => (v || v === 0) && v !== ''
    ? Number(v).toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
    : '—';

  function toast(msg) {
    const el = $('#toast');
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toast.t);
    toast.t = setTimeout(() => { el.hidden = true; }, 2200);
  }

  // ---------- state ----------
  let state = load();
  const ui = { search: '', typeFilter: 'all', stageFilter: 'all', vendorFilter: 'all', sort: 'followup', sortDir: 1, plannerDate: today(), listId: null, navs: 0 };
  // Per-device view preferences (layout choice), not synced.
  const PREFS_KEY = 'minicrm.prefs';
  try { Object.assign(ui, JSON.parse(localStorage.getItem(PREFS_KEY)) || {}); } catch (e) { /* defaults */ }
  ui.accountView ||= matchMedia('(max-width: 700px)').matches ? 'cards' : 'table';
  ui.boardType ||= 'prospect';
  const savePrefs = () => {
    try { localStorage.setItem(PREFS_KEY, JSON.stringify({ accountView: ui.accountView, boardType: ui.boardType })); } catch (e) { /* ignore */ }
  };

  function emptyState() { return { accounts: [], tasks: [], days: {}, lists: [], deleted: {} }; }

  /** Fill in missing collections and move the old single-contact fields into `contacts`. */
  function migrateAccount(a) {
    a.activities ||= []; a.keyDates ||= []; a.vendors ||= [];
    if (!a.contacts) {
      // Deterministic id so devices that migrate the same account separately still merge cleanly.
      a.contacts = a.contact || a.email || a.phone
        ? [{ id: 'c-' + a.id, name: a.contact || '', title: a.title || '', email: a.email || '', phone: a.phone || '', role: '', notes: '', primary: true }]
        : [];
      delete a.contact; delete a.title; delete a.email; delete a.phone;
    }
    return a;
  }

  function normalize(data) {
    const st = { ...emptyState(), ...data };
    st.accounts.forEach(migrateAccount);
    return st;
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return normalize(JSON.parse(raw));
    } catch (e) { console.warn('Could not read saved data', e); }
    return emptyState();
  }

  /** Persist locally. `track` stamps what changed so sync can merge it with other devices. */
  function save({ track = true } = {}) {
    if (track) stampChanges();
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
    catch (e) { toast('Could not save — browser storage is unavailable. Use Export to keep a copy.'); }
    if (track && syncCfg) { setSyncStatus('pending'); scheduleSync(); }
  }

  // ---------- change tracking ----------
  // Every record carries `_ts`, the time of its last local change. Removed records leave a
  // tombstone in state.deleted so other devices drop them too. Changes are found by diffing
  // each record against a snapshot taken at the previous save.
  function* records(st) {
    for (const a of st.accounts) {
      const { activities, keyDates, contacts, _ts, ...fields } = a;
      yield ['a:' + a.id, a, fields];
      for (const h of activities) yield ['h:' + h.id, h, { ...h, _ts: undefined }];
      for (const k of keyDates) yield ['k:' + k.id, k, { ...k, _ts: undefined }];
      for (const c of contacts) yield ['c:' + c.id, c, { ...c, _ts: undefined }];
    }
    for (const l of st.lists) yield ['l:' + l.id, l, { ...l, _ts: undefined }];
    for (const t of st.tasks) yield ['t:' + t.id, t, { ...t, _ts: undefined }];
    for (const [d, day] of Object.entries(st.days)) yield ['d:' + d, day, { ...day, _ts: undefined }];
  }

  function fingerprints(st) {
    const m = new Map();
    for (const [key, , fields] of records(st)) m.set(key, JSON.stringify(fields));
    return m;
  }

  let snapshot = fingerprints(state);

  function stampChanges() {
    const now = Date.now();
    const next = new Map();
    for (const [key, obj, fields] of records(state)) {
      const fp = JSON.stringify(fields);
      next.set(key, fp);
      if (snapshot.get(key) !== fp) obj._ts = now;
    }
    for (const key of snapshot.keys()) if (!next.has(key)) state.deleted[key] = now;
    snapshot = next;
  }

  /** Combine two copies record by record: newest edit wins, deletions win over older edits. */
  function mergeStates(L, R) {
    const deleted = { ...L.deleted };
    for (const [k, v] of Object.entries(R.deleted)) deleted[k] = Math.max(deleted[k] || 0, v);
    const alive = (key, x) => !(deleted[key] >= (x._ts || 0));
    const newer = (x, y) => (!x ? y : !y ? x : (x._ts || 0) >= (y._ts || 0) ? x : y);
    const mergeList = (a, b, prefix) => {
      const m = new Map();
      for (const x of [...a, ...b]) m.set(x.id, newer(m.get(x.id), x));
      return [...m.values()].filter((x) => alive(prefix + x.id, x));
    };

    const accounts = new Map();
    for (const a of [...L.accounts, ...R.accounts]) {
      const prev = accounts.get(a.id);
      accounts.set(a.id, prev
        ? { ...newer(prev, a), activities: [...prev.activities, ...a.activities], keyDates: [...prev.keyDates, ...a.keyDates], contacts: [...prev.contacts, ...a.contacts] }
        : { ...a });
    }
    const merged = [...accounts.values()].filter((a) => alive('a:' + a.id, a)).map((a) => ({
      ...a, activities: mergeList(a.activities, [], 'h:'), keyDates: mergeList(a.keyDates, [], 'k:'), contacts: mergeList(a.contacts, [], 'c:'),
    }));

    const days = { ...L.days };
    for (const [d, day] of Object.entries(R.days)) days[d] = newer(days[d], day);
    for (const [d, day] of Object.entries(days)) if (!alive('d:' + d, day)) delete days[d];

    return { ...emptyState(), accounts: merged, tasks: mergeList(L.tasks, R.tasks, 't:'), days, lists: mergeList(L.lists, R.lists, 'l:'), deleted };
  }

  const toPayload = (st) => ({ version: 1, accounts: st.accounts, tasks: st.tasks, days: st.days, lists: st.lists, deleted: st.deleted });

  const getAccount = (id) => state.accounts.find((a) => a.id === id);
  const primaryContact = (a) => a.contacts.find((c) => c.primary) || a.contacts[0] || null;
  const tagList = (a) => (a.tags || '').split(',').map((x) => x.trim()).filter(Boolean);
  const allTags = () => [...new Set(state.accounts.flatMap((a) => tagList(a).map((x) => x.toLowerCase())))].sort();
  const allVendors = () => {
    const used = new Set(state.accounts.flatMap((a) => a.vendors));
    return [...COMPETITORS, ...[...used].filter((v) => !COMPETITORS.includes(v) && v !== NO_VENDOR).sort(), NO_VENDOR];
  };
  const haystack = (a) => [a.name, a.industry, a.tags, a.notes, ...a.vendors,
    ...a.contacts.flatMap((c) => [c.name, c.title, c.email, c.phone])].join(' ').toLowerCase();
  const vendorPills = (a) => a.vendors.map((v) => `<span class="pill vendor">${esc(v)}</span>`).join(' ');
  const getDay = (iso) => state.days[iso] || { priorities: ['', '', ''], notes: '' };
  const findAccountByName = (name) => {
    const n = (name || '').trim().toLowerCase();
    return n ? state.accounts.find((a) => a.name.trim().toLowerCase() === n) : null;
  };

  const blankPlanRow = (sec) => ({ name: '', kind: sec.kinds[0], note: '', done: false });

  /** Plan rows for a day, padded to each section's target count. Read-only unless `persist`. */
  function getPlan(iso, persist = false) {
    const stored = getDay(iso).plan || {};
    const plan = {};
    for (const sec of PLAN_SECTIONS) {
      const rows = (stored[sec.key] || []).slice();
      while (rows.length < sec.count) rows.push(blankPlanRow(sec));
      plan[sec.key] = rows;
    }
    if (persist) state.days[iso] = { ...getDay(iso), plan };
    return plan;
  }

  const planStats = (plan, key) => {
    const rows = plan[key];
    const sec = PLAN_SECTIONS.find((x) => x.key === key);
    return { done: rows.filter((r) => r.done).length, target: Math.max(sec.count, rows.length) };
  };

  function touch(acct) { acct.updatedAt = new Date().toISOString(); }

  function lastActivity(acct) {
    return [...acct.activities].sort((a, b) => b.date.localeCompare(a.date))[0];
  }

  /** Every dated, still-open item across accounts: follow-ups, revisits and key dates. */
  function upcomingItems() {
    const items = [];
    for (const a of state.accounts) {
      if (a.nextFollowUp) items.push({ kind: 'followup', date: a.nextFollowUp, label: 'Follow up', account: a });
      if (a.revisitDate) items.push({ kind: 'revisit', date: a.revisitDate, label: 'Revisit', account: a });
      for (const k of a.keyDates) if (!k.done) items.push({ kind: 'keydate', date: k.date, label: k.label, account: a, keyDate: k });
    }
    return items.sort((x, y) => x.date.localeCompare(y.date));
  }

  // ---------- routing ----------
  const views = { dashboard: renderDashboard, accounts: renderAccounts, account: renderAccountRecord, planner: renderPlanner, lists: renderLists };
  const TAB_FOR = { account: 'accounts' };

  function route() {
    const [name, arg] = location.hash.replace('#', '').split('/');
    const view = views[name] ? name : 'dashboard';
    if (view === 'account') ui.recordId = arg;
    if (view === 'planner' && arg && /^\d{4}-\d{2}-\d{2}$/.test(arg)) ui.plannerDate = arg;
    if (view === 'lists' && arg) ui.listId = decodeURIComponent(arg);
    $$('#tabs a').forEach((a) => a.classList.toggle('active', a.dataset.view === (TAB_FOR[view] || view)));
    views[view]();
  }
  const rerender = () => route();
  const go = (hash) => { if (location.hash === '#' + hash) rerender(); else location.hash = hash; };
  window.addEventListener('hashchange', () => { ui.navs++; route(); window.scrollTo(0, 0); });

  // ---------- dashboard ----------
  function renderDashboard() {
    const t = today();
    const items = upcomingItems();
    const overdue = items.filter((i) => i.date < t);
    const dueToday = items.filter((i) => i.date === t);
    const upcoming = items.filter((i) => i.date > t && daysBetween(t, i.date) <= 14);
    const todaysTasks = state.tasks.filter((x) => x.date === t);
    const todaysPlan = getPlan(t);
    const planDone = PLAN_SECTIONS.reduce((n, sec) => n + planStats(todaysPlan, sec.key).done, 0);
    const planTotal = PLAN_SECTIONS.reduce((n, sec) => n + planStats(todaysPlan, sec.key).target, 0);
    const partners = state.accounts.filter((a) => a.type === 'partner');
    const prospects = state.accounts.filter((a) => a.type === 'prospect');
    const openPipeline = prospects
      .filter((a) => !['Won', 'Lost'].includes(a.stage))
      .reduce((s, a) => s + (Number(a.value) || 0), 0);
    const recent = state.accounts
      .flatMap((a) => a.activities.map((act) => ({ ...act, account: a })))
      .sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || '').localeCompare(a.createdAt || ''))
      .slice(0, 8);
    const quiet = state.accounts
      .filter((a) => !['Lost', 'Inactive'].includes(a.stage) && !a.nextFollowUp)
      .slice(0, 6);

    $('#view').innerHTML = `
      <div class="row spread" style="margin-bottom:1rem">
        <div>
          <h1>${esc(fmtLongDate(t))}</h1>
          <div class="muted">${todaysTasks.filter((x) => !x.done).length} open planner tasks today · ${dueToday.length} account items due</div>
        </div>
        <div class="row">
          <button class="btn ghost" data-act="new-account">+ Account</button>
          <a class="btn" href="#planner/${t}">Open today's planner</a>
        </div>
      </div>

      ${state.accounts.length === 0 ? `
        <div class="card stack" style="margin-bottom:1rem">
          <h2>Welcome</h2>
          <p class="muted">Add your first partner or prospect account, or load sample data to explore.</p>
          <div class="row">
            <button class="btn" data-act="new-account">+ Add account</button>
            <button class="btn ghost" data-act="load-sample">Load sample data</button>
          </div>
        </div>` : ''}

      <div class="stats">
        <div class="card stat"><div class="num">${partners.length}</div><div class="label">Partner accounts</div></div>
        <div class="card stat"><div class="num">${prospects.length}</div><div class="label">Prospect accounts</div></div>
        <div class="card stat"><div class="num">${money(openPipeline)}</div><div class="label">Open prospect pipeline</div></div>
        <div class="card stat ${overdue.length ? 'alert' : ''}"><div class="num">${overdue.length}</div><div class="label">Overdue items</div></div>
        <div class="card stat"><div class="num">${dueToday.length}</div><div class="label">Due today</div></div>
        <a class="card stat" href="#planner/${t}" style="text-decoration:none;color:inherit"><div class="num">${planDone}/${planTotal}</div><div class="label">Today's activity plan</div></a>
      </div>

      <div class="dash-grid">
        <div class="card">
          <h2>Needs attention</h2>
          ${itemList([...overdue, ...dueToday], 'Nothing overdue or due today.')}
        </div>
        <div class="card">
          <h2>Next 14 days</h2>
          ${itemList(upcoming, 'No upcoming dates in the next two weeks.')}
        </div>
        <div class="card">
          <h2>Recent activity</h2>
          ${recent.length ? `<ul class="list">${recent.map((r) => `
            <li>
              <div class="date-chip"><b>${fromISO(r.date).getDate()}</b>${fmtDate(r.date, { month: 'short' })}</div>
              <div class="grow">
                <div class="title">${esc(r.kind)}: ${esc(r.summary)}</div>
                <div class="small muted"><a href="#account/${r.account.id}">${esc(r.account.name)}</a></div>
              </div>
            </li>`).join('')}</ul>` : '<div class="empty">No activity logged yet.</div>'}
        </div>
        <div class="card">
          <h2>No follow-up scheduled</h2>
          ${quiet.length ? `<ul class="list">${quiet.map((a) => `
            <li>
              <span class="pill ${a.type}">${a.type === 'partner' ? 'Partner' : 'Prospect'}</span>
              <div class="grow"><a class="title" href="#account/${a.id}">${esc(a.name)}</a>
                <div class="small muted">${esc(a.stage)} · last touch ${lastActivity(a) ? relDays(lastActivity(a).date) : 'never'}</div></div>
              <button class="btn sm ghost" data-act="log" data-id="${a.id}">Log / schedule</button>
            </li>`).join('')}</ul>` : '<div class="empty">Every active account has a next step.</div>'}
        </div>
      </div>
      ${state.accounts.length || state.tasks.length ? `
      <div class="row" style="justify-content:flex-end;margin-top:1.5rem">
        <button class="btn danger sm" data-act="erase-all">Erase all data…</button>
      </div>` : ''}`;
  }

  /** Remove every record. Tombstones carry the erase to other synced devices. */
  function eraseAll() {
    const typed = prompt(
      `This permanently deletes all ${state.accounts.length} accounts, tasks, planner days and lists` +
      `${syncCfg ? ' on this device AND every synced device' : ' on this device'}.\n\nExport a backup first if you might need it.\n\nType DELETE to confirm.`);
    if ((typed || '').trim().toUpperCase() !== 'DELETE') { if (typed !== null) toast('Nothing was deleted'); return; }
    state.accounts = []; state.tasks = []; state.lists = []; state.days = {};
    ui.listId = null;
    save(); toast('All data erased'); go('dashboard');
  }

  function itemList(items, emptyMsg) {
    if (!items.length) return `<div class="empty">${emptyMsg}</div>`;
    return `<ul class="list">${items.map((i) => `
      <li>
        <div class="date-chip ${dueClass(i.date)}"><b>${fromISO(i.date).getDate()}</b>${fmtDate(i.date, { month: 'short' })}</div>
        <div class="grow">
          <div class="title">${esc(i.label)} — <a href="#account/${i.account.id}">${esc(i.account.name)}</a></div>
          <div class="small muted"><span class="pill ${i.account.type}">${i.account.type === 'partner' ? 'Partner' : 'Prospect'}</span> ${relDays(i.date)}</div>
        </div>
        ${i.kind === 'followup' ? `<button class="btn sm ghost" data-act="log" data-id="${i.account.id}">Log</button>`
          : i.kind === 'revisit' ? `<a class="btn sm ghost" href="#planner/${i.date > today() ? i.date : today()}">Planner</a>`
          : `<button class="btn sm ghost" data-act="keydate-done" data-id="${i.account.id}" data-kid="${i.keyDate.id}">Done</button>`}
      </li>`).join('')}</ul>`;
  }

  // ---------- accounts ----------
  const FAR = '9999-12-31';
  const stageIndex = (a) => STAGES[a.type].indexOf(a.stage) + (a.type === 'partner' ? 100 : 0);
  const SORTERS = {
    name: (x, y) => x.name.localeCompare(y.name),
    stage: (x, y) => stageIndex(x) - stageIndex(y),
    value: (x, y) => (Number(y.value) || 0) - (Number(x.value) || 0),
    followup: (x, y) => (x.nextFollowUp || FAR).localeCompare(y.nextFollowUp || FAR),
    revisit: (x, y) => (x.revisitDate || FAR).localeCompare(y.revisitDate || FAR),
    lasttouch: (x, y) => ((lastActivity(y) || {}).date || '').localeCompare((lastActivity(x) || {}).date || ''),
    updated: (x, y) => (y.updatedAt || '').localeCompare(x.updatedAt || ''),
  };
  const SORT_LABELS = { followup: 'Next follow-up', revisit: 'Next revisit', name: 'Name', stage: 'Stage', value: 'Value', lasttouch: 'Last touch', updated: 'Recently updated' };
  const sortAccounts = (list) => list.sort((x, y) => SORTERS[ui.sort](x, y) * ui.sortDir || x.name.localeCompare(y.name));

  function filteredAccounts() {
    const q = ui.search.trim().toLowerCase();
    return sortAccounts(state.accounts.filter((a) => {
      if (ui.typeFilter !== 'all' && a.type !== ui.typeFilter) return false;
      if (ui.stageFilter !== 'all' && a.stage !== ui.stageFilter) return false;
      if (ui.vendorFilter !== 'all' && !a.vendors.includes(ui.vendorFilter)) return false;
      return !q || haystack(a).includes(q);
    }));
  }

  const typePill = (a) => `<span class="pill ${a.type}">${a.type === 'partner' ? 'Partner' : 'Prospect'}</span>`;
  const dueChip = (iso) => iso
    ? `<span class="pill ${dueClass(iso)}" title="${esc(relDays(iso))}">${fmtDate(iso, { month: 'short', day: 'numeric' })}</span>`
    : '<span class="muted">—</span>';

  const VIEW_MODES = [['table', '☰', 'Table'], ['board', '▥', 'Board'], ['cards', '▦', 'Cards']];
  const viewSwitcher = () => `
    <div class="seg" role="group" aria-label="Layout">
      ${VIEW_MODES.map(([v, icon, label]) => `<button type="button" class="${ui.accountView === v ? 'active' : ''}" data-act="set-view" data-mode="${v}" aria-pressed="${ui.accountView === v}"><span aria-hidden="true">${icon}</span> ${label}</button>`).join('')}
    </div>`;

  /** One renderer for every collection of accounts (Accounts page and Lists), in the chosen layout. */
  function accountCollection(list, emptyMsg = 'No accounts match.') {
    if (ui.accountView === 'board') return accountBoard(list);
    if (!list.length) return `<div class="card empty">${emptyMsg}</div>`;
    return ui.accountView === 'cards' ? accountCards(list) : accountTable(list);
  }

  function accountTable(list) {
    const th = (label, key) => key
      ? `<th><button type="button" class="th-sort ${ui.sort === key ? 'on' : ''}" data-act="sort" data-key="${key}">${label}${ui.sort === key ? (ui.sortDir > 0 ? ' ▲' : ' ▼') : ''}</button></th>`
      : `<th>${label}</th>`;
    return `
      <div class="card table-card">
        <div class="table-wrap">
          <table class="table acct-table">
            <thead><tr>${th('Account', 'name')}${th('Stage', 'stage')}${th('Primary contact')}${th('Current vendors')}${th('Value', 'value')}${th('Follow-up', 'followup')}${th('Revisit', 'revisit')}${th('Last touch', 'lasttouch')}</tr></thead>
            <tbody>${list.map((a) => {
              const p = primaryContact(a);
              const last = lastActivity(a);
              return `<tr class="click-row" data-act="open-account" data-id="${a.id}">
                <td class="sticky-col"><strong>${esc(a.name)}</strong><div>${typePill(a)}</div></td>
                <td>${esc(a.stage)}</td>
                <td>${p ? `${esc(p.name)}${p.title ? `<div class="small muted">${esc(p.title)}</div>` : ''}` : '<span class="muted">—</span>'}${a.contacts.length > 1 ? `<div class="small muted">+${a.contacts.length - 1} more</div>` : ''}</td>
                <td>${vendorPills(a) || '<span class="muted">—</span>'}</td>
                <td class="num">${a.value ? money(a.value) : '<span class="muted">—</span>'}</td>
                <td>${dueChip(a.nextFollowUp)}</td>
                <td>${dueChip(a.revisitDate)}</td>
                <td class="small">${last ? `${esc(relDays(last.date))}<div class="muted">${esc(last.kind)}</div>` : '<span class="muted">Never</span>'}</td>
              </tr>`;
            }).join('')}</tbody>
          </table>
        </div>
      </div>`;
  }

  function accountCards(list) {
    return `<div class="acard-grid">${list.map((a) => {
      const p = primaryContact(a);
      return `
        <button type="button" class="acard" data-act="open-account" data-id="${a.id}">
          <div class="row spread"><strong class="acard-name">${esc(a.name)}</strong>${typePill(a)}</div>
          <div class="small muted">${esc(a.stage)}${a.value ? ' · ' + money(a.value) : ''}${a.industry ? ' · ' + esc(a.industry) : ''}</div>
          ${p ? `<div class="small">${esc(p.name)}${p.title ? ` <span class="muted">· ${esc(p.title)}</span>` : ''}${a.contacts.length > 1 ? ` <span class="muted">+${a.contacts.length - 1}</span>` : ''}</div>` : ''}
          ${a.vendors.length ? `<div class="row">${vendorPills(a)}</div>` : ''}
          <div class="acard-dates small">
            <span>Follow-up ${dueChip(a.nextFollowUp)}</span>
            <span>Revisit ${dueChip(a.revisitDate)}</span>
          </div>
        </button>`;
    }).join('')}</div>`;
  }

  function accountBoard(list) {
    const fixedType = ui.typeFilter !== 'all' ? ui.typeFilter : null;
    const type = fixedType || ui.boardType;
    const items = list.filter((a) => a.type === type);
    const touchUI = matchMedia('(pointer: coarse)').matches;
    return `
      ${fixedType ? '' : `
      <div class="seg board-type" role="group" aria-label="Pipeline">
        <button type="button" class="${type === 'prospect' ? 'active' : ''}" data-act="board-type" data-type="prospect">Prospect pipeline (${list.filter((a) => a.type === 'prospect').length})</button>
        <button type="button" class="${type === 'partner' ? 'active' : ''}" data-act="board-type" data-type="partner">Partner pipeline (${list.filter((a) => a.type === 'partner').length})</button>
      </div>`}
      <div class="board">
        ${STAGES[type].map((stage) => {
          const col = sortAccounts(items.filter((a) => a.stage === stage));
          const total = col.reduce((n, a) => n + (Number(a.value) || 0), 0);
          return `
            <section class="kcol" data-stage="${esc(stage)}">
              <header><strong>${esc(stage)}</strong> <span class="pill">${col.length}</span>${total ? `<div class="small muted">${money(total)}</div>` : ''}</header>
              <div class="kcol-body">
                ${col.map((a) => {
                  const p = primaryContact(a);
                  return `
                  <div class="kcard" draggable="${!touchUI}" data-id="${a.id}" data-act="open-account">
                    <strong>${esc(a.name)}</strong>
                    ${p ? `<div class="small muted">${esc(p.name)}</div>` : ''}
                    ${a.vendors.length ? `<div class="small">${esc(a.vendors.join(', '))}</div>` : ''}
                    <div class="row small" style="margin-top:.3rem">${a.value ? `<span>${money(a.value)}</span>` : ''}${a.nextFollowUp ? dueChip(a.nextFollowUp) : ''}</div>
                    ${touchUI ? `<select class="kcard-stage" data-id="${a.id}" aria-label="Move ${esc(a.name)} to stage">${STAGES[type].map((s2) => opt(s2, s2, a.stage)).join('')}</select>` : ''}
                  </div>`;
                }).join('') || '<div class="kcol-empty">Drop here</div>'}
              </div>
            </section>`;
        }).join('')}
      </div>`;
  }

  /** Move an account to a new stage and record the change in its history. */
  function moveStage(id, stage) {
    const a = getAccount(id);
    if (!a || a.stage === stage) return;
    a.activities.push({ id: uid(), date: today(), kind: 'Note', summary: `Stage changed: ${a.stage} → ${stage}`, notes: '', createdAt: new Date().toISOString() });
    a.stage = stage;
    touch(a); save(); rerender();
    toast(`${a.name} moved to ${stage}`);
  }

  function bindCollection() {
    $$('.kcard-stage').forEach((sel) => {
      sel.addEventListener('click', (e) => e.stopPropagation());
      sel.addEventListener('change', (e) => moveStage(e.target.dataset.id, e.target.value));
    });
    $$('.kcard[draggable=true]').forEach((card) => card.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', card.dataset.id);
      e.dataTransfer.effectAllowed = 'move';
      card.classList.add('dragging');
    }));
    $$('.kcol').forEach((col) => {
      col.addEventListener('dragover', (e) => { e.preventDefault(); col.classList.add('drop'); });
      col.addEventListener('dragleave', (e) => { if (!col.contains(e.relatedTarget)) col.classList.remove('drop'); });
      col.addEventListener('drop', (e) => {
        e.preventDefault(); col.classList.remove('drop');
        moveStage(e.dataTransfer.getData('text/plain'), col.dataset.stage);
      });
    });
  }

  function renderAccounts() {
    const list = filteredAccounts();
    const stages = ui.typeFilter === 'all' ? [...STAGES.prospect, ...STAGES.partner] : STAGES[ui.typeFilter];

    $('#view').innerHTML = `
      <div class="page-head">
        <h1>Accounts <span class="muted small">(${list.length})</span></h1>
        <div class="row">${viewSwitcher()}<button class="btn" data-act="new-account">+ New account</button></div>
      </div>
      <div class="filters">
        <input type="search" id="acct-search" placeholder="Search name, contacts, vendors, tags, notes…" value="${esc(ui.search)}">
        <select id="acct-type" aria-label="Type">
          <option value="all">All types</option>
          <option value="partner" ${ui.typeFilter === 'partner' ? 'selected' : ''}>Partners</option>
          <option value="prospect" ${ui.typeFilter === 'prospect' ? 'selected' : ''}>Prospects</option>
        </select>
        <select id="acct-stage" aria-label="Stage">
          <option value="all">All stages</option>
          ${stages.map((x) => `<option ${ui.stageFilter === x ? 'selected' : ''}>${x}</option>`).join('')}
        </select>
        <select id="acct-vendor" aria-label="Current vendor">
          <option value="all">All vendors</option>
          ${allVendors().map((v) => `<option ${ui.vendorFilter === v ? 'selected' : ''}>${esc(v)}</option>`).join('')}
        </select>
        <select id="acct-sort" aria-label="Sort">
          ${Object.entries(SORT_LABELS).map(([k, l]) => `<option value="${k}" ${ui.sort === k ? 'selected' : ''}>Sort: ${l}</option>`).join('')}
        </select>
      </div>
      ${accountCollection(list, state.accounts.length ? 'No accounts match these filters.' : 'No accounts yet. Click "+ New account" to add one.')}`;

    $('#acct-search').addEventListener('input', (e) => {
      ui.search = e.target.value;
      const pos = e.target.selectionStart;
      renderAccounts();
      const el = $('#acct-search'); el.focus(); el.setSelectionRange(pos, pos);
    });
    $('#acct-type').addEventListener('change', (e) => { ui.typeFilter = e.target.value; ui.stageFilter = 'all'; renderAccounts(); });
    $('#acct-stage').addEventListener('change', (e) => { ui.stageFilter = e.target.value; renderAccounts(); });
    $('#acct-sort').addEventListener('change', (e) => { ui.sort = e.target.value; ui.sortDir = 1; renderAccounts(); });
    $('#acct-vendor').addEventListener('change', (e) => { ui.vendorFilter = e.target.value; renderAccounts(); });
    bindCollection();
  }

  function renderAccountRecord() {
    const a = getAccount(ui.recordId);
    $('#view').innerHTML = `
      <div class="record">
        <button class="btn ghost sm back-btn" data-act="back">← Back</button>
        ${a ? accountDetail(a) : '<div class="card empty">This account no longer exists.</div>'}
      </div>`;
  }

  function accountDetail(a) {
    const t = today();
    const history = [...a.activities].sort((x, y) => y.date.localeCompare(x.date) || (y.createdAt || '').localeCompare(x.createdAt || ''));
    const keyDates = [...a.keyDates].sort((x, y) => x.date.localeCompare(y.date));
    const openTasks = state.tasks.filter((x) => x.accountId === a.id && !x.done && x.date >= t)
      .sort((x, y) => (x.date + (x.time || '')).localeCompare(y.date + (y.time || '')));
    const last = lastActivity(a);

    return `
      <div class="card stack">
        <div class="detail-head">
          <div>
            <div class="row"><h1 style="margin:0">${esc(a.name)}</h1><span class="pill ${a.type}">${a.type === 'partner' ? 'Partner' : 'Prospect'}</span><span class="pill">${esc(a.stage)}</span></div>
            ${a.tags ? `<div class="row small muted" style="margin-top:.35rem">${tagList(a).map((x) => `<span class="pill">#${esc(x)}</span>`).join('')}</div>` : ''}
          </div>
          <div class="row">
            <button class="btn" data-act="log" data-id="${a.id}">+ Log activity</button>
            <button class="btn ghost" data-act="new-task" data-id="${a.id}">+ Plan task</button>
            <button class="btn ghost" data-act="edit-account" data-id="${a.id}">Edit</button>
          </div>
        </div>

        <div class="facts">
          <div class="span-all"><span>Current vendors</span>${a.vendors.length ? vendorPills(a) : '—'}</div>
          <div><span>Website</span>${a.website ? `<a href="${esc(/^https?:/.test(a.website) ? a.website : 'https://' + a.website)}" target="_blank" rel="noopener">${esc(a.website)}</a>` : '—'}</div>
          <div><span>Industry</span>${esc(a.industry) || '—'}</div>
          <div><span>${a.type === 'partner' ? 'Annual value' : 'Deal value'}</span>${money(a.value)}</div>
          <div><span>Next follow-up</span>${a.nextFollowUp ? `<span class="pill ${dueClass(a.nextFollowUp)}">${fmtDate(a.nextFollowUp)}</span> <span class="small muted">${relDays(a.nextFollowUp)}</span>` : '—'}</div>
          <div><span>Next revisit</span>${a.revisitDate ? `<span class="pill ${dueClass(a.revisitDate)}">${fmtDate(a.revisitDate)}</span> <span class="small muted">${relDays(a.revisitDate)}</span>${a.revisitNote ? `<div class="small muted">${esc(a.revisitNote)}</div>` : ''}` : '—'}</div>
          <div><span>Last touch</span>${last ? `${fmtDate(last.date)} <span class="small muted">(${esc(last.kind)})</span>` : 'Never'}</div>
          <div><span>Added</span>${fmtDate((a.createdAt || '').slice(0, 10) || null)}</div>
        </div>

        <div>
          <div class="section-head"><h2 style="margin:0">Contacts <span class="muted small">(${a.contacts.length})</span></h2><button class="btn sm ghost" data-act="new-contact" data-id="${a.id}">+ Add contact</button></div>
          ${a.contacts.length ? `<div class="contact-grid">${[...a.contacts].sort((x, y) => (y.primary ? 1 : 0) - (x.primary ? 1 : 0)).map((c) => `
            <div class="contact-card">
              <div class="row spread">
                <div><strong>${esc(c.name)}</strong> ${c.primary ? '<span class="pill primary">Primary</span>' : ''}</div>
                <div class="row" style="gap:0">
                  ${c.primary ? '' : `<button class="icon-btn" data-act="primary-contact" data-id="${a.id}" data-cid="${c.id}" title="Make primary">★</button>`}
                  <button class="icon-btn" data-act="edit-contact" data-id="${a.id}" data-cid="${c.id}" title="Edit">✎</button>
                  <button class="icon-btn" data-act="del-contact" data-id="${a.id}" data-cid="${c.id}" title="Delete">✕</button>
                </div>
              </div>
              ${c.title || c.role ? `<div class="small muted">${esc([c.title, c.role].filter(Boolean).join(' · '))}</div>` : ''}
              ${c.email ? `<div class="small"><a href="mailto:${esc(c.email)}">${esc(c.email)}</a></div>` : ''}
              ${c.phone ? `<div class="small"><a href="tel:${esc(c.phone)}">${esc(c.phone)}</a></div>` : ''}
              ${c.notes ? `<div class="small muted" style="white-space:pre-wrap;margin-top:.25rem">${esc(c.notes)}</div>` : ''}
            </div>`).join('')}</div>` : '<div class="empty">No contacts yet. Add the decision maker, champion, HR lead…</div>'}
        </div>

        <div>
          <div class="section-head"><h2 style="margin:0">Key dates</h2><button class="btn sm ghost" data-act="new-keydate" data-id="${a.id}">+ Add date</button></div>
          ${keyDates.length ? `<ul class="list">${keyDates.map((k) => `
            <li>
              <div class="date-chip ${k.done ? '' : dueClass(k.date)}"><b>${fromISO(k.date).getDate()}</b>${fmtDate(k.date, { month: 'short', year: '2-digit' })}</div>
              <div class="grow">
                <div class="title" style="${k.done ? 'text-decoration:line-through;color:var(--muted)' : ''}">${esc(k.label)}</div>
                <div class="small muted">${k.done ? 'Completed' : relDays(k.date)}${k.note ? ' · ' + esc(k.note) : ''}</div>
              </div>
              <button class="icon-btn" data-act="keydate-toggle" data-id="${a.id}" data-kid="${k.id}" title="${k.done ? 'Reopen' : 'Mark done'}">${k.done ? '↺' : '✓'}</button>
              <button class="icon-btn" data-act="edit-keydate" data-id="${a.id}" data-kid="${k.id}" title="Edit">✎</button>
              <button class="icon-btn" data-act="del-keydate" data-id="${a.id}" data-kid="${k.id}" title="Delete">✕</button>
            </li>`).join('')}</ul>` : '<div class="empty">Track renewals, contract dates, QBRs, decision dates…</div>'}
        </div>

        ${openTasks.length ? `
        <div>
          <h2>Planned tasks</h2>
          <ul class="list">${openTasks.map((x) => `
            <li><div class="date-chip ${dueClass(x.date)}"><b>${fromISO(x.date).getDate()}</b>${fmtDate(x.date, { month: 'short' })}</div>
              <div class="grow"><div class="title">${esc(x.title)}</div><div class="small muted">${x.time ? fmtTime(x.time) + ' · ' : ''}${PRIORITIES[x.priority]} priority</div></div>
              <a class="btn sm ghost" href="#planner/${x.date}">Open day</a></li>`).join('')}</ul>
        </div>` : ''}

        <div>
          <div class="section-head"><h2 style="margin:0">Notes</h2><button class="btn sm ghost" data-act="edit-notes" data-id="${a.id}">Edit notes</button></div>
          ${a.notes ? `<div class="notes-box">${esc(a.notes)}</div>` : '<div class="empty">No account notes yet.</div>'}
        </div>

        <div>
          <div class="section-head"><h2 style="margin:0">History <span class="muted small">(${history.length})</span></h2></div>
          ${history.length ? `<ul class="timeline">${history.map((h) => `
            <li class="${h.date > t ? 'future' : ''}">
              <div class="row spread">
                <div><strong>${esc(h.kind)}</strong> — ${esc(h.summary)}</div>
                <div class="row">
                  <button class="icon-btn" data-act="edit-activity" data-id="${a.id}" data-hid="${h.id}" title="Edit">✎</button>
                  <button class="icon-btn" data-act="del-activity" data-id="${a.id}" data-hid="${h.id}" title="Delete">✕</button>
                </div>
              </div>
              <div class="when">${fmtDate(h.date)} · ${relDays(h.date)}${(() => { const c = h.contactId && a.contacts.find((x) => x.id === h.contactId); return c ? ' · with ' + esc(c.name) : ''; })()}</div>
              ${h.notes ? `<div class="body">${esc(h.notes)}</div>` : ''}
            </li>`).join('')}</ul>` : '<div class="empty">No history yet — log your first call, email or meeting.</div>'}
        </div>

        <div class="row" style="justify-content:flex-end">
          <button class="btn danger sm" data-act="del-account" data-id="${a.id}">Delete account</button>
        </div>
      </div>`;
  }

  // ---------- planner ----------
  function renderPlanner() {
    const d = ui.plannerDate;
    const t = today();
    const day = getDay(d);
    const tasks = state.tasks.filter((x) => x.date === d)
      .sort((x, y) => (x.time || '99').localeCompare(y.time || '99'));
    const unscheduled = tasks.filter((x) => !x.time);
    const doneCount = tasks.filter((x) => x.done).length;
    // Account items due this day; on today's page also pull in anything overdue.
    const due = upcomingItems().filter((i) => i.kind !== 'revisit' && (i.date === d || (d === t && i.date < t)));
    const nowHour = d === t ? new Date().getHours() : -1;

    const hours = [];
    for (let h = DAY_START; h <= DAY_END; h++) hours.push(h);
    const tasksAt = (h) => tasks.filter((x) => x.time && Number(x.time.slice(0, 2)) === h);
    const early = tasks.filter((x) => x.time && Number(x.time.slice(0, 2)) < DAY_START);
    const late = tasks.filter((x) => x.time && Number(x.time.slice(0, 2)) > DAY_END);

    $('#view').innerHTML = `
      <div class="planner-head">
        <div>
          <h1 style="margin:0">${esc(fmtLongDate(d))}</h1>
          <div class="muted">${d === t ? 'Today' : relDays(d)} · ${doneCount}/${tasks.length} tasks done</div>
        </div>
        <div class="row">
          <button class="btn ghost" data-act="day-shift" data-n="-1" title="Previous day">‹</button>
          <input type="date" id="planner-date" value="${d}">
          <button class="btn ghost" data-act="day-shift" data-n="1" title="Next day">›</button>
          ${d !== t ? '<button class="btn ghost" data-act="day-today">Today</button>' : ''}
          <button class="btn" data-act="new-task">+ Task</button>
        </div>
      </div>

      <div class="planner-grid">
        <div class="card">
          <div class="row spread" style="margin-bottom:.5rem">
            <h2 style="margin:0">Schedule</h2>
            <span class="small muted">Click an hour to add a task</span>
          </div>
          ${early.length ? `<div class="stack" style="margin-bottom:.5rem">${early.map(taskCard).join('')}</div>` : ''}
          <div class="schedule">
            ${hours.map((h) => `
              <div class="slot ${h === nowHour ? 'now' : ''}">
                <div class="hour">${fmtTime(pad(h) + ':00')}</div>
                <div class="slot-body" data-act="slot" data-time="${pad(h)}:00">${tasksAt(h).map(taskCard).join('')}</div>
              </div>`).join('')}
          </div>
          ${late.length ? `<div class="stack" style="margin-top:.5rem">${late.map(taskCard).join('')}</div>` : ''}
        </div>

        <div class="stack">
          <div class="card">
            <h3>Progress</h3>
            <div class="progress"><div style="width:${tasks.length ? Math.round((doneCount / tasks.length) * 100) : 0}%"></div></div>
          </div>

          <div class="card priorities">
            <h3>Top 3 priorities</h3>
            ${[0, 1, 2].map((i) => `<input data-prio="${i}" placeholder="Priority ${i + 1}" value="${esc(day.priorities[i] || '')}">`).join('')}
          </div>

          <div class="card">
            <h3>Account follow-ups & dates ${d === t ? '<span class="small muted">(incl. overdue)</span>' : ''}</h3>
            ${due.length ? `<div class="stack">${due.map((i) => `
              <div class="task auto">
                <div class="t-main">
                  <div class="t-title">${esc(i.label)} — <a href="#account/${i.account.id}">${esc(i.account.name)}</a></div>
                  <div class="t-sub">${i.date < d ? `<span class="pill overdue">overdue ${relDays(i.date).replace(' ago', '')}</span>` : ''} ${esc(i.account.stage)}${(() => { const c = primaryContact(i.account); return c ? ' · ' + esc(c.name) + (c.phone ? ' · ' + esc(c.phone) : '') : ''; })()}</div>
                </div>
                ${i.kind === 'followup'
                  ? `<button class="btn sm ghost" data-act="log" data-id="${i.account.id}">Log</button>`
                  : `<button class="btn sm ghost" data-act="keydate-done" data-id="${i.account.id}" data-kid="${i.keyDate.id}">Done</button>`}
              </div>`).join('')}</div>` : '<div class="empty">Nothing due from your accounts.</div>'}
          </div>

          <div class="card">
            <div class="row spread"><h3 style="margin:0">Anytime</h3><button class="btn sm ghost" data-act="new-task" data-time="">+ Add</button></div>
            <div class="stack" style="margin-top:.5rem">${unscheduled.length ? unscheduled.map(taskCard).join('') : '<div class="empty">No unscheduled tasks.</div>'}</div>
          </div>

          <div class="card">
            <h3>Day notes</h3>
            <textarea id="day-notes" rows="6" placeholder="Wins, blockers, ideas, things to remember…">${esc(day.notes)}</textarea>
          </div>

          ${tasks.some((x) => !x.done) ? `
          <button class="btn ghost" data-act="carry-over" style="width:100%">Move unfinished tasks to ${esc(fmtDate(addDays(d, 1), { weekday: 'short', month: 'short', day: 'numeric' }))}</button>` : ''}
        </div>
      </div>

      ${planSection(d)}`;

    $('#planner-date').addEventListener('change', (e) => { if (e.target.value) location.hash = `planner/${e.target.value}`; });
    $$('[data-prio]').forEach((inp) => inp.addEventListener('input', (e) => {
      const dd = { ...getDay(d) };
      dd.priorities = [...dd.priorities];
      dd.priorities[Number(e.target.dataset.prio)] = e.target.value;
      state.days[d] = dd; save();
    }));
    $('#day-notes').addEventListener('input', (e) => {
      state.days[d] = { ...getDay(d), notes: e.target.value }; save();
    });
    $$('.task input[type=checkbox]').forEach((cb) => cb.addEventListener('change', (e) => {
      const task = state.tasks.find((x) => x.id === e.target.dataset.id);
      task.done = e.target.checked; save(); renderPlanner();
    }));
    bindPlan(d);
  }

  // ---------- daily activity plan ----------
  /** Accounts whose revisit falls on day d (or is overdue, on today's page) and aren't already listed. */
  function dueRevisits(d, rows) {
    const listed = new Set(rows.map((r) => r.name.trim().toLowerCase()).filter(Boolean));
    return state.accounts
      .filter((a) => a.revisitDate && (a.revisitDate === d || (d === today() && a.revisitDate < d)) && !listed.has(a.name.trim().toLowerCase()))
      .sort((x, y) => x.revisitDate.localeCompare(y.revisitDate));
  }

  /** Revisit rows as displayed: due accounts are pre-filled into empty slots until you touch them. */
  function revisitRows(d, plan) {
    const rows = plan.revisits.map((r) => ({ ...r }));
    for (const a of dueRevisits(d, plan.revisits)) {
      const auto = { name: a.name, kind: 'Visit', note: a.revisitNote || '', done: false, auto: a.revisitDate };
      const slot = rows.findIndex((r) => !r.name.trim() && !r.auto);
      if (slot === -1) rows.push(auto); else rows[slot] = auto;
    }
    return rows;
  }

  function planSection(d) {
    const plan = getPlan(d);
    plan.revisits = revisitRows(d, plan);
    const total = PLAN_SECTIONS.reduce((n, sec) => n + planStats(plan, sec.key).target, 0);
    const done = PLAN_SECTIONS.reduce((n, sec) => n + planStats(plan, sec.key).done, 0);
    const pending = PLAN_SECTIONS.some((sec) => plan[sec.key].some((r) => r.name.trim() && !r.done));
    const block = (sec) => {
      const st = planStats(plan, sec.key);
      return `
        <details class="plan-block" open>
          <summary>
            <span class="plan-title">${esc(sec.label)}</span>
            <span class="pill" id="plan-count-${sec.key}">${st.done}/${st.target}</span>
          </summary>
          <div class="progress"><div id="plan-bar-${sec.key}" style="width:${Math.round((st.done / st.target) * 100)}%"></div></div>
          <div class="plan-rows">
            ${plan[sec.key].map((r, i) => planRow(sec, r, i)).join('')}
          </div>
          <button class="btn sm ghost" data-act="plan-add" data-sec="${sec.key}">+ Add row</button>
        </details>`;
    };
    const [outreach, ...rest] = PLAN_SECTIONS;
    return `
      <div class="card plan-card">
        <div class="row spread" style="margin-bottom:.75rem">
          <div>
            <h2 style="margin:0">Daily activity plan</h2>
            <div class="small muted">Type an account name (suggestions come from your accounts). Checking off a row for an existing account logs it to that account's history.</div>
          </div>
          <div class="row">
            <span class="pill" id="plan-count-total">${done}/${total} done</span>
            ${pending ? `<button class="btn sm ghost" data-act="plan-carry">Copy unfinished to ${esc(fmtDate(addDays(d, 1), { weekday: 'short', month: 'short', day: 'numeric' }))}</button>` : ''}
          </div>
        </div>
        <datalist id="dl-accounts">${state.accounts.map((a) => `<option value="${esc(a.name)}">`).join('')}</datalist>
        <datalist id="dl-partners">${state.accounts.filter((a) => a.type === 'partner').map((a) => `<option value="${esc(a.name)}">`).join('')}</datalist>
        <div class="plan-grid">
          <div>${block(outreach)}</div>
          <div class="stack">${rest.map(block).join('')}</div>
        </div>
      </div>`;
  }

  function planRow(sec, r, i) {
    const acct = findAccountByName(r.name);
    return `
      <div class="plan-row ${r.done ? 'done' : ''} ${r.auto ? 'auto' : ''}" data-sec="${sec.key}" data-i="${i}" ${r.auto ? `data-auto="${esc(JSON.stringify({ name: r.name, kind: r.kind, note: r.note }))}"` : ''}>
        <span class="plan-num">${i + 1}</span>
        <input type="checkbox" data-plan="done" ${r.done ? 'checked' : ''} aria-label="Done">
        <input data-plan="name" list="${sec.partners ? 'dl-partners' : 'dl-accounts'}" placeholder="Account / contact" value="${esc(r.name)}">
        ${sec.kinds.length > 1
          ? `<select data-plan="kind">${sec.kinds.map((k) => `<option ${k === r.kind ? 'selected' : ''}>${k}</option>`).join('')}</select>`
          : '<span class="plan-kind"></span>'}
        <input data-plan="note" placeholder="Note / outcome" value="${esc(r.note)}">
        <span class="plan-link">${acct ? `<a href="#account/${acct.id}" title="Open ${esc(acct.name)}">↗</a>` : ''}</span>
        ${r.auto ? `<span class="plan-due ${dueClass(r.auto)}">Revisit due ${esc(relDays(r.auto))}</span>` : ''}
      </div>`;
  }

  function bindPlan(d) {
    const rowOf = (el) => {
      const rowEl = el.closest('.plan-row');
      const sec = PLAN_SECTIONS.find((x) => x.key === rowEl.dataset.sec);
      const plan = getPlan(d, true);
      const i = Number(rowEl.dataset.i);
      const rows = plan[sec.key];
      while (rows.length <= i) rows.push(blankPlanRow(sec));
      if (rowEl.dataset.auto) { // first touch on a pre-filled revisit: make it a real row
        Object.assign(rows[i], JSON.parse(rowEl.dataset.auto));
        delete rowEl.dataset.auto;
        rowEl.classList.remove('auto');
      }
      return { rowEl, sec, row: rows[i], plan };
    };

    $$('.plan-row [data-plan]').forEach((el) => {
      const evt = el.type === 'checkbox' || el.tagName === 'SELECT' ? 'change' : 'input';
      el.addEventListener(evt, () => {
        const { rowEl, sec, row, plan } = rowOf(el);
        const field = el.dataset.plan;
        if (field === 'done') {
          row.done = el.checked;
          syncPlanActivity(d, sec, row);
          rowEl.classList.toggle('done', row.done);
          updatePlanCounts(plan);
          if (sec.key === 'revisits') {
            const acct = settleRevisit(d, row);
            if (acct && row.done) { save(); return nextRevisitForm(acct, d); }
          }
        } else {
          row[field] = el.value;
          if (field === 'name') {
            const acct = findAccountByName(row.name);
            $('.plan-link', rowEl).innerHTML = acct ? `<a href="#account/${acct.id}" title="Open ${esc(acct.name)}">↗</a>` : '';
          }
        }
        save();
      });
    });
  }

  /** Completing a revisit clears the account's due revisit date; un-checking puts it back. */
  function settleRevisit(d, row) {
    const acct = findAccountByName(row.name);
    if (!acct) return null;
    if (row.done && acct.revisitDate && acct.revisitDate <= d) {
      row.clearedRevisit = acct.revisitDate;
      acct.revisitDate = '';
      touch(acct);
    } else if (!row.done && row.clearedRevisit) {
      if (!acct.revisitDate) acct.revisitDate = row.clearedRevisit;
      delete row.clearedRevisit;
      touch(acct);
    }
    return acct;
  }

  function nextRevisitForm(acct, d) {
    openModal(`Revisit done: ${acct.name}`, `
      <p class="small muted" style="margin:0">Logged to the account's history. When should you go back?</p>
      <div class="row">
        ${[14, 30, 60, 90].map((n) => `<button type="button" class="btn sm ghost" data-days="${n}">${n} days</button>`).join('')}
      </div>
      <div class="grid-2">
        ${field('Next revisit date', `<input name="revisitDate" type="date" value="${addDays(d, 30)}">`)}
        ${field('Purpose (optional)', `<input name="revisitNote" value="${esc(acct.revisitNote)}" placeholder="e.g. Bring renewal quote">`)}
      </div>`, (data) => {
      acct.revisitDate = data.revisitDate;
      acct.revisitNote = data.revisitNote;
      touch(acct);
      if (data.revisitDate) toast(`Next revisit ${fmtDate(data.revisitDate, { month: 'short', day: 'numeric' })}`);
    }, 'Set revisit');
    $$('[data-days]', modalForm).forEach((b) => b.addEventListener('click', () => {
      $('[name=revisitDate]', modalForm).value = addDays(d, Number(b.dataset.days));
    }));
    $('[data-close]', modalForm).textContent = 'No revisit';
  }

  /** Mirror a checked plan row into the matching account's history (and remove it on uncheck). */
  function syncPlanActivity(d, sec, row) {
    const acct = findAccountByName(row.name);
    if (row.activityId) {
      for (const a of state.accounts) a.activities = a.activities.filter((h) => h.id !== row.activityId);
      delete row.activityId;
    }
    if (row.done && acct) {
      row.activityId = uid();
      acct.activities.push({
        id: row.activityId, date: d, kind: row.kind,
        summary: `${sec.short}${row.note ? ': ' + row.note : ''}`, notes: '', createdAt: new Date().toISOString(),
      });
      touch(acct);
    }
  }

  function updatePlanCounts(plan) {
    let done = 0, total = 0;
    for (const sec of PLAN_SECTIONS) {
      const st = planStats(plan, sec.key);
      done += st.done; total += st.target;
      $(`#plan-count-${sec.key}`).textContent = `${st.done}/${st.target}`;
      $(`#plan-bar-${sec.key}`).style.width = `${Math.round((st.done / st.target) * 100)}%`;
    }
    $('#plan-count-total').textContent = `${done}/${total} done`;
  }

  /** Copy unfinished, named rows into the next day's empty slots (skipping ones already there). */
  function carryPlan(d) {
    const next = addDays(d, 1);
    const from = getPlan(d);
    const to = getPlan(next, true);
    let copied = 0;
    for (const sec of PLAN_SECTIONS) {
      const target = to[sec.key];
      const existing = new Set(target.map((r) => r.name.trim().toLowerCase()).filter(Boolean));
      for (const r of from[sec.key]) {
        const key = r.name.trim().toLowerCase();
        if (!key || r.done || existing.has(key)) continue;
        const copy = { name: r.name, kind: r.kind, note: r.note, done: false };
        const slot = target.findIndex((x) => !x.name.trim());
        if (slot === -1) target.push(copy); else target[slot] = copy;
        existing.add(key); copied++;
      }
    }
    return { next, copied };
  }

  function taskCard(x) {
    const acct = x.accountId && getAccount(x.accountId);
    return `
      <div class="task ${x.priority} ${x.done ? 'done' : ''}" data-act="task">
        <input type="checkbox" data-id="${x.id}" ${x.done ? 'checked' : ''} aria-label="Done">
        <div class="t-main">
          <div class="t-title">${esc(x.title)}</div>
          <div class="t-sub">${x.time ? fmtTime(x.time) : 'Anytime'}${x.duration ? ` · ${x.duration} min` : ''}${acct ? ` · <a href="#account/${acct.id}">${esc(acct.name)}</a>` : ''}${x.priority === 'high' ? ' · <span class="pill high">High</span>' : ''}</div>
          ${x.notes ? `<div class="t-sub" style="white-space:pre-wrap">${esc(x.notes)}</div>` : ''}
        </div>
        <button class="icon-btn" data-act="edit-task" data-tid="${x.id}" title="Edit">✎</button>
        <button class="icon-btn" data-act="del-task" data-tid="${x.id}" title="Delete">✕</button>
      </div>`;
  }

  // ---------- lists ----------
  // Saved lists are filters: an account matches when it meets every filled-in section and any
  // value ticked within a section. Built-in "vendor:<name>" lists group accounts by current vendor.
  const VENDOR_LIST = 'vendor:';
  const emptyCriteria = () => ({ type: 'all', stages: [], tags: [], vendors: [], text: '' });

  function matchesCriteria(a, c) {
    if (c.type !== 'all' && a.type !== c.type) return false;
    if (c.stages.length && !c.stages.includes(a.stage)) return false;
    if (c.tags.length && !tagList(a).some((t) => c.tags.includes(t.toLowerCase()))) return false;
    if (c.vendors.length && !a.vendors.some((v) => c.vendors.includes(v))) return false;
    if (c.text && !haystack(a).includes(c.text.toLowerCase())) return false;
    return true;
  }

  function resolveList(id) {
    if (!id) return null;
    if (id.startsWith(VENDOR_LIST)) {
      const v = id.slice(VENDOR_LIST.length);
      return { id, name: `Current vendor: ${v}`, builtIn: true, criteria: { ...emptyCriteria(), vendors: [v] } };
    }
    return state.lists.find((l) => l.id === id) || null;
  }

  const listAccounts = (list) => sortAccounts(state.accounts.filter((a) => matchesCriteria(a, { ...emptyCriteria(), ...list.criteria })));

  function criteriaSummary(c) {
    const parts = [];
    if (c.type !== 'all') parts.push(c.type === 'partner' ? 'Partners only' : 'Prospects only');
    if (c.vendors.length) {
      parts.push('Vendor: ' + (c.vendors.length > 3 ? `${c.vendors.slice(0, 2).join(' or ')} or ${c.vendors.length - 2} others` : c.vendors.join(' or ')));
    }
    if (c.tags.length) parts.push('Tag: ' + c.tags.map((t) => '#' + t).join(' or '));
    if (c.stages.length) parts.push('Stage: ' + c.stages.join(' or '));
    if (c.text) parts.push(`Contains "${c.text}"`);
    return parts.length ? parts : ['All accounts'];
  }

  function renderLists() {
    const vendorCounts = new Map();
    for (const a of state.accounts) for (const v of a.vendors) vendorCounts.set(v, (vendorCounts.get(v) || 0) + 1);
    const vendorGroups = [...vendorCounts].sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0]));
    if (!resolveList(ui.listId)) ui.listId = state.lists[0] ? state.lists[0].id : vendorGroups[0] ? VENDOR_LIST + vendorGroups[0][0] : null;
    const current = resolveList(ui.listId);
    const item = (id, name, count, sub = '') => `
      <button class="acct-item ${id === ui.listId ? 'active' : ''}" data-act="open-list" data-lid="${esc(id)}">
        <div class="row spread"><span class="name">${esc(name)}</span><span class="pill">${count}</span></div>
        ${sub ? `<div class="meta">${esc(sub)}</div>` : ''}
      </button>`;

    $('#view').innerHTML = `
      <div class="lists-layout">
        <div class="card">
          <div class="row spread" style="margin-bottom:.5rem">
            <h2 style="margin:0">My lists</h2>
            <button class="btn sm" data-act="new-list">+ New list</button>
          </div>
          <div class="acct-list" style="max-height:none">
            ${state.lists.length
              ? state.lists.map((l) => item(l.id, l.name, listAccounts(l).length, criteriaSummary({ ...emptyCriteria(), ...l.criteria }).join(' · '))).join('')
              : '<div class="empty">Create a list from tags, vendors, stages or type, e.g. "Prospects on ADP TotalSource".</div>'}
          </div>
          <h3 style="margin-top:1rem">By current vendor</h3>
          <div class="acct-list" style="max-height:none">
            ${vendorGroups.length
              ? vendorGroups.map(([v, n]) => item(VENDOR_LIST + v, v, n)).join('')
              : '<div class="empty">Add current vendors on your accounts to group them here.</div>'}
          </div>
        </div>
        <div>${current ? listDetail(current) : '<div class="card empty">Create a list, or pick a vendor group.</div>'}</div>
      </div>`;
    const sortSel = $('#list-sort');
    if (sortSel) sortSel.addEventListener('change', (e) => { ui.sort = e.target.value; ui.sortDir = 1; renderLists(); });
    bindCollection();
  }

  function listDetail(list) {
    const rows = listAccounts(list);
    const c = { ...emptyCriteria(), ...list.criteria };
    return `
      <div class="card stack list-head">
        <div class="detail-head">
          <div>
            <h1 style="margin:0">${esc(list.name)} <span class="muted small">(${rows.length})</span></h1>
            <div class="row" style="margin-top:.4rem">${criteriaSummary(c).map((x) => `<span class="pill wrap">${esc(x)}</span>`).join('')}</div>
          </div>
          <div class="row">
            <button class="btn ghost" data-act="list-csv">Export CSV</button>
            ${list.builtIn ? '' : `
              <button class="btn ghost" data-act="edit-list" data-lid="${list.id}">Edit</button>
              <button class="btn danger" data-act="del-list" data-lid="${list.id}">Delete</button>`}
          </div>
        </div>
        <div class="row spread">${viewSwitcher()}
          <select id="list-sort" aria-label="Sort">${Object.entries(SORT_LABELS).map(([k, l]) => `<option value="${k}" ${ui.sort === k ? 'selected' : ''}>Sort: ${l}</option>`).join('')}</select>
        </div>
      </div>
      <div class="list-results">${accountCollection(rows, 'No accounts match this list yet.')}</div>`;
  }

  const readCriteria = (fd) => ({
    type: fd.get('type') || 'all', vendors: fd.getAll('vendors'), tags: fd.getAll('tags'),
    stages: fd.getAll('stages'), text: (fd.get('text') || '').trim(),
  });

  function listForm(existing) {
    const l = existing || { name: '', criteria: emptyCriteria() };
    const c = { ...emptyCriteria(), ...l.criteria };
    const checks = (name, values, chosen, label = (v) => v) => values.length
      ? `<div class="check-grid">${values.map((v) => `<label><input type="checkbox" name="${name}" value="${esc(v)}" ${chosen.includes(v) ? 'checked' : ''}> ${esc(label(v))}</label>`).join('')}</div>`
      : '<div class="small muted">None in use yet. Add tags on your accounts.</div>';
    openModal(existing ? 'Edit list' : 'New list', `
      ${field('List name *', `<input name="name" required value="${esc(l.name)}" placeholder="e.g. Prospects on ADP TotalSource">`)}
      <p class="small muted" style="margin:0">Accounts are included when they match <strong>every</strong> section you fill in,
        and <strong>any</strong> box ticked within a section. Leave a section empty to ignore it. Lists update automatically.</p>
      ${field('Account type', `<select name="type">${opt('all', 'Partners & prospects', c.type)}${opt('prospect', 'Prospects only', c.type)}${opt('partner', 'Partners only', c.type)}</select>`)}
      <div class="field"><span>Current vendor is any of</span>${checks('vendors', allVendors(), c.vendors)}</div>
      <div class="field"><span>Tagged with any of</span>${checks('tags', allTags(), c.tags, (t) => '#' + t)}</div>
      <div class="field"><span>Stage is any of</span>${checks('stages', [...STAGES.prospect, ...STAGES.partner], c.stages)}</div>
      ${field('Name, contacts or notes contain', `<input name="text" value="${esc(c.text)}">`)}
      <div class="small" id="list-preview"></div>`, (data, fd) => {
      if (!data.name.trim()) return false;
      const criteria = readCriteria(fd);
      if (existing) Object.assign(existing, { name: data.name.trim(), criteria });
      else {
        const created = { id: uid(), name: data.name.trim(), criteria };
        state.lists.push(created);
        ui.listId = created.id;
        location.hash = `lists/${created.id}`;
      }
      toast(existing ? 'List updated' : 'List created');
    });
    const preview = () => {
      const n = state.accounts.filter((a) => matchesCriteria(a, readCriteria(new FormData(modalForm)))).length;
      $('#list-preview').innerHTML = `Currently matches <strong>${n}</strong> account${n === 1 ? '' : 's'}.`;
    };
    modalForm.oninput = preview;
    preview();
  }

  function exportListCsv() {
    const list = resolveList(ui.listId);
    if (!list) return;
    const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows = [['Account', 'Type', 'Stage', 'Industry', 'Value', 'Current vendors', 'Primary contact', 'Title', 'Email', 'Phone', 'Other contacts', 'Next follow-up', 'Next revisit', 'Revisit purpose', 'Tags']];
    for (const a of listAccounts(list)) {
      const p = primaryContact(a) || {};
      rows.push([a.name, a.type, a.stage, a.industry, a.value, a.vendors.join('; '), p.name, p.title, p.email, p.phone,
        a.contacts.filter((x) => x.id !== p.id).map((x) => x.name).join('; '), a.nextFollowUp, a.revisitDate, a.revisitNote, a.tags]);
    }
    downloadFile(`${list.name.replace(/[^\w-]+/g, '-')}-${today()}.csv`, rows.map((r) => r.map(cell).join(',')).join('\r\n'), 'text/csv');
  }

  // ---------- modal ----------
  const modal = $('#modal');
  const modalForm = $('#modal-form');
  let modalSubmit = null;

  function openModal(title, bodyHtml, onSubmit, submitLabel = 'Save') {
    modalForm.innerHTML = `
      <h2>${esc(title)}</h2>
      <div class="stack" style="margin-top:.75rem">${bodyHtml}</div>
      <div class="modal-actions">
        <button type="button" class="btn ghost" data-close>Cancel</button>
        <button type="submit" class="btn">${esc(submitLabel)}</button>
      </div>`;
    modalSubmit = onSubmit;
    modalForm.oninput = null;
    modal.showModal();
    const first = modalForm.querySelector('input:not([type=hidden]), select, textarea');
    if (first) first.focus();
  }

  modalForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(modalForm);
    const data = Object.fromEntries(fd.entries());
    if (modalSubmit && modalSubmit(data, fd) === false) return;
    modal.close(); save(); rerender();
  });
  modal.addEventListener('close', () => { if (sync.again) scheduleSync(300); });
  modalForm.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) modal.close(); });

  const field = (label, html, cls = '') => `<label class="field ${cls}"><span>${label}</span>${html}</label>`;
  const opt = (v, label, cur) => `<option value="${esc(v)}" ${v === cur ? 'selected' : ''}>${esc(label)}</option>`;
  const accountOptions = (cur) => `<option value="">— none —</option>` +
    [...state.accounts].sort((a, b) => a.name.localeCompare(b.name)).map((a) => opt(a.id, a.name, cur)).join('');

  function accountForm(existing) {
    const a = existing || { type: 'prospect', stage: 'New' };
    openModal(existing ? 'Edit account' : 'New account', `
      <div class="grid-2">
        ${field('Account name *', `<input name="name" required value="${esc(a.name)}">`)}
        ${field('Type', `<select name="type" id="f-type">${opt('prospect', 'Prospect', a.type)}${opt('partner', 'Partner', a.type)}</select>`)}
        ${field('Stage / status', `<select name="stage" id="f-stage">${STAGES[a.type].map((s) => opt(s, s, a.stage)).join('')}</select>`)}
        ${field(a.type === 'partner' ? 'Annual value ($)' : 'Deal value ($)', `<input name="value" type="number" min="0" step="any" value="${esc(a.value)}">`)}
        ${existing ? '' : `
        ${field('Primary contact', `<input name="c_name">`)}
        ${field('Contact title', `<input name="c_title">`)}
        ${field('Contact email', `<input name="c_email" type="email">`)}
        ${field('Contact phone', `<input name="c_phone" type="tel">`)}
        <div class="small muted span-2">You can add more contacts from the account page.</div>`}
        <div class="field span-2"><span>Current vendors</span>${vendorPicker(a.vendors || [])}</div>
        ${field('Website', `<input name="website" value="${esc(a.website)}">`)}
        ${field('Industry', `<input name="industry" value="${esc(a.industry)}">`)}
        ${field('Next follow-up', `<input name="nextFollowUp" type="date" value="${esc(a.nextFollowUp)}">`)}
        ${field('Next revisit date', `<input name="revisitDate" type="date" value="${esc(a.revisitDate)}">`)}
        ${field('Revisit purpose', `<input name="revisitNote" value="${esc(a.revisitNote)}" placeholder="e.g. Drop off benefits comparison">`)}
        ${field('Tags (comma separated)', `<input name="tags" value="${esc(a.tags)}">`)}
        ${field('Notes', `<textarea name="notes" rows="4">${esc(a.notes)}</textarea>`, 'span-2')}
      </div>`, (data) => {
      if (!data.name.trim()) return false;
      const { c_name, c_title, c_email, c_phone, ...fields } = data;
      fields.vendors = JSON.parse(fields.vendors || '[]');
      if (existing) {
        Object.assign(existing, fields); touch(existing);
        toast('Account updated');
      } else {
        const now = new Date().toISOString();
        const contacts = c_name || c_email || c_phone
          ? [{ id: uid(), name: c_name || c_email || c_phone, title: c_title, email: c_email, phone: c_phone, role: '', notes: '', primary: true }] : [];
        const acct = { id: uid(), ...fields, contacts, activities: [], keyDates: [], createdAt: now, updatedAt: now };
        state.accounts.push(acct);
        location.hash = `account/${acct.id}`;
        toast('Account created');
      }
    });
    $('#f-type').addEventListener('change', (e) => {
      $('#f-stage').innerHTML = STAGES[e.target.value].map((s) => opt(s, s, '')).join('');
    });
    bindVendorPicker();
  }

  /** Chips + dropdown for an account's current vendors; the chosen list lives in a hidden input. */
  function vendorPicker(selected) {
    return `
      <div class="vendor-picker">
        <input type="hidden" name="vendors" id="vp-value" value="${esc(JSON.stringify(selected))}">
        <div class="row" id="vp-chips"></div>
        <div class="row" style="margin-top:.35rem">
          <select id="vp-select" style="flex:1"></select>
        </div>
        <div class="row" id="vp-other" hidden style="margin-top:.35rem">
          <input id="vp-other-input" placeholder="Vendor name" style="flex:1">
          <button type="button" class="btn sm" id="vp-other-add">Add</button>
        </div>
      </div>`;
  }

  function bindVendorPicker() {
    const value = $('#vp-value');
    const get = () => JSON.parse(value.value);
    const set = (list) => { value.value = JSON.stringify(list); draw(); };
    const add = (v) => { v = v.trim(); if (v && !get().includes(v)) set([...get(), v]); };
    function draw() {
      const chosen = get();
      $('#vp-chips').innerHTML = chosen.length
        ? chosen.map((v, i) => `<span class="pill vendor chip">${esc(v)} <button type="button" class="chip-x" data-i="${i}" aria-label="Remove ${esc(v)}">✕</button></span>`).join('')
        : '<span class="small muted">No vendors selected</span>';
      $('#vp-select').innerHTML = `<option value="">+ Add a current vendor…</option>
        <optgroup label="Top TriNet competitors">${COMPETITORS.filter((v) => !chosen.includes(v)).map((v) => `<option>${esc(v)}</option>`).join('')}</optgroup>
        ${allVendors().filter((v) => !COMPETITORS.includes(v) && !chosen.includes(v)).map((v) => `<option>${esc(v)}</option>`).join('')}
        <option value="__other">Other (type a name)…</option>`;
    }
    $('#vp-chips').addEventListener('click', (e) => {
      const x = e.target.closest('.chip-x');
      if (x) set(get().filter((_, i) => i !== Number(x.dataset.i)));
    });
    $('#vp-select').addEventListener('change', (e) => {
      const v = e.target.value;
      if (v === '__other') { $('#vp-other').hidden = false; $('#vp-other-input').focus(); e.target.value = ''; return; }
      if (v) add(v);
    });
    const addOther = () => { add($('#vp-other-input').value); $('#vp-other-input').value = ''; $('#vp-other').hidden = true; };
    $('#vp-other-add').addEventListener('click', addOther);
    $('#vp-other-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addOther(); } });
    draw();
  }

  function contactForm(acct, existing) {
    const c = existing || { primary: acct.contacts.length === 0 };
    openModal(`${existing ? 'Edit' : 'Add'} contact — ${acct.name}`, `
      <div class="grid-2">
        ${field('Name *', `<input name="name" required value="${esc(c.name)}">`)}
        ${field('Title', `<input name="title" value="${esc(c.title)}" placeholder="e.g. HR Director">`)}
        ${field('Email', `<input name="email" type="email" value="${esc(c.email)}">`)}
        ${field('Phone', `<input name="phone" type="tel" value="${esc(c.phone)}">`)}
        ${field('Role in deal', `<select name="role"><option value="">—</option>${CONTACT_ROLES.map((r) => opt(r, r, c.role)).join('')}</select>`)}
        <label class="row small" style="align-self:end"><input type="checkbox" name="primary" style="width:auto" ${c.primary ? 'checked' : ''}> Primary contact</label>
        ${field('Notes', `<textarea name="notes" rows="3">${esc(c.notes)}</textarea>`, 'span-2')}
      </div>`, (data) => {
      if (!data.name.trim()) return false;
      const fields = { name: data.name, title: data.title, email: data.email, phone: data.phone, role: data.role, notes: data.notes, primary: !!data.primary };
      let target = existing;
      if (existing) Object.assign(existing, fields);
      else acct.contacts.push(target = { id: uid(), ...fields });
      if (target.primary) acct.contacts.forEach((x) => { if (x !== target) x.primary = false; });
      else if (!acct.contacts.some((x) => x.primary)) acct.contacts[0].primary = true;
      touch(acct);
      toast(existing ? 'Contact updated' : 'Contact added');
    });
  }

  function activityForm(acct, existing) {
    const h = existing || { date: today(), kind: 'Call' };
    openModal(`${existing ? 'Edit' : 'Log'} activity — ${acct.name}`, `
      <div class="grid-2">
        ${field('Date', `<input name="date" type="date" required value="${esc(h.date)}">`)}
        ${field('Type', `<select name="kind">${ACTIVITY_KINDS.map((k) => opt(k, k, h.kind)).join('')}</select>`)}
        ${acct.contacts.length ? field('With contact', `<select name="contactId"><option value="">—</option>${acct.contacts.map((c) => opt(c.id, c.name, h.contactId ?? (primaryContact(acct) || {}).id)).join('')}</select>`, 'span-2') : ''}
        ${field('Summary *', `<input name="summary" required placeholder="e.g. Discovery call with VP Sales" value="${esc(h.summary)}">`, 'span-2')}
        ${field('Notes', `<textarea name="notes" rows="5" placeholder="What was discussed, decisions, objections, next steps…">${esc(h.notes)}</textarea>`, 'span-2')}
        ${existing ? '' : `
        ${field('Set next follow-up', `<input name="nextFollowUp" type="date" value="${esc(acct.nextFollowUp && acct.nextFollowUp > today() ? acct.nextFollowUp : addDays(today(), 7))}">`)}
        ${field('Update stage', `<select name="stage">${STAGES[acct.type].map((s) => opt(s, s, acct.stage)).join('')}</select>`)}
        <label class="row span-2 small"><input type="checkbox" name="addTask" style="width:auto"> Also add the follow-up to my daily planner</label>`}
      </div>`, (data) => {
      if (!data.summary.trim()) return false;
      if (existing) {
        Object.assign(existing, { date: data.date, kind: data.kind, summary: data.summary, notes: data.notes, contactId: data.contactId || '' });
      } else {
        acct.activities.push({ id: uid(), date: data.date, kind: data.kind, summary: data.summary, notes: data.notes, contactId: data.contactId || '', createdAt: new Date().toISOString() });
        acct.nextFollowUp = data.nextFollowUp || '';
        acct.stage = data.stage;
        if (data.addTask && data.nextFollowUp) {
          state.tasks.push({ id: uid(), date: data.nextFollowUp, time: '', title: `Follow up: ${acct.name}`, accountId: acct.id, priority: 'med', notes: data.summary, done: false });
        }
      }
      touch(acct);
      toast(existing ? 'Activity updated' : 'Activity logged');
    });
  }

  function keyDateForm(acct, existing) {
    const k = existing || { date: addDays(today(), 30) };
    const presets = ['Renewal', 'Contract end', 'QBR', 'Decision date', 'Proposal due', 'Kickoff', 'Onboarding complete', 'Check-in'];
    openModal(`${existing ? 'Edit' : 'Add'} key date — ${acct.name}`, `
      <div class="grid-2">
        ${field('What', `<input name="label" required list="kd-presets" value="${esc(k.label)}" placeholder="e.g. Contract renewal"><datalist id="kd-presets">${presets.map((p) => `<option value="${p}">`).join('')}</datalist>`)}
        ${field('Date', `<input name="date" type="date" required value="${esc(k.date)}">`)}
        ${field('Note', `<input name="note" value="${esc(k.note)}">`, 'span-2')}
      </div>`, (data) => {
      if (existing) Object.assign(existing, data);
      else acct.keyDates.push({ id: uid(), ...data, done: false });
      touch(acct);
    });
  }

  function taskForm(existing, preset = {}) {
    const x = existing || { date: ui.plannerDate, time: '', priority: 'med', accountId: '', ...preset };
    openModal(existing ? 'Edit task' : 'New planner task', `
      <div class="grid-2">
        ${field('Task *', `<input name="title" required value="${esc(x.title)}" placeholder="e.g. Prep proposal for Acme">`, 'span-2')}
        ${field('Date', `<input name="date" type="date" required value="${esc(x.date)}">`)}
        ${field('Time (blank = anytime)', `<input name="time" type="time" value="${esc(x.time)}">`)}
        ${field('Duration (min)', `<input name="duration" type="number" min="0" step="5" value="${esc(x.duration)}">`)}
        ${field('Priority', `<select name="priority">${Object.entries(PRIORITIES).map(([v, l]) => opt(v, l, x.priority)).join('')}</select>`)}
        ${field('Related account', `<select name="accountId">${accountOptions(x.accountId)}</select>`, 'span-2')}
        ${field('Notes', `<textarea name="notes" rows="3">${esc(x.notes)}</textarea>`, 'span-2')}
      </div>`, (data) => {
      if (!data.title.trim()) return false;
      if (existing) Object.assign(existing, data);
      else state.tasks.push({ id: uid(), ...data, done: false });
      toast(existing ? 'Task updated' : 'Task added');
    });
  }

  function notesForm(acct) {
    openModal(`Notes — ${acct.name}`, field('Account notes', `<textarea name="notes" rows="12">${esc(acct.notes)}</textarea>`),
      (data) => { acct.notes = data.notes; touch(acct); });
  }

  // ---------- actions ----------
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]');
    if (!el || el.closest('#modal-form')) return;
    const { act, id, kid, hid, tid, cid } = el.dataset;
    const acct = id && getAccount(id);

    switch (act) {
      case 'new-account': return accountForm();
      case 'edit-account': return accountForm(acct);
      case 'del-account':
        if (confirm(`Delete ${acct.name} and all its history? Planner tasks will be unlinked.`)) {
          state.accounts = state.accounts.filter((a) => a.id !== id);
          state.tasks.forEach((x) => { if (x.accountId === id) x.accountId = ''; });
          save(); go('accounts');
        }
        return;
      case 'open-account':
        if (e.target.closest('a, select, input')) return;
        return go(`account/${id}`);
      case 'back': return ui.navs > 0 ? history.back() : go('accounts');
      case 'set-view': ui.accountView = el.dataset.mode; savePrefs(); return rerender();
      case 'board-type': ui.boardType = el.dataset.type; savePrefs(); return rerender();
      case 'sort':
        if (ui.sort === el.dataset.key) ui.sortDir = -ui.sortDir; else { ui.sort = el.dataset.key; ui.sortDir = 1; }
        return rerender();
      case 'edit-notes': return notesForm(acct);
      case 'log': return activityForm(acct);
      case 'edit-activity': return activityForm(acct, acct.activities.find((h) => h.id === hid));
      case 'del-activity':
        if (confirm('Delete this history entry?')) {
          acct.activities = acct.activities.filter((h) => h.id !== hid); touch(acct); save(); rerender();
        }
        return;
      case 'new-keydate': return keyDateForm(acct);
      case 'edit-keydate': return keyDateForm(acct, acct.keyDates.find((k) => k.id === kid));
      case 'keydate-toggle':
      case 'keydate-done': {
        const k = acct.keyDates.find((x) => x.id === kid);
        k.done = act === 'keydate-done' ? true : !k.done;
        if (k.done) acct.activities.push({ id: uid(), date: today(), kind: 'Note', summary: `Completed: ${k.label}`, notes: k.note || '', createdAt: new Date().toISOString() });
        touch(acct); save(); rerender(); return;
      }
      case 'del-keydate':
        if (confirm('Delete this key date?')) {
          acct.keyDates = acct.keyDates.filter((k) => k.id !== kid); touch(acct); save(); rerender();
        }
        return;
      case 'new-task': return taskForm(null, { ...(id ? { accountId: id } : {}), ...(el.dataset.time !== undefined ? { time: el.dataset.time } : {}) });
      case 'slot': return taskForm(null, { time: el.dataset.time });
      case 'edit-task': return taskForm(state.tasks.find((x) => x.id === tid));
      case 'del-task':
        state.tasks = state.tasks.filter((x) => x.id !== tid); save(); rerender(); return;
      case 'day-shift': return go(`planner/${addDays(ui.plannerDate, Number(el.dataset.n))}`);
      case 'day-today': return go(`planner/${today()}`);
      case 'carry-over': {
        const next = addDays(ui.plannerDate, 1);
        const moving = state.tasks.filter((x) => x.date === ui.plannerDate && !x.done);
        moving.forEach((x) => { x.date = next; });
        save(); toast(`Moved ${moving.length} task${moving.length === 1 ? '' : 's'} to ${fmtDate(next, { month: 'short', day: 'numeric' })}`); rerender();
        return;
      }
      case 'plan-add': {
        const sec = PLAN_SECTIONS.find((x) => x.key === el.dataset.sec);
        getPlan(ui.plannerDate, true)[sec.key].push(blankPlanRow(sec));
        save(); rerender(); return;
      }
      case 'plan-carry': {
        const { next, copied } = carryPlan(ui.plannerDate);
        save(); rerender();
        toast(`Copied ${copied} item${copied === 1 ? '' : 's'} to ${fmtDate(next, { month: 'short', day: 'numeric' })}`);
        return;
      }
      case 'new-contact': return contactForm(acct);
      case 'edit-contact': return contactForm(acct, acct.contacts.find((c) => c.id === cid));
      case 'primary-contact':
        acct.contacts.forEach((c) => { c.primary = c.id === cid; }); touch(acct); save(); rerender(); return;
      case 'del-contact': {
        const c = acct.contacts.find((x) => x.id === cid);
        if (!confirm(`Remove ${c.name} from ${acct.name}?`)) return;
        acct.contacts = acct.contacts.filter((x) => x.id !== cid);
        if (c.primary && acct.contacts[0]) acct.contacts[0].primary = true;
        touch(acct); save(); rerender(); return;
      }
      case 'open-list': ui.listId = el.dataset.lid; return go(`lists/${encodeURIComponent(el.dataset.lid)}`);
      case 'new-list': return listForm();
      case 'edit-list': return listForm(state.lists.find((l) => l.id === el.dataset.lid));
      case 'del-list': {
        const l = state.lists.find((x) => x.id === el.dataset.lid);
        if (!confirm(`Delete the list "${l.name}"? Accounts are not affected.`)) return;
        state.lists = state.lists.filter((x) => x !== l); ui.listId = null; save(); go('lists'); return;
      }
      case 'list-csv': return exportListCsv();
      case 'load-sample': loadSample(); return;
      case 'erase-all': eraseAll(); return;
    }
  });

  // ---------- import / export ----------
  async function downloadFile(name, text, type) {
    const blob = new Blob([text], { type });
    // On phones, the share sheet ("Save to Files") is more reliable than a download link.
    const file = new File([blob], name, { type });
    if (matchMedia('(pointer: coarse)').matches && navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: name }); } catch (e) { /* cancelled */ }
      return;
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  $('#btn-export').addEventListener('click', () =>
    downloadFile(`minicrm-backup-${today()}.json`, JSON.stringify(state, null, 2), 'application/json'));

  $('#file-import').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!Array.isArray(data.accounts)) throw new Error('missing accounts');
      if (!confirm('Replace all current data with this backup?')) return;
      // Keep tombstones so the restore also replaces the copy on other synced devices.
      state = normalize({ ...data, deleted: { ...state.deleted, ...(data.deleted || {}) } });
      save(); toast('Backup restored'); rerender();
    } catch (err) {
      alert('That file is not a valid Mini CRM backup.');
    }
  });

  // ---------- sample data ----------
  function loadSample() {
    const t = today();
    const now = new Date().toISOString();
    const act = (days, kind, summary, notes = '') => ({ id: uid(), date: addDays(t, days), kind, summary, notes, createdAt: now });
    const kd = (days, label, note = '') => ({ id: uid(), date: addDays(t, days), label, note, done: false });
    const mk = (o) => ({ id: uid(), createdAt: addDays(t, -60) + 'T09:00:00.000Z', updatedAt: now, tags: '', notes: '', website: '', ...o });

    const northwind = mk({
      name: 'Northwind Logistics', type: 'prospect', stage: 'Proposal', contact: 'Dana Ortiz', title: 'VP Operations',
      email: 'dana@northwind.example', phone: '555-0142', industry: 'Logistics', value: 48000, tags: 'enterprise, q4',
      nextFollowUp: t, notes: 'Evaluating 3 vendors. Budget approved for Q1. Champion is Dana; CFO signs off.',
      activities: [act(-21, 'Call', 'Intro call', 'Pain: manual dispatch scheduling.'), act(-12, 'Demo', 'Product demo to ops team', 'Strong interest in routing module.'), act(-3, 'Email', 'Sent proposal v1')],
      keyDates: [kd(9, 'Decision date', 'CFO review'), kd(20, 'Proposal expires')],
    });
    const brightpath = mk({
      name: 'BrightPath Consulting', type: 'partner', stage: 'Active', contact: 'Sam Lee', title: 'Partner Manager',
      email: 'sam@brightpath.example', phone: '555-0188', industry: 'Consulting', value: 120000, tags: 'referral, reseller',
      nextFollowUp: addDays(t, 2), notes: 'Referral partner — sends ~2 qualified leads/month. 15% rev share.',
      activities: [act(-90, 'Meeting', 'Partnership kickoff'), act(-30, 'Meeting', 'Quarterly business review', 'Agreed on co-marketing webinar.'), act(-5, 'Email', 'Shared new pitch deck')],
      keyDates: [kd(5, 'Co-marketing webinar'), kd(45, 'QBR'), kd(150, 'Partner agreement renewal')],
    });
    const helix = mk({
      name: 'Helix Health', type: 'prospect', stage: 'Contacted', contact: 'Priya Natarajan', title: 'Director of IT',
      email: 'priya@helix.example', industry: 'Healthcare', value: 30000, tags: 'mid-market',
      nextFollowUp: addDays(t, -2), notes: 'Inbound from webinar. Needs HIPAA details.',
      activities: [act(-8, 'Email', 'Replied to inbound inquiry')], keyDates: [],
    });
    const summit = mk({
      name: 'Summit Tech Alliance', type: 'partner', stage: 'Onboarding', contact: 'Jordan Blake', title: 'Alliances Lead',
      email: 'jordan@summit.example', phone: '555-0110', industry: 'Software', value: 60000, tags: 'integration',
      nextFollowUp: addDays(t, 6), activities: [act(-14, 'Meeting', 'Signed partner agreement')],
      keyDates: [kd(1, 'Technical onboarding session'), kd(30, 'Onboarding complete')],
    });
    const oak = mk({
      name: 'Oak & Iron Manufacturing', type: 'prospect', stage: 'New', contact: 'Chris Mendez', industry: 'Manufacturing',
      value: 22000, nextFollowUp: '', activities: [], keyDates: [],
    });

    [northwind, brightpath, helix, summit, oak].forEach(migrateAccount);
    const contact = (name, title, role, email = '', phone = '') => ({ id: uid(), name, title, role, email, phone, notes: '', primary: false });
    northwind.contacts[0].role = 'Champion';
    northwind.contacts.push(contact('Mark Chen', 'CFO', 'Decision maker', 'mark@northwind.example'), contact('Lisa Park', 'HR Manager', 'Influencer', 'lisa@northwind.example', '555-0143'));
    helix.contacts.push(contact('Tom Reyes', 'COO', 'Decision maker', 'tom@helix.example'));
    northwind.vendors = ['ADP TotalSource'];
    helix.vendors = ['Paychex PEO', 'Gusto'];
    oak.vendors = ['Insperity'];
    summit.vendors = ['Justworks'];
    state.accounts.push(northwind, brightpath, helix, summit, oak);
    state.lists.push(
      { id: uid(), name: 'Prospects on a competitor PEO', criteria: { ...emptyCriteria(), type: 'prospect', vendors: COMPETITORS } },
      { id: uid(), name: 'Enterprise accounts', criteria: { ...emptyCriteria(), tags: ['enterprise'] } },
    );
    state.tasks.push(
      { id: uid(), date: t, time: '09:00', duration: 30, title: 'Pipeline review & inbox', accountId: '', priority: 'med', notes: '', done: false },
      { id: uid(), date: t, time: '10:30', duration: 45, title: 'Proposal walkthrough with Dana', accountId: northwind.id, priority: 'high', notes: 'Bring pricing options A/B', done: false },
      { id: uid(), date: t, time: '14:00', duration: 30, title: 'Call Priya re: HIPAA questions', accountId: helix.id, priority: 'high', notes: '', done: false },
      { id: uid(), date: t, time: '', title: 'Research Oak & Iron decision makers', accountId: oak.id, priority: 'low', notes: '', done: false },
      { id: uid(), date: addDays(t, 1), time: '11:00', duration: 60, title: 'Summit technical onboarding', accountId: summit.id, priority: 'med', notes: '', done: false },
    );
    state.days[t] = { priorities: ['Move Northwind to Negotiation', 'Unblock Helix on HIPAA', 'Prep BrightPath webinar'], notes: '' };
    const plan = getPlan(t, true);
    Object.assign(plan.outreach[0], { name: 'Helix Health', kind: 'Call', note: 'HIPAA follow-up' });
    Object.assign(plan.outreach[1], { name: 'Oak & Iron Manufacturing', kind: 'LinkedIn', note: 'Connect with Chris' });
    Object.assign(plan.outreach[2], { name: 'Northwind Logistics', kind: 'Email', note: 'Send pricing options' });
    Object.assign(plan.visits[0], { name: 'Northwind Logistics', note: 'Drop off proposal binder' });
    Object.assign(plan.channel[0], { name: 'BrightPath Consulting', kind: 'Call', note: 'Webinar prep' });
    Object.assign(plan.channel[1], { name: 'Summit Tech Alliance', kind: 'Email', note: 'Onboarding agenda' });
    helix.revisitDate = t; helix.revisitNote = 'Bring security packet';
    oak.revisitDate = addDays(t, -1); oak.revisitNote = 'Meet plant HR lead';
    northwind.revisitDate = addDays(t, 10); northwind.revisitNote = 'Benefits comparison review';
    save(); toast('Sample data loaded'); rerender();
  }

  // ---------- cloud sync (private GitHub repository) ----------
  const SYNC_KEY = 'minicrm.sync';
  const SYNC_FILE = 'minicrm-data.json';
  const sync = { status: 'off', message: '', last: null, timer: null, running: false, again: false, needsRender: false };
  let syncCfg = null;
  try { syncCfg = JSON.parse(localStorage.getItem(SYNC_KEY)); } catch (e) { /* none */ }

  const b64encode = (str) => {
    const bytes = new TextEncoder().encode(str);
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  };
  const b64decode = (b64) => new TextDecoder().decode(Uint8Array.from(atob(b64.replace(/\s/g, '')), (c) => c.charCodeAt(0)));

  function gh(path, opts = {}, cfg = syncCfg) {
    return fetch(`https://api.github.com${path}`, {
      ...opts,
      cache: 'no-store',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${cfg.token}`,
        ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
      },
    });
  }

  async function ghError(res) {
    let detail = '';
    try { detail = (await res.json()).message || ''; } catch (e) { /* no body */ }
    const msg = res.status === 401 ? 'GitHub token is invalid or expired. Reconnect sync with a new token.'
      : res.status === 403 ? `GitHub refused access (${detail || 'permission denied'}). The token needs Contents: Read and write.`
      : res.status === 404 ? 'Repository not found. Check the name, and that the token was given access to it.'
      : `GitHub error ${res.status}${detail ? ': ' + detail : ''}`;
    return Object.assign(new Error(msg), { status: res.status });
  }

  async function pullRemote(cfg = syncCfg) {
    const res = await gh(`/repos/${cfg.repo}/contents/${SYNC_FILE}`, {}, cfg);
    if (res.status === 404) return null;
    if (!res.ok) throw await ghError(res);
    const meta = await res.json();
    let content = meta.content;
    if (!content) { // files over 1 MB come back without inline content
      const blob = await gh(`/repos/${cfg.repo}/git/blobs/${meta.sha}`, {}, cfg);
      if (!blob.ok) throw await ghError(blob);
      content = (await blob.json()).content;
    }
    return { sha: meta.sha, data: normalize(JSON.parse(b64decode(content))) };
  }

  /** Returns the new sha, or null when the file changed underneath us (caller re-pulls). */
  async function pushRemote(payload, sha) {
    const res = await gh(`/repos/${syncCfg.repo}/contents/${SYNC_FILE}`, {
      method: 'PUT',
      body: JSON.stringify({
        message: `Mini CRM sync ${new Date().toISOString()}`,
        content: b64encode(JSON.stringify(payload, null, 1)),
        ...(sha ? { sha } : {}),
      }),
    });
    if (res.status === 409 || res.status === 422) return null;
    if (!res.ok) throw await ghError(res);
    return (await res.json()).content.sha;
  }

  function applyMerged(merged) {
    if (JSON.stringify(toPayload(merged)) === JSON.stringify(toPayload(state))) return;
    state = merged;
    snapshot = fingerprints(state);
    save({ track: false });
    const el = document.activeElement;
    if (el && el.matches('input, textarea, select')) sync.needsRender = true;
    else rerender();
  }

  function scheduleSync(ms = 2000) {
    clearTimeout(sync.timer);
    sync.timer = setTimeout(syncNow, ms);
  }

  async function syncNow() {
    if (!syncCfg) return;
    if (sync.running || modal.open) { sync.again = true; return; } // never swap state under an open form
    if (!navigator.onLine) { setSyncStatus('offline'); return; }
    sync.running = true;
    setSyncStatus('syncing');
    try {
      for (let attempt = 0; attempt < 4; attempt++) {
        const remote = await pullRemote();
        if (modal.open) { sync.again = true; break; }
        applyMerged(remote ? mergeStates(state, remote.data) : state);
        const payload = toPayload(state);
        if (remote && JSON.stringify(toPayload(remote.data)) === JSON.stringify(payload)) break;
        if (await pushRemote(payload, remote && remote.sha)) break;
      }
      sync.last = new Date();
      setSyncStatus(sync.again ? 'pending' : 'idle');
    } catch (e) {
      setSyncStatus(navigator.onLine ? 'error' : 'offline', e.message);
    } finally {
      sync.running = false;
      if (sync.again && !modal.open) { sync.again = false; scheduleSync(500); }
    }
  }

  const SYNC_LABELS = {
    off: '☁ Set up sync', pending: '↑ Saving…', syncing: '⟳ Syncing…', idle: '✓ Synced',
    offline: '⚠ Offline', error: '⚠ Sync error',
  };

  function setSyncStatus(status, message = '') {
    sync.status = status;
    sync.message = message;
    const btn = $('#btn-sync');
    btn.textContent = SYNC_LABELS[status];
    btn.className = `btn ghost sync-${status}`;
    btn.title = status === 'error' ? message
      : status === 'offline' ? 'No connection. Changes are saved on this device and will sync when you are back online.'
      : sync.last ? `Last synced ${sync.last.toLocaleTimeString()}` : '';
    const live = $('#sync-live');
    if (live) live.innerHTML = syncStatusHtml();
  }

  function syncStatusHtml() {
    const when = sync.last ? `Last synced ${sync.last.toLocaleString()}` : 'Not synced yet this session';
    return `<strong>${esc(SYNC_LABELS[sync.status])}</strong> · <span class="muted">${esc(when)}</span>
      ${sync.message ? `<div class="sync-error">${esc(sync.message)}</div>` : ''}`;
  }

  function syncSettings() {
    if (syncCfg) {
      openModal('Cloud sync', `
        <div id="sync-live">${syncStatusHtml()}</div>
        <p class="small">Syncing with private repository <strong>${esc(syncCfg.repo)}</strong>.
          Changes save automatically and sync within a few seconds whenever you're online.
          Every sync is also kept in that repository's history, so it doubles as a backup.</p>
        <div class="row">
          <button type="button" class="btn ghost" id="sync-now">Sync now</button>
          <button type="button" class="btn danger" id="sync-disconnect">Disconnect this device</button>
        </div>`, () => {}, 'Done');
      $('#sync-now').addEventListener('click', () => { modal.close(); syncNow(); });
      $('#sync-disconnect').addEventListener('click', () => {
        if (!confirm('Stop syncing on this device? Your data stays on this device and in the cloud.')) return;
        syncCfg = null;
        localStorage.removeItem(SYNC_KEY);
        modal.close(); setSyncStatus('off'); toast('Sync disconnected');
      });
      return;
    }

    openModal('Set up cloud sync', `
      <p class="small">Keep the same data on your phone and computer by saving it to a <strong>private</strong>
        GitHub repository. Do this once on each device, using the same repository.</p>
      <ol class="small sync-steps">
        <li>Create a private repository, e.g. <code>crm-data</code>: <a href="https://github.com/new" target="_blank" rel="noopener">github.com/new</a>.
          Choose <em>Private</em> and tick <em>Add a README file</em>.</li>
        <li>Create a token: <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">github.com/settings/personal-access-tokens/new</a>.
          Under <em>Repository access</em> pick <em>Only select repositories</em> → your data repository.
          Under <em>Permissions</em>, set <em>Contents</em> to <em>Read and write</em>. Generate and copy it.</li>
        <li>Paste both below. Save the token in your Passwords app too, so you can paste it on your other device.</li>
      </ol>
      ${field('Repository (owner/name)', `<input name="repo" required placeholder="yourname/crm-data" autocapitalize="off" autocorrect="off" spellcheck="false">`)}
      ${field('Access token', `<input name="token" type="password" required placeholder="github_pat_…" autocomplete="off" autocapitalize="off" spellcheck="false">`)}
      <div id="sync-connect-msg"></div>`, (data) => { connectSync(data); return false; }, 'Connect');
  }

  async function connectSync(data) {
    const msg = $('#sync-connect-msg');
    const show = (html) => { msg.innerHTML = html; };
    const cfg = {
      repo: data.repo.trim().replace(/^https?:\/\/github\.com\//, '').replace(/\.git$|\/$/g, ''),
      token: data.token.trim(),
    };
    if (!/^[\w.-]+\/[\w.-]+$/.test(cfg.repo)) return show('<div class="sync-error">Enter the repository as owner/name, e.g. yourname/crm-data.</div>');
    show('<div class="muted">Checking…</div>');
    try {
      const res = await gh(`/repos/${cfg.repo}`, {}, cfg);
      if (!res.ok) throw await ghError(res);
      if (!(await res.json()).private) {
        return show('<div class="sync-error">That repository is public, so anyone could read your CRM data. Use a private repository.</div>');
      }
      const remote = await pullRemote(cfg);
      const localHasData = state.accounts.length || state.tasks.length;
      const remoteHasData = remote && (remote.data.accounts.length || remote.data.tasks.length);

      const finish = (useCloud) => {
        syncCfg = cfg;
        localStorage.setItem(SYNC_KEY, JSON.stringify(cfg));
        if (useCloud) { state = remote.data; snapshot = fingerprints(state); save({ track: false }); }
        modal.close(); rerender(); syncNow();
        toast('Sync connected');
      };

      if (!(localHasData && remoteHasData)) return finish(!!remoteHasData);
      openModal('Cloud data found', `
        <p>This repository already has Mini CRM data, and this device has data too.</p>
        <label class="row"><input type="radio" name="mode" value="cloud" checked style="width:auto">
          <span><strong>Use the cloud data</strong>: replace what's on this device. Best if this device only has test or sample data.</span></label>
        <label class="row"><input type="radio" name="mode" value="merge" style="width:auto">
          <span><strong>Merge both</strong>: keep everything from this device and the cloud.</span></label>`,
      (choice) => { finish(choice.mode === 'cloud'); return false; }, 'Continue');
    } catch (e) {
      show(`<div class="sync-error">${esc(e.message || 'Could not reach GitHub. Check your connection.')}</div>`);
    }
  }

  $('#btn-sync').addEventListener('click', syncSettings);
  window.addEventListener('online', () => syncNow());
  window.addEventListener('offline', () => syncCfg && setSyncStatus('offline'));
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') syncNow(); });
  setInterval(() => { if (document.visibilityState === 'visible') syncNow(); }, 60000);
  document.addEventListener('focusout', () => setTimeout(() => {
    const el = document.activeElement;
    if (sync.needsRender && !(el && el.matches('input, textarea, select')) && !modal.open) { sync.needsRender = false; rerender(); }
  }, 250));

  setSyncStatus(syncCfg ? 'pending' : 'off');
  route();
  syncNow();
})();
