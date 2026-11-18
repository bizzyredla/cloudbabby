# Bbars OS

A lightweight sales CRM for **partner** and **prospect** accounts, with a built-in **daily planner**.
No install, no build step: open `index.html` in a browser.

## Features

**Accounts**
- Two account types, each with its own stages. The Type field decides which list the Stage picker
  offers, and a one-line definition shows under it
  - **Prospect (deal) stages:** S1 – Discovery Scheduled → S2 – Qualified Opportunity →
    S3 – Solution & Quote Development → S4 – Proposal Presented → S5 – Decision / Negotiation →
    Closed Won / Closed Lost, plus Nurture and Revisit for deals that are parked
  - **Partner (channel) stages:** Target (fits, no two-way conversation yet) → Engaged (replied or
    talked with us) → Met (meeting held, partnership discussed) → Committed (agreed to refer, no
    referral yet) → Producing (referral in the last 6 months) → Dormant (open or signed, no referral
    in 6+ months) → Closed (declined, or exclusive elsewhere)
  - Open pipeline counts prospects in S1–S5 only. Older stage names convert automatically
    (e.g. Proposal → S4, Won → Closed Won, Active → Producing, At Risk → Dormant)
  - Spreadsheet imports accept the full name, just "S3", the words after the dash, or an old name
- **Partner details** (shown when Type is Partner):
  - **Partner type:** Benefits Broker, P&C Broker, CPA / Accountant, Attorney, Banker / Lender,
    HR Consultant, Payroll / HR Technology, Business Consultant, Private Equity, Association / Franchise.
    Shown on the table, cards and account page; filter Accounts by it
  - **Last touch date:** the latest logged activity, or a date you type for touches made outside the app
  - **Last referral date:** type it, or it updates when you link an account to the partner
    ("Referred by partner"). A Producing partner with no referral in 6+ months is flagged "Dormant?"
  - **Ready-made tags:** tap to add EB-Small-Target / -Engaged / -Active, EB-Large-Target / -Engaged /
    -Active, AgcyProd-EB-Cold / -Warm / -Active. Saved views can filter on them before they're in use
  - All three are in CSV export and import ("Partner type", "Last touch", "Last referral")
  - Partner pages and forms leave out deal-only fields (expected close, admin fees, current
    vendors) and always show **Referred accounts**
- **Stage changes do the follow-up:** moving a prospect to Revisit asks when to go back (14 / 30 /
  60 / 90 days or a date); moving any account to Closed Won, Closed Lost or Closed offers to stop
  its running cadences
- Saved views can also filter by partner type and tier. Search matches partner type and stage, and
  a contact result opens the account scrolled to that person
- **Multiple contacts** per account: name, title, email, phone, role in the deal (decision maker,
  champion, HR…), notes, and one marked primary. Activities can be logged against a contact
- **Current vendors**: pick from a dropdown of the top 20 TriNet competitors (ADP TotalSource,
  Insperity, Paychex PEO, Justworks, Rippling PEO, Gusto, Vensure, CoAdvantage, Sequoia One,
  G&A Partners, Engage PEO, BBSI, Extensis Group, Questco, Infiniti HR, ADP Workforce Now, Paycor,
  Paylocity, Paycom, Deel), or type any other vendor
- Website, industry, deal/annual value, tags, free-form notes
- **Next follow-up date** and **next revisit date** (with a purpose note) on every account
- Three layouts for accounts, shared by the Accounts page and every list. The choice is remembered per device:
  - **Table**: sortable columns (click a header) for stage, contact, vendors, value, follow-up,
    revisit and last touch
  - **Board**: a pipeline by stage, with separate prospect and partner pipelines and stage value
    totals. Drag a card to change its stage (on phones, use the stage picker on the card).
    Stage changes are logged to history
  - **Cards**: a compact grid, and the default on phones
- Clicking any account opens its full record page
- **Key dates** (renewals, contract end, QBRs, decision dates, etc.) that can be marked done
- **History timeline** of calls, emails, meetings, demos and notes. Logging an activity can also
  set the next follow-up, update the stage, and add the follow-up to your planner
