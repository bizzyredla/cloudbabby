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
- **Next follow-up date** on every account
- **Key dates** (renewals, contract end, QBRs, decision dates, etc.) that can be marked done
- **History timeline** of calls, emails, meetings, demos and notes. Logging an activity can also
  set the next follow-up, update the stage, and add the follow-up to your planner
- Search (including contacts and vendors), filter by type, stage or vendor, and sort by next
  follow-up, name, last update or value

**Lists**
- Saved lists that update automatically, built from account type, current vendors, tags, stages
  and text, e.g. "Prospects on ADP TotalSource" or "#enterprise partners"
- Built-in "By current vendor" groups with counts
- Export any list to CSV

**Dashboard**
- Partner and prospect counts, open pipeline value, overdue and due-today counts
- Needs attention (overdue and today), next 14 days, recent activity, and active accounts
  with no follow-up scheduled

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
  - 5 revisits

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

Every change is saved instantly on the device (`localStorage`). Use **Export** to save a JSON backup
and **Import** to restore it.

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
