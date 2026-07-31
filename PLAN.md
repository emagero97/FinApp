# Development Plan

Implement the features in `Task.md` (Dashboard, Data Entry, CSV Export, Category Management) with an Angular 21 frontend (`frontend-app/`) and a new Flask backend (`backend/`). Treat `Task.md` as the requirements source of truth; update each section's `(done? y/n)` when finished.

## Phase 0 — Backend foundation

- Create `backend/` Flask app (use repo-root `venv/`; currently only Flask is installed — add deps as needed and record them in a `requirements.txt`).
- SQLite database via Flask-SQLAlchemy (no external DB server needed).
- Define models with stable internal IDs (per Task.md): `Category` (name, type: income/expense, status: enabled/disabled, optional description/icon/color/display order, created/updated timestamps) and `Transaction` (type, category FK, date, amount, notes, created/updated timestamps).
- REST API skeleton: JSON endpoints under `/api/*`, DB initialized with sensible defaults (a few seed expense/income categories).

## Phase 1 — Category Management

Backend:
- CRUD for categories. Enforce: name required and non-blank; no duplicate name within same type; type immutable once the category has linked transactions; deletion blocked when linked transactions exist (backend-level check, not just UI); disable allowed anytime (keeps historical references).

Frontend:
- Category list page: name, type, status, linked-transaction count, total amount, last-transaction date, actions (edit / enable / disable / delete); search + sort + filter.
- Create/edit form (name, type, status, optional fields). Disabled categories visually labelled.
- Confirmation dialogs: before disabling (esp. when linked), before deleting; explain why deletion is blocked.

## Phase 2 — Data Entry

Backend:
- Transaction create/edit/delete endpoints. Validate transaction type matches the selected category's type (income category ⇄ income transaction).

Frontend:
- Entry form: transaction type (income/expense), category (filtered by type, enabled only), date (default today), notes, amount.
- Basic transaction list/history view (needed later by dashboard/export). Editing an old transaction keeps its category selectable even if disabled.

## Phase 3 — Dashboard

Backend:
- Aggregation endpoints (compute in SQL): income, expenses, current balance for week/month/year; per-category totals vs. historical monthly average; per-category share of expenses; current-month spend vs. same-month spending in previous years.

Frontend:
- KPI cards (income, expenses, balance) with week/month/year views.
- Pie chart: category contribution to total expenses.
- Bar/line charts: category spending vs. monthly average (over/under indicator), and current month vs. same month in previous years.
- Charts can use a lightweight library (e.g., Chart.js via `ng2-charts`) — or hand-rolled SVG if deps are to be avoided.

## Phase 4 — CSV Export

Backend:
- Export endpoint that filters by: date range (custom, specific month, multiple months, year, or all history — validate start ≤ end, inclusive), transaction type (income/expense/both, default both), and included/excluded categories (disabled categories remain exportable).
- Generate UTF-8 CSV: header row + columns ID, type, category name, date, amount, notes, created date, updated date; `YYYY-MM-DD` dates, `1234.56` amounts, proper escaping for commas/quotes/accented chars/newlines.
- Return row count; do not generate a file when no transactions match. Exports never modify data.

Frontend:
- Export UI: filter selection with a summary panel (period, types, included/excluded categories, total rows) before generating; download file named `transactions_<start>_<end>.csv`.
- Report "no matching transactions" instead of an empty export.

## Phase 5 — Hardening

- Frontend unit tests (Vitest, `npm test` from `frontend-app/`): forms, filters, API services, chart data mapping.
- Backend tests (use `venv\Scripts\python -m pytest` once pytest is installed): model constraints, category delete/disable rules, CSV escaping, date/type/category filters.
- Validate budget constraints (`npm run build`) and no lint step exists (skip).
- Update `Task.md` `(done? y/n)` markers.

## Notes / conventions

- Run frontend commands from `frontend-app/` only; never from the repo root.
- Backend runs from repo-root `venv\Scripts\flask` / `venv\Scripts\python`.
- New Angular components must stay standalone; no NgModule wiring.
