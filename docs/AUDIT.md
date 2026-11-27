# Asset Tracker audit — 27 November 2026 (v0.3.0)

Full review of the app before handing it to customers: code, security, alerts and notifications,
user interface (Arabic and English, light and dark), and the desktop build.

## How it was checked

- Read every part of the app: price engine, alert engine, notifications, database layer (TypeScript
  and Rust), tray, widgets, capabilities, Content Security Policy, all pages and forms.
- Automated: `npm run typecheck`, `npm test` (146 tests), `npm run build`, `cargo clippy --all-targets`,
  `npm audit`.
- By hand in the app: every page in Arabic and English, dark and light, keyboard only, "hide numbers",
  each alert and budget flow, page reloads (data kept), and the desktop app's database upgrade on a copy
  of real data.

## Findings

| # | Severity | Area | Finding | Status |
|---|---|---|---|---|
| 1 | High (daily use) | Forms | While typing in any form (buy, sell, alert, income/expense), a price update re-rendered the page and moved the cursor back to the first field. | **Fixed** — the dialog's setup now runs only when it opens. |
| 2 | Medium | Alerts | An alert check asked for while another check was running was dropped, so a price crossing at that moment could be missed until the next update. | **Fixed** — checks run one at a time and a request during a run triggers one more run. |
| 3 | Medium | Notifications | A fired alert was only a 12-second toast; if you were away you never knew. | **Improved** — notification history, unread badge in the sidebar, kept after restart. |
| 4 | Low | Notifications | Saved notifications would stay in the language they were sent in. | **Fixed** — they are shown in the app's current language. |
| 5 | Low | Accessibility | Keyboard focus could leave an open dialog; focus was not returned afterwards; dialogs had no accessible name; toasts were not announced as alerts. | **Fixed** — focus trap, focus returned to the button that opened it, `aria-labelledby`, `role="status"`/`"alert"`. |
| 6 | Low | Accessibility | No support for the system "Reduce motion" setting. | **Fixed** — all animation is turned off when it is on. |
| 7 | Low | Display | Zero Syrian pounds showed as "SYP 0.00". | **Fixed** — "SYP 0". |
| 8 | Low | Release | `package-lock.json` still said 0.1.0. | **Fixed** in #4, with a test that fails if versions disagree. |
| 9 | Info | Rust | One clippy style warning. | **Fixed** — clippy is clean. |
| 10 | Hardening | Security | Widget windows are described as read-only but can call the database write commands (`db_execute`, `db_batch`). Exploiting it needs injected script first, which the CSP and the code prevent (see below). | **Open** — recommended: declare app commands in `build.rs` and allow only `db_select` for `widget-*` windows. Needs a test of every widget on the desktop. |
| 11 | Known limit | Browser demo | With two browser tabs open, the last tab to save wins. The desktop app is not affected. | **Open** (demo only). |
| 12 | Customers | Distribution | The macOS build is not signed with an Apple Developer ID or notarized, and the Windows build is not code-signed, so downloads show a security warning. | **Open** — needs an Apple Developer account and a Windows code-signing certificate. |
| 13 | Customers | Price data | Some sources are free public endpoints (Yahoo Finance, the sp-today page). They can change without notice. Backup sources and saved prices limit the impact; the app shows a disclaimer. | **Open** — watch for source changes. |

## Security review

- **Network**: the window cannot reach the internet directly (CSP `default-src 'self'`). All price
  requests go through Rust, limited to the 9 price hosts in `capabilities/default.json`.
- **Scripts**: CSP `script-src 'self'`; no `dangerouslySetInnerHTML`, `innerHTML`, `eval` or
  `new Function`; all text is rendered by React (escaped).
- **Files**: read/write only for files the user picks in a system dialog; backup file names are
  validated in Rust.
- **Database**: every query from the app uses `?` parameters; batches run in one transaction;
  constraints reject impossible rows.
- **Data**: stays in one local SQLite file plus 14 daily backups; nothing else is sent anywhere.
- **Dependencies**: `npm audit` reports 0 vulnerabilities. `cargo audit` was not run (not installed);
  recommended before each release.

## What was added in this round

- **Notification history** (schema v4): every price alert and budget warning is kept (newest 200),
  with an unread badge in the sidebar, "mark all as read" and "clear".
- **Monthly budget** for income & expenses: spending limit in USD or SYP, for all portfolios or one,
  progress bar, amount left, days left, and a warning at 80% and when you go over (each once a month).
- **Alert line as a percentage**: "3% above today's price" instead of typing an exact price.
- **Loading and motion**: app-shaped loading screen with a progress line, short page and dialog
  transitions, toasts that slide in, live prices that flash green/red when they change, placeholders
  while the first prices load, and a dark window background before the app loads.

## Tests

146 automated tests (80 at the start of the day), including: budget totals per portfolio and
currency, warnings once per month, alert lines from percentages, notification history limits and
upgrade from schema v3, text shown in the current language, one-at-a-time alert checks, settings
validation, Arabic/English message parity.
