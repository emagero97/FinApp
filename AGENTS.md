# AGENTS.md

## Layout

- `frontend-app/` — Angular 21 app (standalone components, SSR enabled via `@angular/ssr`).
- `backend/` — Flask API (SQLite via Flask-SQLAlchemy). Models: `Category`, `Transaction`. Routes: `/api/categories` (CRUD + search/sort/filter/stats), `/api/transactions` (CRUD + type/category/date filters), `/api/dashboard` (KPIs per week/month/year, category breakdown, category-vs-monthly-average, month-vs-previous-years, 12-month history), `/api/health`. Run/tests use the repo-root `venv/` (Python 3.13.3).
- `requirements.txt` (repo root) — backend deps (Flask, Flask-CORS, Flask-SQLAlchemy, pytest).
- `Task.md` — product spec (dashboard, data entry, CSV export, category management). Dashboard, data entry, and category management are done (`done? y`); export is unfinished. Treat it as the requirements source of truth, not a changelog.
- Root `package.json` is a stub (no scripts; its `npm test` always fails). Do not run npm from the repo root. UI is dark-themed with a collapsible left sidebar (icons-only when collapsed).
- Root `package.json` is a stub (no scripts; its `npm test` always fails). Do not run npm from the repo root.

## Commands

Frontend (run from `frontend-app/`):
- `npm start` — dev server at `http://localhost:4200/`, proxies `/api` → `http://localhost:5000` (`proxy.conf.json`), so the backend must be running.
- `npm test` — unit tests (Vitest via the `@angular/build:unit-test` builder).
- `npm run build` — production build (`outputMode: "server"`, SSR).

Backend (run from repo root):
- `venv\Scripts\python -m backend.app` — start Flask dev server on `:5000` (must be run as a module, not `python backend/app.py`, because `backend/app.py` uses relative imports).
- `venv\Scripts\flask --app backend.app run` — equivalent.
- `venv\Scripts\python -m pytest backend\tests` — backend tests (41 tests covering category, transaction, and dashboard aggregation rules).
- Reinstall/update deps after changing `requirements.txt`: `venv\Scripts\pip install -r requirements.txt`.

## Gotchas

- Tests use **Vitest**, not Karma/Jasmine. Write specs as `*.spec.ts`; global helpers (`describe/it/expect`) come from `vitest/globals` declared in `tsconfig.spec.json`. There is no `karma.conf.js`.
- There is **no lint setup** (no ESLint in devDependencies, no `lint` script). Don't run `ng lint` or `npm run lint`.
- Formatting: Prettier config is embedded in `frontend-app/package.json` — single quotes, `printWidth: 100`.
- Angular 21 uses `signal()` and standalone bootstrap (`bootstrapApplication` in `src/main.ts`); no NgModule wiring. Keep new components standalone. Routes live in `src/app/app.routes.ts`; `/dashboard`, `/categories`, and `/transactions` are `RenderMode.Client` in `app.routes.server.ts` (don't prerender pages that fetch from the API). Charts on the dashboard are hand-rolled SVG/CSS (no chart library).
- Backend DB file is `backend/finapp.db` (git-ignored). `backend/` models use a composite FK on `(category_id, type)` so a transaction's type must match its category's type at the DB level; category delete/type-change rules are enforced in `backend/api/categories.py`, transaction validation in `backend/api/transactions.py`. SQLite FK enforcement is enabled via a PRAGMA listener in `backend/extensions.py` (SQLite defaults to FKs off).
- `venv/` and `frontend-app/node_modules/` are git-ignored.
