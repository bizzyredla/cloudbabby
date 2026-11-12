/* Bbars OS — partner & prospect accounts with history, key dates and a daily planner.
   All data lives in localStorage; use Export/Import for backups or moving between devices. */
(() => {
  'use strict';

  const STORAGE_KEY = 'minicrm.v1';

  const STAGES = {
    prospect: ['S1 – Discovery Scheduled', 'S2 – Qualified Opportunity', 'S3 – Solution & Quote Development', 'S4 – Proposal Presented', 'S5 – Decision / Negotiation', 'Closed Won', 'Closed Lost', 'Nurture', 'Revisit'],
    partner: ['Target', 'Engaged', 'Met', 'Committed', 'Producing', 'Dormant', 'Closed'],
  };
  // What each stage means (shown under the stage picker and as tooltips).
  const STAGE_HINTS = {
    'S1 – Discovery Scheduled': 'Discovery meeting is on the calendar',
    'S2 – Qualified Opportunity': 'Fit, need and decision maker confirmed',
    'S3 – Solution & Quote Development': 'Building the solution and pricing',
    'S4 – Proposal Presented': 'Proposal is in front of them',
    'S5 – Decision / Negotiation': 'Final terms and decision',
    'Closed Won': 'Signed',
    'Closed Lost': 'Chose someone else or not moving forward',
    Nurture: 'Not ready now; stay in touch',
    Revisit: 'Come back at a set date (use Next revisit)',
    Target: 'Fits, no two-way conversation yet',
    Engaged: 'Replied or talked with us',
    Met: 'Meeting held, partnership discussed',
    Committed: 'Agreed to refer, no referral yet',
    Producing: 'Referral in the last 6 months',
    Dormant: 'Open or signed, no referral in 6+ months',
    Closed: 'Declined, or exclusive elsewhere',
  };
  // Short names where space is tight (pipeline chart, board columns on phones).
  const STAGE_SHORT = {
    'S1 – Discovery Scheduled': 'S1 Discovery', 'S2 – Qualified Opportunity': 'S2 Qualified', 'S3 – Solution & Quote Development': 'S3 Quote',
    'S4 – Proposal Presented': 'S4 Proposal', 'S5 – Decision / Negotiation': 'S5 Decision', 'Closed Won': 'Won', 'Closed Lost': 'Lost',
  };
  const stageShort = (st) => STAGE_SHORT[st] || st;
  // Old stage names (before the S1–S5 / channel stages) and what they become.
  const STAGE_RENAMES = {
    prospect: { New: 'S1 – Discovery Scheduled', Contacted: 'S1 – Discovery Scheduled', Qualified: 'S2 – Qualified Opportunity', Proposal: 'S4 – Proposal Presented', Negotiation: 'S5 – Decision / Negotiation', Won: 'Closed Won', Lost: 'Closed Lost' },
    partner: { Onboarding: 'Committed', Active: 'Producing', Strategic: 'Producing', 'At Risk': 'Dormant', Inactive: 'Closed' },
  };
  const ALL_RENAMES = { ...STAGE_RENAMES.prospect, ...STAGE_RENAMES.partner };
  const OPEN_DEAL_STAGES = STAGES.prospect.slice(0, 5); // S1–S5: the active pipeline
  const isOpenDeal = (a) => a.type === 'prospect' && OPEN_DEAL_STAGES.includes(a.stage);
  const isClosedStage = (st) => ['Closed Won', 'Closed Lost', 'Closed'].includes(st);
  /**
   * A stage from free text (spreadsheets, old data): exact name, "S2", the words after the dash,
   * or an old stage name. '' when nothing fits.
   */
  function stageFromText(type, v) {
    const t = String(v || '').trim().toLowerCase().replace(/\s+/g, ' ');
    if (!t) return '';
    const list = STAGES[type];
    const plain = (x) => x.toLowerCase().replace(/[–-]/g, '-').replace(/\s+/g, ' ');
    const tt = plain(t);
    const hit = list.find((x) => plain(x) === tt)
      || (type === 'prospect' && /^s[1-5]\b/.test(tt) && list.find((x) => x.toLowerCase().startsWith(tt.slice(0, 2))))
      || list.find((x) => { const rest = plain(x).split(' - ')[1]; return rest && rest === tt; })
      || list.find((x) => x.toLowerCase() === 'closed ' + tt);
    if (hit) return hit;
    const old = Object.entries(STAGE_RENAMES[type]).find(([k]) => k.toLowerCase() === t);
    return old ? old[1] : '';
  }
  const ACTIVITY_KINDS = ['Call', 'Email', 'LinkedIn', 'Visit', 'Text', 'Meeting', 'Demo', 'Note', 'Other'];
  // Daily activity plan targets shown on the planner.
  const PLAN_SECTIONS = [
    { key: 'outreach', label: 'Calls / Emails / LinkedIn', short: 'Outreach', count: 25, rows: 10, kinds: ['Call', 'Email', 'LinkedIn'] },
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
  const CONTACT_ROLES = ['Decision maker', 'Champion', 'Finance', 'HR', 'Influencer', 'Gatekeeper', 'Operations', 'Executive', 'Other'];
  const CONTACT_STATUSES = ['Active', 'Left company', 'Do not contact', 'Bounced'];
  const CHANNELS = ['Email', 'Phone', 'Mobile / text', 'LinkedIn', 'In person'];
  const TIMEZONES = ['Eastern', 'Central', 'Mountain', 'Pacific', 'Alaska', 'Hawaii'];
  // Channel (partner) accounts: what kind of referral source they are, and ready-made tags.
  const PARTNER_TYPES = ['Benefits Broker', 'P&C Broker', 'CPA / Accountant', 'Attorney', 'Banker / Lender', 'HR Consultant',
    'Payroll / HR Technology', 'Business Consultant', 'Private Equity', 'Association / Franchise'];
  const PARTNER_TAGS = ['EB-Small-Target', 'EB-Small-Engaged', 'EB-Small-Active', 'EB-Large-Target', 'EB-Large-Engaged', 'EB-Large-Active',
    'AgcyProd-EB-Cold', 'AgcyProd-EB-Warm', 'AgcyProd-EB-Active'];
  // Broker comp defaults. Editable in Partners > Comp rates; fixed ids so every device seeds the same rows.
  const defaultCompPlans = () => {
    const y = new Date().getFullYear();
    return [
      { id: 'cp-share', name: 'Revenue share: 25% of admin + setup fees', adminPct: 25, setupPct: 25, pepm: 0, months: 12 },
      { id: 'cp-pepm10', name: '$10 per enrolled employee / month', adminPct: 0, setupPct: 0, pepm: 10, months: 12 },
      { id: 'cp-pepm25', name: 'Promo: $25 per enrolled employee / month', adminPct: 0, setupPct: 0, pepm: 25, months: 12 },
      { id: 'cp-oms', name: 'OMS (set your rates)', adminPct: 0, setupPct: 0, pepm: 0, months: 12 },
      { id: 'cp-q4bonus', kind: 'bonus', name: 'Q4 one-time bonus', bonus: 5000, from: `${y}-10-01`, to: `${y}-12-31` },
    ];
  };
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
    continue: 'Continue to next step', pause: 'Pause and set a follow-up', meeting: 'Meeting booked: finish', replied: 'Replied / engaged: finish',
    notinterested: 'Not interested: finish', bad: 'Bad data / left company: finish',
  };
  const FINISH_LABELS = { completed: 'Completed all steps', meeting: 'Meeting booked', replied: 'Replied', referred: 'Sent a referral', notinterested: 'Not interested', bad: 'Bad data' };
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
  let state = emptyState(); // filled in by bootStorage() at startup
  let sb = null; let cloudUser = null; let cloudCfg = null; // Supabase client, signed-in user, saved connection
  const cloudOn = () => !!(sb && cloudUser);
  const ui = { search: '', typeFilter: 'all', stageFilter: 'all', vendorFilter: 'all', sort: 'followup', sortDir: 1, plannerDate: today(), listId: null, navs: 0, cadFilter: 'active', contactSearch: '', contactFilter: 'all', contactType: 'all', contactSort: 'next', contactLimit: 200 };
  // Per-device view preferences (layout choice), not synced.
  const PREFS_KEY = 'minicrm.prefs';
  try { Object.assign(ui, JSON.parse(localStorage.getItem(PREFS_KEY)) || {}); } catch (e) { /* defaults */ }
  ui.accountView ||= matchMedia('(max-width: 700px)').matches ? 'cards' : 'table';
  ui.boardType ||= 'prospect';
  ui.mapMode = 'accounts';
  ui.routeDate = today();
  ui.mapFilter = { type: 'all', vendor: 'all', list: '' };
  const savePrefs = () => {
    try { localStorage.setItem(PREFS_KEY, JSON.stringify({ accountView: ui.accountView, boardType: ui.boardType, home: ui.home, partnerRules: ui.partnerRules, calMode: ui.calMode, extraOpen: ui.extraOpen, dailyGoal: ui.dailyGoal, cadView: ui.cadView, cadCalMode: ui.cadCalMode, cadHidden: ui.cadHidden, stepCap: ui.stepCap, enrollPerDay: ui.enrollPerDay, acctCols: ui.acctCols, viewSeen: ui.viewSeen, mapColor: ui.mapColor })); } catch (e) { /* ignore */ }
  };

  function emptyState() { return { accounts: [], tasks: [], days: {}, lists: [], cadences: [], enrollments: [], flows: [], compPlans: [], categories: [], territories: [], routeTemplates: [], deleted: {} }; }

  /** Fill in missing collections and move the old single-contact fields into `contacts`. */
  function migrateAccount(a) {
    a.activities ||= []; a.keyDates ||= []; a.vendors ||= []; a.files ||= [];
    if (!a.contacts) {
      // Deterministic id so devices that migrate the same account separately still merge cleanly.
      a.contacts = a.contact || a.email || a.phone
        ? [{ id: 'c-' + a.id, name: a.contact || '', title: a.title || '', email: a.email || '', phone: a.phone || '', role: '', notes: '', primary: true }]
        : [];
      delete a.contact; delete a.title; delete a.email; delete a.phone;
    }
    if (a.type && STAGES[a.type] && !STAGES[a.type].includes(a.stage)) {
      a.stage = STAGE_RENAMES[a.type][a.stage] || stageFromText(a.type, a.stage) || STAGES[a.type][0];
    }
    return a;
  }

  function normalize(data) {
    const st = { ...emptyState(), ...data };
    st.accounts.forEach(migrateAccount);
    if (!Array.isArray(st.compPlans)) st.compPlans = [];
    if (!Array.isArray(st.categories)) st.categories = [];
    if (!Array.isArray(st.territories)) st.territories = [];
    if (!Array.isArray(st.routeTemplates)) st.routeTemplates = [];
    if (!st.compPlans.length) st.compPlans = defaultCompPlans().filter((x) => !(st.deleted || {})['cp:' + x.id]);
    // Planner rows used to store only the account name; link each to its account where the name is unique.
    const byName = new Map();
    for (const a of st.accounts) { const k = (a.name || '').trim().toLowerCase(); byName.set(k, byName.has(k) ? null : a.id); }
    for (const day of Object.values(st.days || {})) {
      for (const rows of Object.values((day && day.plan) || {})) {
        for (const r of rows || []) {
          if (r && !r.accountId && r.name && r.name.trim()) { const id = byName.get(r.name.trim().toLowerCase()); if (id) r.accountId = id; }
        }
      }
    }
    for (const l of st.lists || []) {
      if (l.criteria && Array.isArray(l.criteria.stages) && l.criteria.stages.some((x) => ALL_RENAMES[x])) {
        l.criteria = { ...l.criteria, stages: [...new Set(l.criteria.stages.map((x) => ALL_RENAMES[x] || x))] };
      }
    }
    return st;
  }

  // ---------- storage (IndexedDB) ----------
  // Each account, task, list, cadence, enrollment, flow and planner day is its own row in the
  // device's IndexedDB database, so a save writes only what changed and there is no 5 MB cap.
  // The first launch after the upgrade copies the old localStorage data across and leaves the
  // original untouched. If IndexedDB is not available the app keeps using localStorage.
  const META_KEY = 'minicrm.meta';
  const IDB_FLAG = 'minicrm.idb';
  const idb = { db: null };
  let booted = false;
  // Device-only sync bookkeeping: records waiting to upload, and how far we have read the cloud.
  const local = { dirty: new Set(), cursor: 0, user: '', seen: {} };
  const COLLECTIONS = [['accounts', 'a:'], ['tasks', 't:'], ['lists', 'l:'], ['cadences', 'cad:'], ['enrollments', 'enr:'], ['flows', 'flw:'], ['compPlans', 'cp:'], ['categories', 'cat:'], ['territories', 'ter:'], ['routeTemplates', 'rtpl:']];

  function loadLegacy() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return normalize(JSON.parse(raw));
    } catch (e) { console.warn('Could not read saved data', e); }
    return emptyState();
  }

  const idbReq = (req) => new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); });

  function idbOpen() {
    return new Promise((res, rej) => {
      const req = indexedDB.open('minicrm', 1);
      req.onupgradeneeded = () => { req.result.createObjectStore('recs'); req.result.createObjectStore('meta'); };
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
      req.onblocked = () => rej(new Error('Database is open in another tab'));
    });
  }

  /** Every top-level record by its storage key (accounts carry their contacts, history and dates). */
  function topIndex(st = state) {
    const m = new Map();
    for (const [name, prefix] of COLLECTIONS) for (const x of st[name]) m.set(prefix + x.id, x);
    for (const [d, day] of Object.entries(st.days)) m.set('d:' + d, day);
    return m;
  }

  const metaPayload = () => ({
    migrated: true, deleted: state.deleted, dirty: [...local.dirty], cursor: local.cursor, user: local.user, seen: local.seen,
    order: Object.fromEntries(COLLECTIONS.map(([name]) => [name, state[name].map((x) => x.id)])),
  });

  function applyMeta(meta) {
    local.dirty = new Set(meta.dirty || []);
    local.cursor = meta.cursor || 0;
    local.user = meta.user || '';
    local.seen = meta.seen || {};
  }

  /** Write records to the device. `keys` limits the write to those rows; omit it to rewrite everything. */
  function persist(keys) {
    if (!booted) return;
    if (!idb.db) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        localStorage.setItem(META_KEY, JSON.stringify({ dirty: [...local.dirty], cursor: local.cursor, user: local.user, seen: local.seen }));
      } catch (e) { toast('Could not save. Browser storage is full or unavailable. Use Export to keep a copy.'); }
      return;
    }
    try {
      const tops = topIndex();
      const tx = idb.db.transaction(['recs', 'meta'], 'readwrite');
      const recs = tx.objectStore('recs');
      if (!keys) { recs.clear(); for (const [k, o] of tops) recs.put(o, k); }
      else for (const k of keys) { if (tops.has(k)) recs.put(tops.get(k), k); else recs.delete(k); }
      tx.objectStore('meta').put(metaPayload(), 'meta');
      tx.onabort = () => toast('Could not save to this device. Use Export to keep a copy.');
    } catch (e) {
      console.warn('Save failed', e);
      toast('Could not save to this device. Use Export to keep a copy.');
    }
  }

  /** Read everything from the device. Returns false when the database cannot be trusted. */
  async function bootStorage() {
    let migratedBefore = false;
    try { migratedBefore = localStorage.getItem(IDB_FLAG) === '1'; } catch (e) { /* no localStorage */ }
    try {
      if (!window.indexedDB) throw new Error('IndexedDB is not available');
      idb.db = await idbOpen();
      const tx = idb.db.transaction(['recs', 'meta'], 'readonly');
      const [keys, values, meta] = await Promise.all([
        idbReq(tx.objectStore('recs').getAllKeys()), idbReq(tx.objectStore('recs').getAll()), idbReq(tx.objectStore('meta').get('meta')),
      ]);
      if (meta && meta.migrated) {
        const st = emptyState();
        const byPrefix = new Map(COLLECTIONS.map(([name, prefix]) => [prefix, name]));
        keys.forEach((k, i) => {
          const cut = k.indexOf(':') + 1;
          if (k.startsWith('d:')) st.days[k.slice(2)] = values[i];
          else if (byPrefix.has(k.slice(0, cut))) st[byPrefix.get(k.slice(0, cut))].push(values[i]);
        });
        for (const [name] of COLLECTIONS) {
          const pos = new Map(((meta.order || {})[name] || []).map((id, i) => [id, i]));
          st[name].sort((x, y) => (pos.has(x.id) ? pos.get(x.id) : 1e9) - (pos.has(y.id) ? pos.get(y.id) : 1e9));
        }
        st.deleted = meta.deleted || {};
        state = normalize(st);
        applyMeta(meta);
        booted = true;
      } else {
        // First launch on IndexedDB: bring the localStorage copy across (it stays as a fallback copy).
        state = loadLegacy();
        booted = true;
        persist();
        try { localStorage.setItem(IDB_FLAG, '1'); } catch (e) { /* ignore */ }
      }
    } catch (e) {
      console.warn('IndexedDB unavailable', e);
      idb.db = null;
      // Data already moved to IndexedDB: the localStorage copy is out of date, so do not load it.
      if (migratedBefore) return false;
      state = loadLegacy();
      try { applyMeta(JSON.parse(localStorage.getItem(META_KEY)) || {}); } catch (e2) { /* none */ }
      booted = true;
    }
    snapshot = fingerprints(state);
    return true;
  }

  /** Save what changed. `track` stamps the edits so sync can merge them with other devices. */
  function save({ track = true } = {}) {
    if (track) persist(stampChanges()); else persist();
    if (track && cloudOn()) { setSyncStatus('pending'); scheduleSync(); }
    clearTimeout(save.countsTimer);
    save.countsTimer = setTimeout(updateCounts, 60); // sidebar counts follow every change
  }

  // ---------- change tracking ----------
  // Every record carries `_ts`, the time of its last local change, and once it has been edited,
  // `_f`: the time each field last changed (fields not listed there date from `_b`). Sync merges
  // two copies of a record field by field with these. `_s` is the cloud version last seen.
  // Removed records leave a tombstone in state.deleted until the removal has been uploaded.
  // Changes are found by diffing each record against a snapshot taken at the previous save.
  const META_FIELDS = ['_ts', '_f', '_b', '_s'];
  const NESTED = { activities: 'h:', keyDates: 'k:', contacts: 'c:', files: 'f:' };
  const bare = (x) => { const o = { ...x }; for (const f of META_FIELDS) delete o[f]; return o; };

  /** Yields [key, record, comparable fields, storage key, parent account id]. */
  function* records(st) {
    for (const a of st.accounts) {
      const { activities, keyDates, contacts, files, ...rest } = a;
      const top = 'a:' + a.id;
      yield [top, a, bare(rest), top, null];
      for (const h of activities) yield ['h:' + h.id, h, bare(h), top, a.id];
      for (const k of keyDates) yield ['k:' + k.id, k, bare(k), top, a.id];
      for (const c of contacts) yield ['c:' + c.id, c, bare(c), top, a.id];
      for (const f of files || []) yield ['f:' + f.id, f, bare(f), top, a.id];
    }
    for (const [name, prefix] of COLLECTIONS.slice(1)) for (const x of st[name]) yield [prefix + x.id, x, bare(x), prefix + x.id, null];
    for (const [d, day] of Object.entries(st.days)) yield ['d:' + d, day, bare(day), 'd:' + d, null];
  }

  /** key -> { fp: JSON of the fields, top: storage key }. */
  function fingerprints(st) {
    const m = new Map();
    for (const [key, obj, fields, top] of records(st)) m.set(key, { fp: JSON.stringify(fields), top, s: obj._s });
    return m;
  }

  let snapshot = fingerprints(state);

  /** Stamp edited records and fields. Returns the storage keys that need writing. */
  function stampChanges() {
    const now = Date.now();
    const next = new Map();
    const changed = new Set();
    for (const [key, obj, fields, top] of records(state)) {
      const fp = JSON.stringify(fields);
      next.set(key, { fp, top, s: obj._s });
      const prev = snapshot.get(key);
      if (prev && prev.fp === fp) continue;
      if (prev) {
        const before = JSON.parse(prev.fp);
        if (!obj._f) { obj._f = {}; obj._b = obj._ts || 0; }
        for (const f of new Set([...Object.keys(before), ...Object.keys(fields)])) {
          if (JSON.stringify(before[f]) !== JSON.stringify(fields[f])) obj._f[f] = now;
        }
      }
      obj._ts = now;
      local.dirty.add(key);
      changed.add(top);
    }
    for (const [key, prev] of snapshot) {
      if (next.has(key)) continue;
      state.deleted[key] = now;
      if (prev.s) local.seen[key] = prev.s;
      local.dirty.add(key);
      changed.add(prev.top);
    }
    snapshot = next;
    return changed;
  }

  const fieldTime = (x, f) => (x._f ? (x._f[f] ?? x._b ?? 0) : (x._ts || 0));

  /** Combine two copies of one record field by field: the newest edit of each field wins. */
  function mergeRecord(x, y) {
    if (!x) return y;
    if (!y) return x;
    if (!x._f && !y._f) return (x._ts || 0) >= (y._ts || 0) ? x : y;
    const out = { _f: {}, _b: 0, _ts: Math.max(x._ts || 0, y._ts || 0) };
    if (x._s || y._s) out._s = Math.max(x._s || 0, y._s || 0);
    const names = new Set([...Object.keys(x), ...Object.keys(y)]);
    for (const f of names) {
      if (META_FIELDS.includes(f) || f in NESTED) continue;
      const tx = fieldTime(x, f); const ty = fieldTime(y, f);
      let win = tx > ty ? x : ty > tx ? y : null;
      if (!win) win = (f in x ? JSON.stringify(x[f]) : '') >= (f in y ? JSON.stringify(y[f]) : '') ? x : y; // same time: pick the same side on every device
      if (f in win) out[f] = win[f];
      out._f[f] = Math.max(tx, ty);
    }
    return out;
  }

  const getAccount = (id) => state.accounts.find((a) => a.id === id);
  const primaryContact = (a) => a.contacts.find((c) => c.primary) || a.contacts[0] || null;
  const tagList = (a) => (a.tags || '').split(',').map((x) => x.trim()).filter(Boolean);
  const allTags = () => [...new Set(state.accounts.flatMap((a) => tagList(a).map((x) => x.toLowerCase())))].sort();
  const allVendors = () => {
    const used = new Set(state.accounts.flatMap((a) => a.vendors));
    return [...COMPETITORS, ...[...used].filter((v) => !COMPETITORS.includes(v) && v !== NO_VENDOR).sort(), NO_VENDOR];
  };
  const haystack = (a) => [a.name, a.industry, a.tags, a.notes, a.partnerType, a.stage, ...a.vendors,
    a.location, a.address, a.mainPhone, ...a.contacts.flatMap((c) => [c.name, c.title, c.email, c.phone, c.mobile])].join(' ').toLowerCase();
  const vendorPills = (a) => a.vendors.map((v) => `<span class="pill vendor">${esc(v)}</span>`).join(' ');
  const getDay = (iso) => { const d = state.days[iso] || {}; return { ...d, priorities: Array.isArray(d.priorities) ? d.priorities : ['', '', ''], notes: d.notes || '' }; };
  const findAccountByName = (name) => {
    const n = (name || '').trim().toLowerCase();
    return n ? state.accounts.find((a) => a.name.trim().toLowerCase() === n) : null;
  };
  const nameKey = (a) => a.name.trim().toLowerCase();
  /** How an account is shown in planner suggestions: its name, plus the city (or type, then #n) when names repeat. */
  function accountLabel(a, twins = state.accounts.filter((x) => nameKey(x) === nameKey(a))) {
    if (twins.length < 2) return a.name;
    const tag = (x) => x.location || (x.type === 'partner' ? 'Partner' : 'Prospect');
    const same = twins.filter((x) => tag(x) === tag(a));
    return `${a.name} · ${tag(a)}${same.length > 1 ? ` #${same.indexOf(a) + 1}` : ''}`;
  }
  /** Suggestion labels for a set of accounts, computed in one pass. */
  function accountLabels(list) {
    const groups = new Map();
    for (const a of state.accounts) { const k = nameKey(a); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(a); }
    return list.map((a) => accountLabel(a, groups.get(nameKey(a))));
  }
  /** The account typed text refers to: a suggestion label, or a name that only one account has. */
  function findAccountByText(text) {
    const n = (text || '').trim().toLowerCase();
    if (!n) return null;
    const exact = state.accounts.filter((a) => nameKey(a) === n);
    if (exact.length === 1) return exact[0];
    if (exact.length > 1) return null; // same name twice: pick the labelled suggestion instead
    const base = n.split(' · ')[0];
    const twins = state.accounts.filter((a) => nameKey(a) === base);
    if (twins.length === 1) return twins[0]; // an older "Name · City" suggestion for a name that's now unique
    return twins.find((a) => accountLabel(a, twins).toLowerCase() === n) || null;
  }
  /** A planner row's account: by its saved id; older rows without one fall back to the typed text. */
  const rowAccount = (row) => (row.accountId ? getAccount(row.accountId) || null : findAccountByText(row.name));

  const blankPlanRow = (sec) => ({ name: '', kind: sec.kinds[0], note: '', done: false });

  /**
   * Plan rows for a day: each section shows `rows` slots (default: its target count); "+ Add row"
   * adds more. Unused blank slots past that are dropped. Read-only unless `persist`.
   */
  function getPlan(iso, persist = false) {
    const stored = getDay(iso).plan || {};
    const plan = {};
    const blank = (r) => !r.added && !(r.name || '').trim() && !(r.note || '').trim() && !r.done;
    for (const sec of PLAN_SECTIONS) {
      const show = sec.rows || sec.count;
      const rows = (stored[sec.key] || []).slice();
      while (rows.length > show && blank(rows[rows.length - 1])) rows.pop();
      while (rows.length < show) rows.push(blankPlanRow(sec));
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

  /** Last touch: the latest logged activity, or a date typed on the account (touches outside the CRM). */
  function lastTouchDate(acct) {
    const t = today();
    const logged = acct.activities.filter((h) => h.kind !== 'Note' && h.date <= t).reduce((m, h) => (h.date > m ? h.date : m), '');
    return [logged, acct.lastTouchDate || ''].reduce((m, d) => (d > m ? d : m), '');
  }
  /** Last referral: the date typed on the partner, or the latest day an account was linked to it. */
  function lastReferralDate(partner) {
    return state.accounts.filter((x) => x.channelPartnerId === partner.id && x.referredAt)
      .reduce((m, x) => (x.referredAt > m ? x.referredAt : m), partner.lastReferralDate || '');
  }

  /** Every dated, still-open item across accounts: follow-ups, revisits and key dates. */
  function upcomingItems() {
    const items = [];
    for (const a of state.accounts) {
      if (a.nextFollowUp) items.push({ kind: 'followup', date: a.nextFollowUp, label: 'Follow up', account: a });
      if (a.revisitDate) items.push({ kind: 'revisit', date: a.revisitDate, label: 'Revisit', account: a });
      if (a.closeDate && !isClosedStage(a.stage)) items.push({ kind: 'close', date: a.closeDate, label: 'Expected close', account: a });
      for (const k of a.keyDates) if (!k.done) items.push({ kind: 'keydate', date: k.date, label: k.label, account: a, keyDate: k });
    }
    return items.sort((x, y) => x.date.localeCompare(y.date));
  }

  // ---------- stay in touch ----------
  // A contact can carry a recurring "stay in touch" reminder. The last contact date is worked out
  // from logged activities with that person (calls, emails, LinkedIn, visits, cadence steps, checked
  // planner rows), or a manual reset; the next reminder is that date plus the interval.
  const STAY = [
    { key: 'weekly', label: 'Weekly', days: 7 },
    { key: 'biweekly', label: 'Every 2 weeks', days: 14 },
    { key: 'monthly', label: 'Monthly', months: 1 },
    { key: 'quarterly', label: 'Quarterly', months: 3 },
    { key: 'semiannual', label: 'Every 6 months', months: 6 },
    { key: 'yearly', label: 'Yearly', months: 12 },
  ];
  const stayDef = (key) => STAY.find((x) => x.key === key);
  /** "Monthly", "monthly" or "every 6 months" back to a key; '' when it isn't one. */
  const parseStay = (v) => {
    const s = String(v || '').trim().toLowerCase();
    const hit = STAY.find((x) => x.key === s || x.label.toLowerCase() === s);
    return hit ? hit.key : '';
  };
  function addMonths(iso, n) {
    const d = fromISO(iso);
    const day = d.getDate();
    d.setDate(1); d.setMonth(d.getMonth() + n);
    d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));
    return toISO(d);
  }
  const stayStep = (iso, key) => { const s = stayDef(key); return s.days ? addDays(iso, s.days) : addMonths(iso, s.months); };

  /** Latest real touch with this person up to today (notes don't count), or the last reset. */
  function lastContacted(acct, c) {
    const t = today();
    let best = c.sitReset && c.sitReset <= t ? c.sitReset : '';
    for (const h of acct.activities) if (h.contactId === c.id && h.kind !== 'Note' && h.date <= t && h.date > best) best = h.date;
    return best;
  }

  function stayInfo(acct, c) {
    const def = stayDef(c.stayInTouch);
    if (!def || (c.status && c.status !== 'Active')) return null;
    const last = lastContacted(acct, c);
    let next = last ? stayStep(last, def.key) : (c.sitSince || today());
    if (c.sitSnooze && c.sitSnooze > next) next = c.sitSnooze; // snoozed from the queue
    return { a: acct, c, key: def.key, label: def.label, last, next };
  }

  /** Everyone with a reminder, soonest first. */
  const stayList = () => state.accounts
    .flatMap((a) => a.contacts.map((c) => stayInfo(a, c)))
    .filter(Boolean)
    .sort((x, y) => x.next.localeCompare(y.next) || x.c.name.localeCompare(y.c.name));
  const stayDue = (d = today()) => stayList().filter((s) => s.next <= d);

  /** "3 days overdue", "Due today", "In 6 days", "In 3 weeks", "In 2 months". */
  function stayWhen(next) {
    const n = daysBetween(today(), next);
    if (n < 0) return `${plural(-n, 'day')} overdue`;
    if (n === 0) return 'Due today';
    if (n === 1) return 'Tomorrow';
    if (n < 14) return `In ${n} days`;
    if (n < 60) return `In ${Math.round(n / 7)} weeks`;
    return `In ${Math.round(n / 30.4)} months`;
  }

  /** Activity type to suggest for a contact, from their preferred channel. */
  const channelKind = (c, allowed = ACTIVITY_KINDS) => {
    const k = { Email: 'Email', LinkedIn: 'LinkedIn', 'In person': 'Visit' }[c.channel] || 'Call';
    return allowed.includes(k) ? k : 'Call';
  };

  function setStay(acct, c, key) {
    const was = c.stayInTouch || '';
    c.stayInTouch = key;
    if (key && !was) c.sitSince = today();
    if (!key) { c.sitSince = ''; c.sitReset = ''; }
    touch(acct);
  }

  const shortDate = (iso) => fmtDate(iso, { month: 'short', day: 'numeric' });
  const CLOCK_IC = '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>';
  const RESET_IC = '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg>';

  /** Interval dropdown. `bare` drops the "Stay in touch:" lead-in (tables). */
  function staySelect(a, c, bare = false) {
    const sel = `<select data-sit data-id="${a.id}" data-cid="${c.id}" aria-label="Stay in touch with ${esc(c.name)}">
      <option value="">${bare ? 'Off' : 'Off'}</option>${STAY.map((x) => `<option value="${x.key}" ${c.stayInTouch === x.key ? 'selected' : ''}>${x.label}</option>`).join('')}</select>`;
    return bare ? `<span class="sit-pick bare">${sel}</span>` : `<label class="sit-pick"><span>Stay in touch:</span>${sel}</label>`;
  }

  const stayActions = (a, c) => `
    <button type="button" class="icon-btn sit-btn" data-act="sit-reset" data-id="${a.id}" data-cid="${c.id}" title="Reset: count today as contacted" aria-label="Reset reminder for ${esc(c.name)}">${RESET_IC}</button>
    <button type="button" class="btn sm ghost" data-act="sit-log" data-id="${a.id}" data-cid="${c.id}" title="Log a call, email or LinkedIn touch">Log touch</button>`;

  /** The reminder line on a contact card. */
  function stayLine(a, c) {
    if (c.status && c.status !== 'Active') return '';
    const s = stayInfo(a, c);
    const cls = s ? (s.next < today() ? 'overdue' : s.next === today() ? 'today' : '') : 'off';
    return `
      <div class="sit-line ${cls}">
        <span class="sit-ic">${CLOCK_IC}</span>
        <div class="grow">
          ${staySelect(a, c)}
          <div class="small muted">${s
            ? `${s.last ? `Last contacted: ${esc(relDays(s.last))}` : 'Not contacted yet'} · <span class="sit-next">${s.next <= today() ? esc(stayWhen(s.next)) : `Next ${esc(shortDate(s.next))}`}</span>`
            : 'Pick how often you want to reach out.'}</div>
        </div>
        ${s ? `<div class="row sit-acts">${stayActions(a, c)}</div>` : ''}
      </div>`;
  }

  /** Rows for the Overview card: overdue, then the next 7 days. */
  function stayRowsHtml(items) {
    return `<ul class="list sit-list">${items.map((s) => `
      <li>
        <div class="sit-when ${s.next < today() ? 'overdue' : s.next === today() ? 'today' : ''}"><span>${esc(stayWhen(s.next))}</span><b>${esc(s.label)}</b></div>
        <span class="avatar sm" aria-hidden="true">${esc(initials(s.c.name))}</span>
        <div class="grow">
          <button type="button" class="link-btn title" data-act="open-contact" data-id="${s.a.id}" data-cid="${s.c.id}">${esc(s.c.name)}</button>
          <div class="small muted ellipsis">${s.c.title ? esc(s.c.title) + ' · ' : ''}<a href="#account/${s.a.id}">${esc(s.a.name)}</a></div>
        </div>
        <div class="row sit-acts">${stayActions(s.a, s.c)}</div>
      </li>`).join('')}</ul>`;
  }

  // ---------- contacts ----------
  const peopleSwitch = (mode) => `<div class="seg" role="group" aria-label="Accounts, contacts or partners">
      <a class="${mode === 'accounts' ? 'active' : ''}" href="#accounts" role="button">Accounts</a>
      <a class="${mode === 'contacts' ? 'active' : ''}" href="#contacts" role="button">Contacts</a>
      <a class="${mode === 'partners' ? 'active' : ''}" href="#partners" role="button">Partners</a>
    </div>`;
  const CONTACT_FILTERS = { all: 'All', dm: 'Decision makers', champ: 'Champions', norole: 'No role', due: 'Stay-in-touch due', stay: 'Stay in touch', quiet: 'No contact in 90+ days', left: 'Left / inactive' };
  const CONTACT_SORTS = { next: 'Next due', name: 'Name', account: 'Account', last: 'Last touch', role: 'Role' };
  const ROLE_CLASS = { 'Decision maker': 'dm', Champion: 'champ', Finance: 'fin', HR: 'hr', Influencer: 'infl', Gatekeeper: 'gate' };
  const rolePill = (r) => (r ? `<span class="role-pill ${ROLE_CLASS[r] || ''}">${esc(r)}</span>` : '');
  const isActiveContact = (c) => !c.status || c.status === 'Active';
  /** The roles that make up a 5–150 employee buying committee. */
  const COMMITTEE = ['Decision maker', 'Champion', 'Finance', 'HR'];
  function committee(a) {
    const active = a.contacts.filter(isActiveContact);
    const has = (r) => active.some((c) => c.role === r);
    // An owner, president or CEO with no role set still counts as the decision maker.
    const dm = has('Decision maker') || active.some((c) => !c.role && /owner|founder|ceo|president/i.test(c.title || ''));
    return { dm, roles: Object.fromEntries(COMMITTEE.map((r) => [r, r === 'Decision maker' ? dm : has(r)])) };
  }
  /** Who you've actually reached at an account: touches per active contact (notes don't count). */
  function threading(a) {
    const counts = new Map(a.contacts.filter(isActiveContact).map((c) => [c.id, 0]));
    for (const h of a.activities) if (h.kind !== 'Note' && counts.has(h.contactId)) counts.set(h.contactId, counts.get(h.contactId) + 1);
    const people = a.contacts.filter(isActiveContact).map((c) => ({ c, n: counts.get(c.id) || 0 })).sort((x, y) => y.n - x.n);
    return { people, reached: people.filter((x) => x.n).length };
  }
  /** Open deals where you've reached one person or nobody. */
  const singleThreaded = () => state.accounts.filter((a) => a.type === 'prospect' && isOpenDeal(a)).map((a) => ({ a, t: threading(a) }))
    .filter(({ t }) => t.reached <= 1).sort((x, y) => (Number(y.a.value) || 0) - (Number(x.a.value) || 0));
  const noDecisionMaker = () => state.accounts.filter((a) => a.type === 'prospect' && isOpenDeal(a) && !committee(a).dm);

  /** Call, email and LinkedIn as buttons (LinkedIn searches when no profile is saved). */
  const contactReach = (c, a) => `<span class="ct-reach2">
      ${c.phone || c.mobile ? `<a class="reach-btn" href="tel:${esc(c.phone || c.mobile)}" title="Call ${esc(c.phone || c.mobile)}" aria-label="Call ${esc(c.name)}">☎</a>` : '<span class="reach-btn off" title="No phone">☎</span>'}
      ${c.email ? `<a class="reach-btn" href="mailto:${esc(c.email)}" title="${esc(c.email)}" aria-label="Email ${esc(c.name)}">✉</a>` : '<span class="reach-btn off" title="No email">✉</span>'}
      <a class="reach-btn li ${c.linkedin ? '' : 'find'}" href="${esc(c.linkedin ? extUrl(c.linkedin) : liPeopleSearch(c.name, a.name))}" target="_blank" rel="noopener" title="${c.linkedin ? 'Open LinkedIn profile' : 'Find on LinkedIn'}" aria-label="LinkedIn for ${esc(c.name)}">in</a>
    </span>`;

  /** Status changes: inactive people leave cadences; "Left company" asks where they went. */
  function setContactStatus(a, c, status) {
    const was = c.status || 'Active';
    if (was === status) return;
    c.status = status;
    if (status !== 'Active') for (const p of enrollmentsFor(c.id)) finishEnrollment(p.e, 'bad');
    if (status !== 'Active' && c.stayInTouch) setStay(a, c, '');
    a.activities.push({ id: uid(), date: today(), kind: 'Note', summary: `${c.name}: ${status}`, notes: '', contactId: c.id, createdAt: new Date().toISOString() });
    touch(a);
    if (status === 'Left company') setTimeout(() => leftCompanyForm(a, c), 60);
  }

  /** A champion who moves is a new prospect: follow them to the new company. */
  function leftCompanyForm(a, c) {
    openModal(`Where did ${c.name} go?`, `
      <p class="small muted" style="margin:0">${esc(c.name)}${c.role ? ` (${esc(c.role.toLowerCase())})` : ''} left ${esc(a.name)}. Someone who knows you at a new company is a warm lead.</p>
      <div class="grid-2">
        ${field('New company', `<input name="company" list="dl-lc-accts" placeholder="Company name"><datalist id="dl-lc-accts">${state.accounts.filter((x) => x !== a).map((x) => `<option value="${esc(x.name)}">`).join('')}</datalist>`)}
        ${field('New title', `<input name="title" value="${esc(c.title || '')}">`)}
        ${field('Email at the new company', '<input name="email" type="email" autocapitalize="off">')}
        ${field('Mobile', `<input name="mobile" value="${esc(c.mobile || '')}">`)}
      </div>
      <label class="row small"><input type="checkbox" name="followup" checked style="width:auto"> Follow up in 2 workdays</label>`, (data) => {
      const name = data.company.trim();
      if (!name) { toast('Type the new company, or choose Skip'); return false; }
      const now = new Date().toISOString();
      let b = findAccountByText(name) || findAccountByName(name);
      const created = !b;
      if (!b) {
        b = migrateAccount({ id: uid(), name, type: 'prospect', stage: STAGES.prospect[0], leadSource: 'Former contact', notes: `${c.name} moved here from ${a.name}.`, tags: 'former-champion', vendors: [], contacts: [], activities: [], keyDates: [], createdAt: now, updatedAt: now });
        state.accounts.push(b);
      }
      const nc = { id: uid(), name: c.name, title: data.title, email: data.email, phone: '', mobile: data.mobile, linkedin: c.linkedin || '', role: c.role === 'Champion' ? 'Champion' : '', notes: `Was ${c.title || 'a contact'} at ${a.name}.${c.notes ? `\n${c.notes}` : ''}`, status: 'Active', channel: c.channel || '', timezone: c.timezone || '', primary: !b.contacts.length, movedFrom: a.id };
      b.contacts.push(nc);
      b.activities.push({ id: uid(), date: today(), kind: 'Note', summary: `${c.name} joined from ${a.name}`, notes: '', contactId: nc.id, createdAt: now });
      if (data.followup && !b.nextFollowUp) b.nextFollowUp = shiftDays(today(), 2, true);
      c.movedTo = b.id;
      a.activities.push({ id: uid(), date: today(), kind: 'Note', summary: `${c.name} moved to ${b.name}`, notes: '', contactId: c.id, createdAt: now });
      touch(a); touch(b);
      toast(created ? `${b.name} added as a prospect with ${c.name}` : `${c.name} added to ${b.name}`);
    }, 'Follow them');
    $('.modal-actions [data-close]', modalForm).textContent = 'Skip';
  }

  function contactRows() {
    const t = today();
    const q = ui.contactSearch.trim().toLowerCase();
    const f = CONTACT_FILTERS[ui.contactFilter] ? ui.contactFilter : 'all';
    const rows = state.accounts.flatMap((a) => a.contacts.map((c) => ({ a, c, s: stayInfo(a, c), last: lastContacted(a, c) })))
      .filter(({ a, c, s, last }) => {
        if (ui.contactType !== 'all' && a.type !== ui.contactType) return false;
        const active = isActiveContact(c);
        if (f === 'left' ? active : f !== 'all' && f !== 'quiet' && !active) return false;
        if (f === 'dm' && c.role !== 'Decision maker') return false;
        if (f === 'champ' && c.role !== 'Champion') return false;
        if (f === 'norole' && c.role) return false;
        if (f === 'stay' && !s) return false;
        if (f === 'due' && !(s && s.next <= t)) return false;
        if (f === 'quiet' && (!active || (last && daysBetween(last, t) < 90))) return false;
        return !q || [c.name, c.title, c.role, c.email, c.phone, c.mobile, a.name].join(' ').toLowerCase().includes(q);
      });
    const byName = (x, y) => x.c.name.localeCompare(y.c.name);
    const roleIdx = (c) => { const i = CONTACT_ROLES.indexOf(c.role); return i === -1 ? 99 : i; };
    const sorts = {
      next: (x, y) => (x.s ? x.s.next : FAR).localeCompare(y.s ? y.s.next : FAR) || byName(x, y),
      name: byName,
      account: (x, y) => x.a.name.localeCompare(y.a.name) || byName(x, y),
      last: (x, y) => (x.last || '').localeCompare(y.last || '') || byName(x, y),
      role: (x, y) => roleIdx(x.c) - roleIdx(y.c) || byName(x, y),
    };
    return rows.sort(sorts[ui.contactSort] || sorts.next);
  }

  function renderContacts() {
    const t = today();
    const rows = contactRows();
    const all = state.accounts.flatMap((a) => a.contacts.map((c) => ({ a, c })));
    const total = all.length;
    const shown = rows.slice(0, ui.contactLimit);
    const f = CONTACT_FILTERS[ui.contactFilter] ? ui.contactFilter : 'all';
    const counts = {
      all: total, dm: all.filter((x) => isActiveContact(x.c) && x.c.role === 'Decision maker').length, champ: all.filter((x) => isActiveContact(x.c) && x.c.role === 'Champion').length,
      norole: all.filter((x) => isActiveContact(x.c) && !x.c.role).length, due: stayDue(t).length, left: all.filter((x) => !isActiveContact(x.c)).length,
    };
    const st = singleThreaded();
    const nodm = noDecisionMaker();
    const tabs = ['all', 'dm', 'champ', 'norole', 'due', 'left'];
    $('#view').innerHTML = `
      <div class="page-head">
        <div>
          <div class="row" style="gap:.85rem"><h1>Contacts <span class="muted small">(${rows.length})</span></h1>${peopleSwitch('contacts')}</div>
          <div class="muted small">Roles, last touch per person, and who you haven't reached yet.</div>
        </div>
      </div>
      <div class="view-tabs">${tabs.map((k) => `<button type="button" class="q-tab ${f === k ? 'active' : ''}" data-act="ct-filter" data-f="${k}">${esc(CONTACT_FILTERS[k])} <span>${counts[k]}</span></button>`).join('')}</div>
      <div class="filters">
        <input type="search" id="ct-search" placeholder="Search name, title, email, account…" value="${esc(ui.contactSearch)}">
        <select id="ct-filter" aria-label="Show">${Object.entries(CONTACT_FILTERS).map(([k, l]) => `<option value="${k}" ${f === k ? 'selected' : ''}>${l}</option>`).join('')}</select>
        <select id="ct-type" aria-label="Type">
          <option value="all">Partners & prospects</option>
          <option value="partner" ${ui.contactType === 'partner' ? 'selected' : ''}>Partners</option>
          <option value="prospect" ${ui.contactType === 'prospect' ? 'selected' : ''}>Prospects</option>
        </select>
        <select id="ct-sort" aria-label="Sort">${Object.entries(CONTACT_SORTS).map(([k, l]) => `<option value="${k}" ${ui.contactSort === k ? 'selected' : ''}>Sort: ${l}</option>`).join('')}</select>
      </div>
      <div class="bulk-bar card" id="ct-bulk" hidden>
        <strong id="ct-bulk-n"></strong>
        <button type="button" class="btn sm" id="ct-bulk-cad">Add to cadence</button>
        <label class="row small">Role <select id="ct-bulk-role"><option value="">Set role…</option>${CONTACT_ROLES.map((r) => `<option>${esc(r)}</option>`).join('')}<option value="__none">Clear role</option></select></label>
        <label class="row small">Stay in touch <select id="ct-bulk-sit"><option value="">Off</option>${STAY.map((x) => `<option value="${x.key}">${x.label}</option>`).join('')}</select></label>
        <button type="button" class="btn sm ghost" id="ct-bulk-apply">Apply</button>
        <label class="row small">Status <select id="ct-bulk-status"><option value="">Set status…</option>${CONTACT_STATUSES.map((x) => `<option>${esc(x)}</option>`).join('')}</select></label>
        <button type="button" class="btn sm ghost" id="ct-bulk-tag">Tag their accounts</button>
        <button type="button" class="btn sm ghost" id="ct-bulk-csv">Export</button>
        <button type="button" class="btn sm ghost" id="ct-bulk-clear">Clear</button>
      </div>
      ${rows.length ? `
      <div class="card ct-table">
        <div class="ct-row ct-headrow">
          <input type="checkbox" id="ct-all" aria-label="Select all shown">
          <span>Name</span><span>Account</span><span>Role</span><span>Reach</span><span>Stay in touch</span><span>Last touch</span><span>Next due</span><span></span>
        </div>
        ${shown.map(({ a, c, s, last }) => {
          const active = isActiveContact(c);
          const lateTouch = active && isLive(a) && (!last || daysBetween(last, t) > 30) && ['Decision maker', 'Champion'].includes(c.role);
          return `
        <div class="ct-row ${active ? '' : 'inactive'}">
          <input type="checkbox" class="ct-pick" data-id="${a.id}" data-cid="${c.id}" aria-label="Select ${esc(c.name)}">
          <div class="ct-name">
            <span class="avatar sm" aria-hidden="true">${esc(initials(c.name))}</span>
            <div class="grow">
              <button type="button" class="link-btn title" data-act="open-contact" data-id="${a.id}" data-cid="${c.id}">${esc(c.name)}</button>${c.primary ? ' <span class="pill primary">Primary</span>' : ''}${c.flag ? ` <span class="pill overdue" title="${esc(c.flag)}">⚠</span>` : ''}
              <div class="small muted ellipsis">${esc(c.title || '') || '&nbsp;'}</div>
            </div>
          </div>
          <div class="ct-acct small"><a href="#account/${a.id}">${esc(a.name)}</a> <span class="pill ${a.type}">${a.type === 'partner' ? 'Partner' : 'Prospect'}</span></div>
          <div class="ct-role"><select class="role-sel ${ROLE_CLASS[c.role] || (c.role ? 'other' : 'none')}" data-ct-role data-id="${a.id}" data-cid="${c.id}" aria-label="Role for ${esc(c.name)}"><option value="">No role</option>${CONTACT_ROLES.map((r) => opt(r, r, c.role || '')).join('')}</select></div>
          ${contactReach(c, a)}
          <div class="ct-sit">${active ? staySelect(a, c, true) : `<select class="status-sel" data-ct-status data-id="${a.id}" data-cid="${c.id}" aria-label="Status for ${esc(c.name)}">${CONTACT_STATUSES.map((x) => opt(x, x, c.status)).join('')}</select>`}</div>
          <div class="ct-last small ${lateTouch ? 'pt-late' : ''}"><span class="ct-lbl">Last touch </span>${last ? esc(relDays(last)) : '<span class="muted">Never</span>'}</div>
          <div class="ct-next small"><span class="ct-lbl">Next </span>${s ? `<span class="pill ${dueClass(s.next)}">${esc(s.next <= t ? stayWhen(s.next) : shortDate(s.next))}</span>` : '<span class="muted">—</span>'}</div>
          <div class="ct-act row">${s ? stayActions(a, c) : active ? `<button type="button" class="btn sm ghost" data-act="sit-log" data-id="${a.id}" data-cid="${c.id}">Log touch</button>` : c.movedTo && getAccount(c.movedTo) ? `<a class="small" href="#account/${c.movedTo}">Now at ${esc(getAccount(c.movedTo).name)}</a>` : c.status === 'Left company' ? `<button type="button" class="btn sm ghost" data-act="ct-follow" data-id="${a.id}" data-cid="${c.id}">Where did they go?</button>` : ''}</div>
        </div>`;
        }).join('')}
      </div>
      ${rows.length > shown.length ? `<button class="btn ghost" data-act="ct-more" style="width:100%;margin-top:.75rem">Show more (${rows.length - shown.length} more)</button>` : ''}`
      : `<div class="card empty-soft">${total ? 'No contacts match these filters.' : 'No contacts yet. Add people from an account page, or import a spreadsheet.'}</div>`}
      ${st.length || nodm.length ? `<div class="ct-lower">
        <div class="card">
          <div class="section-head" style="margin-bottom:.2rem"><h2 style="margin:0">Single-threaded deals</h2><span class="pill ${st.length ? 'overdue' : ''}">${st.length} of ${state.accounts.filter((a) => a.type === 'prospect' && isOpenDeal(a)).length} open deals</span></div>
          <p class="small muted" style="margin:0 0 .5rem">Open deals where you've reached one person or nobody. Add the owner, HR and finance before the deal depends on one inbox.</p>
          ${st.length ? `<ul class="list">${st.slice(0, 8).map(({ a, t: th }) => `<li>
            <a class="title grow" href="#account/${a.id}">${esc(a.name)}</a>
            <span class="small muted ellipsis" style="max-width:55%">${th.people.length ? esc(th.people.slice(0, 3).map((x) => `${x.c.name.split(' ')[0]} ${x.n}×`).join(', ')) : 'No contacts yet'}</span>
            <span class="small pt-late">${th.reached ? '1 reached' : 'nobody reached'}</span>
          </li>`).join('')}</ul>` : '<div class="empty">Every open deal has two or more people reached.</div>'}
        </div>
        <div class="card">
          <div class="section-head" style="margin-bottom:.2rem"><h2 style="margin:0">No decision maker mapped</h2><span class="pill ${nodm.length ? 'overdue' : ''}">${nodm.length}</span></div>
          <p class="small muted" style="margin:0 0 .5rem">Open deals with nobody marked Decision maker (an owner, founder or CEO counts).</p>
          ${nodm.length ? `<ul class="list">${nodm.slice(0, 8).map((a) => `<li><a class="title grow" href="#account/${a.id}">${esc(a.name)}</a><span class="small muted">${plural(a.contacts.filter(isActiveContact).length, 'contact')}</span><button type="button" class="btn sm ghost" data-act="new-contact" data-id="${a.id}">+ Add contact</button></li>`).join('')}</ul>` : '<div class="empty">Every open deal has a decision maker.</div>'}
        </div>
      </div>` : ''}`;

    const redraw = () => renderContacts();
    $('#ct-search').addEventListener('input', (e) => {
      ui.contactSearch = e.target.value;
      clearTimeout(ui.searchTimer);
      ui.searchTimer = setTimeout(() => {
        if (!$('#ct-search')) return;
        const pos = $('#ct-search').selectionStart;
        ui.contactLimit = 200; redraw();
        const el = $('#ct-search'); el.focus(); el.setSelectionRange(pos, pos);
      }, 160);
    });
    $('#ct-filter').addEventListener('change', (e) => { ui.contactFilter = e.target.value; ui.contactLimit = 200; redraw(); });
    $('#ct-type').addEventListener('change', (e) => { ui.contactType = e.target.value; ui.contactLimit = 200; redraw(); });
    $('#ct-sort').addEventListener('change', (e) => { ui.contactSort = e.target.value; redraw(); });

    const picks = () => $$('.ct-pick:checked').map((cb) => { const a = getAccount(cb.dataset.id); const c = a && a.contacts.find((x) => x.id === cb.dataset.cid); return c ? { a, c } : null; }).filter(Boolean);
    const syncBulk = () => {
      const n = $$('.ct-pick:checked').length;
      $('#ct-bulk').hidden = !n;
      $('#ct-bulk-n').textContent = `${n} selected`;
      const allBox = $('#ct-all');
      if (allBox) { const boxes = $$('.ct-pick'); allBox.checked = n > 0 && n === boxes.length; allBox.indeterminate = n > 0 && n < boxes.length; }
    };
    $$('.ct-pick').forEach((cb) => cb.addEventListener('change', syncBulk));
    const allBox = $('#ct-all');
    if (allBox) allBox.addEventListener('change', (e) => { $$('.ct-pick').forEach((cb) => { cb.checked = e.target.checked; }); syncBulk(); });
    $('#ct-bulk-clear').addEventListener('click', () => { $$('.ct-pick').forEach((cb) => { cb.checked = false; }); syncBulk(); });
    $('#ct-bulk-apply').addEventListener('click', () => {
      const key = $('#ct-bulk-sit').value;
      let n = 0;
      for (const { a, c } of picks()) { if (!isActiveContact(c)) continue; setStay(a, c, key); n++; }
      save(); redraw();
      toast(key ? `${plural(n, 'contact')} set to ${stayDef(key).label.toLowerCase()}` : `Stay in touch off for ${plural(n, 'contact')}`);
    });
    $('#ct-bulk-role').addEventListener('change', (e) => {
      const role = e.target.value === '__none' ? '' : e.target.value;
      if (!e.target.value) return;
      const list = picks();
      for (const { a, c } of list) { c.role = role; touch(a); }
      save(); redraw(); toast(`${plural(list.length, 'contact')} ${role ? `set to ${role}` : 'cleared'}`);
    });
    $('#ct-bulk-status').addEventListener('change', (e) => {
      const status = e.target.value;
      if (!status) return;
      const list = picks();
      for (const { a, c } of list) setContactStatus(a, c, status);
      save(); redraw(); toast(`${plural(list.length, 'contact')} marked ${status}`);
    });
    $('#ct-bulk-tag').addEventListener('click', () => {
      const tag = (prompt('Tag to add to these contacts\' accounts:') || '').trim().replace(/^#/, '');
      if (!tag) return;
      const accts = [...new Set(picks().map((x) => x.a))];
      for (const a of accts) if (!tagList(a).some((x) => x.toLowerCase() === tag.toLowerCase())) { a.tags = [...tagList(a), tag].join(', '); touch(a); }
      save(); redraw(); toast(`#${tag} added to ${plural(accts.length, 'account')}`);
    });
    $('#ct-bulk-csv').addEventListener('click', () => contactsCsvRows(picks()));
    $('#ct-bulk-cad').addEventListener('click', () => enrollPeopleForm(picks()));
  }

  /** Enroll picked people in a cadence, spread over workdays if it's a big batch. */
  function enrollPeopleForm(people) {
    if (!state.cadences.length) { toast('Create a cadence first'); return; }
    const okPeople = people.filter((x) => isActiveContact(x.c));
    openModal(`Add ${plural(okPeople.length, 'person', 'people')} to a cadence`, `
      ${okPeople.length < people.length ? `<p class="small muted" style="margin:0">${plural(people.length - okPeople.length, 'inactive contact')} left out.</p>` : ''}
      <div class="grid-2">
        ${field('Cadence', `<select name="cad">${state.cadences.map((c) => opt(c.id, c.name, ui.cadenceId)).join('')}</select>`)}
        ${field('Start', `<input name="start" type="date" value="${today()}">`)}
      </div>
      <label class="row small"><input type="checkbox" name="spread" checked style="width:auto"> Spread start dates, up to <input type="number" name="perDay" min="1" value="${Number(ui.enrollPerDay) || 8}" style="width:4.2rem;display:inline-block"> new people a workday</label>`, (data) => {
      const cad = cadenceById(data.cad);
      const inCad = new Set(state.enrollments.filter((e) => e.cadenceId === cad.id && e.status !== 'finished').map((e) => e.contactId));
      const list = okPeople.filter((x) => !inCad.has(x.c.id));
      if (!list.length) { toast('Everyone picked is already in that cadence'); return false; }
      const perDay = Math.max(1, Number(data.perDay) || 8);
      const dated = data.spread && list.length > perDay ? staggerStarts(list, data.start || today(), perDay) : list.map((x) => ({ ...x, date: data.start || today() }));
      for (const x of dated) enroll(cad, x.a, x.c, x.date);
      toast(`${plural(dated.length, 'person', 'people')} added to ${cad.name}${okPeople.length - list.length ? ` · ${okPeople.length - list.length} already in it` : ''}`);
    }, 'Add to cadence');
  }

  /** Buying committee and threading for an account page's Contacts section. */
  function committeeLine(a) {
    if (a.type !== 'prospect' || !a.contacts.length) return a.type === 'prospect' && isOpenDeal(a) ? '<div class="cm-line warn">No contacts yet: add the owner, HR and finance.</div>' : '';
    const cm = committee(a);
    const th = threading(a);
    const live = isOpenDeal(a);
    return `<div class="cm-line ${live && (!cm.dm || th.reached <= 1) ? 'warn' : ''}">
      <span class="small muted">Buying committee</span>
      ${COMMITTEE.map((r) => `<span class="cm-role ${cm.roles[r] ? 'on' : ''}">${cm.roles[r] ? '✓' : '○'} ${esc(r)}</span>`).join('')}
      ${live && !cm.dm ? '<b class="pt-late small">No decision maker mapped</b>' : ''}
      ${live && th.reached <= 1 && th.people.length ? `<b class="pt-late small">${th.reached ? `Single-threaded: only ${esc(th.people[0].c.name)} reached` : 'Nobody reached yet'}</b>` : ''}
    </div>`;
  }

  /** Contacts as an upload file for ZoomInfo / Apollo. */
  function contactsCsvRows(pairs) {
    const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows = [['First Name', 'Last Name', 'Title', 'Role', 'Email', 'Phone', 'Mobile', 'Person LinkedIn URL', 'Company', 'Website', 'City', 'State', 'Employees', 'Industry', 'Status']];
    for (const { a, c } of pairs) {
      const [first, ...rest] = (c.name || '').split(/\s+/);
      const [city, stt] = (a.location || '').split(',').map((x) => x.trim());
      rows.push([first, rest.join(' '), c.title, c.role, c.email, c.phone, c.mobile, c.linkedin, a.name, a.website, city, stt, a.employees, a.industry, c.status || 'Active']);
    }
    downloadFile(`contacts-${today()}.csv`, rows.map((r) => r.map(cell).join(',')).join('\r\n'), 'text/csv');
  }

  // ---------- partners (ecosystem) ----------
  // A thin layer on partner accounts: health, stakeholders, their clients, referred pipeline with
  // estimated broker comp, a dated playbook and three automatic rules. No portal, no payouts.
  const PARTNER_OWNERS = ['Me', 'Christa', 'Han', 'Blake'];
  const AGREEMENT_STATUSES = ['None', 'In discussion', 'Signed', 'Expired'];
  const INFLUENCE = ['High', 'Medium', 'Low'];
  const CLIENT_KINDS = { client: 'Client (broker of record)', target: 'Co-sell target', former: 'Former referral' };
  const RESELL_STAGES = ['Closed Lost', 'Nurture', 'Revisit'];
  const PLAYBOOKS = {
    broker: { name: 'Broker playbook', steps: [
      [0, 'Intro meeting: partnership overview and how referrals work'],
      [7, 'Send the comp overview and run a what-if with the calculator'],
      [14, 'Agreement signed and appointment confirmed'],
      [21, 'Book review: map their clients and pick 3 co-sell targets'],
      [30, 'Joint call or co-sell plan on the first target'],
      [60, 'Check in on the first referral; share a success story'],
      [90, 'Quarterly review: pipeline, wins, next targets'],
    ] },
    advisor: { name: 'Advisor playbook (CPA, attorney, banker, consultant)', steps: [
      [0, 'Intro meeting: which of their clients fit a PEO'],
      [7, 'Send the client-fit one-pager and referral process'],
      [21, 'Lunch & learn or short training for their team'],
      [30, 'Review 3 client fits together'],
      [60, 'Check in on the first referral'],
      [90, 'Quarterly update: product news, use cases, success stories'],
    ] },
    network: { name: 'Association, franchise & tech playbook', steps: [
      [0, 'Intro meeting: member or customer profile'],
      [14, 'Agree on a member offer and co-marketing plan'],
      [30, 'Run a webinar or event for their members'],
      [60, 'Review leads and referrals'],
      [90, 'Quarterly review'],
    ] },
  };
  const playbookFor = (p) => (/Association|Payroll/.test(p.partnerType || '') ? 'network'
    : /CPA|Attorney|Banker|HR Consultant|Business Consultant|Private Equity/.test(p.partnerType || '') ? 'advisor' : 'broker');

  const partners = () => state.accounts.filter((a) => a.type === 'partner');
  const referredBy = (p) => state.accounts.filter((x) => x.channelPartnerId === p.id);
  const partnerClients = (p) => p.clients || [];

  // ----- comp estimates -----
  /** The comp rates table; a brand-new or erased workspace starts from the editable defaults. */
  const compRows = () => {
    if (!Array.isArray(state.compPlans) || !state.compPlans.length) state.compPlans = defaultCompPlans();
    return state.compPlans;
  };
  const compPlans = () => compRows().filter((x) => x.kind !== 'bonus');
  const compBonuses = () => compRows().filter((x) => x.kind === 'bonus');
  const planOf = (p) => compRows().find((x) => x.id === (p && p.compPlanId) && x.kind !== 'bonus') || compPlans()[0] || null;
  /** What a deal brings in for comp: enrolled employees (or headcount), annual admin fees, setup fee. */
  const dealInputs = (a) => ({ enrolled: Number(a.enrolled || a.employees) || 0, adminFees: Number(a.adminFees) || 0, setupFee: Number(a.setupFee) || 0, closeDate: a.closeDate || '' });
  /** Year-one estimate for one plan. Bonuses apply when the close date falls in their window, or when forced. */
  function compEstimate(plan, inp, includeBonus) {
    if (!plan) return { admin: 0, setup: 0, pepm: 0, bonus: 0, total: 0 };
    const admin = ((Number(plan.adminPct) || 0) / 100) * inp.adminFees;
    const setup = ((Number(plan.setupPct) || 0) / 100) * inp.setupFee;
    const pepm = (Number(plan.pepm) || 0) * inp.enrolled * (Number(plan.months) || 12);
    const bonus = compBonuses().filter((b) => (includeBonus === undefined ? inp.closeDate && inp.closeDate >= b.from && inp.closeDate <= b.to : includeBonus))
      .reduce((n, b) => n + (Number(b.bonus) || 0), 0);
    return { admin, setup, pepm, bonus, total: admin + setup + pepm + bonus };
  }
  const dealComp = (deal) => compEstimate(planOf(getAccount(deal.channelPartnerId)), dealInputs(deal)).total;
  const est = (n) => `${money(Math.round(n))}`;

  const nextStep = (p) => state.tasks.filter((x) => x.accountId === p.id && !x.done).sort((x, y) => x.date.localeCompare(y.date))[0] || null;

  // ----- tiers: value first, then time -----
  // A partner's tier comes from what they produce: A has referred a deal in the last 12 months,
  // B is warm (met or committed, or referred before), C is cold (signed or imported, not met).
  // The tier sets the touch target, whether the quiet-partner rule applies and which cadence fits.
  const TIERS = {
    A: { name: 'Producing', days: 30, every: 'monthly', why: 'Referred a deal in the last 12 months' },
    B: { name: 'Warm', days: 90, every: 'quarterly', why: 'Met or committed, no referral in 12 months' },
    C: { name: 'Cold', days: 0, every: 'by cadence', why: 'Signed or imported, not met yet' },
  };
  const GIVE_KINDS = ['Client intro', 'Co-marketing', 'Event invite', 'Benchmark report', 'Referral out'];
  const yearAgo = () => addDays(today(), -365);
  const referrals12 = (p) => referredBy(p).filter((x) => x.referredAt && x.referredAt >= yearAgo());
  const gives12 = (p) => p.activities.filter((h) => h.give && h.date >= yearAgo());
  function autoTier(p) {
    const ref = lastReferralDate(p);
    if (ref && ref >= yearAgo()) return 'A';
    if (ref || ['Met', 'Committed', 'Producing'].includes(p.stage) || p.activities.some((h) => ['Meeting', 'Visit', 'Demo'].includes(h.kind))) return 'B';
    return 'C';
  }
  /** '' for closed partners; a manual tier on the partner wins over the automatic one. */
  const partnerTier = (p) => (p.stage === 'Closed' ? '' : ['A', 'B', 'C'].includes(p.tier) ? p.tier : autoTier(p));
  const tierPill = (t) => (t ? `<span class="tier tier-${t}" title="Tier ${t} · ${TIERS[t].name}: touch ${TIERS[t].every}">${t}</span>` : '<span class="muted">—</span>');
  /** Past the tier's touch target (A: 30 days, B: 90). Tier C is worked by cadence, so never late. */
  function touchGap(p, tier = partnerTier(p)) {
    const lt = lastTouchDate(p);
    const days = lt ? daysBetween(lt, today()) : null;
    if (!tier || tier === 'C') return { late: false, days };
    return { late: days === null || days > TIERS[tier].days, days };
  }
  const agreementLeft = (p) => (p.agreementEnd ? daysBetween(today(), p.agreementEnd) : null);

  // ----- partner cadences: C gets Activate, B gets a quarterly value share -----
  const PARTNER_CADENCES = {
    C: { name: 'Partner Activate', description: 'Cold partners: earn a first meeting.', color: '#0b7285', steps: [
      [1, 'email', 'Intro: how we work with partners', 'Working together on your clients', 'Hi {{first_name}},\n\nI work with brokers and advisors whose clients have outgrown in-house HR and benefits. Partners keep the relationship and get paid on what we place together.\n\nWorth 20 minutes to see if your book fits?'],
      [3, 'call', 'Intro call', '', 'Goal: a 20-minute intro meeting. Ask which clients are growing, already on a PEO, or struggling with HR and compliance.'],
      [6, 'linkedin', 'Connect', '', 'Connect with a short note that references the email.'],
      [10, 'email', 'One-pager and comp overview', 'How partner comp works', 'Hi {{first_name}},\n\nA one-page overview of how referrals work and what partners earn. Happy to run the numbers on a client you have in mind.'],
      [14, 'call', 'Book the intro meeting', '', 'Offer two times this week. Mention one client type that fits.'],
      [21, 'email', 'Benchmark offer', 'A free benchmark for one client', 'Hi {{first_name}},\n\nIf one of your clients is renewing soon, I can put together a benefits and cost benchmark you can bring to them. No strings.'],
    ] },
    B: { name: 'Partner value share', description: 'Warm partners: a quarterly reason to talk, aiming for a first referral.', color: '#c98a00', steps: [
      [1, 'email', 'Market update or benchmark', 'Something useful for your renewals', 'Hi {{first_name}},\n\nA quick market update your clients may ask about this quarter.'],
      [21, 'call', 'Check in: clients renewing soon?', '', 'Ask which clients renew in the next 90 days and where they feel pressure.'],
      [40, 'email', 'Case study', 'How a client like yours made the switch', ''],
      [60, 'email', 'Event or webinar invite', 'Join us', ''],
      [85, 'call', 'Quarterly review: ask for one introduction', '', 'Recap what you shared this quarter and ask for one introduction.'],
    ] },
  };
  const partnerCadence = (tier) => state.cadences.find((c) => c.partnerTier === tier);
  function ensurePartnerCadence(tier) {
    let cad = partnerCadence(tier);
    if (cad) return cad;
    const tp = PARTNER_CADENCES[tier];
    cad = { id: uid(), name: tp.name, description: tp.description, color: tp.color, skipWeekends: true, partnerTier: tier,
      steps: tp.steps.map(([day, type, title, subject, body]) => ({ id: uid(), day, type, title, subject, body })) };
    state.cadences.push(cad);
    return cad;
  }
  const partnerContact = (p) => p.contacts.find((c) => c.primary && (!c.status || c.status === 'Active')) || p.contacts.find((c) => !c.status || c.status === 'Active');
  const inPartnerCadence = (p, cad) => !!cad && state.enrollments.some((e) => e.cadenceId === cad.id && e.accountId === p.id && e.status !== 'finished');
  /** Enroll every partner of a tier who isn't in its cadence yet, spread over workdays. */
  function enrollTier(tier) {
    const cad = ensurePartnerCadence(tier);
    const list = partners().filter((p) => partnerTier(p) === tier && !inPartnerCadence(p, cad));
    const picks = list.map((p) => ({ a: p, c: partnerContact(p) })).filter((x) => x.c);
    const dated = staggerStarts(picks, today(), Number(ui.enrollPerDay) || 8);
    for (const x of dated) enroll(cad, x.a, x.c, x.date);
    return { cad, n: dated.length, noContact: list.length - picks.length, last: dated.length ? dated[dated.length - 1].date : '' };
  }
  /** Leave Activate once met (tier B) or referring (A); leave value share on the first referral. */
  function partnerCadenceExits() {
    let n = 0;
    for (const e of state.enrollments) {
      if (e.status === 'finished') continue;
      const cad = cadenceById(e.cadenceId);
      if (!cad || !cad.partnerTier) continue;
      const p = getAccount(e.accountId);
      if (!p) continue;
      const tier = partnerTier(p);
      if (cad.partnerTier === 'C' && (tier === 'A' || tier === 'B')) { finishEnrollment(e, tier === 'A' ? 'referred' : 'meeting'); n++; }
      else if (cad.partnerTier === 'B' && tier === 'A') { finishEnrollment(e, 'referred'); n++; }
    }
    return n;
  }

  // ----- reciprocity: what you gave vs what you got -----
  function giveForm(partnerId, kind = GIVE_KINDS[0]) {
    const ps = partners().filter((x) => x.stage !== 'Closed').sort((x, y) => x.name.localeCompare(y.name));
    if (!ps.length) { toast('Add a partner first'); return; }
    const p0 = getAccount(partnerId) || ps[0];
    openModal('Log something you gave', `
      <p class="small muted" style="margin:0">Partners keep sending deals to people who send something back. Logging it keeps the give/get balance honest.</p>
      <div class="grid-2">
        ${field('Partner', `<select name="partnerId">${ps.map((x) => opt(x.id, x.name, p0.id)).join('')}</select>`)}
        ${field('What you gave', `<select name="give">${GIVE_KINDS.map((k) => opt(k, k, kind)).join('')}</select>`)}
        ${field('About (client, event, report)', `<input name="about" list="dl-give-about" placeholder="e.g. Sunrise Bakery, Q1 webinar"><datalist id="dl-give-about">${state.accounts.filter((a) => a.type === 'prospect').map((a) => `<option value="${esc(a.name)}">`).join('')}</datalist>`)}
        ${field('Date', `<input name="date" type="date" value="${today()}">`)}
        ${field('Notes', '<textarea name="notes" rows="2"></textarea>', 'span-2')}
      </div>`, (data) => {
      const p = getAccount(data.partnerId);
      p.activities.push({ id: uid(), date: data.date || today(), kind: 'Other', give: data.give, summary: `Gave: ${data.give}${data.about ? ` · ${data.about.trim()}` : ''}`, notes: data.notes, contactId: (partnerContact(p) || {}).id || '', createdAt: new Date().toISOString() });
      touch(p);
      toast(`Logged for ${p.name}: ${data.give.toLowerCase()}`);
    }, 'Log it', { wide: true });
  }

  // ----- client map: their book as your prospecting list -----
  const NON_VENDOR = (v) => v && v !== NO_VENDOR;
  function clientFacts(c) {
    const acct = clientAccount(c);
    const incumbent = c.vendor || (acct ? acct.vendors.filter(NON_VENDOR)[0] || '' : '');
    const renewal = c.renewal || (acct && acct.vendorRenewal) || '';
    const left = renewal ? daysBetween(today(), renewal) : null;
    return { c, acct, incumbent, renewal, soon: left !== null && left >= 0 && left <= 90, competitor: !!incumbent && COMPETITORS.includes(incumbent), target: c.kind === 'target' || (acct && isOpenDeal(acct)) };
  }
  function clientMap(p) {
    const all = partnerClients(p).filter((c) => c.kind !== 'former').map(clientFacts);
    const worth = all.filter((x) => x.soon || x.competitor || x.target)
      .sort((x, y) => (y.soon - x.soon) || (x.renewal || '9').localeCompare(y.renewal || '9') || (y.competitor - x.competitor) || x.c.name.localeCompare(y.c.name));
    return { all, worth };
  }
  function callAgenda(p) {
    const { worth } = clientMap(p);
    const line = (x) => `${x.c.name}${x.incumbent ? ` (${x.incumbent})` : ''}${x.renewal ? `, renews ${fmtDate(x.renewal, { month: 'short', day: 'numeric' })}` : ''}`;
    const soon = worth.filter((x) => x.soon); const comp = worth.filter((x) => !x.soon && x.competitor); const tgt = worth.filter((x) => !x.soon && !x.competitor);
    const refs = referredBy(p).filter(isOpenDeal);
    return [`Call agenda · ${p.name}`,
      refs.length && `Update on what they sent: ${refs.map((x) => `${x.name} (${stageShort(x.stage)})`).join('; ')}`,
      soon.length && `Renewing in the next 90 days: ${soon.map(line).join('; ')}`,
      comp.length && `On a competitor PEO: ${comp.map(line).join('; ')}`,
      tgt.length && `Co-sell targets: ${tgt.map(line).join('; ')}`,
      gives12(p).length ? `What we've shared this year: ${gives12(p).map((h) => h.give).join(', ')}` : 'Offer something: a benchmark, a client intro or an event invite'].filter(Boolean).join('\n');
  }
  const copyText = (text, msg = 'Copied') => (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject()).then(() => toast(msg), () => { prompt('Copy this:', text); });

  function clientEditForm(p, c) {
    openModal(`Client · ${c.name}`, `
      <div class="grid-2">
        ${field('Company', `<input name="name" value="${esc(c.name)}" required>`)}
        ${field('Relationship', `<select name="kind">${Object.entries(CLIENT_KINDS).map(([k, l]) => opt(k, l, c.kind)).join('')}</select>`)}
        ${field('Current PEO / vendor', `<input name="vendor" list="dl-vendors-c" value="${esc(c.vendor || '')}"><datalist id="dl-vendors-c">${allVendors().map((v) => `<option value="${esc(v)}">`).join('')}</datalist>`)}
        ${field('Renewal date', `<input name="renewal" type="date" value="${esc(c.renewal || '')}">`)}
        ${field('Location', `<input name="location" value="${esc(c.location || '')}">`)}
        ${field('Employees', `<input name="employees" type="number" min="0" value="${esc(c.employees || '')}">`)}
      </div>`, (data) => {
      if (!data.name.trim()) return false;
      Object.assign(c, { name: data.name.trim(), kind: data.kind, vendor: data.vendor.trim(), renewal: data.renewal, location: data.location, employees: data.employees });
      touch(p);
    }, 'Save');
  }

  /** One row per partner for the table. */
  function partnerRowData(p) {
    const tier = partnerTier(p);
    const refs = referredBy(p);
    const open = refs.filter(isOpenDeal);
    const won = refs.filter((x) => x.stage === 'Closed Won');
    const gap = touchGap(p, tier);
    const ns = nextStep(p);
    const enr = liveEnrollments().find((x) => x.acct.id === p.id && x.e.status !== 'finished');
    return {
      p, tier, gap, ns, enr,
      refs12: referrals12(p).length, refsAll: refs.length,
      pipe: open.reduce((n, x) => n + (Number(x.value) || 0), 0),
      compWon: won.reduce((n, x) => n + dealComp(x), 0), compOpen: open.reduce((n, x) => n + dealComp(x), 0),
      given: gives12(p).length, got: referrals12(p).length,
      left: agreementLeft(p),
    };
  }

  // ----- rules -----
  const RULE_LABELS = {
    onboard: ['New partner → onboarding playbook', 'Dated steps for the partner type go into the planner.'],
    quiet: ['Quiet partner → re-engage task', 'Tier A with no touch in 30 days, Tier B in 90. Tier C goes through the Activate cadence instead.'],
    agreement: ['Agreement ending → renewal task', 'A task 60 days before a partner agreement ends.'],
    update: ['Referred deal changes stage → update the partner', 'A task to tell the partner what moved.'],
  };
  const ruleOn = (k) => (ui.partnerRules || {})[k] !== false;

  function applyPlaybook(p, key = playbookFor(p), start = today()) {
    const pb = PLAYBOOKS[key];
    pb.steps.forEach(([day, title], i) => {
      state.tasks.push({ id: uid(), date: nextWorkday(addDays(start, day)), time: '', title, accountId: p.id, priority: i === 0 ? 'high' : 'med',
        notes: `${pb.name} · step ${i + 1} of ${pb.steps.length}`, done: false, playbook: key, categoryId: 'cat-partner' });
    });
    p.playbook = key; touch(p);
  }

  /**
   * Partner rules: re-engage tasks for quiet Tier A/B partners (once, until done), renewal tasks 60
   * days before an agreement ends, and partner-cadence exits when a tier changes. Cold (Tier C)
   * partners never get re-engage tasks; open ones made before tiers existed are cleared.
   */
  function runPartnerRules() {
    const t = today();
    let made = partnerCadenceExits() > 0;
    const n0 = state.tasks.length;
    state.tasks = state.tasks.filter((x) => {
      if (x.rule !== 'reengage' || x.done) return true;
      const pa = getAccount(x.accountId);
      return !pa || partnerTier(pa) !== 'C';
    });
    if (state.tasks.length !== n0) made = true;
    for (const p of partners()) {
      const tier = partnerTier(p);
      if (ruleOn('quiet') && (tier === 'A' || tier === 'B') && touchGap(p, tier).late
        && !state.tasks.some((x) => x.accountId === p.id && x.rule === 'reengage' && !x.done)) {
        const lt = lastTouchDate(p);
        state.tasks.push({ id: uid(), date: t, time: '', title: `Re-engage ${p.name}`, accountId: p.id, priority: tier === 'A' ? 'high' : 'med', done: false, rule: 'reengage', categoryId: 'cat-partner',
          notes: `Tier ${tier} (${TIERS[tier].name}): touch ${TIERS[tier].every}. ${lt ? `Last touch ${relDays(lt)}.` : 'No touch logged yet.'} Bring something: a client idea, a benchmark or an event invite.` });
        made = true;
      }
      if (ruleOn('agreement') && p.agreementEnd && p.agreementStatus !== 'Expired' && agreementLeft(p) <= 60
        && !state.tasks.some((x) => x.rule === 'agreement' && x.accountId === p.id && x.agreementEnd === p.agreementEnd)) {
        state.tasks.push({ id: uid(), date: t, time: '', title: `Renew agreement with ${p.name} (ends ${fmtDate(p.agreementEnd, { month: 'short', day: 'numeric' })})`, accountId: p.id, priority: 'high', done: false,
          rule: 'agreement', agreementEnd: p.agreementEnd, categoryId: 'cat-partner', notes: '' });
        made = true;
      }
    }
    return made;
  }

  /** Rule 3: a referred deal moved; remind yourself to tell the partner (one open task per deal). */
  function partnerUpdateTask(deal, to) {
    const p = deal.channelPartnerId && getAccount(deal.channelPartnerId);
    if (!p || !ruleOn('update')) return;
    const title = `Update ${p.name}: ${deal.name} moved to ${to}`;
    const open = state.tasks.find((x) => x.rule === 'update' && x.dealId === deal.id && !x.done);
    if (open) Object.assign(open, { title, date: today() });
    else state.tasks.push({ id: uid(), date: today(), time: '', title, accountId: p.id, dealId: deal.id, priority: 'med', done: false, rule: 'update', notes: '', categoryId: 'cat-partner' });
  }

  // ----- the Partners page -----
  const PT_QUICK = { all: 'All', A: 'Tier A', B: 'Tier B', C: 'Tier C', untouched: 'Past touch target', expiring: 'Agreement ending' };
  const PT_COLS = [['name', 'Partner'], ['tier', 'Tier'], ['type', 'Type'], ['refs', 'Referrals 12 mo'], ['pipe', 'Referred pipeline'], ['comp', 'Est. comp won / open'], ['give', 'Given / got'], ['touch', 'Last touch'], ['next', 'Next step']];
  function renderPartners() {
    if (runPartnerRules()) save();
    const all = partners();
    const t = today();
    const data = all.map(partnerRowData);
    const q = (ui.ptSearch || '').trim().toLowerCase();
    const quick = PT_QUICK[ui.ptQuick] ? ui.ptQuick : 'all';
    const test = {
      all: () => true, A: (r) => r.tier === 'A', B: (r) => r.tier === 'B', C: (r) => r.tier === 'C',
      untouched: (r) => r.gap.late, expiring: (r) => r.left !== null && r.left <= 60,
    };
    const filtered = data.filter((r) => {
      if (ui.ptType && ui.ptType !== 'all' && r.p.partnerType !== ui.ptType) return false;
      if (ui.ptOwner && ui.ptOwner !== 'all' && (r.p.owner || '') !== ui.ptOwner) return false;
      return !q || haystack(r.p).includes(q);
    });
    const shown = filtered.filter(test[quick]);
    const tierOrder = (r) => ({ A: 0, B: 1, C: 2 }[r.tier] ?? 3);
    const key = { name: (r) => r.p.name.toLowerCase(), tier: tierOrder, type: (r) => (r.p.partnerType || '~').toLowerCase(), refs: (r) => -r.refs12, pipe: (r) => -r.pipe,
      comp: (r) => -(r.compWon + r.compOpen), give: (r) => r.given - r.got, touch: (r) => -(r.gap.days ?? 99999), next: (r) => (r.ns ? r.ns.date : '9999') }[ui.ptSort] || null;
    const dir = ui.ptDir === -1 ? -1 : 1;
    shown.sort((x, y) => {
      if (key) { const a = key(x); const b = key(y); if (a < b) return -dir; if (a > b) return dir; }
      return tierOrder(x) - tierOrder(y) || y.refs12 - x.refs12 || y.pipe - x.pipe || x.p.name.localeCompare(y.p.name);
    });
    const limit = ui.ptLimit || 25;
    const owners = [...new Set([...PARTNER_OWNERS, ...all.map((p) => p.owner).filter(Boolean)])];
    const by = (tier) => data.filter((r) => r.tier === tier);
    const A = by('A'); const B = by('B'); const C = by('C');
    const okA = A.filter((r) => !r.gap.late).length; const okB = B.filter((r) => !r.gap.late).length;
    const cadC = partnerCadence('C'); const cadB = partnerCadence('B');
    const inC = C.filter((r) => inPartnerCadence(r.p, cadC)).length;
    const inB = B.filter((r) => inPartnerCadence(r.p, cadB)).length;
    const weekSteps = (cad) => (cad ? Object.values(cadSchedule(t, addDays(weekStart(t), 6), { all: true })).flat().filter((c) => c.cad === cad && c.st !== 'done').reduce((n, c) => n + c.people.length, 0) : 0);
    const referred = state.accounts.filter((x) => x.channelPartnerId && getAccount(x.channelPartnerId));
    const open = referred.filter(isOpenDeal);
    const openValue = open.reduce((n, x) => n + (Number(x.value) || 0), 0);
    const openComp = open.reduce((n, x) => n + dealComp(x), 0);
    const won12 = referred.filter((x) => x.stage === 'Closed Won' && x.referredAt >= yearAgo()).length;
    const bar = (n, d) => `<div class="pt-bar ${d && n < d ? 'behind' : ''}"><i style="width:${d ? Math.round((n / d) * 100) : 0}%"></i></div>`;
    const tile = (tier, body) => `<div class="card kpi-card pt-tile ${quick === tier ? 'on' : ''}" data-act="pt-quick" data-q="${tier}" role="button" tabindex="0">${body}</div>`;
    const counts = Object.fromEntries(Object.keys(PT_QUICK).map((k) => [k, filtered.filter(test[k]).length]));
    const recip = data.filter((r) => r.given + r.got).sort((x, y) => y.got - x.got || y.given - x.given).slice(0, 8);
    const rmax = Math.max(1, ...recip.map((r) => Math.max(r.given, r.got)));
    const withClients = all.filter((p) => partnerClients(p).length).sort((x, y) => partnerClients(y).length - partnerClients(x).length);
    const cmP = getAccount(ui.cmPartner) && partnerClients(getAccount(ui.cmPartner)).length ? getAccount(ui.cmPartner) : withClients[0];
    const cm = cmP ? clientMap(cmP) : null;
    const live = all.filter((p) => p.stage !== 'Closed');
    const agreements = live.filter((p) => p.agreementEnd || ['In discussion', 'Expired'].includes(p.agreementStatus))
      .sort((x, y) => (x.agreementEnd || '9').localeCompare(y.agreementEnd || '9') || x.name.localeCompare(y.name));
    const noEnd = live.filter((p) => p.agreementStatus === 'Signed' && !p.agreementEnd).length;

    $('#view').innerHTML = `
      <div class="page-head">
        <div>
          <div class="row" style="gap:.85rem"><h1>Partners <span class="muted small">(${all.length})</span></h1>${peopleSwitch('partners')}</div>
          <div class="muted small">Tiered by what they produce. Touch targets by tier: A monthly, B quarterly, C by cadence.</div>
        </div>
        <div class="row">
          <button class="btn ghost" data-act="comp-calc">Calculator</button>
          <button class="btn ghost" data-act="comp-rates">Comp rates</button>
          <button class="btn ghost" data-act="log-referral">+ Log referral</button>
          <button class="btn" data-act="new-partner">+ New partner</button>
        </div>
      </div>
      <div class="kpi-grid4 pt-kpis">
        ${tile('A', `<span class="kpi-label">${tierPill('A')} Tier A · Producing</span><div class="kpi-value">${okA} <span class="kpi-of">of ${A.length}</span></div><div class="kpi-sub">touched in the last 30 days</div>${bar(okA, A.length)}`)}
        ${tile('B', `<span class="kpi-label">${tierPill('B')} Tier B · Warm</span><div class="kpi-value">${okB} <span class="kpi-of">of ${B.length}</span></div><div class="kpi-sub">touched in the last 90 days${B.length - inB ? ` · <button type="button" class="link-btn small" data-act="pt-enroll" data-tier="B">${B.length - inB} not in value-share cadence</button>` : ''}</div>${bar(okB, B.length)}`)}
        ${tile('C', `<span class="kpi-label">${tierPill('C')} Tier C · Cold</span><div class="kpi-value">${inC} <span class="kpi-of">of ${C.length}</span></div><div class="kpi-sub">in Activate cadence · ${plural(weekSteps(cadC), 'step')} this week</div>${C.length - inC ? `<button type="button" class="btn sm" data-act="pt-enroll" data-tier="C">Enroll ${C.length - inC} in Activate</button>` : bar(inC, C.length)}`)}
        <div class="card kpi-card"><span class="kpi-label">Referred pipeline</span><div class="kpi-value">${money(openValue)}</div><div class="kpi-sub">${plural(open.length, 'open deal')} · ${est(openComp)} est. comp · ${won12} won in 12 mo</div></div>
      </div>

      <div class="card pt2-card">
        <div class="section-head" style="margin-bottom:.2rem">
          <div><h2 style="margin:0">Partner table</h2><div class="small muted">Click a column to sort. Default: tier, then referrals. Red = past the tier's touch target, or getting without giving.</div></div>
          <button class="btn ghost sm" data-act="pt-export">Export</button>
        </div>
        <div class="pt-quick">${Object.entries(PT_QUICK).map(([k, l]) => `<button type="button" class="q-tab ${quick === k ? 'active' : ''}" data-act="pt-quick" data-q="${k}">${esc(l)} <span>${counts[k]}</span></button>`).join('')}</div>
        <div class="filters pt-filters">
          <input type="search" id="pt-search" placeholder="Search partners, people, notes…" value="${esc(ui.ptSearch || '')}">
          <select id="pt-type" aria-label="Partner type"><option value="all">All partner types</option>${PARTNER_TYPES.map((x) => `<option ${ui.ptType === x ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select>
          <select id="pt-owner" aria-label="Owner"><option value="all">Any owner</option>${owners.map((x) => `<option ${ui.ptOwner === x ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select>
        </div>
        ${shown.length ? `<div class="rs-wrap"><table class="rs-table ptt-table">
          <thead><tr>${PT_COLS.map(([k, l]) => `<th><button type="button" class="th-sort ${ui.ptSort === k ? 'on' : ''}" data-act="pt-sort" data-k="${k}">${esc(l)}${ui.ptSort === k ? (dir === 1 ? ' ▴' : ' ▾') : ''}</button></th>`).join('')}</tr></thead>
          <tbody>${shown.slice(0, limit).map((r) => {
            const { p } = r;
            const ns = r.ns ? `<span class="${r.ns.date < t ? 'pt-late' : ''}">${esc(r.ns.title)} · ${esc(relDays(r.ns.date))}</span>`
              : r.enr ? `<span class="muted">${esc(r.enr.cad.name)} · step ${r.enr.e.step + 1} of ${r.enr.cad.steps.length}</span>`
              : `<span class="${r.tier === 'A' || r.tier === 'B' ? 'pt-late' : 'muted'}">Nothing planned</span>`;
            return `<tr class="ptt-row" data-act="open-account" data-id="${p.id}">
              <td><strong>${esc(p.name)}</strong>${p.owner && p.owner !== 'Me' ? `<div class="small muted">${esc(p.owner)}</div>` : ''}</td>
              <td title="${esc(r.tier ? `${TIERS[r.tier].name}: ${p.tier ? 'set by hand' : TIERS[r.tier].why}` : 'Closed')}">${tierPill(r.tier)}</td>
              <td class="small">${esc(p.partnerType || '—')}</td>
              <td>${r.refs12}${r.refsAll > r.refs12 ? ` <span class="small muted">(${r.refsAll} all)</span>` : ''}</td>
              <td>${r.pipe ? money(r.pipe) : '<span class="muted">—</span>'}</td>
              <td>${r.compWon || r.compOpen ? `${est(r.compWon)} / ${est(r.compOpen)}` : '<span class="muted">—</span>'}</td>
              <td class="${r.got && !r.given ? 'pt-late' : ''}" title="Given to them / referrals from them, last 12 months">${r.given} / ${r.got}</td>
              <td class="${r.gap.late ? 'pt-late' : ''}">${r.gap.days === null ? 'never' : esc(relDays(lastTouchDate(p)))}</td>
              <td class="small ptt-next">${ns}</td>
            </tr>`;
          }).join('')}</tbody>
        </table></div>
        ${shown.length > limit ? `<button type="button" class="link-btn" data-act="pt-more">Show ${shown.length - limit} more ▾</button>` : ''}`
          : `<div class="empty">${all.length ? 'No partners match.' : 'No partners yet. Add a broker, CPA or other referral partner to start.'}</div>`}
      </div>

      <div class="pt-lower">
        <div class="card">
          <h2 style="margin:0">Reciprocity</h2>
          <p class="small muted" style="margin:.2rem 0 .6rem">What you gave vs what you got, last 12 months.</p>
          ${recip.length ? `<div class="rc-list">${recip.map((r) => `<a class="rc-row" href="#account/${r.p.id}">
            <span class="rc-name">${esc(r.p.name)}</span>
            <span class="rc-bars"><i class="g" style="width:${(r.given / rmax) * 50}%"></i><i class="r" style="width:${(r.got / rmax) * 50}%"></i></span>
            <span class="small ${r.got && !r.given ? 'pt-late' : 'muted'}">${r.given} / ${r.got}</span>
          </a>`).join('')}</div>
          <div class="rc-key small muted"><span><i class="g"></i> given to them</span><span><i class="r"></i> received from them</span></div>`
            : '<div class="empty">Log a referral or something you gave and the balance shows here.</div>'}
          <div class="row rc-acts">${GIVE_KINDS.map((k) => `<button type="button" class="btn ghost sm" data-act="pt-give" data-kind="${esc(k)}">+ ${esc(k)}</button>`).join('')}</div>
        </div>

        <div class="card">
          <div class="section-head" style="margin-bottom:.2rem"><h2 style="margin:0">Client map</h2>
            ${withClients.length > 1 ? `<select id="cm-partner" aria-label="Partner">${withClients.map((p) => opt(p.id, p.name, cmP.id)).join('')}</select>` : ''}</div>
          ${cm ? `<p class="small muted" style="margin:0 0 .5rem">${esc(cmP.name)}'s clients worth raising: renewing in 90 days, on a competitor PEO, or already a target. <b>${cm.worth.length} of ${cm.all.length}</b>.</p>
            ${cm.worth.length ? `<div class="cm-list">${cm.worth.slice(0, 8).map((x) => `<div class="cm-row">
              <div class="grow" style="min-width:0">${x.acct ? `<a class="title" href="#account/${x.acct.id}">${esc(x.c.name)}</a>` : `<strong>${esc(x.c.name)}</strong>`}
                <div class="small muted">${esc(x.incumbent || 'Vendor unknown')}${x.acct ? ` · ${esc(stageShort(x.acct.stage))}` : x.c.kind === 'target' ? ' · co-sell target' : ''}</div></div>
              <span class="small ${x.soon ? 'pt-late' : 'muted'}">${x.renewal ? esc(fmtDate(x.renewal, { month: 'short', day: 'numeric' })) : '—'}</span>
              <button type="button" class="icon-btn" data-act="pt-client-edit" data-id="${cmP.id}" data-client="${x.c.id}" title="Edit vendor and renewal" aria-label="Edit ${esc(x.c.name)}">✎</button>
              ${x.acct ? '' : `<button type="button" class="btn sm ghost" data-act="client-prospect" data-id="${cmP.id}" data-client="${x.c.id}">Add</button>`}
            </div>`).join('')}</div>` : `<div class="empty">None flagged yet. Add each client's current vendor and renewal date (✎ on the partner's Accounts tab) to surface them.</div>`}
            <div class="row" style="margin-top:.6rem"><button type="button" class="btn sm" data-act="pt-agenda" data-id="${cmP.id}">Copy call agenda</button><button type="button" class="btn sm ghost" data-act="pt-open-tab" data-id="${cmP.id}" data-tab="accounts">All ${cm.all.length} clients</button></div>`
            : '<div class="empty">Paste a partner\'s book of business (their page → Accounts → + Add clients). Clients renewing soon or on a competitor PEO become the agenda for your next call.</div>'}
        </div>

        <div class="card">
          <h2 style="margin:0">Agreements</h2>
          <p class="small muted" style="margin:.2rem 0 .6rem">60-day warning before an agreement ends; a renewal task is added automatically.</p>
          ${agreements.length ? `<ul class="list ag-list">${agreements.slice(0, 10).map((p) => {
            const left = agreementLeft(p);
            return `<li><a class="title grow" href="#account/${p.id}">${esc(p.name)}</a>
              <span class="small ${left !== null && left <= 60 ? 'pt-late' : 'muted'}">${p.agreementEnd ? `${esc(fmtDate(p.agreementEnd))} · ${left < 0 ? `ended ${-left} days ago` : `${left} days`}` : `${esc(p.agreementStatus || 'None')} · no end date`}</span></li>`;
          }).join('')}</ul>` : ''}
          ${noEnd ? `<p class="small muted" style="margin:.5rem 0 0">${plural(noEnd, 'signed partner')} with no end date. Add one under Edit → Partner details to get the warning.</p>` : agreements.length ? '' : '<div class="empty">Add agreement end dates on a partner (Edit → Partner details).</div>'}
        </div>
      </div>

      <div class="card pt-rules">
        <h3 style="margin:0 0 .5rem">Automatic rules</h3>
        ${Object.entries(RULE_LABELS).map(([k, [name, sub]]) => `<label class="row pt-rule"><input type="checkbox" data-rule="${k}" ${ruleOn(k) ? 'checked' : ''} style="width:auto"><span><b>${esc(name)}</b><br><span class="small muted">${esc(sub)}</span></span></label>`).join('')}
      </div>`;
    const bind = (sel, k) => { const el = $(sel); if (el) el.addEventListener('change', (e) => { ui[k] = e.target.value; ui.ptLimit = 0; renderPartners(); }); };
    bind('#pt-type', 'ptType'); bind('#pt-owner', 'ptOwner'); bind('#cm-partner', 'cmPartner');
    $('#pt-search').addEventListener('input', (e) => {
      ui.ptSearch = e.target.value; clearTimeout(ui.searchTimer);
      ui.searchTimer = setTimeout(() => { if (!$('#pt-search')) return; const pos = $('#pt-search').selectionStart; renderPartners(); const el = $('#pt-search'); el.focus(); el.setSelectionRange(pos, pos); }, 160);
    });
    $$('[data-rule]').forEach((cb) => cb.addEventListener('change', () => {
      ui.partnerRules = { ...(ui.partnerRules || {}), [cb.dataset.rule]: cb.checked }; savePrefs();
      toast(`${RULE_LABELS[cb.dataset.rule][0]}: ${cb.checked ? 'on' : 'off'}`);
    }));
  }

  function partnersCsv() {
    const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows = [['Partner', 'Tier', 'Type', 'Stage', 'Owner', 'Referrals 12 mo', 'Referrals all time', 'Referred pipeline', 'Est. comp won', 'Est. comp open', 'Given 12 mo', 'Got 12 mo', 'Last touch', 'Agreement', 'Agreement ends', 'Next step']];
    for (const r of partners().map(partnerRowData)) {
      rows.push([r.p.name, r.tier, r.p.partnerType, r.p.stage, r.p.owner, r.refs12, r.refsAll, r.pipe, Math.round(r.compWon), Math.round(r.compOpen), r.given, r.got, lastTouchDate(r.p), r.p.agreementStatus, r.p.agreementEnd, r.ns ? `${r.ns.title} (${r.ns.date})` : '']);
    }
    downloadFile(`Partners-${today()}.csv`, rows.map((x) => x.map(cell).join(',')).join('\r\n'), 'text/csv');
  }

  // ----- partner page: summary strip and tabs -----
  const PARTNER_TABS = { overview: 'Overview', people: 'People', accounts: 'Accounts', pipeline: 'Pipeline & comp', plan: 'Plan' };
  function partnerStrip(a) {
    const tier = partnerTier(a);
    const gap = touchGap(a, tier);
    const ns = nextStep(a);
    const plan = planOf(a);
    const left = agreementLeft(a);
    const given = gives12(a).length; const got = referrals12(a).length;
    return `
      <div class="pt-strip">
        <div><span>Tier</span>${tierPill(tier)} ${tier ? `${esc(TIERS[tier].name)}${a.tier ? ' <span class="small muted">(set by hand)</span>' : ''}` : 'Closed'}</div>
        <div><span>Touch ${tier ? esc(TIERS[tier].every) : ''}</span><span class="${gap.late ? 'pt-late' : ''}">${gap.days === null ? 'Never touched' : `Last ${esc(relDays(lastTouchDate(a)))}`}</span></div>
        <div><span>Given / got · 12 mo</span><span class="${got && !given ? 'pt-late' : ''}">${given} / ${got}</span> <button type="button" class="link-btn small" data-act="pt-give" data-id="${a.id}">+ Give</button></div>
        <div><span>Agreement</span>${esc(a.agreementStatus || 'None')}${a.agreementEnd ? ` <span class="small ${left <= 60 ? 'pt-late' : 'muted'}">· ends ${esc(fmtDate(a.agreementEnd, { month: 'short', day: 'numeric', year: 'numeric' }))}</span>` : ''}${a.nationalAgreement ? ' <span class="pill">National</span>' : ''}</div>
        <div><span>Comp plan</span>${plan ? esc(plan.name) : '—'}</div>
        <div><span>Owner</span>${esc(a.owner || '—')}</div>
        <div class="pt-next"><span>Next step</span>${ns ? `${esc(ns.title)} <span class="small muted">${esc(relDays(ns.date))}</span>` : '<span class="muted">None planned</span>'}</div>
      </div>
      <div class="seg pt-tabs" role="tablist">${Object.entries(PARTNER_TABS).map(([k, l]) => `<button type="button" role="tab" class="${(ui.partnerTab || 'overview') === k ? 'active' : ''}" data-act="ptab" data-tab="${k}">${l}</button>`).join('')}</div>`;
  }

  function partnerTabBody(a, tab) {
    if (tab === 'people') return partnerPeople(a);
    if (tab === 'accounts') return partnerAccounts(a);
    if (tab === 'pipeline') return partnerPipeline(a);
    if (tab === 'plan') return partnerPlan(a);
    return '';
  }

  function partnerPeople(a) {
    const t = today();
    const people = [...a.contacts].sort((x, y) => INFLUENCE.indexOf(x.influence || 'Low') - INFLUENCE.indexOf(y.influence || 'Low'));
    const active = people.filter((c) => !c.status || c.status === 'Active');
    const overdue = active.filter((c) => { const s = stayInfo(a, c); return s && s.next < t; });
    const roles = new Set(active.map((c) => c.role).filter(Boolean));
    return `
      <div class="row spread"><div class="small muted">${plural(active.length, 'stakeholder')} · ${overdue.length ? `<span class="pill overdue">${overdue.length} overdue on cadence</span>` : 'nobody overdue'}${roles.has('Decision maker') ? '' : ' · <span class="pt-late">no decision maker mapped</span>'}</div>
        <button class="btn sm ghost" data-act="new-contact" data-id="${a.id}">+ Add person</button></div>
      ${people.length ? `<div class="pt-people">${people.map((c) => {
        const s = stayInfo(a, c);
        const last = lastContacted(a, c);
        return `<div class="pt-person ${c.status && c.status !== 'Active' ? 'inactive' : ''}" data-contact="${c.id}">
          <span class="avatar sm">${esc(initials(c.name))}</span>
          <div class="grow" style="min-width:0">
            <strong>${esc(c.name)}</strong>${c.primary ? ' <span class="pill primary">Primary</span>' : ''}
            <div class="small muted">${esc([c.title, c.role].filter(Boolean).join(' · ')) || '&nbsp;'}</div>
          </div>
          <label class="pt-infl small">Influence <select data-influence data-id="${a.id}" data-cid="${c.id}">${['', ...INFLUENCE].map((x) => `<option value="${x}" ${(c.influence || '') === x ? 'selected' : ''}>${x || '—'}</option>`).join('')}</select></label>
          <div class="pt-cad">${c.status && c.status !== 'Active' ? `<span class="pill overdue">${esc(c.status)}</span>` : staySelect(a, c, true)}</div>
          <div class="small pt-last">${last ? `Last ${esc(relDays(last))}` : '<span class="muted">Never contacted</span>'}${s && s.next < t ? ` · <span class="pill overdue">${esc(stayWhen(s.next))}</span>` : s ? ` · <span class="muted">next ${esc(shortDate(s.next))}</span>` : ''}</div>
          ${s ? `<div class="row sit-acts">${stayActions(a, c)}</div>` : '<span></span>'}
        </div>`;
      }).join('')}</div>` : '<div class="empty">No people yet. Map the owner, producers and account managers so you stay in touch with everyone.</div>'}
      <p class="small muted" style="margin:0">Cadence uses Stay in touch: pick how often to reach each person; they show up on the Overview and planner when due.</p>`;
  }

  function partnerAccounts(a) {
    const refs = referredBy(a);
    const current = refs.filter((x) => !RESELL_STAGES.includes(x.stage));
    const former = refs.filter((x) => RESELL_STAGES.includes(x.stage));
    const clients = partnerClients(a);
    const inCrm = clients.filter((c) => clientAccount(c));
    const row = (x) => `<li>
        <div class="grow"><a class="title" href="#account/${x.id}">${esc(x.name)}</a>
          <div class="small muted">${esc(x.stage)}${x.value ? ' · ' + money(x.value) : ''}${x.referredAt ? ' · referred ' + esc(relDays(x.referredAt)) : ''}${x.location ? ' · ' + esc(x.location) : ''}</div></div>
        ${isOpenDeal(x) ? `<span class="small muted">Est. comp</span> <b>${est(dealComp(x))}</b>` : ''}
      </li>`;
    return `
      <div class="row spread"><h3 style="margin:0">Referred by ${esc(a.name)} <span class="muted small">(${current.length})</span></h3><button class="btn sm" data-act="log-referral" data-id="${a.id}">+ Log referral</button></div>
      ${current.length ? `<ul class="list">${current.map(row).join('')}</ul>` : '<div class="empty">No referrals yet. Log one when they send you a lead.</div>'}

      <div class="row spread"><h3 style="margin:0">Former referrals to resell <span class="muted small">(${former.length + clients.filter((c) => c.kind === 'former').length})</span></h3></div>
      ${former.length || clients.some((c) => c.kind === 'former') ? `<ul class="list">${former.map((x) => `<li>
          <div class="grow"><a class="title" href="#account/${x.id}">${esc(x.name)}</a><div class="small muted">${esc(x.stage)}${x.value ? ' · ' + money(x.value) : ''}${x.vendors.length ? ' · on ' + esc(x.vendors.join(', ')) : ''}${x.vendorRenewal ? ' · renews ' + esc(fmtDate(x.vendorRenewal)) : ''}</div></div>
          <button class="btn sm ghost" data-act="resell-task" data-id="${x.id}" data-pid="${a.id}">Plan resell</button>
        </li>`).join('')}${clients.filter((c) => c.kind === 'former').map((c) => clientRow(a, c)).join('')}</ul>` : '<div class="empty">Deals they referred that went Closed Lost, Nurture or Revisit show here, ready to resell.</div>'}

      <div class="row spread"><h3 style="margin:0">Their clients <span class="muted small">(${clients.filter((c) => c.kind !== 'former').length}${inCrm.length ? ` · ${inCrm.length} already in your CRM` : ''})</span></h3><button class="btn sm ghost" data-act="add-clients" data-id="${a.id}">+ Add clients</button></div>
      ${clients.some((c) => c.kind !== 'former') ? `<ul class="list">${clients.filter((c) => c.kind !== 'former').sort((x, y) => (x.kind === 'target' ? 0 : 1) - (y.kind === 'target' ? 0 : 1) || (Number(y.employees) || 0) - (Number(x.employees) || 0)).map((c) => clientRow(a, c)).join('')}</ul>`
        : '<div class="empty">Paste their book of business (from Mployer or a spreadsheet) to see which clients overlap with your accounts and pick co-sell targets.</div>'}`;
  }

  const clientAccount = (c) => (c.accountId && getAccount(c.accountId)) || findAccountByText(c.name);
  function clientRow(p, c) {
    const acct = clientAccount(c);
    return `<li>
      <div class="grow">
        ${acct ? `<a class="title" href="#account/${acct.id}">${esc(c.name)}</a>` : `<span class="title">${esc(c.name)}</span>`}
        <div class="small muted">${[c.location, c.employees ? `${c.employees} employees` : '', c.ein ? `EIN ${c.ein}` : '', c.vendor ? `on ${c.vendor}` : '', c.renewal ? `renews ${fmtDate(c.renewal, { month: 'short', day: 'numeric', year: 'numeric' })}` : ''].filter(Boolean).map(esc).join(' · ') || '&nbsp;'}</div>
      </div>
      <button class="icon-btn" data-act="pt-client-edit" data-id="${p.id}" data-client="${c.id}" title="Edit vendor, renewal and details" aria-label="Edit ${esc(c.name)}">✎</button>
      ${acct ? `<span class="pill" title="Already in your CRM">In CRM · ${esc(stageShort(acct.stage))}</span>` : ''}
      <select class="pt-kind" data-client-kind data-id="${p.id}" data-client="${c.id}" aria-label="Relationship">${Object.entries(CLIENT_KINDS).map(([k, l]) => opt(k, l, c.kind)).join('')}</select>
      ${acct ? '' : `<button class="btn sm ghost" data-act="client-prospect" data-id="${p.id}" data-client="${c.id}" title="Create a prospect account for this client">+ Prospect</button>`}
      <button class="icon-btn" data-act="client-remove" data-id="${p.id}" data-client="${c.id}" title="Remove">✕</button>
    </li>`;
  }

  function partnerPipeline(a) {
    const plan = planOf(a);
    const refs = referredBy(a);
    const open = refs.filter(isOpenDeal).sort((x, y) => (x.closeDate || '9').localeCompare(y.closeDate || '9'));
    const won = refs.filter((x) => x.stage === 'Closed Won');
    const comp = (x) => compEstimate(plan, dealInputs(x));
    const openTotal = open.reduce((n, x) => n + comp(x).total, 0);
    const wonTotal = won.reduce((n, x) => n + comp(x).total, 0);
    const table = (list) => `<div class="pt-table">
      <div class="pt-tr pt-th"><span>Deal</span><span>Stage</span><span>Close</span><span>Enrolled</span><span>Admin fees</span><span>Est. year one</span><span></span></div>
      ${list.map((x) => { const c = comp(x); const inp = dealInputs(x); return `<div class="pt-tr">
        <span><a href="#account/${x.id}">${esc(x.name)}</a></span><span class="small">${esc(stageShort(x.stage))}</span><span>${dueChip(x.closeDate)}</span>
        <span>${inp.enrolled || '<span class="muted">—</span>'}</span><span>${inp.adminFees ? money(inp.adminFees) : '<span class="muted">—</span>'}</span>
        <span><b>${est(c.total)}</b>${c.bonus ? ' <span class="pill">+bonus</span>' : ''}</span>
        <span><button class="btn sm ghost" data-act="comp-calc" data-deal="${x.id}">Calculator</button></span>
      </div>`; }).join('')}</div>`;
    return `
      <div class="row spread">
        <label class="row small">Comp plan <select data-comp-plan data-id="${a.id}">${compPlans().map((x) => opt(x.id, x.name, plan && plan.id)).join('')}</select></label>
        <div class="row"><button class="btn sm ghost" data-act="comp-rates">Comp rates</button><button class="btn sm ghost" data-act="comp-calc" data-pid="${a.id}">What-if calculator</button></div>
      </div>
      ${(() => { const sc = partnerScorecard(a); return `<div class="section-head" style="margin:0"><h3 style="margin:0">Referral scorecard</h3><button type="button" class="btn sm ghost" data-act="pt-qbr" data-id="${a.id}">Copy for a partner review</button></div>
      <div class="cad-stats pt-score">
        <div><b>${sc.r12}</b><span>Referrals, 12 mo${sc.all > sc.r12 ? ` (${sc.all} all)` : ''}</span></div>
        <div><b>${sc.winRate === null ? '—' : sc.winRate + '%'}</b><span>Win rate${sc.won + sc.lost ? ` · ${sc.won} of ${sc.won + sc.lost}` : ''}</span></div>
        <div><b>${sc.avg ? money(Math.round(sc.avg)) : '—'}</b><span>Avg won deal</span></div>
        <div class="good"><b>${est(wonTotal)} / ${est(openTotal)}</b><span>Est. comp won / open</span></div>
        <div><b>${sc.days === null ? '—' : sc.days}</b><span>Days, referral → close</span></div>
        <div class="${sc.got && !sc.given ? 'bad' : ''}"><b>${sc.given} / ${sc.got}</b><span>Given / got, 12 mo</span></div>
      </div>`; })()}
      <h3 style="margin:.25rem 0 0">Open (S1–S5)</h3>
      ${open.length ? table(open) : '<div class="empty">No open referred deals.</div>'}
      ${won.length ? `<h3 style="margin:.25rem 0 0">Closed Won</h3>${table(won)}` : ''}
      <p class="small muted" style="margin:0">Estimates from your comp rates using each deal's enrolled employees (or headcount), annual admin fees and setup fee. Not a payout statement.</p>`;
  }

  function partnerScorecard(a) {
    const refs = referredBy(a);
    const plan = planOf(a);
    const won = refs.filter((x) => x.stage === 'Closed Won'); const lost = refs.filter((x) => x.stage === 'Closed Lost');
    const open = refs.filter(isOpenDeal);
    const vals = won.map((x) => Number(x.value) || 0).filter(Boolean);
    const cyc = won.filter((x) => x.referredAt && x.closeDate && x.closeDate >= x.referredAt).map((x) => daysBetween(x.referredAt, x.closeDate));
    const comp = (list) => list.reduce((n, x) => n + compEstimate(plan, dealInputs(x)).total, 0);
    return {
      r12: referrals12(a).length, all: refs.length, won: won.length, lost: lost.length,
      winRate: won.length + lost.length ? pct(won.length, won.length + lost.length) : null,
      avg: vals.length ? vals.reduce((n, v) => n + v, 0) / vals.length : null,
      days: cyc.length ? Math.round(cyc.reduce((n, v) => n + v, 0) / cyc.length) : null,
      open: open.length, pipe: open.reduce((n, x) => n + (Number(x.value) || 0), 0), compWon: comp(won), compOpen: comp(open),
      given: gives12(a).length, got: referrals12(a).length, gives: gives12(a),
    };
  }
  function qbrText(a) {
    const sc = partnerScorecard(a);
    return [`${a.name} · partner review, ${fmtDate(today())}`,
      `Referrals: ${sc.r12} in the last 12 months (${sc.all} all time)`,
      `Won: ${sc.won}${sc.winRate !== null ? ` · win rate ${sc.winRate}%` : ''}${sc.avg ? ` · average deal ${money(Math.round(sc.avg))}` : ''}`,
      `Open: ${plural(sc.open, 'deal')} · ${money(sc.pipe)} pipeline`,
      `Estimated partner comp: ${est(sc.compWon)} won · ${est(sc.compOpen)} open (estimates, not a statement)`,
      sc.days !== null && `Referral to close: ${sc.days} days on average`,
      sc.gives.length ? `What we shared: ${sc.gives.map((h) => h.summary.replace(/^Gave: /, '')).join('; ')}` : '',
      clientMap(a).worth.length ? `Clients to discuss: ${clientMap(a).worth.slice(0, 5).map((x) => x.c.name).join(', ')}` : ''].filter(Boolean).join('\n');
  }

  function partnerPlan(a) {
    const steps = state.tasks.filter((x) => x.accountId === a.id && x.playbook).sort((x, y) => x.date.localeCompare(y.date));
    const done = steps.filter((x) => x.done).length;
    const t = today();
    const resources = a.resources || [];
    return `
      <div class="row spread">
        <h3 style="margin:0">${a.playbook && PLAYBOOKS[a.playbook] ? esc(PLAYBOOKS[a.playbook].name) : 'Playbook'} ${steps.length ? `<span class="muted small">${done} of ${steps.length} done</span>` : ''}</h3>
        <div class="row">
          <select id="pb-pick" aria-label="Playbook">${Object.entries(PLAYBOOKS).map(([k, pb]) => opt(k, pb.name, a.playbook || playbookFor(a))).join('')}</select>
          <button class="btn sm ${steps.length ? 'ghost' : ''}" data-act="apply-playbook" data-id="${a.id}">${steps.length ? 'Add steps again' : 'Start playbook'}</button>
        </div>
      </div>
      ${steps.length ? `<div class="progress"><div style="width:${Math.round((done / steps.length) * 100)}%"></div></div>
      <ul class="list pt-steps">${steps.map((x) => `<li class="${x.done ? 'done' : ''}">
          <input type="checkbox" data-step="${x.id}" ${x.done ? 'checked' : ''} aria-label="Done" style="width:auto">
          <div class="grow"><div class="title">${esc(x.title)}</div><div class="small muted">${esc(fmtDate(x.date))} · ${x.done ? 'done' : esc(relDays(x.date))}</div></div>
          ${!x.done && x.date < t ? '<span class="pill overdue">late</span>' : ''}
        </li>`).join('')}</ul>` : '<div class="empty">Start a playbook to get dated steps for this partner type. They also show in your daily planner.</div>'}

      <h3 style="margin:.5rem 0 0">Co-sell plan</h3>
      <textarea id="pt-cosell" rows="4" placeholder="Who you're targeting together, the pitch, events, timelines…">${esc(a.coSellPlan || '')}</textarea>

      <div class="row spread"><h3 style="margin:.5rem 0 0">Resources</h3><button class="btn sm ghost" data-act="add-resource" data-id="${a.id}">+ Add link</button></div>
      ${resources.length ? `<ul class="list">${resources.map((r) => `<li><span class="grow"><a href="${esc(extUrl(r.url))}" target="_blank" rel="noopener">${esc(r.label || r.url)}</a></span><button class="icon-btn" data-act="del-resource" data-id="${a.id}" data-rid="${r.id}" title="Remove">✕</button></li>`).join('')}</ul>`
        : '<div class="empty">Links you share with this partner: your Highspot page, comp overview, one-pagers, webinar recordings.</div>'}
      ${filesSection(a)}`;
  }

  // ----- forms -----
  /** Quick capture: a partner sends a lead. Creates the prospect, linked to the partner and the person who sent it. */
  function referralForm(partnerId) {
    const ps = partners().sort((x, y) => x.name.localeCompare(y.name));
    if (!ps.length) { toast('Add a partner first'); return; }
    const p0 = getAccount(partnerId) || ps[0];
    openModal('Log a referral', `
      <div class="grid-2">
        ${field('Referred by', `<select name="partnerId" id="rf-partner">${ps.map((x) => opt(x.id, x.name, p0.id)).join('')}</select>`)}
        ${field('Their contact', '<select name="channelContactId" id="rf-pcontact"></select>')}
        ${field('Company *', '<input name="name" required>')}
        ${field('Employees', '<input name="employees" type="number" min="0">')}
        ${field('Contact name', '<input name="c_name">')}
        ${field('Title', '<input name="c_title">')}
        ${field('Email', '<input name="c_email" type="email" autocapitalize="off">')}
        ${field('Phone', '<input name="c_phone" type="tel">')}
        ${field('Stage', `<select name="stage">${STAGES.prospect.map((s) => opt(s, s, STAGES.prospect[0])).join('')}</select>`)}
        ${field('Next follow-up', `<input name="nextFollowUp" type="date" value="${nextWorkday(addDays(today(), 1))}">`)}
        ${field('Notes', '<textarea name="notes" rows="2" placeholder="What they said about the company, timing, current vendor…"></textarea>', 'span-2')}
      </div>`, (data) => {
      if (!data.name.trim()) return false;
      const p = getAccount(data.partnerId);
      const now = new Date().toISOString();
      const contacts = data.c_name || data.c_email || data.c_phone
        ? [{ id: uid(), name: data.c_name || data.c_email || data.c_phone, title: data.c_title, email: data.c_email, phone: data.c_phone, role: '', notes: '', status: 'Active', primary: true }] : [];
      const acct = migrateAccount({ id: uid(), name: data.name.trim(), type: 'prospect', stage: data.stage, employees: data.employees, notes: data.notes, tags: '', vendors: [],
        leadSource: 'Partner / broker', channelPartnerId: p.id, channelContactId: data.channelContactId || '', referredAt: today(), nextFollowUp: data.nextFollowUp,
        contacts, activities: [{ id: uid(), date: today(), kind: 'Note', summary: `Referred by ${p.name}`, notes: data.notes, createdAt: now }], keyDates: [], createdAt: now, updatedAt: now });
      state.accounts.push(acct);
      p.activities.push({ id: uid(), date: today(), kind: 'Note', summary: `Referral: ${acct.name}`, notes: '', contactId: data.channelContactId || '', createdAt: now });
      touch(p);
      partnerCadenceExits();
      toast(`Referral logged: ${acct.name}`);
    }, 'Log referral', { wide: true });
    const fill = () => {
      const p = getAccount($('#rf-partner').value);
      $('#rf-pcontact').innerHTML = `<option value="">—</option>${p ? p.contacts.map((c) => opt(c.id, c.name, (p.contacts.find((x) => x.primary) || {}).id)).join('') : ''}`;
    };
    $('#rf-partner').addEventListener('change', fill); fill();
  }

  /** Paste a book of business: one client per line (tab or comma separated: name, location, employees, EIN in any order after the name). */
  function addClientsForm(p) {
    openModal(`Add clients · ${p.name}`, `
      <p class="small muted" style="margin:0">Paste rows from Mployer's client summary or a spreadsheet: one company per line. The first column is the name; the app also picks up a location (City, ST), an employee count and an EIN.</p>
      ${field('Clients', '<textarea name="rows" rows="9" placeholder="PALIGROUP M…\tLos Angeles, CA\t603\nINTEGRATED DATA SERVICES\tHenderson, NV\t297"></textarea>')}
      ${field('Relationship', `<select name="kind">${Object.entries(CLIENT_KINDS).map(([k, l]) => opt(k, l, 'client')).join('')}</select>`)}
      <div class="small" id="ac-preview"></div>`, (data) => {
      const rows = parseClientRows(data.rows);
      if (!rows.length) { toast('Paste at least one company'); return false; }
      p.clients = p.clients || [];
      const have = new Set(p.clients.map((c) => c.name.trim().toLowerCase()));
      let added = 0;
      for (const r of rows) {
        if (have.has(r.name.toLowerCase())) continue;
        const acct = findAccountByText(r.name);
        p.clients.push({ id: uid(), ...r, kind: data.kind, accountId: acct ? acct.id : '', addedAt: new Date().toISOString() });
        have.add(r.name.toLowerCase()); added++;
      }
      touch(p);
      toast(`${plural(added, 'client')} added${rows.length - added ? ` · ${rows.length - added} already listed` : ''}`);
    }, 'Add clients', { wide: true });
    const ta = $('[name=rows]', modalForm);
    ta.addEventListener('input', () => {
      const rows = parseClientRows(ta.value);
      const overlap = rows.filter((r) => findAccountByText(r.name)).length;
      $('#ac-preview').textContent = rows.length ? `${plural(rows.length, 'company', 'companies')} found${overlap ? ` · ${overlap} already in your CRM` : ''}` : '';
    });
  }

  /** A renewal date from a pasted cell: 1/1/2027, 2027-01-01 or "Jan 1" (next one coming). */
  function cellDate(c) {
    let m = c.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) return c;
    m = c.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
    if (m) { const y = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]); return `${y}-${pad(Number(m[1]))}-${pad(Number(m[2]))}`; }
    m = c.match(/^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})$/i);
    if (m) {
      const mon = 'janfebmaraprmayjunjulaugsepoctnovdec'.indexOf(m[1].toLowerCase()) / 3 + 1;
      const t = today(); let iso = `${t.slice(0, 4)}-${pad(mon)}-${pad(Number(m[2]))}`;
      if (iso < t) iso = `${Number(t.slice(0, 4)) + 1}${iso.slice(4)}`;
      return iso;
    }
    return '';
  }

  function parseClientRows(text) {
    return String(text || '').split(/\r?\n/).map((line) => {
      const cells = (line.includes('\t') ? line.split('\t') : line.split(/,(?=\s*\S)(?![^"]*"\s*$)/)).map((x) => x.replace(/^"|"$/g, '').trim()).filter(Boolean);
      if (!cells.length) return null;
      const r = { name: cells[0], location: '', employees: '', ein: '', vendor: '', renewal: '' };
      if (/^employer|^company|^name$/i.test(r.name)) return null; // header row
      for (const c of cells.slice(1)) {
        const vendor = allVendors().find((v) => v !== NO_VENDOR && c.toLowerCase().includes(v.toLowerCase()));
        if (/^\d{2}-\d{7}$/.test(c)) r.ein = c;
        else if (!r.renewal && cellDate(c)) r.renewal = cellDate(c);
        else if (/^[\d,]+$/.test(c) && !r.employees) r.employees = c.replace(/,/g, '');
        else if (vendor && !r.vendor) r.vendor = vendor;
        else if (/[A-Za-z .'-]+,\s*[A-Z]{2}\b/.test(c) && !r.location) r.location = c;
      }
      return r.name.length > 1 ? r : null;
    }).filter(Boolean);
  }

  /** Editable comp rates: plans (percent of fees and per-employee-per-month) and dated one-time bonuses. */
  function compRatesForm() {
    const plans = compPlans(); const bonuses = compBonuses();
    openModal('Broker comp rates', `
      <p class="small muted" style="margin:0">These drive every estimate. Change a rate here when a promo starts or ends: nothing else needs to change.</p>
      <div class="cr-table">
        <div class="cr-tr cr-th"><span>Plan</span><span>% of admin fees</span><span>% of setup fee</span><span>$ per enrolled / mo</span><span>Months</span><span></span></div>
        ${plans.map((x) => `<div class="cr-tr" data-plan="${x.id}">
          <input name="pn_${x.id}" value="${esc(x.name)}" aria-label="Plan name">
          <input name="pa_${x.id}" type="number" step="any" min="0" value="${esc(x.adminPct ?? 0)}" aria-label="% of admin fees">
          <input name="ps_${x.id}" type="number" step="any" min="0" value="${esc(x.setupPct ?? 0)}" aria-label="% of setup fee">
          <input name="pp_${x.id}" type="number" step="any" min="0" value="${esc(x.pepm ?? 0)}" aria-label="$ per enrolled per month">
          <input name="pm_${x.id}" type="number" step="1" min="1" value="${esc(x.months ?? 12)}" aria-label="Months">
          <label class="small cr-del"><input type="checkbox" name="pd_${x.id}" style="width:auto"> delete</label>
        </div>`).join('')}
      </div>
      <button type="button" class="btn sm ghost" id="cr-add-plan">+ Add plan</button>
      <div class="cr-table">
        <div class="cr-tr cr-th cr-b"><span>One-time bonus</span><span>Amount ($)</span><span>From</span><span>To</span><span></span></div>
        ${bonuses.map((x) => `<div class="cr-tr cr-b">
          <input name="bn_${x.id}" value="${esc(x.name)}" aria-label="Bonus name">
          <input name="ba_${x.id}" type="number" step="any" min="0" value="${esc(x.bonus ?? 0)}" aria-label="Amount">
          <input name="bf_${x.id}" type="date" value="${esc(x.from || '')}" aria-label="From">
          <input name="bt_${x.id}" type="date" value="${esc(x.to || '')}" aria-label="To">
          <label class="small cr-del"><input type="checkbox" name="bd_${x.id}" style="width:auto"> delete</label>
        </div>`).join('')}
      </div>
      <button type="button" class="btn sm ghost" id="cr-add-bonus">+ Add bonus</button>
      <p class="small muted" style="margin:0">A bonus counts on deals whose expected close falls between its dates. Every figure in the app is an estimate, not a payout statement.</p>`, (data) => {
      const next = [];
      for (const x of compRows()) {
        if (x.kind === 'bonus') {
          if (data['bd_' + x.id]) continue;
          next.push({ ...x, name: data['bn_' + x.id] || x.name, bonus: Number(data['ba_' + x.id]) || 0, from: data['bf_' + x.id] || '', to: data['bt_' + x.id] || '' });
        } else {
          if (data['pd_' + x.id]) continue;
          next.push({ ...x, name: data['pn_' + x.id] || x.name, adminPct: Number(data['pa_' + x.id]) || 0, setupPct: Number(data['ps_' + x.id]) || 0, pepm: Number(data['pp_' + x.id]) || 0, months: Number(data['pm_' + x.id]) || 12 });
        }
      }
      state.compPlans = next;
      toast('Comp rates saved');
    }, 'Save rates', { wide: true });
    $('#cr-add-plan').addEventListener('click', () => { modal.close(); state.compPlans.push({ id: uid(), name: 'New plan', adminPct: 0, setupPct: 0, pepm: 0, months: 12 }); save(); compRatesForm(); });
    $('#cr-add-bonus').addEventListener('click', () => { modal.close(); const y = today().slice(0, 4); state.compPlans.push({ id: uid(), kind: 'bonus', name: 'New bonus', bonus: 0, from: `${y}-01-01`, to: `${y}-12-31` }); save(); compRatesForm(); });
  }

  /** What-if calculator: every plan side by side. From a deal it fills in that deal's numbers. */
  function compCalc({ dealId, partnerId } = {}) {
    const deal = dealId && getAccount(dealId);
    const p = getAccount(partnerId || (deal && deal.channelPartnerId));
    const inp = deal ? dealInputs(deal) : { enrolled: 25, adminFees: 0, setupFee: 0, closeDate: '' };
    const autoBonus = compBonuses().some((b) => inp.closeDate && inp.closeDate >= b.from && inp.closeDate <= b.to);
    const chosen = planOf(p);
    openModal(deal ? `Comp estimate · ${deal.name}` : 'Broker comp calculator', `
      ${deal ? `<p class="small muted" style="margin:0">${p ? `Referred by ${esc(p.name)} · ` : ''}${esc(deal.stage)}${deal.closeDate ? ' · closes ' + esc(fmtDate(deal.closeDate)) : ''}</p>` : '<p class="small muted" style="margin:0">Run a what-if live with a broker or CPA.</p>'}
      <div class="grid-3">
        ${field('Enrolled employees', `<input name="enrolled" id="cc-enr" type="number" min="0" value="${inp.enrolled || ''}">`)}
        ${field('Annual admin fees ($)', `<input name="adminFees" id="cc-admin" type="number" min="0" step="any" value="${inp.adminFees || ''}">`)}
        ${field('Setup fee ($)', `<input name="setupFee" id="cc-setup" type="number" min="0" step="any" value="${inp.setupFee || ''}">`)}
      </div>
      ${compBonuses().length ? `<label class="row small"><input type="checkbox" id="cc-bonus" style="width:auto" ${autoBonus ? 'checked' : ''}> Include ${esc(compBonuses().map((b) => `${b.name} (${money(b.bonus)})`).join(', '))}</label>` : ''}
      <div id="cc-out"></div>
      <p class="small muted" style="margin:0">Estimate only, from your comp rates. Not a payout statement.</p>
      <div class="row"><button type="button" class="btn sm ghost" id="cc-rates">Edit comp rates</button></div>`, (data) => {
      if (!deal) return;
      Object.assign(deal, { enrolled: data.enrolled, adminFees: data.adminFees, setupFee: data.setupFee });
      touch(deal); toast('Saved to the deal');
    }, deal ? 'Save numbers to deal' : 'Done', { wide: true });
    const draw = () => {
      const v = { enrolled: Number($('#cc-enr').value) || 0, adminFees: Number($('#cc-admin').value) || 0, setupFee: Number($('#cc-setup').value) || 0 };
      const bonus = $('#cc-bonus') ? $('#cc-bonus').checked : false;
      const rows = compPlans().map((pl) => ({ pl, c: compEstimate(pl, v, bonus) }));
      const best = Math.max(0, ...rows.map((r) => r.c.total));
      const p10 = rows.find((r) => r.pl.id === 'cp-pepm10'); const p25 = rows.find((r) => r.pl.id === 'cp-pepm25');
      $('#cc-out').innerHTML = `<div class="cc-table">
        <div class="cc-tr cc-th"><span>Plan</span><span>Admin fees</span><span>Setup</span><span>Per employee</span><span>Bonus</span><span>Year one</span></div>
        ${rows.map(({ pl, c }) => `<div class="cc-tr ${chosen && pl.id === chosen.id ? 'mine' : ''}">
          <span>${esc(pl.name)}${chosen && pl.id === chosen.id ? ' <span class="pill">this partner</span>' : ''}</span>
          <span>${est(c.admin)}</span><span>${est(c.setup)}</span><span>${est(c.pepm)}</span><span>${est(c.bonus)}</span>
          <span><b>${est(c.total)}</b>${c.total && c.total === best ? ' ★' : ''}</span>
        </div>`).join('')}
      </div>${p10 && p25 && v.enrolled ? `<div class="small" style="margin-top:.4rem">Promo vs standard per-employee: <b>+${est(p25.c.pepm - p10.c.pepm)}</b> in year one for ${v.enrolled} enrolled.</div>` : ''}`;
    };
    ['#cc-enr', '#cc-admin', '#cc-setup', '#cc-bonus'].forEach((s) => { const el = $(s); if (el) el.addEventListener('input', draw); });
    $('#cc-rates').addEventListener('click', () => { modal.close(); compRatesForm(); });
    draw();
  }

  // ---------- calendar (day and work week, Outlook-style categories) ----------
  // Timed planner tasks are the calendar's events; untimed ones sit in the "due" strip on top.
  // Categories are a small synced table you can rename and recolor; a task carries categoryId.
  const CAT_COLORS = [
    ['Red', '#e5484d'], ['Orange', '#f76b15'], ['Peach', '#e8875d'], ['Yellow', '#d4a106'], ['Green', '#2f9e44'], ['Teal', '#0d9488'],
    ['Blue', '#2563eb'], ['Navy', '#1e40af'], ['Purple', '#7c3aed'], ['Pink', '#d6409f'], ['Brown', '#a16207'], ['Steel', '#64748b'],
  ];
  const defaultCategories = () => [
    { id: 'cat-meeting', name: 'Meeting', color: '#2563eb' },
    { id: 'cat-call', name: 'Calls & outreach', color: '#2f9e44' },
    { id: 'cat-visit', name: 'Visit', color: '#f76b15' },
    { id: 'cat-partner', name: 'Partner', color: '#7c3aed' },
    { id: 'cat-admin', name: 'Admin', color: '#64748b' },
    { id: 'cat-personal', name: 'Personal', color: '#d4a106' },
  ];
  const catRows = () => {
    if (!Array.isArray(state.categories) || !state.categories.length) state.categories = defaultCategories();
    return state.categories;
  };
  const catOf = (x) => (x && x.categoryId && catRows().find((c) => c.id === x.categoryId)) || null;
  const catColor = (x) => (catOf(x) || {}).color || 'var(--accent)';
  const CAL_HOUR_PX = 56;
  const toMin = (hhmm) => { const [h, m] = (hhmm || '0:0').split(':').map(Number); return h * 60 + (m || 0); };
  const fmtMin = (min) => fmtTime(`${pad(Math.floor(min / 60) % 24)}:${pad(min % 60)}`);
  const calHidden = () => new Set(ui.calHidden || []);
  const isShown = (x) => !calHidden().has(x.categoryId || 'none');

  /** Side-by-side columns for overlapping events (greedy, per cluster of overlaps). */
  function layoutDay(evs) {
    evs.sort((a, b) => a.s - b.s || b.e - a.e);
    const out = []; let cluster = []; let end = -1;
    const flush = () => {
      const cols = [];
      for (const ev of cluster) { let c = cols.findIndex((e) => e <= ev.s); if (c === -1) { c = cols.length; cols.push(0); } cols[c] = ev.e; ev.col = c; }
      cluster.forEach((ev) => { ev.cols = cols.length; });
      out.push(...cluster); cluster = []; end = -1;
    };
    for (const ev of evs) { if (cluster.length && ev.s >= end) flush(); cluster.push(ev); end = Math.max(end, ev.e); }
    if (cluster.length) flush();
    return out;
  }

  /** The time grid for one or more days. Week mode adds day headers and a per-day due strip. */
  function calendarGrid(days, week, opts = {}) {
    const t = today();
    const timed = (d) => state.tasks.filter((x) => x.date === d && x.time && isShown(x));
    const allTimed = days.flatMap(timed);
    let startH = DAY_START; let endH = DAY_END + 1;
    for (const x of allTimed) {
      const s = toMin(x.time); const e = s + Math.max(15, Number(x.duration) || 30);
      startH = Math.min(startH, Math.floor(s / 60)); endH = Math.max(endH, Math.min(24, Math.ceil(e / 60)));
    }
    const hours = []; for (let h = startH; h < endH; h++) hours.push(h);
    const px = (min) => ((min - startH * 60) / 60) * CAL_HOUR_PX;
    const nowMin = new Date().getHours() * 60 + new Date().getMinutes();

    const dueStrip = (d) => {
      const untimed = state.tasks.filter((x) => x.date === d && !x.time && isShown(x));
      const steps = dueSteps(d).length;
      const follow = upcomingItems().filter((i) => i.kind !== 'revisit' && (i.date === d || (d === t && i.date < t))).length;
      const open = untimed.filter((x) => !x.done).length;
      if (!week) {
        if (!untimed.length) return '';
        return `<details class="cal-due" ${ui.calDueOpen ? 'open' : ''}><summary><span class="cal-due-ic">☰</span> ${plural(open, 'task')} due${untimed.length - open ? ` <span class="muted">· ${untimed.length - open} done</span>` : ''}</summary>
          <div class="cal-due-list">${untimed.map((x) => evChip(x)).join('')}</div></details>`;
      }
      const bits = [open && `${open} task${open === 1 ? '' : 's'}`, steps && `${steps} step${steps === 1 ? '' : 's'}`, follow && `${follow} follow-up${follow === 1 ? '' : 's'}`].filter(Boolean);
      return `<a class="cal-due-week ${bits.length ? '' : 'empty'}" href="#planner/${d}" data-act="cal-day" data-date="${d}">${bits.length ? esc(bits.join(' · ')) : '&nbsp;'}</a>`;
    };

    const column = (d) => {
      const evs = layoutDay(timed(d).map((x) => { const s = toMin(x.time); return { x, s, e: s + Math.max(15, Number(x.duration) || 30) }; }));
      return `<div class="cal-col ${d === t ? 'is-today' : ''}" data-date="${d}">
        ${hours.map((h) => `<div class="cal-slot" data-act="slot" data-date="${d}" data-time="${pad(h)}:00" title="Add at ${fmtTime(pad(h) + ':00')}"></div><div class="cal-slot half" data-act="slot" data-date="${d}" data-time="${pad(h)}:30" title="Add at ${fmtTime(pad(h) + ':30')}"></div>`).join('')}
        ${evs.map(({ x, s, e, col, cols }) => {
          const h = Math.max(22, px(e) - px(s) - 2);
          const acct = x.accountId && getAccount(x.accountId);
          const cat = catOf(x);
          return `<div class="cal-ev ${x.done ? 'done' : ''} ${h < 40 ? 'short' : ''}" data-act="edit-task" data-tid="${x.id}" style="--c:${catColor(x)};top:${px(s) + 1}px;height:${h}px;left:calc(${(col / cols) * 100}% + 2px);width:calc(${100 / cols}% - 4px)" title="${esc(`${x.title} · ${fmtMin(s)}–${fmtMin(e)}${cat ? ' · ' + cat.name : ''}`)}">
            <input type="checkbox" data-act="cal-check" data-id="${x.id}" ${x.done ? 'checked' : ''} aria-label="Done">
            <div class="cal-ev-body"><div class="cal-ev-title">${esc(x.title)}</div>
              <div class="cal-ev-sub">${fmtMin(s)}–${fmtMin(e)}${acct ? ` · ${esc(acct.name)}` : ''}</div></div>
          </div>`;
        }).join('')}
        ${d === t && nowMin >= startH * 60 && nowMin <= endH * 60 ? `<div class="cal-now" style="top:${px(nowMin)}px"></div>` : ''}
      </div>`;
    };

    return `<div class="cal ${week ? 'cal-week' : 'cal-day'}" style="--hpx:${CAL_HOUR_PX}px;--days:${days.length}">
      ${week ? `<div class="cal-row cal-headrow"><div class="cal-gutter"></div>${days.map((d) => `<button type="button" class="cal-dayhead ${d === t ? 'is-today' : ''}" data-act="cal-day" data-date="${d}"><span>${esc(fmtDate(d, { weekday: 'short' }))}</span><b>${fromISO(d).getDate()}</b></button>`).join('')}</div>` : ''}
      ${!opts.noDue && (week || days.some((d) => state.tasks.some((x) => x.date === d && !x.time && isShown(x)))) ? `<div class="cal-row cal-duerow"><div class="cal-gutter"></div>${days.map((d) => `<div class="cal-duecell">${dueStrip(d)}</div>`).join('')}</div>` : ''}
      <div class="cal-row cal-body">
        <div class="cal-gutter cal-times">${hours.map((h) => `<div class="cal-time"><span>${fmtTime(pad(h) + ':00')}</span></div>`).join('')}</div>
        ${days.map(column).join('')}
      </div>
    </div>`;
  }

  /** Compact chip for an untimed task in the due strip. */
  function evChip(x) {
    const acct = x.accountId && getAccount(x.accountId);
    return `<div class="cal-chip ${x.done ? 'done' : ''}" data-act="edit-task" data-tid="${x.id}" style="--c:${catColor(x)}">
      <input type="checkbox" data-act="cal-check" data-id="${x.id}" ${x.done ? 'checked' : ''} aria-label="Done">
      <span class="grow">${esc(x.title)}${acct ? ` <span class="muted">· ${esc(acct.name)}</span>` : ''}</span></div>`;
  }

  /** Category legend; tap a chip to hide or show it on the calendar. */
  function calLegend() {
    const hidden = calHidden();
    const used = new Set(state.tasks.map((x) => x.categoryId || 'none'));
    const chips = [...catRows().map((c) => ({ id: c.id, name: c.name, color: c.color })), ...(used.has('none') ? [{ id: 'none', name: 'No category', color: 'var(--accent)' }] : [])];
    return `<div class="cal-legend">
      ${chips.map((c) => `<button type="button" class="cal-cat ${hidden.has(c.id) ? 'off' : ''}" data-act="cal-cat" data-cat="${c.id}" style="--c:${c.color}" title="${hidden.has(c.id) ? 'Show' : 'Hide'} ${esc(c.name)}"><i></i>${esc(c.name)}</button>`).join('')}
      <button type="button" class="btn sm ghost" data-act="cal-categories">Categories</button>
    </div>`;
  }

  /** Create, rename, recolor and delete categories. */
  function categoriesForm() {
    const rows = catRows();
    const swatches = (name, cur) => `<div class="swatches">${CAT_COLORS.map(([label, hex]) => `<label class="swatch" title="${label}"><input type="radio" name="${name}" value="${hex}" ${hex === cur ? 'checked' : ''}><i style="--c:${hex}"></i></label>`).join('')}</div>`;
    openModal('Calendar categories', `
      <p class="small muted" style="margin:0">Name your categories and pick a color. Every task with that category shows in its color on the calendar.</p>
      <div class="cat-rows">
        ${rows.map((c) => `<div class="cat-row">
          <i class="cat-dot" style="--c:${c.color}"></i>
          <input name="n_${c.id}" value="${esc(c.name)}" aria-label="Category name">
          ${swatches('c_' + c.id, c.color)}
          <label class="small cr-del"><input type="checkbox" name="d_${c.id}" style="width:auto"> delete</label>
        </div>`).join('')}
        <div class="cat-row cat-new">
          <i class="cat-dot" style="--c:${CAT_COLORS[8][1]}"></i>
          <input name="n_new" placeholder="+ New category name" aria-label="New category name">
          ${swatches('c_new', CAT_COLORS[8][1])}
          <span></span>
        </div>
      </div>`, (data) => {
      const next = [];
      for (const c of catRows()) {
        if (data['d_' + c.id]) { state.tasks.forEach((x) => { if (x.categoryId === c.id) x.categoryId = ''; }); continue; }
        next.push({ ...c, name: (data['n_' + c.id] || '').trim() || c.name, color: data['c_' + c.id] || c.color });
      }
      if ((data.n_new || '').trim()) next.push({ id: uid(), name: data.n_new.trim(), color: data.c_new || CAT_COLORS[8][1] });
      state.categories = next.length ? next : defaultCategories();
      toast('Categories saved');
    }, 'Save categories', { wide: true });
    // Keep each row's dot in step with its chosen color.
    $$('.cat-row', modalForm).forEach((row) => row.addEventListener('change', (e) => { if (e.target.type === 'radio') $('.cat-dot', row).style.setProperty('--c', e.target.value); }));
  }

  /** Planner header controls for the calendar mode and week navigation. */
  const calModeSwitch = () => `<div class="seg" role="group" aria-label="Calendar view">
      <button type="button" class="${ui.calMode !== 'week' ? 'active' : ''}" data-act="cal-mode" data-mode="day">Day</button>
      <button type="button" class="${ui.calMode === 'week' ? 'active' : ''}" data-act="cal-mode" data-mode="week">Work week</button>
    </div>`;

  /** Full-width work week (Mon–Fri) for the week containing the planner date. */
  function renderWeek() {
    const ws = weekStart(ui.plannerDate);
    const days = [0, 1, 2, 3, 4].map((i) => addDays(ws, i));
    const t = today();
    const tasks = state.tasks.filter((x) => days.includes(x.date));
    const timedN = tasks.filter((x) => x.time).length;
    $('#view').innerHTML = `
      <div class="planner-head">
        <div>
          <h1 style="margin:0">${esc(fmtDate(days[0], { month: 'short', day: 'numeric' }))} – ${esc(fmtDate(days[4], { month: 'short', day: 'numeric', year: 'numeric' }))}</h1>
          <div class="muted">Work week · ${plural(timedN, 'scheduled item')} · ${tasks.filter((x) => x.done).length}/${tasks.length} done</div>
        </div>
        <div class="row">
          ${calModeSwitch()}
          <button class="btn ghost" data-act="day-shift" data-n="-7" title="Previous week">‹</button>
          <button class="btn ghost" data-act="day-shift" data-n="7" title="Next week">›</button>
          ${days.includes(t) ? '' : '<button class="btn ghost" data-act="day-today">This week</button>'}
          <button class="btn" data-act="new-task" data-date="${days.includes(ui.plannerDate) ? ui.plannerDate : days[0]}">+ Task</button>
        </div>
      </div>
      <div class="card cal-card">
        ${calLegend()}
        <div class="cal-scroll">${calendarGrid(days, true)}</div>
        <p class="small muted" style="margin:.5rem 0 0">Click a time to add a task · click a day to open its full plan · open a task to change its time, day or category.</p>
      </div>`;
    bindCalendar();
  }

  function bindCalendar() {
    $$('.cal input[data-act=cal-check], .cal-due input[data-act=cal-check]').forEach((cb) => cb.addEventListener('change', (e) => {
      const task = state.tasks.find((x) => x.id === e.target.dataset.id);
      if (task) { task.done = e.target.checked; save(); rerender(); }
    }));
    const due = $('.cal-due');
    if (due) due.addEventListener('toggle', () => { ui.calDueOpen = due.open; });
  }

  // ---------- today's queue ----------
  // One engine reads the data and hands back a ranked list of work: cadence steps, follow-ups,
  // revisits, key dates, stay-in-touch reminders, untimed tasks and route stops. Each item knows
  // its type, why it is on the list, when it was due and how to act on it. The planner queue, the
  // Overview's Priority tasks, the Today card and the "Everything due" tile all read from it.
  const QTABS = { all: 'All', calls: 'Calls', emails: 'Emails', linkedin: 'LinkedIn', visits: 'Visits', other: 'Other' };
  const TAB_OF = { call: 'calls', email: 'emails', linkedin: 'linkedin', visit: 'visits', text: 'other', task: 'other' };
  const QGROUPS = { late7: 'Overdue 7+ days', late: 'Overdue', today: 'Due today', upcoming: 'Upcoming' };
  const kindToType = (k) => ({ Call: 'call', Email: 'email', LinkedIn: 'linkedin', Visit: 'visit', Text: 'text' })[k] || 'task';
  const dueWords = (iso) => { const n = daysBetween(iso, today()); return n > 0 ? `${plural(n, 'day')} overdue` : n === 0 ? 'due today' : `due ${relDays(iso)}`; };
  function taskType(x) {
    const title = (x.title || '').toLowerCase();
    if (/linkedin/.test(title)) return 'linkedin';
    if (/email|e-mail/.test(title)) return 'email';
    const s = `${x.categoryId || ''} ${title}`;
    return /cat-call|\bcall\b/.test(s) ? 'call' : /email|e-mail/.test(s) ? 'email' : /linkedin/.test(s) ? 'linkedin' : /cat-visit|visit|drop off|drop-in/.test(s) ? 'visit' : 'task';
  }
  function taskWhy(x, a) {
    if (x.rule === 'reengage' && a) { const lt = lastTouchDate(a); return `${a.partnerType || 'Partner'} · last touch ${lt ? relDays(lt) : 'never'}`; }
    if (x.rule === 'update') return 'Referred deal changed stage';
    if (x.playbook && PLAYBOOKS[x.playbook]) return `${PLAYBOOKS[x.playbook].name} step`;
    return [x.priority === 'high' ? 'High priority' : '', (x.notes || '').split('\n')[0].slice(0, 80)].filter(Boolean).join(' · ') || `Task ${dueWords(x.date)}`;
  }

  function workQueue(d = today()) {
    const t = today(); const isToday = d === t;
    const horizon = isToday ? addDays(t, 2) : d;
    const inRange = (date) => !!date && (isToday ? date <= horizon : date === d);
    const items = [];
    for (const p of liveEnrollments()) {
      if (p.e.status !== 'active' || !inRange(p.e.dueDate)) continue;
      const late = daysBetween(p.e.dueDate, t);
      items.push({ key: 'enr:' + p.e.id, type: STEP_TYPES[p.step.type] ? p.step.type : 'task', title: `${stepType(p.step).label} · ${p.contact.name}`,
        sub: `${p.cad.name} · Step ${p.e.step + 1} of ${p.cad.steps.length}`, acct: p.acct, due: p.e.dueDate, src: 'cadence',
        why: late > 0 ? `${p.cad.name} step ${p.e.step + 1}, ${plural(late, 'day')} overdue` : `${p.cad.name} step ${p.e.step + 1} ${dueWords(p.e.dueDate)}`,
        btn: { act: 'enr-log', label: 'Do it', attrs: `data-eid="${p.e.id}"`, primary: true } });
    }
    for (const a of state.accounts) {
      if (a.nextFollowUp && inRange(a.nextFollowUp) && !isClosedStage(a.stage)) {
        const pc = primaryContact(a); const lt = lastTouchDate(a);
        items.push({ key: 'fu:' + a.id, type: kindToType(pc ? channelKind(pc) : 'Call'), title: `Follow up · ${accountLabel(a)}`, sub: pc ? `${pc.name}${pc.title ? ', ' + pc.title : ''}` : '',
          acct: a, due: a.nextFollowUp, src: 'followup', why: `Follow-up ${dueWords(a.nextFollowUp)}; last touch ${lt ? relDays(lt) : 'never'}`,
          btn: { act: 'log', label: 'Log', attrs: `data-id="${a.id}"` } });
      }
      if (a.revisitDate && inRange(a.revisitDate)) {
        items.push({ key: 'rv:' + a.id, type: 'visit', title: `Revisit · ${accountLabel(a)}`, sub: a.revisitNote || a.location || '', acct: a, due: a.revisitDate, src: 'revisit',
          why: `Revisit ${dueWords(a.revisitDate)}${a.revisitNote ? ': ' + a.revisitNote : ''}`, btn: { act: 'q-visit', label: 'Visited', attrs: `data-id="${a.id}"` } });
      }
      for (const k of a.keyDates) {
        if (!k.done && inRange(k.date)) items.push({ key: 'kd:' + k.id, type: 'task', title: `${k.label} · ${accountLabel(a)}`, sub: k.note || '', acct: a, due: k.date, src: 'keydate',
          why: `Key date ${dueWords(k.date)}`, btn: { act: 'keydate-done', label: 'Done', attrs: `data-id="${a.id}" data-kid="${k.id}"` } });
      }
    }
    for (const s of stayList()) {
      if (!inRange(s.next)) continue;
      items.push({ key: 'sit:' + s.c.id, type: kindToType(channelKind(s.c)), title: `Stay in touch · ${s.c.name}`, sub: `${s.c.title ? s.c.title + ' · ' : ''}${s.a.name}`,
        acct: s.a, due: s.next, src: 'stay', why: `${s.label} touch; last ${s.last ? relDays(s.last) : 'never'}`, btn: { act: 'sit-log', label: 'Log', attrs: `data-id="${s.a.id}" data-cid="${s.c.id}"` } });
    }
    for (const x of state.tasks) {
      if (x.done || x.time || !inRange(x.date)) continue;
      const a = x.accountId && getAccount(x.accountId);
      items.push({ key: 't:' + x.id, type: taskType(x), title: x.title, sub: a ? a.name : '', acct: a || null, due: x.date, src: 'task', why: taskWhy(x, a), task: x,
        btn: { act: 'edit-task', label: 'Open', attrs: `data-tid="${x.id}"` } });
    }
    routeStops(d).forEach((s, i) => {
      if (visitedRow(d, s.a) || items.some((it) => it.acct && it.acct.id === s.a.id && it.type === 'visit')) return;
      items.push({ key: 'rt:' + s.a.id, type: 'visit', title: `Visit · ${accountLabel(s.a)}`, sub: `Route stop ${i + 1}`, acct: s.a, due: d, src: 'route', why: s.why,
        btn: { act: 'q-visit', label: 'Visited', attrs: `data-id="${s.a.id}"` } });
    });
    const gOrder = { late7: 0, late: 1, today: 2, upcoming: 3 };
    const sOrder = { cadence: 0, followup: 1, revisit: 2, route: 2, stay: 3, keydate: 4, task: 5 };
    for (const it of items) {
      it.late = Math.max(0, daysBetween(it.due, t));
      it.group = !isToday ? 'today' : it.late >= 7 ? 'late7' : it.late > 0 ? 'late' : it.due === t ? 'today' : 'upcoming';
      it.tab = TAB_OF[it.type] || 'other';
    }
    return items.sort((x, y) => gOrder[x.group] - gOrder[y.group] || x.due.localeCompare(y.due) || sOrder[x.src] - sOrder[y.src]
      || (Number(y.acct && y.acct.value) || 0) - (Number(x.acct && x.acct.value) || 0));
  }
  const dueNow = (items) => items.filter((it) => it.group !== 'upcoming');
  /** Three or more people on the same cadence step in the same group become one summary row. */
  function foldQueue(items) {
    const counts = new Map();
    const keyOf = (it) => { const e = it.src === 'cadence' && state.enrollments.find((x) => x.id === it.key.slice(4)); return e ? `${e.cadenceId}|${e.step}|${it.group}` : null; };
    for (const it of items) { const k = keyOf(it); if (k) counts.set(k, (counts.get(k) || 0) + 1); }
    const out = []; const seen = new Set();
    for (const it of items) {
      const k = keyOf(it);
      if (!k || counts.get(k) < 3) { out.push(it); continue; }
      if (seen.has(k)) continue;
      seen.add(k);
      const [cadId, step] = k.split('|'); const cad = cadenceById(cadId); const n = counts.get(k);
      out.push({ fold: true, type: it.type, late: it.late, cadId, stepNo: Number(step) + 1,
        title: `${n} × ${stepType(cad.steps[Number(step)]).label}: ${cad.name} step ${Number(step) + 1}`,
        sub: cad.steps[Number(step)].title || '', why: `${n} people ${it.late ? `${plural(it.late, 'day')} overdue` : 'due'}. Work them in one session, or skip them from the queue if the cadence needs a reset.` });
    }
    return out;
  }
  const qPill = (it) => (it.src === 'cadence' ? '<span class="pill qp-cad">Cadence</span>' : it.acct ? `<span class="pill ${it.acct.type}">${it.acct.type === 'partner' ? 'Partner' : 'Prospect'}</span>` : '');

  /** Actions done on a day: logged activities (not notes) plus finished planner tasks. */
  function dayDone(d) {
    const acts = state.accounts.reduce((n, a) => n + a.activities.filter((h) => h.date === d && h.kind !== 'Note').length, 0);
    return acts + state.tasks.filter((x) => x.date === d && x.done).length;
  }
  const dailyGoal = () => Number(ui.dailyGoal) || 40;

  /** Accounts nobody has touched in 30+ days (open deals and active partners). */
  function staleAccounts() {
    const t = today();
    return state.accounts.filter((a) => !isClosedStage(a.stage) && a.stage !== 'Nurture' && a.stage !== 'Target')
      .map((a) => ({ a, lt: lastTouchDate(a) })).filter(({ lt }) => !lt || daysBetween(lt, t) >= 30)
      .sort((x, y) => (x.lt ? 1 : 0) - (y.lt ? 1 : 0) || (Number(y.a.value) || 0) - (Number(x.a.value) || 0));
  }

  /** The queue card: type tabs, goal, grouped rows with bulk actions. */
  function queueCard(d) {
    const t = today();
    const all = workQueue(d);
    const tab = QTABS[ui.qTab] ? ui.qTab : 'all';
    const shown = all.filter((it) => tab === 'all' || it.tab === tab);
    const counts = Object.fromEntries(Object.keys(QTABS).map((k) => [k, dueNow(all).filter((it) => k === 'all' || it.tab === k).length]));
    const done = dayDone(d); const goal = dailyGoal();
    const row = (it) => `
      <div class="q-row ${it.late ? 'late' : ''}">
        <input type="checkbox" data-act="q-check" data-key="${esc(it.key)}" aria-label="Done: ${esc(it.title)}">
        ${stepIcon({ type: it.type })}
        <div class="q-main"><div class="q-title">${esc(it.title)}</div><div class="q-sub">${esc(it.sub || it.why)}</div></div>
        <div class="q-acct">${it.acct ? `<a href="#account/${it.acct.id}">${esc(it.acct.name)}</a><div class="small muted">${esc(it.acct.type === 'partner' ? `${stageShort(it.acct.stage)} partner` : stageShort(it.acct.stage))}</div>` : ''}</div>
        <div class="q-due ${it.late ? 'late' : ''}">${it.late ? esc(plural(it.late, 'day') + ' overdue') : it.due === t ? 'Today' : esc(fmtDate(it.due, { weekday: 'short', month: 'short', day: 'numeric' }))}</div>
        <button class="btn sm ${it.btn.primary ? '' : 'ghost'}" data-act="${it.btn.act}" ${it.btn.attrs}>${esc(it.btn.label)}</button>
      </div>`;
    const SHOW = 6;
    const groups = Object.keys(QGROUPS).map((g) => ({ g, list: shown.filter((it) => it.group === g) })).filter((x) => x.list.length);
    return `
      <div class="card q-card">
        <div class="section-head">
          <div><h2 style="margin:0">${d === t ? "Today's queue" : `Queue · ${esc(fmtDate(d, { weekday: 'long' }))}`}</h2>
            <div class="small muted">Built from cadence steps, follow-ups, revisits, key dates, stay-in-touch reminders, tasks and route stops.</div></div>
          ${counts.all ? `<button class="btn" data-act="session-setup" data-type="${{ calls: 'call', emails: 'email', linkedin: 'linkedin' }[tab] || 'all'}">▶ Start session</button>` : ''}
        </div>
        <div class="q-tabs" role="tablist">${Object.entries(QTABS).filter(([k]) => k === 'all' || counts[k]).map(([k, l]) => `<button type="button" role="tab" class="q-tab ${tab === k ? 'active' : ''}" data-act="q-tab" data-tab="${k}">${l} <b>${counts[k]}</b></button>`).join('')}</div>
        <div class="q-goal">
          <div class="row spread small"><b>${done} complete</b><button type="button" class="link-btn small muted" data-act="q-goal" title="Change your daily goal">Goal: ${goal}</button></div>
          <div class="progress"><div style="width:${Math.min(100, Math.round((done / goal) * 100))}%"></div></div>
        </div>
        ${groups.length ? groups.map(({ g, list }) => {
          const cad = list.filter((it) => it.src === 'cadence').length;
          const open = ui.qOpen && ui.qOpen[g];
          return `<div class="q-group">
            <div class="q-ghead"><span>${QGROUPS[g]} <span class="muted">(${list.length})</span></span>
              ${g === 'late7' || g === 'late' ? `<span class="row q-bulk">
                <button type="button" class="btn sm ghost" data-act="q-bulk" data-op="snooze" data-group="${g}">Snooze all to tomorrow</button>
                ${cad ? `<button type="button" class="btn sm ghost" data-act="q-bulk" data-op="skip" data-group="${g}">Skip ${plural(cad, 'cadence step')}</button>` : ''}
              </span>` : ''}</div>
            ${list.slice(0, open ? list.length : SHOW).map(row).join('')}
            ${list.length > SHOW ? `<button type="button" class="link-btn q-more" data-act="q-more" data-group="${g}">${open ? 'Show fewer' : `Show ${list.length - SHOW} more ▾`}</button>` : ''}
          </div>`;
        }).join('') : `<div class="empty-soft">${all.length ? 'Nothing in this tab.' : 'Nothing due. Nice work: add a task, or log extra activity below.'}</div>`}
      </div>`;
  }

  /** Check a queue row: do the simple thing in place, open the form when a choice is needed. */
  function queueCheck(key) {
    const d = ui.lastView === 'planner' ? ui.plannerDate : today();
    const it = workQueue(d).find((x) => x.key === key) || workQueue(today()).find((x) => x.key === key);
    if (!it) return rerender();
    const now = new Date().toISOString(); const t = today();
    const a = it.acct;
    if (it.src === 'cadence') return logStepForm(key.slice(4));
    if (it.src === 'revisit' || it.src === 'route') return markVisited(t, a);
    if (it.src === 'followup') {
      const pc = primaryContact(a);
      a.activities.push({ id: uid(), date: t, kind: pc ? channelKind(pc) : 'Call', summary: 'Follow-up', notes: '', contactId: pc ? pc.id : '', createdAt: now });
      a.nextFollowUp = ''; touch(a); save(); rerender();
      return toast(`${a.name}: follow-up logged. Set the next one on the account.`);
    }
    if (it.src === 'keydate') {
      const k = a.keyDates.find((x) => 'kd:' + x.id === key); k.done = true;
      a.activities.push({ id: uid(), date: t, kind: 'Note', summary: `Completed: ${k.label}`, notes: k.note || '', createdAt: now });
      touch(a); save(); rerender(); return toast('Done');
    }
    if (it.src === 'stay') {
      const c = a.contacts.find((x) => 'sit:' + x.id === key);
      a.activities.push({ id: uid(), date: t, kind: channelKind(c), summary: `Stay in touch: ${c.name}`, notes: '', contactId: c.id, createdAt: now });
      touch(a); save(); rerender(); return toast(`Touch with ${c.name} logged`);
    }
    if (it.src === 'task') { it.task.done = true; save(); rerender(); return toast('Task done'); }
    return rerender();
  }

  /** Bulk snooze (to tomorrow) or skip (cadence steps) for one overdue group in the current tab. */
  function queueBulk(op, group) {
    const d = ui.plannerDate; const t = today();
    const tab = QTABS[ui.qTab] ? ui.qTab : 'all';
    const list = workQueue(d).filter((it) => it.group === group && (tab === 'all' || it.tab === tab));
    const tomorrow = addDays(t, 1);
    if (op === 'skip') {
      const cads = list.filter((it) => it.src === 'cadence');
      if (!cads.length || !confirm(`Skip ${plural(cads.length, 'cadence step')}? Each person moves on to their next step. A long list of the same step usually means the cadence needs a reset.`)) return;
      for (const it of cads) {
        const e = state.enrollments.find((x) => x.id === it.key.slice(4)); const p = enrollmentParts(e);
        if (p) { e.history.push({ stepId: p.step.id, date: t, skipped: true }); advance(p, t); }
      }
      save(); rerender(); return toast(`Skipped ${plural(cads.length, 'step')}`);
    }
    if (!confirm(`Move ${plural(list.length, 'item')} to tomorrow?`)) return;
    let n = 0;
    for (const it of list) {
      const a = it.acct;
      if (it.src === 'cadence') { const e = state.enrollments.find((x) => x.id === it.key.slice(4)); const p = enrollmentParts(e); if (p) { e.dueDate = p.cad.skipWeekends ? nextWorkday(tomorrow) : tomorrow; n++; } }
      else if (it.src === 'followup') { a.nextFollowUp = tomorrow; touch(a); n++; }
      else if (it.src === 'revisit') { a.revisitDate = tomorrow; touch(a); n++; }
      else if (it.src === 'keydate') { const k = a.keyDates.find((x) => 'kd:' + x.id === it.key); k.date = tomorrow; touch(a); n++; }
      else if (it.src === 'stay') { const c = a.contacts.find((x) => 'sit:' + x.id === it.key); c.sitSnooze = tomorrow; touch(a); n++; }
      else if (it.src === 'task') { it.task.date = tomorrow; n++; }
    }
    save(); rerender(); toast(`Moved ${plural(n, 'item')} to tomorrow`);
  }

  /** Stale accounts, one line each, minus anything already in today's queue. */
  function staleCard(d) {
    const inQueue = new Set(workQueue(d).map((it) => it.acct && it.acct.id).filter(Boolean));
    const list = staleAccounts().filter(({ a }) => !inQueue.has(a.id));
    const SHOW = 8;
    return `<div class="card">
      <div class="row spread"><h3 style="margin:0">Stale accounts</h3><span class="small muted">${list.length}</span></div>
      <div class="small muted" style="margin:.15rem 0 .4rem">No touch in 30+ days and nothing scheduled. One line each.</div>
      ${list.length ? `<ul class="list stale-list">${list.slice(0, ui.staleAll ? list.length : SHOW).map(({ a, lt }) => `<li>
        <div class="grow"><a class="title" href="#account/${a.id}">${esc(a.name)}</a> <span class="small muted">· ${esc(a.type === 'partner' ? (a.partnerType || 'Partner') : stageShort(a.stage))} · ${lt ? esc(relDays(lt)) : 'never'}</span></div>
        <button class="btn sm ghost" data-act="log" data-id="${a.id}">Log</button>
      </li>`).join('')}</ul>${list.length > SHOW ? `<button type="button" class="link-btn small" data-act="stale-all">${ui.staleAll ? 'Show fewer' : `Show ${list.length - SHOW} more`}</button>` : ''}`
        : '<div class="empty">Every open account has a recent touch or a next step.</div>'}
    </div>`;
  }

  // ---------- planner (day) ----------
  function renderPlanner() {
    if (ui.calMode === 'week') return renderWeek();
    const d = ui.plannerDate;
    const t = today();
    const day = getDay(d);
    const items = workQueue(d);
    const overdue = items.filter((it) => it.late > 0).length;
    const done = dayDone(d);
    const tasks = state.tasks.filter((x) => x.date === d);
    const plan = getPlan(d);
    const extraLogged = PLAN_SECTIONS.reduce((n, sec) => n + plan[sec.key].filter((r) => r.done).length, 0);
    const wk = (n) => fmtDate(addDays(d, n), { weekday: 'short' });

    $('#view').innerHTML = `
      <div class="planner-head">
        <div>
          <h1 style="margin:0">${esc(fmtLongDate(d))}</h1>
          <div class="muted">${d === t ? 'Today' : esc(relDays(d))} · ${done} of ${dailyGoal()} actions done${overdue ? ` · <span class="q-late">${overdue} overdue</span>` : ''}</div>
        </div>
        <div class="row">
          ${calModeSwitch()}
          <button class="btn ghost" data-act="day-shift" data-n="-1" title="Previous day">‹ ${esc(wk(-1))}</button>
          <input type="date" id="planner-date" value="${d}" aria-label="Date">
          <button class="btn ghost" data-act="day-shift" data-n="1" title="Next day">${esc(wk(1))} ›</button>
          ${d !== t ? '<button class="btn ghost" data-act="day-today">Today</button>' : ''}
          <button class="btn" data-act="new-task" data-date="${d}">+ Task</button>
        </div>
      </div>

      <div class="pl2">
        <div class="pl-main stack">
          ${queueCard(d)}
          <details class="card extra-card" id="extra-card" ${ui.extraOpen ? 'open' : ''}>
            <summary><span><b>Extra activity</b> <span class="muted">${extraLogged} logged</span></span>
              <span class="small muted extra-sub">Anything the queue didn't generate: cold calls, drop-ins, new names.</span></summary>
            ${planSection(d)}
          </details>
        </div>

        <div class="pl-side stack">
          <div class="card priorities">
            <h3>Top 3 priorities</h3>
            ${[0, 1, 2].map((i) => `<input data-prio="${i}" placeholder="Priority ${i + 1}" value="${esc(day.priorities[i] || '')}">`).join('')}
          </div>
          <div class="card sched-col">
            <div class="row spread" style="margin-bottom:.5rem">
              <h3 style="margin:0">Schedule</h3>
              <div class="row"><a class="btn sm ghost" href="#map/route/${d}">Plan route</a></div>
            </div>
            ${calLegend()}
            ${calendarGrid([d], false, { noDue: true })}
          </div>
          ${staleCard(d)}
          <div class="card">
            <h3>Day notes</h3>
            <textarea id="day-notes" rows="5" placeholder="Wins, blockers, ideas, things to remember…">${esc(day.notes)}</textarea>
          </div>
          ${tasks.some((x) => !x.done) ? `<button class="btn ghost" data-act="carry-over" style="width:100%">Move unfinished tasks to ${esc(fmtDate(addDays(d, 1), { weekday: 'short', month: 'short', day: 'numeric' }))}</button>` : ''}
        </div>
      </div>`;

    $('#planner-date').addEventListener('change', (e) => { if (e.target.value) location.hash = `planner/${e.target.value}`; });
    $$('[data-prio]').forEach((inp) => inp.addEventListener('input', (e) => {
      const dd = { ...getDay(d) };
      dd.priorities = [...dd.priorities];
      dd.priorities[Number(e.target.dataset.prio)] = e.target.value;
      state.days[d] = dd; save();
    }));
    $('#day-notes').addEventListener('input', (e) => { state.days[d] = { ...getDay(d), notes: e.target.value }; save(); });
    $('#extra-card').addEventListener('toggle', (e) => { ui.extraOpen = e.target.open; savePrefs(); });
    bindPlan(d);
    bindCalendar();
  }

  // ---------- dashboard ----------
  function renderDashboard() {
    trackViews();
    const t = today();
    const items = workQueue(t);
    const now = dueNow(items);
    const overdue = now.filter((it) => it.late > 0).length;
    const partners = state.accounts.filter((a) => a.type === 'partner');
    const prospects = state.accounts.filter((a) => a.type === 'prospect');
    const openDeals = prospects.filter(isOpenDeal);
    const openPipeline = openDeals.reduce((s, a) => s + (Number(a.value) || 0), 0);
    const stale = staleAccounts();
    const done = dayDone(t); const goal = dailyGoal();
    const bySrc = (s) => now.filter((it) => it.src === s).length;
    const byTab = (k) => now.filter((it) => it.tab === k).length;
    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
    const recent = state.accounts.flatMap((a) => a.activities.map((h) => ({ ...h, account: a })))
      .sort((x, y) => y.date.localeCompare(x.date) || (y.createdAt || '').localeCompare(x.createdAt || '')).slice(0, 6);
    const sitSoon = stayList().filter((x) => daysBetween(t, x.next) <= 7).slice(0, 5);
    const kpi = (href, label, value, sub) => `<a class="card kpi-card" href="${href}"><span class="kpi-label">${label}</span><div class="kpi-value">${value}</div><div class="kpi-sub">${sub}</div></a>`;
    const dueBits = [bySrc('cadence') && plural(bySrc('cadence'), 'cadence step'), bySrc('followup') && plural(bySrc('followup'), 'follow-up'),
      (bySrc('revisit') + bySrc('route')) && plural(bySrc('revisit') + bySrc('route'), 'visit'), (bySrc('task') + bySrc('keydate') + bySrc('stay')) && plural(bySrc('task') + bySrc('keydate') + bySrc('stay'), 'other item')].filter(Boolean);

    // Priority accounts: open deals and active partners, weighted by value and time since the last touch.
    const maxV = Math.max(1, ...state.accounts.map((a) => Number(a.value) || 0));
    const nextStepOf = (a) => {
      if (a.nextFollowUp) return a.nextFollowUp < t ? `Follow-up ${plural(daysBetween(a.nextFollowUp, t), 'day')} overdue` : `Follow up ${relDays(a.nextFollowUp)}`;
      const task = state.tasks.filter((x) => x.accountId === a.id && !x.done).sort((x, y) => x.date.localeCompare(y.date))[0];
      if (task) return task.title;
      const p = liveEnrollments().find((q) => q.acct.id === a.id && q.e.status === 'active');
      if (p) return `${stepType(p.step).label}: ${p.step.title || p.cad.name}`;
      return '';
    };
    const prio = state.accounts.filter((a) => isOpenDeal(a) || (a.type === 'partner' && ['Engaged', 'Met', 'Committed', 'Producing', 'Dormant'].includes(a.stage)))
      .map((a) => { const lt = lastTouchDate(a); const age = lt ? daysBetween(lt, t) : 90; return { a, lt, score: ((Number(a.value) || 0) / maxV) * 0.55 + (Math.min(age, 60) / 60) * 0.45, open: items.filter((it) => it.acct && it.acct.id === a.id).length }; })
      .sort((x, y) => y.score - x.score).slice(0, 8);

    $('#view').innerHTML = `
      <div class="ov-head">
        <div>
          <h1 class="greeting">${greeting}<span class="brand-dot">.</span></h1>
          <div class="muted">${esc(fmtLongDate(t))}</div>
        </div>
        <div class="row ov-actions">${dashSwitch('today')}<button class="btn" data-act="new-account">+ Add account</button></div>
      </div>
      ${!state.accounts.length ? `<div class="card welcome stack" style="margin-bottom:1rem">
        <h2 style="margin:0">Welcome to Bbars OS</h2>
        <p class="muted" style="margin:0">Add your first account, import a spreadsheet, or load sample data to look around.</p>
        <div class="row"><button class="btn" data-act="new-account">+ Add account</button><button class="btn ghost" data-act="import-csv">Import a spreadsheet</button><button class="btn ghost" data-act="load-sample">Load sample data</button></div>
      </div>` : ''}
      <div class="kpi-grid4">
        ${kpi('#accounts', 'Total accounts', state.accounts.length, `${plural(prospects.length, 'prospect')} · ${plural(partners.length, 'partner')}`)}
        ${kpi('#accounts', 'Open pipeline', money(openPipeline), plural(openDeals.length, 'open opportunity', 'open opportunities'))}
        ${kpi(`#planner/${t}`, 'Everything due', now.length, `${overdue ? `<span class="pill overdue">${overdue} overdue</span> ` : ''}${esc(dueBits.join(' · ')) || 'Nothing due'}`)}
        ${kpi('#accounts', 'Stale accounts', stale.length, 'no touch in 30+ days')}
      </div>
      ${pinnedViewsStrip()}
      <div class="ov2">
        <div class="stack">
          <div class="card">
            <div class="section-head"><div><h2 style="margin:0">Priority tasks</h2><div class="small muted">One ranked list from your cadences, follow-ups, visits and reminders.</div></div>
              <div class="small"><b>${now.length}</b> due${overdue ? ` · <span class="q-late">${overdue} overdue</span>` : ''}</div></div>
            ${items.length ? `<div class="pt2">
              <div class="pt2-row pt2-th"><span></span><span>Action</span><span>Why it's here</span><span>Type</span><span></span></div>
              ${foldQueue(items).slice(0, 8).map((it) => it.fold ? `<div class="pt2-row late fold">
                ${stepIcon({ type: it.type })}
                <div class="pt2-act"><div class="q-title">${esc(it.title)}</div><div class="small muted">${esc(it.sub)}</div></div>
                <div class="pt2-why ${it.late ? 'q-late' : ''}">${esc(it.why)}</div>
                <div><span class="pill qp-cad">Cadence</span></div>
                <button class="btn sm" data-act="session-setup" data-cad="${it.cadId}" data-step="${it.stepNo}" data-type="${it.type}">Work them</button>
              </div>` : `<div class="pt2-row ${it.late ? 'late' : ''}">
                ${stepIcon({ type: it.type })}
                <div class="pt2-act"><div class="q-title">${esc(it.title)}</div>${it.acct && !it.title.includes(it.acct.name) ? `<div class="small muted"><a href="#account/${it.acct.id}">${esc(it.acct.name)}</a></div>` : ''}</div>
                <div class="pt2-why ${it.late ? 'q-late' : ''}">${esc(it.why)}</div>
                <div>${qPill(it)}</div>
                <button class="btn sm ${it.btn.primary ? '' : 'ghost'}" data-act="${it.btn.act}" ${it.btn.attrs}>${esc(it.btn.label)}</button>
              </div>`).join('')}
            </div><a class="small link-arrow" href="#planner/${t}">Open today's queue →</a>`
              : '<div class="empty-soft">Nothing due. Your queue fills itself from cadences, follow-ups, revisits and reminders.</div>'}
          </div>
          <div class="card">
            <div class="section-head"><div><h2 style="margin:0">Priority accounts</h2><div class="small muted">Open deals and active partners, ranked by value and time since the last touch.</div></div><a class="btn sm ghost" href="#accounts">View all accounts</a></div>
            ${prio.length ? `<div class="pa-table">
              <div class="pa-row pa-th"><span>Account</span><span>Stage</span><span>Value</span><span>Last touch</span><span>Next step</span><span>Open</span></div>
              ${prio.map(({ a, lt, open }) => { const ns = nextStepOf(a); const old = !lt || daysBetween(lt, t) > 14; return `<div class="pa-row">
                <a class="title" href="#account/${a.id}">${esc(a.name)}</a>
                <span class="small">${esc(a.type === 'partner' ? `${a.stage} partner` : stageShort(a.stage))}</span>
                <span>${a.value ? money(a.value) : '<span class="muted">—</span>'}</span>
                <span class="${old ? 'q-late' : ''}">${lt ? esc(relDays(lt)) : 'never'}</span>
                <span class="small ${!ns || /overdue/.test(ns) ? 'q-late' : ''}">${ns ? esc(ns) : 'No next step'}</span>
                <a class="btn sm ghost" href="#account/${a.id}" title="${plural(open, 'open action')}">▶ ${open}</a>
              </div>`; }).join('')}
            </div>` : '<div class="empty">No open deals or active partners yet.</div>'}
          </div>
        </div>
        <div class="stack">
          <div class="card today-card">
            <h2 style="margin:0">Today</h2>
            <div class="small muted">Counts come from your data, not blank rows.</div>
            <div class="today-counts">
              ${[['calls', 'Calls due'], ['emails', 'Emails due'], ['linkedin', 'LinkedIn'], ['visits', 'Visits']].map(([k, l]) => `<a class="today-count" href="#planner/${t}" data-act="q-tab" data-tab="${k}" data-go="1"><b>${byTab(k)}</b><span>${l}</span></a>`).join('')}
            </div>
            ${byTab('other') ? `<div class="small muted">${plural(byTab('other'), 'other item')}: tasks, key dates and reminders</div>` : ''}
            <div class="q-goal">
              <div class="row spread small"><b>${done} complete</b><button type="button" class="link-btn small muted" data-act="q-goal">Goal: ${goal} actions today</button></div>
              <div class="progress"><div style="width:${Math.min(100, Math.round((done / goal) * 100))}%"></div></div>
            </div>
            <div class="row">
              ${byTab('calls') ? '<button class="btn" data-act="session-setup" data-type="call">▶ Start call session</button>' : now.length ? '<button class="btn" data-act="session-setup" data-type="all">▶ Start session</button>' : ''}
              <a class="btn ghost" href="#planner/${t}">Open daily planner</a>
            </div>
          </div>
          ${sitSoon.length ? `<div class="card">
            <div class="section-head"><h2 style="margin:0">Stay in touch</h2><a class="small link-arrow" href="#contacts/stay">All →</a></div>
            ${stayRowsHtml(sitSoon)}
          </div>` : ''}
          <div class="card">
            <h2 style="margin:0 0 .5rem">Recent activity</h2>
            ${recent.length ? `<ul class="feed">${recent.map((r) => `<li>
              <div class="grow"><div class="title">${esc(r.summary)}</div><div class="small muted"><a href="#account/${r.account.id}">${esc(r.account.name)}</a> · ${esc(r.kind)}</div></div>
              <span class="small muted nowrap">${esc(relDays(r.date))}</span>
            </li>`).join('')}</ul>` : '<div class="empty">No activity logged yet.</div>'}
          </div>
        </div>
      </div>
      <footer class="ov-foot small muted"><span>Made for meaningful connections.</span><span>Bbars OS ✦ A little more organized.</span></footer>`;
  }

  // ---------- routing ----------
  const views = { dashboard: renderDashboard, accounts: renderAccounts, account: renderAccountRecord, planner: renderPlanner, lists: renderLists, cadences: renderCadences, map: renderMap, report: renderReport, research: renderResearch, contacts: renderContacts, session: renderSession, partners: renderPartners };
  const TAB_FOR = { account: 'accounts', report: 'dashboard', session: 'cadences', lists: 'accounts' };

  function route() {
    let [name, arg] = location.hash.replace('#', '').split('/');
    if (name === 'accounts' && arg) name = 'account'; // older links to an account record
    const view = views[name] ? name : 'dashboard';
    if (view === 'account') { if (ui.recordId !== arg) ui.partnerTab = 'overview'; ui.recordId = arg; }
    if (ui.rulesDay !== today()) { ui.rulesDay = today(); if (runPartnerRules()) save(); } // quiet-partner check, once a day
    if (view === 'planner' && arg && /^\d{4}-\d{2}-\d{2}$/.test(arg)) ui.plannerDate = arg;
    if (view === 'lists' && arg) ui.listId = decodeURIComponent(arg);
    if (view === 'cadences' && arg) ui.cadenceId = arg;
    if (view === 'contacts' && arg && CONTACT_FILTERS[arg]) { ui.contactFilter = arg; ui.contactLimit = 200; }
    if (view === 'research' && arg && getAccount(arg)) {
      Object.assign(research, { target: getAccount(arg).name, targetId: arg, hint: '', list: '' }); saveResearch();
    }
    if (view === 'report') ui.reportWeek = weekStart(/^\d{4}-\d{2}-\d{2}$/.test(arg || '') ? arg : today());
    if (view === 'map') {
      const parts = location.hash.split('/');
      ui.mapMode = parts[1] === 'route' ? 'route' : 'accounts';
      if (ui.mapMode === 'route') ui.routeDate = /^\d{4}-\d{2}-\d{2}$/.test(parts[2] || '') ? parts[2] : (ui.routeDate || today());
    } else if (mapState.map) unmountMap(false);
    if (ui.lastView !== view) ui.showAll = false;
    ui.lastView = view;
    $$('#tabs a').forEach((a) => {
      const tabFor = view === 'account' && (getAccount(ui.recordId) || {}).type === 'partner' ? 'partners' : (TAB_FOR[view] || view);
      a.classList.toggle('active', a.dataset.view === tabFor);
      a.classList.toggle('alt-active', ['contacts', 'partners'].includes(view) && a.dataset.view === 'accounts'); // phone tab bar has no Contacts / Partners tab
    });
    updateChrome(view);
    views[view]();
    if (ui.focusContact) { // jump to a contact card after opening its account
      const cid = ui.focusContact; ui.focusContact = null;
      setTimeout(() => {
        const el = $(`[data-contact="${cid}"]`);
        if (el) { el.scrollIntoView({ block: 'center' }); el.classList.add('flash'); }
      }, 0);
    }
  }
  const rerender = () => route();
  const CRUMBS = { dashboard: 'Overview', accounts: 'Accounts', account: 'Account', contacts: 'Contacts', partners: 'Partners', session: 'Session', planner: 'Daily planner', map: 'Map', lists: 'Lists', cadences: 'Cadences', report: 'Weekly report', research: 'Ask Claude' };
  /** Breadcrumb and sidebar counts. */
  function updateChrome(view) {
    $('#crumb-page').textContent = CRUMBS[view] || 'Overview';
    updateCounts();
  }
  function updateCounts() {
    $('#nc-accounts').textContent = state.accounts.length || '';
    const due = dueSteps(today()).length;
    $('#nc-cadences').textContent = due ? `${due} due` : '';
    const sit = stayDue().length;
    $('#nc-contacts').textContent = sit ? `${sit} due` : '';
  }
  const go = (hash) => { if (location.hash === '#' + hash) rerender(); else location.hash = hash; };
  window.addEventListener('hashchange', () => { if (!booted) return; ui.navs++; route(); window.scrollTo(0, 0); });

  // ---------- dashboard ----------
  /** Remove every record. Tombstones carry the erase to other synced devices. */
  function eraseAll() {
    const typed = prompt(
      `This permanently deletes all ${state.accounts.length} accounts, tasks, planner days, lists and cadences` +
      `${cloudOn() ? ' on this device AND every synced device' : ' on this device'}.\n\nExport a backup first if you might need it.\n\nType DELETE to confirm.`);
    if ((typed || '').trim().toUpperCase() !== 'DELETE') { if (typed !== null) toast('Nothing was deleted'); return; }
    state.accounts = []; state.tasks = []; state.lists = []; state.days = {}; state.cadences = []; state.enrollments = []; state.flows = []; state.compPlans = defaultCompPlans(); state.categories = defaultCategories();
    ui.listId = null;
    research = { target: '', hint: '', list: '', flows: ['hq', 'dm', 'hr'], custom: '', pasted: '' }; saveResearch();
    session = null; saveSession();
    save(); toast('All data erased'); go('dashboard');
  }


  // ---------- accounts ----------
  const FAR = '9999-12-31';
  const stageIndex = (a) => STAGES[a.type].indexOf(a.stage) + (a.type === 'partner' ? 100 : 0);
  const SORTERS = {
    name: (x, y) => x.name.localeCompare(y.name),
    location: (x, y) => (x.location || '~').localeCompare(y.location || '~'),
    stage: (x, y) => stageIndex(x) - stageIndex(y),
    value: (x, y) => (Number(y.value) || 0) - (Number(x.value) || 0),
    followup: (x, y) => (x.nextFollowUp || FAR).localeCompare(y.nextFollowUp || FAR),
    revisit: (x, y) => (x.revisitDate || FAR).localeCompare(y.revisitDate || FAR),
    renewal: (x, y) => (x.vendorRenewal || FAR).localeCompare(y.vendorRenewal || FAR),
    close: (x, y) => (x.closeDate || FAR).localeCompare(y.closeDate || FAR),
    lasttouch: (x, y) => lastTouchDate(y).localeCompare(lastTouchDate(x)),
    employees: (x, y) => (Number(y.employees) || 0) - (Number(x.employees) || 0),
    instage: (x, y) => daysInStage(y) - daysInStage(x),
    next: (x, y) => ((nextStepOf(x) || {}).date || FAR).localeCompare((nextStepOf(y) || {}).date || FAR),
    updated: (x, y) => (y.updatedAt || '').localeCompare(x.updatedAt || ''),
  };
  const SORT_LABELS = { close: 'Expected close', followup: 'Next follow-up', revisit: 'Next revisit', renewal: 'Vendor renewal', name: 'Name', location: 'Location', stage: 'Stage', value: 'Value', lasttouch: 'Last touch', instage: 'Days in stage', next: 'Next step', employees: 'Employees', updated: 'Recently updated' };
  const sortAccounts = (list) => list.sort((x, y) => SORTERS[ui.sort](x, y) * ui.sortDir || x.name.localeCompare(y.name));

  function filteredAccounts() {
    const q = ui.search.trim().toLowerCase();
    const view = ui.viewId && ui.viewId !== 'scoreboard' ? resolveList(ui.viewId) : null;
    return sortAccounts(state.accounts.filter((a) => {
      if (view && !listHas(view, a)) return false;
      if (ui.typeFilter !== 'all' && a.type !== ui.typeFilter) return false;
      if (ui.stageFilter !== 'all' && a.stage !== ui.stageFilter) return false;
      if (ui.vendorFilter !== 'all' && !a.vendors.includes(ui.vendorFilter)) return false;
      if (ui.partnerTypeFilter && ui.partnerTypeFilter !== 'all' && !(a.type === 'partner' && a.partnerType === ui.partnerTypeFilter)) return false;
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

  function accountCards(list) {
    return `<div class="acard-grid">${list.map((a) => {
      const p = primaryContact(a);
      return `
        <div class="acard" role="link" tabindex="0" data-act="open-account" data-id="${a.id}">
          <div class="row spread"><span class="row" style="gap:.35rem"><strong class="acard-name">${esc(a.name)}</strong>${accountLinks(a)}</span>${typePill(a)}</div>
          <div class="small muted">${esc(a.stage)}${a.type === 'partner' && a.partnerType ? ' · ' + esc(a.partnerType) : ''}${a.value ? ' · ' + money(a.value) : ''}${a.industry ? ' · ' + esc(a.industry) : ''}</div>
          ${a.location ? `<div class="small acard-loc">📍 ${esc(a.location)}</div>` : ''}
          ${p ? `<div class="small">${esc(p.name)}${p.title ? ` <span class="muted">· ${esc(p.title)}</span>` : ''}${a.contacts.length > 1 ? ` <span class="muted">+${a.contacts.length - 1}</span>` : ''}</div>` : ''}
          ${a.vendors.length ? `<div class="row">${vendorPills(a)}</div>` : ''}
          <div class="acard-dates small">
            ${a.closeDate ? `<span>Close ${dueChip(a.closeDate)}</span>` : ''}
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
                    ${a.location ? `<div class="small muted">📍 ${esc(a.location)}</div>` : ''}
                    ${p ? `<div class="small muted">${esc(p.name)}</div>` : ''}
                    ${a.vendors.length ? `<div class="small">${esc(a.vendors.join(', '))}</div>` : ''}
                    <div class="row small" style="margin-top:.3rem">${a.value ? `<span>${money(a.value)}</span>` : ''}${a.closeDate ? `<span class="muted">Close</span> ${dueChip(a.closeDate)}` : a.nextFollowUp ? dueChip(a.nextFollowUp) : ''}</div>
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
    if (a.channelPartnerId) partnerUpdateTask(a, to); // rule 3
    setTimeout(() => afterStageChange(a, to), 80); // once the current dialog has closed
  }

  /** The next step a stage implies: a revisit date for Revisit, stopping outreach for closed accounts. */
  function afterStageChange(a, to) {
    if (!getAccount(a.id) || a.stage !== to) return;
    const running = liveEnrollments().filter((p) => p.acct.id === a.id && p.e.status !== 'finished');
    if (isClosedStage(to) && running.length) {
      const names = [...new Set(running.map((p) => p.contact.name))].join(', ');
      if (confirm(`${a.name} is now ${to}. Stop ${plural(running.length, 'cadence')} for ${names}?`)) {
        const outcome = to === 'Closed Won' ? 'meeting' : to === 'Closed Lost' ? 'notinterested' : 'notinterested';
        running.forEach((p) => finishEnrollment(p.e, outcome));
        save(); rerender(); toast(`Stopped ${plural(running.length, 'cadence')}`);
      }
      return;
    }
    if (to === 'Revisit' && !a.revisitDate && !modal.open) revisitDateForm(a);
  }

  function revisitDateForm(acct) {
    const d = today();
    openModal(`When should you revisit ${acct.name}?`, `
      <p class="small muted" style="margin:0">The revisit lands in your planner's Revisits that day.</p>
      <div class="row">${[14, 30, 60, 90].map((n) => `<button type="button" class="btn sm ghost" data-days="${n}">${n} days</button>`).join('')}</div>
      <div class="grid-2">
        ${field('Revisit date', `<input name="revisitDate" type="date" value="${addDays(d, 30)}">`)}
        ${field('Purpose (optional)', `<input name="revisitNote" value="${esc(acct.revisitNote)}" placeholder="e.g. Check in before renewal">`)}
      </div>`, (data) => {
      acct.revisitDate = data.revisitDate; acct.revisitNote = data.revisitNote; touch(acct);
      if (data.revisitDate) toast(`Revisit set for ${fmtDate(data.revisitDate, { month: 'short', day: 'numeric' })}`);
    }, 'Set revisit');
    $$('[data-days]', modalForm).forEach((b) => b.addEventListener('click', () => {
      $('[name=revisitDate]', modalForm).value = addDays(d, Number(b.dataset.days));
    }));
    $('.modal-actions [data-close]', modalForm).textContent = 'Not now';
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

  // ----- staleness: days in stage and the next step, derived from what's already logged -----
  /** The day an account entered its current stage: its last "Stage changed: … → X" note, else when it was added. */
  function stageSince(a) {
    let d = '';
    for (const h of a.activities) {
      const m = /^Stage changed: .* → (.+)$/.exec(h.summary || '');
      if (m && m[1] === a.stage && h.date > d) d = h.date;
    }
    return d || (a.createdAt || '').slice(0, 10) || today();
  }
  const daysInStage = (a) => Math.max(0, daysBetween(stageSince(a), today()));
  const isLive = (a) => (a.type === 'partner' ? a.stage !== 'Closed' : isOpenDeal(a));
  /** The soonest planned thing for an account: a task, follow-up, revisit or cadence step. */
  function nextStepOf(a) {
    const c = [];
    for (const x of state.tasks) if (x.accountId === a.id && !x.done) c.push({ date: x.date, label: x.title });
    if (a.nextFollowUp) c.push({ date: a.nextFollowUp, label: 'Follow up' });
    if (a.revisitDate) c.push({ date: a.revisitDate, label: 'Revisit' });
    for (const e of state.enrollments) {
      if (e.accountId !== a.id || e.status !== 'active') continue;
      const cad = cadenceById(e.cadenceId);
      const s = cad && cad.steps[Math.min(e.step, cad.steps.length - 1)];
      if (s) c.push({ date: e.dueDate, label: `${cad.name}: ${s.title || stepType(s).label}` });
    }
    return c.sort((x, y) => x.date.localeCompare(y.date))[0] || null;
  }
  const inCadence = (a) => state.enrollments.some((e) => e.accountId === a.id && e.status !== 'finished');
  const STALE_TOUCH = 30;
  const STALE_STAGE = 21;

  // ----- table columns (pick your own) -----
  const ACCT_COLS = {
    type: 'Type', stage: 'Stage', value: 'Value', employees: 'Employees', vendor: 'Current vendor', renewal: 'Renewal',
    touch: 'Last touch', instage: 'In stage', next: 'Next step', followup: 'Follow-up', contact: 'Primary contact',
    location: 'Location', close: 'Close', revisit: 'Revisit', industry: 'Industry', source: 'Lead source', tags: 'Tags',
  };
  const COL_SORT = { stage: 'stage', value: 'value', employees: 'employees', renewal: 'renewal', touch: 'lasttouch', instage: 'instage', next: 'next', followup: 'followup', location: 'location', close: 'close', revisit: 'revisit' };
  const DEFAULT_COLS = ['type', 'stage', 'value', 'employees', 'vendor', 'renewal', 'touch', 'instage', 'next', 'followup', 'location'];
  const acctCols = () => (Array.isArray(ui.acctCols) && ui.acctCols.length ? ui.acctCols.filter((k) => ACCT_COLS[k]) : DEFAULT_COLS);

  function columnsForm() {
    const on = new Set(acctCols());
    openModal('Columns', `
      <p class="small muted" style="margin:0">Pick what the accounts table shows. Account name is always first; click any header to sort.</p>
      <div class="check-grid cols-grid">${Object.entries(ACCT_COLS).map(([k, l]) => `<label><input type="checkbox" name="cols" value="${k}" ${on.has(k) ? 'checked' : ''}> ${esc(l)}</label>`).join('')}</div>
      <button type="button" class="link-btn small" id="cols-reset">Back to the default columns</button>`, (data, fd) => {
      const picked = Object.keys(ACCT_COLS).filter((k) => fd.getAll('cols').includes(k));
      ui.acctCols = picked.length ? picked : DEFAULT_COLS; savePrefs();
    }, 'Show columns');
    $('#cols-reset').addEventListener('click', () => { $$('[name=cols]', modalForm).forEach((cb) => { cb.checked = DEFAULT_COLS.includes(cb.value); }); });
  }

  function accountTable(list) {
    const cols = acctCols();
    const sel = ui.acctSel || new Set();
    const t = today();
    const th = (k) => COL_SORT[k]
      ? `<th><button type="button" class="th-sort ${ui.sort === COL_SORT[k] ? 'on' : ''}" data-act="sort" data-key="${COL_SORT[k]}">${ACCT_COLS[k]}${ui.sort === COL_SORT[k] ? (ui.sortDir > 0 ? ' ▲' : ' ▼') : ''}</button></th>`
      : `<th>${ACCT_COLS[k]}</th>`;
    const muted = '<span class="muted">—</span>';
    const view = ui.viewId && resolveList(ui.viewId);
    const fresh = view && !view.builtIn ? newInView(view) : null;
    const cell = (a, k) => {
      const live = isLive(a);
      switch (k) {
        case 'type': return `<td>${typePill(a)}</td>`;
        case 'stage': return `<td><select class="cell-edit" data-inline="stage" data-id="${a.id}" aria-label="Stage for ${esc(a.name)}" title="${esc(STAGE_HINTS[a.stage] || '')}">${STAGES[a.type].map((s) => opt(s, stageShort(s), a.stage)).join('')}</select>${a.type === 'partner' && a.partnerType ? `<div class="small muted">${esc(a.partnerType)}</div>` : ''}</td>`;
        case 'value': return `<td class="num"><input class="cell-edit cell-num" data-inline="value" data-id="${a.id}" type="text" inputmode="numeric" value="${a.value ? esc(money(a.value)) : ''}" placeholder="—" aria-label="Value for ${esc(a.name)}"></td>`;
        case 'employees': return `<td class="num">${a.employees ? esc(a.employees) : muted}</td>`;
        case 'vendor': return `<td>${vendorPills(a) || muted}</td>`;
        case 'renewal': return `<td>${a.vendorRenewal ? `<span class="small ${daysBetween(t, a.vendorRenewal) >= 0 && daysBetween(t, a.vendorRenewal) <= 90 ? 'cell-warn' : ''}">${fmtDate(a.vendorRenewal, { month: 'short', day: 'numeric', year: '2-digit' })}</span>` : muted}</td>`;
        case 'touch': { const d = lastTouchDate(a); const late = live && (!d || daysBetween(d, t) > STALE_TOUCH); return `<td class="small ${late ? 'cell-bad' : ''}">${d ? `${daysBetween(d, t)} d` : 'never'}</td>`; }
        case 'instage': { const n = daysInStage(a); return `<td class="small ${live && n >= STALE_STAGE ? 'cell-bad' : ''}" title="Since ${esc(fmtDate(stageSince(a)))}">${n} d</td>`; }
        case 'next': { const ns = nextStepOf(a); return `<td class="small cell-next ${ns && ns.date < t ? 'cell-bad' : !ns && live ? 'cell-bad' : ''}">${ns ? `${esc(ns.label)} · ${esc(ns.date === t ? 'today' : shortDate(ns.date))}` : live ? 'No next step' : muted}</td>`; }
        case 'followup': return `<td><input class="cell-edit cell-date ${a.nextFollowUp && a.nextFollowUp < t ? 'late' : ''}" data-inline="nextFollowUp" data-id="${a.id}" type="date" value="${esc(a.nextFollowUp || '')}" aria-label="Follow-up for ${esc(a.name)}"></td>`;
        case 'contact': { const p = primaryContact(a); return `<td>${p ? `${esc(p.name)}${p.title ? `<div class="small muted">${esc(p.title)}</div>` : ''}` : muted}</td>`; }
        case 'location': return `<td class="loc-cell">${a.location ? esc(a.location) : muted}</td>`;
        case 'close': return `<td>${dueChip(a.closeDate)}</td>`;
        case 'revisit': return `<td>${dueChip(a.revisitDate)}</td>`;
        case 'industry': return `<td class="small">${a.industry ? esc(a.industry) : muted}</td>`;
        case 'source': return `<td class="small">${a.leadSource ? esc(a.leadSource) : muted}</td>`;
        case 'tags': return `<td class="small">${tagList(a).map((x) => '#' + esc(x)).join(' ') || muted}</td>`;
        default: return '<td></td>';
      }
    };
    return `
      <div class="card table-card">
        <div class="table-wrap">
          <table class="table acct-table">
            <thead><tr><th class="pick-col"><input type="checkbox" class="row-pick" id="pick-all" aria-label="Select all shown" ${list.length && list.every((a) => sel.has(a.id)) ? 'checked' : ''}></th><th><button type="button" class="th-sort ${ui.sort === 'name' ? 'on' : ''}" data-act="sort" data-key="name">Account${ui.sort === 'name' ? (ui.sortDir > 0 ? ' ▲' : ' ▼') : ''}</button></th>${cols.map(th).join('')}</tr></thead>
            <tbody>${list.map((a) => `<tr class="click-row ${sel.has(a.id) ? 'picked' : ''}" data-act="open-account" data-id="${a.id}">
                <td class="pick-col"><input type="checkbox" class="row-pick" data-id="${a.id}" ${sel.has(a.id) ? 'checked' : ''} aria-label="Select ${esc(a.name)}"></td>
                <td class="sticky-col"><strong>${esc(a.name)}</strong>${fresh && fresh.has(a.id) ? ' <span class="pill new-pill">New</span>' : ''}<div class="row" style="gap:.35rem">${cols.includes('type') ? '' : typePill(a)}${accountLinks(a)}</div></td>
                ${cols.map((k) => cell(a, k)).join('')}
              </tr>`).join('')}</tbody>
          </table>
        </div>
        <div class="table-foot small muted"><span>Red: no touch in ${STALE_TOUCH}+ days, ${STALE_STAGE}+ days in stage, or no next step on an open deal.</span><button type="button" class="link-btn small" data-act="acct-cols">Columns</button></div>
      </div>`;
  }

  /** Inline edits from the table: stage, value, follow-up. */
  function inlineEdit(el) {
    const a = getAccount(el.dataset.id);
    if (!a) return;
    const k = el.dataset.inline;
    if (k === 'stage') { moveStage(a.id, el.value); return; }
    if (k === 'value') {
      const n = Number(String(el.value).replace(/[^\d.]/g, ''));
      a.value = n || ''; touch(a); save(); el.value = a.value ? money(a.value) : '';
      toast(`${a.name}: value ${a.value ? money(a.value) : 'cleared'}`); return;
    }
    if (k === 'nextFollowUp') { a.nextFollowUp = el.value; touch(a); save(); rerender(); toast(el.value ? `${a.name}: follow up ${fmtDate(el.value, { weekday: 'short', month: 'short', day: 'numeric' })}` : `${a.name}: follow-up cleared`); }
  }

  // ----- saved views: the old Lists, as tabs on the accounts table -----
  /** Keep each view's joined / left dates so it can say "+4 this week, −2" and mark new rows. */
  function trackView(l) {
    if (l.builtIn) return false;
    const ids = new Set(state.accounts.filter((a) => listHas(l, a)).map((a) => a.id));
    const t = today();
    let changed = false;
    if (!l.joined) { l.joined = Object.fromEntries([...ids].map((id) => [id, ''])); l.left = {}; l.trackedFrom = t; return true; }
    l.left = l.left || {};
    const stamp = new Date().toISOString();
    for (const id of ids) if (!(id in l.joined)) { l.joined[id] = stamp; delete l.left[id]; changed = true; }
    for (const id of Object.keys(l.joined)) if (!ids.has(id)) { delete l.joined[id]; l.left[id] = t; changed = true; }
    for (const [id, d] of Object.entries(l.left)) if (daysBetween(d, t) > 30) { delete l.left[id]; changed = true; }
    return changed;
  }
  function trackViews() {
    let changed = false;
    for (const l of state.lists) if (trackView(l)) changed = true;
    if (changed) save();
  }
  const viewDelta = (l) => {
    const wk = addDays(today(), -7);
    return { plus: Object.values(l.joined || {}).filter((d) => d && d >= wk).length, minus: Object.values(l.left || {}).filter((d) => d >= wk).length };
  };
  const deltaText = (l) => { const d = viewDelta(l); return [d.plus && `+${d.plus}`, d.minus && `−${d.minus}`].filter(Boolean).join(' '); };
  /** Rows that joined since you last opened this view (on this device). */
  function newInView(l) {
    const seen = (ui.viewSeenPrev || {})[l.id];
    return new Set(Object.entries(l.joined || {}).filter(([, d]) => d && (!seen || d > seen)).map(([id]) => id));
  }
  function openView(id) {
    ui.viewSeenPrev = { ...(ui.viewSeenPrev || {}), [id]: (ui.viewSeen || {})[id] || '' };
    ui.viewSeen = { ...(ui.viewSeen || {}), [id]: new Date().toISOString() }; savePrefs();
    ui.viewId = id; ui.acctSel = new Set(); ui.showAll = false;
  }

  function vendorScoreboard() {
    const t = today();
    const rows = new Map();
    for (const a of state.accounts) for (const v of a.vendors) {
      if (v === NO_VENDOR) continue;
      const r = rows.get(v) || { v, n: 0, open: 0, pipe: 0, emp: 0, empN: 0, renew: 0, won: 0 };
      r.n++;
      if (isOpenDeal(a)) { r.open++; r.pipe += Number(a.value) || 0; }
      if (a.stage === 'Closed Won') r.won++;
      if (Number(a.employees)) { r.emp += Number(a.employees); r.empN++; }
      if (a.vendorRenewal && daysBetween(t, a.vendorRenewal) >= 0 && daysBetween(t, a.vendorRenewal) <= 90) r.renew++;
      rows.set(v, r);
    }
    const list = [...rows.values()].sort((x, y) => y.renew - x.renew || y.pipe - x.pipe || y.n - x.n);
    return `<div class="card">
      <h2 style="margin:0">Vendor scoreboard</h2>
      <p class="small muted" style="margin:.2rem 0 .5rem">Your displacement targets by incumbent. Click a vendor to open its accounts.</p>
      ${list.length ? `<div class="rs-wrap"><table class="rs-table">
        <thead><tr><th>Current vendor</th><th>Accounts</th><th>Open deals</th><th>Open pipeline</th><th>Avg employees</th><th>Renew in 90 days</th><th>Won</th></tr></thead>
        <tbody>${list.map((r) => `<tr class="click-row" data-act="acct-view" data-view="${esc(VENDOR_LIST + r.v)}">
          <td><strong>${esc(r.v)}</strong>${COMPETITORS.includes(r.v) ? ' <span class="pill">PEO</span>' : ''}</td><td>${r.n}</td><td>${r.open}</td><td>${r.pipe ? money(r.pipe) : '—'}</td>
          <td>${r.empN ? Math.round(r.emp / r.empN) : '—'}</td><td class="${r.renew ? 'cell-warn' : ''}">${r.renew || '—'}</td><td>${r.won || '—'}</td></tr>`).join('')}</tbody>
      </table></div>` : '<div class="empty">Add current vendors on your accounts to build the scoreboard.</div>'}
    </div>`;
  }

  // ----- verbs: act on a whole view or the rows you ticked -----
  const ACCT_ACTIONS = { enroll: 'Enroll in a cadence', route: 'Add to a route', session: 'Start a call session', stage: 'Set stage', tag: 'Add a tag', list: 'Add to a hand-picked list', csv: 'Export accounts (CSV)', contacts: 'Export contacts for ZoomInfo / Apollo' };
  function actionTargets() {
    const sel = ui.acctSel || new Set();
    const shown = filteredAccounts();
    return sel.size ? shown.filter((a) => sel.has(a.id)) : shown;
  }
  const PEOPLE_PICK = { primary: 'Primary contact', all: 'Everyone active', decision: 'Decision makers', title: 'Title contains…' };
  function pickPeople(a, who, text = '') {
    const active = a.contacts.filter((c) => !c.status || c.status === 'Active');
    if (who === 'all') return active;
    if (who === 'decision') return active.filter((c) => /decision/i.test(c.role || '') || /owner|founder|ceo|cfo|coo|president|chief|vp|vice president/i.test(c.title || ''));
    if (who === 'title') return active.filter((c) => text && (c.title || '').toLowerCase().includes(text.toLowerCase()));
    const p = active.find((c) => c.primary) || active[0];
    return p ? [p] : [];
  }
  function runAction(kind) {
    const list = actionTargets();
    if (!list.length) { toast('No accounts here'); return; }
    const scope = ui.acctSel && ui.acctSel.size ? `${plural(list.length, 'selected account')}` : `${plural(list.length, 'account')} in this view`;
    if (kind === 'csv') return accountsCsv(ui.viewId ? (resolveList(ui.viewId) || {}).name || 'accounts' : 'accounts', list);
    if (kind === 'contacts') return contactsCsv(list);
    if (kind === 'enroll') {
      if (!state.cadences.length) { toast('Create a cadence first'); return; }
      return openModal(`Enroll · ${scope}`, `
        <div class="grid-2">
          ${field('Cadence', `<select name="cad">${state.cadences.map((c) => opt(c.id, c.name, ui.cadenceId)).join('')}</select>`)}
          ${field('Who', `<select name="who" id="en-who">${Object.entries(PEOPLE_PICK).map(([k, l]) => opt(k, l, 'primary')).join('')}</select>`)}
          ${field('Title contains', '<input name="title" id="en-title" placeholder="e.g. HR, CFO">', 'en-title-f')}
          ${field('Start', `<input name="start" type="date" value="${today()}">`)}
        </div>
        <label class="row small"><input type="checkbox" name="spread" checked style="width:auto"> Spread start dates, up to <input type="number" name="perDay" min="1" value="${Number(ui.enrollPerDay) || 8}" style="width:4.2rem;display:inline-block"> new people a workday</label>
        <div class="small" id="en-count"></div>`, (data) => {
        const cad = cadenceById(data.cad);
        const inCad = new Set(state.enrollments.filter((e) => e.cadenceId === cad.id && e.status !== 'finished').map((e) => e.contactId));
        const picks = list.flatMap((a) => pickPeople(a, data.who, data.title).filter((c) => !inCad.has(c.id)).map((c) => ({ a, c })));
        if (!picks.length) { toast('Nobody new to enroll'); return false; }
        const perDay = Math.max(1, Number(data.perDay) || 8);
        const dated = data.spread && picks.length > perDay ? staggerStarts(picks, data.start || today(), perDay) : picks.map((x) => ({ ...x, date: data.start || today() }));
        for (const x of dated) enroll(cad, x.a, x.c, x.date);
        toast(`${plural(dated.length, 'person', 'people')} enrolled in ${cad.name}${dated[dated.length - 1].date !== dated[0].date ? ` · spread to ${fmtDate(dated[dated.length - 1].date, { weekday: 'short', month: 'short', day: 'numeric' })}` : ''}`);
      }, 'Enroll', { wide: true });
    }
    if (kind === 'route') {
      return openModal(`Add to a route · ${scope}`, field('Day', `<input name="d" type="date" value="${today()}">`), (data) => {
        const d = data.d || today();
        const r = getRoute(d);
        const withAddr = list.filter((a) => geoQuery(a));
        const ids = withAddr.map((a) => a.id).filter((id) => !r.extra.includes(id));
        setRoute(d, { extra: [...r.extra, ...ids], removed: r.removed.filter((x) => !ids.includes(x)) });
        toast(`${plural(ids.length, 'stop')} added to the ${fmtDate(d, { weekday: 'short', month: 'short', day: 'numeric' })} route${list.length - withAddr.length ? ` · ${list.length - withAddr.length} without an address` : ''}`);
      }, 'Add stops');
    }
    if (kind === 'session') {
      const ids = new Set(list.map((a) => a.id));
      const due = sessionCandidates({ type: 'all', cadenceId: 'all', stepNo: '' }).filter((p) => ids.has(p.acct.id));
      if (!due.length) { toast('None of these accounts has a cadence step due'); return; }
      session = { filter: { type: 'all', cadenceId: 'all', stepNo: '' }, queue: due.map((p) => p.e.id), idx: 0, results: [], startedAt: new Date().toISOString() };
      saveSession(); return go('session');
    }
    if (kind === 'stage') {
      const types = [...new Set(list.map((a) => a.type))];
      if (types.length > 1) { toast('Pick only prospects or only partners to set a stage'); return; }
      return openModal(`Set stage · ${scope}`, field('Stage', `<select name="stage">${STAGES[types[0]].map((s) => opt(s, s, list[0].stage)).join('')}</select>`), (data) => {
        let n = 0;
        for (const a of list) if (a.stage !== data.stage) { logStageChange(a, a.stage, data.stage); a.stage = data.stage; touch(a); n++; }
        toast(`${plural(n, 'account')} moved to ${data.stage}`);
      }, 'Set stage');
    }
    if (kind === 'tag') {
      const tag = (prompt(`Tag to add to ${scope}:`) || '').trim().replace(/^#/, '');
      if (!tag) return;
      for (const a of list) if (!tagList(a).some((x) => x.toLowerCase() === tag.toLowerCase())) { a.tags = [...tagList(a), tag].join(', '); touch(a); }
      save(); rerender(); return toast(`#${tag} added to ${plural(list.length, 'account')}`);
    }
    if (kind === 'list') return addToListForm(list);
    return undefined;
  }

  function addToListForm(list) {
    const statics = state.lists.filter((l) => l.kind === 'static');
    openModal(`Add ${plural(list.length, 'account')} to a list`, `
      <p class="small muted" style="margin:0">Hand-picked lists hold exactly the accounts you put in them, e.g. "Brokers Brew members" or "Q1 gift drop".</p>
      ${field('List', `<select name="lid" id="al-lid">${statics.map((l) => opt(l.id, l.name, statics[0] && statics[0].id)).join('')}<option value="__new" ${statics.length ? '' : 'selected'}>+ New hand-picked list…</option></select>`)}
      ${field('New list name', '<input name="name" id="al-name" placeholder="e.g. Brokers Brew members">', 'al-name-f')}`, (data) => {
      let l = statics.find((x) => x.id === data.lid);
      if (!l) {
        if (!data.name.trim()) { toast('Name the new list'); return false; }
        l = { id: uid(), name: data.name.trim(), kind: 'static', ids: [], criteria: emptyCriteria() };
        state.lists.push(l);
      }
      const before = l.ids.length;
      l.ids = [...new Set([...l.ids, ...list.map((a) => a.id)])];
      toast(`${plural(l.ids.length - before, 'account')} added to ${l.name}`);
    }, 'Add');
    const sync = () => { $('#al-name').closest('.field').hidden = $('#al-lid').value !== '__new'; };
    $('#al-lid').addEventListener('change', sync); sync();
  }

  const contactsCsv = (list) => contactsCsvRows(list.flatMap((a) => a.contacts.filter(isActiveContact).map((c) => ({ a, c }))));

  function renderAccounts() {
    trackViews();
    if (ui.viewId && ui.viewId !== 'scoreboard' && !resolveList(ui.viewId)) ui.viewId = null;
    const view = ui.viewId && ui.viewId !== 'scoreboard' ? resolveList(ui.viewId) : null;
    const list = filteredAccounts();
    const sel = ui.acctSel || (ui.acctSel = new Set());
    for (const id of [...sel]) if (!getAccount(id)) sel.delete(id);
    const vendorCounts = new Map();
    for (const a of state.accounts) for (const v of a.vendors) if (v !== NO_VENDOR) vendorCounts.set(v, (vendorCounts.get(v) || 0) + 1);
    const vendors = [...vendorCounts].sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0]));
    const tab = (id, label, n, extra = '') => `<button type="button" class="q-tab ${ui.viewId === id || (!ui.viewId && id === null) ? 'active' : ''}" data-act="acct-view" data-view="${id === null ? '' : esc(id)}">${esc(label)} <span>${n}</span>${extra}</button>`;
    const c = view ? { ...emptyCriteria(), ...view.criteria } : null;

    $('#view').innerHTML = `
      <div class="page-head">
        <div>
          <div class="row" style="gap:.85rem"><h1>Accounts <span class="muted small">(${ui.viewId === 'scoreboard' ? state.accounts.length : list.length})</span></h1>${peopleSwitch('accounts')}</div>
          <div class="muted small">Saved views live here (they replace the old Lists page). Change stage, value or follow-up right in the table.</div>
        </div>
        <div class="row">${viewSwitcher()}<button class="btn ghost" data-act="import-csv" title="Import accounts and contacts from a ZoomInfo or spreadsheet CSV">Import</button><button class="btn ghost" data-act="accounts-csv" title="Export the accounts shown">Export CSV</button><button class="btn" data-act="new-account">+ New account</button></div>
      </div>
      <div class="view-tabs">
        ${tab(null, 'All', state.accounts.length)}
        ${state.lists.map((l) => { const d = deltaText(l); return tab(l.id, `${l.pinned ? '★ ' : ''}${l.name}`, state.accounts.filter((a) => listHas(l, a)).length, d ? ` <em class="view-delta">${d}</em>` : ''); }).join('')}
        ${vendors.length ? `<select id="vendor-view" class="view-select ${ui.viewId && ui.viewId.startsWith(VENDOR_LIST) ? 'on' : ''}" aria-label="Vendor views"><option value="">By vendor…</option>${vendors.map(([v, n]) => `<option value="${esc(VENDOR_LIST + v)}" ${ui.viewId === VENDOR_LIST + v ? 'selected' : ''}>${esc(v)} (${n})</option>`).join('')}</select>` : ''}
        ${tab('scoreboard', 'Vendor scoreboard', vendors.length)}
        <button type="button" class="btn ghost sm" data-act="save-view">+ Save view</button>
      </div>
      ${ui.viewId === 'scoreboard' ? vendorScoreboard() : `
      ${view ? `<div class="view-bar">
        <div class="grow"><b>${esc(view.name)}</b> ${view.kind === 'static' ? '<span class="pill">Hand-picked</span>' : criteriaSummary(c).map((x) => `<span class="pill wrap">${esc(x)}</span>`).join(' ')}
          ${view.builtIn ? '' : (() => { const d = viewDelta(view); return `<span class="small muted"> · ${d.plus || d.minus ? `${d.plus ? `+${d.plus}` : ''}${d.plus && d.minus ? ', ' : ''}${d.minus ? `−${d.minus}` : ''} this week` : 'no change this week'}${newInView(view).size ? ` · <b>${newInView(view).size} new since you last opened it</b>` : ''}</span>`; })()}</div>
        ${view.builtIn ? '' : `<button type="button" class="btn ghost sm" data-act="pin-view" data-lid="${view.id}">${view.pinned ? '★ Pinned' : '☆ Pin to Overview'}</button>
        <button type="button" class="btn ghost sm" data-act="edit-list" data-lid="${view.id}">Edit</button>
        <button type="button" class="btn ghost sm danger" data-act="del-list" data-lid="${view.id}">Delete</button>`}
      </div>` : ''}
      <div class="filters">
        <input type="search" id="acct-search" placeholder="Search name, contacts, vendors, tags, notes…" value="${esc(ui.search)}">
        <select id="acct-type" aria-label="Type">
          <option value="all">All types</option>
          <option value="partner" ${ui.typeFilter === 'partner' ? 'selected' : ''}>Partners</option>
          <option value="prospect" ${ui.typeFilter === 'prospect' ? 'selected' : ''}>Prospects</option>
        </select>
        <select id="acct-stage" aria-label="Stage">
          <option value="all">All stages</option>
          ${(ui.typeFilter === 'all' ? ['prospect', 'partner'] : [ui.typeFilter]).map((ty) => `<optgroup label="${ty === 'partner' ? 'Partner (channel) stages' : 'Prospect (deal) stages'}">${STAGES[ty].map((x) => `<option value="${esc(x)}" ${ui.stageFilter === x ? 'selected' : ''} title="${esc(STAGE_HINTS[x] || '')}">${esc(x)}</option>`).join('')}</optgroup>`).join('')}
        </select>
        ${ui.typeFilter !== 'prospect' ? `<select id="acct-ptype" aria-label="Partner type">
          <option value="all">All partner types</option>
          ${PARTNER_TYPES.map((x) => `<option ${ui.partnerTypeFilter === x ? 'selected' : ''}>${esc(x)}</option>`).join('')}
        </select>` : ''}
        <select id="acct-vendor" aria-label="Current vendor">
          <option value="all">All vendors</option>
          ${allVendors().map((v) => `<option ${ui.vendorFilter === v ? 'selected' : ''}>${esc(v)}</option>`).join('')}
        </select>
        <select id="acct-sort" aria-label="Sort">
          ${Object.entries(SORT_LABELS).map(([k, l]) => `<option value="${k}" ${ui.sort === k ? 'selected' : ''}>Sort: ${l}</option>`).join('')}
        </select>
      </div>
      <div class="act-bar ${sel.size ? 'on' : ''}">
        <span class="small"><b>${sel.size ? `${sel.size} selected` : `${list.length} shown`}</b>${sel.size ? ' · <button type="button" class="link-btn small" data-act="acct-clear">Clear</button>' : ''}</span>
        ${['enroll', 'session', 'route', 'stage', 'tag', 'list'].map((k) => `<button type="button" class="btn ghost sm" data-act="acct-action" data-kind="${k}">${esc(ACCT_ACTIONS[k])}</button>`).join('')}
        <select id="acct-export" class="view-select" aria-label="Export"><option value="">Export…</option><option value="csv">${ACCT_ACTIONS.csv}</option><option value="contacts">${ACCT_ACTIONS.contacts}</option></select>
      </div>
      ${accountCollection(list, view ? (view.kind === 'static' ? 'Nothing in this list yet. Tick accounts and use "Add to a hand-picked list".' : 'No accounts match this view yet.') : state.accounts.length ? 'No accounts match these filters.' : 'No accounts yet. Click "+ New account" to add one.')}`}`;

    const vv = $('#vendor-view');
    if (vv) vv.addEventListener('change', (e) => { if (e.target.value) openView(e.target.value); else ui.viewId = null; renderAccounts(); });
    if (ui.viewId === 'scoreboard') return;
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
    $('#acct-type').addEventListener('change', (e) => { ui.typeFilter = e.target.value; ui.stageFilter = 'all'; if (e.target.value === 'prospect') ui.partnerTypeFilter = 'all'; renderAccounts(); });
    $('#acct-stage').addEventListener('change', (e) => { ui.stageFilter = e.target.value; renderAccounts(); });
    $('#acct-sort').addEventListener('change', (e) => { ui.sort = e.target.value; ui.sortDir = 1; renderAccounts(); });
    $('#acct-vendor').addEventListener('change', (e) => { ui.vendorFilter = e.target.value; renderAccounts(); });
    const ptSel = $('#acct-ptype');
    if (ptSel) ptSel.addEventListener('change', (e) => { ui.partnerTypeFilter = e.target.value; renderAccounts(); });
    $('#acct-export').addEventListener('change', (e) => { const k = e.target.value; e.target.value = ''; if (k) runAction(k); });
    bindCollection();
    $$('.row-pick').forEach((cb) => cb.addEventListener('change', () => {
      if (cb.id === 'pick-all') { if (cb.checked) list.forEach((a) => sel.add(a.id)); else list.forEach((a) => sel.delete(a.id)); }
      else if (cb.checked) sel.add(cb.dataset.id); else sel.delete(cb.dataset.id);
      renderAccounts();
    }));
    $$('.cell-edit').forEach((el) => el.addEventListener('change', () => inlineEdit(el)));
  }

  /** Pinned views as counts on the Overview. */
  function pinnedViewsStrip() {
    const pins = state.lists.filter((l) => l.pinned).slice(0, 3);
    if (!pins.length) return '';
    return `<div class="pin-strip">${pins.map((l) => { const d = deltaText(l); return `<button type="button" class="pin-chip" data-act="acct-view" data-view="${esc(l.id)}"><span>${esc(l.name)}</span><b>${state.accounts.filter((a) => listHas(l, a)).length}</b>${d ? `<em>${d} this week</em>` : ''}</button>`; }).join('')}</div>`;
  }

  function renderAccountRecord() {
    const a = getAccount(ui.recordId);
    $('#view').innerHTML = `
      <div class="record">
        <button class="btn ghost sm back-btn" data-act="back">← Back</button>
        ${a ? accountDetail(a) : '<div class="card empty">This account no longer exists.</div>'}
      </div>`;
  }

  /** Partners get a summary strip and tabs; Overview is the full record, the other tabs replace its body. */
  function accountDetail(a) {
    const html = accountDetailFull(a);
    if (a.type !== 'partner') return html;
    const cut = html.indexOf('<!--ptab-->');
    const tab = PARTNER_TABS[ui.partnerTab] ? ui.partnerTab : 'overview';
    if (tab === 'overview') return html;
    return `${html.slice(0, cut)}<div class="pt-body stack">${partnerTabBody(a, tab)}</div></div>`;
  }

  function accountDetailFull(a) {
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
            <div class="row"><h1 style="margin:0">${esc(a.name)}</h1>${accountLinks(a)}<span class="pill ${a.type}">${a.type === 'partner' ? 'Partner' : 'Prospect'}</span><span class="pill" title="${esc(STAGE_HINTS[a.stage] || '')}">${esc(a.stage)}</span>${a.type === 'partner' && a.partnerType ? `<span class="pill">${esc(a.partnerType)}</span>` : ''}</div>
            ${a.tags ? `<div class="row small muted" style="margin-top:.35rem">${tagList(a).map((x) => `<span class="pill">#${esc(x)}</span>`).join('')}</div>` : ''}
          </div>
          <div class="row">
            <button class="btn" data-act="log" data-id="${a.id}">+ Log activity</button>
            <button class="btn ghost" data-act="new-task" data-id="${a.id}">+ Plan task</button>
            ${researchMenu(a)}
            <button class="btn ghost" data-act="acct-addlist" data-id="${a.id}" title="Add to a hand-picked list">+ List</button>
            ${hasGeo(a) ? `<button class="btn ghost" data-act="acct-nearby" data-id="${a.id}" title="Who else is close by">Nearby</button>` : ''}
            <button class="btn ghost" data-act="edit-account" data-id="${a.id}">Edit</button>
          </div>
        </div>
        ${a.type === 'partner' ? partnerStrip(a) : ''}<!--ptab-->

        <div class="facts">
          ${a.type === 'prospect' || a.vendors.length ? `<div class="span-all"><span>Current vendors</span>${a.vendors.length ? vendorPills(a) : '—'}</div>` : ''}
          <div class="span-all"><span>Address</span>${geoQuery(a) ? `${esc(geoQuery(a))}${hasGeo(a) ? ` · <a href="${esc(navUrl(ll(a)))}" target="_blank" rel="noopener">Directions</a>` : ''}` : '—'}</div>
          ${a.type === 'partner' ? (() => {
            const ref = lastReferralDate(a);
            const stale = ref && daysBetween(ref, today()) > 182;
            return `<div><span>Partner type</span>${esc(a.partnerType) || '—'}</div>
          <div><span>Last referral</span>${ref ? `${fmtDate(ref)} <span class="small muted">${relDays(ref)}</span>${stale && a.stage === 'Producing' ? '<div class="small" style="color:var(--warn)">Over 6 months: Dormant?</div>' : ''}` : 'None yet'}</div>`;
          })() : ''}
          ${a.type === 'partner' && !a.vendorRenewal ? '' : `<div><span>Vendor renewal</span>${a.vendorRenewal ? `${fmtDate(a.vendorRenewal)} <span class="small muted">${relDays(a.vendorRenewal)}</span>` : '—'}</div>`}
          <div><span>Employees</span>${esc(a.employees) || '—'}</div>
          <div><span>Main phone</span>${a.mainPhone ? `<a href="tel:${esc(a.mainPhone)}">${esc(a.mainPhone)}</a>` : '—'}</div>
          <div><span>${a.type === 'partner' ? 'Annual value' : 'Deal value'}</span>${money(a.value)}</div>
          ${a.type === 'partner' && !a.adminFees ? '' : `<div><span>Admin fees</span>${a.adminFees ? money(a.adminFees) : '—'}</div>`}
          ${a.type === 'partner' && !a.closeDate ? '' : `<div><span>Expected close</span>${a.closeDate ? `<span class="pill ${isClosedStage(a.stage) ? '' : dueClass(a.closeDate)}">${fmtDate(a.closeDate)}</span> <span class="small muted">${relDays(a.closeDate)}</span>` : '—'}</div>`}
          ${(() => {
            const pa = a.channelPartnerId && getAccount(a.channelPartnerId);
            if (!pa) return '';
            const pc = a.channelContactId && pa.contacts.find((c) => c.id === a.channelContactId);
            const cc = isOpenDeal(a) || a.stage === 'Closed Won' ? dealComp(a) : 0;
            return `<div class="span-all"><span>Channel partner</span>${cc ? `<span class="pt-est" title="Year-one estimate from your comp rates">Est. comp ${est(cc)} <button type="button" class="link-btn small" data-act="comp-calc" data-deal="${a.id}">calculator</button></span>` : ''}<a href="#account/${pa.id}">${esc(pa.name)}</a>${pc ? ` · ${esc(pc.name)}${pc.phone ? ` · <a href="tel:${esc(pc.phone)}">${esc(pc.phone)}</a>` : ''}${pc.email ? ` · <a href="mailto:${esc(pc.email)}">${esc(pc.email)}</a>` : ''}` : ''}</div>`;
          })()}
          ${(() => { const cp = a.coSellPartnerId && getAccount(a.coSellPartnerId); return cp ? `<div class="span-all"><span>Co-sell with</span><a href="#account/${cp.id}">${esc(cp.name)}</a> <span class="small muted">(their client)</span></div>` : ''; })()}
          <div><span>Next follow-up</span>${a.nextFollowUp ? `<span class="pill ${dueClass(a.nextFollowUp)}">${fmtDate(a.nextFollowUp)}</span> <span class="small muted">${relDays(a.nextFollowUp)}</span>` : '—'}</div>
          <div><span>Next revisit</span>${a.revisitDate ? `<span class="pill ${dueClass(a.revisitDate)}">${fmtDate(a.revisitDate)}</span> <span class="small muted">${relDays(a.revisitDate)}</span>${a.revisitNote ? `<div class="small muted">${esc(a.revisitNote)}</div>` : ''}` : '—'}</div>
          <div><span>Last touch</span>${(() => {
            const d = lastTouchDate(a);
            if (!d) return 'Never';
            return `${fmtDate(d)} <span class="small muted">${last && last.date === d && last.kind !== 'Note' ? `(${esc(last.kind)})` : relDays(d)}</span>`;
          })()}</div>
        </div>
        <details class="more-details">
          <summary>More details</summary>
          <div class="facts">
            <div><span>Industry</span>${esc(a.industry) || '—'}</div>
            <div><span>Website</span>${a.website ? `<a href="${esc(extUrl(a.website))}" target="_blank" rel="noopener">${esc(a.website)}</a>` : '—'}</div>
            <div><span>Company LinkedIn</span>${a.linkedin ? `<a href="${esc(extUrl(a.linkedin))}" target="_blank" rel="noopener">Open profile</a>` : '—'}</div>
            <div><span>Lead source</span>${esc(a.leadSource) || '—'}</div>
            <div><span>Added</span>${fmtDate((a.createdAt || '').slice(0, 10) || null)}</div>
          </div>
        </details>

        <div>
          <div class="section-head"><h2 style="margin:0">Contacts <span class="muted small">(${a.contacts.length})</span></h2><button class="btn sm ghost" data-act="new-contact" data-id="${a.id}">+ Add contact</button></div>
          ${committeeLine(a)}
          ${a.contacts.length ? `<div class="contact-grid">${[...a.contacts].sort((x, y) => (y.primary ? 1 : 0) - (x.primary ? 1 : 0)).map((c) => `
            <div class="contact-card" data-contact="${c.id}">
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
              ${c.title || c.role ? `<div class="small muted">${esc(c.title || '')} ${rolePill(c.role)}</div>` : ''}
              ${c.status && c.status !== 'Active' ? `<span class="pill overdue">${esc(c.status)}</span>${c.movedTo && getAccount(c.movedTo) ? ` <a class="small" href="#account/${c.movedTo}">now at ${esc(getAccount(c.movedTo).name)}</a>` : c.status === 'Left company' ? ' <button type="button" class="link-btn small" data-act="ct-follow" data-id="' + a.id + '" data-cid="' + c.id + '">Where did they go?</button>' : ''}` : ''}
              <div class="row cc-reach-row">${contactReach(c, a)}<span class="small muted">${(() => { const lc = lastContacted(a, c); return lc ? `Last touch ${esc(relDays(lc))}` : 'Never touched'; })()}</span></div>
              ${c.flag ? `<div><span class="pill overdue" title="${esc(c.flagAt ? `Logged ${relDays(c.flagAt)}` : '')}">⚠ ${esc(c.flag)}</span> <button type="button" class="link-btn small" data-act="contact-unflag" data-id="${a.id}" data-cid="${c.id}">Clear</button></div>` : ''}
              ${contactLinks(c, a)}
              ${stayLine(a, c)}
              ${enrollmentsFor(c.id).map((p) => `<button type="button" class="cad-badge" style="--c:${p.cad.color}" data-act="enr-open" data-eid="${p.e.id}">${esc(p.cad.name)} · ${p.e.step + 1}/${p.cad.steps.length}${p.e.status === 'paused' ? ' · paused' : ` · next ${esc(fmtDate(p.e.dueDate, { month: 'short', day: 'numeric' }))}`}</button>`).join('')}
              ${c.notes ? `<div class="small muted" style="white-space:pre-wrap;margin-top:.25rem">${esc(c.notes)}</div>` : ''}
            </div>`).join('')}</div>` : '<div class="empty">No contacts yet. Add the decision maker, champion, HR lead…</div>'}
        </div>

        ${(() => {
          if (a.type !== 'partner') return '';
          const referred = state.accounts.filter((x) => x.channelPartnerId === a.id);
          if (!referred.length) {
            return `<div><div class="section-head"><h2 style="margin:0">Referred accounts</h2></div>
              <div class="empty">No referrals linked yet. On a prospect, pick this partner under "Referred by partner".</div></div>`;
          }
          const total = referred.filter(isOpenDeal).reduce((n, x) => n + (Number(x.value) || 0), 0);
          return `<div>
            <div class="section-head"><h2 style="margin:0">Referred accounts <span class="muted small">(${referred.length}${total ? ` · ${money(total)} open` : ''})</span></h2></div>
            <ul class="list">${referred.sort((x, y) => (x.closeDate || '9').localeCompare(y.closeDate || '9')).map((x) => {
              const pc = x.channelContactId && a.contacts.find((c) => c.id === x.channelContactId);
              return `<li>
                <div class="grow"><a class="title" href="#account/${x.id}">${esc(x.name)}</a>
                  <div class="small muted">${esc(x.stage)}${x.value ? ' · ' + money(x.value) : ''}${x.location ? ' · ' + esc(x.location) : ''}${pc ? ' · via ' + esc(pc.name) : ''}</div></div>
                ${x.closeDate ? `<span class="small muted">Close</span> ${dueChip(x.closeDate)}` : ''}
              </li>`;
            }).join('')}</ul>
          </div>`;
        })()}

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

        ${filesSection(a)}

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
  // ---------- daily activity plan ----------
  /** Accounts whose revisit falls on day d (or is overdue, on today's page) and aren't already listed. */
  function dueRevisits(d, rows) {
    const listed = new Set(rows.map((r) => (rowAccount(r) || {}).id).filter(Boolean));
    return state.accounts
      .filter((a) => a.revisitDate && (a.revisitDate === d || (d === today() && a.revisitDate < d)) && !listed.has(a.id))
      .sort((x, y) => x.revisitDate.localeCompare(y.revisitDate));
  }

  function planSection(d) {
    const plan = getPlan(d);
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
        <datalist id="dl-accounts">${accountLabels(state.accounts).map((l) => `<option value="${esc(l)}">`).join('')}</datalist>
        <datalist id="dl-partners">${(() => { const ps = state.accounts.filter((a) => a.type === 'partner'); return accountLabels(ps).map((l) => `<option value="${esc(l)}">`).join(''); })()}</datalist>
        <div class="plan-grid">
          <div>${block(outreach)}</div>
          <div class="stack">${rest.map(block).join('')}</div>
        </div>
      </div>`;
  }

  function planRow(sec, r, i) {
    const acct = rowAccount(r);
    return `
      <div class="plan-row ${r.done ? 'done' : ''} ${r.auto ? 'auto' : ''}" data-sec="${sec.key}" data-i="${i}" ${r.auto ? `data-auto="${esc(JSON.stringify({ name: r.name, accountId: r.accountId || '', kind: r.kind, note: r.note, ...(r.contactId ? { contactId: r.contactId } : {}) }))}"` : ''}>
        <span class="plan-num">${i + 1}</span>
        <input type="checkbox" data-plan="done" ${r.done ? 'checked' : ''} aria-label="Done">
        <input data-plan="name" list="${sec.partners ? 'dl-partners' : 'dl-accounts'}" placeholder="Account / contact" value="${esc(acct && r.accountId ? accountLabel(acct) : r.name)}">
        ${sec.kinds.length > 1
          ? `<select data-plan="kind">${sec.kinds.map((k) => `<option ${k === r.kind ? 'selected' : ''}>${k}</option>`).join('')}</select>`
          : '<span class="plan-kind"></span>'}
        <input data-plan="note" placeholder="Note / outcome" value="${esc(r.note)}">
        <span class="plan-link">${acct ? `<a href="#account/${acct.id}" title="Open ${esc(acct.name)}">↗</a>` : ''}</span>
        ${r.contactId ? `<span class="plan-due sit ${r.auto ? dueClass(r.auto) : ''}">${CLOCK_IC} Stay in touch${r.auto ? ` · due ${esc(relDays(r.auto))}` : ''}</span>`
          : r.auto ? `<span class="plan-due ${dueClass(r.auto)}">Revisit due ${esc(relDays(r.auto))}</span>` : ''}
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
            const acct = findAccountByText(row.name);
            row.accountId = acct ? acct.id : '';
            if (row.contactId && !(acct && acct.contacts.some((c) => c.id === row.contactId))) delete row.contactId;
            $('.plan-link', rowEl).innerHTML = acct ? `<a href="#account/${acct.id}" title="Open ${esc(acct.name)}">↗</a>` : '';
          }
        }
        save();
      });
    });
  }

  /** Completing a revisit clears the account's due revisit date; un-checking puts it back. */
  function settleRevisit(d, row) {
    const acct = rowAccount(row);
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
    const acct = rowAccount(row);
    if (row.activityId) {
      for (const a of state.accounts) a.activities = a.activities.filter((h) => h.id !== row.activityId);
      delete row.activityId;
    }
    if (row.done && acct) {
      row.activityId = uid();
      acct.activities.push({
        id: row.activityId, date: d, kind: row.kind, contactId: row.contactId || '',
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
      const keyOf = (r) => r.accountId || r.name.trim().toLowerCase();
      const existing = new Set(target.filter((r) => r.name.trim()).map(keyOf));
      for (const r of from[sec.key]) {
        const key = r.name.trim() ? keyOf(r) : '';
        if (!key || r.done || existing.has(key)) continue;
        const copy = { name: r.name, kind: r.kind, note: r.note, done: false, ...(r.accountId ? { accountId: r.accountId } : {}), ...(r.contactId ? { contactId: r.contactId } : {}) };
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
  const emptyCriteria = () => ({ type: 'all', stages: [], tags: [], vendors: [], partnerTypes: [], text: '', renewalDays: 0,
    empMin: 0, empMax: 0, place: '', industry: '', touchOlder: 0, noNext: false, noCadence: false, stageDays: 0, valueMin: 0, valueMax: 0, tiers: [] });
  /** Is an account in a list? Hand-picked lists hold ids; the rest are filters. */
  const listHas = (l, a) => (l.kind === 'static' ? (l.ids || []).includes(a.id) : matchesCriteria(a, { ...emptyCriteria(), ...l.criteria }));

  function matchesCriteria(a, c) {
    const emp = Number(a.employees) || 0;
    if (c.empMin && emp < c.empMin) return false;
    if (c.empMax && (!emp || emp > c.empMax)) return false;
    if (c.place && !`${a.location || ''} ${a.address || ''}`.toLowerCase().includes(c.place.toLowerCase())) return false;
    if (c.industry && !(a.industry || '').toLowerCase().includes(c.industry.toLowerCase())) return false;
    if (c.touchOlder) { const d = lastTouchDate(a); if (d && daysBetween(d, today()) < c.touchOlder) return false; }
    if (c.noNext && nextStepOf(a)) return false;
    if (c.noCadence && inCadence(a)) return false;
    if (c.stageDays && daysInStage(a) < c.stageDays) return false;
    if (c.valueMin && (Number(a.value) || 0) < c.valueMin) return false;
    if (c.valueMax && (Number(a.value) || 0) > c.valueMax) return false;
    if (c.tiers && c.tiers.length && !(a.type === 'partner' && c.tiers.includes(partnerTier(a)))) return false;
    if (c.type !== 'all' && a.type !== c.type) return false;
    if (c.stages.length && !c.stages.includes(a.stage)) return false;
    if (c.tags.length && !tagList(a).some((t) => c.tags.includes(t.toLowerCase()))) return false;
    if (c.vendors.length && !a.vendors.some((v) => c.vendors.includes(v))) return false;
    if (c.partnerTypes.length && !(a.type === 'partner' && c.partnerTypes.includes(a.partnerType))) return false;
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

  const listAccounts = (list) => sortAccounts(state.accounts.filter((a) => listHas(list, a)));

  function criteriaSummary(c) {
    const parts = [];
    if (c.type !== 'all') parts.push(c.type === 'partner' ? 'Partners only' : 'Prospects only');
    if (c.vendors.length) {
      parts.push('Vendor: ' + (c.vendors.length > 3 ? `${c.vendors.slice(0, 2).join(' or ')} or ${c.vendors.length - 2} others` : c.vendors.join(' or ')));
    }
    if (c.tags.length) parts.push('Tag: ' + c.tags.map((t) => '#' + t).join(' or '));
    if (c.stages.length) parts.push('Stage: ' + c.stages.join(' or '));
    if (c.partnerTypes.length) parts.push('Partner type: ' + c.partnerTypes.join(' or '));
    if (c.text) parts.push(`Contains "${c.text}"`);
    if (c.renewalDays) parts.push(`Vendor renewal within ${c.renewalDays} days`);
    if (c.empMin || c.empMax) parts.push(c.empMin && c.empMax ? `${c.empMin}–${c.empMax} employees` : c.empMin ? `${c.empMin}+ employees` : `Up to ${c.empMax} employees`);
    if (c.place) parts.push(`In ${c.place}`);
    if (c.industry) parts.push(`Industry: ${c.industry}`);
    if (c.valueMin || c.valueMax) parts.push(c.valueMin && c.valueMax ? `Value ${money(c.valueMin)}–${money(c.valueMax)}` : c.valueMin ? `Value ${money(c.valueMin)}+` : `Value up to ${money(c.valueMax)}`);
    if (c.touchOlder) parts.push(`No touch in ${c.touchOlder}+ days`);
    if (c.stageDays) parts.push(`${c.stageDays}+ days in stage`);
    if (c.noNext) parts.push('No next step');
    if (c.noCadence) parts.push('Not in a cadence');
    if (c.tiers && c.tiers.length) parts.push('Partner tier ' + c.tiers.join(' or '));
    return parts.length ? parts : ['All accounts'];
  }

  /** Lists live on the Accounts page as saved views; old #lists links land there. */
  function renderLists() {
    const id = ui.listId || (state.lists[0] || {}).id;
    if (id) openView(id);
    ui.listId = null;
    go('accounts');
  }

  const readCriteria = (fd) => ({
    type: fd.get('type') || 'all', vendors: fd.getAll('vendors'), tags: fd.getAll('tags'),
    stages: fd.getAll('stages'), partnerTypes: fd.getAll('partnerTypes'), text: (fd.get('text') || '').trim(), renewalDays: Number(fd.get('renewalDays')) || 0,
    empMin: Number(fd.get('empMin')) || 0, empMax: Number(fd.get('empMax')) || 0, place: (fd.get('place') || '').trim(), industry: (fd.get('industry') || '').trim(),
    touchOlder: Number(fd.get('touchOlder')) || 0, noNext: !!fd.get('noNext'), noCadence: !!fd.get('noCadence'), stageDays: Number(fd.get('stageDays')) || 0,
    valueMin: Number(fd.get('valueMin')) || 0, valueMax: Number(fd.get('valueMax')) || 0, tiers: fd.getAll('tiers'),
  });
  /** Today's Accounts filters as view criteria, for "+ Save view". */
  const criteriaFromFilters = () => ({ ...emptyCriteria(), type: ui.typeFilter || 'all', stages: ui.stageFilter && ui.stageFilter !== 'all' ? [ui.stageFilter] : [],
    vendors: ui.vendorFilter && ui.vendorFilter !== 'all' ? [ui.vendorFilter] : [], partnerTypes: ui.partnerTypeFilter && ui.partnerTypeFilter !== 'all' ? [ui.partnerTypeFilter] : [], text: (ui.search || '').trim() });

  function listForm(existing, preset) {
    const l = existing || { name: '', criteria: preset || emptyCriteria() };
    const c = { ...emptyCriteria(), ...l.criteria };
    const checks = (name, values, chosen, label = (v) => v) => values.length
      ? `<div class="check-grid">${values.map((v) => `<label><input type="checkbox" name="${name}" value="${esc(v)}" ${chosen.includes(v) ? 'checked' : ''}> ${esc(label(v))}</label>`).join('')}</div>`
      : '<div class="small muted">None in use yet. Add tags on your accounts.</div>';
    const num = (name, label, ph, step = 1) => field(label, `<input name="${name}" type="number" min="0" step="${step}" value="${c[name] || ''}" placeholder="${ph}">`);
    openModal(existing ? 'Edit view' : 'Save view', `
      <div class="grid-2">
        ${field('View name *', `<input name="name" required value="${esc(l.name)}" placeholder="e.g. Insperity renewals, 20–150 employees, OC">`)}
        ${field('Kind', `<select name="kind" id="lf-kind">${opt('filter', 'Filter: updates itself', l.kind === 'static' ? '' : 'filter')}${opt('static', 'Hand-picked: you add accounts', l.kind === 'static' ? 'static' : '')}</select>`)}
      </div>
      <label class="row small"><input type="checkbox" name="pinned" style="width:auto" ${l.pinned ? 'checked' : ''}> Pin to the Overview (up to 3 show as counts)</label>
      <div id="lf-static" class="small muted">${l.kind === 'static' ? `${plural((l.ids || []).length, 'account')} in this list. Add more by ticking rows on Accounts and choosing "Add to a hand-picked list", or from an account's page.` : 'Tick rows on Accounts and choose "Add to a hand-picked list", or use + List on an account page.'}</div>
      <div id="lf-filter" class="stack">
      <p class="small muted" style="margin:0">Accounts are included when they match <strong>every</strong> section you fill in,
        and <strong>any</strong> box ticked within a section. Leave a section empty to ignore it. Views update automatically.</p>
      <div class="grid-3">
        ${num('empMin', 'Employees from', 'e.g. 20')}
        ${num('empMax', 'Employees up to', 'e.g. 150')}
        ${field('City, county or area contains', `<input name="place" value="${esc(c.place || '')}" placeholder="e.g. Irvine, Orange County">`)}
        ${field('Industry contains', `<input name="industry" value="${esc(c.industry || '')}" placeholder="e.g. Manufacturing">`)}
        ${num('valueMin', 'Value at least', '$', 1000)}
        ${num('valueMax', 'Value at most', '$', 1000)}
        ${num('touchOlder', 'No touch in (days)', 'e.g. 30')}
        ${num('stageDays', 'Days in stage, at least', 'e.g. 21')}
        <div class="field"><span>Gaps</span><label class="row small"><input type="checkbox" name="noNext" style="width:auto" ${c.noNext ? 'checked' : ''}> No next step</label><label class="row small"><input type="checkbox" name="noCadence" style="width:auto" ${c.noCadence ? 'checked' : ''}> Not in a cadence</label></div>
      </div>
      <div class="field"><span>Partner tier is any of</span>${checks('tiers', ['A', 'B', 'C'], c.tiers || [], (t) => `${t} · ${TIERS[t].name}`)}</div>
      ${field('Account type', `<select name="type">${opt('all', 'Partners & prospects', c.type)}${opt('prospect', 'Prospects only', c.type)}${opt('partner', 'Partners only', c.type)}</select>`)}
      <div class="field"><span>Current vendor is any of</span>${checks('vendors', allVendors(), c.vendors)}</div>
      <div class="field"><span>Tagged with any of</span>${checks('tags', [...new Set([...allTags(), ...PARTNER_TAGS.map((t) => t.toLowerCase())])].sort(), c.tags, (t) => '#' + (PARTNER_TAGS.find((x) => x.toLowerCase() === t) || t))}</div>
      <div class="field"><span>Prospect (deal) stage is any of</span>${checks('stages', STAGES.prospect, c.stages)}</div>
      <div class="field"><span>Partner (channel) stage is any of</span>${checks('stages', STAGES.partner, c.stages)}</div>
      <div class="field"><span>Partner type is any of</span>${checks('partnerTypes', PARTNER_TYPES, c.partnerTypes)}</div>
      <div class="grid-2">
        ${field('Name, contacts or notes contain', `<input name="text" value="${esc(c.text)}">`)}
        ${field('Vendor renewal within (days)', `<input name="renewalDays" type="number" min="0" step="15" value="${c.renewalDays || ''}" placeholder="e.g. 120">`)}
      </div>
      </div>
      <div class="small" id="list-preview"></div>`, (data, fd) => {
      if (!data.name.trim()) return false;
      const criteria = readCriteria(fd);
      const fields = { name: data.name.trim(), criteria, kind: data.kind === 'static' ? 'static' : 'filter', pinned: !!data.pinned };
      if (fields.kind === 'static') fields.ids = (existing && existing.ids) || [];
      if (fields.pinned && state.lists.filter((x) => x.pinned && x !== existing).length >= 3) { toast('Up to 3 pinned views; unpin one first'); fields.pinned = false; }
      if (existing) Object.assign(existing, fields);
      else {
        const created = { id: uid(), ...fields };
        state.lists.push(created);
        openView(created.id);
        if (location.hash !== '#accounts') setTimeout(() => go('accounts'), 0);
      }
      toast(existing ? 'View updated' : 'View saved');
    }, existing ? 'Save view' : 'Save view', { wide: true });
    const preview = () => {
      const isStatic = $('#lf-kind').value === 'static';
      $('#lf-filter').hidden = isStatic; $('#lf-static').hidden = !isStatic;
      const n = isStatic ? (l.ids || []).length : state.accounts.filter((a) => matchesCriteria(a, readCriteria(new FormData(modalForm)))).length;
      $('#list-preview').innerHTML = `Currently ${isStatic ? 'holds' : 'matches'} <strong>${n}</strong> account${n === 1 ? '' : 's'}.`;
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
    const rows = [['Account', 'Website', 'Company LinkedIn', 'Type', 'Stage', 'Industry', 'Employees', 'Street address', 'Location', 'Main phone', 'Value', 'Admin fees', 'Expected close', 'Current vendors', 'Vendor renewal', 'Primary contact', 'Title', 'Email', 'Phone', 'Contact LinkedIn', 'Other contacts', 'Next follow-up', 'Next revisit', 'Revisit purpose', 'Lead source', 'Channel partner', 'Channel contact', 'Tags', 'Stay in touch', 'Partner type', 'Last touch', 'Last referral']];
    for (const a of accounts) {
      const p = primaryContact(a) || {};
      rows.push([a.name, a.website, a.linkedin, a.type, a.stage, a.industry, a.employees, a.address, a.location, a.mainPhone, a.value, a.adminFees, a.closeDate, a.vendors.join('; '), a.vendorRenewal, p.name, p.title, p.email, p.phone, p.linkedin,
        a.contacts.filter((x) => x.id !== p.id).map((x) => x.name).join('; '), a.nextFollowUp, a.revisitDate, a.revisitNote, a.leadSource,
        (getAccount(a.channelPartnerId) || {}).name || '',
        ((getAccount(a.channelPartnerId) || { contacts: [] }).contacts.find((c) => c.id === a.channelContactId) || {}).name || '', a.tags,
        (stayDef(p.stayInTouch) || {}).label || '',
        a.type === 'partner' ? a.partnerType || '' : '', lastTouchDate(a), a.type === 'partner' ? lastReferralDate(a) : '']);
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
    const view = CAD_VIEWS[ui.cadView] ? ui.cadView : 'steps';
    if (view === 'calendar') {
      $('#view').innerHTML = `${cadPageHead(view)}${cadCalendarCard()}<div class="cc-lower">${cadTimelinesCard()}${cadWorkloadCard()}</div>`;
      bindTimelines();
      return;
    }
    if (view === 'results') { $('#view').innerHTML = `${cadPageHead(view)}${cadSwitchRow(cad)}${cadResultsView(cad)}`; return; }
    const people = liveEnrollments(cad.id);
    const t = today();
    const active = people.filter((p) => p.e.status === 'active');
    const due = active.filter((p) => isDue(p.e)).sort((a, b) => a.e.dueDate.localeCompare(b.e.dueDate));
    const overdue = due.filter((p) => p.e.dueDate < t);
    const finished = people.filter((p) => p.e.status === 'finished');
    const res = cadResults(cad);
    const atStep = cad.steps.map((s, i) => people.filter((p) => p.e.status !== 'finished' && p.e.step === i).length);
    const filters = { active: 'Active', due: 'Due', paused: 'Paused', finished: 'Finished', all: 'All' };
    const shown = people.filter((p) => ({
      active: p.e.status === 'active', due: isDue(p.e), paused: p.e.status === 'paused', finished: p.e.status === 'finished', all: true,
    })[ui.cadFilter]).sort((a, b) => (a.e.status === 'finished') - (b.e.status === 'finished') || (a.e.dueDate || '').localeCompare(b.e.dueDate || ''));

    $('#view').innerHTML = `
      ${cadPageHead('steps')}${cadSwitchRow(cad)}

      <div class="card cad-head" style="--c:${cad.color}">
        <div class="detail-head">
          <div>
            <h2 style="margin:0">${esc(cad.name)}</h2>
            ${cad.description ? `<div class="muted small" style="margin-top:.2rem">${esc(cad.description)}</div>` : ''}
            <div class="small muted" style="margin-top:.35rem">${plural(cad.steps.length, 'step')} · ${plural(cadenceDays(cad), 'day')}${cad.skipWeekends ? ' · skips weekends' : ''}</div>
            <div class="small muted">Smart rules: ${(() => { const r = cadRules(cad); const on = Object.keys(CAD_RULE_SHORT).filter((k) => r[k]); return on.length ? esc(on.map((k) => CAD_RULE_SHORT[k]).join(' · ')) : 'off'; })()} · <button type="button" class="link-btn small" data-act="cad-edit">change</button></div>
          </div>
          <div class="row">
            ${due.length ? `<button class="btn" data-act="session-setup" data-cad="${cad.id}">▶ Work this cadence</button>` : ''}
            <button class="btn ${due.length ? 'ghost' : ''}" data-act="cad-add-people">+ Add people</button>
            <button class="btn ghost" data-act="cad-edit">Edit steps</button>
            <button class="btn danger sm" data-act="cad-delete">Delete</button>
          </div>
        </div>
        <div class="cad-stats">
          <div><b>${active.length}</b><span>Active</span></div>
          <div class="${due.length ? 'warn' : ''}"><b>${due.length}</b><span>Due now</span></div>
          <div class="${overdue.length ? 'bad' : ''}"><b>${overdue.length}</b><span>Overdue</span></div>
          <div><b>${people.filter((p) => p.e.status === 'paused').length}</b><span>Paused</span></div>
          <div class="good"><b>${res.engaged}</b><span>Engaged</span></div>
          <div><b>${res.reached ? pct(res.engaged, res.reached) + '%' : '—'}</b><span>Engage rate</span></div>
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
              ${POSITIVE[s.type] && res.steps[i].done ? `<div class="step-rate" title="${esc(`${POSITIVE_LABEL[s.type]} ${res.steps[i].pos} of ${res.steps[i].done}`)}">${pct(res.steps[i].pos, res.steps[i].done)}% ${POSITIVE_LABEL[s.type].toLowerCase()}</div>` : ''}
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
    ? `<span class="pill ${['meeting', 'replied', 'referred'].includes(e.outcome) ? 'won' : ''}">${esc(FINISH_LABELS[e.outcome] || 'Finished')}</span>`
    : e.status === 'paused' ? `<span class="pill med" title="${esc(e.pausedAt ? `Paused ${relDays(e.pausedAt)}` : 'Paused')}">Paused${e.pauseReason ? ' · ' + esc(e.pauseReason.toLowerCase()) : ''}</span>`
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
    if (action === 'resume') { e.status = 'active'; e.pauseReason = ''; if (e.dueDate < t) e.dueDate = p.cad.skipWeekends ? nextWorkday(t) : t; toast('Resumed'); }
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
    openModal(`${type.label}: ${step.title || type.label}`, `
      <div class="enr-head">
        ${stepIcon(step, 'lg')}
        <div class="grow">
          <div><strong>${esc(contact.name)}</strong>${contact.title ? ` <span class="muted">· ${esc(contact.title)}</span>` : ''} · ${esc(acct.name)}</div>
          <div class="small muted">${esc(cad.name)} · Step ${e.step + 1} of ${cad.steps.length} · Day ${step.day}${e.dueDate < today() ? ` · <span class="pill overdue">due ${esc(relDays(e.dueDate))}</span>` : ''}</div>
        </div>
      </div>
      <div class="row">${stepActions(p, subject, body)}</div>
      ${subject || body ? `
        <div class="script">
          ${subject ? `<div class="small"><span class="muted">Subject:</span> <strong>${esc(subject)}</strong></div>` : ''}
          ${body ? `<div class="script-body">${esc(body)}</div>` : ''}
          <button type="button" class="btn sm ghost" id="copy-script">Copy</button>
        </div>` : ''}
      <div class="grid-3">
        ${field('Outcome', `<select name="outcome" id="step-outcome">${type.outcomes.map((o) => `<option>${esc(o)}</option>`).join('')}</select>`)}
        ${field('Then', `<select name="then" id="step-then">${Object.entries(EXIT_OUTCOMES).map(([k, l]) => opt(k, l, outcomeThen(type.outcomes[0], cad))).join('')}</select>`)}
        ${field('Date', `<input name="date" type="date" value="${today()}">`)}
        ${field('Follow-up date', `<input name="followUp" type="date" id="step-fu" value="${shiftDays(today(), 2, true)}">`, 'step-fu')}
        ${field('Notes', '<textarea name="note" rows="2" placeholder="What happened, next steps…"></textarea>', 'span-3')}
      </div>`, (data) => {
      const said = completeStep(p, { outcome: data.outcome, then: data.then, date: data.date, note: data.note, followUp: data.followUp });
      toast(said || (e.status === 'finished' ? `${contact.name}: ${FINISH_LABELS[e.outcome]}` : `Logged · next: ${fmtDate(e.dueDate, { month: 'short', day: 'numeric' })}`));
    }, 'Complete step', { wide: true });
    const copy = $('#copy-script');
    if (copy) copy.addEventListener('click', () => {
      const text = [subject && `Subject: ${subject}`, body].filter(Boolean).join('\n\n');
      (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject()).then(() => toast('Copied'), () => toast('Copy not available'));
    });
    const fuField = $('#step-fu').closest('.field');
    const syncFu = () => { fuField.hidden = $('#step-then').value !== 'pause'; };
    $('#step-outcome').addEventListener('change', (ev) => { $('#step-then').value = outcomeThen(ev.target.value, cad); syncFu(); });
    $('#step-then').addEventListener('change', syncFu);
    syncFu();
  }

  const pickRows = (values) => values.map((v) => { const [aid, cid] = v.split('|'); const a = getAccount(aid); return { a, c: a.contacts.find((c) => c.id === cid) }; });

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
      <div class="ap-spread small">
        <label class="row"><input type="checkbox" name="spread" id="ap-spread" style="width:auto" checked> Spread start dates</label>
        <span>up to <input type="number" name="perDay" id="ap-perday" min="1" max="200" value="${Number(ui.enrollPerDay) || 8}" aria-label="New people per workday"> new people a workday</span>
        <span class="muted" id="ap-spread-note"></span>
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
      const perDay = Math.max(1, Number(data.perDay) || 8);
      ui.enrollPerDay = perDay; savePrefs();
      const rows = pickRows(picks);
      const dated = data.spread && rows.length > perDay ? staggerStarts(rows, data.start || today(), perDay) : rows.map((x) => ({ ...x, date: data.start || today() }));
      for (const x of dated) enroll(cad, x.a, x.c, x.date);
      ui.cadenceId = cad.id;
      const last = dated[dated.length - 1].date;
      toast(`Added ${picks.length} ${picks.length === 1 ? 'person' : 'people'}${last !== dated[0].date ? ` · starts spread to ${fmtDate(last, { weekday: 'short', month: 'short', day: 'numeric' })}` : ''}`);
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
      const perDay = Math.max(1, Number($('#ap-perday').value) || 8);
      const note = $('#ap-spread-note');
      if ($('#ap-spread').checked && n > perDay) {
        const dated = staggerStarts(pickRows($$('#ap-list input:checked').map((x) => x.value)), $('[name=start]', modalForm).value || today(), perDay);
        const days = new Set(dated.map((x) => x.date)).size;
        note.textContent = `→ ${n} people start over ${days} workdays (${fmtDate(dated[0].date, { month: 'short', day: 'numeric' })} – ${fmtDate(dated[dated.length - 1].date, { month: 'short', day: 'numeric' })})`;
      } else note.textContent = n ? `→ all ${n} start on the same day` : '';
    };
    $('#ap-source').addEventListener('change', refresh);
    $('#ap-search').addEventListener('input', refresh);
    $('#ap-primary').addEventListener('change', refresh);
    ['#ap-spread', '#ap-perday', '[name=start]'].forEach((sel) => $(sel, modalForm).addEventListener('input', refresh));
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
      <details class="rules-box" open>
        <summary><strong>Smart rules</strong> <span class="small muted">· what happens after you log an outcome</span></summary>
        ${Object.entries(CAD_RULE_LABELS).map(([k, l]) => `<label class="row small"><input type="checkbox" name="rule_${k}" style="width:auto" ${cadRules(src)[k] ? 'checked' : ''}> ${esc(l)}</label>`).join('')}
      </details>
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
      const rules = Object.fromEntries(Object.keys(CAD_RULE_DEFAULTS).map((k) => [k, !!data['rule_' + k]]));
      const fields = { name: data.name.trim(), description: data.description, color: data.color, skipWeekends: !!data.skipWeekends, rules, steps };
      if (existing) {
        // Keep everyone on the same step (by id) after steps are reordered, added or removed.
        keepEnrollmentSteps(existing, existing.steps, steps);
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

  // ---------- cadence calendar, timelines, workload, results and smart rules ----------
  // The calendar reads the same enrollments as everything else: logged steps sit on the day they
  // were done, each person's current step sits on its due day (overdue ones on today) and later
  // steps are projected from there at the cadence's spacing. Nothing extra is stored.
  const CAD_VIEWS = { steps: 'Steps', calendar: 'Calendar', results: 'Results' };
  const CAD_RULE_DEFAULTS = { pauseOnReply: true, vmEmail: true, noAnswerLi: true, badFlag: true };
  const CAD_RULE_LABELS = {
    pauseOnReply: 'Connected or replied → pause them and set a real follow-up',
    vmEmail: 'Left a voicemail → the email right after it comes due the next workday',
    noAnswerLi: 'No answer twice → add a LinkedIn touch for the next workday',
    badFlag: 'Wrong number or bounced email → finish and flag the contact',
  };
  const CAD_RULE_SHORT = { pauseOnReply: 'pause on reply', vmEmail: 'voicemail → email', noAnswerLi: 'no answer ×2 → LinkedIn', badFlag: 'flag bad data' };
  const cadRules = (cad) => ({ ...CAD_RULE_DEFAULTS, ...((cad && cad.rules) || {}) });
  const POSITIVE = { call: /connected|replied/i, email: /replied/i, linkedin: /replied/i, visit: /met in person/i, text: /replied/i };
  const POSITIVE_LABEL = { call: 'Connected', email: 'Replied', linkedin: 'Replied', visit: 'Met', text: 'Replied' };
  const isPositive = (step, outcome) => !!(POSITIVE[step.type] && POSITIVE[step.type].test(outcome || ''));
  const stepCap = () => Number(ui.stepCap) || 25;
  const nextWorkdayAfter = (iso) => nextWorkday(addDays(iso, 1));
  const pct = (n, d) => (d ? Math.round((n / d) * 100) : 0);

  /** Where each remaining step of an active enrollment lands if it's done on its day (overdue counts from today). */
  function projectSteps(p, shift = 0) {
    const { e, cad } = p;
    if (e.status !== 'active' || !e.dueDate) return [];
    const t = today();
    let d = e.dueDate < t ? t : e.dueDate;
    if (cad.skipWeekends) d = nextWorkday(d);
    if (shift) d = shiftDays(d, shift, cad.skipWeekends);
    const out = [{ i: e.step, date: d, current: true, late: e.dueDate < t }];
    for (let i = e.step + 1; i < cad.steps.length; i++) {
      d = shiftDays(d, Math.max(0, cad.steps[i].day - cad.steps[i - 1].day), cad.skipWeekends);
      out.push({ i, date: d, current: false, late: false });
    }
    return out;
  }

  /** Steps per day between two dates, one chip per cadence + step + state (done, overdue, open). */
  function cadSchedule(from, to, { all = false } = {}) {
    const hidden = all ? {} : ui.cadHidden || {};
    const byDay = {};
    const put = (date, cad, i, st, p, extra) => {
      if (date < from || date > to) return;
      const key = `${cad.id}|${i}|${st}`;
      const day = (byDay[date] ||= {});
      const c = (day[key] ||= { key, date, cad, i, step: cad.steps[i], st, people: [] });
      c.people.push({ p, ...extra });
    };
    for (const p of liveEnrollments()) {
      if (hidden[p.cad.id]) continue;
      for (const h of p.e.history) {
        const i = p.cad.steps.findIndex((s) => s.id === h.stepId);
        if (i !== -1) put(h.date, p.cad, i, 'done', p, { h });
      }
      for (const x of projectSteps(p)) put(x.date, p.cad, x.i, x.late ? 'late' : 'open', p, { current: x.current });
    }
    const order = { late: 0, open: 1, done: 2 };
    const out = {};
    for (const [d, m] of Object.entries(byDay)) out[d] = Object.values(m).sort((a, b) => order[a.st] - order[b.st] || a.cad.name.localeCompare(b.cad.name) || a.i - b.i);
    return out;
  }
  const openCount = (chips) => (chips || []).filter((c) => c.st !== 'done').reduce((n, c) => n + c.people.length, 0);

  function cadChip(c, compact) {
    const n = c.people.length;
    const label = c.step.title || stepType(c.step).label;
    const tip = `${c.cad.name} · Step ${c.i + 1}: ${label} · ${plural(n, 'person', 'people')}${c.st === 'late' ? ' · overdue' : c.st === 'done' ? ' · done' : ''}`;
    return `<button type="button" class="cc-chip st-${c.st}" style="--c:${c.cad.color}" data-act="cc-open" data-date="${c.date}" data-key="${esc(c.key)}" title="${esc(tip)}">
      <span class="cc-top">${stepType(c.step).icon} ${esc(label)}${c.st === 'late' ? ' <b class="cc-late">overdue</b>' : ''}</span>
      ${compact ? `<span class="cc-n">${n}</span>` : `<span class="cc-sub">${esc(c.cad.name)} · ${n}</span>`}
    </button>`;
  }

  function cadCalRange() {
    const anchor = ui.cadCalDate || today();
    if (ui.cadCalMode === 'month') {
      const first = anchor.slice(0, 8) + '01';
      const last = addDays(addMonths(first, 1), -1);
      return { from: weekStart(first), to: addDays(weekStart(last), 6), month: anchor.slice(0, 7) };
    }
    const ws = weekStart(anchor);
    return { from: ws, to: addDays(ws, 6) };
  }

  function cadCalendarCard() {
    const t = today();
    const isMonth = ui.cadCalMode === 'month';
    const { from, to, month } = cadCalRange();
    const sched = cadSchedule(from, to);
    const dates = [];
    for (let d = from; d <= to; d = addDays(d, 1)) dates.push(d);
    const weekend = dates.some((d) => isWeekend(d) && sched[d]);
    const cols = dates.filter((d) => weekend || !isWeekend(d));
    const cap = stepCap();
    const hidden = ui.cadHidden || {};
    const title = isMonth ? fmtDate(month + '-01', { month: 'long', year: 'numeric' })
      : `${fmtDate(from, { month: 'short', day: 'numeric' })} – ${fmtDate(addDays(from, weekend ? 6 : 4), { month: 'short', day: 'numeric', year: 'numeric' })}`;
    const inRange = from <= t && t <= to;
    const MAX = isMonth ? 3 : 99;
    return `
      <div class="card cc-card">
        <div class="cc-bar">
          <div class="seg" role="group" aria-label="Calendar range">
            <button type="button" class="${isMonth ? '' : 'active'}" data-act="cc-mode" data-mode="week">Work week</button>
            <button type="button" class="${isMonth ? 'active' : ''}" data-act="cc-mode" data-mode="month">Month</button>
          </div>
          <button class="btn ghost sm" data-act="cc-shift" data-n="-1" title="Previous" aria-label="Previous">‹</button>
          <h2>${esc(title)}</h2>
          <button class="btn ghost sm" data-act="cc-shift" data-n="1" title="Next" aria-label="Next">›</button>
          ${inRange ? '' : '<button class="btn ghost sm" data-act="cc-today">Today</button>'}
          <div class="cc-legend">${state.cadences.map((c) => `<button type="button" class="cc-leg ${hidden[c.id] ? 'off' : ''}" data-act="cc-hide" data-cad="${c.id}" style="--c:${c.color}" title="Show or hide ${esc(c.name)}"><i></i>${esc(c.name)} <span class="muted">(${liveEnrollments(c.id).filter((p) => p.e.status !== 'finished').length})</span></button>`).join('')}</div>
        </div>
        <div class="cc-scroll"><div class="cc-grid ${isMonth ? 'month' : 'week'}" style="--cols:${weekend ? 7 : 5}">
          ${cols.map((d) => {
            const chips = sched[d] || [];
            const n = openCount(chips);
            const cls = [d === t ? 'today' : '', d < t ? 'past' : '', isMonth && d.slice(0, 7) !== month ? 'out' : ''].join(' ');
            return `<div class="cc-day ${cls}">
              <div class="cc-dhead">
                <b>${esc(fmtDate(d, { weekday: 'short' }))}</b>
                <span>${esc(isMonth ? String(fromISO(d).getDate()) : fmtDate(d, { month: 'short', day: 'numeric' }))}</span>
                ${n ? `<button type="button" class="cc-dn ${n > cap ? 'over' : ''}" data-act="cc-day" data-date="${d}" title="${plural(n, 'step')} due · move or skip">${n}</button>` : ''}
              </div>
              <div class="cc-chips">${chips.slice(0, MAX).map((c) => cadChip(c, isMonth)).join('')}${chips.length > MAX ? `<button type="button" class="cc-more" data-act="cc-day" data-date="${d}">+${chips.length - MAX} more</button>` : ''}</div>
            </div>`;
          }).join('')}
        </div></div>
        <div class="cc-foot"><span>Faded = done · <span class="cc-late">red outline</span> = overdue · number = people on that step · day count turns red over your capacity (${cap})</span><span>Click a step to see who's on it or work it · click a day's count to move or skip that day</span></div>
      </div>`;
  }

  /** Cadence templates on one day axis: the shape of each cadence. Drag a step to change its day. */
  function cadTimelinesCard() {
    const cads = state.cadences.filter((c) => !(ui.cadHidden || {})[c.id] && c.steps.length);
    const maxDay = Math.max(21, ...cads.map(cadenceDays));
    const pos = (day) => ((day - 1) / (maxDay - 1)) * 100;
    const every = maxDay > 49 ? 14 : 7;
    const ticks = [1]; for (let d = every; d <= maxDay; d += every) ticks.push(d);
    const warn = (cad) => {
      const out = [];
      for (let i = 1; i < cad.steps.length; i++) {
        const gap = cad.steps[i].day - cad.steps[i - 1].day;
        if (gap >= 7) { out.push(`${gap}-day gap after step ${i}`); break; }
      }
      for (let i = 1; i < cad.steps.length; i++) {
        if (cad.steps[i].type === 'call' && cad.steps[i - 1].type === 'call' && cad.steps[i].day - cad.steps[i - 1].day <= 1) { out.push(`calls back to back (steps ${i}–${i + 1})`); break; }
      }
      return out;
    };
    return `
      <div class="card tl-card">
        <h2 style="margin:0">Cadence timelines</h2>
        <p class="small muted" style="margin:.2rem 0 .6rem">The shape of each cadence: where its steps land over its full length. Drag a step to change its day; click one to edit the cadence.</p>
        ${cads.length ? `
          <div class="tl-axis"><span></span><div class="tl-track tl-ticks"><div class="tl-in">${ticks.map((d) => `<span style="left:${pos(d)}%">Day ${d}</span>`).join('')}</div></div></div>
          ${cads.map((cad) => {
            const groups = new Map();
            cad.steps.forEach((s, i) => { if (!groups.has(s.day)) groups.set(s.day, []); groups.get(s.day).push({ s, i }); });
            const w = warn(cad);
            // Steps a few days apart would overlap on the line: stagger them above and below it.
            const level = new Map(); const days = [...groups.keys()];
            for (let k = 0; k < days.length;) {
              let j = k;
              while (j + 1 < days.length && (days[j + 1] - days[j]) / (maxDay - 1) < 0.1) j++;
              for (let m = k; m <= j; m++) level.set(days[m], j > k ? ((m - k) % 2 ? 'lo' : 'hi') : '');
              k = j + 1;
            }
            const n = liveEnrollments(cad.id).filter((p) => p.e.status !== 'finished').length;
            return `<div class="tl-row" style="--c:${cad.color}">
              <div class="tl-name"><b>${esc(cad.name)}</b><span class="small muted">${n} enrolled · ${plural(cadenceDays(cad), 'day')} · ${plural(cad.steps.length, 'step')}</span>${w.length ? `<span class="tl-warn">⚠ ${esc(w.join(' · '))}</span>` : ''}</div>
              <div class="tl-track"><div class="tl-in" data-cad="${cad.id}" data-max="${maxDay}">
                <div class="tl-line"></div>
                ${[...groups].map(([day, list]) => `<div class="tl-grp ${level.get(day)}" style="left:${pos(day)}%">${list.map(({ s, i }) => `<button type="button" class="tl-step" data-step="${s.id}" data-day="${day}" title="${esc(`Day ${day} · Step ${i + 1}: ${s.title || stepType(s).label} (drag to change the day)`)}">${stepType(s).icon}<b>${i + 1}</b></button>`).join('')}</div>`).join('')}
              </div></div>
            </div>`;
          }).join('')}` : '<div class="empty">No cadences to show.</div>'}
      </div>`;
  }

  /** Move one step to another day of its cadence; people stay on the step they're on. */
  function keepEnrollmentSteps(cad, oldSteps, steps) {
    for (const e of state.enrollments.filter((x) => x.cadenceId === cad.id && x.status !== 'finished')) {
      const oldId = (oldSteps[e.step] || {}).id;
      const idx = steps.findIndex((s) => s.id === oldId);
      e.step = idx === -1 ? Math.min(e.step, steps.length - 1) : idx;
    }
  }
  function setStepDay(cad, stepId, day) {
    const before = cad.steps.slice();
    const s = cad.steps.find((x) => x.id === stepId);
    if (!s) return;
    s.day = Math.max(1, day);
    const steps = cad.steps.map((x, i) => ({ x, i })).sort((a, b) => a.x.day - b.x.day || a.i - b.i).map((o) => o.x);
    keepEnrollmentSteps(cad, before, steps);
    cad.steps = steps;
  }

  function bindTimelines() {
    $$('.tl-step').forEach((btn) => {
      btn.addEventListener('pointerdown', (ev) => {
        if (ev.button !== 0) return;
        const track = btn.closest('.tl-in');
        const cad = cadenceById(track.dataset.cad);
        const max = Number(track.dataset.max);
        const r = track.getBoundingClientRect();
        const x0 = ev.clientX;
        const day0 = Number(btn.dataset.day);
        let day = day0; let moved = false;
        const tip = document.createElement('span');
        tip.className = 'tl-tip';
        btn.setPointerCapture(ev.pointerId);
        const move = (e2) => {
          const dx = e2.clientX - x0;
          if (!moved && Math.abs(dx) < 4) return;
          if (!moved) { moved = true; btn.classList.add('dragging'); btn.appendChild(tip); }
          day = Math.round(1 + Math.min(1, Math.max(0, (e2.clientX - r.left) / r.width)) * (max - 1));
          btn.style.transform = `translateX(${dx}px)`;
          tip.textContent = `Day ${day}`;
        };
        const up = () => {
          btn.removeEventListener('pointermove', move);
          btn.removeEventListener('pointerup', up);
          btn.removeEventListener('pointercancel', up);
          if (!moved) return cadenceForm(cad);
          btn.style.transform = '';
          if (day === day0) { rerender(); return; }
          const i = cad.steps.findIndex((s) => s.id === btn.dataset.step);
          setStepDay(cad, btn.dataset.step, day);
          save(); rerender();
          toast(`Step ${i + 1} moved to day ${day}`);
        };
        btn.addEventListener('pointermove', move);
        btn.addEventListener('pointerup', up);
        btn.addEventListener('pointercancel', up);
      });
    });
  }

  /** Steps landing per workday over the next two weeks, stacked by cadence, against a daily capacity. */
  function cadWorkloadCard() {
    const t = today();
    const cap = stepCap();
    const days = [];
    for (let d = nextWorkday(t); days.length < 10; d = nextWorkdayAfter(d)) days.push(d);
    const sched = cadSchedule(days[0], days[days.length - 1], { all: true });
    const rows = days.map((d) => {
      const by = new Map();
      for (const c of (sched[d] || []).filter((x) => x.st !== 'done')) by.set(c.cad, (by.get(c.cad) || 0) + c.people.length);
      return { d, by: [...by], tot: [...by.values()].reduce((a, b) => a + b, 0) };
    });
    const max = Math.max(cap, ...rows.map((r) => r.tot)) * 1.12;
    const over = rows.filter((r) => r.tot > cap);
    const worst = over.slice().sort((a, b) => b.tot - a.tot)[0];
    const movable = over.length ? rebalancePlan().length : 0;
    const firstWeek = weekStart(days[0]);
    return `
      <div class="card wl-card">
        <div class="section-head" style="margin-bottom:.2rem"><h2 style="margin:0">Workload, next 2 weeks</h2>
          <button type="button" class="link-btn small" data-act="cc-cap" title="Change your daily capacity">Capacity ${cap}/day ✎</button></div>
        <p class="small muted" style="margin:0 0 .75rem">Steps landing per day across all cadences if you keep pace. Spot pile-ups before enrolling the next batch.</p>
        <div class="wl-plot">
          <div class="wl-area"><div class="wl-cap" style="bottom:${(cap / max) * 100}%" title="Capacity ${cap} a day"></div></div>
          ${rows.map((r) => `<div class="wl-col ${weekStart(r.d) !== firstWeek && r.d === days.find((x) => weekStart(x) !== firstWeek) ? 'wk2' : ''}" title="${esc(`${fmtDate(r.d, { weekday: 'long', month: 'short', day: 'numeric' })}: ${plural(r.tot, 'step')}${r.by.length ? ' (' + r.by.map(([c, n]) => `${c.name} ${n}`).join(', ') + ')' : ''}`)}">
            <span class="wl-num ${r.tot > cap ? 'over' : ''}">${r.tot || ''}</span>
            <div class="wl-bar" style="height:${(r.tot / max) * 100}%">${r.by.map(([c, n]) => `<i style="height:${(n / r.tot) * 100}%;--c:${c.color}"></i>`).join('')}</div>
          </div>`).join('')}
        </div>
        <div class="wl-labels">${rows.map((r) => `<div class="${r.d === days.find((x) => weekStart(x) !== firstWeek) ? 'wk2' : ''} ${r.d === t ? 'now' : ''}">${esc(fmtDate(r.d, { weekday: 'short' }))}<span>${fromISO(r.d).getDate()}</span></div>`).join('')}</div>
        <div class="wl-sum">
          ${over.length ? `<span><b class="cc-late">${esc(fmtDate(worst.d, { weekday: 'long' }))} has ${worst.tot} steps</b>, ${worst.tot - cap} over your capacity${over.length > 1 ? ` · ${plural(over.length, 'day')} over` : ''}.${movable ? '' : ' These come from later steps of people already under way, so they ease as you work through them. Spread start dates when you enroll the next batch.'}</span>
            ${movable ? `<button type="button" class="btn sm" data-act="cc-rebalance">Spread it out</button>` : ''}`
            : `<span class="muted">Every day is at or under your capacity of ${cap}.</span>`}
        </div>
      </div>`;
  }

  /** Push current steps forward a workday at a time (whole sequences move with them) until each day fits the capacity. */
  function rebalancePlan() {
    const cap = stepCap();
    const people = liveEnrollments().filter((p) => p.e.status === 'active' && p.e.dueDate);
    const shift = new Map();
    const plan = (p) => projectSteps(p, shift.get(p.e.id) || 0);
    let d = nextWorkday(today());
    for (let k = 0; k < 40; k++, d = nextWorkdayAfter(d)) {
      let n = people.reduce((s, p) => s + plan(p).filter((x) => x.date === d).length, 0);
      if (n <= cap) continue;
      // Keep the most overdue where they are; move the most recently due first, an account at a time.
      const movable = people.filter((p) => plan(p)[0].date === d)
        .sort((a, b) => b.e.dueDate.localeCompare(a.e.dueDate) || b.acct.name.localeCompare(a.acct.name));
      for (const p of movable) {
        if (n <= cap) break;
        shift.set(p.e.id, (shift.get(p.e.id) || 0) + 1);
        n -= 1;
      }
    }
    return people.filter((p) => shift.get(p.e.id)).map((p) => ({ p, to: plan(p)[0].date }));
  }

  function rebalanceForm() {
    const moves = rebalancePlan();
    if (!moves.length) { toast('Nothing to move: the pile-up comes from later steps already in motion'); return; }
    const t = today();
    const days = [];
    for (let d = nextWorkday(t); days.length < 10; d = nextWorkdayAfter(d)) days.push(d);
    const load = () => { const s = cadSchedule(days[0], days[days.length - 1], { all: true }); return days.map((d) => openCount(s[d])); };
    const before = load();
    const saved = moves.map(({ p }) => [p.e, p.e.dueDate]);
    moves.forEach(({ p, to }) => { p.e.dueDate = to; });
    const after = load();
    saved.forEach(([e, d]) => { e.dueDate = d; });
    const late = moves.filter(({ p }) => p.e.dueDate < t).length;
    openModal('Spread out the pile-up', `
      <p class="small" style="margin:0">Moves <b>${plural(moves.length, 'current step')}</b> to later workdays so no day goes over <b>${stepCap()}</b>. Each person's later steps move with them, keeping the cadence spacing.${late ? ` ${plural(late, 'overdue step')} will be rescheduled.` : ''}</p>
      <table class="rs-table">
        <thead><tr><th>Day</th><th>Now</th><th>After</th></tr></thead>
        <tbody>${days.map((d, i) => before[i] === after[i] ? '' : `<tr><td>${esc(fmtDate(d, { weekday: 'short', month: 'short', day: 'numeric' }))}</td><td class="${before[i] > stepCap() ? 'cc-late' : ''}">${before[i]}</td><td><b>${after[i]}</b></td></tr>`).join('')}</tbody>
      </table>
      ${after.some((n) => n > stepCap()) ? `<p class="small" style="margin:0">${plural(after.filter((n) => n > stepCap()).length, 'day')} will still be over: those are later steps of people already under way, and they ease as you work through them.</p>` : ''}
      <p class="small muted" style="margin:0">The most overdue people stay first in line. You can move anyone back from their cadence page.</p>`, () => {
      moves.forEach(({ p, to }) => { p.e.dueDate = to; });
      toast(`${plural(moves.length, 'step')} spread out`);
    }, 'Spread out', { wide: true });
  }

  /** Who is on one chip (a cadence step on a day), with a session button when it's due. */
  function cadChipForm(date, key) {
    const chip = (cadSchedule(date, date, { all: true })[date] || []).find((c) => c.key === key);
    if (!chip) return;
    const t = today();
    const label = chip.step.title || stepType(chip.step).label;
    const due = chip.st !== 'done' && date <= t;
    const movable = chip.people.filter((x) => x.current).map((x) => x.p.e.id);
    const state_ = (x) => {
      if (x.h) return x.h.skipped ? 'Skipped' : x.h.outcome || 'Done';
      if (x.current) return x.p.e.dueDate < t ? `<span class="cc-late">Due ${esc(relDays(x.p.e.dueDate))}</span>` : 'Current step';
      return `After step ${x.p.e.step + 1} (due ${esc(shortDate(x.p.e.dueDate < t ? t : x.p.e.dueDate))})`;
    };
    openModal(`${chip.cad.name} · Step ${chip.i + 1}`, `
      <div class="enr-head">
        ${stepIcon(chip.step, 'lg')}
        <div class="grow"><strong>${esc(label)}</strong>
          <div class="small muted">${esc(fmtDate(date, { weekday: 'long', month: 'short', day: 'numeric' }))} · ${plural(chip.people.length, 'person', 'people')}${chip.st === 'done' ? ' · done' : chip.st === 'late' ? ' · overdue' : date > t ? ' · planned' : ''}</div></div>
      </div>
      ${due ? `<button type="button" class="btn" id="cc-work">▶ Work ${chip.people.length === 1 ? 'it' : `these ${chip.people.length}`} now</button>` : ''}
      <div class="cc-people">${chip.people.map((x) => `
        <button type="button" class="cc-person" data-eid="${x.p.e.id}">
          <span class="avatar sm" style="--c:${chip.cad.color}">${esc(initials(x.p.contact.name))}</span>
          <span class="grow"><strong>${esc(x.p.contact.name)}</strong> <span class="small muted">· ${esc(x.p.acct.name)}</span></span>
          <span class="small">${state_(x)}</span>
        </button>`).join('')}</div>
      ${movable.length && chip.st !== 'done' ? `<button type="button" class="btn ghost sm" id="cc-move">Move ${movable.length === 1 ? 'this step' : `these ${movable.length} steps`}…</button>` : ''}
      ${chip.people.length > movable.length && chip.st !== 'done' ? `<p class="small muted" style="margin:0">${plural(chip.people.length - movable.length, 'person', 'people')} reach this step later; it moves when their earlier step does.</p>` : ''}`, () => {}, 'Close', { wide: true });
    modalForm.querySelector('.modal-actions [data-close]').remove();
    const work = $('#cc-work');
    if (work) work.addEventListener('click', () => { modal.close(); startSession({ type: 'all', cadenceId: chip.cad.id, stepNo: String(chip.i + 1) }); });
    const mv = $('#cc-move');
    if (mv) mv.addEventListener('click', () => cadMoveForm(movable, `${chip.cad.name} · Step ${chip.i + 1}`, date));
    $$('.cc-person', modalForm).forEach((b) => b.addEventListener('click', () => enrollmentDetail(b.dataset.eid)));
  }

  /** Everything on one day, with bulk move and skip for the current steps. */
  function cadDayForm(date) {
    const chips = (cadSchedule(date, date, { all: true })[date] || []).filter((c) => c.st !== 'done');
    if (!chips.length) return;
    const t = today();
    const movable = chips.flatMap((c) => c.people.filter((x) => x.current).map((x) => x.p.e.id));
    const later = openCount(chips) - movable.length;
    openModal(fmtDate(date, { weekday: 'long', month: 'long', day: 'numeric' }), `
      <div class="cc-people">${chips.map((c) => `
        <button type="button" class="cc-person" data-key="${esc(c.key)}" style="--c:${c.cad.color}">
          ${stepIcon(c.step)}
          <span class="grow"><strong>${esc(c.step.title || stepType(c.step).label)}</strong> <span class="small muted">· ${esc(c.cad.name)} · step ${c.i + 1}</span></span>
          <span class="small ${c.st === 'late' ? 'cc-late' : ''}">${plural(c.people.length, 'person', 'people')}${c.st === 'late' ? ' · overdue' : ''}</span>
        </button>`).join('')}</div>
      <p class="small muted" style="margin:0">${plural(movable.length, 'current step')} can be moved${later ? `; ${plural(later, 'later step')} follow their earlier step` : ''}.</p>
      ${movable.length ? `<div class="row">
        <button type="button" class="btn ghost sm" id="cd-move">Move ${movable.length === 1 ? 'it' : `all ${movable.length}`}…</button>
        ${date <= t ? `<button type="button" class="btn ghost sm" id="cd-skip">Skip ${movable.length === 1 ? 'it' : `all ${movable.length}`}</button>` : ''}
      </div>` : ''}`, () => {}, 'Close', { wide: true });
    modalForm.querySelector('.modal-actions [data-close]').remove();
    $$('.cc-person', modalForm).forEach((b) => b.addEventListener('click', () => cadChipForm(date, b.dataset.key)));
    const mv = $('#cd-move');
    if (mv) mv.addEventListener('click', () => cadMoveForm(movable, fmtDate(date, { weekday: 'long', month: 'short', day: 'numeric' }), date));
    const sk = $('#cd-skip');
    if (sk) sk.addEventListener('click', () => {
      if (!confirm(`Skip ${plural(movable.length, 'step')}? Each person moves on to their next step.`)) return;
      for (const id of movable) {
        const p = enrollmentParts(state.enrollments.find((x) => x.id === id) || {});
        if (!p || p.e.status !== 'active') continue;
        p.e.history.push({ stepId: p.step.id, date: t, skipped: true });
        advance(p, t);
      }
      modal.close(); save(); rerender();
      toast(`${plural(movable.length, 'step')} skipped`);
    });
  }

  function cadMoveForm(eids, label, fromDate) {
    const t = today();
    const base = fromDate < t ? t : fromDate;
    const opts = [['next', `Next workday (${fmtDate(nextWorkdayAfter(base), { weekday: 'short', month: 'short', day: 'numeric' })})`], ['week', `A week later (${fmtDate(addDays(base, 7), { weekday: 'short', month: 'short', day: 'numeric' })})`], ['pick', 'Pick a date']];
    openModal(`Move ${plural(eids.length, 'step')}`, `
      <p class="small muted" style="margin:0">${esc(label)}. Each person's later steps move with them.</p>
      <div class="grid-2">
        ${field('Move to', `<select name="when" id="mv-when">${opts.map(([k, l]) => opt(k, l, 'next')).join('')}</select>`)}
        ${field('Date', `<input name="date" type="date" id="mv-date" value="${nextWorkdayAfter(base)}" min="${t}">`)}
      </div>`, (data) => {
      const to = data.when === 'next' ? nextWorkdayAfter(base) : data.when === 'week' ? addDays(base, 7) : data.date;
      if (!to) return false;
      let n = 0;
      for (const id of eids) {
        const e = state.enrollments.find((x) => x.id === id);
        if (!e || e.status !== 'active') continue;
        const cad = cadenceById(e.cadenceId);
        e.dueDate = cad && cad.skipWeekends ? nextWorkday(to) : to;
        n++;
      }
      toast(`${plural(n, 'step')} moved to ${fmtDate(to, { weekday: 'short', month: 'short', day: 'numeric' })}`);
    }, 'Move');
    const when = $('#mv-when'); const date = $('#mv-date');
    const sync = () => { date.closest('.field').hidden = when.value !== 'pick'; };
    when.addEventListener('change', sync); sync();
  }

  /** Per-step and per-cadence results from logged outcomes. */
  function cadResults(cad) {
    const ens = state.enrollments.filter((e) => e.cadenceId === cad.id);
    const steps = cad.steps.map((s, i) => ({ s, i, done: 0, skipped: 0, pos: 0 }));
    let reached = 0; let engaged = 0;
    for (const e of ens) {
      let r = false; let g = false;
      for (const h of e.history) {
        const x = steps.find((y) => y.s.id === h.stepId);
        if (!x) continue;
        if (h.skipped) { x.skipped++; continue; }
        x.done++; r = true;
        if (isPositive(x.s, h.outcome)) { x.pos++; g = true; }
      }
      if (['meeting', 'replied', 'referred'].includes(e.outcome)) g = true;
      reached += r ? 1 : 0; engaged += g ? 1 : 0;
    }
    return {
      enrolled: ens.length, active: ens.filter((e) => e.status === 'active').length, reached, engaged,
      meetings: ens.filter((e) => e.outcome === 'meeting').length, bad: ens.filter((e) => e.outcome === 'bad').length, steps,
    };
  }

  function cadResultsView(cad) {
    const all = state.cadences.map((c) => ({ c, r: cadResults(c) }));
    const ranked = all.filter((x) => x.r.reached >= 5);
    const best = ranked.sort((a, b) => b.r.engaged / b.r.reached - a.r.engaged / a.r.reached)[0];
    const r = cadResults(cad);
    const rated = r.steps.filter((x) => POSITIVE[x.s.type] && x.done >= 5);
    const top = rated.slice().sort((a, b) => b.pos / b.done - a.pos / a.done)[0];
    const first = rated[0];
    const insight = top && first && top.i > first.i && top.pos / top.done >= 1.5 * (first.pos / first.done || 0.0001) && top.pos
      ? `Step ${top.i + 1} (${esc(top.s.title || stepType(top.s).label)}) gets ${pct(top.pos, top.done)}% ${POSITIVE_LABEL[top.s.type].toLowerCase()} vs ${pct(first.pos, first.done)}% for step ${first.i + 1}. Consider moving it earlier.`
      : r.steps.reduce((n, x) => n + x.done, 0) < 20 ? 'Rates firm up after a few weeks of logged outcomes. Under 10 completions a step, treat them as early signals.' : '';
    const rateCell = (n, d, color) => `<div class="rs-rate" style="--c:${color}"><span class="bar"><i style="width:${pct(n, d)}%"></i></span><b>${d ? pct(n, d) + '%' : '—'}</b></div>`;
    return `
      <div class="card">
        <h2 style="margin:0">Compare cadences</h2>
        <p class="small muted" style="margin:.2rem 0 .5rem">Engaged = connected, replied, met or booked a meeting at any step. Rate = engaged ÷ people reached.</p>
        <div class="rs-wrap"><table class="rs-table">
          <thead><tr><th>Cadence</th><th>Enrolled</th><th>Reached</th><th>Engaged</th><th>Engage rate</th><th>Meetings</th><th>Bad data</th></tr></thead>
          <tbody>${all.map(({ c, r: x }) => `<tr>
            <td><button type="button" class="link-btn" data-act="cad-open" data-cad="${c.id}"><span class="dot" style="--c:${c.color}"></span>${esc(c.name)}</button>${best && best.c === c && ranked.length > 1 ? ' <span class="rs-best">Best</span>' : ''}</td>
            <td>${x.enrolled}</td><td>${x.reached}</td><td>${x.engaged}</td><td>${rateCell(x.engaged, x.reached, c.color)}</td><td>${x.meetings}</td><td>${x.bad}</td>
          </tr>`).join('')}</tbody>
        </table></div>
      </div>
      <div class="card" style="margin-top:1rem;--c:${cad.color}">
        <h2 style="margin:0">Step by step · ${esc(cad.name)}</h2>
        <p class="small muted" style="margin:.2rem 0 .5rem">${r.enrolled} enrolled · ${r.reached} reached · ${r.engaged} engaged · ${r.meetings} meetings</p>
        <div class="rs-wrap"><table class="rs-table">
          <thead><tr><th>#</th><th>Step</th><th>Day</th><th>Done</th><th>Skipped</th><th>Result</th><th>Rate</th></tr></thead>
          <tbody>${r.steps.map((x) => `<tr>
            <td>${x.i + 1}</td>
            <td>${stepIcon(x.s, 'xs')} ${esc(x.s.title || stepType(x.s).label)}</td>
            <td>${x.s.day}</td><td>${x.done}</td><td>${x.skipped}</td>
            <td>${POSITIVE[x.s.type] ? `${POSITIVE_LABEL[x.s.type]} ${x.pos} of ${x.done}` : '<span class="muted">—</span>'}</td>
            <td>${POSITIVE[x.s.type] ? rateCell(x.pos, x.done, cad.color) : ''}</td>
          </tr>`).join('')}</tbody>
        </table></div>
        ${insight ? `<div class="rs-insight">${insight}</div>` : ''}
      </div>`;
  }

  function cadPageHead(view) {
    const t = today();
    const live = liveEnrollments().filter((p) => p.e.status !== 'finished');
    const wk = Object.values(cadSchedule(t, addDays(weekStart(t), 6), { all: true })).reduce((n, chips) => n + openCount(chips), 0);
    const dueN = dueSteps(t).length;
    return `
      <div class="page-head">
        <div>
          <h1>Cadences</h1>
          <div class="muted small">${plural(state.cadences.length, 'cadence')} · ${plural(live.length, 'person', 'people')} enrolled · ${plural(wk, 'step')} due this week</div>
        </div>
        <div class="row">
          <div class="seg" role="group" aria-label="Cadence view">${Object.entries(CAD_VIEWS).map(([k, l]) => `<button type="button" class="${view === k ? 'active' : ''}" data-act="cad-view" data-view="${k}">${l}</button>`).join('')}</div>
          ${session && session.idx < session.queue.length ? `<a class="btn" href="#session">▶ Resume session · ${Math.min(session.idx + 1, session.queue.length)} of ${session.queue.length}</a>` : `<button class="btn" data-act="session-setup">▶ Start session${dueN ? ` · ${dueN} due` : ''}</button>`}
          <button class="btn ghost" data-act="cad-new">+ New cadence</button>
        </div>
      </div>`;
  }

  const cadSwitchRow = (cad) => `
      <div class="cad-switch">
        ${state.cadences.map((c) => {
          const live = liveEnrollments(c.id);
          const dueN = live.filter((p) => isDue(p.e)).length;
          return `<button type="button" class="cad-chip ${c.id === cad.id ? 'active' : ''}" data-act="cad-open" data-cad="${c.id}" style="--c:${c.color}">
            <span class="dot"></span>${esc(c.name)} <span class="muted">${live.filter((p) => p.e.status !== 'finished').length}</span>
            ${dueN ? `<span class="due-badge">${dueN} due</span>` : ''}
          </button>`;
        }).join('')}
      </div>`;

  /** Start a session straight away (no setup dialog). */
  function startSession(filt) {
    const list = sessionCandidates(filt);
    if (!list.length) { toast('Nothing due for that choice'); return; }
    session = { filter: filt, queue: list.map((p) => p.e.id), idx: 0, results: [], startedAt: new Date().toISOString() };
    saveSession();
    go('session');
  }

  /** Spread a batch of new people over workdays, keeping people at one account on the same day. */
  function staggerStarts(picks, start, perDay) {
    const groups = new Map();
    for (const x of picks) { if (!groups.has(x.a.id)) groups.set(x.a.id, []); groups.get(x.a.id).push(x); }
    const out = [];
    let day = nextWorkday(start); let used = 0;
    for (const group of groups.values()) {
      if (used && used + group.length > perDay && group.length <= perDay) { day = nextWorkdayAfter(day); used = 0; }
      for (const x of group) {
        if (used >= perDay) { day = nextWorkdayAfter(day); used = 0; }
        out.push({ ...x, date: day }); used++;
      }
    }
    return out;
  }

  // ---------- step sessions (power dialer style) ----------
  // A session is a queue of due cadence steps worked one after another: call, pick an outcome,
  // and the next person loads. It survives an app reload (iPhone can reload the app after a call).
  const SESSION_KEY = 'minicrm.session';
  const SESSION_TYPES = { call: 'Calls', email: 'Emails', linkedin: 'LinkedIn', all: 'All step types' };
  let session = null;
  try { session = JSON.parse(localStorage.getItem(SESSION_KEY)) || null; } catch (e) { session = null; }
  const saveSession = () => {
    try { if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session)); else localStorage.removeItem(SESSION_KEY); } catch (e) { /* ignore */ }
  };

  /** Due steps (today and overdue) matching a session filter, grouped account by account. */
  function sessionCandidates(f) {
    const t = today();
    const list = dueSteps(t).filter((p) => (f.type === 'all' || p.step.type === f.type)
      && (f.cadenceId === 'all' || p.cad.id === f.cadenceId)
      && (!f.stepNo || p.e.step + 1 === Number(f.stepNo)));
    // Accounts with the most overdue step first; everyone at that account back to back.
    const firstDue = new Map();
    for (const p of list) if (!firstDue.has(p.acct.id) || p.e.dueDate < firstDue.get(p.acct.id)) firstDue.set(p.acct.id, p.e.dueDate);
    return list.sort((a, b) => firstDue.get(a.acct.id).localeCompare(firstDue.get(b.acct.id)) || a.acct.name.localeCompare(b.acct.name)
      || a.e.dueDate.localeCompare(b.e.dueDate) || (b.contact.primary ? 1 : 0) - (a.contact.primary ? 1 : 0));
  }

  /** Pick what to work: step type, cadence and step number, with a live count. */
  function sessionSetupForm(preset = {}) {
    const f = { type: 'call', cadenceId: 'all', stepNo: '', ...preset };
    const maxSteps = Math.max(1, ...state.cadences.map((c) => c.steps.length));
    openModal('Start a session', `
      <p class="small muted" style="margin:0">Work through due cadence steps one after another, account by account. Pick an outcome and the next person loads.</p>
      <div class="grid-3">
        ${field('Steps', `<select name="type" id="ss-type">${Object.entries(SESSION_TYPES).map(([k, l]) => opt(k, l, f.type)).join('')}</select>`)}
        ${field('Cadence', `<select name="cadenceId" id="ss-cad"><option value="all">All cadences</option>${state.cadences.map((c) => opt(c.id, c.name, f.cadenceId)).join('')}</select>`)}
        ${field('Step number', `<select name="stepNo" id="ss-step"><option value="">Any step</option>${Array.from({ length: maxSteps }, (_, i) => opt(String(i + 1), `Step ${i + 1}`, String(f.stepNo))).join('')}</select>`)}
      </div>
      <div class="ss-count" id="ss-count"></div>`, (data) => {
      const filt = { type: data.type, cadenceId: data.cadenceId, stepNo: data.stepNo };
      const list = sessionCandidates(filt);
      if (!list.length) { toast('Nothing due for that choice'); return false; }
      session = { filter: filt, queue: list.map((p) => p.e.id), idx: 0, results: [], startedAt: new Date().toISOString() };
      saveSession();
      setTimeout(() => go('session'), 0);
    }, 'Start');
    const count = () => {
      const filt = { type: $('#ss-type').value, cadenceId: $('#ss-cad').value, stepNo: $('#ss-step').value };
      const list = sessionCandidates(filt);
      const accts = new Set(list.map((p) => p.acct.id)).size;
      const late = list.filter((p) => p.e.dueDate < today()).length;
      $('#ss-count').innerHTML = list.length
        ? `<b>${plural(list.length, 'step')}</b> due across ${plural(accts, 'account')}${late ? ` · <span class="pill overdue">${late} overdue</span>` : ''}`
        : '<span class="muted">Nothing due for this choice.</span>';
      $('.modal-actions [type=submit]', modalForm).disabled = !list.length;
    };
    ['#ss-type', '#ss-cad', '#ss-step'].forEach((s) => $(s).addEventListener('change', count));
    count();
  }

  /** Buttons that start the touch itself: call, email, LinkedIn, text, directions. */
  function stepActions(p, subject, body) {
    const { acct, contact, step } = p;
    const liUrl = contact.linkedin ? extUrl(contact.linkedin)
      : `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(`${contact.name} ${acct.name}`)}`;
    const phones = [[contact.phone, 'Direct'], [contact.mobile, 'Mobile'], [acct.mainPhone, 'Main line']].filter(([n]) => n);
    return {
      call: phones.length ? phones.map(([n, l], i) => `<a class="btn ${i ? 'ghost' : ''} call-btn" href="tel:${esc(n)}">☎ ${esc(l)} · ${esc(n)}</a>`).join(' ') : '<span class="small muted">No phone on file. Add one on the contact.</span>',
      email: contact.email ? `<a class="btn" href="mailto:${esc(contact.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}">✉ Open in Mail</a>` : '<span class="small muted">No email on file for this contact.</span>',
      linkedin: `<a class="btn" href="${esc(liUrl)}" target="_blank" rel="noopener">in Open LinkedIn</a>`,
      visit: `<a class="btn" href="https://maps.apple.com/?q=${encodeURIComponent([acct.name, acct.address, acct.location].filter(Boolean).join(' '))}" target="_blank" rel="noopener">⌂ Directions</a>`,
      text: contact.mobile ? `<a class="btn" href="sms:${esc(contact.mobile)}&body=${encodeURIComponent(body)}">✆ Text ${esc(contact.mobile)}</a>` : '<span class="small muted">No mobile number on file.</span>',
      task: '',
    }[step.type] || '';
  }

  /**
   * Record a completed step: account history, cadence history, planner count, then advance, pause or
   * finish. The cadence's smart rules run here, so the log form and sessions behave the same.
   * Returns a short note of what the rules did (for the toast).
   */
  function completeStep(p, { outcome, then = 'continue', date = today(), note = '', followUp = '' }) {
    const { e, cad, acct, contact, step } = p;
    const type = stepType(step);
    const rules = cadRules(cad);
    const said = [];
    const actId = uid();
    acct.activities.push({
      id: actId, date, kind: type.kind, contactId: contact.id, createdAt: new Date().toISOString(),
      summary: `${cad.name} · ${step.title || type.label}: ${outcome}`, notes: note,
    });
    const prevNoAnswer = e.history.some((h) => /no answer/i.test(h.outcome || '') && (cad.steps.find((x) => x.id === h.stepId) || {}).type === 'call');
    e.history.push({ stepId: step.id, date, outcome, note, activityId: actId });
    if (type.plan) addPlanTouch(date, type.plan, { name: acct.name, accountId: acct.id, contactId: contact.id, kind: type.kind, note: `${cad.name}: ${step.title || type.label}`, done: true, activityId: actId });
    if (rules.badFlag && /wrong number|bounced/i.test(outcome)) {
      contact.flag = /bounced/i.test(outcome) ? 'Email bounced' : 'Wrong number';
      if (/bounced/i.test(outcome)) contact.status = 'Bounced';
      contact.flagAt = date;
      if (then === 'continue') then = 'bad';
      said.push(`${contact.name} flagged: ${contact.flag.toLowerCase()}`);
    }
    if (then === 'continue' && rules.pauseOnReply && isPositive(step, outcome)) then = 'pause';
    if (then === 'pause') {
      if (e.step + 1 >= cad.steps.length) finishEnrollment(e, 'replied', date);
      else { advance(p, date); Object.assign(e, { status: 'paused', pausedAt: date, pauseReason: outcome }); }
      const fu = followUp || shiftDays(date, 2, true);
      if (!acct.nextFollowUp || acct.nextFollowUp < today() || acct.nextFollowUp > fu) acct.nextFollowUp = fu;
      said.push(`${e.status === 'paused' ? 'Paused' : 'Finished'} · follow-up ${fmtDate(acct.nextFollowUp, { weekday: 'short', month: 'short', day: 'numeric' })}`);
    } else if (then === 'continue') {
      advance(p, date);
      if (e.status === 'active' && rules.vmEmail && /voicemail/i.test(outcome) && cad.steps[e.step].type === 'email') {
        const next = cad.skipWeekends ? nextWorkdayAfter(date) : addDays(date, 1);
        if (e.dueDate > next) { e.dueDate = next; said.push(`email moved up to ${fmtDate(next, { weekday: 'short' })}`); }
      }
      if (rules.noAnswerLi && step.type === 'call' && /no answer/i.test(outcome) && prevNoAnswer && !e.liTask) {
        const d2 = nextWorkdayAfter(date);
        state.tasks.push({ id: uid(), date: d2, time: '', title: `LinkedIn: connect with ${contact.name}`, accountId: acct.id, priority: 'med', done: false, notes: `Two calls with no answer in ${cad.name}.`, categoryId: 'cat-call' });
        e.liTask = true;
        said.push(`LinkedIn touch added for ${fmtDate(d2, { weekday: 'short' })}`);
      }
    } else finishEnrollment(e, then, date);
    touch(acct);
    return said.join(' · ');
  }

  /** What an outcome usually means for the cadence (the person can change it before saving). */
  const outcomeThen = (o, cad) => {
    const r = cadRules(cad);
    if (/wrong number|bounced/i.test(o)) return 'bad';
    if (/replied/i.test(o)) return r.pauseOnReply ? 'pause' : 'replied';
    if (r.pauseOnReply && /connected|met in person/i.test(o)) return 'pause';
    return 'continue';
  };

  function renderSession() {
    if (!session) {
      $('#view').innerHTML = `
        <div class="page-head"><h1>Sessions</h1></div>
        <div class="card empty-soft">No session running.<br><button class="btn" data-act="session-setup" style="margin-top:.75rem">▶ Start a session</button></div>`;
      return;
    }
    const t = today();
    // Skip queue entries that were done or changed elsewhere.
    const current = () => {
      while (session.idx < session.queue.length) {
        const p = enrollmentParts(state.enrollments.find((x) => x.id === session.queue[session.idx]) || {});
        if (p && p.e.status === 'active' && p.e.dueDate <= t && !session.results.some((r) => r.eid === p.e.id)) return p;
        session.idx++;
      }
      return null;
    };
    const p = current();
    saveSession();
    const total = session.queue.length;
    const doneN = session.results.length;
    const label = SESSION_TYPES[session.filter.type] === 'All step types' ? 'Step' : SESSION_TYPES[session.filter.type].replace(/s$/, '');
    const cadName = session.filter.cadenceId === 'all' ? 'All cadences' : (cadenceById(session.filter.cadenceId) || {}).name || 'Cadence';
    const head = `
      <div class="ss-head">
        <div>
          <div class="eyebrow" style="margin:0">${esc(label)} session · ${esc(cadName)}${session.filter.stepNo ? ` · Step ${esc(session.filter.stepNo)}` : ''}</div>
          <h1 style="margin:.15rem 0 0">${p ? `${Math.min(session.idx + 1, total)} of ${total}` : 'Session complete'}</h1>
        </div>
        <div class="row">
          ${p ? '<button class="btn ghost" data-act="session-end">End session</button>' : ''}
        </div>
      </div>
      <div class="progress ss-progress"><div style="width:${total ? Math.round(((p ? session.idx : total) / total) * 100) : 0}%"></div></div>`;

    if (!p) {
      const by = (k) => session.results.filter((r) => r.kind === k).length;
      const outcomes = {};
      session.results.filter((r) => r.kind === 'done').forEach((r) => { outcomes[r.outcome] = (outcomes[r.outcome] || 0) + 1; });
      $('#view').innerHTML = `${head}
        <div class="card ss-summary">
          <h2 style="margin-top:0">Nice work.</h2>
          <div class="cad-stats">
            <div class="good"><b>${by('done')}</b><span>Logged</span></div>
            <div><b>${by('skip')}</b><span>Skipped</span></div>
            <div><b>${by('snooze')}</b><span>Snoozed</span></div>
          </div>
          ${Object.keys(outcomes).length ? `<div class="row" style="margin-top:.75rem">${Object.entries(outcomes).map(([o, n]) => `<span class="pill">${esc(o)} · ${n}</span>`).join('')}</div>` : ''}
          <div class="row" style="margin-top:1rem">
            <button class="btn" data-act="session-setup">▶ Start another session</button>
            <button class="btn ghost" data-act="session-close">Back to cadences</button>
          </div>
        </div>`;
      return;
    }

    const { e, cad, acct, contact, step } = p;
    const type = stepType(step);
    const subject = fillTemplate(step.subject, p);
    const body = fillTemplate(step.body, p);
    const last = lastTouch(p);
    const others = session.queue.slice(session.idx + 1).map((id) => enrollmentParts(state.enrollments.find((x) => x.id === id) || {}))
      .filter((x) => x && x.acct.id === acct.id);
    const recent = [...acct.activities].filter((h) => h.kind !== 'Note').sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3);
    const upNext = session.queue.slice(session.idx + 1).map((id) => enrollmentParts(state.enrollments.find((x) => x.id === id) || {})).filter(Boolean).slice(0, 4);

    $('#view').innerHTML = `${head}
      <div class="ss-grid">
        <div class="card ss-main" style="--c:${cad.color}">
          <div class="ss-person">
            <span class="avatar lg" style="--c:${cad.color}">${esc(initials(contact.name))}</span>
            <div class="grow">
              <h2 style="margin:0">${esc(contact.name)}</h2>
              <div class="muted">${esc([contact.title, contact.role].filter(Boolean).join(' · '))}${contact.title || contact.role ? ' · ' : ''}<a href="#account/${acct.id}">${esc(acct.name)}</a></div>
              <div class="small muted" style="margin-top:.2rem">${stepIcon(step)} ${esc(cad.name)} · Step ${e.step + 1} of ${cad.steps.length}: ${esc(step.title || type.label)}${e.dueDate < t ? ` · <span class="pill overdue">due ${esc(relDays(e.dueDate))}</span>` : ''}</div>
            </div>
          </div>
          <div class="row ss-actions">${stepActions(p, subject, body)}</div>
          ${contact.email && step.type !== 'email' ? `<div class="small muted">✉ <a href="mailto:${esc(contact.email)}">${esc(contact.email)}</a>${contact.timezone ? ` · 🕑 ${esc(contact.timezone)}` : ''}</div>` : contact.timezone ? `<div class="small muted">🕑 ${esc(contact.timezone)}</div>` : ''}
          ${subject || body ? `
            <details class="script ss-script" ${body ? 'open' : ''}>
              <summary class="small"><strong>${step.type === 'call' ? 'Talk track' : 'Script'}</strong>${subject ? ` <span class="muted">· ${esc(subject)}</span>` : ''}</summary>
              ${body ? `<div class="script-body">${esc(body)}</div>` : ''}
            </details>` : ''}
          <div class="ss-log">
            <label class="field"><span>Notes (optional)</span><textarea id="ss-note" rows="2" placeholder="What happened, next steps…"></textarea></label>
            <div class="stack ss-then" style="gap:.5rem">
              <label class="field"><span>Then</span><select id="ss-then"><option value="auto">Follow the outcome</option>${Object.entries(EXIT_OUTCOMES).map(([k, l]) => opt(k, l, '')).join('')}</select></label>
              <label class="field"><span>Follow-up if they engage</span><input type="date" id="ss-fu" value="${shiftDays(t, 2, true)}"></label>
            </div>
          </div>
          <div class="ss-outcomes">
            ${type.outcomes.map((o, i) => `<button type="button" class="btn ss-outcome" data-act="session-log" data-outcome="${esc(o)}"><kbd>${i + 1}</kbd>${esc(o)}</button>`).join('')}
          </div>
          <div class="row ss-secondary">
            <button type="button" class="btn ghost sm" data-act="session-meeting">★ Meeting booked</button>
            <button type="button" class="btn ghost sm" data-act="session-skip" title="Leave it due and move on (S)">Skip for now</button>
            <button type="button" class="btn ghost sm" data-act="session-snooze" title="Move this step to the next workday (N)">Snooze to ${esc(fmtDate(cad.skipWeekends ? nextWorkday(addDays(t, 1)) : addDays(t, 1), { weekday: 'short' }))}</button>
            <a class="btn ghost sm" href="#account/${acct.id}">Open account</a>
          </div>
        </div>

        <div class="stack ss-side">
          <div class="card">
            <div class="row spread"><h3 style="margin:0">${esc(acct.name)}</h3><span class="pill ${acct.type}">${acct.type === 'partner' ? 'Partner' : 'Prospect'}</span></div>
            <div class="small muted">${esc(acct.stage)}${acct.location ? ' · ' + esc(acct.location) : ''}${acct.employees ? ' · ' + esc(acct.employees) + ' employees' : ''}</div>
            ${acct.vendors.length ? `<div style="margin-top:.4rem">${vendorPills(acct)}${acct.vendorRenewal ? ` <span class="small muted">renews ${esc(fmtDate(acct.vendorRenewal, { month: 'short', day: 'numeric', year: 'numeric' }))}</span>` : ''}</div>` : ''}
            <div class="small" style="margin-top:.5rem"><span class="muted">Last touch with ${esc(contact.name.split(' ')[0])}:</span> ${last ? `${esc(last.label)}${last.outcome ? ' · ' + esc(last.outcome) : ''} · ${esc(relDays(last.date))}` : 'none yet'}</div>
            ${acct.notes ? `<div class="notes-box small" style="margin-top:.5rem;max-height:9rem;overflow:auto">${esc(acct.notes)}</div>` : ''}
            ${recent.length ? `<div class="small" style="margin-top:.5rem"><div class="muted">Recent activity</div>${recent.map((h) => `<div>${esc(relDays(h.date))} · ${esc(h.kind)} · ${esc(h.summary)}</div>`).join('')}</div>` : ''}
            ${others.length ? `<div class="small" style="margin-top:.5rem"><span class="muted">Also at this account in this session:</span> ${others.map((x) => esc(x.contact.name)).join(', ')}</div>` : ''}
          </div>
          ${upNext.length ? `<div class="card">
            <h3 style="margin:0 0 .4rem">Up next</h3>
            ${upNext.map((x) => `<div class="ss-next">${stepIcon(x.step)}<span class="grow"><strong>${esc(x.contact.name)}</strong> <span class="muted small">· ${esc(x.acct.name)}</span></span></div>`).join('')}
          </div>` : ''}
          <div class="small muted ss-keys">Keys: <kbd>1</kbd>–<kbd>${type.outcomes.length}</kbd> outcome · <kbd>S</kbd> skip · <kbd>N</kbd> snooze</div>
        </div>
      </div>`;
  }

  /** Session buttons and keys. */
  function sessionAct(action, outcome) {
    if (!session) return;
    const p = enrollmentParts(state.enrollments.find((x) => x.id === session.queue[session.idx]) || {});
    if (!p) { rerender(); return; }
    const note = ($('#ss-note') || {}).value || '';
    if (action === 'log' || action === 'meeting') {
      const out = action === 'meeting' ? (stepType(p.step).outcomes.find((o) => /connected|met|replied/i.test(o)) || stepType(p.step).outcomes[0]) : outcome;
      const thenSel = ($('#ss-then') || {}).value || 'auto';
      const then = action === 'meeting' ? 'meeting' : thenSel !== 'auto' ? thenSel : outcomeThen(out, p.cad);
      const said = completeStep(p, { outcome: out, then, note, followUp: ($('#ss-fu') || {}).value || '' });
      session.results.push({ eid: p.e.id, kind: 'done', outcome: action === 'meeting' ? 'Meeting booked' : out });
      toast(`${out} · ${said || (p.e.status === 'finished' ? FINISH_LABELS[p.e.outcome] : `next step ${fmtDate(p.e.dueDate, { month: 'short', day: 'numeric' })}`)}`);
    } else if (action === 'skip') {
      session.results.push({ eid: p.e.id, kind: 'skip' });
    } else if (action === 'snooze') {
      const t = today();
      p.e.dueDate = p.cad.skipWeekends ? nextWorkday(addDays(t, 1)) : addDays(t, 1);
      if (note) p.acct.activities.push({ id: uid(), date: t, kind: 'Note', summary: `${p.cad.name}: snoozed`, notes: note, contactId: p.contact.id, createdAt: new Date().toISOString() });
      touch(p.acct);
      session.results.push({ eid: p.e.id, kind: 'snooze' });
      toast(`Snoozed to ${fmtDate(p.e.dueDate, { weekday: 'short', month: 'short', day: 'numeric' })}`);
    }
    session.idx++;
    saveSession(); save(); rerender(); window.scrollTo(0, 0);
  }

  document.addEventListener('keydown', (e) => {
    if (ui.lastView !== 'session' || !session || modal.open) return;
    if (e.target.closest && e.target.closest('input, textarea, select')) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const btns = $$('.ss-outcome');
    if (/^[1-9]$/.test(e.key) && btns[Number(e.key) - 1]) { e.preventDefault(); btns[Number(e.key) - 1].click(); }
    else if (e.key.toLowerCase() === 's' && btns.length) { e.preventDefault(); sessionAct('skip'); }
    else if (e.key.toLowerCase() === 'n' && btns.length) { e.preventDefault(); sessionAct('snooze'); }
  });

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
    companyPhone: ['companyphone', 'companyphonenumber', 'companymainphone', 'mainphone', 'hqphone', 'officephone', 'companyhqphone'],
    companyLinkedin: ['companylinkedinurl', 'linkedincompanyurl', 'companylinkedin', 'linkedincompanyprofileurl'],
    first: ['firstname', 'first'],
    last: ['lastname', 'last'],
    name: ['fullname', 'name', 'contactname', 'contact', 'primarycontact'],
    title: ['jobtitle', 'title', 'position'],
    email: ['email', 'emailaddress', 'businessemail', 'workemail', 'supplementalemail'],
    phone: ['directphonenumber', 'directphone', 'phone', 'phonenumber', 'workphone', 'businessphone'],
    mobile: ['mobilephone', 'mobile', 'cellphone', 'mobilenumber'],
    linkedin: ['linkedincontactprofileurl', 'contactlinkedin', 'linkedinurl', 'linkedinprofile', 'linkedinprofileurl', 'personlinkedinurl', 'profileurl', 'linkedin'],
    value: ['value', 'dealvalue', 'amount', 'opportunityvalue', 'oppvalue', 'annualvalue', 'dealsize', 'arr'],
    adminFees: ['adminfees', 'adminfee', 'annualadminfees', 'adminfeerevenue'],
    vendors: ['currentvendors', 'currentvendor', 'vendors', 'vendor', 'currentpeo', 'incumbent'],
    leadSource: ['leadsource', 'source'],
    stage: ['stage', 'dealstage', 'opportunitystage', 'status'],
    closeDate: ['closedate', 'expectedclose', 'expectedclosedate', 'closingdate', 'targetclosedate'],
    channelPartner: ['channelpartner', 'referralpartner', 'broker', 'partner', 'channel'],
    channelContact: ['channelcontact', 'partnercontact', 'brokercontact', 'channelpartnercontact'],
    stayInTouch: ['stayintouch', 'stayintouchreminder', 'keepintouch', 'touchfrequency'],
    partnerType: ['partnertype', 'channeltype', 'referralsourcetype'],
    lastTouch: ['lasttouch', 'lasttouchdate', 'lastcontacted', 'lastcontactdate'],
    lastReferral: ['lastreferral', 'lastreferraldate'],
  };
  const parseMoney = (v) => { const n = Number(String(v).replace(/[$,\s]/g, '')); return v !== '' && Number.isFinite(n) ? n : ''; };
  /** Spreadsheet dates in, YYYY-MM-DD out: 2027-01-15, 2027-01-15 00:00:00, 1/15/2027 or 1/15/27. */
  function normDate(v) {
    v = String(v).trim();
    if (/^\d{5}(\.\d+)?$/.test(v)) return serialToISO(Number(v)); // raw Excel date number
    let m = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) return `${m[1]}-${pad(m[2])}-${pad(m[3])}`;
    m = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
    if (m) return `${m[3].length === 2 ? '20' + m[3] : m[3]}-${pad(m[1])}-${pad(m[2])}`;
    return '';
  }
  /** "Insperity; ADP TotalSource" → known vendor names; "None / in-house" stays one value. */
  function parseVendors(v) {
    v = String(v).trim();
    if (!v) return [];
    if (/^(none|n\/a|in[- ]?house|none\s*\/\s*in[- ]?house)$/i.test(v)) return [NO_VENDOR];
    const whole = COMPETITORS.find((x) => x.toLowerCase() === v.toLowerCase());
    const parts = whole ? [v] : v.split(/[;|,]/).map((x) => x.trim()).filter(Boolean);
    return [...new Set(parts.map((x) => COMPETITORS.find((c) => c.toLowerCase() === x.toLowerCase())
      || COMPETITORS.find((c) => x.toLowerCase().includes(c.toLowerCase())) || x))];
  }
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
        address: get(r, 'address'), mainPhone: get(r, 'companyPhone'),
        companyLinkedin: get(r, 'companyLinkedin'),
        contact: name ? { name, title: get(r, 'title'), email: get(r, 'email'), phone: get(r, 'phone'), mobile: get(r, 'mobile'), linkedin: get(r, 'linkedin'), ...(parseStay(get(r, 'stayInTouch')) ? { stayInTouch: parseStay(get(r, 'stayInTouch')), sitSince: today() } : {}) } : null,
        value: parseMoney(get(r, 'value')), adminFees: parseMoney(get(r, 'adminFees')), vendors: parseVendors(get(r, 'vendors')),
        leadSource: LEAD_SOURCES.find((x) => x.toLowerCase() === get(r, 'leadSource').toLowerCase()) || get(r, 'leadSource'),
        stage: get(r, 'stage'), closeDate: normDate(get(r, 'closeDate')),
        channelPartner: get(r, 'channelPartner'), channelContact: get(r, 'channelContact'),
        partnerType: PARTNER_TYPES.find((x) => x.toLowerCase() === get(r, 'partnerType').toLowerCase()) || get(r, 'partnerType'),
        lastTouchDate: normDate(get(r, 'lastTouch')), lastReferralDate: normDate(get(r, 'lastReferral')),
      };
    }).filter((x) => x.company);
    return { col, records };
  }

  /** Work out what an import would do (dry run) or do it, without overwriting anything already filled in. */
  const CO_SUFFIX = /\b(llc|inc|incorporated|corp|corporation|co|company|ltd|limited|pc|pllc|lp|llp|plc|the)\b/g;
  /** "Acme Dental, Inc." and "ACME DENTAL LLC" → "acme dental". */
  const companyKey = (n) => (n || '').toLowerCase().replace(/&/g, ' and ').replace(/[.,'’()"]/g, ' ').replace(CO_SUFFIX, ' ').replace(/[^a-z0-9]+/g, ' ').trim();
  const domainOf = (u) => (u || '').toLowerCase().trim().replace(/^https?:\/\//, '').replace(/^www\./, '').split(/[/?#\s]/)[0];
  /** An existing account for an imported company: same website domain first, then same name, then a normalized name. */
  function matchExisting(name, website) {
    const dom = domainOf(website);
    if (dom && dom.includes('.')) { const a = state.accounts.find((x) => domainOf(x.website) === dom); if (a) return { a, how: 'website' }; }
    const exact = findAccountByName(name);
    if (exact) return { a: exact, how: 'name' };
    const k = companyKey(name);
    if (k) { const a = state.accounts.find((x) => companyKey(x.name) === k); if (a) return { a, how: 'similar name' }; }
    return null;
  }

  function applyImport(records, opts, commit) {
    const now = new Date().toISOString();
    const made = new Map(); // lower-case name -> new account (dry run keeps them here)
    const stats = { newAccounts: 0, updatedAccounts: new Set(), newContacts: 0, skippedContacts: 0, newPartners: 0, fuzzy: new Map() };
    const addContact = (a, c) => {
      const dup = a.contacts.find((x) => (c.email && x.email && x.email.toLowerCase() === c.email.toLowerCase()) || x.name.toLowerCase() === c.name.toLowerCase());
      if (dup) { stats.skippedContacts++; return dup; }
      stats.newContacts++;
      const contact = { id: uid(), title: '', email: '', phone: '', mobile: '', linkedin: '', ...c, role: '', notes: '', status: 'Active', channel: '', timezone: '', primary: a.contacts.length === 0 };
      if (commit) a.contacts.push(contact); else a.contacts = [...a.contacts, contact];
      return contact;
    };
    const findOrCreate = (name, type, stage, source, website = '') => {
      const key = name.toLowerCase();
      let a = made.get(key) || made.get('n:' + companyKey(name));
      if (!a) {
        const m = opts.dupes === 'create' ? (findAccountByName(name) ? { a: findAccountByName(name), how: 'name' } : null) : matchExisting(name, website);
        if (m && m.how !== 'name' && !stats.fuzzy.has(name)) stats.fuzzy.set(name, { to: m.a.name, how: m.how });
        if (m) a = m.a;
      }
      if (a) return { a, created: false };
      a = migrateAccount({
        id: uid(), name, type, stage, tags: opts.tag, notes: '', vendors: [],
        contacts: [], activities: [], keyDates: [], leadSource: source, createdAt: now, updatedAt: now,
      });
      made.set(key, a);
      if (companyKey(name)) made.set('n:' + companyKey(name), a);
      if (commit) state.accounts.push(a);
      return { a, created: true };
    };
    for (const r of records) {
      const stage = stageFromText(opts.type, r.stage) || STAGES[opts.type][0];
      const { a, created } = findOrCreate(r.company, opts.type, stage, r.leadSource || opts.source, r.website);
      if (created) stats.newAccounts++;
      else if (![...made.values()].includes(a)) stats.updatedAccounts.add(a.id); // already in the CRM
      const fill = {
        website: r.website, industry: r.industry, employees: r.employees, location: r.location, address: r.address, mainPhone: r.mainPhone,
        linkedin: r.companyLinkedin, value: r.value, adminFees: r.adminFees, closeDate: r.closeDate, leadSource: r.leadSource,
        lastTouchDate: r.lastTouchDate,
        ...(a.type === 'partner' ? { partnerType: r.partnerType, lastReferralDate: r.lastReferralDate } : {}),
      };
      if (commit) {
        for (const [k, v] of Object.entries(fill)) if (v !== '' && v != null && !a[k]) a[k] = v;
        if (r.vendors.length && !a.vendors.length) a.vendors = r.vendors;
      }
      if (r.contact) addContact(a, r.contact);
      // Channel partner (broker): its own partner account, with its contact, linked from this account.
      if (r.channelPartner) {
        const pr = findOrCreate(r.channelPartner, 'partner', 'Producing', 'Partner / broker'); // they referred this deal
        if (pr.created) stats.newPartners++;
        const pc = r.channelContact ? addContact(pr.a, { name: r.channelContact }) : null;
        if (commit) {
          if (!a.channelPartnerId) a.channelPartnerId = pr.a.id;
          if (pc && !a.channelContactId && a.channelPartnerId === pr.a.id) a.channelContactId = pc.id;
          touch(pr.a);
        }
      }
      if (commit) touch(a);
    }
    return stats;
  }

  function importCsvForm(text, fileName) { importRows(parseCsv(text), fileName); }

  function importRows(rows, fileName) {
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
      try { return applyImport(records, { type: 'prospect', tag: '', source: '', dupes: 'merge' }, false); } finally { state.accounts = saved; }
    };
    const s = preview();
    const found = Object.keys(col).filter((k) => !['first', 'last', 'city', 'state', 'zip'].includes(k))
      .map((k) => ({ company: 'Company', website: 'Website', industry: 'Industry', employees: 'Employees', location: 'Location', companyLinkedin: 'Company LinkedIn',
        name: 'Name', title: 'Title', email: 'Email', phone: 'Phone', mobile: 'Mobile', linkedin: 'LinkedIn', address: 'Street address', companyPhone: 'Main phone',
        value: 'Value', adminFees: 'Admin fees', vendors: 'Current vendors', leadSource: 'Lead source', stage: 'Stage', closeDate: 'Close date',
        channelPartner: 'Channel partner', channelContact: 'Channel contact', stayInTouch: 'Stay in touch', partnerType: 'Partner type', lastTouch: 'Last touch', lastReferral: 'Last referral' })[k]);
    if (col.first !== undefined || col.last !== undefined) found.push('Name');
    if (col.city !== undefined || col.state !== undefined) found.push('City/State');
    const fromZoomInfo = /zoominfo/i.test(fileName) || col.companyLinkedin !== undefined || rows[0].some((h) => /zoominfo/i.test(h));
    openModal('Import accounts & contacts', `
      <div class="import-summary">
        <div><b>${s.newAccounts - s.newPartners}</b><span>new accounts</span></div>
        ${s.newPartners ? `<div><b>${s.newPartners}</b><span>new channel partners</span></div>` : ''}
        <div><b>${s.updatedAccounts.size}</b><span>existing accounts</span></div>
        <div><b>${s.newContacts}</b><span>new contacts</span></div>
        <div><b>${s.skippedContacts}</b><span>duplicates skipped</span></div>
      </div>
      <p class="small muted" style="margin:0">From <strong>${esc(fileName)}</strong> (${records.length} rows). Columns recognized: ${[...new Set(found)].map((f) => `<span class="pill">${esc(f)}</span>`).join(' ')}</p>
      ${s.fuzzy.size ? `<div class="dup-review">
        <b>${plural(s.fuzzy.size, 'company', 'companies')} look${s.fuzzy.size === 1 ? 's' : ''} like account${s.fuzzy.size === 1 ? '' : 's'} you already have</b> <span class="small muted">(matched on website or a similar name)</span>
        <ul class="small">${[...s.fuzzy].slice(0, 8).map(([from, m]) => `<li>${esc(from)} → <b>${esc(m.to)}</b> <span class="muted">· ${esc(m.how)}</span></li>`).join('')}${s.fuzzy.size > 8 ? `<li class="muted">and ${s.fuzzy.size - 8} more</li>` : ''}</ul>
        ${field('For these', `<select name="dupes">${opt('merge', 'Merge into the existing account', 'merge')}${opt('create', 'Create new accounts anyway', 'merge')}</select>`)}
      </div>` : ''}
      <p class="small muted" style="margin:0">Existing accounts are matched by website domain first, then by name (ignoring LLC, Inc. and punctuation). Only empty fields are filled in, and contacts already on an account (same email or name) are skipped.</p>
      <div class="grid-3">
        ${field('New accounts are', `<select name="type">${opt('prospect', 'Prospects', 'prospect')}${opt('partner', 'Partners', '')}</select>`)}
        ${field(col.leadSource !== undefined ? 'Lead source (rows without one)' : 'Lead source', `<select name="source"><option value="">—</option>${LEAD_SOURCES.map((x) => opt(x, x, '')).join('')}</select>`)}
        ${field('Tag new accounts', `<input name="tag" value="${fromZoomInfo ? 'zoominfo' : 'import'}-${today().slice(5)}">`)}
      </div>`, (data) => {
      const st2 = applyImport(records, { type: data.type, tag: data.tag.trim(), source: data.source, dupes: data.dupes || 'merge' }, true);
      toast(`Imported: ${st2.newAccounts - st2.newPartners} new accounts${st2.newPartners ? `, ${st2.newPartners} partners` : ''}, ${st2.newContacts} contacts`);
      ui.typeFilter = 'all'; ui.stageFilter = 'all'; ui.vendorFilter = 'all'; ui.search = '';
      go('accounts');
    }, 'Import', { wide: true });
  }

  $('#csv-import').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    if (/\.xls$/i.test(file.name)) { alert('Old .xls files can\'t be read. In Excel or Numbers, save it as .xlsx or CSV and import that.'); return; }
    if (/\.xlsx$/i.test(file.name)) {
      try { importRows(await readXlsx(await file.arrayBuffer()), file.name); }
      catch (err) { alert(`Couldn't read that Excel file (${err.message}). Try saving it as CSV and importing that.`); }
      return;
    }
    importCsvForm(await file.text(), file.name);
  });

  // ----- Excel (.xlsx) reader: unzip with the browser's DecompressionStream, read the first sheet -----
  const colIndex = (ref) => [...ref.replace(/\d+/g, '')].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;
  const serialToISO = (n) => { const d = new Date(Date.UTC(1899, 11, 30) + Math.round(n * 86400000)); return d.toISOString().slice(0, 10); };

  async function readXlsx(buf) {
    const u8 = new Uint8Array(buf);
    const dv = new DataView(buf);
    let eocd = -1;
    for (let i = u8.length - 22; i >= Math.max(0, u8.length - 66000); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    if (eocd < 0) throw new Error('not an .xlsx file');
    const files = {};
    let p = dv.getUint32(eocd + 16, true);
    for (let n = dv.getUint16(eocd + 10, true); n > 0; n--) {
      const nameLen = dv.getUint16(p + 28, true);
      const name = new TextDecoder().decode(u8.subarray(p + 46, p + 46 + nameLen));
      files[name] = { method: dv.getUint16(p + 10, true), size: dv.getUint32(p + 20, true), local: dv.getUint32(p + 42, true) };
      p += 46 + nameLen + dv.getUint16(p + 30, true) + dv.getUint16(p + 32, true);
    }
    const read = async (name) => {
      const f = files[name];
      if (!f) return null;
      const start = f.local + 30 + dv.getUint16(f.local + 26, true) + dv.getUint16(f.local + 28, true);
      const data = u8.subarray(start, start + f.size);
      if (f.method === 0) return new TextDecoder().decode(data);
      if (f.method !== 8 || typeof DecompressionStream === 'undefined') throw new Error('unsupported compression');
      const out = await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer();
      return new TextDecoder().decode(out);
    };
    const xml = (txt) => new DOMParser().parseFromString(txt, 'application/xml');
    const tags = (el, n) => [...el.getElementsByTagNameNS('*', n)];
    // First sheet, found through the workbook's relationships.
    const wb = xml(await read('xl/workbook.xml'));
    const sheetEl = tags(wb, 'sheet')[0];
    const rid = sheetEl && [...sheetEl.attributes].find((at) => at.localName === 'id' && at.prefix)?.value;
    const relsTxt = await read('xl/_rels/workbook.xml.rels');
    let target = relsTxt && tags(xml(relsTxt), 'Relationship').find((r) => r.getAttribute('Id') === rid)?.getAttribute('Target');
    target = !target ? 'xl/worksheets/sheet1.xml' : target.startsWith('/') ? target.slice(1) : `xl/${target.replace(/^\.\//, '')}`;
    const shared = [];
    const ssTxt = await read('xl/sharedStrings.xml');
    if (ssTxt) for (const si of tags(xml(ssTxt), 'si')) shared.push(tags(si, 't').filter((t) => t.parentNode.localName !== 'rPh').map((t) => t.textContent).join(''));
    // Which cell styles are dates (built-in date formats, or custom formats with d/m/y).
    const dateStyles = new Set();
    const stTxt = await read('xl/styles.xml');
    if (stTxt) {
      const sd = xml(stTxt);
      const custom = Object.fromEntries(tags(sd, 'numFmt').map((nf) => [nf.getAttribute('numFmtId'), nf.getAttribute('formatCode') || '']));
      const xfs = tags(sd, 'cellXfs')[0];
      if (xfs) [...xfs.children].forEach((xf, i) => {
        const id = Number(xf.getAttribute('numFmtId'));
        const code = (custom[id] || '').replace(/"[^"]*"|\[[^\]]*\]|\\./g, '');
        if ((id >= 14 && id <= 22) || (id >= 45 && id <= 47) || /[dy]|m{1,4}(?![^;]*[#0])/i.test(code) && !/^[#0,.$%\s-]*$/.test(code)) dateStyles.add(i);
      });
    }
    const sheet = xml(await read(target));
    const rows = [];
    for (const row of tags(sheet, 'row')) {
      const out = [];
      for (const c of tags(row, 'c')) {
        const t = c.getAttribute('t');
        const v = tags(c, 'v')[0]?.textContent ?? '';
        let val = v;
        if (t === 's') val = shared[Number(v)] ?? '';
        else if (t === 'inlineStr') val = tags(c, 't').map((x) => x.textContent).join('');
        else if (t === 'b') val = v === '1' ? 'TRUE' : 'FALSE';
        else if ((!t || t === 'n') && v !== '' && dateStyles.has(Number(c.getAttribute('s') || 0))) val = serialToISO(Number(v));
        out[c.getAttribute('r') ? colIndex(c.getAttribute('r')) : out.length] = val;
      }
      rows.push(Array.from(out, (x) => (x == null ? '' : String(x))));
    }
    return rows.filter((r) => r.some((x) => x.trim()));
  }

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
    const coarse = ['city', 'town', 'village', 'hamlet', 'municipality', 'county', 'state', 'postcode', 'suburb', 'neighbourhood', 'quarter', 'region'];
    return hit ? { lat: Number(hit.lat), lng: Number(hit.lon), ...(coarse.includes(hit.addresstype) ? { approx: true } : {}) } : null;
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

  // Free street-map tiles that need no API key: OpenStreetMap first, Esri's street map as a backup
  // if OpenStreetMap's tiles fail to load. Dark mode darkens the tiles with a CSS filter.
  const TILE_SOURCES = [
    { url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors' },
    { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', maxZoom: 19,
      attribution: 'Tiles &copy; <a href="https://www.esri.com" target="_blank" rel="noopener">Esri</a> &mdash; Esri, HERE, Garmin, OpenStreetMap contributors' },
  ];
  function addBaseTiles(map, dark, i = mapState.tileSource || 0) {
    const src = TILE_SOURCES[i];
    $('#map').classList.toggle('dark-tiles', dark);
    let loaded = 0; let failed = 0;
    const layer = L.tileLayer(src.url, { maxZoom: src.maxZoom, attribution: src.attribution }).addTo(map);
    layer.on('tileload', () => { loaded++; });
    layer.on('tileerror', () => {
      failed++;
      if (!loaded && failed >= 4 && i + 1 < TILE_SOURCES.length) {
        map.removeLayer(layer);
        mapState.tileSource = i + 1; // remember for the rest of the session
        addBaseTiles(map, dark, i + 1);
      }
    });
  }

  /** Create (or recreate) the Leaflet map inside #map, keeping the previous view if there was one. */
  function mountMap() {
    const keep = mapState.keep;
    const dark = matchMedia('(prefers-color-scheme: dark)').matches;
    const map = L.map('map', { zoomControl: true, attributionControl: true, doubleClickZoom: !mapState.drawing });
    addBaseTiles(map, dark);
    if (keep) map.setView(keep.c, keep.z); else map.setView(CA_CENTER, 6);
    map.on('click', (e) => {
      if (mapState.drawing) { drawClick(e); return; }
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

  // ----- pins that mean something: colour by last touch, stage or type -----
  const MAP_COLORS = { touch: 'Last touch', stage: 'Stage', type: 'Type' };
  const TOUCH_BANDS = [[30, '#2f9e44', 'Touched in 30 days'], [60, '#f08c00', '30–60 days'], [Infinity, '#e03131', '60+ days or never']];
  const STAGE_COLORS = {
    'S1 – Discovery Scheduled': '#a5d8ff', 'S2 – Qualified Opportunity': '#74c0fc', 'S3 – Solution & Quote Development': '#339af0',
    'S4 – Proposal Presented': '#1c7ed6', 'S5 – Decision / Negotiation': '#1864ab', 'Closed Won': '#2f9e44', 'Closed Lost': '#868e96', Nurture: '#be4bdb', Revisit: '#f08c00',
  };
  const PARTNER_PIN = '#0ca678';
  function pinColor(a) {
    const mode = MAP_COLORS[ui.mapColor] ? ui.mapColor : 'touch';
    if (mode === 'type') return a.type === 'partner' ? '#0f8a6a' : '#8a4bd6';
    if (mode === 'stage') return a.type === 'partner' ? PARTNER_PIN : STAGE_COLORS[a.stage] || '#868e96';
    if (isClosedStage(a.stage)) return '#adb5bd';
    const d = lastTouchDate(a);
    const n = d ? daysBetween(d, today()) : Infinity;
    return TOUCH_BANDS.find(([max]) => n < max || (max === Infinity))[1];
  }
  function pinLegend() {
    const mode = MAP_COLORS[ui.mapColor] ? ui.mapColor : 'touch';
    const item = (c, l) => `<span><i style="background:${c}"></i>${esc(l)}</span>`;
    const rows = mode === 'type' ? [item('#8a4bd6', 'Prospect'), item('#0f8a6a', 'Partner')]
      : mode === 'stage' ? [...Object.entries(STAGE_COLORS).map(([s, c]) => item(c, stageShort(s))), item(PARTNER_PIN, 'Partner')]
        : [...TOUCH_BANDS.map(([, c, l]) => item(c, l)), item('#adb5bd', 'Closed')];
    return `<div class="legend small">${rows.join('')}<span><i class="due"></i>Due now</span></div>`;
  }

  // ----- nearby: who else is close to this account -----
  function nearbyAccounts(a, radius) {
    if (!hasGeo(a)) return [];
    return state.accounts.filter((x) => x !== a && hasGeo(x)).map((x) => ({ a: x, d: miles(ll(a), ll(x)) }))
      .filter((x) => x.d <= radius).sort((x, y) => x.d - y.d);
  }
  function nearbyForm(a, radius = 2) {
    if (!hasGeo(a)) { toast(`${a.name} isn't on the map yet. Add an address or drop a pin.`); return; }
    const list = nearbyAccounts(a, radius);
    const onRoute = new Set(routeStops(today()).map((s) => s.a.id));
    openModal(`Near ${a.name}`, `
      <div class="row">${[1, 2, 5, 10].map((r) => `<button type="button" class="btn sm ${r === radius ? '' : 'ghost'}" data-radius="${r}">${r} mi</button>`).join('')}</div>
      <p class="small muted" style="margin:0">${plural(list.length, 'account')} within ${radius} miles. Turn one meeting into a three-stop trip.</p>
      ${list.length ? `<div class="cc-people">${list.slice(0, 25).map(({ a: x, d }) => {
        const lt = lastTouchDate(x);
        return `<div class="cc-person nb-row">
          <span class="nb-dot" style="background:${pinColor(x)}"></span>
          <span class="grow"><strong>${esc(x.name)}</strong> <span class="small muted">· ${fmtMiles(d)} · ${esc(stageShort(x.stage))} · ${lt ? `touched ${esc(relDays(lt))}` : 'never touched'}</span></span>
          ${onRoute.has(x.id) ? '<span class="small muted">On today\'s route</span>' : `<button type="button" class="btn sm ghost" data-nb-add="${x.id}">+ Today's route</button>`}
        </div>`;
      }).join('')}</div>` : '<div class="empty">Nobody else within this distance.</div>'}
      ${list.length ? `<button type="button" class="btn sm" id="nb-all">Add ${esc(a.name)} + the ${Math.min(list.length, 3)} closest to today's route</button>` : ''}`, () => {}, 'Close', { wide: true });
    modalForm.querySelector('.modal-actions [data-close]').remove();
    $$('[data-radius]', modalForm).forEach((b) => b.addEventListener('click', () => nearbyForm(a, Number(b.dataset.radius))));
    $$('[data-nb-add]', modalForm).forEach((b) => b.addEventListener('click', () => { addRouteStop(today(), b.dataset.nbAdd); b.outerHTML = '<span class="small muted">Added</span>'; }));
    const all = $('#nb-all');
    if (all) all.addEventListener('click', () => {
      const r = getRoute(today());
      const ids = [a.id, ...list.slice(0, 3).map((x) => x.a.id)].filter((id) => !r.extra.includes(id));
      setRoute(today(), { extra: [...r.extra, ...ids], removed: r.removed.filter((x) => !ids.includes(x)) });
      modal.close(); toast(`${plural(ids.length, 'stop')} added to today's route`); rerender();
    });
  }

  // ----- territories: zones you draw once; days of the week they belong to -----
  const TERR_COLORS = ['#e8590c', '#1c7ed6', '#2f9e44', '#ae3ec9', '#f08c00', '#0c8599', '#c2255c'];
  const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  /** Ray casting: is [lat, lng] inside the polygon? */
  function inPolygon(pt, poly) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [yi, xi] = poly[i]; const [yj, xj] = poly[j];
      if ((yi > pt[0]) !== (yj > pt[0]) && pt[1] < ((xj - xi) * (pt[0] - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }
  const territoryOf = (a) => (hasGeo(a) ? (state.territories || []).find((t) => inPolygon(ll(a), t.points)) || null : null);
  const inTerritory = (t, a) => hasGeo(a) && inPolygon(ll(a), t.points);
  function drawTerritories(layer) {
    for (const t of state.territories || []) {
      L.polygon(t.points, { color: t.color, weight: 2, dashArray: '6 6', fillColor: t.color, fillOpacity: 0.06, interactive: !mapState.drawing && !mapState.placing })
        .bindTooltip(`${esc(t.name)}${(t.days || []).length ? ` · ${t.days.map((d) => WEEKDAYS[d - 1]).join(', ')}` : ''}`, { sticky: true }).addTo(layer);
    }
  }
  function territoryForm(existing, points) {
    const t = existing || { name: '', color: TERR_COLORS[(state.territories || []).length % TERR_COLORS.length], days: [], points };
    openModal(existing ? `Territory · ${t.name}` : 'New territory', `
      <div class="grid-2">
        ${field('Name *', `<input name="name" required value="${esc(t.name)}" placeholder="e.g. Westside, South Bay, DTLA">`)}
        ${field('Color', `<select name="color">${TERR_COLORS.map((c, i) => opt(c, ['Orange', 'Blue', 'Green', 'Purple', 'Gold', 'Teal', 'Pink'][i], t.color)).join('')}</select>`)}
      </div>
      <div class="field"><span>Days you're usually there (the route planner suggests its accounts those days)</span>
        <div class="row">${WEEKDAYS.map((d, i) => `<label class="row small"><input type="checkbox" name="days" value="${i + 1}" style="width:auto" ${(t.days || []).includes(i + 1) ? 'checked' : ''}> ${d}</label>`).join('')}</div></div>
      <p class="small muted" style="margin:0">${plural(state.accounts.filter((a) => hasGeo(a) && inPolygon(ll(a), t.points)).length, 'mapped account')} inside.</p>
      ${existing ? '<button type="button" class="btn sm danger" id="terr-del">Delete territory</button>' : ''}`, (data, fd) => {
      if (!data.name.trim()) return false;
      const fields = { name: data.name.trim(), color: data.color, days: fd.getAll('days').map(Number) };
      if (existing) Object.assign(existing, fields);
      else (state.territories ||= []).push({ id: uid(), ...fields, points });
      mapState.drawing = null;
      toast(existing ? 'Territory saved' : `${fields.name} added`);
    }, 'Save territory');
    const del = $('#terr-del');
    if (del) del.addEventListener('click', () => {
      if (!confirm(`Delete ${t.name}?`)) return;
      state.territories = state.territories.filter((x) => x !== existing); modal.close(); save(); rerender();
    });
  }
  function drawClick(e) {
    const dr = mapState.drawing;
    dr.points.push([e.latlng.lat, e.latlng.lng]);
    if (dr.shape) mapState.map.removeLayer(dr.shape);
    dr.shape = (dr.points.length > 2 ? L.polygon : L.polyline)(dr.points, { color: '#e8590c', weight: 2, dashArray: '4 6' }).addTo(mapState.map);
    L.circleMarker(e.latlng, { radius: 4, color: '#e8590c', weight: 2, fillOpacity: 1 }).addTo(mapState.map);
    const n = $('#draw-n'); if (n) n.textContent = dr.points.length;
    const fin = $('#draw-done'); if (fin) fin.disabled = dr.points.length < 3;
  }
  /** Accounts in a territory worth a stop: no touch in 30+ days, or a revisit or follow-up due. */
  function territorySuggestions(t, d, exclude) {
    return state.accounts.filter((a) => inTerritory(t, a) && !exclude.has(a.id) && !isClosedStage(a.stage))
      .map((a) => { const lt = lastTouchDate(a); return { a, n: lt ? daysBetween(lt, d) : 9999, due: (a.revisitDate && a.revisitDate <= d) || (a.nextFollowUp && a.nextFollowUp <= d) }; })
      .filter((x) => x.due || x.n >= 30).sort((x, y) => (y.due - x.due) || y.n - x.n);
  }

  // ----- saved routes -----
  function saveRouteTemplate(d) {
    const r = getRoute(d);
    const ids = routeStops(d).map((s) => s.a.id);
    if (!ids.length) { toast('Add stops first'); return; }
    const name = (prompt('Name this route, e.g. "Westside loop":') || '').trim();
    if (!name) return;
    (state.routeTemplates ||= []).push({ id: uid(), name, ids, start: r.start, roundTrip: r.roundTrip, visitMins: r.visitMins, lastRun: d });
    save(); rerender(); toast(`Saved "${name}"`);
  }
  function loadRouteTemplate(d, id) {
    const tpl = (state.routeTemplates || []).find((x) => x.id === id);
    if (!tpl) return;
    const r = getRoute(d);
    const ids = tpl.ids.filter((x) => getAccount(x));
    setRoute(d, { extra: [...new Set([...r.extra, ...ids])], removed: r.removed.filter((x) => !ids.includes(x)), start: tpl.start, roundTrip: tpl.roundTrip, visitMins: tpl.visitMins, optKey: '' });
    tpl.lastRun = d; save();
    toast(`${tpl.name}: ${plural(ids.length, 'stop')} loaded`); rerender();
  }

  // ----- log a visit from the pin -----
  const VISIT_OUTCOMES = ['Met the decision maker', 'Met someone else', 'Dropped off materials', 'Nobody available', 'Not a fit'];
  function visitLogForm(a) {
    const d = today();
    openModal(`Log visit · ${a.name}`, `
      <div class="grid-2">
        ${field('Outcome', `<select name="outcome">${VISIT_OUTCOMES.map((o) => opt(o, o, VISIT_OUTCOMES[0])).join('')}</select>`)}
        ${field('Who', `<select name="contactId"><option value="">—</option>${a.contacts.filter(isActiveContact).map((c) => opt(c.id, `${c.name}${c.role ? ` (${c.role})` : ''}`, (primaryContact(a) || {}).id)).join('')}</select>`)}
        ${field('Notes', '<textarea name="notes" rows="2" placeholder="What you learned, who to ask for next time…"></textarea>', 'span-2')}
        ${field('Next follow-up', `<input name="next" type="date" value="${shiftDays(d, 3, true)}">`)}
        ${field('Business card or photo', `<input name="photo" type="file" accept="image/*" capture="environment">${cloudOn() ? '' : '<span class="small muted">Set up cloud sync to keep photos with the account.</span>'}`)}
      </div>`, (data, fd) => {
      const now = new Date().toISOString();
      const act = { id: uid(), date: d, kind: 'Visit', summary: `Visit: ${data.outcome}`, notes: data.notes, contactId: data.contactId || '', createdAt: now };
      a.activities.push(act);
      // Count it on today's plan (and tick the route stop) without logging it twice.
      const plan = getPlan(d, true);
      const sec = a.revisitDate && a.revisitDate <= d ? 'revisits' : 'visits';
      const row = plan[sec].find((rw) => (rowAccount(rw) || {}).id === a.id);
      if (row) Object.assign(row, { done: true, activityId: act.id, kind: 'Visit' });
      else addPlanTouch(d, sec, { name: accountLabel(a), accountId: a.id, kind: 'Visit', note: data.outcome, done: true, activityId: act.id });
      if (sec === 'revisits') { a.revisitDate = ''; a.revisitNote = ''; }
      if (data.next) a.nextFollowUp = data.next;
      touch(a);
      const photo = fd.get('photo');
      if (photo && photo.size && cloudOn()) setTimeout(() => addFiles(a.id, [new File([photo], `Business card ${a.name} ${d}.${(photo.name.split('.').pop() || 'jpg')}`, { type: photo.type })]), 50);
      toast(`${a.name}: visit logged${photo && photo.size && !cloudOn() ? ' (photo not kept: sync is off)' : ''}`);
    }, 'Log visit', { wide: true });
  }

  /** Look up a new or changed address right after saving, so accounts don't silently miss the map. */
  function geocodeSoon(id) {
    if (Date.now() < (mapState.geoPausedUntil || 0)) return;
    setTimeout(async () => {
      const a = getAccount(id);
      if (!a || !needsGeo(a)) return;
      const q = geoQuery(a);
      try {
        const hit = await geocode(q);
        const b = getAccount(id);
        if (!b || geoQuery(b) !== q) return;
        b.geo = hit ? { ...hit, q } : { q, miss: true };
        touch(b); save();
        if (!hit) toast(`${b.name}: address not found on the map. Check it, or drop a pin on the Map.`);
      } catch (e) { /* offline: the map tries again when it opens */ }
    }, 400);
  }

  // ----- accounts map -----
  const mapFilter = () => {
    const f = ui.mapFilter;
    const list = f.list ? resolveList(f.list) : null;
    const ids = list ? new Set(listAccounts(list).map((a) => a.id)) : null;
    const terr = f.terr && (state.territories || []).find((t) => t.id === f.terr);
    return state.accounts.filter((a) => (f.type === 'all' || a.type === f.type) && (f.vendor === 'all' || a.vendors.includes(f.vendor)) && (!ids || ids.has(a.id)) && (!terr || inTerritory(terr, a)));
  };

  function accountPopup(a) {
    const p = primaryContact(a);
    return `<div class="map-pop">
      <strong>${esc(a.name)}</strong> ${typePill(a)}
      <div class="small muted">${esc(a.stage)}${a.vendors.length ? ' · ' + esc(a.vendors.join(', ')) : ''}</div>
      ${geoQuery(a) ? `<div class="small">${esc(geoQuery(a))}${a.geo && a.geo.approx ? ' <span class="pill med" title="Pinned to the city, not the street address">approx.</span>' : ''}</div>` : ''}
      <div class="small muted">${(() => { const lt = lastTouchDate(a); return lt ? `Last touch ${esc(relDays(lt))}` : 'Never touched'; })()}</div>
      ${p ? `<div class="small">${esc(p.name)}${p.phone ? ` · <a href="tel:${esc(p.phone)}">${esc(p.phone)}</a>` : ''}</div>` : ''}
      ${a.revisitDate ? `<div class="small">Revisit ${dueChip(a.revisitDate)}</div>` : ''}
      <div class="row map-pop-actions">
        <a class="btn sm" href="#account/${a.id}">Open</a>
        <button type="button" class="btn sm ghost" data-pop="route" data-id="${a.id}">+ Today's route</button>
        <button type="button" class="btn sm ghost" data-pop="visit" data-id="${a.id}">Log visit</button>
        <button type="button" class="btn sm ghost" data-pop="near" data-id="${a.id}">Nearby</button>
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
      fillColor: pinColor(a),
    }).bindPopup(accountPopup(a), { minWidth: 240 }).bindTooltip(esc(a.name), { direction: 'top', offset: [0, -6] }).addTo(mapState.layer);
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
      $$('[data-pop=visit]', el).forEach((b) => b.addEventListener('click', () => { map.closePopup(); visitLogForm(getAccount(b.dataset.id)); }));
      $$('[data-pop=near]', el).forEach((b) => b.addEventListener('click', () => { map.closePopup(); nearbyForm(getAccount(b.dataset.id)); }));
    });
  }

  function renderMapAccounts() {
    const accts = mapFilter();
    const mapped = accts.filter(hasGeo);
    const missing = accts.filter((a) => !hasGeo(a));
    const approx = mapped.filter((a) => a.geo.approx && !a.geo.manual);
    const terrs = state.territories || [];
    const dr = mapState.drawing;
    const near = mapState.me ? mapped.map((a) => ({ a, d: miles(mapState.me, ll(a)) })).sort((x, y) => x.d - y.d).slice(0, 12) : null;
    const f = ui.mapFilter;
    $('#view').innerHTML = `
      ${mapHead('accounts')}
      <div class="map-layout">
        <aside class="card map-side">
          <div class="filters">
            <select id="mf-type" aria-label="Type">${opt('all', 'All types', f.type)}${opt('prospect', 'Prospects', f.type)}${opt('partner', 'Partners', f.type)}</select>
            <select id="mf-vendor" aria-label="Vendor"><option value="all">All vendors</option>${allVendors().map((v) => opt(v, v, f.vendor)).join('')}</select>
            <select id="mf-list" aria-label="Saved view"><option value="">All accounts</option>${state.lists.map((l) => opt(l.id, l.name, f.list)).join('')}</select>
            ${terrs.length ? `<select id="mf-terr" aria-label="Territory"><option value="">All territories</option>${terrs.map((t) => opt(t.id, t.name, f.terr || '')).join('')}</select>` : ''}
            <select id="mf-color" aria-label="Color pins by">${Object.entries(MAP_COLORS).map(([k, l]) => opt(k, `Color: ${l}`, MAP_COLORS[ui.mapColor] ? ui.mapColor : 'touch')).join('')}</select>
          </div>
          ${missing.length || approx.length ? `<div class="geo-flag small"><b>${missing.length ? `${plural(missing.length, 'account')} ${missing.length === 1 ? 'has' : 'have'} no map location` : ''}${missing.length && approx.length ? ' · ' : ''}${approx.length ? `${approx.length} pinned only to a city` : ''}</b> <button type="button" class="link-btn small" data-act="map-fix">Fix</button></div>` : ''}
          <div class="row spread">
            <span class="small muted">${mapped.length} of ${accts.length} on the map</span>
            <button type="button" class="btn sm ghost" data-act="map-near">📍 Near me</button>
          </div>
          ${pinLegend()}
          <div class="terr-box">
            <div class="row spread"><h3 style="margin:0">Territories</h3>${dr ? '' : '<button type="button" class="btn sm ghost" data-act="map-draw">+ Draw a zone</button>'}</div>
            ${dr ? `<div class="place-hint">Click the map to outline the zone (<b id="draw-n">${dr.points.length}</b> points). <button type="button" class="btn sm" id="draw-done" data-act="draw-done" ${dr.points.length < 3 ? 'disabled' : ''}>Finish</button> <button type="button" class="btn sm ghost" data-act="draw-cancel">Cancel</button></div>` : ''}
            ${terrs.length ? `<div class="side-list">${terrs.map((t) => `<div class="side-item terr-item"><span class="terr-sw" style="background:${t.color}"></span><strong>${esc(t.name)}</strong>
              <span class="small muted">${plural(state.accounts.filter((a) => inTerritory(t, a)).length, 'account')}${(t.days || []).length ? ` · ${t.days.map((x) => WEEKDAYS[x - 1]).join(', ')}` : ''}</span>
              <button type="button" class="icon-btn" data-act="terr-edit" data-tid="${t.id}" title="Edit ${esc(t.name)}" aria-label="Edit ${esc(t.name)}">✎</button></div>`).join('')}</div>`
              : dr ? '' : '<div class="small muted">Outline the areas you work (Westside, South Bay, DTLA) and the days you\'re there. The route planner then suggests who to see.</div>'}
          </div>
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
          ${approx.length ? `
            <details class="approx-box" ${ui.mapFix ? 'open' : ''}><summary class="small"><b>Pinned only to a city (${approx.length})</b></summary>
            <div class="side-list">${approx.map((a) => `
              <div class="side-item">
                <a href="#account/${a.id}"><strong>${esc(a.name)}</strong></a>
                <span class="small muted">${esc(geoQuery(a))}</span>
                <span class="row" style="gap:.25rem">
                  <button type="button" class="btn sm ghost" data-act="edit-account" data-id="${a.id}">Address</button>
                  <button type="button" class="btn sm ghost" data-act="map-place" data-id="${a.id}">Drop pin</button>
                </span>
              </div>`).join('')}</div></details>` : ''}
          ${mapState.placing ? `<div class="place-hint">Tap the map where <strong>${esc((getAccount(mapState.placing) || {}).name || '')}</strong> is located.</div>` : ''}
        </aside>
        <div class="card map-card"><div id="map" class="map ${mapState.placing ? 'placing' : ''}"></div></div>
      </div>`;
    $('#mf-type').addEventListener('change', (e) => { ui.mapFilter.type = e.target.value; rerender(); });
    $('#mf-vendor').addEventListener('change', (e) => { ui.mapFilter.vendor = e.target.value; rerender(); });
    $('#mf-list').addEventListener('change', (e) => { ui.mapFilter.list = e.target.value; rerender(); });
    if ($('#mf-terr')) $('#mf-terr').addEventListener('change', (e) => { ui.mapFilter.terr = e.target.value; rerender(); });
    $('#mf-color').addEventListener('change', (e) => { ui.mapColor = e.target.value; savePrefs(); rerender(); });
    if (ui.mapFix) { ui.mapFix = false; const el = $('.map-side h3 + .side-list, .approx-box'); if (el) el.scrollIntoView({ block: 'center' }); }
    loadLeaflet().then(() => {
      if (mapState.view !== 'accounts' || !$('#map')) return;
      const { map, restored } = mountMap();
      wirePopups(map);
      drawTerritories(mapState.layer);
      if (dr && dr.points.length) { dr.shape = null; const pts = dr.points; dr.points = []; pts.forEach((x) => drawClick({ latlng: { lat: x[0], lng: x[1] } })); }
      mapped.forEach(addAccountMarker);
      if (mapState.me) L.circleMarker(mapState.me, { radius: 7, color: '#fff', weight: 3, fillColor: '#2f6b52', fillOpacity: 1 }).bindTooltip('You are here').addTo(mapState.layer);
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
    for (const row of plan.visits) add(rowAccount(row), 'Planned visit');
    for (const row of plan.revisits) add(rowAccount(row), 'Revisit');
    for (const a of dueRevisits(d, plan.revisits)) add(a, 'Revisit due');
    for (const p of dueSteps(d)) if (p.step.type === 'visit') add(p.acct, `${p.cad.name}: visit`);
    for (const id of r.extra) add(getAccount(id), 'Added');
    const all = [...stops.values()];
    const rank = (s) => { const i = r.order.indexOf(s.a.id); return i === -1 ? 1e6 : i; };
    return all.sort((x, y) => rank(x) - rank(y));
  }

  const visitedRow = (d, a) => {
    const plan = getPlan(d);
    return [...plan.visits, ...plan.revisits].find((r) => r.done && (rowAccount(r) || {}).id === a.id);
  };

  /** Mark a stop visited: tick (or add) its planner row, which logs the visit to the account history. */
  function markVisited(d, a) {
    const plan = getPlan(d, true);
    const isMine = (r) => (rowAccount(r) || {}).id === a.id;
    const isRevisit = plan.revisits.some(isMine) || (a.revisitDate && a.revisitDate <= d);
    const secKey = isRevisit ? 'revisits' : 'visits';
    const sec = PLAN_SECTIONS.find((x) => x.key === secKey);
    const rows = plan[secKey];
    let row = rows.find(isMine);
    if (!row) {
      const slot = rows.findIndex((r) => !r.name.trim());
      row = { name: accountLabel(a), accountId: a.id, kind: 'Visit', note: isRevisit ? (a.revisitNote || '') : 'Route visit', done: false };
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
    const wd = fromISO(d).getDay();
    const onDay = (state.territories || []).filter((t) => (t.days || []).includes(wd));
    const taken = new Set(stops.map((s) => s.a.id));
    const sugg = onDay.map((t) => ({ t, list: territorySuggestions(t, d, taken).slice(0, 6) })).filter((x) => x.list.length);
    const tpls = state.routeTemplates || [];
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
          ${sugg.map(({ t, list }) => `<div class="terr-sugg" style="--c:${t.color}">
            <div class="row spread"><b>${esc(fmtDate(d, { weekday: 'long' }))} is ${esc(t.name)}</b><button type="button" class="btn sm" data-act="route-add-many" data-ids="${list.map((x) => x.a.id).join(',')}">Add these ${list.length}</button></div>
            <div class="small muted">Due or not touched in 30+ days: ${list.map((x) => esc(x.a.name)).join(', ')}</div>
          </div>`).join('')}
          <div class="row">
            <select id="route-add" style="flex:1"><option value="">+ Add a stop…</option>${addable.map((a) => `<option value="${a.id}">${esc(a.name)}${hasGeo(a) ? '' : ' (no address)'}</option>`).join('')}</select>
          </div>
          <div class="saved-routes">
            <div class="row spread"><h3 style="margin:0">Saved routes</h3>${stops.length ? '<button type="button" class="btn sm ghost" data-act="route-save">Save this route</button>' : ''}</div>
            ${tpls.length ? `<div class="side-list">${tpls.map((x) => `<div class="side-item"><strong>${esc(x.name)}</strong>
              <span class="small muted">${plural(x.ids.length, 'stop')}${x.lastRun ? ` · last run ${esc(fmtDate(x.lastRun, { month: 'short', day: 'numeric' }))}` : ''}</span>
              <span class="row" style="gap:.25rem"><button type="button" class="btn sm ghost" data-act="route-load" data-tid="${x.id}">Load</button><button type="button" class="icon-btn" data-act="route-tpl-del" data-tid="${x.id}" title="Delete ${esc(x.name)}" aria-label="Delete ${esc(x.name)}">✕</button></span></div>`).join('')}</div>`
              : '<div class="small muted">Save a loop you run often (a monthly Westside loop) and load it onto any day.</div>'}
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
      drawTerritories(mapState.layer);
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
      if (line.length > 1) L.polyline(line, { color: '#2f6b52', weight: 4, opacity: 0.8, dashArray: estimated ? '6 8' : null }).addTo(mapState.layer);
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
      const [, rawFrom, rawTo] = h.summary.match(STAGE_RE);
      const from = ALL_RENAMES[rawFrom] || rawFrom; const to = ALL_RENAMES[rawTo] || rawTo; // older history uses the old names
      const list = h.account.type === 'prospect' ? [...OPEN_DEAL_STAGES, 'Closed Won'] : STAGES.partner.slice(0, 5);
      return { h, a: h.account, from, to, forward: list.indexOf(to) > list.indexOf(from) && list.indexOf(to) >= 0 };
    }).sort((x, y) => y.h.date.localeCompare(x.h.date));
    const newAccounts = state.accounts.filter((a) => inWeek(a.createdAt));
    const won = moves.filter((m) => m.to === 'Closed Won');

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
              ${m.to === 'Closed Won' ? '<span class="pill won">Won</span>' : ''}
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
  /** The account being researched: the one it was opened from (by id) while its name is still in the box. */
  function researchAccount() {
    const t = research.target.trim();
    const byId = research.targetId && getAccount(research.targetId);
    return byId && byId.name.trim().toLowerCase() === t.toLowerCase() ? byId : findAccountByText(t);
  }

  function researchTargets() {
    if (research.list) {
      const l = resolveList(research.list);
      return l ? listAccounts(l).slice(0, 10).map((a) => ({ name: a.name, a })) : [];
    }
    const name = research.target.trim();
    if (!name) return [];
    const a = researchAccount();
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
      phone: str(c.main_phone), mainPhone: str(c.main_phone), industry: str(c.industry), employees: emp ? emp[0].replace(/,/g, '') : '',
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
    ['address', 'HQ street address'], ['location', 'City, State ZIP'], ['mainPhone', 'Main phone'], ['website', 'Website'], ['linkedin', 'Company LinkedIn'],
    ['industry', 'Industry'], ['employees', 'Employees'], ['vendorRenewal', 'Vendor renewal'],
  ];

  function renderResearch() {
    const targets = researchTargets();
    const prompt = buildPrompt();
    const matched = !research.list && research.target.trim() && researchAccount();
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
    const forced = !research.list && research.target.trim() && researchAccount();
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
        a = migrateAccount({ id: uid(), name: c.name, type: 'prospect', stage: STAGES.prospect[0], tags: 'claude-research', notes: '', vendors: [], contacts: [], activities: [], keyDates: [], createdAt: now, updatedAt: now });
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

  function accountForm(existing, preset = {}) {
    const a = existing || { type: 'prospect', stage: STAGES.prospect[0], ...preset };
    openModal(existing ? 'Edit account' : 'New account', `
      <fieldset class="form-sec"><legend>Company</legend><div class="grid-3">
        ${field('Account name *', `<input name="name" required value="${esc(a.name)}">`)}
        ${field('Type', `<select name="type" id="f-type">${opt('prospect', 'Prospect (deal pipeline)', a.type)}${opt('partner', 'Partner (channel / referral)', a.type)}</select>`)}
        ${field(`<span id="f-stage-label">${a.type === 'partner' ? 'Channel stage' : 'Deal stage'}</span>`, `<select name="stage" id="f-stage">${STAGES[a.type].map((s) => opt(s, s, a.stage)).join('')}</select><span class="small muted" id="f-stage-hint">${esc(STAGE_HINTS[a.stage] || STAGE_HINTS[STAGES[a.type][0]])}</span>`)}
        ${field('Industry', `<input name="industry" value="${esc(a.industry)}">`)}
        ${field('Employees', `<input name="employees" type="number" min="0" value="${esc(a.employees)}">`)}
        ${field(a.type === 'partner' ? 'Annual value ($)' : 'Deal value ($)', `<input name="value" type="number" min="0" step="any" value="${esc(a.value)}">`)}
        ${field('Admin fees ($)', `<input name="adminFees" type="number" min="0" step="any" value="${esc(a.adminFees)}">`, 'only-prospect')}
        ${field('Setup fee ($)', `<input name="setupFee" type="number" min="0" step="any" value="${esc(a.setupFee)}">`, 'only-prospect')}
        ${field('Enrolled employees', `<input name="enrolled" type="number" min="0" value="${esc(a.enrolled)}" placeholder="Defaults to employees">`, 'only-prospect')}
        ${field('Website', `<input name="website" value="${esc(a.website)}" autocapitalize="off" placeholder="company.com">`)}
        ${field('Company LinkedIn', `<input name="linkedin" value="${esc(a.linkedin)}" autocapitalize="off" placeholder="linkedin.com/company/…">`)}
        ${field('Street address', `<input name="address" value="${esc(a.address)}" placeholder="e.g. 1200 J St" autocomplete="street-address">`)}
        ${field('City, State ZIP', `<input name="location" value="${esc(a.location)}" placeholder="e.g. Sacramento, CA 95814">`)}
        ${field('Main phone', `<input name="mainPhone" type="tel" value="${esc(a.mainPhone)}" placeholder="e.g. 310-555-0147" autocomplete="tel">`)}
        ${field('Lead source', `<select name="leadSource"><option value="">—</option>${LEAD_SOURCES.map((x) => opt(x, x, a.leadSource)).join('')}</select>`)}
      </div></fieldset>
      ${existing ? '' : `
      <fieldset class="form-sec"><legend>Primary contact</legend><div class="grid-4">
        ${field('Name', `<input name="c_name">`)}
        ${field('Title', `<input name="c_title">`)}
        ${field('Email', `<input name="c_email" type="email">`)}
        ${field('Phone', `<input name="c_phone" type="tel">`)}
      </div></fieldset>`}
      <fieldset class="form-sec only-prospect"><legend>Current vendor</legend><div class="grid-3">
        <div class="field span-2"><span>Current vendors</span>${vendorPicker(a.vendors || [])}</div>
        ${field('Vendor renewal date', `<input name="vendorRenewal" type="date" value="${esc(a.vendorRenewal)}">`)}
      </div></fieldset>
      <fieldset class="form-sec"><legend>Next steps</legend><div class="grid-3">
        ${field('Expected close', `<input name="closeDate" type="date" value="${esc(a.closeDate)}">`, 'only-prospect')}
        ${field('Next follow-up', `<input name="nextFollowUp" type="date" value="${esc(a.nextFollowUp)}">`)}
        ${field('Next revisit date', `<input name="revisitDate" type="date" value="${esc(a.revisitDate)}">`)}
        ${field('Revisit purpose', `<input name="revisitNote" value="${esc(a.revisitNote)}" placeholder="e.g. Drop off comparison">`)}
      </div></fieldset>
      <fieldset class="form-sec" id="f-partner-sec" ${a.type === 'partner' ? '' : 'hidden'}><legend>Partner details</legend><div class="grid-3">
        ${field('Partner type', `<select name="partnerType"><option value="">—</option>${PARTNER_TYPES.map((x) => opt(x, x, a.partnerType)).join('')}${a.partnerType && !PARTNER_TYPES.includes(a.partnerType) ? opt(a.partnerType, a.partnerType, a.partnerType) : ''}</select>`)}
        ${field('Last touch date', `<input name="lastTouchDate" type="date" value="${esc(existing ? lastTouchDate(a) : '')}"><span class="small muted">Fills in from logged activity; set it for touches made outside the app.</span>`)}
        ${field('Last referral date', `<input name="lastReferralDate" type="date" value="${esc(existing ? lastReferralDate(a) : '')}"><span class="small muted">Updates when you link a referred account to this partner.</span>`)}
        ${field('Agreement', `<select name="agreementStatus">${AGREEMENT_STATUSES.map((x) => opt(x, x, a.agreementStatus || 'None')).join('')}</select>`)}
        ${field('Agreement ends', `<input name="agreementEnd" type="date" value="${esc(a.agreementEnd || '')}">`)}
        ${field('Tier', `<select name="tier"><option value="">Automatic${existing && a.type === 'partner' ? ` (now ${autoTier(a)})` : ''}</option>${['A', 'B', 'C'].map((k) => opt(k, `${k} · ${TIERS[k].name} (set by hand)`, a.tier || '')).join('')}</select>`)}
        ${field('Comp plan', `<select name="compPlanId">${compPlans().map((x) => opt(x.id, x.name, (planOf(a) || {}).id)).join('')}</select>`)}
        ${field('Owner', `<input name="owner" list="dl-owners" value="${esc(a.owner || '')}" placeholder="Who owns this partner"><datalist id="dl-owners">${[...new Set([...PARTNER_OWNERS, ...partners().map((x) => x.owner).filter(Boolean)])].map((x) => `<option value="${esc(x)}">`).join('')}</datalist>`)}
        <label class="row small" style="align-self:end"><input type="checkbox" name="nationalAgreement" style="width:auto" ${a.nationalAgreement ? 'checked' : ''}> National agreement</label>
      </div></fieldset>
      ${a.type === 'partner' && existing ? '' : `
      <fieldset class="form-sec only-prospect"><legend>Channel partner</legend><div class="grid-2">
        ${field('Referred by partner', `<select name="channelPartnerId" id="f-partner"><option value="">— none —</option>${state.accounts.filter((x) => x.type === 'partner' && x !== existing).sort((x, y) => x.name.localeCompare(y.name)).map((x) => opt(x.id, x.name, a.channelPartnerId)).join('')}</select>`)}
        ${field('Partner contact', `<select name="channelContactId" id="f-pcontact"></select>`)}
      </div></fieldset>`}
      <fieldset class="form-sec"><legend>Notes</legend><div class="grid-3">
        ${field('Tags (comma separated)', `<input name="tags" id="f-tags" value="${esc(a.tags)}"><div class="tag-chips" id="f-tag-chips" ${a.type === 'partner' ? '' : 'hidden'}>${PARTNER_TAGS.map((t) => `<button type="button" class="tag-chip" data-tag="${esc(t)}">${esc(t)}</button>`).join('')}</div>`)}
        ${field('Notes', `<textarea name="notes" rows="3">${esc(a.notes)}</textarea>`, 'span-2')}
      </div></fieldset>`, (data) => {
      if (!data.name.trim()) return false;
      const { c_name, c_title, c_email, c_phone, ...fields } = data;
      fields.vendors = JSON.parse(fields.vendors || '[]');
      if (fields.type !== 'partner') { for (const k of ['partnerType', 'lastTouchDate', 'lastReferralDate', 'agreementStatus', 'agreementEnd', 'tier', 'compPlanId', 'owner', 'nationalAgreement']) delete fields[k]; }
      else fields.nationalAgreement = !!data.nationalAgreement;
      // Linking an account to a partner counts as a referral that day.
      if (fields.channelPartnerId && fields.channelPartnerId !== (existing || {}).channelPartnerId) fields.referredAt = today();
      if (!fields.channelPartnerId && existing && existing.channelPartnerId) fields.referredAt = '';
      const dup = state.accounts.find((x) => x !== existing && x.name.trim().toLowerCase() === data.name.trim().toLowerCase());
      if (dup && !confirm(`An account named "${dup.name}" already exists. Save a second account with the same name? (The planner tells them apart by city.)`)) return false;
      if (existing) {
        logStageChange(existing, existing.stage, fields.stage);
        Object.assign(existing, fields); touch(existing);
        geocodeSoon(existing.id);
        toast('Account updated');
      } else {
        const now = new Date().toISOString();
        const contacts = c_name || c_email || c_phone
          ? [{ id: uid(), name: c_name || c_email || c_phone, title: c_title, email: c_email, phone: c_phone, role: '', notes: '', status: 'Active', primary: true }] : [];
        const acct = { id: uid(), ...fields, contacts, activities: [], keyDates: [], createdAt: now, updatedAt: now };
        state.accounts.push(acct);
        geocodeSoon(acct.id);
        if (acct.type === 'partner' && ruleOn('onboard')) applyPlaybook(acct); // rule 1: onboarding playbook
        location.hash = `account/${acct.id}`;
        toast('Account created');
      }
    }, 'Save', { wide: true });
    const stageHint = () => { $('#f-stage-hint').textContent = STAGE_HINTS[$('#f-stage').value] || ''; };
    $('#f-type').addEventListener('change', (e) => {
      $('#f-stage').innerHTML = STAGES[e.target.value].map((s) => opt(s, s, '')).join('');
      $('#f-stage-label').textContent = e.target.value === 'partner' ? 'Channel stage' : 'Deal stage';
      stageHint();
    });
    $('#f-stage').addEventListener('change', stageHint);
    const showFor = (type) => $$('#modal-form .only-prospect').forEach((el) => { el.hidden = type === 'partner'; });
    showFor(a.type);
    $('#f-type').addEventListener('change', (e) => {
      showFor(e.target.value);
      $('#f-partner-sec').hidden = e.target.value !== 'partner';
      $('#f-tag-chips').hidden = e.target.value !== 'partner';
    });
    // Ready-made partner tags: tap to add or remove from the tags box.
    const tagsInput = $('#f-tags');
    const drawChips = () => {
      const have = new Set(tagsInput.value.split(',').map((x) => x.trim().toLowerCase()).filter(Boolean));
      $$('#f-tag-chips .tag-chip').forEach((b) => b.classList.toggle('on', have.has(b.dataset.tag.toLowerCase())));
    };
    $('#f-tag-chips').addEventListener('click', (e) => {
      const b = e.target.closest('.tag-chip');
      if (!b) return;
      const list = tagsInput.value.split(',').map((x) => x.trim()).filter(Boolean);
      const i = list.findIndex((x) => x.toLowerCase() === b.dataset.tag.toLowerCase());
      if (i >= 0) list.splice(i, 1); else list.push(b.dataset.tag);
      tagsInput.value = list.join(', ');
      drawChips();
    });
    tagsInput.addEventListener('input', drawChips);
    drawChips();
    bindVendorPicker();
    const partnerSel = $('#f-partner');
    if (partnerSel) {
      const fillContacts = (keep) => {
        const pa = getAccount(partnerSel.value);
        $('#f-pcontact').innerHTML = `<option value="">—</option>${pa ? pa.contacts.map((c) => opt(c.id, c.name, keep)).join('') : ''}`;
      };
      fillContacts(a.channelContactId);
      partnerSel.addEventListener('change', () => fillContacts(''));
    }
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
      const becameLeft = existing && data.status === 'Left company' && (existing.status || 'Active') !== 'Left company';
      if (becameLeft) setTimeout(() => leftCompanyForm(acct, existing), 80);
      let target = existing;
      if (existing && existing.flag && (fields.phone !== existing.phone || fields.mobile !== existing.mobile || fields.email !== existing.email)) fields.flag = '';
      if (existing) Object.assign(existing, fields);
      else acct.contacts.push(target = { id: uid(), ...fields });
      if (target.primary) acct.contacts.forEach((x) => { if (x !== target) x.primary = false; });
      else if (!acct.contacts.some((x) => x.primary)) acct.contacts[0].primary = true;
      touch(acct);
      toast(existing ? 'Contact updated' : 'Contact added');
    }, 'Save', { wide: true });
  }

  function activityForm(acct, existing, preset = null) {
    const h = existing || { date: today(), kind: 'Call', ...(preset || {}) };
    openModal(`${existing ? 'Edit' : 'Log'} activity — ${acct.name}`, `
      <div class="grid-2">
        ${field('Date', `<input name="date" type="date" required value="${esc(h.date)}">`)}
        ${field('Type', `<select name="kind">${ACTIVITY_KINDS.map((k) => opt(k, k, h.kind)).join('')}</select>`)}
        ${acct.contacts.length ? field('With contact', `<select name="contactId"><option value="">—</option>${acct.contacts.map((c) => opt(c.id, c.name, h.contactId ?? (primaryContact(acct) || {}).id)).join('')}</select>`, 'span-2') : ''}
        ${field('Summary *', `<input name="summary" required placeholder="e.g. Discovery call with VP Sales" value="${esc(h.summary)}">`, 'span-2')}
        ${field('Notes', `<textarea name="notes" rows="5" placeholder="What was discussed, decisions, objections, next steps…">${esc(h.notes)}</textarea>`, 'span-2')}
        ${existing ? '' : `
        ${field('Set next follow-up', `<input name="nextFollowUp" type="date" value="${esc(preset ? acct.nextFollowUp || '' : acct.nextFollowUp && acct.nextFollowUp > today() ? acct.nextFollowUp : addDays(today(), 7))}">`)}
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
        ${field('Category', `<div class="row" style="flex-wrap:nowrap"><i class="cat-dot" id="tf-dot" style="--c:${catColor(x)}"></i><select name="categoryId" id="tf-cat"><option value="">No category</option>${catRows().map((c) => opt(c.id, c.name, x.categoryId || '')).join('')}</select><button type="button" class="btn sm ghost" id="tf-cats">Edit</button></div>`)}
        ${field('Related account', `<select name="accountId">${accountOptions(x.accountId)}</select>`)}
        ${field('Notes', `<textarea name="notes" rows="3">${esc(x.notes)}</textarea>`, 'span-2')}
      </div>`, (data) => {
      if (!data.title.trim()) return false;
      if (existing) Object.assign(existing, data);
      else state.tasks.push({ id: uid(), ...data, done: false });
      toast(existing ? 'Task updated' : 'Task added');
    });
    $('#tf-cat').addEventListener('change', (e) => { const c = catRows().find((k) => k.id === e.target.value); $('#tf-dot').style.setProperty('--c', c ? c.color : 'var(--accent)'); });
    $('#tf-cats').addEventListener('click', () => { modal.close(); categoriesForm(); });
  }

  function notesForm(acct) {
    openModal(`Notes — ${acct.name}`, field('Account notes', `<textarea name="notes" rows="12">${esc(acct.notes)}</textarea>`),
      (data) => { acct.notes = data.notes; touch(acct); });
  }

  // ---------- actions ----------
  // Partner page widgets: influence, client relationship, comp plan, playbook steps, co-sell plan.
  document.addEventListener('change', (e) => {
    const el = e.target;
    const a = el.dataset && el.dataset.id && getAccount(el.dataset.id);
    if (el.matches('[data-influence]') && a) {
      const c = a.contacts.find((x) => x.id === el.dataset.cid); if (c) { c.influence = el.value; touch(a); save(); }
    } else if (el.matches('[data-ct-role]') && a) {
      const c = a.contacts.find((x) => x.id === el.dataset.cid); if (c) { c.role = el.value; touch(a); save(); rerender(); toast(`${c.name}: ${el.value || 'no role'}`); }
    } else if (el.matches('[data-ct-status]') && a) {
      const c = a.contacts.find((x) => x.id === el.dataset.cid); if (c) { setContactStatus(a, c, el.value); save(); rerender(); }
    } else if (el.matches('[data-client-kind]') && a) {
      const c = (a.clients || []).find((x) => x.id === el.dataset.client); if (c) { c.kind = el.value; touch(a); save(); rerender(); }
    } else if (el.matches('[data-comp-plan]') && a) {
      a.compPlanId = el.value; touch(a); save(); rerender();
    } else if (el.matches('[data-step]')) {
      const task = state.tasks.find((x) => x.id === el.dataset.step); if (task) { task.done = el.checked; save(); rerender(); }
    } else if (el.id === 'pt-cosell') {
      const pa = getAccount(ui.recordId); if (pa) { pa.coSellPlan = el.value; touch(pa); save(); toast('Co-sell plan saved'); }
    }
  });

  // Stay-in-touch interval dropdowns (contact cards and the Contacts page).
  document.addEventListener('change', (e) => {
    const sel = e.target.closest('select[data-sit]');
    if (!sel) return;
    const a = getAccount(sel.dataset.id);
    const c = a && a.contacts.find((x) => x.id === sel.dataset.cid);
    if (!c) return;
    setStay(a, c, sel.value); save(); rerender();
    const s = stayInfo(a, c);
    toast(s ? `Stay in touch with ${c.name}: ${s.label.toLowerCase()} · ${s.next <= today() ? 'due today' : 'next ' + shortDate(s.next)}` : `Stay in touch off for ${c.name}`);
  });

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
      case 'acct-nearby': return nearbyForm(acct);
      case 'map-fix': ui.mapFix = true; return rerender();
      case 'map-draw': mapState.drawing = { points: [] }; mapState.placing = null; return rerender();
      case 'draw-cancel': mapState.drawing = null; return rerender();
      case 'draw-done': if (mapState.drawing && mapState.drawing.points.length >= 3) territoryForm(null, mapState.drawing.points.slice()); return undefined;
      case 'terr-edit': { const t = (state.territories || []).find((x) => x.id === el.dataset.tid); return t ? territoryForm(t) : undefined; }
      case 'route-save': return saveRouteTemplate(ui.routeDate);
      case 'route-load': return loadRouteTemplate(ui.routeDate, el.dataset.tid);
      case 'route-tpl-del': {
        const x = (state.routeTemplates || []).find((y) => y.id === el.dataset.tid);
        if (x && confirm(`Delete the saved route "${x.name}"?`)) { state.routeTemplates = state.routeTemplates.filter((y) => y !== x); save(); rerender(); }
        return undefined;
      }
      case 'route-add-many': {
        const d = ui.routeDate; const r = getRoute(d); const ids = el.dataset.ids.split(',').filter((x) => x && !r.extra.includes(x));
        setRoute(d, { extra: [...r.extra, ...ids], removed: r.removed.filter((x) => !ids.includes(x)) });
        toast(`${plural(ids.length, 'stop')} added`); return rerender();
      }
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
      case 'add-file': return pickFiles(acct);
      case 'open-file': return openFile(acct, el.dataset.fid);
      case 'del-file': {
        const f = (acct.files || []).find((x) => x.id === el.dataset.fid);
        if (f && confirm(`Delete ${f.name}? It's removed from every synced device.`)) {
          acct.files = acct.files.filter((x) => x.id !== f.id); touch(acct); save(); rerender();
        }
        return;
      }
      case 'del-keydate':
        if (confirm('Delete this key date?')) {
          acct.keyDates = acct.keyDates.filter((k) => k.id !== kid); touch(acct); save(); rerender();
        }
        return;
      case 'new-task': return taskForm(null, { ...(id ? { accountId: id } : {}), ...(el.dataset.time !== undefined ? { time: el.dataset.time } : {}), ...(el.dataset.date ? { date: el.dataset.date } : {}) });
      case 'slot': return taskForm(null, { time: el.dataset.time, ...(el.dataset.date ? { date: el.dataset.date } : {}), duration: '30' });
      case 'cal-check': return; // the checkbox's own change handler marks it done
      case 'cal-mode': ui.calMode = el.dataset.mode; savePrefs(); return rerender();
      case 'cal-day': e.preventDefault(); ui.calMode = 'day'; savePrefs(); return go(`planner/${el.dataset.date}`);
      case 'cal-cat': {
        const h = calHidden(); const k = el.dataset.cat;
        if (h.has(k)) h.delete(k); else h.add(k);
        ui.calHidden = [...h]; return rerender();
      }
      case 'cal-categories': return categoriesForm();
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
        getPlan(ui.plannerDate, true)[sec.key].push({ ...blankPlanRow(sec), added: true }); // kept even while blank
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
      case 'open-contact': ui.focusContact = cid; return go(`account/${id}`);
      case 'ptab': ui.partnerTab = el.dataset.tab; return rerender();
      case 'pt-quick': ui.ptQuick = el.classList.contains('pt-tile') && ui.ptQuick === el.dataset.q ? 'all' : el.dataset.q; ui.ptLimit = 0; return rerender();
      case 'pt-sort': { const k = el.dataset.k; if (ui.ptSort === k) ui.ptDir = -(ui.ptDir || 1); else { ui.ptSort = k; ui.ptDir = 1; } return rerender(); }
      case 'pt-more': ui.ptLimit = 100000; return rerender();
      case 'pt-export': return partnersCsv();
      case 'pt-enroll': {
        const r = enrollTier(el.dataset.tier); save(); rerender();
        return toast(r.n ? `${plural(r.n, 'partner')} enrolled in ${r.cad.name}${r.last && r.last !== today() ? ` · starts spread to ${fmtDate(r.last, { weekday: 'short', month: 'short', day: 'numeric' })}` : ''}${r.noContact ? ` · ${r.noContact} need a contact first` : ''}`
          : r.noContact ? `${plural(r.noContact, 'partner')} need a contact first` : 'Everyone is already enrolled');
      }
      case 'pt-give': return giveForm(id, el.dataset.kind);
      case 'pt-agenda': return copyText(callAgenda(acct), 'Call agenda copied');
      case 'pt-qbr': return copyText(qbrText(acct), 'Partner review summary copied');
      case 'pt-client-edit': { const c = (acct.clients || []).find((x) => x.id === el.dataset.client); return c ? clientEditForm(acct, c) : undefined; }
      case 'pt-open-tab': ui.recordId = id; ui.partnerTab = el.dataset.tab; return go(`account/${id}`);
      case 'new-partner': return accountForm(null, { type: 'partner', stage: STAGES.partner[0] });
      case 'log-referral': return referralForm(id);
      case 'comp-calc': return compCalc({ dealId: el.dataset.deal, partnerId: el.dataset.pid });
      case 'comp-rates': return compRatesForm();
      case 'add-clients': return addClientsForm(acct);
      case 'client-remove': {
        acct.clients = (acct.clients || []).filter((c) => c.id !== el.dataset.client); touch(acct); save(); return rerender();
      }
      case 'client-prospect': {
        const c = (acct.clients || []).find((x) => x.id === el.dataset.client);
        if (!c) return;
        const now = new Date().toISOString();
        const np = migrateAccount({ id: uid(), name: c.name, type: 'prospect', stage: STAGES.prospect[0], location: c.location || '', employees: c.employees || '', tags: 'co-sell', notes: `Client of ${acct.name}.`,
          coSellPartnerId: acct.id, leadSource: 'Partner / broker', vendors: [], contacts: [], activities: [], keyDates: [], createdAt: now, updatedAt: now });
        state.accounts.push(np);
        Object.assign(c, { accountId: np.id, kind: 'target' }); touch(acct); save(); rerender();
        return toast(`${np.name} added as a prospect (co-sell with ${acct.name})`);
      }
      case 'resell-task': {
        const pa = getAccount(el.dataset.pid);
        state.tasks.push({ id: uid(), date: today(), time: '', title: `Resell: ${acct.name}${pa ? ` (referred by ${pa.name})` : ''}`, accountId: acct.id, priority: 'med', notes: '', done: false });
        save(); return toast('Added to today’s planner');
      }
      case 'apply-playbook': {
        const key = ($('#pb-pick') || {}).value || playbookFor(acct);
        applyPlaybook(acct, key); save(); rerender();
        return toast(`${PLAYBOOKS[key].name}: ${plural(PLAYBOOKS[key].steps.length, 'step')} added to your planner`);
      }
      case 'add-resource':
        return openModal(`Add a resource · ${acct.name}`, `<div class="grid-2">${field('Label', '<input name="label" placeholder="e.g. Highspot partner page">')}${field('Link *', '<input name="url" required placeholder="https://…" autocapitalize="off">')}</div>`, (data) => {
          if (!data.url.trim()) return false;
          acct.resources = [...(acct.resources || []), { id: uid(), label: data.label.trim(), url: data.url.trim() }]; touch(acct);
        }, 'Add link');
      case 'del-resource':
        acct.resources = (acct.resources || []).filter((r) => r.id !== el.dataset.rid); touch(acct); save(); return rerender();
      case 'sit-log': {
        const c = acct.contacts.find((x) => x.id === cid);
        return activityForm(acct, null, { kind: channelKind(c), contactId: c.id, summary: `Stay in touch: ${c.name}` });
      }
      case 'sit-reset': {
        const c = acct.contacts.find((x) => x.id === cid);
        c.sitReset = today(); touch(acct); save(); rerender();
        const s = stayInfo(acct, c);
        return toast(`Reset · next ${s ? shortDate(s.next) : ''}`.trim());
      }
      case 'ct-filter': ui.contactFilter = el.dataset.f; ui.contactLimit = 200; return rerender();
      case 'ct-more': ui.contactLimit += 200; return rerender();
      case 'ct-follow': { const c = acct && acct.contacts.find((x) => x.id === cid); return c ? leftCompanyForm(acct, c) : undefined; }
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
      case 'open-list': openView(el.dataset.lid); return go('accounts');
      case 'new-list': return listForm();
      case 'save-view': return listForm(null, criteriaFromFilters());
      case 'acct-view': {
        const v = el.dataset.view || null;
        if (v) openView(v); else { ui.viewId = null; ui.acctSel = new Set(); }
        return location.hash === '#accounts' ? rerender() : go('accounts');
      }
      case 'pin-view': {
        const l = state.lists.find((x) => x.id === el.dataset.lid);
        if (!l) return;
        if (!l.pinned && state.lists.filter((x) => x.pinned).length >= 3) { toast('Up to 3 pinned views; unpin one first'); return; }
        l.pinned = !l.pinned; save(); rerender(); return toast(l.pinned ? `${l.name} pinned to the Overview` : 'Unpinned');
      }
      case 'acct-action': return runAction(el.dataset.kind);
      case 'acct-clear': ui.acctSel = new Set(); return rerender();
      case 'acct-cols': return columnsForm();
      case 'acct-addlist': return addToListForm([acct]);
      case 'edit-list': return listForm(state.lists.find((l) => l.id === el.dataset.lid));
      case 'del-list': {
        const l = state.lists.find((x) => x.id === el.dataset.lid);
        if (!confirm(`Delete the list "${l.name}"? Accounts are not affected.`)) return;
        state.lists = state.lists.filter((x) => x !== l); ui.listId = null; ui.viewId = null; save(); rerender(); return;
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
      case 'session-setup': return sessionSetupForm({ ...(el.dataset.cad ? { cadenceId: el.dataset.cad, type: 'all' } : {}), ...(el.dataset.type ? { type: SESSION_TYPES[el.dataset.type] ? el.dataset.type : 'all' } : {}), ...(el.dataset.step ? { stepNo: el.dataset.step } : {}) });
      case 'q-check': e.preventDefault(); return queueCheck(el.dataset.key);
      case 'q-tab': ui.qTab = el.dataset.tab; if (el.dataset.go) { e.preventDefault(); ui.calMode = 'day'; return go(`planner/${today()}`); } return rerender();
      case 'q-more': ui.qOpen = { ...(ui.qOpen || {}), [el.dataset.group]: !(ui.qOpen || {})[el.dataset.group] }; return rerender();
      case 'q-bulk': return queueBulk(el.dataset.op, el.dataset.group);
      case 'q-visit': return markVisited(today(), acct);
      case 'q-goal': {
        const v = prompt('Daily goal: how many actions (calls, emails, LinkedIn touches, visits, tasks) do you aim for each day?', String(dailyGoal()));
        if (v !== null && Number(v) > 0) { ui.dailyGoal = Math.round(Number(v)); savePrefs(); rerender(); }
        return;
      }
      case 'stale-all': ui.staleAll = !ui.staleAll; return rerender();
      case 'session-log': return sessionAct('log', el.dataset.outcome);
      case 'session-meeting': return sessionAct('meeting');
      case 'session-skip': return sessionAct('skip');
      case 'session-snooze': return sessionAct('snooze');
      case 'session-end': if (session) { session.idx = session.queue.length; saveSession(); } return rerender();
      case 'session-close': session = null; saveSession(); return go('cadences');
      case 'cad-filter': ui.cadFilter = el.dataset.f; return rerender();
      case 'cad-view': ui.cadView = el.dataset.view; savePrefs(); return rerender();
      case 'cc-mode': ui.cadCalMode = el.dataset.mode; savePrefs(); return rerender();
      case 'cc-shift': {
        const base = ui.cadCalDate || today();
        ui.cadCalDate = ui.cadCalMode === 'month' ? addMonths(base.slice(0, 8) + '01', Number(el.dataset.n)) : addDays(base, 7 * Number(el.dataset.n));
        return rerender();
      }
      case 'cc-today': ui.cadCalDate = today(); return rerender();
      case 'cc-hide': ui.cadHidden = { ...(ui.cadHidden || {}), [el.dataset.cad]: !(ui.cadHidden || {})[el.dataset.cad] }; savePrefs(); return rerender();
      case 'cc-open': return cadChipForm(el.dataset.date, el.dataset.key);
      case 'cc-day': return cadDayForm(el.dataset.date);
      case 'cc-rebalance': return rebalanceForm();
      case 'cc-cap': {
        const v = prompt('How many cadence steps can you work in a day?', String(stepCap()));
        if (v === null) return;
        const n = Math.round(Number(v));
        if (!(n > 0)) { toast('Enter a number above 0'); return; }
        ui.stepCap = n; savePrefs(); return rerender();
      }
      case 'contact-unflag': {
        const c = acct && acct.contacts.find((x) => x.id === cid);
        if (c) { c.flag = ''; touch(acct); save(); rerender(); toast('Flag cleared'); }
        return;
      }
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
        <button type="button" class="btn ghost sm" id="set-sync">${cloudOn() ? 'Sync settings' : 'Set up sync'}</button>
      </section>
      <section class="set-sec">
        <h3>Backup</h3>
        <p class="small muted">${cloudOn() ? 'Sync keeps the current data in your cloud database, not past versions. ' : 'Without sync, your data lives only on this device. '}You can also download a copy, or restore one.</p>
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
      // People first when the words match a person rather than an account's own name.
      const accountsHtml = (accts.length ? `<div class="gs-h">Accounts</div>${accts.map((a) => `
          <a class="gs-item" href="#account/${a.id}" data-close>
            <span class="grow"><strong>${esc(a.name)}</strong><span class="small muted"> · ${esc(a.stage)}${a.partnerType ? ' · ' + esc(a.partnerType) : ''}${a.vendors.length ? ' · ' + esc(a.vendors.join(', ')) : ''}</span></span>${typePill(a)}
          </a>`).join('')}` : '');
      const peopleHtml = (people.length ? `<div class="gs-h">Contacts</div>${people.map(({ a, c }) => `
          <a class="gs-item" href="#account/${a.id}" data-cid="${c.id}" data-close>
            <span class="avatar sm">${esc(initials(c.name))}</span>
            <span class="grow"><strong>${esc(c.name)}</strong><span class="small muted">${c.title ? ' · ' + esc(c.title) : ''} · ${esc(a.name)}</span></span>
          </a>`).join('')}` : '');
      const peopleFirst = people.length && !accts.some((a) => a.name.toLowerCase().includes(q));
      results.innerHTML = (peopleFirst ? peopleHtml + accountsHtml : accountsHtml + peopleHtml)
        || '<div class="empty">No matches.</div>';
    };
    input.addEventListener('input', draw);
    results.addEventListener('click', (e) => { const it = e.target.closest('.gs-item'); if (it && it.dataset.cid) ui.focusContact = it.dataset.cid; });
    input.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      const first = $('.gs-item', results);
      if (first) { if (first.dataset.cid) ui.focusContact = first.dataset.cid; modal.close(); go(first.getAttribute('href').slice(1)); }
    });
    draw();
    input.focus();
  }

  $('#btn-settings').addEventListener('click', openSettings);
  $('#btn-settings-side').addEventListener('click', openSettings);
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
      alert('That file is not a valid Bbars OS backup.');
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
      name: 'Northwind Logistics', type: 'prospect', stage: 'S4 – Proposal Presented', contact: 'Dana Ortiz', title: 'VP Operations',
      email: 'dana@northwind.example', phone: '555-0142', industry: 'Logistics', value: 48000, tags: 'enterprise, q4',
      nextFollowUp: t, notes: 'Evaluating 3 vendors. Budget approved for Q1. Champion is Dana; CFO signs off.',
      activities: [act(-21, 'Call', 'Intro call', 'Pain: manual dispatch scheduling.'), act(-12, 'Demo', 'Product demo to ops team', 'Strong interest in routing module.'), act(-3, 'Email', 'Sent proposal v1')],
      keyDates: [kd(9, 'Decision date', 'CFO review'), kd(20, 'Proposal expires')],
    });
    const brightpath = mk({
      name: 'BrightPath Consulting', type: 'partner', stage: 'Producing', contact: 'Sam Lee', title: 'Partner Manager',
      email: 'sam@brightpath.example', phone: '555-0188', industry: 'Consulting', value: 120000, tags: 'referral, reseller',
      nextFollowUp: addDays(t, 2), notes: 'Referral partner — sends ~2 qualified leads/month. 15% rev share.',
      activities: [act(-90, 'Meeting', 'Partnership kickoff'), act(-30, 'Meeting', 'Quarterly business review', 'Agreed on co-marketing webinar.'), act(-5, 'Email', 'Shared new pitch deck')],
      keyDates: [kd(5, 'Co-marketing webinar'), kd(45, 'QBR'), kd(150, 'Partner agreement renewal')],
    });
    const helix = mk({
      name: 'Helix Health', type: 'prospect', stage: 'S1 – Discovery Scheduled', contact: 'Priya Natarajan', title: 'Director of IT',
      email: 'priya@helix.example', industry: 'Healthcare', value: 30000, tags: 'mid-market',
      nextFollowUp: addDays(t, -2), notes: 'Inbound from webinar. Needs HIPAA details.',
      activities: [act(-8, 'Email', 'Replied to inbound inquiry')], keyDates: [],
    });
    const summit = mk({
      name: 'Summit Tech Alliance', type: 'partner', stage: 'Committed', contact: 'Jordan Blake', title: 'Alliances Lead',
      email: 'jordan@summit.example', phone: '555-0110', industry: 'Software', value: 60000, tags: 'integration',
      nextFollowUp: addDays(t, 6), activities: [act(-14, 'Meeting', 'Signed partner agreement')],
      keyDates: [kd(1, 'Technical onboarding session'), kd(30, 'Onboarding complete')],
    });
    const oak = mk({
      name: 'Oak & Iron Manufacturing', type: 'prospect', stage: 'S2 – Qualified Opportunity', contact: 'Chris Mendez', industry: 'Manufacturing',
      value: 22000, nextFollowUp: '', activities: [], keyDates: [],
    });

    Object.assign(brightpath, { partnerType: 'Business Consultant', agreementStatus: 'Signed', agreementEnd: addDays(t, 150), owner: 'Me', compPlanId: 'cp-share',
      resources: [{ id: uid(), label: 'Highspot partner page', url: 'https://www.highspot.com' }],
      clients: [
        { id: uid(), name: 'Pacific Coast Dental Group', location: 'San Jose, CA', employees: '64', ein: '', kind: 'client', accountId: '' },
        { id: uid(), name: 'Golden State Logistics', location: 'Stockton, CA', employees: '140', ein: '', kind: 'target', accountId: '' },
        { id: uid(), name: 'Northwind Logistics', location: 'Sacramento, CA', employees: '120', ein: '', kind: 'client', accountId: '' },
      ] });
    Object.assign(summit, { partnerType: 'Payroll / HR Technology', agreementStatus: 'In discussion', owner: 'Me', compPlanId: 'cp-pepm10' });
    Object.assign(northwind, { adminFees: 14400, setupFee: 1500, enrolled: 110 });
    Object.assign(northwind, { channelPartnerId: brightpath.id, referredAt: addDays(t, -40) });
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
      { id: uid(), date: t, time: '09:00', duration: 30, title: 'Pipeline review & inbox', accountId: '', priority: 'med', notes: '', done: false, categoryId: 'cat-admin' },
      { id: uid(), date: t, time: '10:30', duration: 45, title: 'Proposal walkthrough with Dana', accountId: northwind.id, priority: 'high', notes: 'Bring pricing options A/B', done: false, categoryId: 'cat-meeting' },
      { id: uid(), date: t, time: '10:30', duration: 30, title: 'Catch-up with Sam (BrightPath)', accountId: brightpath.id, priority: 'med', notes: '', done: false, categoryId: 'cat-partner' },
      { id: uid(), date: t, time: '14:00', duration: 30, title: 'Call Priya re: HIPAA questions', accountId: helix.id, priority: 'high', notes: '', done: false, categoryId: 'cat-call' },
      { id: uid(), date: t, time: '', title: 'Research Oak & Iron decision makers', accountId: oak.id, priority: 'low', notes: '', done: false, categoryId: 'cat-admin' },
      { id: uid(), date: addDays(t, 1), time: '11:00', duration: 60, title: 'Summit technical onboarding', accountId: summit.id, priority: 'med', notes: '', done: false, categoryId: 'cat-partner' },
    );
    state.days[t] = { priorities: ['Move Northwind to Negotiation', 'Unblock Helix on HIPAA', 'Prep BrightPath webinar'], notes: '' };
    const plan = getPlan(t, true);
    Object.assign(plan.outreach[0], { name: helix.name, accountId: helix.id, kind: 'Call', note: 'HIPAA follow-up' });
    Object.assign(plan.outreach[1], { name: oak.name, accountId: oak.id, kind: 'LinkedIn', note: 'Connect with Chris' });
    Object.assign(plan.outreach[2], { name: northwind.name, accountId: northwind.id, kind: 'Email', note: 'Send pricing options' });
    Object.assign(plan.visits[0], { name: northwind.name, accountId: northwind.id, note: 'Drop off proposal binder' });
    Object.assign(plan.channel[0], { name: brightpath.name, accountId: brightpath.id, kind: 'Call', note: 'Webinar prep' });
    Object.assign(plan.channel[1], { name: summit.name, accountId: summit.id, kind: 'Email', note: 'Onboarding agenda' });
    helix.revisitDate = t; helix.revisitNote = 'Bring security packet';
    oak.revisitDate = addDays(t, -1); oak.revisitNote = 'Meet plant HR lead';
    northwind.revisitDate = addDays(t, 10); northwind.revisitNote = 'Benefits comparison review';
    save(); toast('Sample data loaded'); rerender();
  }

  // ---------- attachments ----------
  // Files live in the `attachments` bucket of your Supabase project, at <user id>/<file id>.
  // The account only keeps each file's name, size and type, so editing an account never re-uploads
  // a file. Files open through a short-lived private link. Removing a file's record from the account
  // deletes the stored file once that removal has synced.
  const FILE_BUCKET = 'attachments';
  const FILE_MAX = 10 * 1024 * 1024;   // hard cap per file
  const IMG_SHRINK_OVER = 1.5 * 1024 * 1024;
  const IMG_MAX_SIDE = 2000;
  const filePath = (fid) => `${cloudUser.id}/${fid}`;

  const fmtSize = (n) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
  function fileIcon(f) {
    const t = (f.type || '') + ' ' + f.name.toLowerCase();
    if (/image\//.test(t)) return '🖼';
    if (/pdf/.test(t)) return '📄';
    if (/sheet|excel|csv|\.xls/.test(t)) return '📊';
    if (/word|\.doc/.test(t)) return '📝';
    if (/presentation|powerpoint|\.ppt/.test(t)) return '📽';
    return '📎';
  }

  function filesSection(a) {
    const files = [...(a.files || [])].sort((x, y) => (y.addedAt || '').localeCompare(x.addedAt || ''));
    return `
        <div>
          <div class="section-head"><h2 style="margin:0">Attachments <span class="muted small">(${files.length})</span></h2><button class="btn sm ghost" data-act="add-file" data-id="${a.id}">+ Add file</button></div>
          ${files.length ? `<ul class="list">${files.map((f) => `
            <li>
              <span class="file-ic" aria-hidden="true">${fileIcon(f)}</span>
              <div class="grow">
                <button type="button" class="link-btn file-link" data-act="open-file" data-id="${a.id}" data-fid="${f.id}">${esc(f.name)}</button>
                <div class="small muted">${fmtSize(f.size || 0)}${f.addedAt ? ' · ' + fmtDate(f.addedAt.slice(0, 10)) : ''}</div>
              </div>
              <button class="icon-btn" data-act="del-file" data-id="${a.id}" data-fid="${f.id}" title="Delete">✕</button>
            </li>`).join('')}</ul>`
            : `<div class="empty">${cloudOn() ? 'Proposals, census files, benefit summaries, signed agreements… Up to 10 MB each.' : 'Set up cloud sync to attach files. They are stored in your Supabase project.'}</div>`}
        </div>`;
  }

  /** Shrink a large photo so it uploads and opens quickly. Returns the original if that isn't smaller. */
  async function shrinkImage(file) {
    if (!/^image\/(jpeg|png|webp|heic|heif)$/.test(file.type) || file.size <= IMG_SHRINK_OVER) return file;
    try {
      const bmp = await createImageBitmap(file);
      const k = Math.min(1, IMG_MAX_SIDE / Math.max(bmp.width, bmp.height));
      const c = document.createElement('canvas');
      c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
      c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
      if (bmp.close) bmp.close();
      const blob = await new Promise((res) => c.toBlob(res, 'image/jpeg', 0.82));
      if (!blob || blob.size >= file.size) return file;
      return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
    } catch (e) { return file; } // a format this browser can't read: keep it as it is
  }

  function pickFiles(acct) {
    if (!acct) return;
    if (!cloudOn()) { toast('Set up cloud sync first. Attachments are stored in your Supabase project.'); return; }
    const input = document.createElement('input');
    input.type = 'file'; input.multiple = true;
    input.addEventListener('change', () => { if (input.files.length) addFiles(acct.id, [...input.files]); });
    input.click();
  }

  /** Upload files and attach them to an account. Returns how many were added. */
  async function addFiles(accountId, list) {
    if (!cloudOn()) { toast('Set up cloud sync first.'); return 0; }
    if (!navigator.onLine) { toast("You're offline. Add files once you're back online."); return 0; }
    let added = 0; const problems = [];
    for (const original of list) {
      const file = await shrinkImage(original);
      if (file.size > FILE_MAX) { problems.push(`${original.name} is over 10 MB`); continue; }
      const id = uid();
      toast(`Uploading ${file.name}…`);
      const { error } = await sb.storage.from(FILE_BUCKET).upload(filePath(id), file, { contentType: file.type || 'application/octet-stream', upsert: false });
      if (error) { problems.push(`${original.name}: ${/bucket not found/i.test(error.message || '') ? 'file storage is not set up yet. Run supabase-setup.sql again.' : error.message}`); continue; }
      const acct = getAccount(accountId);
      if (!acct) { sb.storage.from(FILE_BUCKET).remove([filePath(id)]).catch(() => {}); break; } // account deleted meanwhile
      (acct.files ||= []).push({ id, name: file.name, size: file.size, type: file.type || '', addedAt: new Date().toISOString() });
      touch(acct); save(); added++;
      if (!modal.open) rerender();
    }
    if (problems.length) toast(problems.join(' · '));
    else if (added) toast(added === 1 ? 'File attached' : `${added} files attached`);
    return added;
  }

  async function openFile(acct, fid) {
    const f = acct && (acct.files || []).find((x) => x.id === fid);
    if (!f) return;
    if (!cloudOn()) { toast('Sign in to cloud sync to open attachments.'); return; }
    const viewable = /^(image\/|application\/pdf|text\/)/.test(f.type || '');
    const win = window.open('', '_blank'); // opened now, while the tap still counts, so it isn't blocked
    const { data, error } = await sb.storage.from(FILE_BUCKET).createSignedUrl(filePath(f.id), 300, viewable ? undefined : { download: f.name });
    if (error || !data) {
      if (win) win.close();
      toast(`Could not open ${f.name}: ${error ? error.message : 'no link'}`);
      return;
    }
    if (win) win.location.href = data.signedUrl; else window.location.href = data.signedUrl;
  }

  // ---------- cloud sync (Supabase) ----------
  // Each record is one row in the `records` table of your Supabase project (see supabase-setup.sql).
  // A sync downloads rows changed since the last one, merges them field by field with any local
  // edits, then uploads only the records edited on this device. You sign in with an email and
  // password; the database only lets a signed-in user read and write their own rows.
  const CLOUD_KEY = 'minicrm.cloud';
  const OLD_SYNC_KEY = 'minicrm.sync'; // GitHub sync from earlier versions
  const sync = { status: 'off', message: '', last: null, timer: null, running: false, again: false, needsRender: false };
  try { cloudCfg = JSON.parse(localStorage.getItem(CLOUD_KEY)); } catch (e) { /* none */ }

  const makeClient = (cfg) => window.supabase.createClient(cfg.url, cfg.key, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
  });

  /** Unwrap a Supabase reply, turning its error into an exception. */
  const ok = ({ data, error }) => {
    if (error) throw Object.assign(new Error(error.message || 'Cloud error'), { status: error.status, code: error.code });
    return data;
  };

  const ROW_COLS = 'key,parent,data,ts,deleted,seq';

  async function pullSince(cursor) {
    const rows = [];
    for (let from = cursor; ;) {
      const page = ok(await sb.from('records').select(ROW_COLS).eq('user_id', cloudUser.id).gt('seq', from).order('seq').limit(1000));
      rows.push(...page);
      if (page.length < 100) break; // a short page is the last one, whatever row cap the project uses
      from = page[page.length - 1].seq;
    }
    return rows;
  }

  async function pullKeys(keys) {
    const rows = [];
    for (let i = 0; i < keys.length; i += 100) {
      rows.push(...ok(await sb.from('records').select(ROW_COLS).eq('user_id', cloudUser.id).in('key', keys.slice(i, i + 100))));
    }
    return rows;
  }

  const nestedName = (prefix) => Object.keys(NESTED).find((n) => NESTED[n] === prefix);

  /** Merge downloaded rows into the data on this device. Returns the storage keys that changed. */
  function applyRemote(rows) {
    const tops = new Set();
    const accounts = new Map(state.accounts.map((a) => [a.id, a]));
    const byPrefix = new Map(COLLECTIONS.map(([name, prefix]) => [prefix, name]));

    const locate = (key, parent) => {
      const cut = key.indexOf(':') + 1;
      const prefix = key.slice(0, cut); const id = key.slice(cut);
      if (prefix === 'd:') {
        return { top: key, get: () => state.days[id], set: (o) => { state.days[id] = o; }, remove: () => { delete state.days[id]; } };
      }
      let arr; let top = key; let wrap = (o) => o;
      const nested = nestedName(prefix);
      if (nested) {
        const acct = accounts.get(parent) || state.accounts.find((a) => (a[nested] || []).some((x) => x.id === id));
        if (!acct) return null; // its account is gone
        arr = (acct[nested] ||= []); top = 'a:' + acct.id;
      } else if (byPrefix.has(prefix)) {
        arr = state[byPrefix.get(prefix)];
        if (prefix === 'a:') {
          wrap = (o, old) => {
            const full = { ...o, activities: old ? old.activities : [], keyDates: old ? old.keyDates : [], contacts: old ? old.contacts : [], files: old ? old.files || [] : [] };
            migrateAccount(full);
            accounts.set(id, full);
            return full;
          };
        }
      } else return null;
      const at = () => arr.findIndex((x) => x.id === id);
      return {
        top,
        get: () => arr[at()],
        set: (o) => { const i = at(); if (i >= 0) arr[i] = wrap(o, arr[i]); else arr.push(wrap(o, null)); },
        remove: () => { const i = at(); if (i >= 0) arr.splice(i, 1); if (prefix === 'a:') accounts.delete(id); },
      };
    };

    const isNested = (r) => !!nestedName(r.key.slice(0, r.key.indexOf(':') + 1));
    const ordered = [...rows.filter((r) => !isNested(r)), ...rows.filter(isNested)]; // accounts before their contacts
    for (const r of ordered) {
      const loc = locate(r.key, r.parent);
      const cur = loc && loc.get();
      const dirty = local.dirty.has(r.key);
      if (cur && cur._s === r.seq) continue; // already have this version
      if (r.deleted) {
        if (cur && dirty && (cur._ts || 0) > r.ts) { cur._s = r.seq; tops.add(loc.top); continue; } // edited here after the delete: keep it
        if (cur) { loc.remove(); tops.add(loc.top); }
        delete state.deleted[r.key]; delete local.seen[r.key]; local.dirty.delete(r.key);
        continue;
      }
      const tomb = state.deleted[r.key];
      if (tomb != null) {
        if (tomb >= r.ts) { local.seen[r.key] = r.seq; continue; } // deleted here more recently: the delete uploads next
        delete state.deleted[r.key]; delete local.seen[r.key]; local.dirty.delete(r.key);
      }
      if (!loc || !r.data) continue;
      const incoming = { ...r.data, _s: r.seq };
      const next = cur && dirty ? { ...mergeRecord(cur, incoming), _s: r.seq } : incoming;
      loc.set(next);
      tops.add(loc.top);
    }
    return tops;
  }

  /** Upload records edited on this device. Returns keys the cloud refused because it holds a newer version. */
  async function pushDirty() {
    const live = new Map();
    for (const [key, obj, , top, parent] of records(state)) if (local.dirty.has(key)) live.set(key, { obj, top, parent });
    const rows = []; const sent = new Map(); const tops = new Set();
    for (const key of [...local.dirty]) {
      const wid = uid();
      if (live.has(key)) {
        const { obj, top, parent } = live.get(key);
        const data = { ...obj };
        delete data._s;
        if (key.startsWith('a:')) for (const n of Object.keys(NESTED)) delete data[n];
        rows.push({ user_id: cloudUser.id, key, parent, data, ts: obj._ts || 0, deleted: false, base: obj._s || 0, wid });
        sent.set(key, { wid, ts: obj._ts || 0, obj, top });
      } else if (state.deleted[key] != null) {
        rows.push({ user_id: cloudUser.id, key, parent: null, data: null, ts: state.deleted[key], deleted: true, base: local.seen[key] || 0, wid });
        sent.set(key, { wid, ts: state.deleted[key], tomb: true });
      } else local.dirty.delete(key);
    }
    const refused = []; const gone = [];
    for (let i = 0; i < rows.length; i += 200) {
      const back = ok(await sb.from('records').upsert(rows.slice(i, i + 200), { onConflict: 'user_id,key' }).select('key,seq,wid'));
      for (const r of back) {
        const s = sent.get(r.key);
        if (!s) continue;
        if (r.wid !== s.wid) { refused.push(r.key); continue; }
        if (s.tomb) {
          if (r.key.startsWith('f:')) gone.push(filePath(r.key.slice(2)));
          if (state.deleted[r.key] === s.ts) { delete state.deleted[r.key]; delete local.seen[r.key]; local.dirty.delete(r.key); }
          else local.seen[r.key] = r.seq;
        } else {
          s.obj._s = r.seq;
          if (snapshot.has(r.key)) snapshot.get(r.key).s = r.seq;
          tops.add(s.top);
          if ((s.obj._ts || 0) === s.ts) local.dirty.delete(r.key); // not edited again while uploading
        }
      }
    }
    persist(tops);
    if (gone.length) sb.storage.from(FILE_BUCKET).remove(gone).catch(() => {}); // best effort: the record is already gone
    return refused;
  }

  /** Take in downloaded rows, save them and refresh the screen if anything changed. */
  function takeRemote(rows, moveCursor) {
    const tops = applyRemote(rows);
    if (moveCursor) for (const r of rows) if (r.seq > local.cursor) local.cursor = r.seq;
    if (tops.size) snapshot = fingerprints(state);
    persist(tops);
    if (!tops.size) return;
    clearTimeout(save.countsTimer);
    save.countsTimer = setTimeout(updateCounts, 60);
    const el = document.activeElement;
    if (el && el.matches('input, textarea, select')) sync.needsRender = true;
    else rerender();
  }

  function scheduleSync(ms = 2000) {
    clearTimeout(sync.timer);
    sync.timer = setTimeout(syncNow, ms);
  }

  async function syncNow() {
    if (!cloudOn()) return;
    if (sync.running || modal.open) { sync.again = true; return; } // never swap state under an open form
    if (!navigator.onLine) { setSyncStatus('offline'); return; }
    sync.running = true;
    setSyncStatus('syncing');
    try {
      for (let attempt = 0; attempt < 4; attempt++) {
        const rows = await pullSince(local.cursor);
        if (modal.open) { sync.again = true; break; }
        takeRemote(rows, true);
        const refused = await pushDirty();
        if (!refused.length) break;
        const newer = await pullKeys(refused); // the cloud has a newer copy: merge it in and upload again
        if (modal.open) { sync.again = true; break; }
        takeRemote(newer, false);
      }
      sync.last = new Date();
      setSyncStatus(sync.again || local.dirty.size ? 'pending' : 'idle');
      if (local.dirty.size && !sync.again) scheduleSync(5000);
    } catch (e) {
      const signedOut = e.status === 401 || /jwt|token/i.test(e.message || '');
      setSyncStatus(navigator.onLine ? 'error' : 'offline', signedOut ? 'Your sign-in has expired. Sign in again.' : e.message);
    } finally {
      sync.running = false;
      if (sync.again && !modal.open) { sync.again = false; scheduleSync(500); }
    }
  }

  /** Open the saved cloud connection, if this device has one. */
  async function startCloud() {
    let old = null;
    try { old = localStorage.getItem(OLD_SYNC_KEY); } catch (e) { /* none */ }
    if (old && !cloudCfg) {
      // The earlier GitHub sync kept an access token here. Remove it; the data itself is on this device.
      try { localStorage.setItem(OLD_SYNC_KEY, JSON.stringify({ moved: true })); } catch (e) { /* ignore */ }
      setSyncStatus('error', 'Sync has moved from GitHub to a database. Set it up again on each device.');
      return;
    }
    if (!cloudCfg || !window.supabase) { setSyncStatus('off'); return; }
    try {
      sb = makeClient(cloudCfg);
      const { data } = await sb.auth.getSession();
      cloudUser = data && data.session ? data.session.user : null;
      sb.auth.onAuthStateChange((evt, session) => {
        cloudUser = session ? session.user : null;
        if (!cloudUser && cloudCfg) setSyncStatus('error', 'You are signed out. Sign in again to keep syncing.');
      });
    } catch (e) { cloudUser = null; }
    if (cloudUser) setSyncStatus('pending');
    else setSyncStatus('error', 'You are signed out. Sign in again to keep syncing.');
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
    const side = $('#side-status');
    side.className = `side-status sync-${status}`;
    side.querySelector('span').textContent = { off: 'Saved on this device', pending: 'Saving…', syncing: 'Syncing…', idle: 'Synced across devices', offline: 'Offline: saved on this device', error: 'Sync stopped' }[status];
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
    if (cloudOn()) {
      openModal('Cloud sync', `
        <div id="sync-live">${syncStatusHtml()}</div>
        <p class="small">Signed in as <strong>${esc(cloudUser.email || '')}</strong>.
          Changes save on this device first and sync within a few seconds whenever you're online.</p>
        <div class="row">
          <button type="button" class="btn ghost" id="sync-now">Sync now</button>
          <button type="button" class="btn danger" id="sync-disconnect">Sign out on this device</button>
        </div>`, () => {}, 'Done');
      $('#sync-now').addEventListener('click', () => { modal.close(); syncNow(); });
      $('#sync-disconnect').addEventListener('click', async () => {
        if (!confirm('Stop syncing on this device? Your data stays on this device and in the cloud.')) return;
        const client = sb;
        sb = null; cloudUser = null; cloudCfg = null;
        try { localStorage.removeItem(CLOUD_KEY); } catch (e) { /* ignore */ }
        try { await client.auth.signOut({ scope: 'local' }); } catch (e) { /* already signed out */ }
        modal.close(); setSyncStatus('off'); toast('Signed out');
      });
      return;
    }

    const cfg = cloudCfg || {};
    openModal('Set up cloud sync', `
      <p class="small">Keep the same data on your phone and computer with your own Supabase project.
        Enter the same details on each device.</p>
      <ol class="small sync-steps">
        <li>Create a free project at <a href="https://supabase.com/dashboard" target="_blank" rel="noopener">supabase.com/dashboard</a>.</li>
        <li>Open its <em>SQL Editor</em>, paste in <code>supabase-setup.sql</code> from this app's repository, and run it once.</li>
        <li>Copy the <em>Project URL</em> and the <em>publishable (anon) key</em> from the project's API settings.</li>
      </ol>
      ${field('Project URL', `<input name="url" required placeholder="https://xxxx.supabase.co" value="${esc(cfg.url || '')}" autocapitalize="off" autocorrect="off" spellcheck="false">`)}
      ${field('Publishable (anon) key', `<input name="key" required value="${esc(cfg.key || '')}" autocomplete="off" autocapitalize="off" spellcheck="false">`)}
      ${field('Email', `<input name="email" type="email" required autocomplete="username" autocapitalize="off">`)}
      ${field('Password', `<input name="password" type="password" required minlength="8" autocomplete="current-password">`)}
      <label class="row small" style="flex-wrap:nowrap;align-items:flex-start"><input type="checkbox" name="signup" style="width:auto;flex:none"> <span>First time: create my account with this email and password</span></label>
      <div id="sync-connect-msg"></div>`, (data) => { connectCloud(data); return false; }, 'Sign in');
  }

  async function connectCloud(data) {
    const msg = $('#sync-connect-msg');
    const show = (html) => { if (msg) msg.innerHTML = html; };
    const fail = (text) => show(`<div class="sync-error">${esc(text)}</div>`);
    const cfg = { url: data.url.trim().replace(/\/+$/, ''), key: data.key.trim() };
    if (!/^https:\/\/[\w.-]+(:\d+)?$/.test(cfg.url)) return fail('Enter the project URL, e.g. https://xxxx.supabase.co');
    if (!window.supabase) return fail('The sync library did not load. Reload the app and try again.');
    show('<div class="muted">Checking…</div>');
    try {
      const client = sb && cloudCfg && cloudCfg.url === cfg.url && cloudCfg.key === cfg.key ? sb : makeClient(cfg);
      const cred = { email: data.email.trim(), password: data.password };
      const res = data.signup ? await client.auth.signUp(cred) : await client.auth.signInWithPassword(cred);
      if (res.error) return fail(/fetch|network/i.test(res.error.message || '') ? 'Could not reach that project. Check the Project URL and your connection.' : res.error.message || 'Could not sign in.');
      if (!res.data.session) return show('<div class="muted">Account created. Open the confirmation email, then come back, untick the box and sign in.</div>');
      const user = res.data.session.user;
      const probe = await client.from('records').select('key').eq('user_id', user.id).limit(1);
      if (probe.error) return fail(`Signed in, but the database is not set up yet. Run supabase-setup.sql in the SQL Editor. (${probe.error.message})`);
      const remoteHasData = probe.data.length > 0;
      const localHasData = state.accounts.length || state.tasks.length;

      const finish = (useCloud) => {
        cloudCfg = cfg; sb = client; cloudUser = user;
        try { localStorage.setItem(CLOUD_KEY, JSON.stringify(cfg)); localStorage.removeItem(OLD_SYNC_KEY); } catch (e) { /* ignore */ }
        // Start from the beginning of the cloud copy, and queue everything on this device to upload.
        local.user = user.id; local.cursor = 0; local.seen = {}; local.dirty = new Set();
        if (useCloud) { state = emptyState(); snapshot = fingerprints(state); }
        else {
          for (const [key, obj] of records(state)) { delete obj._s; local.dirty.add(key); }
          for (const key of Object.keys(state.deleted)) local.dirty.add(key);
        }
        persist();
        modal.close(); rerender(); syncNow();
        toast('Sync connected');
      };

      if (!(localHasData && remoteHasData)) return finish(false);
      openModal('Cloud data found', `
        <p>Your cloud account already has Bbars OS data, and this device has data too.</p>
        <label class="row"><input type="radio" name="mode" value="merge" checked style="width:auto">
          <span><strong>Merge both</strong>: keep everything from this device and the cloud. Right for a device that was already syncing.</span></label>
        <label class="row"><input type="radio" name="mode" value="cloud" style="width:auto">
          <span><strong>Use the cloud data</strong>: replace what's on this device. Best if this device only has test or sample data.</span></label>`,
      (choice) => { finish(choice.mode === 'cloud'); return false; }, 'Continue');
    } catch (e) {
      fail(e.message || 'Could not reach the database. Check your connection.');
    }
  }

  $('#btn-sync').addEventListener('click', syncSettings);
  window.addEventListener('online', () => syncNow());
  window.addEventListener('offline', () => cloudOn() && setSyncStatus('offline'));
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
  (async () => {
    if (!(await bootStorage())) {
      $('#view').innerHTML = '<div class="empty">Could not open the saved data on this device. Close other Bbars OS tabs and reload. Nothing has been changed.</div>';
      return;
    }
    await startCloud();
    route();
    syncNow();
  })();
})();
