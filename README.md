# FlowTrack

Personal income/expense tracker PWA. React + Vite frontend, Supabase for auth/data/RLS, deployed via Netlify.

## What's implemented

- Email/password auth via Supabase, with a `profiles` row + default categories auto-seeded on signup.
- Transactions: unsigned amount + inflow/outflow direction (sign is always derived, never stored), currency
  with EUR/USD/GBP/JPY built in and user-added currencies in master data, spot-rate-to-EUR capture for any
  non-EUR entry, type (Cash/Card/Wire/Other with free-text description), category with an
  Operational/Nonoperational classification that is **snapshotted per transaction** (changing a category's
  classification later does not rewrite historical entries), optional note, and a private/household visibility
  flag.
- Dashboard: date range pills (This month w/ prev-next nav, 3M/6M/12M, YTD, Year picker, All time, day-level
  custom range), income/expense/net summary, Operational vs Nonoperational totals with click-through drill-down,
  budget-vs-actual per category (budgets are effective-dated and resolved **per calendar month**, then summed
  across the selected range — a €200→€150 change next month doesn't retroactively change this month's number),
  variance coloring (green = favorable, red = unfavorable, direction-aware), and a bar chart (single month:
  actual vs budget per category) or line chart (multi-month: net over time).
- Master data: categories, budgets (with effective dates), currencies — all per-user, never directly shared.
- Household: create or join via invite code. Household dashboard view combines your entries with other
  members' `household`-flagged entries (RLS-enforced). Category/budget aggregation across members is done by
  case-insensitive, trimmed **name matching** — not shared rows — with a banner warning surfaced whenever the
  household view is active, since naming misalignment across members will show up as unmatched line items.
- CSV export of all your transactions.
- PWA manifest (installable), via `vite-plugin-pwa`.

## Known limitation

This is an **online-only** app: writes require a live connection to Supabase (no offline write queue).
If offline entry capture at the point of purchase becomes something you actually need, that requires adding an
IndexedDB write-queue with background sync, which is a separate, non-trivial piece of work not included here.

## Setup

1. **Create a Supabase project** at supabase.com.
2. In the SQL editor, run `supabase/schema.sql` in full. This creates all tables, RLS policies, the
   `join_household` RPC, and the trigger that seeds default categories for new signups.
3. Copy `.env.example` to `.env` and fill in your project's URL and anon key (Project Settings → API).
4. Install and run:
   ```bash
   npm install
   npm run dev
   ```
5. To deploy: push to a Git repo, connect it in Netlify, and set the same `VITE_SUPABASE_URL` /
   `VITE_SUPABASE_ANON_KEY` as environment variables in the Netlify site settings (Site configuration →
   Environment variables). `netlify.toml` is already configured for the build.

## Icons

`public/icon-192.png` and `public/icon-512.png` are placeholders — swap in real app icons before shipping
(any square PNG at those sizes works).