- **Outcome quick picks** when you log an activity: pick the type, then tap what happened (Call:
  Connected - interested, Connected - not now, Left voicemail, No answer, Meeting set, Not a fit;
  Email, LinkedIn, Text, Meeting and Demo have their own). It fills the summary ("Call: Left
  voicemail") and sets the next follow-up (voicemail → 2 workdays, not now → 30, not a fit → none)
- Search (including contacts and vendors), filter by type, stage or vendor, and sort by next
  follow-up, name, last update or value

**Cadences** (sequences)
- **Sessions (power-dialer style, no telephony needed):** ▶ Start session on the Cadences page, a
  cadence ("Work this cadence") or the planner. Choose Calls, Emails, LinkedIn or all step types,
  one cadence or all, and a step number; it shows how many are due. The queue runs account by
  account (everyone at a company back to back, most overdue first). Each card has the contact,
  tap-to-call buttons (direct, mobile, main line), the talk track with merge fields filled in, the
  account's notes, vendors, last touch and recent activity, and who's up next. Tap an outcome (or
  press 1–5) to log it, advance the cadence, count it on the daily plan and load the next person.
  The cadence's smart rules decide what happens next (below); ★ Meeting booked finishes it.
  Skip for now (S) leaves it due; Snooze (N) moves it to the next workday. A progress bar shows
  "7 of 22", the place is kept if the app reloads after a call, and a summary shows at the end
- Multiple cadences, e.g. Insperity Renewal, ADP TotalSource Nurture, New Prospect Intro. Starter
  templates are included and every step is editable
- Steps have a day, type (Email, Call, LinkedIn, Visit, Text, Task), name, email subject and
  script, with merge fields: {{first_name}}, {{company}}, {{vendor}}, {{title}}, {{industry}},
  {{employees}}, {{renewal_date}}. Weekends can be skipped automatically
- Enroll contacts one by one (⇉ on a contact card) or in bulk from any saved list or vendor group.
  **Spread start dates** (on by default): a big batch starts over several workdays, up to N new
  people a day (8 to start; remembered), keeping people at the same company on the same day. The
  form previews it ("33 people start over 5 workdays, Nov 12 – Nov 18")
- **Steps | Calendar | Results** switch at the top of the Cadences page (remembered on each device)
- **Steps**: each cadence's stats (active, due, overdue, paused, engaged, engage rate), its smart
  rules, a visual step track with how many people are at each step and each step's hit rate, a
  "Due now" queue, and everyone's progress bar, last touch, next touch and status
- **Calendar**: Work week or Month, ‹ › and Today
  - One chip per cadence step per day: type, step name, cadence and how many people. One color
    per cadence (tap the legend to hide one); faded = done, red outline = overdue (overdue steps
    sit on today). Later steps are projected at the cadence's spacing
  - Click a chip to see who's on it; if it's due, "▶ Work these now" starts a session for exactly
    that cadence step. Click a day's count (red when over your capacity) to move all its steps to
    the next workday, a week later or a date you pick, or skip them. Each person's later steps
    move with them
  - **Cadence timelines**: every cadence drawn on one day axis, so you can see its shape. Flags a
    7+ day gap or two calls back to back. Drag a step to change its day; click it to edit
  - **Workload, next 2 weeks**: steps per workday across all cadences, stacked by cadence, against
    your daily capacity (25 to start; click to change). **Spread it out** moves current steps to
    later days, most overdue kept first, so no day goes over, and shows the before/after first
- **Results**: compare cadences (enrolled, reached, engaged, engage rate, meetings, bad data) and
  a step-by-step table (done, skipped, connected/replied/met and the rate), with a note when a
  later step clearly outperforms the first one
- **Smart rules** per cadence (all on to start; change them in Edit steps):
  - Connected or replied → the person is paused and the account gets a follow-up date (2 workdays
    by default, or the date you pick). Resume them from their timeline
  - Left a voicemail → when the next step is an email, it comes due the next workday
  - No answer on two calls → a "LinkedIn: connect with …" task for the next workday
  - Wrong number or bounced email → finished as bad data and the contact gets a ⚠ flag (on the
    contact card and in Contacts). Changing the number or email, or "Clear", removes it
- Tap a person for their full start-to-finish timeline: completed steps with dates and outcomes,
  the current step, and planned dates for the rest. You can pause, resume, skip, finish or restart
- "Do it" opens the step with one-tap actions (Open in Mail with subject and body filled in, Call,
  Text, LinkedIn, Directions) and the merged script. Log the outcome; "Then" follows the outcome
  and smart rules (continue, pause with a follow-up date, or finish as meeting booked, replied,
  not interested or bad data), and you can change it
- Completed steps are logged to the account history (with the contact) and counted in the daily
  activity plan. Due steps show on the Planner and Dashboard
- Contacts marked "Left company" or "Do not contact" can't be enrolled and are taken out of
  running cadences

**Ask Claude** (✦ in the top bar, or Look up → Ask Claude on any account)
- Pick a company (an account or any name) or a saved list (up to 10), tap one or more research
  flows (Company HQ & location, Company snapshot, Decision makers, HR contacts, Current PEO /
  payroll vendor, Recent news & triggers), and/or type your own request. Custom requests can be
  saved as reusable flows (synced across devices)
- **Ask Claude** opens Claude (claude.ai or the Claude app) with the request written for you,
  and also copies it. The request tells Claude to use web search, cite sources, never guess
  emails or phones, and end with a JSON block for import. No API keys or connectors needed
- Paste Claude's reply back and review it: fill in missing account fields (HQ address, city/state,
  website, LinkedIn, industry, employees, vendor, renewal), add new contacts (duplicates are
  flagged), create the account if it's new, and save the summary, news and sources to the
  account history. Existing values are only replaced if you tick them
- Your request and pasted answer are kept on the device while you switch to Claude and back

**Weekly activity report** (Home → Weekly report)
- Monday–Sunday weeks with ‹ › navigation; every number compares to the previous week (▲/▼)
- Totals: touches, calls, emails, LinkedIn, visits, meetings held, meetings booked, replies,
  cadence steps, stage advances, new accounts, won
