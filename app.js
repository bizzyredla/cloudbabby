/* Mini CRM — partner & prospect accounts with history, key dates and a daily planner.
   All data lives in localStorage; use Export/Import for backups or moving between devices. */
(() => {
  'use strict';

  const STORAGE_KEY = 'minicrm.v1';

  const STAGES = {
    prospect: ['New', 'Contacted', 'Qualified', 'Proposal', 'Negotiation', 'Won', 'Lost'],
    partner: ['Onboarding', 'Active', 'Strategic', 'At Risk', 'Inactive'],
  };
  const ACTIVITY_KINDS = ['Call', 'Email', 'Meeting', 'Demo', 'Note', 'Other'];
  const PRIORITIES = { high: 'High', med: 'Medium', low: 'Low' };
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
  const ui = { selectedId: null, search: '', typeFilter: 'all', stageFilter: 'all', sort: 'followup', plannerDate: today() };

  function emptyState() { return { accounts: [], tasks: [], days: {} }; }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return { ...emptyState(), ...JSON.parse(raw) };
    } catch (e) { console.warn('Could not read saved data', e); }
    return emptyState();
  }

  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
    catch (e) { toast('Could not save — browser storage is unavailable. Use Export to keep a copy.'); }
  }

  const getAccount = (id) => state.accounts.find((a) => a.id === id);
  const getDay = (iso) => state.days[iso] || { priorities: ['', '', ''], notes: '' };

  function touch(acct) { acct.updatedAt = new Date().toISOString(); }

  function lastActivity(acct) {
    return [...acct.activities].sort((a, b) => b.date.localeCompare(a.date))[0];
  }

  /** Every dated, still-open item across accounts: follow-ups and key dates. */
  function upcomingItems() {
    const items = [];
    for (const a of state.accounts) {
      if (a.nextFollowUp) items.push({ kind: 'followup', date: a.nextFollowUp, label: 'Follow up', account: a });
      for (const k of a.keyDates) if (!k.done) items.push({ kind: 'keydate', date: k.date, label: k.label, account: a, keyDate: k });
    }
    return items.sort((x, y) => x.date.localeCompare(y.date));
  }

  // ---------- routing ----------
  const views = { dashboard: renderDashboard, accounts: renderAccounts, planner: renderPlanner };

  function route() {
    const [name, arg] = location.hash.replace('#', '').split('/');
    const view = views[name] ? name : 'dashboard';
    if (view === 'accounts' && arg) ui.selectedId = arg;
    if (view === 'planner' && arg && /^\d{4}-\d{2}-\d{2}$/.test(arg)) ui.plannerDate = arg;
    $$('#tabs a').forEach((a) => a.classList.toggle('active', a.dataset.view === view));
    views[view]();
  }
  const rerender = () => route();
  const go = (hash) => { if (location.hash === '#' + hash) rerender(); else location.hash = hash; };
  window.addEventListener('hashchange', route);

  // ---------- dashboard ----------
  function renderDashboard() {
    const t = today();
    const items = upcomingItems();
    const overdue = items.filter((i) => i.date < t);
    const dueToday = items.filter((i) => i.date === t);
    const upcoming = items.filter((i) => i.date > t && daysBetween(t, i.date) <= 14);
    const todaysTasks = state.tasks.filter((x) => x.date === t);
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
                <div class="small muted"><a href="#accounts/${r.account.id}">${esc(r.account.name)}</a></div>
              </div>
            </li>`).join('')}</ul>` : '<div class="empty">No activity logged yet.</div>'}
        </div>
        <div class="card">
          <h2>No follow-up scheduled</h2>
          ${quiet.length ? `<ul class="list">${quiet.map((a) => `
            <li>
              <span class="pill ${a.type}">${a.type === 'partner' ? 'Partner' : 'Prospect'}</span>
              <div class="grow"><a class="title" href="#accounts/${a.id}">${esc(a.name)}</a>
                <div class="small muted">${esc(a.stage)} · last touch ${lastActivity(a) ? relDays(lastActivity(a).date) : 'never'}</div></div>
              <button class="btn sm ghost" data-act="log" data-id="${a.id}">Log / schedule</button>
            </li>`).join('')}</ul>` : '<div class="empty">Every active account has a next step.</div>'}
        </div>
      </div>`;
  }

  function itemList(items, emptyMsg) {
    if (!items.length) return `<div class="empty">${emptyMsg}</div>`;
    return `<ul class="list">${items.map((i) => `
      <li>
        <div class="date-chip ${dueClass(i.date)}"><b>${fromISO(i.date).getDate()}</b>${fmtDate(i.date, { month: 'short' })}</div>
        <div class="grow">
          <div class="title">${esc(i.label)} — <a href="#accounts/${i.account.id}">${esc(i.account.name)}</a></div>
          <div class="small muted"><span class="pill ${i.account.type}">${i.account.type === 'partner' ? 'Partner' : 'Prospect'}</span> ${relDays(i.date)}</div>
        </div>
        ${i.kind === 'followup'
          ? `<button class="btn sm ghost" data-act="log" data-id="${i.account.id}">Log</button>`
          : `<button class="btn sm ghost" data-act="keydate-done" data-id="${i.account.id}" data-kid="${i.keyDate.id}">Done</button>`}
      </li>`).join('')}</ul>`;
  }

  // ---------- accounts ----------
  function filteredAccounts() {
    const q = ui.search.trim().toLowerCase();
    let list = state.accounts.filter((a) => {
      if (ui.typeFilter !== 'all' && a.type !== ui.typeFilter) return false;
      if (ui.stageFilter !== 'all' && a.stage !== ui.stageFilter) return false;
      if (!q) return true;
      return [a.name, a.contact, a.email, a.industry, a.tags, a.notes]
        .some((f) => (f || '').toLowerCase().includes(q));
    });
    const far = '9999-12-31';
    const sorters = {
      followup: (x, y) => (x.nextFollowUp || far).localeCompare(y.nextFollowUp || far),
      name: (x, y) => x.name.localeCompare(y.name),
      updated: (x, y) => (y.updatedAt || '').localeCompare(x.updatedAt || ''),
      value: (x, y) => (Number(y.value) || 0) - (Number(x.value) || 0),
    };
    return list.sort(sorters[ui.sort]);
  }

  function renderAccounts() {
    const list = filteredAccounts();
    if (ui.selectedId && !getAccount(ui.selectedId)) ui.selectedId = null;
    if (!ui.selectedId && list.length) ui.selectedId = list[0].id;
    const stages = ui.typeFilter === 'all' ? [...STAGES.prospect, ...STAGES.partner] : STAGES[ui.typeFilter];

    $('#view').innerHTML = `
      <div class="accounts-layout">
        <div class="card">
          <div class="row spread" style="margin-bottom:.75rem">
            <h2 style="margin:0">Accounts <span class="muted small">(${list.length})</span></h2>
            <button class="btn sm" data-act="new-account">+ New</button>
          </div>
          <div class="toolbar">
            <input type="search" id="acct-search" placeholder="Search name, contact, tags, notes…" value="${esc(ui.search)}">
          </div>
          <div class="toolbar">
            <select id="acct-type">
              <option value="all">All types</option>
              <option value="partner" ${ui.typeFilter === 'partner' ? 'selected' : ''}>Partners</option>
              <option value="prospect" ${ui.typeFilter === 'prospect' ? 'selected' : ''}>Prospects</option>
            </select>
            <select id="acct-stage">
              <option value="all">All stages</option>
              ${stages.map((s) => `<option ${ui.stageFilter === s ? 'selected' : ''}>${s}</option>`).join('')}
            </select>
            <select id="acct-sort" title="Sort">
              <option value="followup" ${ui.sort === 'followup' ? 'selected' : ''}>Next follow-up</option>
              <option value="name" ${ui.sort === 'name' ? 'selected' : ''}>Name</option>
              <option value="updated" ${ui.sort === 'updated' ? 'selected' : ''}>Recently updated</option>
              <option value="value" ${ui.sort === 'value' ? 'selected' : ''}>Value</option>
            </select>
          </div>
          <div class="acct-list">
            ${list.length ? list.map((a) => `
              <button class="acct-item ${a.id === ui.selectedId ? 'active' : ''}" data-act="select" data-id="${a.id}">
                <div class="row spread"><span class="name">${esc(a.name)}</span>
                  <span class="pill ${a.type}">${a.type === 'partner' ? 'Partner' : 'Prospect'}</span></div>
                <div class="meta">${esc(a.stage)}${a.contact ? ' · ' + esc(a.contact) : ''}</div>
                <div class="meta">${a.nextFollowUp
                  ? `Next: <span class="pill ${dueClass(a.nextFollowUp)}">${fmtDate(a.nextFollowUp, { month: 'short', day: 'numeric' })} (${relDays(a.nextFollowUp)})</span>`
                  : 'No follow-up set'}</div>
              </button>`).join('') : '<div class="empty">No accounts match.</div>'}
          </div>
        </div>
        <div>${ui.selectedId ? accountDetail(getAccount(ui.selectedId)) : '<div class="card empty">Select or create an account.</div>'}</div>
      </div>`;

    const search = $('#acct-search');
    search.addEventListener('input', (e) => {
      ui.search = e.target.value;
      const pos = e.target.selectionStart;
      renderAccounts();
      const s = $('#acct-search'); s.focus(); s.setSelectionRange(pos, pos);
    });
    $('#acct-type').addEventListener('change', (e) => { ui.typeFilter = e.target.value; ui.stageFilter = 'all'; renderAccounts(); });
    $('#acct-stage').addEventListener('change', (e) => { ui.stageFilter = e.target.value; renderAccounts(); });
    $('#acct-sort').addEventListener('change', (e) => { ui.sort = e.target.value; renderAccounts(); });
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
            ${a.tags ? `<div class="row small muted" style="margin-top:.35rem">${a.tags.split(',').map((x) => x.trim()).filter(Boolean).map((x) => `<span class="pill">#${esc(x)}</span>`).join('')}</div>` : ''}
          </div>
          <div class="row">
            <button class="btn" data-act="log" data-id="${a.id}">+ Log activity</button>
            <button class="btn ghost" data-act="new-task" data-id="${a.id}">+ Plan task</button>
            <button class="btn ghost" data-act="edit-account" data-id="${a.id}">Edit</button>
          </div>
        </div>

        <div class="facts">
          <div><span>Primary contact</span>${esc(a.contact) || '—'}${a.title ? `<div class="small muted">${esc(a.title)}</div>` : ''}</div>
          <div><span>Email</span>${a.email ? `<a href="mailto:${esc(a.email)}">${esc(a.email)}</a>` : '—'}</div>
          <div><span>Phone</span>${a.phone ? `<a href="tel:${esc(a.phone)}">${esc(a.phone)}</a>` : '—'}</div>
          <div><span>Website</span>${a.website ? `<a href="${esc(/^https?:/.test(a.website) ? a.website : 'https://' + a.website)}" target="_blank" rel="noopener">${esc(a.website)}</a>` : '—'}</div>
          <div><span>Industry</span>${esc(a.industry) || '—'}</div>
          <div><span>${a.type === 'partner' ? 'Annual value' : 'Deal value'}</span>${money(a.value)}</div>
          <div><span>Next follow-up</span>${a.nextFollowUp ? `<span class="pill ${dueClass(a.nextFollowUp)}">${fmtDate(a.nextFollowUp)}</span> <span class="small muted">${relDays(a.nextFollowUp)}</span>` : '—'}</div>
          <div><span>Last touch</span>${last ? `${fmtDate(last.date)} <span class="small muted">(${esc(last.kind)})</span>` : 'Never'}</div>
          <div><span>Added</span>${fmtDate((a.createdAt || '').slice(0, 10) || null)}</div>
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
              <div class="when">${fmtDate(h.date)} · ${relDays(h.date)}</div>
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
    const due = upcomingItems().filter((i) => i.date === d || (d === t && i.date < t));
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
                  <div class="t-title">${esc(i.label)} — <a href="#accounts/${i.account.id}">${esc(i.account.name)}</a></div>
                  <div class="t-sub">${i.date < d ? `<span class="pill overdue">overdue ${relDays(i.date).replace(' ago', '')}</span>` : ''} ${esc(i.account.stage)}${i.account.contact ? ' · ' + esc(i.account.contact) : ''}${i.account.phone ? ' · ' + esc(i.account.phone) : ''}</div>
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
      </div>`;

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
  }

  function taskCard(x) {
    const acct = x.accountId && getAccount(x.accountId);
    return `
      <div class="task ${x.priority} ${x.done ? 'done' : ''}" data-act="task">
        <input type="checkbox" data-id="${x.id}" ${x.done ? 'checked' : ''} aria-label="Done">
        <div class="t-main">
          <div class="t-title">${esc(x.title)}</div>
          <div class="t-sub">${x.time ? fmtTime(x.time) : 'Anytime'}${x.duration ? ` · ${x.duration} min` : ''}${acct ? ` · <a href="#accounts/${acct.id}">${esc(acct.name)}</a>` : ''}${x.priority === 'high' ? ' · <span class="pill high">High</span>' : ''}</div>
          ${x.notes ? `<div class="t-sub" style="white-space:pre-wrap">${esc(x.notes)}</div>` : ''}
        </div>
        <button class="icon-btn" data-act="edit-task" data-tid="${x.id}" title="Edit">✎</button>
        <button class="icon-btn" data-act="del-task" data-tid="${x.id}" title="Delete">✕</button>
      </div>`;
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
    modal.showModal();
    const first = modalForm.querySelector('input:not([type=hidden]), select, textarea');
    if (first) first.focus();
  }

  modalForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(modalForm).entries());
    if (modalSubmit && modalSubmit(data) === false) return;
    modal.close(); save(); rerender();
  });
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
        ${field('Primary contact', `<input name="contact" value="${esc(a.contact)}">`)}
        ${field('Contact title', `<input name="title" value="${esc(a.title)}">`)}
        ${field('Email', `<input name="email" type="email" value="${esc(a.email)}">`)}
        ${field('Phone', `<input name="phone" value="${esc(a.phone)}">`)}
        ${field('Website', `<input name="website" value="${esc(a.website)}">`)}
        ${field('Industry', `<input name="industry" value="${esc(a.industry)}">`)}
        ${field('Next follow-up', `<input name="nextFollowUp" type="date" value="${esc(a.nextFollowUp)}">`)}
        ${field('Tags (comma separated)', `<input name="tags" value="${esc(a.tags)}">`)}
        ${field('Notes', `<textarea name="notes" rows="4">${esc(a.notes)}</textarea>`, 'span-2')}
      </div>`, (data) => {
      if (!data.name.trim()) return false;
      if (existing) {
        Object.assign(existing, data); touch(existing);
        toast('Account updated');
      } else {
        const now = new Date().toISOString();
        const acct = { id: uid(), ...data, activities: [], keyDates: [], createdAt: now, updatedAt: now };
        state.accounts.push(acct);
        ui.selectedId = acct.id;
        location.hash = `accounts/${acct.id}`;
        toast('Account created');
      }
    });
    $('#f-type').addEventListener('change', (e) => {
      $('#f-stage').innerHTML = STAGES[e.target.value].map((s) => opt(s, s, '')).join('');
    });
  }

  function activityForm(acct, existing) {
    const h = existing || { date: today(), kind: 'Call' };
    openModal(`${existing ? 'Edit' : 'Log'} activity — ${acct.name}`, `
      <div class="grid-2">
        ${field('Date', `<input name="date" type="date" required value="${esc(h.date)}">`)}
        ${field('Type', `<select name="kind">${ACTIVITY_KINDS.map((k) => opt(k, k, h.kind)).join('')}</select>`)}
        ${field('Summary *', `<input name="summary" required placeholder="e.g. Discovery call with VP Sales" value="${esc(h.summary)}">`, 'span-2')}
        ${field('Notes', `<textarea name="notes" rows="5" placeholder="What was discussed, decisions, objections, next steps…">${esc(h.notes)}</textarea>`, 'span-2')}
        ${existing ? '' : `
        ${field('Set next follow-up', `<input name="nextFollowUp" type="date" value="${esc(acct.nextFollowUp && acct.nextFollowUp > today() ? acct.nextFollowUp : addDays(today(), 7))}">`)}
        ${field('Update stage', `<select name="stage">${STAGES[acct.type].map((s) => opt(s, s, acct.stage)).join('')}</select>`)}
        <label class="row span-2 small"><input type="checkbox" name="addTask" style="width:auto"> Also add the follow-up to my daily planner</label>`}
      </div>`, (data) => {
      if (!data.summary.trim()) return false;
      if (existing) {
        Object.assign(existing, { date: data.date, kind: data.kind, summary: data.summary, notes: data.notes });
      } else {
        acct.activities.push({ id: uid(), date: data.date, kind: data.kind, summary: data.summary, notes: data.notes, createdAt: new Date().toISOString() });
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
    const { act, id, kid, hid, tid } = el.dataset;
    const acct = id && getAccount(id);

    switch (act) {
      case 'new-account': return accountForm();
      case 'edit-account': return accountForm(acct);
      case 'del-account':
        if (confirm(`Delete ${acct.name} and all its history? Planner tasks will be unlinked.`)) {
          state.accounts = state.accounts.filter((a) => a.id !== id);
          state.tasks.forEach((x) => { if (x.accountId === id) x.accountId = ''; });
          ui.selectedId = null; save(); go('accounts');
        }
        return;
      case 'select': ui.selectedId = id; go(`accounts/${id}`); return;
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
      case 'load-sample': loadSample(); return;
    }
  });

  // ---------- import / export ----------
  $('#btn-export').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `minicrm-backup-${today()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  });

  $('#file-import').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!Array.isArray(data.accounts)) throw new Error('missing accounts');
      if (!confirm('Replace all current data with this backup?')) return;
      state = { ...emptyState(), ...data };
      state.accounts.forEach((a) => { a.activities ||= []; a.keyDates ||= []; });
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

    state.accounts.push(northwind, brightpath, helix, summit, oak);
    state.tasks.push(
      { id: uid(), date: t, time: '09:00', duration: 30, title: 'Pipeline review & inbox', accountId: '', priority: 'med', notes: '', done: false },
      { id: uid(), date: t, time: '10:30', duration: 45, title: 'Proposal walkthrough with Dana', accountId: northwind.id, priority: 'high', notes: 'Bring pricing options A/B', done: false },
      { id: uid(), date: t, time: '14:00', duration: 30, title: 'Call Priya re: HIPAA questions', accountId: helix.id, priority: 'high', notes: '', done: false },
      { id: uid(), date: t, time: '', title: 'Research Oak & Iron decision makers', accountId: oak.id, priority: 'low', notes: '', done: false },
      { id: uid(), date: addDays(t, 1), time: '11:00', duration: 60, title: 'Summit technical onboarding', accountId: summit.id, priority: 'med', notes: '', done: false },
    );
    state.days[t] = { priorities: ['Move Northwind to Negotiation', 'Unblock Helix on HIPAA', 'Prep BrightPath webinar'], notes: '' };
    save(); toast('Sample data loaded'); rerender();
  }

  route();
})();
