/* Mini CRM — partner & prospect accounts with history, key dates and a daily planner.
   All data lives in localStorage; use Export/Import for backups or moving between devices. */
(() => {
  'use strict';

  const STORAGE_KEY = 'minicrm.v1';

  const STAGES = {
    prospect: ['New', 'Contacted', 'Qualified', 'Proposal', 'Negotiation', 'Won', 'Lost'],
    partner: ['Onboarding', 'Active', 'Strategic', 'At Risk', 'Inactive'],
  };
  const ACTIVITY_KINDS = ['Call', 'Email', 'LinkedIn', 'Visit', 'Text', 'Meeting', 'Demo', 'Note', 'Other'];
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
  const CONTACT_STATUSES = ['Active', 'Left company', 'Do not contact'];
  const CHANNELS = ['Email', 'Phone', 'Mobile / text', 'LinkedIn', 'In person'];
  const TIMEZONES = ['Eastern', 'Central', 'Mountain', 'Pacific', 'Alaska', 'Hawaii'];
  const LEAD_SOURCES = ['Referral', 'Partner / broker', 'Inbound', 'Cold outreach', 'Event', 'Existing client', 'Other'];

  // Cadence step types: how each looks, what it logs as, which daily-plan section it counts toward.
  const STEP_TYPES = {
    email: { label: 'Email', icon: '✉', kind: 'Email', plan: 'outreach', outcomes: ['Sent', 'Replied', 'Bounced'] },
    call: { label: 'Call', icon: '☎', kind: 'Call', plan: 'outreach', outcomes: ['Connected', 'Left voicemail', 'No answer', 'Wrong number', 'Replied'] },
    linkedin: { label: 'LinkedIn', icon: 'in', kind: 'LinkedIn', plan: 'outreach', outcomes: ['Connection request sent', 'Message sent', 'Viewed profile', 'Replied'] },
    visit: { label: 'Visit', icon: '⌂', kind: 'Visit', plan: 'visits', outcomes: ['Met in person', 'Dropped off materials', 'Nobody available'] },
    text: { label: 'Text', icon: '✆', kind: 'Text', outcomes: ['Sent', 'Replied'] },
    task: { label: 'Task', icon: '✓', kind: 'Note', outcomes: ['Done'] },
  };
  const EXIT_OUTCOMES = {
    continue: 'Continue to next step', meeting: 'Meeting booked: finish', replied: 'Replied / engaged: finish',
    notinterested: 'Not interested: finish', bad: 'Bad data / left company: finish',
  };
  const FINISH_LABELS = { completed: 'Completed all steps', meeting: 'Meeting booked', replied: 'Replied', notinterested: 'Not interested', bad: 'Bad data' };
  const CADENCE_COLORS = ['#2f6fed', '#d9480f', '#0f8a6a', '#8a4bd6', '#c2255c', '#c98a00', '#0b7285'];

  // Starter cadences: [day, type, step name, subject, script].
  const CADENCE_TEMPLATES = [
    {
      name: 'Insperity Renewal', color: '#d9480f',
      description: 'Prospects on Insperity approaching renewal. Lead with a side-by-side benefits and cost comparison.',
      steps: [
        [1, 'email', 'Intro: renewal comparison', 'Quick idea before your Insperity renewal',
          'Hi {{first_name}},\n\nWith {{company}}\'s Insperity renewal coming up ({{renewal_date}}), many companies your size compare benefits and admin costs side by side before signing again. I can put together a no-obligation comparison with TriNet in about 15 minutes of your time.\n\nOpen to a quick call next week?\n\nThanks,'],
        [3, 'call', 'Discovery call', '',
          'Reference the email.\n- When is the renewal?\n- How many employees are on benefits?\n- What do you like / dislike about Insperity?\n- What was your last renewal increase?'],
        [4, 'linkedin', 'LinkedIn connect', '', 'Hi {{first_name}}, I help growing companies like {{company}} with HR and benefits. Would be glad to connect.'],
        [7, 'email', 'Value: benefits comparison', 'Benefits comparison for {{company}}',
          'Hi {{first_name}},\n\nFollowing up. A TriNet comparison covers medical plan options, employer cost per employee, HR support and technology. Happy to run the numbers for {{company}}.\n\nBest,'],
        [9, 'call', 'Follow-up call + voicemail', '', 'Short voicemail: renewal timing + free comparison offer. Ask for 15 minutes.'],
        [12, 'visit', 'Drop-in visit', '', 'Drop off the comparison one-pager and a business card. Ask for the decision maker.'],
        [16, 'email', 'Case study', 'How a company like {{company}} handled renewal',
          'Hi {{first_name}},\n\nA company similar to {{company}} moved from Insperity to TriNet at renewal and lowered their benefits spend while adding plan choice. Worth a 15-minute look before you sign?\n\nBest,'],
        [21, 'email', 'Breakup', 'Should I close the loop?',
          'Hi {{first_name}},\n\nI haven\'t heard back, so I\'ll assume the timing isn\'t right. If a renewal comparison would help later, just reply and I\'ll put it together.\n\nAll the best,'],
      ],
    },
    {
      name: 'ADP TotalSource Nurture', color: '#2f6fed',
      description: 'Long-term nurture for ADP TotalSource clients. Stay top of mind until renewal or a pain point.',
      steps: [
        [1, 'email', 'Intro & value', 'Supporting {{company}} beyond payroll',
          'Hi {{first_name}},\n\nI know {{company}} works with ADP TotalSource today. I\'m not asking you to switch, just to keep TriNet in mind for your next benefits review. Mind if I send a short overview?\n\nBest,'],
        [5, 'linkedin', 'LinkedIn connect', '', 'Hi {{first_name}}, I share HR and benefits trends for companies like {{company}}. Would be glad to connect.'],
        [12, 'call', 'Check-in call', '', 'Ask about their service experience, benefits renewal month and hiring plans.'],
        [25, 'email', 'Industry insight', '{{industry}} benefits benchmarks',
          'Hi {{first_name}},\n\nSharing a quick benchmark on what {{industry}} companies are offering in benefits this year. Happy to walk you through how {{company}} compares.\n\nBest,'],
        [40, 'visit', 'In-person touch', '', 'Stop by with something useful: a compliance calendar or benefits benchmark.'],
        [60, 'call', 'Renewal timing call', '', 'Confirm the renewal date and offer a comparison 90 days before it.'],
      ],
    },
    {
      name: 'New Prospect Intro', color: '#0f8a6a',
      description: 'First touches for a brand-new prospect.',
      steps: [
        [1, 'call', 'Intro call', '', 'Introduce yourself. Ask about their current HR / payroll / benefits setup and biggest headache.'],
        [1, 'email', 'Intro email', 'Introduction: HR & benefits for {{company}}',
          'Hi {{first_name}},\n\nI tried you by phone. I help companies like {{company}} simplify HR, benefits and payroll. Would a 15-minute call this week work?\n\nBest,'],
        [3, 'linkedin', 'LinkedIn connect', '', 'Hi {{first_name}}, I work with companies like {{company}} on HR and benefits. Would be glad to connect.'],
        [6, 'call', 'Follow-up call', '', 'Reference the email and LinkedIn note. Offer a quick benefits review.'],
        [10, 'email', 'Final follow-up', 'Closing the loop',
          'Hi {{first_name}},\n\nI\'ll close the loop for now. If HR or benefits becomes a priority for {{company}}, I\'d be glad to help.\n\nBest,'],
      ],
    },
  ];
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
  const ui = { search: '', typeFilter: 'all', stageFilter: 'all', vendorFilter: 'all', sort: 'followup', sortDir: 1, plannerDate: today(), listId: null, navs: 0, cadFilter: 'active' };
  // Per-device view preferences (layout choice), not synced.
  const PREFS_KEY = 'minicrm.prefs';
  try { Object.assign(ui, JSON.parse(localStorage.getItem(PREFS_KEY)) || {}); } catch (e) { /* defaults */ }
  ui.accountView ||= matchMedia('(max-width: 700px)').matches ? 'cards' : 'table';
  ui.boardType ||= 'prospect';
  ui.mapMode = 'accounts';
  ui.routeDate = today();
  ui.mapFilter = { type: 'all', vendor: 'all', list: '' };
  const savePrefs = () => {
    try { localStorage.setItem(PREFS_KEY, JSON.stringify({ accountView: ui.accountView, boardType: ui.boardType, home: ui.home })); } catch (e) { /* ignore */ }
  };

  function emptyState() { return { accounts: [], tasks: [], days: {}, lists: [], cadences: [], enrollments: [], flows: [], deleted: {} }; }

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
    for (const c of st.cadences) yield ['cad:' + c.id, c, { ...c, _ts: undefined }];
    for (const e of st.enrollments) yield ['enr:' + e.id, e, { ...e, _ts: undefined }];
    for (const f of st.flows) yield ['flw:' + f.id, f, { ...f, _ts: undefined }];
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

    return { ...emptyState(), accounts: merged, tasks: mergeList(L.tasks, R.tasks, 't:'), days, lists: mergeList(L.lists, R.lists, 'l:'),
      cadences: mergeList(L.cadences, R.cadences, 'cad:'), enrollments: mergeList(L.enrollments, R.enrollments, 'enr:'),
      flows: mergeList(L.flows, R.flows, 'flw:'), deleted };
  }

  const toPayload = (st) => ({
    version: 1, accounts: st.accounts, tasks: st.tasks, days: st.days, lists: st.lists,
    cadences: st.cadences, enrollments: st.enrollments, flows: st.flows, deleted: st.deleted,
  });

  const getAccount = (id) => state.accounts.find((a) => a.id === id);
  const primaryContact = (a) => a.contacts.find((c) => c.primary) || a.contacts[0] || null;
  const tagList = (a) => (a.tags || '').split(',').map((x) => x.trim()).filter(Boolean);
  const allTags = () => [...new Set(state.accounts.flatMap((a) => tagList(a).map((x) => x.toLowerCase())))].sort();
  const allVendors = () => {
    const used = new Set(state.accounts.flatMap((a) => a.vendors));
    return [...COMPETITORS, ...[...used].filter((v) => !COMPETITORS.includes(v) && v !== NO_VENDOR).sort(), NO_VENDOR];
  };
  const haystack = (a) => [a.name, a.industry, a.tags, a.notes, ...a.vendors,
    a.location, a.address, ...a.contacts.flatMap((c) => [c.name, c.title, c.email, c.phone, c.mobile])].join(' ').toLowerCase();
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
  const views = { dashboard: renderDashboard, accounts: renderAccounts, account: renderAccountRecord, planner: renderPlanner, lists: renderLists, cadences: renderCadences, map: renderMap, report: renderReport, research: renderResearch };
  const TAB_FOR = { account: 'accounts', report: 'dashboard' };

  function route() {
    let [name, arg] = location.hash.replace('#', '').split('/');
    if (name === 'accounts' && arg) name = 'account'; // older links to an account record
    const view = views[name] ? name : 'dashboard';
    if (view === 'account') ui.recordId = arg;
    if (view === 'planner' && arg && /^\d{4}-\d{2}-\d{2}$/.test(arg)) ui.plannerDate = arg;
    if (view === 'lists' && arg) ui.listId = decodeURIComponent(arg);
    if (view === 'cadences' && arg) ui.cadenceId = arg;
    if (view === 'research' && arg && getAccount(arg)) {
      Object.assign(research, { target: getAccount(arg).name, hint: '', list: '' }); saveResearch();
    }
    if (view === 'report') ui.reportWeek = weekStart(/^\d{4}-\d{2}-\d{2}$/.test(arg || '') ? arg : today());
    if (view === 'map') {
      const parts = location.hash.split('/');
      ui.mapMode = parts[1] === 'route' ? 'route' : 'accounts';
      if (ui.mapMode === 'route') ui.routeDate = /^\d{4}-\d{2}-\d{2}$/.test(parts[2] || '') ? parts[2] : (ui.routeDate || today());
    } else if (mapState.map) unmountMap(false);
    if (ui.lastView !== view) ui.showAll = false;
    ui.lastView = view;
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
    // Accounts with a contact in a running cadence already have a next touch.
    const inCadence = new Set(liveEnrollments().filter((p) => p.e.status !== 'finished').map((p) => p.acct.id));
    const quiet = state.accounts
      .filter((a) => !['Lost', 'Inactive', 'Won'].includes(a.stage) && !a.nextFollowUp && !inCadence.has(a.id))
      .slice(0, 6);
    const stepsDue = dueSteps(t);
    const PLAN_SHORT = { outreach: 'Calls / Email / LI', visits: 'Visits', channel: 'Channel', revisits: 'Revisits' };

    $('#view').innerHTML = `
      <div class="row spread" style="margin-bottom:1rem">
        <div>
          <h1>${esc(fmtLongDate(t))}</h1>
          <div class="muted">${todaysTasks.filter((x) => !x.done).length} open planner tasks today · ${dueToday.length} account items due</div>
        </div>
        <div class="row">
          ${dashSwitch('today')}
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

      <div class="dash-label">Today</div>
      <div class="stats today-stats">
        <a class="card stat plan-stat" href="#planner/${t}">
          <div class="row spread"><div><div class="num">${planDone}<span class="muted">/${planTotal}</span></div><div class="label">Activity plan</div></div></div>
          <div class="mini-bars">${PLAN_SECTIONS.map((sec) => {
            const st = planStats(todaysPlan, sec.key);
            return `<div class="mini-bar"><span>${PLAN_SHORT[sec.key]}</span><div class="progress"><div style="width:${Math.round((st.done / st.target) * 100)}%"></div></div><b>${st.done}/${st.target}</b></div>`;
          }).join('')}</div>
        </a>
        <a class="card stat ${stepsDue.length ? 'warn' : ''}" href="#cadences"><div class="num">${stepsDue.length}</div><div class="label">Cadence steps due</div></a>
        <div class="card stat ${dueToday.length ? 'warn' : ''}"><div class="num">${dueToday.length}</div><div class="label">Follow-ups & dates due</div></div>
        <div class="card stat ${overdue.length ? 'alert' : ''}"><div class="num">${overdue.length}</div><div class="label">Overdue</div></div>
      </div>
      <div class="dash-label">Book</div>
      <div class="stats">
        <a class="card stat" href="#accounts"><div class="num">${prospects.length}</div><div class="label">Prospects</div></a>
        <a class="card stat" href="#accounts"><div class="num">${partners.length}</div><div class="label">Partners</div></a>
        <div class="card stat"><div class="num">${money(openPipeline)}</div><div class="label">Open prospect pipeline</div></div>
        <a class="card stat" href="#cadences"><div class="num">${liveEnrollments().filter((p) => p.e.status === 'active').length}</div><div class="label">People in cadences</div></a>
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
      </div>`;
  }

  /** Remove every record. Tombstones carry the erase to other synced devices. */
  function eraseAll() {
    const typed = prompt(
      `This permanently deletes all ${state.accounts.length} accounts, tasks, planner days, lists and cadences` +
      `${syncCfg ? ' on this device AND every synced device' : ' on this device'}.\n\nExport a backup first if you might need it.\n\nType DELETE to confirm.`);
    if ((typed || '').trim().toUpperCase() !== 'DELETE') { if (typed !== null) toast('Nothing was deleted'); return; }
    state.accounts = []; state.tasks = []; state.lists = []; state.days = {}; state.cadences = []; state.enrollments = []; state.flows = [];
    ui.listId = null;
    research = { target: '', hint: '', list: '', flows: ['hq', 'dm', 'hr'], custom: '', pasted: '' }; saveResearch();
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
    renewal: (x, y) => (x.vendorRenewal || FAR).localeCompare(y.vendorRenewal || FAR),
    lasttouch: (x, y) => ((lastActivity(y) || {}).date || '').localeCompare((lastActivity(x) || {}).date || ''),
    updated: (x, y) => (y.updatedAt || '').localeCompare(x.updatedAt || ''),
  };
  const SORT_LABELS = { followup: 'Next follow-up', revisit: 'Next revisit', renewal: 'Vendor renewal', name: 'Name', stage: 'Stage', value: 'Value', lasttouch: 'Last touch', updated: 'Recently updated' };
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
  const PAGE_SIZE = 200;
  const BOARD_CAP = 50;

  function accountCollection(list, emptyMsg = 'No accounts match.') {
    if (ui.accountView === 'board') return accountBoard(list);
    if (!list.length) return `<div class="card empty">${emptyMsg}</div>`;
    // Large books render the first page; "Show all" expands until you leave the screen.
    const shown = ui.showAll ? list : list.slice(0, PAGE_SIZE);
    const more = list.length - shown.length;
    return (ui.accountView === 'cards' ? accountCards(shown) : accountTable(shown))
      + (more ? `<div class="show-more"><button class="btn ghost" data-act="show-all">Show all ${list.length} accounts (${more} more)</button></div>` : '');
  }

  function accountTable(list) {
    const th = (label, key) => key
      ? `<th><button type="button" class="th-sort ${ui.sort === key ? 'on' : ''}" data-act="sort" data-key="${key}">${label}${ui.sort === key ? (ui.sortDir > 0 ? ' ▲' : ' ▼') : ''}</button></th>`
      : `<th>${label}</th>`;
    return `
      <div class="card table-card">
        <div class="table-wrap">
          <table class="table acct-table">
            <thead><tr>${th('Account', 'name')}${th('Stage', 'stage')}${th('Primary contact')}${th('Current vendors')}${th('Renewal', 'renewal')}${th('Value', 'value')}${th('Follow-up', 'followup')}${th('Revisit', 'revisit')}${th('Last touch', 'lasttouch')}</tr></thead>
            <tbody>${list.map((a) => {
              const p = primaryContact(a);
              const last = lastActivity(a);
              return `<tr class="click-row" data-act="open-account" data-id="${a.id}">
                <td class="sticky-col"><strong>${esc(a.name)}</strong><div class="row" style="gap:.35rem">${typePill(a)}${accountLinks(a)}</div></td>
                <td>${esc(a.stage)}</td>
                <td>${p ? `${esc(p.name)}${p.title ? `<div class="small muted">${esc(p.title)}</div>` : ''}` : '<span class="muted">—</span>'}${a.contacts.length > 1 ? `<div class="small muted">+${a.contacts.length - 1} more</div>` : ''}</td>
                <td>${vendorPills(a) || '<span class="muted">—</span>'}</td>
                <td>${a.vendorRenewal ? `<span class="small">${fmtDate(a.vendorRenewal, { month: 'short', day: 'numeric', year: '2-digit' })}</span>` : '<span class="muted">—</span>'}</td>
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
        <div class="acard" role="link" tabindex="0" data-act="open-account" data-id="${a.id}">
          <div class="row spread"><span class="row" style="gap:.35rem"><strong class="acard-name">${esc(a.name)}</strong>${accountLinks(a)}</span>${typePill(a)}</div>
          <div class="small muted">${esc(a.stage)}${a.value ? ' · ' + money(a.value) : ''}${a.industry ? ' · ' + esc(a.industry) : ''}</div>
          ${p ? `<div class="small">${esc(p.name)}${p.title ? ` <span class="muted">· ${esc(p.title)}</span>` : ''}${a.contacts.length > 1 ? ` <span class="muted">+${a.contacts.length - 1}</span>` : ''}</div>` : ''}
          ${a.vendors.length ? `<div class="row">${vendorPills(a)}</div>` : ''}
          <div class="acard-dates small">
            <span>Follow-up ${dueChip(a.nextFollowUp)}</span>
            <span>Revisit ${dueChip(a.revisitDate)}</span>
          </div>
        </div>`;
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
                ${col.slice(0, BOARD_CAP).map((a) => {
                  const p = primaryContact(a);
                  return `
                  <div class="kcard" draggable="${!touchUI}" data-id="${a.id}" data-act="open-account">
                    <div class="row spread" style="gap:.3rem;flex-wrap:nowrap"><strong>${esc(a.name)}</strong>${accountLinks(a)}</div>
                    ${p ? `<div class="small muted">${esc(p.name)}</div>` : ''}
                    ${a.vendors.length ? `<div class="small">${esc(a.vendors.join(', '))}</div>` : ''}
                    <div class="row small" style="margin-top:.3rem">${a.value ? `<span>${money(a.value)}</span>` : ''}${a.nextFollowUp ? dueChip(a.nextFollowUp) : ''}</div>
                    ${touchUI ? `<select class="kcard-stage" data-id="${a.id}" aria-label="Move ${esc(a.name)} to stage">${STAGES[type].map((s2) => opt(s2, s2, a.stage)).join('')}</select>` : ''}
                  </div>`;
                }).join('') || '<div class="kcol-empty">Drop here</div>'}
                ${col.length > BOARD_CAP ? `<div class="kcol-empty">+${col.length - BOARD_CAP} more · narrow with filters or search</div>` : ''}
              </div>
            </section>`;
        }).join('')}
      </div>`;
  }

  /** Record a stage change in the account's history (from the board, edit form or activity log). */
  function logStageChange(a, from, to) {
    if (!from || !to || from === to) return;
    a.activities.push({ id: uid(), date: today(), kind: 'Note', summary: `Stage changed: ${from} → ${to}`, notes: '', createdAt: new Date().toISOString() });
  }

  /** Move an account to a new stage and record the change in its history. */
  function moveStage(id, stage) {
    const a = getAccount(id);
    if (!a || a.stage === stage) return;
    logStageChange(a, a.stage, stage);
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
        <div class="row">${viewSwitcher()}<button class="btn ghost" data-act="import-csv" title="Import accounts and contacts from a ZoomInfo or spreadsheet CSV">Import</button><button class="btn ghost" data-act="accounts-csv" title="Export the accounts shown">Export CSV</button><button class="btn" data-act="new-account">+ New account</button></div>
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
      clearTimeout(ui.searchTimer);
      ui.searchTimer = setTimeout(() => { // redraw once typing pauses
        if (!$('#acct-search')) return; // left the page meanwhile
        const pos = $('#acct-search').selectionStart;
        renderAccounts();
        const el = $('#acct-search'); el.focus(); el.setSelectionRange(pos, pos);
      }, 160);
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
            <div class="row"><h1 style="margin:0">${esc(a.name)}</h1>${accountLinks(a)}<span class="pill ${a.type}">${a.type === 'partner' ? 'Partner' : 'Prospect'}</span><span class="pill">${esc(a.stage)}</span></div>
            ${a.tags ? `<div class="row small muted" style="margin-top:.35rem">${tagList(a).map((x) => `<span class="pill">#${esc(x)}</span>`).join('')}</div>` : ''}
          </div>
          <div class="row">
            <button class="btn" data-act="log" data-id="${a.id}">+ Log activity</button>
            <button class="btn ghost" data-act="new-task" data-id="${a.id}">+ Plan task</button>
            ${researchMenu(a)}
            <button class="btn ghost" data-act="edit-account" data-id="${a.id}">Edit</button>
          </div>
        </div>

        <div class="facts">
          <div class="span-all"><span>Current vendors</span>${a.vendors.length ? vendorPills(a) : '—'}</div>
          <div><span>Vendor renewal</span>${a.vendorRenewal ? `${fmtDate(a.vendorRenewal)} <span class="small muted">${relDays(a.vendorRenewal)}</span>` : '—'}</div>
          <div><span>Employees</span>${esc(a.employees) || '—'}</div>
          <div><span>${a.type === 'partner' ? 'Annual value' : 'Deal value'}</span>${money(a.value)}</div>
          <div><span>Next follow-up</span>${a.nextFollowUp ? `<span class="pill ${dueClass(a.nextFollowUp)}">${fmtDate(a.nextFollowUp)}</span> <span class="small muted">${relDays(a.nextFollowUp)}</span>` : '—'}</div>
          <div><span>Next revisit</span>${a.revisitDate ? `<span class="pill ${dueClass(a.revisitDate)}">${fmtDate(a.revisitDate)}</span> <span class="small muted">${relDays(a.revisitDate)}</span>${a.revisitNote ? `<div class="small muted">${esc(a.revisitNote)}</div>` : ''}` : '—'}</div>
          <div><span>Last touch</span>${last ? `${fmtDate(last.date)} <span class="small muted">(${esc(last.kind)})</span>` : 'Never'}</div>
        </div>
        <details class="more-details">
          <summary>More details</summary>
          <div class="facts">
            <div><span>Industry</span>${esc(a.industry) || '—'}</div>
            <div><span>Address</span>${geoQuery(a) ? `${esc(geoQuery(a))}${hasGeo(a) ? ` · <a href="${esc(navUrl(ll(a)))}" target="_blank" rel="noopener">Directions</a>` : ''}` : '—'}</div>
            <div><span>Website</span>${a.website ? `<a href="${esc(extUrl(a.website))}" target="_blank" rel="noopener">${esc(a.website)}</a>` : '—'}</div>
            <div><span>Company LinkedIn</span>${a.linkedin ? `<a href="${esc(extUrl(a.linkedin))}" target="_blank" rel="noopener">Open profile</a>` : '—'}</div>
            <div><span>Lead source</span>${esc(a.leadSource) || '—'}</div>
            <div><span>Added</span>${fmtDate((a.createdAt || '').slice(0, 10) || null)}</div>
          </div>
        </details>

        <div>
          <div class="section-head"><h2 style="margin:0">Contacts <span class="muted small">(${a.contacts.length})</span></h2><button class="btn sm ghost" data-act="new-contact" data-id="${a.id}">+ Add contact</button></div>
          ${a.contacts.length ? `<div class="contact-grid">${[...a.contacts].sort((x, y) => (y.primary ? 1 : 0) - (x.primary ? 1 : 0)).map((c) => `
            <div class="contact-card">
              <div class="row spread">
                <div><strong>${esc(c.name)}</strong> ${c.primary ? '<span class="pill primary">Primary</span>' : ''}</div>
                <div class="row" style="gap:0">
                  ${researchMenu(a, c)}
                  <button class="icon-btn" data-act="enroll-contact" data-id="${a.id}" data-cid="${c.id}" title="Add to cadence">⇉</button>
                  ${c.primary ? '' : `<button class="icon-btn" data-act="primary-contact" data-id="${a.id}" data-cid="${c.id}" title="Make primary">★</button>`}
                  <button class="icon-btn" data-act="edit-contact" data-id="${a.id}" data-cid="${c.id}" title="Edit">✎</button>
                  <button class="icon-btn" data-act="del-contact" data-id="${a.id}" data-cid="${c.id}" title="Delete">✕</button>
                </div>
              </div>
              ${c.title || c.role ? `<div class="small muted">${esc([c.title, c.role].filter(Boolean).join(' · '))}</div>` : ''}
              ${c.status && c.status !== 'Active' ? `<span class="pill overdue">${esc(c.status)}</span>` : ''}
              ${contactLinks(c, a)}
              ${enrollmentsFor(c.id).map((p) => `<button type="button" class="cad-badge" style="--c:${p.cad.color}" data-act="enr-open" data-eid="${p.e.id}">${esc(p.cad.name)} · ${p.e.step + 1}/${p.cad.steps.length}${p.e.status === 'paused' ? ' · paused' : ` · next ${esc(fmtDate(p.e.dueDate, { month: 'short', day: 'numeric' }))}`}</button>`).join('')}
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
            <div class="row spread"><h3 style="margin:0">Cadence steps due</h3><a class="small" href="#cadences">Cadences →</a></div>
            ${(() => {
              const steps = dueSteps(d);
              return steps.length ? `<div class="stack" style="margin-top:.5rem">${steps.map((p) => `
                <div class="task cad-task" style="--c:${p.cad.color}">
                  ${stepIcon(p.step)}
                  <div class="t-main">
                    <div class="t-title">${esc(p.contact.name)} <span class="muted">· ${esc(p.acct.name)}</span></div>
                    <div class="t-sub">${esc(p.cad.name)} · ${esc(p.step.title || stepType(p.step).label)}${p.e.dueDate < d ? ` · <span class="pill overdue">${esc(relDays(p.e.dueDate))}</span>` : ''}</div>
                  </div>
                  <button class="btn sm" data-act="enr-log" data-eid="${p.e.id}">Do it</button>
                </div>`).join('')}</div>` : '<div class="empty">No cadence steps due.</div>';
            })()}
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
            <a class="btn sm ghost" href="#map/route/${d}">🗺 Plan route</a>
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
    $('.modal-actions [data-close]', modalForm).textContent = 'No revisit';
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
  const emptyCriteria = () => ({ type: 'all', stages: [], tags: [], vendors: [], text: '', renewalDays: 0 });

  function matchesCriteria(a, c) {
    if (c.type !== 'all' && a.type !== c.type) return false;
    if (c.stages.length && !c.stages.includes(a.stage)) return false;
    if (c.tags.length && !tagList(a).some((t) => c.tags.includes(t.toLowerCase()))) return false;
    if (c.vendors.length && !a.vendors.some((v) => c.vendors.includes(v))) return false;
    if (c.text && !haystack(a).includes(c.text.toLowerCase())) return false;
    if (c.renewalDays) {
      const n = a.vendorRenewal ? daysBetween(today(), a.vendorRenewal) : -1;
      if (n < 0 || n > c.renewalDays) return false;
    }
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
    if (c.renewalDays) parts.push(`Vendor renewal within ${c.renewalDays} days`);
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
    stages: fd.getAll('stages'), text: (fd.get('text') || '').trim(), renewalDays: Number(fd.get('renewalDays')) || 0,
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
      <div class="grid-2">
        ${field('Name, contacts or notes contain', `<input name="text" value="${esc(c.text)}">`)}
        ${field('Vendor renewal within (days)', `<input name="renewalDays" type="number" min="0" step="15" value="${c.renewalDays || ''}" placeholder="e.g. 120">`)}
      </div>
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
    if (list) accountsCsv(list.name, listAccounts(list));
  }

  function accountsCsv(title, accounts) {
    const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows = [['Account', 'Website', 'Company LinkedIn', 'Type', 'Stage', 'Industry', 'Employees', 'Street address', 'Location', 'Value', 'Current vendors', 'Vendor renewal', 'Primary contact', 'Title', 'Email', 'Phone', 'Contact LinkedIn', 'Other contacts', 'Next follow-up', 'Next revisit', 'Revisit purpose', 'Tags']];
    for (const a of accounts) {
      const p = primaryContact(a) || {};
      rows.push([a.name, a.website, a.linkedin, a.type, a.stage, a.industry, a.employees, a.address, a.location, a.value, a.vendors.join('; '), a.vendorRenewal, p.name, p.title, p.email, p.phone, p.linkedin,
        a.contacts.filter((x) => x.id !== p.id).map((x) => x.name).join('; '), a.nextFollowUp, a.revisitDate, a.revisitNote, a.tags]);
    }
    downloadFile(`${title.replace(/[^\w-]+/g, '-')}-${today()}.csv`, rows.map((r) => r.map(cell).join(',')).join('\r\n'), 'text/csv');
  }

  // ---------- cadences ----------
  // A cadence is an ordered list of steps ("Day 3 · Call"). People (account contacts) are enrolled
  // into it; each enrollment tracks its current step, when that step is due and what happened at
  // every step so far. Completing a step logs it to the account history and the daily plan.
  const cadenceById = (id) => state.cadences.find((c) => c.id === id);
  const stepType = (s) => STEP_TYPES[s.type] || STEP_TYPES.task;
  const stepIcon = (s, cls = '') => `<span class="st-icon st-${s.type} ${cls}" title="${esc(stepType(s).label)}">${stepType(s).icon}</span>`;
  const cadenceDays = (cad) => cad.steps.length ? cad.steps[cad.steps.length - 1].day : 0;
  const plural = (n, word, many = `${word}s`) => `${n} ${n === 1 ? word : many}`;
  const initials = (name) => (name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((x) => x[0].toUpperCase()).join('');

  const isWeekend = (iso) => [0, 6].includes(fromISO(iso).getDay());
  const nextWorkday = (iso) => { while (isWeekend(iso)) iso = addDays(iso, 1); return iso; };
  /** Move n days forward, counting only weekdays when the cadence skips weekends. */
  function shiftDays(iso, n, skipWeekends) {
    if (!skipWeekends) return addDays(iso, n);
    let d = nextWorkday(iso);
    for (let i = 0; i < n; i++) d = nextWorkday(addDays(d, 1));
    return d;
  }

  /** The enrollment with its cadence, account and contact, or null if any of them is gone. */
  function enrollmentParts(e) {
    const cad = cadenceById(e.cadenceId);
    const acct = getAccount(e.accountId);
    const contact = acct && acct.contacts.find((c) => c.id === e.contactId);
    if (!cad || !acct || !contact || !cad.steps.length) return null;
    return { e, cad, acct, contact, step: cad.steps[Math.min(e.step, cad.steps.length - 1)] };
  }
  const liveEnrollments = (cadId) => state.enrollments
    .filter((e) => !cadId || e.cadenceId === cadId).map(enrollmentParts).filter(Boolean);
  const isDue = (e, on = today()) => e.status === 'active' && e.dueDate <= on;
  const enrollmentsFor = (contactId) => liveEnrollments().filter((p) => p.contact.id === contactId && p.e.status !== 'finished');

  /** Date for every step: actual dates for finished steps, due/projected dates for the rest. */
  function stepDates(p) {
    const { e, cad } = p;
    const dates = [];
    cad.steps.forEach((s, i) => {
      const h = [...e.history].reverse().find((x) => x.stepId === s.id);
      if (i < e.step || (e.status === 'finished' && h)) dates.push(h ? h.date : null);
      else if (i === e.step && e.status !== 'finished') dates.push(e.dueDate);
      else {
        const prev = dates[i - 1] || today();
        dates.push(shiftDays(prev, Math.max(0, s.day - cad.steps[i - 1].day), cad.skipWeekends));
      }
    });
    return dates;
  }

  function lastTouch(p) {
    const h = [...p.e.history].reverse().find((x) => !x.skipped);
    if (h) {
      const s = p.cad.steps.find((x) => x.id === h.stepId);
      return { date: h.date, label: s ? stepType(s).label : 'Touch', outcome: h.outcome };
    }
    const act = [...p.acct.activities].filter((x) => x.contactId === p.contact.id).sort((a, b) => b.date.localeCompare(a.date))[0];
    return act ? { date: act.date, label: act.kind, outcome: '' } : null;
  }

  function enroll(cad, acct, contact, startDate) {
    const start = cad.skipWeekends ? nextWorkday(startDate) : startDate;
    state.enrollments.push({
      id: uid(), cadenceId: cad.id, accountId: acct.id, contactId: contact.id, startDate: start,
      step: 0, dueDate: shiftDays(start, Math.max(0, cad.steps[0].day - 1), cad.skipWeekends),
      status: 'active', outcome: '', history: [], addedAt: new Date().toISOString(),
    });
  }

  function advance(p, fromDate) {
    const { e, cad } = p;
    if (e.step + 1 >= cad.steps.length) return finishEnrollment(e, 'completed', fromDate);
    const gap = Math.max(0, cad.steps[e.step + 1].day - cad.steps[e.step].day);
    e.step += 1;
    e.dueDate = shiftDays(fromDate, gap, cad.skipWeekends);
  }

  function finishEnrollment(e, outcome, date = today()) {
    e.status = 'finished';
    e.outcome = outcome;
    e.finishedAt = date;
  }

  /** Merge fields for step subjects and scripts. */
  function fillTemplate(text, p) {
    const { acct, contact } = p;
    const vals = {
      first_name: (contact.name || '').split(/\s+/)[0], name: contact.name, title: contact.title || '',
      company: acct.name, vendor: acct.vendors.find((v) => v !== NO_VENDOR) || 'your current provider',
      industry: acct.industry || 'your industry', employees: acct.employees || '',
      renewal_date: acct.vendorRenewal ? fmtDate(acct.vendorRenewal) : 'soon',
    };
    return (text || '').replace(/\{\{\s*(\w+)\s*\}\}/g, (m, k) => (k in vals ? vals[k] : m));
  }

  /** Put a completed cadence touch into that day's activity plan so it counts toward the targets. */
  function addPlanTouch(d, secKey, row) {
    const rows = getPlan(d, true)[secKey];
    const slot = rows.findIndex((r) => !r.name.trim());
    if (slot === -1) rows.push(row); else rows[slot] = row;
  }

  // ----- cadence page -----
  function renderCadences() {
    if (!state.cadences.length) {
      $('#view').innerHTML = `
        <div class="page-head"><h1>Cadences</h1></div>
        <div class="card stack">
          <div>
            <h2>Build your first cadence</h2>
            <p class="muted" style="margin:0">A cadence is a planned series of calls, emails, LinkedIn touches and visits. Enroll contacts and the app tells you who to touch each day and what to say.</p>
          </div>
          <div class="tpl-grid">
            ${CADENCE_TEMPLATES.map((t, i) => `
              <button type="button" class="tpl-card" data-act="cad-template" data-tpl="${i}" style="--c:${t.color}">
                <strong>${esc(t.name)}</strong>
                <span class="small muted">${esc(t.description)}</span>
                <span class="tpl-steps">${t.steps.map((s) => stepIcon({ type: s[1] })).join('')}</span>
                <span class="small muted">${plural(t.steps.length, 'step')} · ${plural(t.steps[t.steps.length - 1][0], 'day')}</span>
              </button>`).join('')}
            <button type="button" class="tpl-card blank" data-act="cad-new"><strong>+ Blank cadence</strong><span class="small muted">Start from scratch</span></button>
          </div>
        </div>`;
      return;
    }
    if (!cadenceById(ui.cadenceId)) ui.cadenceId = state.cadences[0].id;
    const cad = cadenceById(ui.cadenceId);
    const people = liveEnrollments(cad.id);
    const t = today();
    const active = people.filter((p) => p.e.status === 'active');
    const due = active.filter((p) => isDue(p.e)).sort((a, b) => a.e.dueDate.localeCompare(b.e.dueDate));
    const overdue = due.filter((p) => p.e.dueDate < t);
    const finished = people.filter((p) => p.e.status === 'finished');
    const won = finished.filter((p) => ['meeting', 'replied'].includes(p.e.outcome));
    const atStep = cad.steps.map((s, i) => people.filter((p) => p.e.status !== 'finished' && p.e.step === i).length);
    const filters = { active: 'Active', due: 'Due', paused: 'Paused', finished: 'Finished', all: 'All' };
    const shown = people.filter((p) => ({
      active: p.e.status === 'active', due: isDue(p.e), paused: p.e.status === 'paused', finished: p.e.status === 'finished', all: true,
    })[ui.cadFilter]).sort((a, b) => (a.e.status === 'finished') - (b.e.status === 'finished') || (a.e.dueDate || '').localeCompare(b.e.dueDate || ''));

    $('#view').innerHTML = `
      <div class="page-head">
        <h1>Cadences</h1>
        <button class="btn ghost" data-act="cad-new">+ New cadence</button>
      </div>
      <div class="cad-switch">
        ${state.cadences.map((c) => {
          const live = liveEnrollments(c.id);
          const dueN = live.filter((p) => isDue(p.e)).length;
          return `<button type="button" class="cad-chip ${c.id === cad.id ? 'active' : ''}" data-act="cad-open" data-cad="${c.id}" style="--c:${c.color}">
            <span class="dot"></span>${esc(c.name)} <span class="muted">${live.filter((p) => p.e.status !== 'finished').length}</span>
            ${dueN ? `<span class="due-badge">${dueN} due</span>` : ''}
          </button>`;
        }).join('')}
      </div>

      <div class="card cad-head" style="--c:${cad.color}">
        <div class="detail-head">
          <div>
            <h2 style="margin:0">${esc(cad.name)}</h2>
            ${cad.description ? `<div class="muted small" style="margin-top:.2rem">${esc(cad.description)}</div>` : ''}
            <div class="small muted" style="margin-top:.35rem">${plural(cad.steps.length, 'step')} · ${plural(cadenceDays(cad), 'day')}${cad.skipWeekends ? ' · skips weekends' : ''}</div>
          </div>
          <div class="row">
            <button class="btn" data-act="cad-add-people">+ Add people</button>
            <button class="btn ghost" data-act="cad-edit">Edit steps</button>
            <button class="btn danger sm" data-act="cad-delete">Delete</button>
          </div>
        </div>
        <div class="cad-stats">
          <div><b>${active.length}</b><span>Active</span></div>
          <div class="${due.length ? 'warn' : ''}"><b>${due.length}</b><span>Due now</span></div>
          <div class="${overdue.length ? 'bad' : ''}"><b>${overdue.length}</b><span>Overdue</span></div>
          <div><b>${people.filter((p) => p.e.status === 'paused').length}</b><span>Paused</span></div>
          <div class="good"><b>${won.length}</b><span>Replied / meetings</span></div>
          <div><b>${finished.length ? Math.round((won.length / finished.length) * 100) + '%' : '—'}</b><span>Success rate</span></div>
        </div>
      </div>

      <div class="card">
        <h3>Steps</h3>
        <div class="step-track">
          ${cad.steps.map((s, i) => `
            <div class="step-node">
              ${stepIcon(s)}
              <div class="step-day">Day ${s.day}</div>
              <div class="step-title">${esc(s.title || stepType(s).label)}</div>
              <div class="step-count ${atStep[i] ? 'on' : ''}">${atStep[i]} here</div>
            </div>`).join('<div class="step-link"></div>')}
        </div>
      </div>

      <div class="cad-grid">
        <div class="card">
          <div class="section-head"><h3 style="margin:0">Due now <span class="muted small">(${due.length})</span></h3></div>
          ${due.length ? `<div class="queue">${due.map((p) => `
            <div class="queue-row">
              ${stepIcon(p.step)}
              <div class="grow">
                <div><strong>${esc(p.contact.name)}</strong> <span class="muted small">· ${esc(p.acct.name)}</span></div>
                <div class="small muted">Step ${p.e.step + 1}: ${esc(p.step.title || stepType(p.step).label)}</div>
              </div>
              ${dueChip(p.e.dueDate)}
              <button class="btn sm" data-act="enr-log" data-eid="${p.e.id}">Do it</button>
              <button class="icon-btn" data-act="enr-skip" data-eid="${p.e.id}" title="Skip this step">⤼</button>
            </div>`).join('')}</div>` : '<div class="empty">You\'re all caught up on this cadence.</div>'}
        </div>

        <div class="card">
          <div class="section-head">
            <h3 style="margin:0">People <span class="muted small">(${people.length})</span></h3>
            <div class="seg">${Object.entries(filters).map(([k, l]) => `<button type="button" class="${ui.cadFilter === k ? 'active' : ''}" data-act="cad-filter" data-f="${k}">${l}</button>`).join('')}</div>
          </div>
          ${shown.length ? `<div class="people">${shown.map(personRow).join('')}</div>`
            : `<div class="empty">${people.length ? 'Nobody here.' : 'No one enrolled yet. Click "+ Add people" to start.'}</div>`}
        </div>
      </div>`;
  }

  function progressBar(p) {
    const { e, cad } = p;
    const skipped = new Set(e.history.filter((h) => h.skipped).map((h) => h.stepId));
    return `<div class="seq-bar">${cad.steps.map((s, i) => {
      const st = i < e.step || (e.status === 'finished' && e.history.some((h) => h.stepId === s.id))
        ? (skipped.has(s.id) ? 'skipped' : 'done')
        : i === e.step && e.status !== 'finished' ? 'current' : 'todo';
      return `<span class="seg-${st}" title="Day ${s.day} · ${esc(s.title || stepType(s).label)}"></span>`;
    }).join('')}</div>`;
  }

  const statusPill = (e) => e.status === 'finished'
    ? `<span class="pill ${['meeting', 'replied'].includes(e.outcome) ? 'won' : ''}">${esc(FINISH_LABELS[e.outcome] || 'Finished')}</span>`
    : e.status === 'paused' ? '<span class="pill med">Paused</span>'
    : isDue(e) ? `<span class="pill ${e.dueDate < today() ? 'overdue' : 'today'}">${e.dueDate < today() ? 'Overdue' : 'Due today'}</span>`
    : '<span class="pill active-pill">Active</span>';

  function personRow(p) {
    const last = lastTouch(p);
    const finished = p.e.status === 'finished';
    return `
      <div class="person-row" data-act="enr-open" data-eid="${p.e.id}">
        <div class="avatar" style="--c:${p.cad.color}">${esc(initials(p.contact.name))}</div>
        <div class="p-main">
          <strong>${esc(p.contact.name)} ${contactLinkIcons(p.contact, p.acct)}</strong>
          <div class="small muted">${p.contact.title ? esc(p.contact.title) + ' · ' : ''}<a href="#account/${p.acct.id}">${esc(p.acct.name)}</a>${p.acct.vendors.length ? ' · ' + esc(p.acct.vendors[0]) : ''}</div>
        </div>
        <div class="p-progress">${progressBar(p)}<div class="small muted">${finished ? `Ended ${esc(relDays(p.e.finishedAt))}` : `Step ${p.e.step + 1} of ${p.cad.steps.length}`}</div></div>
        <div class="p-last small"><span class="muted">Last touch</span><div>${last ? `${esc(last.label)} · ${esc(relDays(last.date))}` : 'None yet'}</div></div>
        <div class="p-next small"><span class="muted">Next touch</span><div>${finished ? '—' : `${stepIcon(p.step, 'xs')} ${esc(p.step.title || stepType(p.step).label)} ${dueChip(p.e.dueDate)}`}</div></div>
        <div class="p-status">${statusPill(p.e)}</div>
      </div>`;
  }

  // ----- cadence modals -----
  function contactLinks(c, acct) {
    return `<div class="row small contact-links">
      ${c.email ? `<a href="mailto:${esc(c.email)}">✉ ${esc(c.email)}</a>` : ''}
      ${c.phone ? `<a href="tel:${esc(c.phone)}">☎ ${esc(c.phone)}</a>` : ''}
      ${c.mobile ? `<a href="tel:${esc(c.mobile)}">📱 ${esc(c.mobile)}</a>` : ''}
      ${contactLinkIcons(c, acct)}
      ${c.timezone ? `<span class="muted">🕑 ${esc(c.timezone)}</span>` : ''}
      ${c.channel ? `<span class="muted">Prefers ${esc(c.channel)}</span>` : ''}
    </div>`;
  }

  function enrollmentDetail(eid) {
    const p = enrollmentParts(state.enrollments.find((x) => x.id === eid) || {});
    if (!p) return;
    const { e, cad, acct, contact } = p;
    const dates = stepDates(p);
    const open = e.status !== 'finished';
    openModal(`${contact.name} · ${cad.name}`, `
      <div class="enr-head">
        <div class="avatar lg" style="--c:${cad.color}">${esc(initials(contact.name))}</div>
        <div class="grow">
          <div><strong>${esc(contact.name)}</strong>${contact.title ? ` <span class="muted">· ${esc(contact.title)}</span>` : ''}</div>
          <div class="small"><a href="#account/${acct.id}" data-close>${esc(acct.name)}</a> ${acct.vendors.length ? vendorPills(acct) : ''}</div>
          ${contactLinks(contact, acct)}
        </div>
        ${statusPill(e)}
      </div>
      <ol class="seq-timeline">
        ${cad.steps.map((s, i) => {
          const h = [...e.history].reverse().find((x) => x.stepId === s.id);
          const state_ = h ? (h.skipped ? 'skipped' : 'done') : i === e.step && open ? 'current' : open ? 'todo' : 'unreached';
          const when = state_ === 'done' || state_ === 'skipped' ? fmtDate(h.date, { month: 'short', day: 'numeric' })
            : state_ === 'unreached' ? '' : dates[i] ? `${state_ === 'current' ? 'Due' : 'Planned'} ${fmtDate(dates[i], { weekday: 'short', month: 'short', day: 'numeric' })}` : '';
          return `
            <li class="seq-${state_}">
              ${stepIcon(s)}
              <div class="grow">
                <div class="row spread"><strong>Day ${s.day} · ${esc(s.title || stepType(s).label)}</strong><span class="small ${state_ === 'current' ? dueClass(e.dueDate) : 'muted'}">${esc(when)}</span></div>
                ${h && !h.skipped ? `<div class="small">${esc(h.outcome || 'Done')}${h.note ? ' · ' + esc(h.note) : ''}</div>` : ''}
                ${h && h.skipped ? '<div class="small muted">Skipped</div>' : ''}
                ${state_ === 'current' ? `<div class="row" style="margin-top:.35rem"><button type="button" class="btn sm" data-enr="log">Do this step</button><button type="button" class="btn sm ghost" data-enr="skip">Skip</button></div>` : ''}
              </div>
            </li>`;
        }).join('')}
      </ol>
      <div class="row enr-actions">
        ${open ? `
          <button type="button" class="btn ghost sm" data-enr="${e.status === 'paused' ? 'resume' : 'pause'}">${e.status === 'paused' ? '▶ Resume' : '❚❚ Pause'}</button>
          <button type="button" class="btn ghost sm" data-enr="finish">Finish…</button>`
        : '<button type="button" class="btn ghost sm" data-enr="restart">↺ Restart from step 1</button>'}
        <button type="button" class="btn danger sm" data-enr="remove">Remove</button>
      </div>`, () => {}, 'Close', { wide: true });
    modalForm.querySelector('.modal-actions [data-close]').remove();
    $$('[data-enr]', modalForm).forEach((b) => b.addEventListener('click', () => enrollmentAction(eid, b.dataset.enr)));
  }

  function enrollmentAction(eid, action) {
    const e = state.enrollments.find((x) => x.id === eid);
    const p = enrollmentParts(e);
    if (!p) return;
    const t = today();
    const fromDetail = modal.open; // actions inside the person's detail re-open it afterwards
    if (action === 'log') return logStepForm(eid);
    if (action === 'skip') { e.history.push({ stepId: p.step.id, date: t, skipped: true }); advance(p, t); toast('Step skipped'); }
    if (action === 'pause') { e.status = 'paused'; toast('Paused'); }
    if (action === 'resume') { e.status = 'active'; if (e.dueDate < t) e.dueDate = p.cad.skipWeekends ? nextWorkday(t) : t; toast('Resumed'); }
    if (action === 'restart') {
      Object.assign(e, { step: 0, status: 'active', outcome: '', finishedAt: '', dueDate: p.cad.skipWeekends ? nextWorkday(t) : t });
      toast('Restarted');
    }
    if (action === 'remove') {
      if (!confirm(`Remove ${p.contact.name} from ${p.cad.name}? Their logged activities stay in the account history.`)) return;
      state.enrollments = state.enrollments.filter((x) => x !== e);
      modal.close(); save(); rerender(); return;
    }
    if (action === 'finish') return finishForm(eid);
    save(); rerender();
    if (fromDetail) enrollmentDetail(eid);
  }

  function finishForm(eid) {
    const p = enrollmentParts(state.enrollments.find((x) => x.id === eid));
    openModal(`Finish ${p.contact.name}'s cadence`, `
      ${field('Outcome', `<select name="outcome">${Object.entries(FINISH_LABELS).filter(([k]) => k !== 'removed').map(([k, l]) => opt(k, l, 'meeting')).join('')}</select>`)}
      ${field('Note', '<input name="note" placeholder="Optional">')}`, (data) => {
      finishEnrollment(p.e, data.outcome);
      p.acct.activities.push({ id: uid(), date: today(), kind: 'Note', summary: `${p.cad.name}: finished (${FINISH_LABELS[data.outcome]})`, notes: data.note, contactId: p.contact.id, createdAt: new Date().toISOString() });
      touch(p.acct);
      toast('Cadence finished');
    }, 'Finish');
  }

  function logStepForm(eid) {
    const p = enrollmentParts(state.enrollments.find((x) => x.id === eid));
    if (!p) return;
    const { e, cad, acct, contact, step } = p;
    const type = stepType(step);
    const subject = fillTemplate(step.subject, p);
    const body = fillTemplate(step.body, p);
    const liUrl = contact.linkedin
      ? (/^https?:/.test(contact.linkedin) ? contact.linkedin : 'https://' + contact.linkedin)
      : `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(`${contact.name} ${acct.name}`)}`;
    const actions = {
      email: contact.email ? `<a class="btn" href="mailto:${esc(contact.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}">✉ Open in Mail</a>` : '<span class="small muted">No email on file for this contact.</span>',
      call: [contact.phone && `<a class="btn" href="tel:${esc(contact.phone)}">☎ Call ${esc(contact.phone)}</a>`, contact.mobile && `<a class="btn ghost" href="tel:${esc(contact.mobile)}">📱 Mobile</a>`].filter(Boolean).join(' ') || '<span class="small muted">No phone on file.</span>',
      linkedin: `<a class="btn" href="${esc(liUrl)}" target="_blank" rel="noopener">in Open LinkedIn</a>`,
      visit: `<a class="btn" href="https://maps.apple.com/?q=${encodeURIComponent([acct.name, acct.location].filter(Boolean).join(' '))}" target="_blank" rel="noopener">⌂ Directions</a>`,
      text: contact.mobile ? `<a class="btn" href="sms:${esc(contact.mobile)}&body=${encodeURIComponent(body)}">✆ Text ${esc(contact.mobile)}</a>` : '<span class="small muted">No mobile number on file.</span>',
      task: '',
    };
    openModal(`${type.label}: ${step.title || type.label}`, `
      <div class="enr-head">
        ${stepIcon(step, 'lg')}
        <div class="grow">
          <div><strong>${esc(contact.name)}</strong>${contact.title ? ` <span class="muted">· ${esc(contact.title)}</span>` : ''} · ${esc(acct.name)}</div>
          <div class="small muted">${esc(cad.name)} · Step ${e.step + 1} of ${cad.steps.length} · Day ${step.day}${e.dueDate < today() ? ` · <span class="pill overdue">due ${esc(relDays(e.dueDate))}</span>` : ''}</div>
        </div>
      </div>
      <div class="row">${actions[step.type] || ''}</div>
      ${subject || body ? `
        <div class="script">
          ${subject ? `<div class="small"><span class="muted">Subject:</span> <strong>${esc(subject)}</strong></div>` : ''}
          ${body ? `<div class="script-body">${esc(body)}</div>` : ''}
          <button type="button" class="btn sm ghost" id="copy-script">Copy</button>
        </div>` : ''}
      <div class="grid-3">
        ${field('Outcome', `<select name="outcome" id="step-outcome">${type.outcomes.map((o) => `<option>${esc(o)}</option>`).join('')}</select>`)}
        ${field('Then', `<select name="then" id="step-then">${Object.entries(EXIT_OUTCOMES).map(([k, l]) => opt(k, l, 'continue')).join('')}</select>`)}
        ${field('Date', `<input name="date" type="date" value="${today()}">`)}
        ${field('Notes', '<textarea name="note" rows="2" placeholder="What happened, next steps…"></textarea>', 'span-3')}
      </div>`, (data) => {
      const actId = uid();
      acct.activities.push({
        id: actId, date: data.date, kind: type.kind, contactId: contact.id, createdAt: new Date().toISOString(),
        summary: `${cad.name} · ${step.title || type.label}: ${data.outcome}`, notes: data.note,
      });
      e.history.push({ stepId: step.id, date: data.date, outcome: data.outcome, note: data.note, activityId: actId });
      if (type.plan) addPlanTouch(data.date, type.plan, { name: acct.name, kind: type.kind, note: `${cad.name}: ${step.title || type.label}`, done: true, activityId: actId });
      if (data.then === 'continue') advance(p, data.date); else finishEnrollment(e, data.then, data.date);
      touch(acct);
      toast(e.status === 'finished' ? `${contact.name}: ${FINISH_LABELS[e.outcome]}` : `Logged · next: ${fmtDate(e.dueDate, { month: 'short', day: 'numeric' })}`);
    }, 'Complete step', { wide: true });
    const copy = $('#copy-script');
    if (copy) copy.addEventListener('click', () => {
      const text = [subject && `Subject: ${subject}`, body].filter(Boolean).join('\n\n');
      (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject()).then(() => toast('Copied'), () => toast('Copy not available'));
    });
    $('#step-outcome').addEventListener('change', (ev) => {
      if (/replied/i.test(ev.target.value)) $('#step-then').value = 'replied';
    });
  }

  function addPeopleForm(cad, preset = {}) {
    const inCad = new Set(state.enrollments.filter((e) => e.cadenceId === cad.id && e.status !== 'finished').map((e) => e.contactId));
    const people = state.accounts.flatMap((a) => a.contacts.map((c) => ({ a, c })))
      .sort((x, y) => x.a.name.localeCompare(y.a.name) || (y.c.primary - x.c.primary));
    openModal(`Add people to ${cad.name}`, `
      <div class="grid-3">
        ${field('Show', `<select id="ap-source">
          <option value="">All contacts</option>
          ${state.lists.length ? `<optgroup label="Saved lists">${state.lists.map((l) => `<option value="${l.id}">${esc(l.name)}</option>`).join('')}</optgroup>` : ''}
          <optgroup label="Current vendor">${allVendors().filter((v) => state.accounts.some((a) => a.vendors.includes(v))).map((v) => `<option value="vendor:${esc(v)}">${esc(v)}</option>`).join('')}</optgroup>
        </select>`)}
        ${field('Search', '<input id="ap-search" type="search" placeholder="Name, title, account…">')}
        ${field('Start date', `<input name="start" type="date" value="${today()}">`)}
      </div>
      <div class="row spread small">
        <label class="row"><input type="checkbox" id="ap-primary" style="width:auto"> Primary contacts only</label>
        <label class="row"><input type="checkbox" id="ap-all" style="width:auto"> Select all shown</label>
      </div>
      <div class="pick-list" id="ap-list">
        ${people.length ? people.map(({ a, c }) => {
          const blocked = c.status && c.status !== 'Active' ? c.status : inCad.has(c.id) ? 'Already in this cadence' : '';
          return `<label class="pick ${blocked ? 'blocked' : ''}" data-acct="${a.id}" data-primary="${c.primary ? 1 : 0}" data-text="${esc([c.name, c.title, a.name, ...a.vendors].join(' ').toLowerCase())}">
            <input type="checkbox" name="pick" value="${a.id}|${c.id}" ${blocked ? 'disabled' : ''} ${preset.contactId === c.id && !blocked ? 'checked' : ''}>
            <span class="avatar sm" style="--c:${cad.color}">${esc(initials(c.name))}</span>
            <span class="grow"><strong>${esc(c.name)}</strong>${c.title ? ` <span class="muted">· ${esc(c.title)}</span>` : ''}<div class="small muted">${esc(a.name)}${a.vendors.length ? ' · ' + esc(a.vendors.join(', ')) : ''}</div></span>
            ${blocked ? `<span class="small muted">${esc(blocked)}</span>` : ''}
          </label>`;
        }).join('') : '<div class="empty">Add contacts to your accounts first.</div>'}
      </div>
      <div class="small" id="ap-count"></div>`, (data, fd) => {
      const picks = fd.getAll('pick');
      if (!picks.length) { toast('Pick at least one person'); return false; }
      for (const v of picks) {
        const [aid, cid] = v.split('|');
        const a = getAccount(aid);
        enroll(cad, a, a.contacts.find((c) => c.id === cid), data.start || today());
      }
      ui.cadenceId = cad.id;
      toast(`Added ${picks.length} ${picks.length === 1 ? 'person' : 'people'}`);
    }, 'Add to cadence', { wide: true });

    const listIds = (src) => {
      if (!src) return null;
      const list = resolveList(src);
      return list ? new Set(listAccounts(list).map((a) => a.id)) : null;
    };
    const refresh = () => {
      const q = $('#ap-search').value.trim().toLowerCase();
      const ids = listIds($('#ap-source').value);
      const primaryOnly = $('#ap-primary').checked;
      $$('#ap-list .pick').forEach((row) => {
        row.hidden = (ids && !ids.has(row.dataset.acct)) || (primaryOnly && row.dataset.primary !== '1') || (q && !row.dataset.text.includes(q));
      });
      const n = $$('#ap-list input:checked').length;
      $('#ap-count').textContent = `${n} selected`;
    };
    $('#ap-source').addEventListener('change', refresh);
    $('#ap-search').addEventListener('input', refresh);
    $('#ap-primary').addEventListener('change', refresh);
    $('#ap-list').addEventListener('change', refresh);
    $('#ap-all').addEventListener('change', (ev) => {
      $$('#ap-list .pick:not([hidden]) input:not(:disabled)').forEach((cb) => { cb.checked = ev.target.checked; });
      refresh();
    });
    refresh();
  }

  function enrollContactForm(acct, contact) {
    if (!state.cadences.length) {
      if (confirm('You have no cadences yet. Create one now?')) go('cadences');
      return;
    }
    if (contact.status && contact.status !== 'Active') { toast(`${contact.name} is marked "${contact.status}"`); return; }
    const current = enrollmentsFor(contact.id).map((p) => p.cad.id);
    const choices = state.cadences.filter((c) => !current.includes(c.id));
    if (!choices.length) { toast(`${contact.name} is already in every cadence`); return; }
    openModal(`Add ${contact.name} to a cadence`, `
      <div class="grid-2">
        ${field('Cadence', `<select name="cad">${choices.map((c) => opt(c.id, `${c.name} (${plural(c.steps.length, 'step')})`, ui.cadenceId)).join('')}</select>`)}
        ${field('Start date', `<input name="start" type="date" value="${today()}">`)}
      </div>`, (data) => {
      const cad = cadenceById(data.cad);
      enroll(cad, acct, contact, data.start || today());
      toast(`${contact.name} added to ${cad.name}`);
    }, 'Add');
  }

  function cadenceForm(existing, template) {
    const src = existing || (template ? {
      name: template.name, description: template.description, color: template.color, skipWeekends: true,
      steps: template.steps.map(([day, type, title, subject, body]) => ({ id: uid(), day, type, title, subject, body })),
    } : { name: '', description: '', color: CADENCE_COLORS.find((c) => !state.cadences.some((x) => x.color === c)) || CADENCE_COLORS[state.cadences.length % CADENCE_COLORS.length], skipWeekends: true, steps: [{ id: uid(), day: 1, type: 'email', title: 'Intro email', subject: '', body: '' }] });
    const stepRow = (s) => `
      <div class="step-edit">
        <input type="hidden" name="s_id" value="${esc(s.id || uid())}">
        <div class="step-edit-main">
          <span class="step-num"></span>
          <label class="day-in">Day <input name="s_day" type="number" min="1" value="${esc(s.day)}" required></label>
          <select name="s_type">${Object.entries(STEP_TYPES).map(([k, v]) => opt(k, `${v.icon}  ${v.label}`, s.type)).join('')}</select>
          <input name="s_title" placeholder="Step name, e.g. Discovery call" value="${esc(s.title)}">
          <span class="step-btns">
            <button type="button" class="icon-btn" data-step="up" title="Move up">↑</button>
            <button type="button" class="icon-btn" data-step="down" title="Move down">↓</button>
            <button type="button" class="icon-btn" data-step="del" title="Remove step">✕</button>
          </span>
        </div>
        <details ${s.subject || s.body ? '' : ''}>
          <summary class="small">Subject & script / template${s.subject || s.body ? ' ✓' : ''}</summary>
          <input name="s_subject" placeholder="Email subject (email steps)" value="${esc(s.subject)}">
          <textarea name="s_body" rows="4" placeholder="Email body, call talking points, LinkedIn note…">${esc(s.body)}</textarea>
        </details>
      </div>`;
    openModal(existing ? `Edit ${existing.name}` : 'New cadence', `
      <div class="grid-3">
        ${field('Cadence name *', `<input name="name" required value="${esc(src.name)}" placeholder="e.g. Insperity Renewal">`, 'span-2')}
        ${field('Color', `<select name="color">${CADENCE_COLORS.map((c, i) => opt(c, ['Blue', 'Orange', 'Green', 'Purple', 'Pink', 'Gold', 'Teal'][i], src.color)).join('')}</select>`)}
        ${field('Description', `<input name="description" value="${esc(src.description)}" placeholder="Who it's for and the angle">`, 'span-2')}
        <label class="row small" style="align-self:end"><input type="checkbox" name="skipWeekends" style="width:auto" ${src.skipWeekends ? 'checked' : ''}> Skip weekends</label>
      </div>
      <div>
        <div class="row spread"><strong>Steps</strong><span class="small muted">Merge fields: {{first_name}} {{company}} {{vendor}} {{title}} {{industry}} {{employees}} {{renewal_date}}</span></div>
        <div id="steps-edit">${src.steps.map(stepRow).join('')}</div>
        <button type="button" class="btn sm ghost" id="add-step">+ Add step</button>
      </div>`, (data, fd) => {
      if (!data.name.trim()) return false;
      const ids = fd.getAll('s_id'); const days = fd.getAll('s_day'); const types = fd.getAll('s_type');
      const titles = fd.getAll('s_title'); const subjects = fd.getAll('s_subject'); const bodies = fd.getAll('s_body');
      const steps = ids.map((id, i) => ({ id, day: Math.max(1, Number(days[i]) || 1), type: types[i], title: titles[i].trim(), subject: subjects[i], body: bodies[i] }))
        .map((s, i) => ({ s, i })).sort((x, y) => x.s.day - y.s.day || x.i - y.i).map((x) => x.s);
      if (!steps.length) { toast('Add at least one step'); return false; }
      const fields = { name: data.name.trim(), description: data.description, color: data.color, skipWeekends: !!data.skipWeekends, steps };
      if (existing) {
        // Keep everyone on the same step (by id) after steps are reordered, added or removed.
        for (const e of state.enrollments.filter((x) => x.cadenceId === existing.id && x.status !== 'finished')) {
          const oldId = (existing.steps[e.step] || {}).id;
          const idx = steps.findIndex((s) => s.id === oldId);
          e.step = idx === -1 ? Math.min(e.step, steps.length - 1) : idx;
        }
        Object.assign(existing, fields);
        toast('Cadence saved');
      } else {
        const cad = { id: uid(), ...fields };
        state.cadences.push(cad);
        ui.cadenceId = cad.id;
        location.hash = `cadences/${cad.id}`;
        toast('Cadence created');
      }
    }, existing ? 'Save cadence' : 'Create cadence', { wide: true });

    const box = $('#steps-edit');
    const renumber = () => $$('.step-edit', box).forEach((r, i) => { $('.step-num', r).textContent = i + 1; });
    box.addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-step]');
      if (!b) return;
      const row = b.closest('.step-edit');
      if (b.dataset.step === 'del') { if ($$('.step-edit', box).length > 1) row.remove(); }
      if (b.dataset.step === 'up' && row.previousElementSibling) box.insertBefore(row, row.previousElementSibling);
      if (b.dataset.step === 'down' && row.nextElementSibling) box.insertBefore(row.nextElementSibling, row);
      renumber();
    });
    $('#add-step').addEventListener('click', () => {
      const lastDay = Math.max(1, ...$$('[name=s_day]', box).map((x) => Number(x.value) || 1));
      box.insertAdjacentHTML('beforeend', stepRow({ id: uid(), day: lastDay + 2, type: 'call', title: '', subject: '', body: '' }));
      renumber();
      $$('[name=s_title]', box).pop().focus();
    });
    renumber();
  }

  /** Cadence steps due on day d (on today's page, overdue ones too), across all cadences. */
  const dueSteps = (d) => liveEnrollments().filter((p) => p.e.status === 'active' && (p.e.dueDate === d || (d === today() && p.e.dueDate < d)))
    .sort((a, b) => a.e.dueDate.localeCompare(b.e.dueDate));

  // ---------- web links & research (LinkedIn, Sales Navigator, ZoomInfo) ----------
  const extUrl = (u) => (u ? (/^https?:\/\//i.test(u.trim()) ? u.trim() : 'https://' + u.trim().replace(/^\/+/, '')) : '');
  const SVG_WEB = '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>';
  const SVG_LI = '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M8 10.5V17M8 7.2v.1M11.5 17v-6.5M11.5 13.2a2.6 2.6 0 0 1 5 1V17"/></svg>';
  const SVG_FIND = '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6"/><path d="M20 20l-4.2-4.2"/></svg>';

  /** Small icon links: website and LinkedIn. A missing LinkedIn shows a faded "find on LinkedIn" icon. */
  function linkIcons({ website, linkedin, findLinkedIn }) {
    return `<span class="ext-links">
      ${website ? `<a class="ext-ic web" href="${esc(extUrl(website))}" target="_blank" rel="noopener" title="Website: ${esc(website)}" aria-label="Website">${SVG_WEB}</a>` : ''}
      ${linkedin ? `<a class="ext-ic li" href="${esc(extUrl(linkedin))}" target="_blank" rel="noopener" title="LinkedIn profile" aria-label="LinkedIn">${SVG_LI}</a>`
        : findLinkedIn ? `<a class="ext-ic li missing" href="${esc(findLinkedIn)}" target="_blank" rel="noopener" title="Find on LinkedIn" aria-label="Find on LinkedIn">${SVG_LI}</a>` : ''}
    </span>`;
  }
  const liPeopleSearch = (name, company) => `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(`${name} ${company || ''}`.trim())}`;
  const liCompanySearch = (company) => `https://www.linkedin.com/search/results/companies/?keywords=${encodeURIComponent(company)}`;
  const accountLinks = (a) => linkIcons({ website: a.website, linkedin: a.linkedin, findLinkedIn: liCompanySearch(a.name) });
  const contactLinkIcons = (c, a) => linkIcons({ linkedin: c.linkedin, findLinkedIn: liPeopleSearch(c.name, a && a.name) });

  /**
   * "Look up" menu: opens LinkedIn, Sales Navigator or ZoomInfo searching for the account or person.
   * The search text is also copied, so it can be pasted if a site opens without it filled in.
   */
  function researchMenu(a, c) {
    const q = c ? `${c.name} ${a.name}` : a.name;
    const items = c ? [
      ['LinkedIn', liPeopleSearch(c.name, a.name), 'Search people on LinkedIn'],
      ['Sales Navigator', `https://www.linkedin.com/sales/search/people?keywords=${encodeURIComponent(q)}`, 'Search leads in Sales Navigator'],
      ['ZoomInfo', 'https://app.zoominfo.com/#/apps/search/v2', 'Open ZoomInfo search (name copied — paste it in)'],
    ] : [
      ['LinkedIn', liCompanySearch(a.name), 'Search companies on LinkedIn'],
      ['Sales Navigator', `https://www.linkedin.com/sales/search/company?keywords=${encodeURIComponent(a.name)}`, 'Search accounts in Sales Navigator'],
      ['ZoomInfo', 'https://app.zoominfo.com/#/apps/search/v2', 'Open ZoomInfo search (name copied — paste it in)'],
      ['ZoomInfo profile', `https://www.google.com/search?q=${encodeURIComponent(`site:zoominfo.com/c ${a.name}`)}`, "Find the company's public ZoomInfo profile"],
      ['Google', `https://www.google.com/search?q=${encodeURIComponent([a.name, a.location].filter(Boolean).join(' '))}`, 'Search the web'],
    ];
    return `<details class="research">
      <summary class="${c ? 'icon-btn' : 'btn ghost'}" title="Look up ${esc(q)}">${SVG_FIND}${c ? '' : ' Look up'}</summary>
      <div class="research-menu">
        <div class="small muted">Look up ${esc(q)}</div>
        ${items.map(([label, href, title]) => `<a href="${esc(href)}" target="_blank" rel="noopener" data-copy="${esc(q)}" title="${esc(title)}">${esc(label)}</a>`).join('')}
        <a href="#research/${a.id}" class="ask-claude" title="Research ${esc(a.name)} with Claude and add the results to the CRM">✦ Ask Claude</a>
      </div>
    </details>`;
  }

  // Research links copy the search text so it's ready to paste; menus close when you click elsewhere.
  document.addEventListener('click', (e) => {
    const copy = e.target.closest('a[data-copy]');
    if (copy && navigator.clipboard) navigator.clipboard.writeText(copy.dataset.copy).then(() => toast(`"${copy.dataset.copy}" copied`), () => {});
    $$('details.research[open]').forEach((d) => { if (!d.contains(e.target) || copy) d.open = false; });
  });

  // ---------- CSV import (ZoomInfo exports, spreadsheets, other CRMs) ----------
  /** RFC 4180-style CSV parser: quoted fields, escaped quotes, commas/newlines inside quotes, BOM. */
  function parseCsv(text) {
    const rows = []; let row = []; let cell = ''; let quoted = false;
    text = text.replace(/^﻿/, '');
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (quoted) {
        if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
        else if (ch === '"') quoted = false;
        else cell += ch;
      } else if (ch === '"') quoted = true;
      else if (ch === ',') { row.push(cell); cell = ''; }
      else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i + 1] === '\n') i++;
        row.push(cell); rows.push(row); row = []; cell = '';
      } else cell += ch;
    }
    if (cell || row.length) { row.push(cell); rows.push(row); }
    return rows.filter((r) => r.some((x) => x.trim()));
  }

  // Column names we recognize (compared lower-case, letters and digits only). ZoomInfo's export names included.
  const CSV_FIELDS = {
    company: ['companyname', 'company', 'account', 'accountname', 'organization', 'organizationname', 'employer'],
    website: ['website', 'companywebsite', 'websiteurl', 'domain', 'companydomain', 'url'],
    industry: ['industry', 'primaryindustry', 'companyindustry'],
    employees: ['employees', 'employeecount', 'companyemployeecount', 'numberofemployees', 'companysize', 'employeerange'],
    city: ['companycity', 'city', 'hqcity'],
    state: ['companystate', 'state', 'hqstate', 'region'],
    location: ['location', 'companylocation'],
    address: ['companystreetaddress', 'streetaddress', 'address', 'companyaddress', 'street', 'hqaddress', 'address1'],
    zip: ['companyzipcode', 'zipcode', 'zip', 'postalcode', 'companypostalcode'],
    companyLinkedin: ['companylinkedinurl', 'linkedincompanyurl', 'companylinkedin', 'linkedincompanyprofileurl'],
    first: ['firstname', 'first'],
    last: ['lastname', 'last'],
    name: ['fullname', 'name', 'contactname', 'contact', 'primarycontact'],
    title: ['jobtitle', 'title', 'position'],
    email: ['email', 'emailaddress', 'businessemail', 'workemail', 'supplementalemail'],
    phone: ['directphonenumber', 'directphone', 'phone', 'phonenumber', 'workphone', 'businessphone'],
    mobile: ['mobilephone', 'mobile', 'cellphone', 'mobilenumber'],
    linkedin: ['linkedincontactprofileurl', 'contactlinkedin', 'linkedinurl', 'linkedinprofile', 'linkedinprofileurl', 'personlinkedinurl', 'profileurl', 'linkedin'],
  };
  const normHeader = (h) => h.toLowerCase().replace(/[^a-z0-9]/g, '');

  function mapCsv(rows) {
    const headers = rows[0].map(normHeader);
    const col = {};
    for (const [key, aliases] of Object.entries(CSV_FIELDS)) {
      const i = aliases.map((al) => headers.indexOf(al)).find((x) => x !== -1);
      if (i !== undefined) col[key] = i;
    }
    const get = (r, k) => (col[k] === undefined ? '' : (r[col[k]] || '').trim());
    const records = rows.slice(1).map((r) => {
      const name = get(r, 'name') || [get(r, 'first'), get(r, 'last')].filter(Boolean).join(' ');
      const emp = get(r, 'employees').match(/\d[\d,]*/);
      return {
        company: get(r, 'company'), website: get(r, 'website'), industry: get(r, 'industry'),
        employees: emp ? emp[0].replace(/,/g, '') : '',
        location: get(r, 'location') || [get(r, 'city'), [get(r, 'state'), get(r, 'zip')].filter(Boolean).join(' ')].filter(Boolean).join(', '),
        address: get(r, 'address'),
        companyLinkedin: get(r, 'companyLinkedin'),
        contact: name ? { name, title: get(r, 'title'), email: get(r, 'email'), phone: get(r, 'phone'), mobile: get(r, 'mobile'), linkedin: get(r, 'linkedin') } : null,
      };
    }).filter((x) => x.company);
    return { col, records };
  }

  /** Work out what an import would do (dry run) or do it, without overwriting anything already filled in. */
  function applyImport(records, opts, commit) {
    const now = new Date().toISOString();
    const made = new Map(); // lower-case name -> new account (dry run keeps them here)
    const stats = { newAccounts: 0, updatedAccounts: new Set(), newContacts: 0, skippedContacts: 0 };
    for (const r of records) {
      const key = r.company.toLowerCase();
      let a = findAccountByName(r.company) || made.get(key);
      if (!a) {
        a = migrateAccount({
          id: uid(), name: r.company, type: opts.type, stage: STAGES[opts.type][0], tags: opts.tag, notes: '', vendors: [],
          contacts: [], activities: [], keyDates: [], leadSource: opts.source, createdAt: now, updatedAt: now,
        });
        made.set(key, a);
        stats.newAccounts++;
        if (commit) state.accounts.push(a);
      } else if (!made.has(key)) stats.updatedAccounts.add(a.id);
      const fill = { website: r.website, industry: r.industry, employees: r.employees, location: r.location, address: r.address, linkedin: r.companyLinkedin };
      if (commit) for (const [k, v] of Object.entries(fill)) if (v && !a[k]) a[k] = v;
      if (r.contact) {
        const c = r.contact;
        const dup = a.contacts.some((x) => (c.email && x.email && x.email.toLowerCase() === c.email.toLowerCase()) || x.name.toLowerCase() === c.name.toLowerCase());
        if (dup) stats.skippedContacts++;
        else {
          stats.newContacts++;
          const contact = { id: uid(), ...c, role: '', notes: '', status: 'Active', channel: '', timezone: '', primary: a.contacts.length === 0 };
          if (commit) a.contacts.push(contact); else a.contacts = [...a.contacts, contact];
        }
      }
      if (commit) touch(a);
    }
    return stats;
  }

  function importCsvForm(text, fileName) {
    const rows = parseCsv(text);
    if (rows.length < 2) { alert('That file has no rows to import.'); return; }
    const { col, records } = mapCsv(rows);
    if (col.company === undefined) {
      alert('Couldn\'t find a company column. The first row should have headers such as "Company Name", "Website", "First Name", "Last Name", "Job Title", "Email".');
      return;
    }
    // Dry run against copies so the preview never changes real data.
    const preview = () => {
      const saved = state.accounts;
      state.accounts = saved.map((a) => ({ ...a, contacts: [...a.contacts] }));
      try { return applyImport(records, { type: 'prospect', tag: '', source: '' }, false); } finally { state.accounts = saved; }
    };
    const s = preview();
    const found = Object.keys(col).filter((k) => !['first', 'last', 'city', 'state', 'zip'].includes(k))
      .map((k) => ({ company: 'Company', website: 'Website', industry: 'Industry', employees: 'Employees', location: 'Location', companyLinkedin: 'Company LinkedIn',
        name: 'Name', title: 'Title', email: 'Email', phone: 'Phone', mobile: 'Mobile', linkedin: 'LinkedIn', address: 'Street address' })[k]);
    if (col.first !== undefined || col.last !== undefined) found.push('Name');
    if (col.city !== undefined || col.state !== undefined) found.push('City/State');
    const fromZoomInfo = /zoominfo/i.test(fileName) || col.companyLinkedin !== undefined || rows[0].some((h) => /zoominfo/i.test(h));
    openModal('Import accounts & contacts', `
      <div class="import-summary">
        <div><b>${s.newAccounts}</b><span>new accounts</span></div>
        <div><b>${s.updatedAccounts.size}</b><span>existing accounts</span></div>
        <div><b>${s.newContacts}</b><span>new contacts</span></div>
        <div><b>${s.skippedContacts}</b><span>duplicates skipped</span></div>
      </div>
      <p class="small muted" style="margin:0">From <strong>${esc(fileName)}</strong> (${records.length} rows). Columns recognized: ${[...new Set(found)].map((f) => `<span class="pill">${esc(f)}</span>`).join(' ')}</p>
      <p class="small muted" style="margin:0">Existing accounts are matched by name. Only empty fields are filled in, and contacts already on an account (same email or name) are skipped.</p>
      <div class="grid-3">
        ${field('New accounts are', `<select name="type">${opt('prospect', 'Prospects', 'prospect')}${opt('partner', 'Partners', '')}</select>`)}
        ${field('Lead source', `<select name="source"><option value="">—</option>${LEAD_SOURCES.map((x) => opt(x, x, '')).join('')}</select>`)}
        ${field('Tag new accounts', `<input name="tag" value="${fromZoomInfo ? 'zoominfo' : 'import'}-${today().slice(5)}">`)}
      </div>`, (data) => {
      const st2 = applyImport(records, { type: data.type, tag: data.tag.trim(), source: data.source }, true);
      toast(`Imported: ${st2.newAccounts} new accounts, ${st2.newContacts} contacts`);
      ui.typeFilter = 'all'; ui.stageFilter = 'all'; ui.vendorFilter = 'all'; ui.search = '';
      go('accounts');
    }, 'Import', { wide: true });
  }

  $('#csv-import').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (file) importCsvForm(await file.text(), file.name);
  });

  // ---------- map & route planner ----------
  // Leaflet (bundled in vendor/) draws the map; OpenStreetMap's Nominatim finds coordinates for
  // addresses (free, at most one lookup per second); the public OSRM server gives drive times and
  // road routes. Every network step has a fallback so the page still works if a service is down.
  const CA_CENTER = [37.2, -119.5];
  const AVG_MPH = 35;
  const mapState = { map: null, view: null, keep: null, runId: 0, locating: null, me: null, placing: null, markers: new Map(), legsCache: new Map() };

  const geoQuery = (a) => [a.address, a.location].filter(Boolean).join(', ').trim();
  const hasGeo = (a) => !!(a.geo && Number.isFinite(a.geo.lat) && (a.geo.manual || a.geo.q === geoQuery(a)));
  const needsGeo = (a) => geoQuery(a) && !hasGeo(a) && !(a.geo && a.geo.miss && a.geo.q === geoQuery(a));
  const geoMissed = (a) => !hasGeo(a) && a.geo && a.geo.miss && a.geo.q === geoQuery(a);
  const ll = (a) => [a.geo.lat, a.geo.lng];
  const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);

  function miles(p, q) {
    const R = 3958.8, toRad = (x) => (x * Math.PI) / 180;
    const dLat = toRad(q[0] - p[0]), dLng = toRad(q[1] - p[1]);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(p[0])) * Math.cos(toRad(q[0])) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }
  const fmtMiles = (m) => `${m < 10 ? m.toFixed(1) : Math.round(m)} mi`;
  const fmtDur = (sec) => { const m = Math.round(sec / 60); return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`; };
  const navUrl = (p) => (isIOS ? `https://maps.apple.com/?daddr=${p[0]},${p[1]}&dirflg=d` : `https://www.google.com/maps/dir/?api=1&destination=${p[0]},${p[1]}&travelmode=driving`);

  let leafletReady = null;
  function loadLeaflet() {
    if (window.L) return Promise.resolve();
    leafletReady ||= new Promise((resolve, reject) => {
      const css = document.createElement('link');
      css.rel = 'stylesheet'; css.href = 'vendor/leaflet/leaflet.css';
      document.head.appendChild(css);
      const js = document.createElement('script');
      js.src = 'vendor/leaflet/leaflet.js';
      js.onload = resolve; js.onerror = () => { leafletReady = null; reject(new Error('Map library failed to load')); };
      document.head.appendChild(js);
    });
    return leafletReady;
  }

  async function geocode(q) {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=us&q=${encodeURIComponent(q)}`, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`Address lookup failed (${res.status})`);
    const [hit] = await res.json();
    return hit ? { lat: Number(hit.lat), lng: Number(hit.lon) } : null;
  }

  /** Find coordinates for accounts with a new or changed address, one per second, while the map is open. */
  async function locateAccounts() {
    if (mapState.locating || Date.now() < (mapState.geoPausedUntil || 0)) return;
    const run = mapState.runId;
    const todo = state.accounts.filter(needsGeo);
    if (!todo.length) return;
    mapState.locating = { done: 0, total: todo.length };
    updateLocateStatus();
    for (const a of todo) {
      if (run !== mapState.runId) break;
      const q = geoQuery(a);
      try {
        const hit = await geocode(q);
        a.geo = hit ? { ...hit, q } : { q, miss: true };
        touch(a); save();
        if (hit) addAccountMarker(a);
      } catch (e) {
        // Service unreachable (offline or down): pause lookups instead of retrying in a loop.
        mapState.locating.error = e.message;
        mapState.geoPausedUntil = Date.now() + 5 * 60 * 1000;
        break;
      }
      mapState.locating.done++;
      updateLocateStatus();
      await new Promise((r) => setTimeout(r, 1100));
    }
    const err = mapState.locating && mapState.locating.error;
    mapState.locating = null;
    if (run === mapState.runId) { if (err) toast('Address lookup is unavailable right now. Try again later.'); rerenderMap(); }
  }

  function updateLocateStatus() {
    const el = $('#locate-status');
    if (!el || !mapState.locating) return;
    const { done, total } = mapState.locating;
    el.innerHTML = `<div class="small">Finding addresses… ${done}/${total}</div><div class="progress"><div style="width:${Math.round((done / total) * 100)}%"></div></div>`;
  }

  /** Create (or recreate) the Leaflet map inside #map, keeping the previous view if there was one. */
  function mountMap() {
    const keep = mapState.keep;
    const dark = matchMedia('(prefers-color-scheme: dark)').matches;
    const map = L.map('map', { zoomControl: true, attributionControl: true });
    L.tileLayer(`https://{s}.basemaps.cartocdn.com/${dark ? 'dark_all' : 'rastertiles/voyager'}/{z}/{x}/{y}{r}.png`, {
      subdomains: 'abcd', maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions" target="_blank" rel="noopener">CARTO</a>',
    }).addTo(map);
    if (keep) map.setView(keep.c, keep.z); else map.setView(CA_CENTER, 6);
    map.on('click', (e) => {
      if (!mapState.placing) return;
      const a = getAccount(mapState.placing);
      mapState.placing = null;
      if (!a) return;
      a.geo = { lat: e.latlng.lat, lng: e.latlng.lng, q: geoQuery(a), manual: true };
      touch(a); save(); toast(`Pinned ${a.name}`); rerenderMap();
    });
    mapState.map = map;
    mapState.markers = new Map();
    mapState.layer = L.layerGroup().addTo(map);
    return { map, restored: !!keep };
  }

  function rerenderMap() { if (location.hash.startsWith('#map')) rerender(); }

  // ----- accounts map -----
  const mapFilter = () => {
    const f = ui.mapFilter;
    const list = f.list ? resolveList(f.list) : null;
    const ids = list ? new Set(listAccounts(list).map((a) => a.id)) : null;
    return state.accounts.filter((a) => (f.type === 'all' || a.type === f.type) && (f.vendor === 'all' || a.vendors.includes(f.vendor)) && (!ids || ids.has(a.id)));
  };

  function accountPopup(a) {
    const p = primaryContact(a);
    return `<div class="map-pop">
      <strong>${esc(a.name)}</strong> ${typePill(a)}
      <div class="small muted">${esc(a.stage)}${a.vendors.length ? ' · ' + esc(a.vendors.join(', ')) : ''}</div>
      ${geoQuery(a) ? `<div class="small">${esc(geoQuery(a))}</div>` : ''}
      ${p ? `<div class="small">${esc(p.name)}${p.phone ? ` · <a href="tel:${esc(p.phone)}">${esc(p.phone)}</a>` : ''}</div>` : ''}
      ${a.revisitDate ? `<div class="small">Revisit ${dueChip(a.revisitDate)}</div>` : ''}
      <div class="row map-pop-actions">
        <a class="btn sm" href="#account/${a.id}">Open</a>
        <button type="button" class="btn sm ghost" data-pop="route" data-id="${a.id}">+ Today's route</button>
        <a class="btn sm ghost" href="${esc(navUrl(ll(a)))}" target="_blank" rel="noopener">Directions</a>
      </div>
    </div>`;
  }

  function addAccountMarker(a) {
    if (!mapState.layer || !hasGeo(a) || mapState.view !== 'accounts') return;
    if (!mapFilter().includes(a)) return;
    const due = (a.revisitDate && a.revisitDate <= today()) || (a.nextFollowUp && a.nextFollowUp <= today());
    const m = L.circleMarker(ll(a), {
      radius: 8, weight: due ? 3 : 2, color: due ? '#e8590c' : '#fff', fillOpacity: 0.95,
      fillColor: a.type === 'partner' ? '#0f8a6a' : '#8a4bd6',
    }).bindPopup(accountPopup(a), { minWidth: 220 }).bindTooltip(esc(a.name), { direction: 'top', offset: [0, -6] }).addTo(mapState.layer);
    mapState.markers.set(a.id, m);
  }

  // Leaflet stops clicks inside popups from reaching the page, so wire popup buttons directly.
  function wirePopups(map) {
    map.on('popupopen', (e) => {
      const el = e.popup.getElement();
      $$('[data-pop=route]', el).forEach((b) => b.addEventListener('click', () => {
        addRouteStop(today(), b.dataset.id);
        b.textContent = '✓ On today\'s route'; b.disabled = true;
      }));
    });
  }

  function renderMapAccounts() {
    const accts = mapFilter();
    const mapped = accts.filter(hasGeo);
    const missing = accts.filter((a) => !hasGeo(a));
    const near = mapState.me ? mapped.map((a) => ({ a, d: miles(mapState.me, ll(a)) })).sort((x, y) => x.d - y.d).slice(0, 12) : null;
    const f = ui.mapFilter;
    $('#view').innerHTML = `
      ${mapHead('accounts')}
      <div class="map-layout">
        <aside class="card map-side">
          <div class="filters">
            <select id="mf-type" aria-label="Type">${opt('all', 'All types', f.type)}${opt('prospect', 'Prospects', f.type)}${opt('partner', 'Partners', f.type)}</select>
            <select id="mf-vendor" aria-label="Vendor"><option value="all">All vendors</option>${allVendors().map((v) => opt(v, v, f.vendor)).join('')}</select>
            <select id="mf-list" aria-label="List"><option value="">All accounts</option>${state.lists.map((l) => opt(l.id, l.name, f.list)).join('')}</select>
          </div>
          <div class="row spread">
            <span class="small muted">${mapped.length} of ${accts.length} on the map</span>
            <button type="button" class="btn sm ghost" data-act="map-near">📍 Near me</button>
          </div>
          <div class="legend small"><span><i style="background:#8a4bd6"></i>Prospect</span><span><i style="background:#0f8a6a"></i>Partner</span><span><i class="due"></i>Due now</span></div>
          <div id="locate-status">${Date.now() < (mapState.geoPausedUntil || 0) && accts.some(needsGeo) ? `
            <div class="place-hint">Address lookup is unavailable right now (offline or the service is busy).
              <button type="button" class="link-btn" data-act="map-geo-retry">Retry</button></div>` : ''}</div>
          ${near ? `
            <h3 style="margin:.5rem 0 .25rem">Closest to you</h3>
            <div class="side-list">${near.map(({ a, d }) => `
              <div class="side-item">
                <button type="button" class="link-btn" data-act="map-focus" data-id="${a.id}"><strong>${esc(a.name)}</strong></button>
                <span class="small muted">${fmtMiles(d)} · ${esc(a.stage)}</span>
                <button type="button" class="btn sm ghost" data-act="route-add" data-id="${a.id}">+ Route</button>
              </div>`).join('') || '<div class="empty">No mapped accounts yet.</div>'}</div>` : ''}
          ${missing.length ? `
            <h3 style="margin:.75rem 0 .25rem">Not on the map <span class="muted small">(${missing.length})</span></h3>
            <div class="side-list">${missing.map((a) => `
              <div class="side-item">
                <a href="#account/${a.id}"><strong>${esc(a.name)}</strong></a>
                <span class="small muted">${!geoQuery(a) ? 'No address yet' : geoMissed(a) ? 'Address not found' : Date.now() < (mapState.geoPausedUntil || 0) ? 'Lookup unavailable' : 'Finding…'}</span>
                <span class="row" style="gap:.25rem">
                  <button type="button" class="btn sm ghost" data-act="edit-account" data-id="${a.id}">Address</button>
                  <button type="button" class="btn sm ghost" data-act="map-place" data-id="${a.id}">Drop pin</button>
                </span>
              </div>`).join('')}</div>` : ''}
          ${mapState.placing ? `<div class="place-hint">Tap the map where <strong>${esc((getAccount(mapState.placing) || {}).name || '')}</strong> is located.</div>` : ''}
        </aside>
        <div class="card map-card"><div id="map" class="map ${mapState.placing ? 'placing' : ''}"></div></div>
      </div>`;
    $('#mf-type').addEventListener('change', (e) => { ui.mapFilter.type = e.target.value; rerender(); });
    $('#mf-vendor').addEventListener('change', (e) => { ui.mapFilter.vendor = e.target.value; rerender(); });
    $('#mf-list').addEventListener('change', (e) => { ui.mapFilter.list = e.target.value; rerender(); });
    loadLeaflet().then(() => {
      if (mapState.view !== 'accounts' || !$('#map')) return;
      const { map, restored } = mountMap();
      wirePopups(map);
      mapped.forEach(addAccountMarker);
      if (mapState.me) L.circleMarker(mapState.me, { radius: 7, color: '#fff', weight: 3, fillColor: '#2f6fed', fillOpacity: 1 }).bindTooltip('You are here').addTo(mapState.layer);
      if (!restored && mapped.length) map.fitBounds(L.latLngBounds(mapped.map(ll)).pad(0.15), { maxZoom: 12, animate: false });
      updateLocateStatus();
      locateAccounts();
    }).catch((e) => { $('#map').innerHTML = `<div class="empty" style="padding:1rem">${esc(e.message)}</div>`; });
  }

  function mapHead(mode) {
    return `<div class="page-head">
      <h1>Map</h1>
      <div class="seg" role="group" aria-label="Map mode">
        <button type="button" class="${mode === 'accounts' ? 'active' : ''}" data-act="map-mode" data-mode="accounts">Accounts</button>
        <button type="button" class="${mode === 'route' ? 'active' : ''}" data-act="map-mode" data-mode="route">Route planner</button>
      </div>
    </div>`;
  }

  // ----- route planner -----
  const ROUTE_DEFAULTS = { extra: [], removed: [], order: [], start: 'home', roundTrip: true, startTime: '08:30', visitMins: 30 };
  const getRoute = (d) => ({ ...ROUTE_DEFAULTS, ...(getDay(d).route || {}) });
  function setRoute(d, patch) {
    state.days[d] = { ...getDay(d), route: { ...getRoute(d), ...patch } };
    save();
  }
  function addRouteStop(d, id) {
    const r = getRoute(d);
    setRoute(d, { extra: r.extra.includes(id) ? r.extra : [...r.extra, id], removed: r.removed.filter((x) => x !== id) });
    toast(`Added to the ${d === today() ? "today's" : fmtDate(d, { month: 'short', day: 'numeric' })} route`);
  }

  /** Who to visit on day d: planner Visits/Revisits rows, due revisits, cadence visit steps, and added stops. */
  function routeStops(d) {
    const r = getRoute(d);
    const plan = getPlan(d);
    const stops = new Map();
    const add = (a, why) => { if (a && !r.removed.includes(a.id) && !stops.has(a.id)) stops.set(a.id, { a, why }); };
    for (const row of plan.visits) add(findAccountByName(row.name), 'Planned visit');
    for (const row of plan.revisits) add(findAccountByName(row.name), 'Revisit');
    for (const a of dueRevisits(d, plan.revisits)) add(a, 'Revisit due');
    for (const p of dueSteps(d)) if (p.step.type === 'visit') add(p.acct, `${p.cad.name}: visit`);
    for (const id of r.extra) add(getAccount(id), 'Added');
    const all = [...stops.values()];
    const rank = (s) => { const i = r.order.indexOf(s.a.id); return i === -1 ? 1e6 : i; };
    return all.sort((x, y) => rank(x) - rank(y));
  }

  const visitedRow = (d, a) => {
    const plan = getPlan(d);
    const n = a.name.trim().toLowerCase();
    return [...plan.visits, ...plan.revisits].find((r) => r.done && r.name.trim().toLowerCase() === n);
  };

  /** Mark a stop visited: tick (or add) its planner row, which logs the visit to the account history. */
  function markVisited(d, a) {
    const plan = getPlan(d, true);
    const n = a.name.trim().toLowerCase();
    const isRevisit = plan.revisits.some((r) => r.name.trim().toLowerCase() === n) || (a.revisitDate && a.revisitDate <= d);
    const secKey = isRevisit ? 'revisits' : 'visits';
    const sec = PLAN_SECTIONS.find((x) => x.key === secKey);
    const rows = plan[secKey];
    let row = rows.find((r) => r.name.trim().toLowerCase() === n);
    if (!row) {
      const slot = rows.findIndex((r) => !r.name.trim());
      row = { name: a.name, kind: 'Visit', note: isRevisit ? (a.revisitNote || '') : 'Route visit', done: false };
      if (slot === -1) rows.push(row); else rows[slot] = row;
    }
    row.done = true;
    syncPlanActivity(d, sec, row);
    if (secKey === 'revisits') settleRevisit(d, row);
    save();
    toast(`${a.name}: visit logged`);
    if (secKey === 'revisits') nextRevisitForm(a, d); else rerender();
  }

  /** Where the day starts. The device location is only requested when optimizing, then remembered. */
  async function startPoint(r, ask = true) {
    if (r.start === 'home' && ui.home) return [ui.home.lat, ui.home.lng];
    if (r.start === 'gps') {
      if (mapState.me || !ask) return mapState.me;
      try { mapState.me = await myLocation(); return mapState.me; } catch (e) { toast('Location unavailable, starting from the first stop'); }
    }
    return null;
  }

  function myLocation() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) return reject(new Error('Location is not available on this device'));
      navigator.geolocation.getCurrentPosition((pos) => resolve([pos.coords.latitude, pos.coords.longitude]),
        () => reject(new Error('Location permission was denied')), { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 });
    });
  }

  /** Drive-time matrix (seconds) between points: OSRM if reachable, else straight-line distance at an average speed. */
  async function durationMatrix(points) {
    try {
      const coords = points.map((p) => `${p[1]},${p[0]}`).join(';');
      const res = await fetch(`https://router.project-osrm.org/table/v1/driving/${coords}?annotations=duration`);
      if (!res.ok) throw new Error();
      const j = await res.json();
      if (j.code !== 'Ok' || j.durations.some((row) => row.some((x) => x === null))) throw new Error();
      return { m: j.durations, estimated: false };
    } catch (e) {
      return { m: points.map((p) => points.map((q) => (miles(p, q) * 1.25 / AVG_MPH) * 3600)), estimated: true };
    }
  }

  /** Shortest visiting order: nearest-neighbour start, then 2-opt. Index 0 is a fixed start when hasStart. */
  function solveOrder(m, hasStart, roundTrip) {
    const n = m.length;
    const deadline = performance.now() + 150; // big backlogs still return quickly with a good order
    const cost = (path) => {
      let c = 0;
      for (let i = 0; i < path.length - 1; i++) c += m[path[i]][path[i + 1]];
      if (roundTrip && path.length > 1) c += m[path[path.length - 1]][path[0]];
      return c;
    };
    const improve = (path) => {
      let better = true;
      while (better && performance.now() < deadline) {
        better = false;
        for (let i = hasStart ? 1 : 0; i < path.length - 1; i++) {
          for (let k = i + 1; k < path.length; k++) {
            const cand = [...path.slice(0, i), ...path.slice(i, k + 1).reverse(), ...path.slice(k + 1)];
            if (cost(cand) + 1e-6 < cost(path)) { path = cand; better = true; }
          }
        }
      }
      return path;
    };
    const fromStart = (s) => {
      const path = [s]; const left = new Set([...Array(n).keys()].filter((i) => i !== s));
      while (left.size) {
        const last = path[path.length - 1];
        const next = [...left].reduce((b, i) => (m[last][i] < m[last][b] ? i : b));
        path.push(next); left.delete(next);
      }
      return improve(path);
    };
    if (hasStart) return fromStart(0);
    // Without a fixed start, try a few spread-out starting stops and keep the shortest.
    const starts = [...new Set([...Array(Math.min(n, 6)).keys()].map((i) => Math.floor((i * n) / Math.min(n, 6))))];
    return starts.map(fromStart).reduce((b, p) => (cost(p) < cost(b) ? p : b));
  }

  /** What the current optimized order was computed for; when this changes the route re-optimizes itself. */
  const routeKey = (d, r) => [r.start, r.roundTrip, r.start === 'home' && ui.home ? ui.home.label : '',
    ...routeStops(d).filter((s) => hasGeo(s.a)).map((s) => s.a.id).sort()].join('|');

  async function optimizeRoute(d, silent = false) {
    const r = getRoute(d);
    const stops = routeStops(d).filter((s) => hasGeo(s.a));
    if (stops.length < 2) { if (!silent) toast('Add at least two stops with an address'); return; }
    const btn = $('#route-opt'); if (btn) { btn.disabled = true; btn.textContent = 'Optimizing…'; }
    const start = await startPoint(r);
    const points = [...(start ? [start] : []), ...stops.map((s) => ll(s.a))];
    const { m } = await durationMatrix(points);
    const path = solveOrder(m, !!start, r.roundTrip && !!start);
    const order = path.filter((i) => !start || i > 0).map((i) => stops[start ? i - 1 : i].a.id);
    const unmapped = routeStops(d).filter((s) => !hasGeo(s.a)).map((s) => s.a.id);
    setRoute(d, { order: [...order, ...unmapped], optKey: routeKey(d, getRoute(d)) });
    if (!silent) toast('Route optimized');
    rerender();
  }

  /** Road legs for the route in order: OSRM route if reachable, else straight lines with estimated times. */
  async function routeLegs(points) {
    const key = points.map((p) => p.map((x) => x.toFixed(5)).join(',')).join('|');
    if (mapState.legsCache.has(key)) return mapState.legsCache.get(key);
    let out;
    try {
      const coords = points.map((p) => `${p[1]},${p[0]}`).join(';');
      const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`);
      if (!res.ok) throw new Error();
      const j = await res.json();
      if (j.code !== 'Ok') throw new Error();
      out = { legs: j.routes[0].legs.map((l) => ({ sec: l.duration, mi: l.distance / 1609.34 })), line: j.routes[0].geometry.coordinates.map(([x, y]) => [y, x]), estimated: false };
    } catch (e) {
      out = { legs: points.slice(1).map((p, i) => { const mi = miles(points[i], p) * 1.25; return { sec: (mi / AVG_MPH) * 3600, mi }; }), line: points, estimated: true };
    }
    mapState.legsCache.set(key, out);
    return out;
  }

  const clock = (hhmm, addSec) => {
    const [h, m] = (hhmm || '08:30').split(':').map(Number);
    const d = new Date(2000, 0, 1, h, m); d.setSeconds(d.getSeconds() + addSec);
    return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  };

  function googleRouteUrl(start, pts, roundTrip) {
    const all = start ? [start, ...pts] : pts;
    const origin = all[0];
    const dest = roundTrip && start ? start : all[all.length - 1];
    const mids = (roundTrip && start ? all.slice(1) : all.slice(1, -1)).slice(0, 9);
    const f = (p) => `${p[0].toFixed(6)},${p[1].toFixed(6)}`;
    return `https://www.google.com/maps/dir/?api=1&origin=${f(origin)}&destination=${f(dest)}${mids.length ? `&waypoints=${encodeURIComponent(mids.map(f).join('|'))}` : ''}&travelmode=driving`;
  }

  function renderRoutePlanner() {
    const d = ui.routeDate;
    const r = getRoute(d);
    const stops = routeStops(d);
    const mappedStops = stops.filter((s) => hasGeo(s.a));
    const addable = state.accounts.filter((a) => !stops.some((s) => s.a.id === a.id)).sort((x, y) => x.name.localeCompare(y.name));
    const homeOk = !!ui.home;
    $('#view').innerHTML = `
      ${mapHead('route')}
      <div class="map-layout">
        <aside class="card map-side">
          <div class="row spread">
            <div class="row" style="gap:.3rem">
              <button class="btn ghost sm" data-act="route-day" data-n="-1" aria-label="Previous day">‹</button>
              <input type="date" id="route-date" value="${d}" style="width:auto">
              <button class="btn ghost sm" data-act="route-day" data-n="1" aria-label="Next day">›</button>
            </div>
            <a class="small" href="#planner/${d}">Planner →</a>
          </div>
          <div class="grid-2 route-opts">
            ${field('Start from', `<select id="r-start">${opt('home', homeOk ? `Home base` : 'Home base (not set)', r.start)}${opt('gps', 'My current location', r.start)}${opt('first', 'First stop', r.start)}</select>`)}
            ${field('Leave at', `<input id="r-time" type="time" value="${esc(r.startTime)}">`)}
            ${field('Minutes per visit', `<input id="r-mins" type="number" min="0" step="5" value="${esc(r.visitMins)}">`)}
            <label class="row small" style="align-self:end"><input id="r-round" type="checkbox" style="width:auto" ${r.roundTrip ? 'checked' : ''}> Return to start</label>
          </div>
          <div class="small"><button type="button" class="link-btn" data-act="set-home">${homeOk ? `Home base: ${esc(ui.home.label)} · change` : 'Set your home base'}</button></div>
          <div class="row">
            <button class="btn" id="route-opt" data-act="route-optimize" ${mappedStops.length < 2 ? 'disabled' : ''}>${r.optKey ? 'Re-optimize' : 'Optimize route'}</button>
            <a class="btn ghost" id="route-gmaps" target="_blank" rel="noopener" ${mappedStops.length ? '' : 'hidden'}>Open in Google Maps</a>
          </div>
          <div id="route-summary" class="route-summary"></div>
          <ol class="stops" id="route-stops">
            ${stops.map((s, i) => {
              const v = visitedRow(d, s.a);
              return `<li class="stop ${v ? 'visited' : ''} ${hasGeo(s.a) ? '' : 'nogeo'}" data-id="${s.a.id}">
                <span class="stop-num">${i + 1}</span>
                <div class="grow">
                  <div><a href="#account/${s.a.id}"><strong>${esc(s.a.name)}</strong></a> <span class="pill">${esc(s.why)}</span></div>
                  <div class="small muted">${esc(geoQuery(s.a) || 'No address')}${hasGeo(s.a) ? '' : ' · not on the map'}</div>
                  <div class="small stop-eta"></div>
                </div>
                <span class="stop-actions">
                  ${hasGeo(s.a) ? `<a class="icon-btn" href="${esc(navUrl(ll(s.a)))}" target="_blank" rel="noopener" title="Navigate">➤</a>` : ''}
                  ${v ? '<span class="pill won">Visited</span>' : `<button class="btn sm ghost" data-act="route-visited" data-id="${s.a.id}">Visited</button>`}
                  <button class="icon-btn" data-act="route-remove" data-id="${s.a.id}" title="Remove from this route">✕</button>
                </span>
              </li>`;
            }).join('') || '<div class="empty">No visits planned for this day. Add stops below, or put accounts in the planner\'s Visits / Revisits.</div>'}
          </ol>
          <div class="row">
            <select id="route-add" style="flex:1"><option value="">+ Add a stop…</option>${addable.map((a) => `<option value="${a.id}">${esc(a.name)}${hasGeo(a) ? '' : ' (no address)'}</option>`).join('')}</select>
          </div>
        </aside>
        <div class="card map-card"><div id="map" class="map"></div></div>
      </div>`;

    $('#route-date').addEventListener('change', (e) => { if (e.target.value) go(`map/route/${e.target.value}`); });
    $('#r-start').addEventListener('change', (e) => {
      if (e.target.value === 'home' && !ui.home) { homeBaseForm(); }
      setRoute(d, { start: e.target.value }); rerender();
    });
    $('#r-time').addEventListener('change', (e) => { setRoute(d, { startTime: e.target.value }); rerender(); });
    $('#r-mins').addEventListener('change', (e) => { setRoute(d, { visitMins: Math.max(0, Number(e.target.value) || 0) }); rerender(); });
    $('#r-round').addEventListener('change', (e) => { setRoute(d, { roundTrip: e.target.checked }); rerender(); });
    $('#route-add').addEventListener('change', (e) => { if (e.target.value) { addRouteStop(d, e.target.value); rerender(); } });

    const run = mapState.runId;
    // Keep the best order automatically whenever the stops or start change (GPS waits until location is known).
    if (mappedStops.length >= 2 && r.optKey !== routeKey(d, r) && (r.start !== 'gps' || mapState.me)) {
      optimizeRoute(d, true);
      return;
    }
    Promise.all([loadLeaflet(), startPoint(r, false)]).then(async ([, start]) => {
      if (run !== mapState.runId || !$('#map')) return;
      const { map, restored } = mountMap();
      const pts = mappedStops.map((s) => ll(s.a));
      if (start) L.marker(start, { icon: L.divIcon({ className: 'home-pin', html: '⌂', iconSize: [26, 26] }) }).bindTooltip('Start').addTo(mapState.layer);
      mappedStops.forEach((s, i) => {
        const v = visitedRow(d, s.a);
        L.marker(ll(s.a), { icon: L.divIcon({ className: `stop-pin ${v ? 'visited' : ''}`, html: String(stops.indexOf(s) + 1), iconSize: [26, 26] }) })
          .bindPopup(accountPopup(s.a), { minWidth: 220 }).bindTooltip(esc(s.a.name)).addTo(mapState.layer);
      });
      wirePopups(map);
      const bounds = [...pts, ...(start ? [start] : [])];
      if (!restored && bounds.length) map.fitBounds(L.latLngBounds(bounds).pad(0.2), { maxZoom: 13, animate: false });
      if (!pts.length) return;
      const gm = $('#route-gmaps');
      gm.href = googleRouteUrl(start, pts, r.roundTrip);
      const legPts = [...(start ? [start] : []), ...pts, ...(start && r.roundTrip ? [start] : [])];
      const { legs, line, estimated } = legPts.length > 1 ? await routeLegs(legPts) : { legs: [], line: [], estimated: true };
      if (run !== mapState.runId || !$('#map')) return;
      if (line.length > 1) L.polyline(line, { color: '#2f6fed', weight: 4, opacity: 0.8, dashArray: estimated ? '6 8' : null }).addTo(mapState.layer);
      // Arrival times: drive legs plus time spent at each stop.
      let t = 0; let driveSec = 0; let mi = 0;
      const legOffset = start ? 0 : -1;
      mappedStops.forEach((s, i) => {
        const leg = legs[i + legOffset];
        if (leg) { t += leg.sec; driveSec += leg.sec; mi += leg.mi; }
        const li = $(`#route-stops .stop[data-id="${s.a.id}"] .stop-eta`);
        if (li) li.innerHTML = `Arrive ~${clock(r.startTime, t)}${leg ? ` · ${fmtDur(leg.sec)} drive (${fmtMiles(leg.mi)})` : ''}`;
        t += r.visitMins * 60;
      });
      const back = start && r.roundTrip ? legs[legs.length - 1] : null;
      if (back) { t += back.sec; driveSec += back.sec; mi += back.mi; }
      $('#route-summary').innerHTML = `
        <div><b>${mappedStops.length}</b><span>stops</span></div>
        <div><b>${fmtDur(driveSec)}</b><span>driving${estimated ? ' (est.)' : ''}</span></div>
        <div><b>${fmtMiles(mi)}</b><span>total</span></div>
        <div><b>${clock(r.startTime, t)}</b><span>${back ? 'back home' : 'done'}</span></div>`;
      if (mappedStops.length > 10) $('#route-summary').insertAdjacentHTML('beforeend', '<p class="small muted span-all">Google Maps opens the first 10 stops; use ➤ on each stop for the rest.</p>');
    }).catch((e) => { const m = $('#map'); if (m) m.innerHTML = `<div class="empty" style="padding:1rem">${esc(e.message)}</div>`; });
  }

  function homeBaseForm() {
    openModal('Home base', `
      <p class="small muted" style="margin:0">Where your day usually starts, e.g. your home or office. Saved on this device.</p>
      ${field('Address', `<input name="addr" value="${esc(ui.home ? ui.home.label : '')}" placeholder="Street, City, CA">`)}
      <div id="home-msg" class="small"></div>`, (data) => {
      const q = data.addr.trim();
      if (!q) { ui.home = null; savePrefs(); return; }
      $('#home-msg').textContent = 'Finding address…';
      geocode(q).then((hit) => {
        if (!hit) { $('#home-msg').innerHTML = '<span class="sync-error">Couldn\'t find that address. Try adding the city and state.</span>'; return; }
        ui.home = { ...hit, label: q }; savePrefs();
        modal.close(); toast('Home base saved'); rerender();
      }, () => { $('#home-msg').innerHTML = '<span class="sync-error">Address lookup is unavailable right now.</span>'; });
      return false;
    }, 'Save');
  }

  /** Tear the map down (keeping its position for a redraw of the same screen) before rendering. */
  function unmountMap(keepView) {
    mapState.runId++;
    mapState.keep = keepView && mapState.map ? { c: mapState.map.getCenter(), z: mapState.map.getZoom() } : null;
    if (mapState.map) {
      // Stop any zoom/pan animation first; removing mid-animation throws inside Leaflet.
      try { mapState.map.stop(); mapState.map.off(); mapState.map.remove(); } catch (e) { /* already gone */ }
      mapState.map = null;
    }
  }

  function renderMap() {
    const screen = ui.mapMode === 'route' ? `route:${ui.routeDate}` : 'accounts';
    unmountMap(mapState.screen === screen);
    mapState.screen = screen;
    mapState.view = ui.mapMode;
    if (ui.mapMode === 'route') renderRoutePlanner(); else renderMapAccounts();
  }

  // ---------- weekly activity report ----------
  // Monday–Sunday weeks built from what's already recorded: account history (touches, meetings,
  // stage changes), the daily activity plan, cadence step logs and outcomes, accounts and tasks.
  const REPORT_SERIES = [
    { key: 'call', label: 'Calls', kinds: ['Call'] },
    { key: 'email', label: 'Emails', kinds: ['Email'] },
    { key: 'linkedin', label: 'LinkedIn', kinds: ['LinkedIn'] },
    { key: 'visit', label: 'Visits', kinds: ['Visit'] },
    { key: 'other', label: 'Other', kinds: ['Text', 'Meeting', 'Demo', 'Other'] },
  ];
  const TOUCH_KINDS = REPORT_SERIES.flatMap((s) => s.kinds);
  const weekStart = (iso) => { const day = (fromISO(iso).getDay() + 6) % 7; return addDays(iso, -day); };
  const fmtWeek = (ws) => `${fmtDate(ws, { month: 'short', day: 'numeric' })} – ${fmtDate(addDays(ws, 6), { month: 'short', day: 'numeric', year: 'numeric' })}`;
  const STAGE_RE = /^Stage changed: (.+) → (.+)$/;

  function weekStats(ws) {
    const we = addDays(ws, 6);
    const inWeek = (d) => !!d && d.slice(0, 10) >= ws && d.slice(0, 10) <= we;
    const days = [...Array(7)].map((_, i) => addDays(ws, i));
    const acts = state.accounts.flatMap((a) => a.activities.filter((h) => inWeek(h.date)).map((h) => ({ ...h, account: a })));
    const touches = acts.filter((h) => TOUCH_KINDS.includes(h.kind));
    const count = (kinds) => touches.filter((h) => kinds.includes(h.kind)).length;
    const perDay = days.map((d) => {
      const row = { d };
      for (const s of REPORT_SERIES) row[s.key] = touches.filter((h) => h.date === d && s.kinds.includes(h.kind)).length;
      row.total = REPORT_SERIES.reduce((n, s) => n + row[s.key], 0);
      return row;
    });

    // Daily plan: done vs targets on weekdays (weekend work still counts toward "done").
    const workdays = days.filter((d) => !isWeekend(d)).length;
    const plan = PLAN_SECTIONS.map((sec) => {
      const done = days.reduce((n, d) => n + (getDay(d).plan ? planStats(getPlan(d), sec.key).done : 0), 0);
      return { sec, done, target: sec.count * workdays };
    });
    const outreachDaysHit = days.filter((d) => !isWeekend(d) && getDay(d).plan && planStats(getPlan(d), 'outreach').done >= PLAN_SECTIONS[0].count).length;

    // Cadences: steps logged, replies and meetings by cadence.
    const cadences = state.cadences.map((cad) => {
      const ens = state.enrollments.filter((e) => e.cadenceId === cad.id);
      const hist = ens.flatMap((e) => e.history.filter((h) => inWeek(h.date)));
      return {
        cad,
        steps: hist.filter((h) => !h.skipped).length,
        skipped: hist.filter((h) => h.skipped).length,
        replies: hist.filter((h) => /replied/i.test(h.outcome || '')).length + ens.filter((e) => e.outcome === 'replied' && inWeek(e.finishedAt) && !e.history.some((h) => inWeek(h.date) && /replied/i.test(h.outcome || ''))).length,
        meetings: ens.filter((e) => e.outcome === 'meeting' && inWeek(e.finishedAt)).length,
        added: ens.filter((e) => inWeek(e.addedAt)).length,
        finished: ens.filter((e) => e.status === 'finished' && inWeek(e.finishedAt)).length,
      };
    });
    const sum = (k) => cadences.reduce((n, c) => n + c[k], 0);

    // Pipeline movement from logged stage changes.
    const moves = acts.filter((h) => h.kind === 'Note' && STAGE_RE.test(h.summary)).map((h) => {
      const [, from, to] = h.summary.match(STAGE_RE);
      const list = STAGES[h.account.type] || [];
      return { h, a: h.account, from, to, forward: list.indexOf(to) > list.indexOf(from) && !['Lost', 'Inactive', 'At Risk'].includes(to) };
    }).sort((x, y) => y.h.date.localeCompare(x.h.date));
    const newAccounts = state.accounts.filter((a) => inWeek(a.createdAt));
    const won = moves.filter((m) => m.to === 'Won');

    const byAccount = new Map();
    for (const h of touches) byAccount.set(h.account.id, { a: h.account, n: (byAccount.get(h.account.id)?.n || 0) + 1 });
    const topAccounts = [...byAccount.values()].sort((x, y) => y.n - x.n).slice(0, 6);

    return {
      ws, we, days, perDay, acts, touches, plan, outreachDaysHit, workdays, cadences, moves, newAccounts, won, topAccounts,
      kpi: {
        touches: touches.length, call: count(['Call']), email: count(['Email']), linkedin: count(['LinkedIn']), visit: count(['Visit']),
        meetingsHeld: count(['Meeting', 'Demo']), meetingsBooked: sum('meetings'), replies: sum('replies'), cadenceSteps: sum('steps'),
        newAccounts: newAccounts.length, advances: moves.filter((m) => m.forward).length, won: won.length,
        tasksDone: state.tasks.filter((x) => x.done && inWeek(x.date)).length,
      },
    };
  }

  const KPIS = [
    ['touches', 'Total touches', true], ['call', 'Calls'], ['email', 'Emails'], ['linkedin', 'LinkedIn'], ['visit', 'Visits'],
    ['meetingsHeld', 'Meetings held'], ['meetingsBooked', 'Meetings booked'], ['replies', 'Replies'],
    ['cadenceSteps', 'Cadence steps'], ['advances', 'Stage advances'], ['newAccounts', 'New accounts'], ['won', 'Won'],
  ];

  function delta(now, prev) {
    const d = now - prev;
    if (!d) return '<span class="delta flat">same as last week</span>';
    return `<span class="delta ${d > 0 ? 'up' : 'down'}">${d > 0 ? '▲' : '▼'} ${Math.abs(d)} vs last week</span>`;
  }

  function dashSwitch(mode) {
    return `<div class="seg" role="group" aria-label="Home view">
      <a class="${mode === 'today' ? 'active' : ''}" href="#dashboard" role="button">Today</a>
      <a class="${mode === 'report' ? 'active' : ''}" href="#report" role="button">Weekly report</a>
    </div>`;
  }

  /** Stacked daily columns: one per day, segments by touch type, 2px gaps, rounded top, total on top. */
  function activityChart(st) {
    const max = Math.max(4, ...st.perDay.map((r) => r.total));
    const step = Math.max(1, Math.ceil(max / 4));
    const top = step * 4;
    const ticks = [0, 1, 2, 3, 4].map((i) => i * step);
    return `
      <div class="viz-root">
        <div class="viz-legend">${REPORT_SERIES.map((s, i) => `<span><i class="sw s${i + 1}"></i>${s.label}</span>`).join('')}</div>
        <div class="viz-plot" role="img" aria-label="Touches per day this week, by type">
          <div class="viz-grid">${ticks.slice().reverse().map((t) => `<div><span>${t}</span></div>`).join('')}</div>
          <div class="viz-cols">
            ${st.perDay.map((r) => `
              <div class="viz-col ${r.d === today() ? 'today' : ''}" tabindex="0"
                data-tip="${esc(`${fmtDate(r.d, { weekday: 'long', month: 'short', day: 'numeric' })}|${REPORT_SERIES.map((s) => `${s.label}: ${r[s.key]}`).join('|')}|Total: ${r.total}`)}">
                <div class="viz-stack" style="height:${(r.total / top) * 100}%">
                  ${r.total ? `<span class="viz-total">${r.total}</span>` : ''}
                  ${REPORT_SERIES.map((s, i) => (r[s.key] ? `<div class="viz-seg s${i + 1}" style="flex:${r[s.key]}"></div>` : '')).reverse().join('')}
                </div>
                <div class="viz-x">${fmtDate(r.d, { weekday: 'short' })}<br><span>${fromISO(r.d).getDate()}</span></div>
              </div>`).join('')}
          </div>
        </div>
        <div class="viz-tip" hidden></div>
        <details class="viz-table">
          <summary>Show as table</summary>
          <div class="table-wrap"><table class="table">
            <thead><tr><th>Day</th>${REPORT_SERIES.map((s) => `<th class="num">${s.label}</th>`).join('')}<th class="num">Total</th></tr></thead>
            <tbody>${st.perDay.map((r) => `<tr><td>${fmtDate(r.d, { weekday: 'short', month: 'short', day: 'numeric' })}</td>${REPORT_SERIES.map((s) => `<td class="num">${r[s.key]}</td>`).join('')}<td class="num"><strong>${r.total}</strong></td></tr>`).join('')}</tbody>
          </table></div>
        </details>
      </div>`;
  }

  function bindChartTips() {
    const tip = $('.viz-tip');
    if (!tip) return;
    const show = (col) => {
      const [title, ...lines] = col.dataset.tip.split('|');
      tip.innerHTML = `<strong>${esc(title)}</strong>${lines.map((l) => `<div>${esc(l)}</div>`).join('')}`;
      tip.hidden = false;
      const root = col.closest('.viz-root').getBoundingClientRect();
      const r = col.getBoundingClientRect();
      const left = Math.min(Math.max(r.left - root.left + r.width / 2 - tip.offsetWidth / 2, 0), root.width - tip.offsetWidth);
      tip.style.left = `${left}px`;
      tip.style.top = `${Math.max(r.top - root.top + 4, 0)}px`;
    };
    $$('.viz-col').forEach((col) => {
      col.addEventListener('mouseenter', () => show(col));
      col.addEventListener('focus', () => show(col));
      col.addEventListener('click', () => show(col));
      col.addEventListener('mouseleave', () => { tip.hidden = true; });
      col.addEventListener('blur', () => { tip.hidden = true; });
    });
  }

  function reportSummary(st) {
    const k = st.kpi;
    const lines = [
      `Weekly activity: ${fmtWeek(st.ws)}`,
      '',
      `Touches: ${k.touches} (Calls ${k.call}, Emails ${k.email}, LinkedIn ${k.linkedin}, Visits ${k.visit})`,
      `Meetings: ${k.meetingsHeld} held, ${k.meetingsBooked} booked · ${plural(k.replies, 'reply', 'replies')}`,
      `Plan: ${st.plan.map((p) => `${p.sec.label} ${p.done}/${p.target}`).join(' · ')}`,
      `Hit 25 outreach on ${st.outreachDaysHit} of ${st.workdays} workdays`,
      `Cadences: ${plural(k.cadenceSteps, 'step')} done${st.cadences.filter((c) => c.steps || c.meetings || c.replies).map((c) => `\n  - ${c.cad.name}: ${plural(c.steps, 'step')}, ${plural(c.replies, 'reply', 'replies')}, ${plural(c.meetings, 'meeting')} booked`).join('')}`,
      `Pipeline: ${plural(k.advances, 'stage advance')}, ${k.won} won, ${plural(k.newAccounts, 'new account')}`,
      ...st.moves.slice(0, 8).map((m) => `  - ${m.a.name}: ${m.from} → ${m.to}`),
      st.topAccounts.length ? `Most touched: ${st.topAccounts.map((t) => `${t.a.name} (${t.n})`).join(', ')}` : '',
    ];
    return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  }

  function renderReport() {
    const ws = ui.reportWeek;
    const st = weekStats(ws);
    const prev = weekStats(addDays(ws, -7));
    const isThisWeek = ws === weekStart(today());
    const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);

    $('#view').innerHTML = `
      <div class="page-head">
        <h1>Weekly report</h1>
        ${dashSwitch('report')}
      </div>
      <div class="week-nav">
        <button class="btn ghost sm" data-act="report-week" data-n="-7" aria-label="Previous week">‹</button>
        <strong>${fmtWeek(ws)}</strong>
        <button class="btn ghost sm" data-act="report-week" data-n="7" aria-label="Next week" ${isThisWeek ? 'disabled' : ''}>›</button>
        <span class="muted small">${isThisWeek ? 'This week so far' : '<button class="link-btn" data-act="report-this">Back to this week</button>'}</span>
      </div>

      <div class="kpi-grid">
        ${KPIS.map(([key, label, hero]) => `
          <div class="card kpi ${hero ? 'hero' : ''}">
            <div class="num">${st.kpi[key]}</div>
            <div class="label">${label}</div>
            ${delta(st.kpi[key], prev.kpi[key])}
          </div>`).join('')}
      </div>

      <div class="report-grid">
        <div class="card">
          <h2>Touches by day</h2>
          ${st.touches.length ? activityChart(st) : '<div class="empty">No calls, emails, LinkedIn touches or visits logged this week yet.</div>'}
        </div>

        <div class="card">
          <h2>Daily plan attainment</h2>
          <p class="small muted" style="margin-top:0">Targets × ${st.workdays} workdays. You hit 25 calls/emails/LinkedIn on <strong>${st.outreachDaysHit} of ${st.workdays}</strong> days.</p>
          <div class="attain">${st.plan.map((p) => `
            <div class="attain-row">
              <span>${esc(p.sec.label)}</span>
              <div class="progress"><div style="width:${Math.min(100, pct(p.done, p.target))}%"></div></div>
              <b>${p.done}/${p.target}</b>
              <span class="muted small">${pct(p.done, p.target)}%</span>
            </div>`).join('')}</div>
        </div>

        <div class="card">
          <h2>Cadences</h2>
          ${state.cadences.length ? `<div class="table-wrap"><table class="table">
            <thead><tr><th>Cadence</th><th class="num">Steps</th><th class="num">Replies</th><th class="num">Meetings</th><th class="num col-opt">Added</th></tr></thead>
            <tbody>${st.cadences.map((c) => `<tr>
              <td><a href="#cadences/${c.cad.id}"><span class="dot-sm" style="--c:${c.cad.color}"></span>${esc(c.cad.name)}</a></td>
              <td class="num">${c.steps}${c.skipped ? `<span class="muted small"> +${c.skipped} skipped</span>` : ''}</td>
              <td class="num">${c.replies}</td><td class="num">${c.meetings}</td><td class="num col-opt">${c.added}</td>
            </tr>`).join('')}</tbody>
          </table></div>` : '<div class="empty">No cadences yet.</div>'}
        </div>

        <div class="card">
          <h2>Pipeline movement</h2>
          ${st.moves.length || st.newAccounts.length ? `<ul class="list">
            ${st.moves.map((m) => `<li>
              <span class="move ${m.forward ? 'fwd' : 'back'}" aria-label="${m.forward ? 'Advanced' : 'Moved back'}">${m.forward ? '▲' : '▼'}</span>
              <div class="grow"><a class="title" href="#account/${m.a.id}">${esc(m.a.name)}</a><div class="small muted">${esc(m.from)} → <strong>${esc(m.to)}</strong> · ${esc(fmtDate(m.h.date, { weekday: 'short' }))}</div></div>
              ${m.to === 'Won' ? '<span class="pill won">Won</span>' : ''}
            </li>`).join('')}
            ${st.newAccounts.map((a) => `<li><span class="move new">+</span><div class="grow"><a class="title" href="#account/${a.id}">${esc(a.name)}</a><div class="small muted">New ${a.type} account</div></div></li>`).join('')}
          </ul>` : '<div class="empty">No stage changes or new accounts this week.</div>'}
        </div>

        <div class="card">
          <h2>Most-touched accounts</h2>
          ${st.topAccounts.length ? `<ul class="list">${st.topAccounts.map((t) => `<li>
            <div class="grow"><a class="title" href="#account/${t.a.id}">${esc(t.a.name)}</a><div class="small muted">${esc(t.a.stage)}${t.a.vendors.length ? ' · ' + esc(t.a.vendors.join(', ')) : ''}</div></div>
            <b>${t.n}</b><span class="small muted">touch${t.n === 1 ? '' : 'es'}</span>
          </li>`).join('')}</ul>` : '<div class="empty">No account touches this week.</div>'}
        </div>

        <div class="card">
          <h2>Share</h2>
          <p class="small muted" style="margin-top:0">A plain-text summary to paste into an email or message, and the week's activity as a spreadsheet.</p>
          <pre class="report-text" id="report-text">${esc(reportSummary(st))}</pre>
          <div class="row">
            <button class="btn" data-act="report-copy">Copy summary</button>
            <button class="btn ghost" data-act="report-csv">Export activities (CSV)</button>
          </div>
        </div>
      </div>`;
    bindChartTips();
  }

  function reportCsv() {
    const st = weekStats(ui.reportWeek);
    const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows = [['Date', 'Type', 'Account', 'Contact', 'Summary', 'Notes']];
    for (const h of [...st.acts].sort((x, y) => x.date.localeCompare(y.date))) {
      const c = h.contactId && h.account.contacts.find((x) => x.id === h.contactId);
      rows.push([h.date, h.kind, h.account.name, c ? c.name : '', h.summary, h.notes]);
    }
    downloadFile(`activity-${st.ws}.csv`, rows.map((r) => r.map(cell).join(',')).join('\r\n'), 'text/csv');
  }

  // ---------- Ask Claude (research hand-off) ----------
  // Builds a research request, opens it in Claude (claude.ai or the Claude app), and reads the
  // answer back from a pasted reply. Claude is asked to finish with a JSON block in a fixed shape,
  // which this page previews and merges into accounts and contacts only when you confirm.
  const RESEARCH_FLOWS = [
    { id: 'hq', label: 'Company HQ & location', ask: 'Headquarters: street address, city, state, ZIP and main phone number. Note other California locations if any.' },
    { id: 'snapshot', label: 'Company snapshot', ask: 'Company snapshot: official website, LinkedIn company page URL, industry, approximate employee count, and a one-line description.' },
    { id: 'dm', label: 'Decision makers', ask: 'Decision makers for HR / benefits / payroll purchases: owner or CEO/President, CFO or controller, COO. Name, title, LinkedIn URL, and business email/phone only if published.' },
    { id: 'hr', label: 'HR contacts', ask: 'HR contacts: head of HR / People, HR director or manager, benefits or payroll lead. Name, title, LinkedIn URL, and business email/phone only if published.' },
    { id: 'vendor', label: 'Current PEO / payroll vendor', ask: 'Current PEO, payroll or HR/benefits provider (e.g. ADP TotalSource, Insperity, Paychex, Justworks, Gusto) and, if publicly known, the benefits renewal timing. Say how you know.' },
    { id: 'news', label: 'Recent news & triggers', ask: 'Recent news and sales triggers from the last 12 months: hiring growth, new locations, funding, acquisitions, leadership changes, layoffs. Date and link for each.' },
  ];
  const RESEARCH_KEY = 'minicrm.research';
  let research = { target: '', hint: '', list: '', flows: ['hq', 'dm', 'hr'], custom: '', pasted: '' };
  try { Object.assign(research, JSON.parse(localStorage.getItem(RESEARCH_KEY)) || {}); } catch (e) { /* defaults */ }
  const saveResearch = () => { try { localStorage.setItem(RESEARCH_KEY, JSON.stringify(research)); } catch (e) { /* ignore */ } };

  const allFlows = () => [...RESEARCH_FLOWS, ...state.flows.map((f) => ({ ...f, custom: true }))];

  /** The companies a request is about: a saved list (max 10), or one company typed or picked. */
  function researchTargets() {
    if (research.list) {
      const l = resolveList(research.list);
      return l ? listAccounts(l).slice(0, 10).map((a) => ({ name: a.name, a })) : [];
    }
    const name = research.target.trim();
    if (!name) return [];
    const a = findAccountByName(name);
    return [{ name: a ? a.name : name, a, hint: research.hint.trim() }];
  }

  const companyLine = ({ name, a, hint }) => {
    const bits = [a && geoQuery(a), a && a.website, hint].filter(Boolean);
    return `- ${name}${bits.length ? ` (${bits.join('; ')})` : ''}`;
  };

  function buildPrompt() {
    const targets = researchTargets();
    const flows = allFlows().filter((f) => research.flows.includes(f.id));
    const asks = [...flows.map((f) => f.ask), research.custom.trim()].filter(Boolean);
    if (!targets.length || !asks.length) return '';
    return [
      'I sell TriNet (PEO / HR outsourcing) and I am researching companies for my CRM. Please use web search.',
      'Only include information you actually found, with a source link. If you cannot find something, leave it empty. Never guess email addresses or phone numbers.',
      '',
      `Compan${targets.length === 1 ? 'y' : 'ies'}:`,
      ...targets.map(companyLine),
      '',
      'Find:',
      ...asks.map((x) => `- ${x}`),
      '',
      'First give me a short readable summary. Then end your reply with a JSON code block in exactly this format (it is imported into my CRM), using "" or [] for anything not found or not asked for:',
      '```json',
      JSON.stringify({ companies: [{
        name: '', website: '', linkedin: '', hq_address: '', city: '', state: '', zip: '', main_phone: '', industry: '', employees: '',
        current_vendors: [''], vendor_renewal: 'YYYY-MM-DD', summary: '',
        contacts: [{ name: '', title: '', role: 'Decision maker | HR | Finance | Executive | Operations | Other', email: '', phone: '', linkedin: '', source: '' }],
        news: [{ date: '', headline: '', url: '' }], sources: [''],
      }] }, null, 2),
      '```',
    ].join('\n');
  }

  /** Pull the JSON block out of a pasted Claude reply (fenced or bare) and normalize it. */
  function parseResearch(text) {
    const fenced = [...text.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)].map((m) => m[1]).reverse();
    const candidates = [...fenced, text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)];
    for (const c of candidates) {
      try {
        const j = JSON.parse(c.trim());
        const list = Array.isArray(j) ? j : Array.isArray(j.companies) ? j.companies : j.name ? [j] : null;
        if (list && list.length) return list.map(normCompany).filter((x) => x.name);
      } catch (e) { /* try next */ }
    }
    return null;
  }

  const str = (v) => (v == null ? '' : String(v).trim());
  function normCompany(c) {
    const vendors = (Array.isArray(c.current_vendors) ? c.current_vendors : [c.current_vendors]).map(str).filter(Boolean)
      .map((v) => COMPETITORS.find((x) => x.toLowerCase() === v.toLowerCase()) || COMPETITORS.find((x) => v.toLowerCase().includes(x.toLowerCase())) || v);
    const renewal = /^\d{4}-\d{2}-\d{2}$/.test(str(c.vendor_renewal)) ? str(c.vendor_renewal) : '';
    const emp = str(c.employees).match(/\d[\d,]*/);
    return {
      name: str(c.name), website: str(c.website), linkedin: str(c.linkedin), address: str(c.hq_address),
      location: [str(c.city), [str(c.state), str(c.zip)].filter(Boolean).join(' ')].filter(Boolean).join(', '),
      phone: str(c.main_phone), industry: str(c.industry), employees: emp ? emp[0].replace(/,/g, '') : '',
      vendors: [...new Set(vendors)], vendorRenewal: renewal, summary: str(c.summary),
      contacts: (Array.isArray(c.contacts) ? c.contacts : []).map((p) => ({
        name: str(p.name), title: str(p.title), email: str(p.email), phone: str(p.phone), linkedin: str(p.linkedin), source: str(p.source),
        role: CONTACT_ROLES.find((r) => r.toLowerCase() === str(p.role).toLowerCase()) || (/hr|people|benefit/i.test(str(p.role) + str(p.title)) ? 'HR' : ''),
      })).filter((p) => p.name),
      news: (Array.isArray(c.news) ? c.news : []).filter((n) => n && n.headline).map((n) => ({ date: str(n.date), headline: str(n.headline), url: str(n.url) })),
      sources: (Array.isArray(c.sources) ? c.sources : []).map(str).filter(Boolean),
    };
  }

  const R_FIELDS = [
    ['address', 'HQ street address'], ['location', 'City, State'], ['website', 'Website'], ['linkedin', 'Company LinkedIn'],
    ['industry', 'Industry'], ['employees', 'Employees'], ['vendorRenewal', 'Vendor renewal'],
  ];

  function renderResearch() {
    const targets = researchTargets();
    const prompt = buildPrompt();
    const matched = !research.list && research.target.trim() && findAccountByName(research.target);
    $('#view').innerHTML = `
      <div class="page-head">
        <div>
          <h1>Ask Claude</h1>
          <div class="muted small">Research companies and people with Claude, then add what it finds to your CRM.</div>
        </div>
      </div>
      <div class="research-grid">
        <div class="card stack">
          <h2 style="margin:0"><span class="step-badge">1</span> What do you want to find?</h2>
          <div class="grid-2">
            ${field('Company', `<input id="rs-target" list="rs-accounts" value="${esc(research.target)}" placeholder="Account name or any company" autocomplete="off" ${research.list ? 'disabled' : ''}>
              <datalist id="rs-accounts">${state.accounts.map((a) => `<option value="${esc(a.name)}">`).join('')}</datalist>`)}
            ${field('City or website (optional)', `<input id="rs-hint" value="${esc(research.hint)}" placeholder="e.g. Fresno, CA" ${research.list || matched ? 'disabled' : ''}>`)}
          </div>
          <div class="small">${matched ? `<span class="pill won">✓ Existing account</span> results will be added to <a href="#account/${matched.id}">${esc(matched.name)}</a>` : research.target.trim() && !research.list ? '<span class="pill">New company</span> you can create the account from the results' : ''}</div>
          ${field('…or research a saved list (first 10 accounts)', `<select id="rs-list"><option value="">— one company —</option>${state.lists.map((l) => opt(l.id, `${l.name} (${listAccounts(l).length})`, research.list)).join('')}</select>`)}
          <div>
            <div class="small muted" style="margin-bottom:.35rem">Tap one or more:</div>
            <div class="flow-chips">
              ${allFlows().map((f) => `<span class="flow-chip-wrap"><button type="button" class="flow-chip ${research.flows.includes(f.id) ? 'on' : ''}" data-act="rs-flow" data-f="${esc(f.id)}" aria-pressed="${research.flows.includes(f.id)}">${research.flows.includes(f.id) ? '✓ ' : ''}${esc(f.label)}</button>${f.custom ? `<button type="button" class="icon-btn" data-act="rs-flow-del" data-f="${esc(f.id)}" title="Delete this flow">✕</button>` : ''}</span>`).join('')}
            </div>
          </div>
          ${field('Anything else? (optional)', `<textarea id="rs-custom" rows="2" placeholder="e.g. Who is their benefits broker? How many California employees?">${esc(research.custom)}</textarea>`)}
          <div class="row spread">
            <button type="button" class="link-btn small" data-act="rs-save-flow" ${research.custom.trim() ? '' : 'hidden'}>+ Save this as a reusable flow</button>
          </div>
          <div class="row">
            <a class="btn" id="rs-ask" ${prompt ? `href="https://claude.ai/new?q=${encodeURIComponent(prompt)}" target="_blank" rel="noopener"` : 'aria-disabled="true"'}>✦ Ask Claude</a>
            <button type="button" class="btn ghost" data-act="rs-copy" ${prompt ? '' : 'disabled'}>Copy request</button>
          </div>
          <p class="small muted" style="margin:0">${prompt ? `Opens Claude with your request for ${targets.length === 1 ? esc(targets[0].name) : `${targets.length} companies`}. It's also copied, so you can paste it if Claude opens empty. Turn on web search in Claude for best results.` : 'Pick a company and at least one thing to find.'}</p>
          ${prompt ? `<details class="prompt-preview"><summary class="small">See the request</summary><pre>${esc(prompt)}</pre></details>` : ''}
        </div>

        <div class="card stack">
          <h2 style="margin:0"><span class="step-badge">2</span> Paste Claude's answer</h2>
          <p class="small muted" style="margin:0">In Claude, tap <strong>Copy</strong> under its reply, then paste everything here. The app reads the data block at the end.</p>
          <textarea id="rs-paste" rows="7" placeholder="Paste Claude's full reply here…">${esc(research.pasted)}</textarea>
          <div class="row">
            <button type="button" class="btn" data-act="rs-review" ${research.pasted.trim() ? '' : 'disabled'}>Review & add to CRM</button>
            <button type="button" class="btn ghost" data-act="rs-clear" ${research.pasted.trim() ? '' : 'hidden'}>Clear</button>
          </div>
          <div id="rs-review"></div>
        </div>
      </div>`;

    const bind = (id, key, live) => $(id).addEventListener(live ? 'input' : 'change', (e) => {
      research[key] = e.target.value; saveResearch();
      if (live) {
        // Refresh the request without losing typing focus.
        const p = buildPrompt();
        const ask = $('#rs-ask');
        if (p) { ask.href = `https://claude.ai/new?q=${encodeURIComponent(p)}`; ask.target = '_blank'; ask.removeAttribute('aria-disabled'); }
        else { ask.removeAttribute('href'); ask.setAttribute('aria-disabled', 'true'); }
        $('[data-act=rs-copy]').disabled = !p;
        const saveFlow = $('[data-act=rs-save-flow]'); if (saveFlow) saveFlow.hidden = !research.custom.trim();
        const rv = $('[data-act=rs-review]'); if (rv) rv.disabled = !research.pasted.trim();
        const clr = $('[data-act=rs-clear]'); if (clr) clr.hidden = !research.pasted.trim();
      } else rerender();
    });
    bind('#rs-target', 'target', true);
    $('#rs-target').addEventListener('change', () => rerender());
    bind('#rs-hint', 'hint', true);
    bind('#rs-list', 'list', false);
    bind('#rs-custom', 'custom', true);
    bind('#rs-paste', 'pasted', true);
    $('#rs-ask').addEventListener('click', (e) => {
      const p = buildPrompt();
      if (!p) { e.preventDefault(); toast('Pick a company and something to find'); return; }
      if (navigator.clipboard) navigator.clipboard.writeText(p).catch(() => {});
    });
    if (research.pasted.trim() && ui.researchReview) showResearchReview();
  }

  function showResearchReview() {
    const box = $('#rs-review');
    const companies = parseResearch(research.pasted);
    ui.researchReview = true;
    if (!companies) {
      box.innerHTML = '<div class="sync-error">Couldn\'t find the data block in that reply. Make sure you copied Claude\'s whole answer, including the JSON at the end. If it\'s missing, ask Claude: "Please add the JSON block in the format I asked for."</div>';
      return;
    }
    const forced = !research.list && research.target.trim() && findAccountByName(research.target);
    box.innerHTML = companies.map((c, ci) => {
      const existing = (companies.length === 1 && forced) || findAccountByName(c.name);
      const rows = R_FIELDS.filter(([k]) => c[k]).map(([k, label]) => {
        const cur = existing ? str(existing[k]) : '';
        const same = cur && cur.toLowerCase() === c[k].toLowerCase();
        return `<label class="rv-row ${same ? 'same' : ''}">
          <input type="checkbox" data-c="${ci}" data-field="${k}" ${!same && !cur ? 'checked' : ''} ${same ? 'disabled' : ''}>
          <span class="rv-label">${label}</span>
          <span class="rv-val">${esc(c[k])}${cur && !same ? `<span class="small muted"> · replaces "${esc(cur)}"</span>` : ''}${same ? '<span class="small muted"> · already saved</span>' : ''}</span>
        </label>`;
      });
      const newVendors = c.vendors.filter((v) => !existing || !existing.vendors.includes(v));
      if (newVendors.length) rows.push(`<label class="rv-row"><input type="checkbox" data-c="${ci}" data-field="vendors" checked><span class="rv-label">Current vendor</span><span class="rv-val">${newVendors.map((v) => `<span class="pill vendor">${esc(v)}</span>`).join(' ')}</span></label>`);
      const people = c.contacts.map((p, pi) => {
        const dup = existing && existing.contacts.some((x) => (p.email && x.email && x.email.toLowerCase() === p.email.toLowerCase()) || x.name.toLowerCase() === p.name.toLowerCase());
        return `<label class="rv-row ${dup ? 'same' : ''}">
          <input type="checkbox" data-c="${ci}" data-person="${pi}" ${dup ? 'disabled' : 'checked'}>
          <span class="rv-val"><strong>${esc(p.name)}</strong>${p.title ? ` · ${esc(p.title)}` : ''}${p.role ? ` <span class="pill">${esc(p.role)}</span>` : ''}
            <span class="small muted" style="display:block">${[p.email, p.phone, p.linkedin ? 'LinkedIn' : ''].filter(Boolean).map(esc).join(' · ') || 'No contact details found'}${p.source ? ` · <a href="${esc(extUrl(p.source))}" target="_blank" rel="noopener">source</a>` : ''}${dup ? ' · already in CRM' : ''}</span></span>
        </label>`;
      });
      const hasNotes = c.summary || c.news.length || c.phone || c.sources.length;
      return `<div class="rv-company">
        <div class="row spread"><h3 style="margin:0">${esc(c.name)}</h3>
          ${existing ? `<span class="pill won">Existing: ${esc(existing.name)}</span>` : `<label class="row small"><input type="checkbox" data-c="${ci}" data-create checked style="width:auto"> Create as new account</label>`}</div>
        ${c.summary ? `<p class="small" style="margin:.35rem 0">${esc(c.summary)}</p>` : ''}
        ${rows.length ? `<div class="rv-sec">Account details</div>${rows.join('')}` : ''}
        ${people.length ? `<div class="rv-sec">Contacts (${c.contacts.length})</div>${people.join('')}` : ''}
        ${hasNotes ? `<label class="rv-row"><input type="checkbox" data-c="${ci}" data-note checked><span class="rv-val">Save summary${c.news.length ? ', news' : ''}${c.phone ? ', main phone' : ''} and sources to the account history</span></label>` : ''}
      </div>`;
    }).join('') + `<div class="row"><button type="button" class="btn" data-act="rs-apply">Add to CRM</button><span class="small muted">Only checked items are added.</span></div>`;
    ui.researchParsed = { companies, forcedId: forced ? forced.id : null };
  }

  function applyResearch() {
    const { companies, forcedId } = ui.researchParsed || {};
    if (!companies) return;
    const now = new Date().toISOString();
    const touched = [];
    let added = 0;
    companies.forEach((c, ci) => {
      const q = (sel) => $(`#rs-review [data-c="${ci}"]${sel}`);
      let a = (companies.length === 1 && forcedId && getAccount(forcedId)) || findAccountByName(c.name);
      if (!a) {
        const create = q('[data-create]');
        if (!create || !create.checked) return;
        a = migrateAccount({ id: uid(), name: c.name, type: 'prospect', stage: 'New', tags: 'claude-research', notes: '', vendors: [], contacts: [], activities: [], keyDates: [], createdAt: now, updatedAt: now });
        state.accounts.push(a);
      }
      for (const [k] of R_FIELDS) { const cb = q(`[data-field="${k}"]`); if (cb && cb.checked) a[k] = c[k]; }
      const vcb = q('[data-field="vendors"]');
      if (vcb && vcb.checked) a.vendors = [...new Set([...a.vendors.filter((v) => v !== NO_VENDOR), ...c.vendors])];
      c.contacts.forEach((p, pi) => {
        const cb = q(`[data-person="${pi}"]`);
        if (!cb || !cb.checked) return;
        a.contacts.push({ id: uid(), name: p.name, title: p.title, email: p.email, phone: p.phone, mobile: '', linkedin: p.linkedin,
          role: p.role, channel: '', timezone: '', status: 'Active', notes: p.source ? `Source: ${p.source}` : '', primary: a.contacts.length === 0 });
        added++;
      });
      const ncb = q('[data-note]');
      if (ncb && ncb.checked) {
        const lines = [c.summary, c.phone && `Main phone: ${c.phone}`,
          ...c.news.map((n) => `• ${[n.date, n.headline].filter(Boolean).join(': ')}${n.url ? ` (${n.url})` : ''}`),
          c.sources.length ? `Sources: ${c.sources.join(' ')}` : ''].filter(Boolean);
        a.activities.push({ id: uid(), date: today(), kind: 'Note', summary: 'Claude research', notes: lines.join('\n'), contactId: '', createdAt: now });
      }
      touch(a);
      touched.push(a);
    });
    if (!touched.length) { toast('Nothing selected to add'); return; }
    save();
    research.pasted = ''; ui.researchReview = false; saveResearch();
    toast(`Updated ${plural(touched.length, 'account')}${added ? ` · added ${plural(added, 'contact')}` : ''}`);
    go(touched.length === 1 ? `account/${touched[0].id}` : 'accounts');
  }

  // ---------- modal ----------
  const modal = $('#modal');
  const modalForm = $('#modal-form');
  let modalSubmit = null;

  function openModal(title, bodyHtml, onSubmit, submitLabel = 'Save', opts = {}) {
    modal.classList.toggle('wide', !!opts.wide);
    modalForm.innerHTML = `
      <div class="modal-head"><h2>${esc(title)}</h2><button type="button" class="icon-btn modal-x" data-close aria-label="Close">✕</button></div>
      <div class="stack" style="margin-top:.75rem">${bodyHtml}</div>
      <div class="modal-actions">
        <button type="button" class="btn ghost" data-close>Cancel</button>
        <button type="submit" class="btn">${esc(submitLabel)}</button>
      </div>`;
    modalSubmit = onSubmit;
    modalForm.oninput = null;
    if (!modal.open) modal.showModal();
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
      <fieldset class="form-sec"><legend>Company</legend><div class="grid-3">
        ${field('Account name *', `<input name="name" required value="${esc(a.name)}">`)}
        ${field('Type', `<select name="type" id="f-type">${opt('prospect', 'Prospect', a.type)}${opt('partner', 'Partner', a.type)}</select>`)}
        ${field('Stage / status', `<select name="stage" id="f-stage">${STAGES[a.type].map((s) => opt(s, s, a.stage)).join('')}</select>`)}
        ${field('Industry', `<input name="industry" value="${esc(a.industry)}">`)}
        ${field('Employees', `<input name="employees" type="number" min="0" value="${esc(a.employees)}">`)}
        ${field(a.type === 'partner' ? 'Annual value ($)' : 'Deal value ($)', `<input name="value" type="number" min="0" step="any" value="${esc(a.value)}">`)}
        ${field('Website', `<input name="website" value="${esc(a.website)}" autocapitalize="off" placeholder="company.com">`)}
        ${field('Company LinkedIn', `<input name="linkedin" value="${esc(a.linkedin)}" autocapitalize="off" placeholder="linkedin.com/company/…">`)}
        ${field('Street address', `<input name="address" value="${esc(a.address)}" placeholder="e.g. 1200 J St" autocomplete="street-address">`)}
        ${field('City, State', `<input name="location" value="${esc(a.location)}" placeholder="e.g. Sacramento, CA">`)}
        ${field('Lead source', `<select name="leadSource"><option value="">—</option>${LEAD_SOURCES.map((x) => opt(x, x, a.leadSource)).join('')}</select>`)}
      </div></fieldset>
      ${existing ? '' : `
      <fieldset class="form-sec"><legend>Primary contact</legend><div class="grid-4">
        ${field('Name', `<input name="c_name">`)}
        ${field('Title', `<input name="c_title">`)}
        ${field('Email', `<input name="c_email" type="email">`)}
        ${field('Phone', `<input name="c_phone" type="tel">`)}
      </div></fieldset>`}
      <fieldset class="form-sec"><legend>Current vendor</legend><div class="grid-3">
        <div class="field span-2"><span>Current vendors</span>${vendorPicker(a.vendors || [])}</div>
        ${field('Vendor renewal date', `<input name="vendorRenewal" type="date" value="${esc(a.vendorRenewal)}">`)}
      </div></fieldset>
      <fieldset class="form-sec"><legend>Next steps</legend><div class="grid-3">
        ${field('Next follow-up', `<input name="nextFollowUp" type="date" value="${esc(a.nextFollowUp)}">`)}
        ${field('Next revisit date', `<input name="revisitDate" type="date" value="${esc(a.revisitDate)}">`)}
        ${field('Revisit purpose', `<input name="revisitNote" value="${esc(a.revisitNote)}" placeholder="e.g. Drop off comparison">`)}
      </div></fieldset>
      <fieldset class="form-sec"><legend>Notes</legend><div class="grid-3">
        ${field('Tags (comma separated)', `<input name="tags" value="${esc(a.tags)}">`)}
        ${field('Notes', `<textarea name="notes" rows="3">${esc(a.notes)}</textarea>`, 'span-2')}
      </div></fieldset>`, (data) => {
      if (!data.name.trim()) return false;
      const { c_name, c_title, c_email, c_phone, ...fields } = data;
      fields.vendors = JSON.parse(fields.vendors || '[]');
      const dup = state.accounts.find((x) => x !== existing && x.name.trim().toLowerCase() === data.name.trim().toLowerCase());
      if (dup && !confirm(`An account named "${dup.name}" already exists. The planner and cadences match accounts by name, so duplicates can get mixed up. Save anyway?`)) return false;
      if (existing) {
        logStageChange(existing, existing.stage, fields.stage);
        Object.assign(existing, fields); touch(existing);
        toast('Account updated');
      } else {
        const now = new Date().toISOString();
        const contacts = c_name || c_email || c_phone
          ? [{ id: uid(), name: c_name || c_email || c_phone, title: c_title, email: c_email, phone: c_phone, role: '', notes: '', status: 'Active', primary: true }] : [];
        const acct = { id: uid(), ...fields, contacts, activities: [], keyDates: [], createdAt: now, updatedAt: now };
        state.accounts.push(acct);
        location.hash = `account/${acct.id}`;
        toast('Account created');
      }
    }, 'Save', { wide: true });
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
      <div class="grid-3">
        ${field('Name *', `<input name="name" required value="${esc(c.name)}">`)}
        ${field('Title', `<input name="title" value="${esc(c.title)}" placeholder="e.g. HR Director">`)}
        ${field('Role in deal', `<select name="role"><option value="">—</option>${CONTACT_ROLES.map((r) => opt(r, r, c.role)).join('')}</select>`)}
        ${field('Email', `<input name="email" type="email" value="${esc(c.email)}" autocapitalize="off">`)}
        ${field('Direct phone', `<input name="phone" type="tel" value="${esc(c.phone)}">`)}
        ${field('Mobile', `<input name="mobile" type="tel" value="${esc(c.mobile)}">`)}
        ${field('LinkedIn URL', `<input name="linkedin" value="${esc(c.linkedin)}" placeholder="linkedin.com/in/…" autocapitalize="off">`)}
        ${field('Preferred channel', `<select name="channel"><option value="">—</option>${CHANNELS.map((x) => opt(x, x, c.channel)).join('')}</select>`)}
        ${field('Time zone', `<select name="timezone"><option value="">—</option>${TIMEZONES.map((x) => opt(x, x, c.timezone)).join('')}</select>`)}
        ${field('Status', `<select name="status">${CONTACT_STATUSES.map((x) => opt(x, x, c.status || 'Active')).join('')}</select>`)}
        <label class="row small" style="align-self:end"><input type="checkbox" name="primary" style="width:auto" ${c.primary ? 'checked' : ''}> Primary contact</label>
        <span></span>
        ${field('Notes', `<textarea name="notes" rows="2">${esc(c.notes)}</textarea>`, 'span-3')}
      </div>`, (data) => {
      if (!data.name.trim()) return false;
      const fields = {
        name: data.name, title: data.title, email: data.email, phone: data.phone, mobile: data.mobile, linkedin: data.linkedin,
        channel: data.channel, timezone: data.timezone, status: data.status, role: data.role, notes: data.notes, primary: !!data.primary,
      };
      if (existing && data.status !== 'Active' && existing.status !== data.status) {
        // People who left or opted out come out of any running cadence.
        for (const p of enrollmentsFor(existing.id)) finishEnrollment(p.e, 'bad');
      }
      let target = existing;
      if (existing) Object.assign(existing, fields);
      else acct.contacts.push(target = { id: uid(), ...fields });
      if (target.primary) acct.contacts.forEach((x) => { if (x !== target) x.primary = false; });
      else if (!acct.contacts.some((x) => x.primary)) acct.contacts[0].primary = true;
      touch(acct);
      toast(existing ? 'Contact updated' : 'Contact added');
    }, 'Save', { wide: true });
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
        logStageChange(acct, acct.stage, data.stage);
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
          state.enrollments = state.enrollments.filter((x) => x.accountId !== id);
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
        state.enrollments = state.enrollments.filter((x) => x.contactId !== cid);
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
      case 'accounts-csv': return accountsCsv('accounts', filteredAccounts());
      case 'import-csv': return $('#csv-import').click();
      case 'open-sync': return syncSettings();
      case 'load-sample': loadSample(); return;
      case 'erase-all': eraseAll(); return;
      case 'show-all': ui.showAll = true; return rerender();
      case 'rs-flow': {
        const f = el.dataset.f;
        research.flows = research.flows.includes(f) ? research.flows.filter((x) => x !== f) : [...research.flows, f];
        saveResearch(); return rerender();
      }
      case 'rs-save-flow': {
        const label = prompt('Name this flow (e.g. "Benefits broker"):', research.custom.trim().slice(0, 40));
        if (!label || !label.trim()) return;
        const f = { id: uid(), label: label.trim(), ask: research.custom.trim() };
        state.flows.push(f); save();
        research.flows = [...research.flows, f.id]; research.custom = ''; saveResearch();
        toast('Flow saved'); return rerender();
      }
      case 'rs-flow-del': {
        const f = state.flows.find((x) => x.id === el.dataset.f);
        if (!f || !confirm(`Delete the flow "${f.label}"?`)) return;
        state.flows = state.flows.filter((x) => x !== f); save();
        research.flows = research.flows.filter((x) => x !== f.id); saveResearch(); return rerender();
      }
      case 'rs-copy': {
        const text = buildPrompt();
        if (text && navigator.clipboard) navigator.clipboard.writeText(text).then(() => toast('Request copied. Paste it into Claude'), () => toast('Copy not available'));
        return;
      }
      case 'rs-review': return showResearchReview();
      case 'rs-clear': research.pasted = ''; ui.researchReview = false; saveResearch(); return rerender();
      case 'rs-apply': return applyResearch();
      case 'report-week': return go(`report/${addDays(ui.reportWeek, Number(el.dataset.n))}`);
      case 'report-this': return go('report');
      case 'report-csv': return reportCsv();
      case 'report-copy': {
        const text = $('#report-text').textContent;
        if (navigator.clipboard) navigator.clipboard.writeText(text).then(() => toast('Summary copied'), () => toast('Copy not available'));
        else toast('Copy not available');
        return;
      }
      case 'map-geo-retry': mapState.geoPausedUntil = 0; return rerender();
      case 'map-mode': return go(el.dataset.mode === 'route' ? `map/route/${ui.routeDate || today()}` : 'map');
      case 'map-near':
        myLocation().then((pt) => { mapState.me = pt; rerender(); if (mapState.map) mapState.map.setView(pt, 11); }, (err) => toast(err.message));
        return;
      case 'map-focus': {
        const a = getAccount(id); const m = mapState.markers.get(id);
        if (a && mapState.map && hasGeo(a)) { mapState.map.setView(ll(a), 14); if (m) m.openPopup(); $('#map').scrollIntoView({ behavior: 'smooth', block: 'center' }); }
        return;
      }
      case 'map-place':
        mapState.placing = id; rerender(); toast('Tap the map where this account is'); $('#map').scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      case 'route-add': addRouteStop(today(), id); return;
      case 'route-remove': {
        const r = getRoute(ui.routeDate);
        setRoute(ui.routeDate, { removed: [...r.removed, id], extra: r.extra.filter((x) => x !== id) });
        return rerender();
      }
      case 'route-visited': return markVisited(ui.routeDate, acct);
      case 'route-optimize': return optimizeRoute(ui.routeDate);
      case 'route-day': return go(`map/route/${addDays(ui.routeDate, Number(el.dataset.n))}`);
      case 'set-home': return homeBaseForm();
      case 'cad-template': return cadenceForm(null, CADENCE_TEMPLATES[Number(el.dataset.tpl)]);
      case 'cad-new': return cadenceForm(null, null);
      case 'cad-open': ui.cadenceId = el.dataset.cad; return go(`cadences/${el.dataset.cad}`);
      case 'cad-edit': return cadenceForm(cadenceById(ui.cadenceId));
      case 'cad-add-people': return addPeopleForm(cadenceById(ui.cadenceId));
      case 'cad-filter': ui.cadFilter = el.dataset.f; return rerender();
      case 'cad-delete': {
        const cad = cadenceById(ui.cadenceId);
        const n = state.enrollments.filter((x) => x.cadenceId === cad.id).length;
        if (!confirm(`Delete "${cad.name}"${n ? ` and its ${n} enrollment${n === 1 ? '' : 's'}` : ''}? Logged activities stay in account history.`)) return;
        state.cadences = state.cadences.filter((x) => x !== cad);
        state.enrollments = state.enrollments.filter((x) => x.cadenceId !== cad.id);
        ui.cadenceId = null; save(); return go('cadences');
      }
      case 'enr-open':
        if (e.target.closest('a')) return;
        return enrollmentDetail(el.dataset.eid);
      case 'enr-log': return logStepForm(el.dataset.eid);
      case 'enr-skip': return enrollmentAction(el.dataset.eid, 'skip');
      case 'enroll-contact': return enrollContactForm(acct, acct.contacts.find((c) => c.id === cid));
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

  const exportBackup = () => downloadFile(`minicrm-backup-${today()}.json`, JSON.stringify(state, null, 2), 'application/json');

  function openSettings() {
    openModal('Settings', `
      <section class="set-sec">
        <h3>Cloud sync</h3>
        <div id="sync-live">${syncStatusHtml()}</div>
        <button type="button" class="btn ghost sm" id="set-sync">${syncCfg ? 'Sync settings' : 'Set up sync'}</button>
      </section>
      <section class="set-sec">
        <h3>Backup</h3>
        <p class="small muted">${syncCfg ? 'Sync already keeps every version in your private GitHub repository. ' : 'Without sync, your data lives only on this device. '}You can also download a copy, or restore one.</p>
        <div class="row">
          <button type="button" class="btn ghost sm" id="set-export">Export backup</button>
          <button type="button" class="btn ghost sm" id="set-import">Import backup…</button>
        </div>
      </section>
      <section class="set-sec">
        <h3>Data</h3>
        <p class="small muted">Import accounts and contacts from a ZoomInfo export or any spreadsheet saved as CSV.</p>
        <div class="row">
          <button type="button" class="btn ghost sm" id="set-csv">Import CSV…</button>
          ${state.accounts.length ? '' : '<button type="button" class="btn ghost sm" id="set-sample">Load sample data</button>'}
          <button type="button" class="btn danger sm" id="set-erase">Erase all data…</button>
        </div>
      </section>
      <p class="small muted" style="margin:0">Tip: press <kbd>/</kbd> to search from anywhere on a computer.</p>`, () => {}, 'Done');
    modalForm.querySelector('.modal-actions [data-close]').remove();
    $('#set-sync').addEventListener('click', syncSettings);
    $('#set-export').addEventListener('click', exportBackup);
    $('#set-import').addEventListener('click', () => { modal.close(); $('#file-import').click(); });
    $('#set-erase').addEventListener('click', () => { modal.close(); eraseAll(); });
    $('#set-csv').addEventListener('click', () => { modal.close(); $('#csv-import').click(); });
    const sample = $('#set-sample');
    if (sample) sample.addEventListener('click', () => { modal.close(); loadSample(); });
  }

  /** Quick search across accounts and contacts, from anywhere. */
  function openSearch() {
    openModal('Search', `
      <input id="gs-input" type="search" placeholder="Accounts, contacts, vendors, phone, email…" autocomplete="off" autocapitalize="off">
      <div id="gs-results" class="gs-results"></div>`, () => {}, 'Close');
    modalForm.querySelector('.modal-actions').remove();
    const input = $('#gs-input');
    const results = $('#gs-results');
    const draw = () => {
      const q = input.value.trim().toLowerCase();
      if (!q) { results.innerHTML = '<div class="small muted">Type to search your accounts and contacts.</div>'; return; }
      const accts = state.accounts.filter((a) => haystack(a).includes(q)).slice(0, 8);
      const people = state.accounts.flatMap((a) => a.contacts.map((c) => ({ a, c })))
        .filter(({ c }) => [c.name, c.title, c.email, c.phone, c.mobile].join(' ').toLowerCase().includes(q)).slice(0, 8);
      results.innerHTML = (accts.length ? `<div class="gs-h">Accounts</div>${accts.map((a) => `
          <a class="gs-item" href="#account/${a.id}" data-close>
            <span class="grow"><strong>${esc(a.name)}</strong><span class="small muted"> · ${esc(a.stage)}${a.vendors.length ? ' · ' + esc(a.vendors.join(', ')) : ''}</span></span>${typePill(a)}
          </a>`).join('')}` : '')
        + (people.length ? `<div class="gs-h">Contacts</div>${people.map(({ a, c }) => `
          <a class="gs-item" href="#account/${a.id}" data-close>
            <span class="avatar sm">${esc(initials(c.name))}</span>
            <span class="grow"><strong>${esc(c.name)}</strong><span class="small muted">${c.title ? ' · ' + esc(c.title) : ''} · ${esc(a.name)}</span></span>
          </a>`).join('')}` : '')
        || '<div class="empty">No matches.</div>';
    };
    input.addEventListener('input', draw);
    input.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      const first = $('.gs-item', results);
      if (first) { modal.close(); location.hash = first.getAttribute('href').slice(1); }
    });
    draw();
    input.focus();
  }

  $('#btn-settings').addEventListener('click', openSettings);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.matches && e.target.matches('.acard[role=link]')) e.target.click();
  });
  $('#btn-search').addEventListener('click', openSearch);
  $('#btn-ask').addEventListener('click', () => go('research'));
  document.addEventListener('keydown', (e) => {
    const typing = e.target.closest && e.target.closest('input, textarea, select, [contenteditable]');
    if (modal.open) return;
    if ((e.key === '/' && !typing) || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k')) { e.preventDefault(); openSearch(); }
  });

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
    Object.assign(northwind, { employees: 120, address: '1500 Capitol Ave', location: 'Sacramento, CA', leadSource: 'Referral', vendorRenewal: addDays(t, 140) });
    Object.assign(helix, { employees: 85, address: '2100 Geng Rd', location: 'Palo Alto, CA', leadSource: 'Inbound', vendorRenewal: addDays(t, 200) });
    Object.assign(oak, { employees: 60, address: '3200 E Belmont Ave', location: 'Fresno, CA', leadSource: 'Cold outreach', vendorRenewal: addDays(t, 75) });
    Object.assign(summit, { employees: 40, address: '200 Webster St', location: 'Oakland, CA', leadSource: 'Partner / broker' });
    Object.assign(brightpath, { employees: 25, address: '1 Market St', location: 'San Francisco, CA', leadSource: 'Event' });
    Object.assign(northwind.contacts[0], { mobile: '555-0199', linkedin: 'linkedin.com/in/danaortiz', timezone: 'Pacific', channel: 'Email' });
    Object.assign(oak.contacts[0], { title: 'HR Manager', email: 'chris@oakiron.example', phone: '555-0170', timezone: 'Pacific', channel: 'Phone' });
    oak.contacts.push(contact('Angela Ruiz', 'CFO', 'Decision maker', 'angela@oakiron.example', '555-0171'));

    // Example cadences with people at different points.
    const cads = CADENCE_TEMPLATES.map((tp) => ({
      id: uid(), name: tp.name, description: tp.description, color: tp.color, skipWeekends: true,
      steps: tp.steps.map(([day, type, title, subject, body]) => ({ id: uid(), day, type, title, subject, body })),
    }));
    state.cadences.push(...cads);
    const seed = (cad, acct, c, startBack, doneCount, finish) => {
      const start = nextWorkday(addDays(t, -startBack));
      const when = (i) => shiftDays(start, cad.steps[i].day - 1, true);
      const history = cad.steps.slice(0, doneCount).map((st, i) => {
        const type = STEP_TYPES[st.type];
        const outcome = type.outcomes[i % 2 === 0 ? 0 : Math.min(1, type.outcomes.length - 1)];
        const actId = uid();
        acct.activities.push({ id: actId, date: when(i), kind: type.kind, contactId: c.id, summary: `${cad.name} · ${st.title}: ${outcome}`, notes: '', createdAt: now });
        return { stepId: st.id, date: when(i), outcome, note: '', activityId: actId };
      });
      const e = { id: uid(), cadenceId: cad.id, accountId: acct.id, contactId: c.id, startDate: start, step: Math.min(doneCount, cad.steps.length - 1),
        dueDate: doneCount < cad.steps.length ? when(doneCount) : '', status: 'active', outcome: '', history, addedAt: now };
      if (finish) finishEnrollment(e, finish, history.length ? history[history.length - 1].date : t);
      state.enrollments.push(e);
    };
    seed(cads[0], oak, oak.contacts[0], 8, 3);
    seed(cads[0], oak, oak.contacts[1], 0, 0);
    seed(cads[1], northwind, northwind.contacts[0], 6, 1);
    seed(cads[1], northwind, northwind.contacts[1], 22, 3);
    seed(cads[2], helix, helix.contacts[0], 5, 2);
    seed(cads[2], helix, helix.contacts[1], 12, 3, 'meeting');
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
    const [icon, ...words] = SYNC_LABELS[status].split(' ');
    btn.innerHTML = `<span class="sync-ic">${icon}</span><span class="sync-tx">${words.join(' ')}</span>`;
    btn.className = `btn ghost sync-${status}`;
    const banner = $('#sync-banner');
    banner.hidden = status !== 'error';
    if (status === 'error') {
      banner.innerHTML = `<span>⚠ Sync has stopped: ${esc(message)} Your changes are safe on this device.</span><button class="btn sm" data-act="open-sync">Fix sync</button>`;
    }
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

  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

  // If the app stays open past midnight, move "today" screens to the new day.
  let lastToday = today();
  function checkNewDay() {
    const t = today();
    if (t === lastToday) return;
    if (ui.plannerDate === lastToday) ui.plannerDate = t;
    if (ui.routeDate === lastToday) ui.routeDate = t;
    const old = lastToday;
    lastToday = t;
    if (location.hash.includes(old)) location.replace(location.hash.replace(old, t));
    else if (!modal.open && !(document.activeElement && document.activeElement.matches('input, textarea, select'))) rerender();
  }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') checkNewDay(); });
  setInterval(checkNewDay, 60000);
  setSyncStatus(syncCfg ? 'pending' : 'off');
  route();
  syncNow();
})();