- Touches-by-day chart (stacked by type, hover/tap for the day's breakdown, table view)
- Daily plan attainment against your 25/5/5/5 targets × workdays, and how many days you hit 25
- Cadence performance (steps, replies, meetings booked, people added), pipeline movement (stage
  changes, wins, new accounts), and most-touched accounts
- **Copy summary**: a plain-text recap to paste into an email; **Export activities (CSV)**

**Map & route planner**
- Three screens: **Accounts** (the map), **Route** (the day's stops) and **Territories** (which
  territory is overdue). **📍 Near me** is in the header of all three
- **Accounts map**: every account with an address is pinned. **Color pins by** last touch (green
  within 30 days, amber 30–60, red 60+ or never: the red pins are your prospecting plan), by
  stage, by type or by renewal window; an orange ring means a follow-up or revisit is due.
  **Partners** (brokers, CPAs) are diamonds, prospects are dots, and the **Prospects / Partners /
  Territories** chips turn each layer on or off. Filter by vendor, saved view or territory (folded
  away on a phone)
- **Near me now**: uses your location and lists accounts within ½ mile (or 1, 2, 5), closest
  first, with why each is worth a stop. ➤ directions, **+ Today** adds it to today's route, and
  **Log drop** logs it on the spot
- Tap a pin to open the account, add it to today's route, **Log drop** (outcome, who you met,
  notes, next follow-up and a photo of their business card, saved to the account's attachments;
  it counts on today's plan and ticks the route stop), see who's **Nearby**, or get directions
- **Nearby** (from a pin or the account page): accounts within 1, 2, 5 or 10 miles with their last
  touch, one tap to add each to today's route, or "add this + the 3 closest"
- **SoCal field territories**: a built-in layer of 124 color-coded drop territories covering
  LA, Orange, Ventura, Inland Empire, San Diego, Kern, Santa Barbara, SLO and Imperial counties
  (`socal-territories.json`, built from public city and LA Times neighborhood boundaries; static,
  not synced). Every mapped account is assigned to its territory automatically. An address just
  outside every outline (an unincorporated pocket, or a simplified edge) goes to the nearby
  territory that lists its city, else the closest one within 2 miles. The territory shows in the
  pin popup, on the account page, as an Accounts table **Territory** column (sortable) and as a
  saved-view filter ("Field territory is any of"). The territory dropdown filters the map by any
  of the 124, and the **Territories** chip hides the layer. **Tap a territory** for its
  scorecard: open accounts, due now, cold 30+ days, renewals in 90 days, last field day, days
  since the last touch, and the top 10 **field day picks** with their reasons, for any day you
  pick; add them all to that day's route or **Choose stops…**
- **Renewal window** pin colors: red renews within 60 days, orange 61–120, yellow 121–180, blue
  further out, gray no renewal date. Renewals come from the vendor (PEO) renewal, **Benefits
  renewal** and **Workers' comp renewal** dates on the account, plus open key dates mentioning
  "renew". The three account dates repeat yearly, so last year's date counts as this year's. The
  popup shows the next one ("Benefits renews May 1")
- **Drop-day ranking**: every account gets a score and reasons for a given day: follow-up or
  revisit due, a renewal within 60 / 120 / 180 days, never dropped, never touched or cold 30+
  days, a live deal (S2–S5), a partner behind on its tier's touches, and deal value. Mailboxes and
  homes sink to the bottom and are never auto-picked
- **Add stops** (route planner) replaces the old dropdown: a ranked list with the reasons as
  chips ("Follow-up due", "Benefits renews in 40 d", "Never dropped", "Cold 75 d"), opening on
  the territory most of the day's stops are in. Switch to everywhere, near this route (5 mi), near
  you, any territory or any drawn zone; search by name or city; Prospects / Partners; add several
  without closing it
- **Field day** (route planner): pick any of the 124 territories to fill the day's route with
  its 10 best picks
- **Outcome quick keys** on Log drop: Met the decision maker, Gatekeeper - left materials,
  Left at door, Meeting set, Asked to return, Nobody available / no access, Bad address / moved,
  Not a fit. Each sets a fitting default next follow-up (Meeting set → next workday, Asked to
  return → a week, etc.), and Bad address puts the account back on the map's Fix list. The
  visit is saved with the account, its territory and the date
- **Partner stops**: partners on a route show as "Partner stop" (and square pins), and their
  drop logger has partner outcomes: Met them - caught up, Dropped off materials, Got a referral
  (dates the partner's last referral and opens a new account already linked to them), Gave them
  a lead or intro (also counts as a give), Set a lunch & learn or meeting, Nobody available, Bad
  address. Their next follow-up defaults to the partner's tier rhythm (A monthly, B quarterly)
- **Not a drop stop**: addresses with a PMB, PO box or a "Ste 107-315" style suite are treated as
  mailboxes, and "Apt" as a home; set it by hand on the account ("The address is …") for the rest
  (a UPS Store "#3222", a shared office). They're flagged in popups, the account page and the
  picker, and left out of field-day picks
- **End of day** (route planner and the planner's Schedule): every activity logged that day,
  one row per Salesforce task (Call, Email, Meeting for visits, Other) with the account, contact,
  subject, comments, territory and next follow-up. **Copy** one row's subject and comments for
  Log a Call, **Copy all as table** (paste into a spreadsheet or Data Loader), **Copy as text** or
  **Download CSV**, then tick each one entered; the ticks are kept, and "Hide entered" shows what's
  left
- **Territories board** (Map → Territories): every territory you have accounts in, most overdue
  first. Overdue means open accounts and no field day in 30+ days. Columns: open accounts, due,
  cold 30+, renewals in 90 days, last field day and last touch, all sortable, with a region
  filter. **Plan** fills the next field day's route with that territory's best stops; tap a name
  for its scorecard
- **On a phone**: the route planner opens with a **Next stop** card (➤ Navigate, ✓ Log drop) above
  the map; route settings and map filters fold away; buttons and quick keys are full-size tap
  targets
- **Territories (drawn)**: draw your own zones on the map and pick the weekdays you're
  usually there. On those days the route planner suggests the zone's accounts that are due or
  haven't been touched in 30+ days ("Wednesday is Westside · Add these 6"). Synced
- **Saved routes**: save a day's stops as a named route ("Westside loop") and load it onto any
  day; it re-optimizes for that day. Synced
- Addresses are looked up when you save an account (and again whenever the map opens). The lookup
  takes the answer in the address's ZIP or city; if the only answers are in another city (an
  "E Huntington Dr" in Monrovia instead of Arcadia), the pin is kept but flagged "found in Monrovia
  91016". The map says how many accounts have no location or need a check (pinned only to a city,
  or found in a different city), with a Fix list: correct the address or **Drop pin** by hand
- **Route planner** for any day: stops come in automatically from that day's planner Visits and
  Revisits, due revisit dates and cadence Visit steps. Add or remove stops as needed. The route
  re-optimizes itself whenever stops change, using real drive times (OSRM), from your home base
  or current location, optionally returning to the start. You get arrival times per stop (with
  your minutes-per-visit), total drive time and miles, **Open in Google Maps** for the whole
  route, and ➤ to navigate to each stop (Apple Maps on iPhone). **✓ Visited** opens the drop
  logger, so the route and logging are one motion: the visit lands on the account (with its
  territory) and your daily plan, and the stop is ticked
- Accounts have a street address field; CSV import reads street address and ZIP columns
- Map: Leaflet (bundled in `vendor/leaflet`, BSD-2 license), map tiles © OpenStreetMap contributors (Esri World Street Map as a backup); no API key needed

**Web links, LinkedIn & ZoomInfo**
- Website and LinkedIn icons on accounts (record, table, cards, board) and contacts (cards,
  cadence people). A faded LinkedIn icon means no profile is saved yet. Tap it to search LinkedIn
- **LinkedIn company ID** (the fixed key for a LinkedIn page; the public /company/ahlem link can
  change, the number doesn't): **Add LinkedIn ID** on the account page, or the LinkedIn ID box in
  the account form, takes a Sales Navigator account link (/sales/company/16256299), the company
  page's **See jobs** link (f_C=16256299), a numeric page link (/company/16256299) or just the number,
  and keeps the number. The public page stays as the link you share. Paste a public link where the ID
  goes and it's moved to the right box with a hint (it has no ID: open it and copy See jobs). "Get the
  ID" opens the company page (on the web, even on a phone) or a Sales Navigator search
- **Sales Navigator button** next to the LinkedIn icon on accounts (record, table, cards, board): with
  an ID it opens the account in Sales Navigator; without one it's faded and searches Sales Navigator by
  name. The account page also has **People here**, a Sales Navigator lead search for people now at the
  company (LinkedIn doesn't document that link, so if it ever stops working, use the account page's
  employee list). The Look up menu has both
- **Same LinkedIn page**: two accounts with the same ID are flagged on both account pages (and when
  you save), with links to each other, as a question: one business or separate accounts (check the
  legal name and EIN)? Nothing merges on its own. Imports match on the ID first ("LinkedIn ID" in the
  duplicate list), and read "LinkedIn company ID" / "Sales Navigator URL" columns
- **Exports** carry the public LinkedIn link, the LinkedIn company ID and the Sales Navigator link, so
  all three travel to Salesforce together; search finds an account by its ID
- **Contacts**: a **Sales Navigator lead** link on each contact (a /sales/lead/ link pasted as the
  LinkedIn URL is moved there). It shows as an **SN** button next to **in**, in the Look up menu and on
  cadence LinkedIn steps, and is included in contact exports
- **Links from the Home Screen app (iPhone / iPad)**: the browser inside a Home Screen app doesn't
  share Safari's sign-ins, so links go where you're already signed in
  - a saved LinkedIn profile (linkedin.com/in/…) or company page (linkedin.com/company/…) opens the
    **LinkedIn app**
  - every other web link (LinkedIn searches, Sales Navigator, ZoomInfo, websites, Google) opens in
    **Safari** (iOS 17 or later). Apple Maps, phone, text and email links work as before
  - nothing switches on a timer, so iOS's "Open in LinkedIn?" prompt can take as long as it likes. If
    the app or Safari hasn't opened after a few seconds, a bar offers **Open in Safari** / **Open
    here** (LinkedIn) or **Open here** / **Always open here** (Safari)
  - **Settings → Links** picks the default for each, per device: LinkedIn app, Safari or Inside
    Bbars OS
  - in a Safari tab and on a computer, links open in a new tab as usual (Safari hands LinkedIn links
    to the app by itself)
- **Look up** menu on every account and contact: LinkedIn, Sales Navigator, ZoomInfo, the
  company's public ZoomInfo profile, and Google. The name is copied to the clipboard as well, so
  you can paste it if a site opens without the search filled in
- **Direct import** (Settings → Direct import; lists go through **Imports** instead): bring in accounts and contacts from an Excel file (.xlsx),
  a ZoomInfo export, or any spreadsheet saved as CSV. Opportunity columns are read too: value,
  admin fees, current vendors, lead source, stage, close date, channel partner and channel contact
  (brokers become partner accounts, linked to the accounts they referred). Columns are recognized automatically (company, website, company
  LinkedIn, employees, industry, city/state, first/last name, title, email, direct and mobile
  phone, contact LinkedIn). A preview shows what will be added. Existing accounts are matched by
  name, only empty fields are filled, duplicate contacts are skipped, and new accounts are tagged
  so they're easy to list. CSV exports include website and LinkedIn columns and re-import cleanly

**Opportunity fields & channel partners**
- Accounts carry **Admin fees** and an **Expected close** date (a Table column and sort, shown on
  Cards, Board and the account page, with Dashboard reminders as it approaches)
- **Channel partner**: link an account to the partner (broker) that referred it and the partner
  contact. The partner's page lists its referred accounts and their open value

**Contact & account fields**
- Contacts: title, role in deal, email, direct phone, mobile, LinkedIn URL, preferred channel,
  time zone, status, primary flag, notes
- Accounts: industry, employees, value, website, city/state, lead source, current vendors,
  **vendor renewal date**, follow-up and revisit dates, tags, notes. Forms are grouped into
  compact sections, and secondary details fold away on the account page

**Book: Active and Reserve** (keeps the account list to the ones you're working)
- Every account is **Active** or **Reserve**. Active is the book you work (targets: **150 active partners**
  and **300 active prospects**); Reserve is the layer behind it. The labels read Active Partner, Active
  Prospect or Reserve (partner vs prospect is the account's type, so the two never disagree). It's
  separate from the partner Tier A/B/C
- The first time this version opened, every existing account got its closest fit: open deals (S1–S5),
  live partners (Engaged, Met, Committed, Producing), anything with a follow-up or revisit date, in a
  cadence or touched in the last 90 days went to Active; Closed Won / Closed Lost / closed partners and
  quiet accounts went to Reserve. After that an account only moves when you move it
- **Active by default**: Accounts (table, cards, board), saved views, Partners, Contacts, the Overview
  counts and the sidebar count, map pins, field-day picks, Near me, the territory board and the cadence
  "add people" picker. An **Active · Reserve · All** switch on Accounts, Partners and Contacts shows the
  rest; the map has a **◌ Reserve** layer chip; the cadence picker has "Include Reserve accounts"
- **Soft counters** beside the switch: "153 / 150 active partners · 287 / 300 active prospects". Over a
  target the number turns amber; nothing is ever blocked
- Reserve accounts stay **searchable** (search reaches them from the Active view and marks them with a
  Reserve pill), open and edit normally, and keep their **follow-ups and revisits**, which still show
  in the planner when due (and as drop stops when due)
- Move one from its account page (Book · Move to Active / Reserve), the Book field in the account form,
  or many at once with **Move to Active / Reserve** in the bulk bar. Hand-added accounts start Active;
  imported ones start in Reserve unless you pick Active on the import screen
- Exports carry a **Book** column, and importing an exported file puts each account back in its book

**Watchlist** (sidebar on a computer; the 👁 icon in the phone's header)
- Accounts, partners and contacts a colleague owns that you'd go after if they leave. Its own layer:
  never in your accounts, views, map, search, counts or pipeline
- **Quick-add** in one row at the top: the name, Account / Contact / Partner, whose it is (pick a
  colleague, or "+ New colleague…" and type the name right there), the Salesforce link and why you
  want it, then Add (or Enter). The colleague and type stay picked and the cursor goes back to the name,
  so several in a row take seconds
- **Window open** first, then **Watching**, each grouped by colleague, partners above accounts and
  contacts. Each name opens its Salesforce record
- **Mark departed** on a colleague flips every Watching item of theirs to Window Open, and those items
  show "Window open · 5 days", counted from that day. Marking them active again leaves open windows open
- Status per item: Watching, Window Open, Claimed, Reassigned, Dropped. Claimed, reassigned and dropped
  ones fold into a list at the bottom; ✎ edits or removes an item. Colleagues are just a name and Active /
  Departed. No nudges or notifications

**Imports** (staging: sidebar on a computer, or Import on the Accounts page)
- Lists from Salesforce, ZoomInfo, Mployer or anywhere else land here first. **Nothing reaches your
  accounts or contacts until you approve a row and promote it**
- **One template.** The header row has to be exactly these columns, in any order and any case:
  `company_name, contact_first, contact_last, title, email, phone, website, street_address, city,
  state, zip, employee_count, industry, salesforce_url, notes` (one row per contact). A file that
  doesn't match is turned away with what's missing or extra. CSV or Excel .xlsx.
  **Copy formatting instructions** puts a ready prompt (the header plus the rules) on your clipboard:
  paste it into Claude with the raw export and upload the CSV it gives back. **Download template**
  and **Copy header row** are there too
- **Matching on upload**, in this order: website domain, then phone (an account's main line or a
  contact's phone), then email, all **exact**; then company name + city, **fuzzy** (the name matching
  knows "dba" names and "Insurance Services" suffixes). Same name in another city isn't a match but
  shows a hint. Rows repeated in the file, and people already in an earlier list, are flagged
- **List review** at the top of each list: not in your CRM, yours but untouched for 90+ days, missing a
  contact or title, an employee count or any website and phone, repeats, already in another list, and
  clusters by field territory, city and industry. Tap one to see those rows
- The **review table**: each row's company, person, match (with a link to the account) and status
  (New, Reviewed, Approved, Rejected), a note, and **Promote**, which only works on Approved rows.
  Select rows to mark them reviewed, approve or reject them together
- **Promote** a row: merge it into the account it matched (side by side, choose which fields to bring
  over; empty ones start ticked; the person is added, or their blank title / email / phone filled), or
  create a new account (Prospect or Partner, Book defaults to **Reserve**). A second row of a company
  you just created offers to merge into it. **Promote N approved** does many at once: matches merge
  (filling only empty fields), the rest become accounts, one per company
- Promoted accounts keep the **Salesforce link** from the file (it shows on the account page and can be
  edited in the account form). Deleting a list never touches the accounts promoted from it

**Accounts table and saved views** (Lists now live here; old list links open the matching view)
- **Columns you pick** (Columns, under the table): type, stage, value, employees, current vendor,
  renewal, last touch, days in stage, next step, follow-up, location, plus primary contact, close,
  revisit, industry, lead source and tags. Click any header to sort. Remembered on each device
- **Staleness on every row**: last touch and days in stage (from the account's stage-change
  history), and the next step (the soonest task, follow-up, revisit or cadence step). Red = no touch
  in 30+ days, 21+ days in stage, or an open deal with no next step
- **Inline edit**: change stage, value or next follow-up in the row without opening the account.
  Stage changes are logged and run the usual follow-ups
- **Saved views** as tabs across the top, each with a count and what changed this week
  ("+4 −2"); rows that joined since you last opened a view are marked New. "+ Save view" starts
  from your current filters. Vendor views sit under "By vendor…"
  - **Filter views** update themselves: type, stage, vendor, tag, partner type and tier, text,
    renewal window, employee range, city/county/area, industry, value range, no touch in N days,
    N+ days in stage, no next step, not in a cadence. "Insperity, 20–150 employees, Irvine, renews
    within 90 days" or "S3+, no next step" are one view each
  - **Hand-picked lists** hold the accounts you put in them ("Brokers Brew members", "Q1 gift
    drop"): tick rows and use "Add to a hand-picked list", or "+ List" on an account page
  - **Pin** up to three views to the Overview, where they show as counts with this week's change
  - **All views** (the link at the end of the tab row) opens **Segments**: every saved view, for
    accounts and contacts, on one page. Each card shows the object, Filters or Hand-picked, its size
    in your Active book (Reserve counted apart), when it was last changed, whether it's pinned, and
    what it filters on. Search, show account or contact views only, sort by recently updated, name
    or size. Open goes straight to Accounts or Contacts with that view on
- **Actions on a view or the rows you tick**: enroll in a cadence (primary contact, everyone,
  decision makers, or titles containing a word; start dates can be spread over workdays), start a
  call session for whatever is due, add to a day's route, set stage, add a tag, add to a
  hand-picked list, and export accounts or a contacts file shaped for ZoomInfo / Apollo uploads
- **Vendor scoreboard**: every incumbent with account count, open deals and pipeline, average
  employees, renewals in the next 90 days and wins. Click one to open its accounts
- **Import duplicate check**: companies are matched on website domain first, then name, then the
  name without LLC / Inc. / punctuation, then a name the company also goes by ("PCH Benefits
  (Thomas R. Means)" ↔ "Thomas R. Means Inc. dba PCH Benefits"), then the same name with extra
  words that only describe the business ("Maxwell Agency" ↔ "Maxwell Agency Insurance Services").
  The import screen lists each likely duplicate with a tick box (untick one to create it new
  instead), offers **possible matches** for companies that would be new ("Petra Risk Solutions
  San Diego → Petra Risk Solutions?", only merged if you tick it), and lists the names it will
  create, so a near-miss is easy to spot before you import
- **Corrected addresses**: when a file has address columns, the import can also replace the street
  and city on accounts you already have ("Use this file's addresses on existing accounts too"); the
  map then finds the new spot

**Everywhere**
- Search accounts and contacts from any screen (🔍, or press `/` or Ctrl/⌘-K on a computer)
- Settings (sliders icon): cloud sync, export/import backup, load sample data, erase all data
- On phones, a bottom tab bar like a native app. Updates install themselves on the next launch
- **Long lists show the first 10**, then a full-width **Show N more ▾** bar opens the rest
  (**Show fewer ▴** closes it). Open or closed is remembered for each list on the device. It's on
  the Overview (priority tasks, priority accounts, stay in touch, recent activity), the planner's
  queue groups and stale accounts, an account's history and key dates, a partner's people,
  referrals, clients and deals, a cadence's due list and people, each Watchlist group, the Imports
  list of lists, Segments, the map's side lists and Near me, and the weekly report's most-touched
  accounts. The Accounts, Contacts and Partners pages keep their own paging (200 rows, then Show
  all), as do the import review table and the Territories board
- A red banner appears if sync ever stops (for example an expired sign-in), so you never
  unknowingly work unsynced
- Stage changes are logged to history whether they're made on the board, in Edit, or while
  logging an activity. You're warned before creating two accounts with the same name

**Stay in touch** (recurring relationship reminders)
- On any contact card: **Stay in touch: Monthly ▾**. Choose weekly, every 2 weeks, monthly, quarterly,
  every 6 months or yearly
- "Last contacted" fills in by itself from logged calls, emails, LinkedIn touches, visits, cadence
  steps and checked planner rows with that person. Next due = last contacted + the interval
- **Log touch** records the activity and restarts the clock; **↻ Reset** restarts it from today
  without logging anything (for a text or a chance meeting)
- Due contacts appear on the Overview's Stay in touch card and as rows in the planner's work
  queue; checking one off logs the touch
- Included in CSV export and import ("Stay in touch" column, primary contact)

**Partners (your ecosystem)**: a light layer on partner accounts, not a separate PRM. It measures
value first, then spends your time by tier
- **Tiers** (automatic; set one by hand under Edit → Partner details if you know better):
  - **A · Producing**: referred a deal in the last 12 months. Touch monthly
  - **B · Warm**: met or committed (or referred before), no referral in 12 months. Touch quarterly,
    aiming for a first referral
  - **C · Cold**: signed or imported, not met yet. Worked through the Activate cadence, never
    re-engage tasks
- **Partners page** (sidebar; on iPhone, Accounts | Contacts | Partners):
  - Tier tiles as touch targets with a gap: "Tier A: 2 of 3 touched in 30 days", "Tier B: 1 of 2
    in 90 days", "Tier C: 3 of 4 in Activate cadence · N steps this week", and referred pipeline
    with est. comp. Click a tile to filter
  - **Partner table**: tier, type, referrals (12 mo), referred pipeline, est. comp won / open,
    given / got, last touch and next step (a task, or the cadence step they're on). Click any
    column to sort (default: tier, then referrals). Quick filters: tier, past touch target,
    agreement ending. Red = past the tier's touch target, getting without giving, or nothing
    planned for an A/B partner. Export to CSV
  - **Reciprocity**: given (green) vs received (gold) per partner, last 12 months, with one-tap
    logging of a client intro, co-marketing, event invite, benchmark report or referral out. Each
    is saved as an activity on the partner (it counts as a touch)
  - **Client map**: a partner's clients worth raising (renewing in 90 days, on a competitor PEO, or
    already a target), with vendor and renewal date. "Add" makes a co-sell prospect; **Copy call
    agenda** puts their open referrals, renewals, competitor clients and what you've shared on the
    clipboard
  - **Agreements**: end dates with a 60-day warning
- **Partner cadences**: "Enroll N in Activate" creates the Partner Activate cadence (6 steps over
  3 weeks: intro email, call, LinkedIn, one-pager, booking call, benchmark offer) and enrolls each
  cold partner's main contact, spread over workdays. Tier B gets a quarterly "Partner value
  share" cadence the same way. People leave Activate once met or referring, and value share on the
  first referral ("Sent a referral")
- Health scoring (the same four signals for every partner) is gone; the tier and its touch target
  replace it
- **Partner page tabs**: Overview (the full record plus a strip with tier, touch target, given / got,
  agreement and end date, comp plan, owner, next step) · People (stakeholder map with role, influence, Stay in touch cadence and
  who's overdue) · Accounts (what they referred, former referrals to resell, their clients) ·
  Pipeline & comp · Plan (playbook, co-sell plan, resource links such as your Highspot page,
  attachments)
- **Partner fields**: partner type, tier (automatic or set by hand), agreement (None / In
  discussion / Signed / Expired) and end date, comp plan, national agreement, owner, last touch
  and last referral dates
- **Referral scorecard** (Pipeline & comp tab): referrals in 12 months, win rate, average won deal,
  est. comp won / open, days from referral to close, given / got. "Copy for a partner review"
  puts a ready summary on the clipboard
- **Their clients**: paste a book of business (from Mployer's client summary or a spreadsheet);
  name, location, employee count, EIN, current vendor (e.g. Insperity) and renewal date (1/1/2027
  or "Jan 1") are picked up; ✎ edits any client. Clients already in your CRM are flagged.
  Mark each as client (broker of record), co-sell target or former referral; "+ Prospect" creates
  a co-sell prospect linked to the partner
- **+ Log referral**: company, contact and stage in one step; links the deal and the partner
  contact who sent it, and updates the partner's last referral
- **Comp calculator**: enrolled employees, annual admin fees and setup fee, compared across every
  plan side by side (including the $10 vs $25 per-employee difference). Opens prefilled from a
  referred deal and can save the numbers back. Every figure is labelled an estimate
- **Comp rates** (editable, synced): 25% of admin + setup fees; $10 per enrolled employee per
  month; $25 promo; OMS (enter your rates); Q4 $5,000 one-time bonus, counted on deals closing in
  its dates. Change a rate once and every estimate follows. Prospects get "Setup fee" and
  "Enrolled employees" fields (enrolled defaults to employees)
- **Four automatic rules** (switch each off on the Partners page): a new partner gets the
  playbook for its type as dated planner tasks (broker, advisor, or association/franchise/tech);
  a Tier A partner with no touch in 30 days or Tier B in 90 gets a "Re-engage" task (once; Tier C
  never does, and older open ones for Tier C are cleared); an agreement ending within 60 days gets
  a renewal task; a referred deal changing stage creates "Update the partner: deal moved to stage"

**Contacts**
- Every contact across all accounts in one table: name and title, account, **role**, call / email /
  LinkedIn buttons (LinkedIn searches by name and company when no profile is saved), stay-in-touch
  frequency, **last touch with that person** and next due
- Tabs: All, Decision makers, Champions, No role, Stay-in-touch due, Left / inactive. Search, type
  filter and sort (next due, name, account, last touch, role)
- **Saved contact views** sit in the same tab row, each with a count. "+ Save view" starts from the
  tab and type you're on
  - **Filter views** update themselves: account type, role, status, vendor, territory, PEO renewal
    within N days, no touch with that person in N days, title contains, primary contacts only, and
    text. "HR at Rippling accounts renewing within 90 days" is one view, with a live count while
    you build it
  - **Hand-picked views** hold the people you put in them ("Met at the mixer"): tick rows and use
    "Add to a view"; inside one, "Remove from this view" takes people out
  - The Book switch applies on top, so a view shows people at Active accounts unless you pick
    Reserve or All
- **Roles**: Decision maker, Champion, Finance, HR, Influencer, Gatekeeper, Operations, Executive.
  Change a role right in the row. Decision makers and champions with no touch in 30+ days on a live
  deal show red
- **Single-threaded deals**: open deals where you've reached one person or nobody, with touches per
  person ("Cesiah 4×, Dimitry 0×"). **No decision maker mapped**: open deals with nobody marked
  Decision maker (an owner, founder or CEO counts) and a one-tap "+ Add contact"
- The account page shows the **buying committee** (Decision maker, Champion, Finance, HR: ✓ or ○)
  and flags "No decision maker mapped" or "Single-threaded: only Dana reached". Each contact card has
  call / email / LinkedIn buttons and its own last touch
- **Statuses**: Active, Left company, Do not contact, Bounced (a bounced cadence email sets it).
  Anyone inactive leaves their cadences and stay-in-touch reminders
- **Left company → "Where did they go?"**: type the new company and title. The person is added there
  (a new prospect if it isn't in your CRM yet, tagged former-champion, lead source "Former
  contact", with a follow-up in 2 workdays), keeping their role, LinkedIn and notes. Their old card
  says "now at …"
- **Bulk actions** on ticked contacts: add to a cadence (spread over workdays), set role, set stay in
  touch, set status, tag their accounts, export (ZoomInfo / Apollo-ready columns)
- Desktop: sidebar item with a due count. iPhone: the Accounts | Contacts switch on the Accounts page

**Overview (dashboard)**
- Greeting, date and "+ Add account"
- Four tiles: total accounts, open pipeline (S1–S5), **everything due** (cadence steps,
  follow-ups, visits, key dates, stay-in-touch and tasks, with the overdue count and a breakdown)
  and stale accounts (open, no touch in 30+ days)
- **Priority tasks**: the top of the same work queue the planner uses, so the numbers always
  match. Each row has its type, account, why it's due and a one-click action. Three or more
  overdue steps of the same cadence fold into one row with "Work them"
- **Priority accounts**: open deals ranked by value and how long since the last touch, with stage,
  last touch and the next step (late follow-ups show in red)
- **Today**: real counts of calls, emails, LinkedIn touches and visits due (each opens that tab of
  the queue), progress toward your daily goal, Start call session and Open daily planner
- Stay in touch (only when someone is due) and recent activity

**Look and feel**
- Light, modern theme: a cool light-grey background, white cards with hairline borders and soft
  shadows, and an emerald accent. Dark mode uses neutral charcoal
- **Settings → Appearance**: Match device, Light or Dark (saved on each device). The choice applies
  before the page draws, so there's no flash, and the map tiles and browser bar follow it
- Each section has its own icon color (Overview indigo, Accounts blue, Contacts cyan, Partners
  violet, Planner amber, Map green, Cadences orange)
- Desktop: a light sidebar with page counts (accounts, cadence steps due), sync status and
  settings. iPhone: a bottom tab bar with the same colored icons
- Uses the device's built-in system font (San Francisco on iPhone/Mac, Segoe UI on Windows), so
  nothing is downloaded and text works offline

**Daily planner**
- Header: "N of 40 actions done · X overdue", ‹ › to move a day, Day | Work week, + Task
- Desktop: two columns. Left: the **work queue**. Right: top-3 priorities, the day's **schedule**
  (time grid), stale accounts and day notes. Work week uses the full width. Narrower screens stack
- **Work queue** (Salesloft/Outreach style): one list of everything due from cadence steps,
  follow-ups, revisits, route stops, key dates, stay-in-touch reminders and untimed tasks
  - Tabs: All · Calls · Emails · LinkedIn · Visits · To-do, each with a count; Start session at
    the top opens a call/email/LinkedIn session for the tab you're on
  - **Due · Future · Completed** above today's queue, each with a count. Future is everything that
    comes due in the next 30 days (cadence steps, follow-ups, revisits, key dates, stay-in-touch,
    tasks), grouped Tomorrow / Later this week / Next week / Later. Completed is the last 14 days of
    calls, emails, visits and other activity you logged plus tasks you finished, by day. The type
    tabs work in all three
  - On a phone the tab rows (here and on Accounts and Contacts) are one line you swipe sideways,
    and the tab you're on is scrolled into view
  - Grouped by age: overdue 7+ days, overdue, due today, and upcoming (next 2 days). Each overdue
    group has **Snooze all to tomorrow** and **Skip N cadence steps** (they advance, after a
    confirm); long groups show 10 and "Show N more"
  - Each row: a checkbox, type, title, account, why it's due and one action button. The checkbox
    does the right thing for its source: a cadence step opens the log form, a follow-up logs the
    activity and clears the date, a revisit records the visit and asks when to go back, a key date
    or task is marked done, a stay-in-touch reminder logs the touch
  - **Daily goal** (40 to start; click it to change): counts every activity logged that day
    (notes aside) plus tasks done
- **Stale accounts**: open accounts with no touch in 30+ days; never-touched first, then by value
- **Calendar** with **Day | Work week** (the choice is remembered on each device):
  - Day: the Schedule card is a time grid (7 AM–7 PM, widening for earlier or later items).
    Blocks are sized by duration, overlapping items sit side by side and a red line marks the time
    now. Untimed items are in the queue instead
  - Work week: Monday to Friday side by side, with each day's tasks, cadence steps and follow-ups
    summarized on top. Click a day to open its full plan; ‹ › move a week
  - Click any half-hour to add a task there (30 min by default); click a block to edit it; tick
    its box to mark it done
- **Categories** (synced, Outlook-style): Meeting, Calls & outreach, Visit, Partner, Admin and
  Personal to start. "Categories" lets you rename, recolor (12 colors), add and delete them; tap
  a category in the legend to hide or show it. Each task has a category, and tasks made by the
  partner rules start as Partner
- Tasks with time, duration, priority, linked account and notes
- Move unfinished tasks to the next day in one click
- **Extra activity** (collapsed under the queue; remembers open/closed): free rows for work that
  isn't in the CRM yet:
  - 25 calls / emails / LinkedIn touches (10 rows shown to start; "+ Add row" adds more)
  - 5 visits, 5 channel accounts (suggestions limited to partner accounts), 5 revisits

  Each row has an account, a type, a note, and a checkbox. Account names autocomplete from your
  accounts, and checking off a row for an existing account logs it to that account's history.
  Rows are linked to the account itself (by its ID), so renaming an account keeps the link, and
  two accounts with the same name stay separate: the suggestions add the city ("Acme Dental ·
  Fresno, CA"). A name typed that matches two accounts isn't linked until you pick one.
  Unchecking removes the entry; unfinished rows can be copied to the next day.

## Install on iPhone / iPad

Bbars OS is an installable web app (PWA). Once it's served from an HTTPS address (for example
GitHub Pages or Netlify):

1. Open the address in **Safari** on the iPhone.
2. Tap the **Share** button, then **Add to Home Screen**, then **Add**.
3. Launch it from the new home-screen icon. It opens full screen and works offline.

Installed apps keep their data separately from Safari, so open it from the icon each time.
The same steps work on Android in Chrome (menu, then **Install app**).

## Data

Every change is saved instantly on the device, in the browser's IndexedDB database. Each account,
task, list, cadence and planner day is its own row, so a save writes only what changed. The first
launch after upgrading from an older version copies the old `localStorage` data across and leaves
the original in place. In **Settings**, use **Export backup** to save a JSON copy and
**Import backup** to restore it. **Erase all data…** wipes everything; when sync is on, the erase
also clears the cloud copy and every synced device.

### Cloud sync (phone + computer)

Sync uses your own [Supabase](https://supabase.com) project (a hosted Postgres database):

1. Create a free project at supabase.com/dashboard.
2. Open the project's **SQL Editor**, paste in [`supabase-setup.sql`](supabase-setup.sql) and run it once.
3. In Bbars OS on each device, tap **☁ Set up sync** and enter the Project URL, the publishable
   (anon) key, and an email and password. Tick "create my account" the first time only.

The app syncs a few seconds after each change, when it's reopened, every minute while it's open,
and as soon as a lost connection comes back. Offline edits are kept and uploaded later.

- Each record is one database row. Only records you changed are uploaded.
- Edits from different devices merge **field by field** (the newest edit of each field wins), so
  changing the notes on your phone and the value on your computer keeps both.
- The database refuses a write made from an out-of-date copy; the app then downloads the newer
  row, merges, and uploads again.
- Row level security limits every signed-in user to their own rows. The publishable key alone
  cannot read anything.
- Earlier versions synced to a GitHub repository. That is gone: on first launch the saved GitHub
  token is removed from the device and a banner asks you to set up sync again. You can delete the
  token at github.com/settings/personal-access-tokens.

### Attachments

Each account has an **Attachments** section for proposals, census files, agreements and the like.
Files are stored in a private `attachments` bucket in your Supabase project (set up by
`supabase-setup.sql`), so attachments need cloud sync turned on.

- Up to 10 MB per file. Photos over 1.5 MB are shrunk to a 2000 px JPEG before upload.
- The account record keeps only each file's name, size and type, so editing an account never
  re-uploads files, and files are downloaded only when you open them.
- Files open through a private link that expires after 5 minutes.
- Deleting a file (or its account) removes the stored file once the change has synced.

On first launch, click **Load sample data** to explore with example accounts.

## Files

- `index.html`: page shell
- `styles.css`: styles (light/dark mode, responsive)
- `app.js`: all app logic
- `supabase-setup.sql`: one-time database setup for cloud sync
- `supabase-views.sql`: optional read-only views (`accounts`, `colleagues`, `watchlist_items`,
  `import_lists`, `list_items`) so
  the synced data can be browsed as tables in Supabase; the app doesn't need them. Safe to re-run
- `vendor/supabase`: Supabase client library (MIT license), bundled so nothing loads from a CDN
- `manifest.webmanifest`, `sw.js`, `icons/`: home-screen install and offline support
