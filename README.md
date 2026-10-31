# Mini CRM

A lightweight sales CRM for **partner** and **prospect** accounts, with a built-in **daily planner**.
No install, no build step: open `index.html` in a browser.

## Features

**Accounts**
- Partner vs. prospect accounts with their own stages
  - Prospect: New → Contacted → Qualified → Proposal → Negotiation → Won / Lost
  - Partner: Onboarding → Active → Strategic → At Risk → Inactive
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
- Search (including contacts and vendors), filter by type, stage or vendor, and sort by next
  follow-up, name, last update or value

**Cadences** (sequences)
- Multiple cadences, e.g. Insperity Renewal, ADP TotalSource Nurture, New Prospect Intro. Starter
  templates are included and every step is editable
- Steps have a day, type (Email, Call, LinkedIn, Visit, Text, Task), name, email subject and
  script, with merge fields: {{first_name}}, {{company}}, {{vendor}}, {{title}}, {{industry}},
  {{employees}}, {{renewal_date}}. Weekends can be skipped automatically
- Enroll contacts one by one (⇉ on a contact card) or in bulk from any saved list or vendor group
- Each cadence shows stats (active, due, overdue, paused, replied/meetings, success rate), a
  visual step track with how many people are at each step, a "Due now" queue, and everyone's
  progress bar, last touch, next touch and status
- Tap a person for their full start-to-finish timeline: completed steps with dates and outcomes,
  the current step, and planned dates for the rest. You can pause, resume, skip, finish or restart
- "Do it" opens the step with one-tap actions (Open in Mail with subject and body filled in, Call,
  Text, LinkedIn, Directions) and the merged script. Log the outcome and either continue (the
  next step is scheduled automatically) or finish as meeting booked, replied, not interested or
  bad data
- Completed steps are logged to the account history (with the contact) and counted in the daily
  activity plan. Due steps show on the Planner and Dashboard
- Contacts marked "Left company" or "Do not contact" can't be enrolled and are taken out of
  running cadences

**Web links, LinkedIn & ZoomInfo**
- Website and LinkedIn icons on accounts (record, table, cards, board) and contacts (cards,
  cadence people). A faded LinkedIn icon means no profile is saved yet. Tap it to search LinkedIn
- **Look up** menu on every account and contact: LinkedIn, Sales Navigator, ZoomInfo, the
  company's public ZoomInfo profile, and Google. The name is copied to the clipboard as well, so
  you can paste it if a site opens without the search filled in
- **Import CSV** (Accounts page or Settings): bring in accounts and contacts from a ZoomInfo
  export or any spreadsheet. Columns are recognized automatically (company, website, company
  LinkedIn, employees, industry, city/state, first/last name, title, email, direct and mobile
  phone, contact LinkedIn). A preview shows what will be added. Existing accounts are matched by
  name, only empty fields are filled, duplicate contacts are skipped, and new accounts are tagged
  so they're easy to list. CSV exports include website and LinkedIn columns and re-import cleanly

**Contact & account fields**
- Contacts: title, role in deal, email, direct phone, mobile, LinkedIn URL, preferred channel,
  time zone, status, primary flag, notes
- Accounts: industry, employees, value, website, city/state, lead source, current vendors,
  **vendor renewal date**, follow-up and revisit dates, tags, notes. Forms are grouped into
  compact sections, and secondary details fold away on the account page

**Lists**
- Saved lists that update automatically, built from account type, current vendors, tags, stages,
  text and "vendor renewal within N days", e.g. "Prospects on ADP TotalSource" or "#enterprise partners"
- Built-in "By current vendor" groups with counts
- Export any list to CSV

**Everywhere**
- Search accounts and contacts from any screen (🔍, or press `/` or Ctrl/⌘-K on a computer)
- Settings (sliders icon): cloud sync, export/import backup, load sample data, erase all data
- On phones, a bottom tab bar like a native app. Updates install themselves on the next launch
- A red banner appears if sync ever stops (for example an expired GitHub token), so you never
  unknowingly work unsynced
- Stage changes are logged to history whether they're made on the board, in Edit, or while
  logging an activity. You're warned before creating two accounts with the same name

**Dashboard**
- **Today**: activity-plan progress per section (calls/emails/LinkedIn, visits, channel, revisits),
  cadence steps due, follow-ups due, overdue
- **Book**: prospects, partners, open pipeline, people in cadences
- Needs attention (overdue and today), next 14 days, recent activity, and active accounts with
  no next step (no follow-up and nobody in a cadence)

**Daily planner**
- Hour-by-hour schedule (7 AM–7 PM); click an hour to add a task
- Tasks with time, duration, priority, linked account and notes, plus an "Anytime" list
- Pulls in account follow-ups and key dates due that day automatically (today's page also
  shows overdue items)
- Top-3 priorities, day notes and a progress bar
- Move unfinished tasks to the next day in one click
- **Daily activity plan** with target slots for each day:
  - 25 calls / emails / LinkedIn touches
  - 5 visits
  - 5 channel accounts (suggestions limited to partner accounts)
  - 5 revisits. Accounts whose revisit date is that day (or overdue, on today's page) fill in
    automatically. Checking one off logs the visit, clears the due date and asks when to go back
    (14 / 30 / 60 / 90 days or a date you pick)

  Each row has an account, a type, a note, and a checkbox. Account names autocomplete from your
  accounts, and checking off a row for an existing account logs it to that account's history.
  Unchecking removes the entry. Use "+ Add row" to go past a target, and copy unfinished rows to
  the next day in one click. The dashboard shows today's plan progress.

## Install on iPhone / iPad

Mini CRM is an installable web app (PWA). Once it's served from an HTTPS address (for example
GitHub Pages or Netlify):

1. Open the address in **Safari** on the iPhone.
2. Tap the **Share** button, then **Add to Home Screen**, then **Add**.
3. Launch it from the new home-screen icon. It opens full screen and works offline.

Installed apps keep their data separately from Safari, so open it from the icon each time.
The same steps work on Android in Chrome (menu, then **Install app**).

## Data

Every change is saved instantly on the device (`localStorage`). In **Settings**, use **Export backup**
to save a JSON copy and **Import backup** to restore it. **Erase all data…** wipes everything; when
sync is on, the erase also clears the cloud copy and every synced device.

### Cloud sync (phone + computer)

Tap **☁ Set up sync** to keep the same data on every device. Data is stored as
`minicrm-data.json` in a **private** GitHub repository that you own:

1. Create a private repository (e.g. `crm-data`) with a README.
2. Create a fine-grained token at github.com/settings/personal-access-tokens/new with
   access to only that repository and **Contents: Read and write**.
3. In Mini CRM on each device, tap **☁ Set up sync** and enter `owner/repo` and the token.

The app syncs a few seconds after each change, when it's reopened, every minute while it's open,
and as soon as a lost connection comes back. Offline edits are kept and uploaded later. Edits from
different devices merge record by record (newest edit wins, deletions carry over), and every sync is
a commit, so the repository history is also a full backup. Public repositories are refused.
On first launch, click **Load sample data** to explore with example accounts.

## Files

- `index.html`: page shell
- `styles.css`: styles (light/dark mode, responsive)
- `app.js`: all app logic
- `manifest.webmanifest`, `sw.js`, `icons/`: home-screen install and offline support
