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

## Data

Data is saved in your browser's `localStorage` on this device only. Use **Export** to download a
JSON backup and **Import** to restore it or move it to another browser or computer.
On first launch, click **Load sample data** to explore with example accounts.

## Files

- `index.html`: page shell
- `styles.css`: styles (light/dark mode, responsive)
- `app.js`: all app logic
