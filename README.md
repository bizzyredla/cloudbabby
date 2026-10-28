# Mini CRM

A lightweight sales CRM for **partner** and **prospect** accounts, with a built-in **daily planner**.
No install, no build step: open `index.html` in a browser.

## Features

**Accounts**
- Partner vs. prospect accounts with their own stages
  - Prospect: New → Contacted → Qualified → Proposal → Negotiation → Won / Lost
  - Partner: Onboarding → Active → Strategic → At Risk → Inactive
- Contact, title, email, phone, website, industry, deal/annual value, tags, free-form notes
- **Next follow-up date** on every account
- **Key dates** (renewals, contract end, QBRs, decision dates, etc.) that can be marked done
- **History timeline** of calls, emails, meetings, demos and notes. Logging an activity can also
  set the next follow-up, update the stage, and add the follow-up to your planner
- Search, filter by type or stage, and sort by next follow-up, name, last update or value

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

Data is saved in your browser's `localStorage` on this device only. Use **Export** to download a
JSON backup and **Import** to restore it or move it to another browser or computer.
On first launch, click **Load sample data** to explore with example accounts.

## Files

- `index.html`: page shell
- `styles.css`: styles (light/dark mode, responsive)
- `app.js`: all app logic
- `manifest.webmanifest`, `sw.js`, `icons/`: home-screen install and offline support
