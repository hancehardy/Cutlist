# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Requires Node 22 or 24 LTS (`.nvmrc` pins 22; `engine-strict` is on). Odd Node releases fail because `better-sqlite3` has no prebuilt binary for them.

```bash
npm install
npm run dev          # Next dev server on http://localhost:3000
npm run lint         # tsc --noEmit (there is no ESLint; this is the only lint step)
npm test             # vitest run — all engine tests
npx vitest run src/lib/engine.test.ts -t "3DB15"   # one test file / one describe block
npx vitest           # watch mode
npm run build && npm start
```

Tests live only in `src/lib/*.test.ts` (vitest `include` pattern). The engine tests assert exact numbers against the shop's 3DB15 sample packet PDF (`project/uploads/`), so a change in construction math that breaks a test is usually a real rule change that needs to be reconciled with the packet, not a test to be updated casually.

## Architecture

Single-page Next.js 16 app (App Router, React 19, Tailwind 4, SQLite via `better-sqlite3`). The whole UI is one route, `src/app/page.tsx`, which is a server component that loads a job from SQLite and renders the client component `CutlistApp`.

**Data flow.** A job is a `JobDoc` (`src/lib/job.ts`): job info, raw construction defaults, a list of `CabInput`s, dimension format, preset key, and a `setupDone` flag. The UI holds the `JobDoc` in React state and derives everything else by calling `buildJob()` from `src/lib/engine.ts` inside a `useMemo`. Reports, the configurator drawing, and the summary counts are all pure projections of `buildJob`'s `JobResult`; nothing is stored except the `JobDoc`.

**Persistence.** `src/lib/db.ts` (marked `server-only`) stores each `JobDoc` as a JSON blob in a `jobs` table at `data/cutlist.db` (override with `CUTLIST_DB`). An empty database is seeded with the 3DB15 sample job. The REST API under `src/app/api/jobs` is the only path from the browser to the database; `CutlistApp`'s `useAutosave` hook debounces PUTs 600 ms and chains them so they land in order, plus a `keepalive` PUT on `pagehide`. `.cutlist.json` import/export (in `JobsMenu`) is the same `JobDoc` shape.

**Validation boundary.** Every untrusted `JobDoc` (request body, imported file, and even rows read back from SQLite) passes through `normalizeJobDoc()` in `src/lib/job.ts`. It coerces types, drops default keys the engine no longer has, falls back unknown cabinet types to `'B'`, de-duplicates cabinet ids, and treats missing `setupDone` as true for legacy jobs. Add new `JobDoc` fields there, not just to the interface.

**Engine (`src/lib/engine.ts`).** Pure functions, safe on client and server. Key pieces:
- `parseDim` / `fmt`: dimensions are stored as strings in `CabInput` so the user can type `14 7/8`, `14-7/8`, or `14.875`. Parse at the point of use; format to sixteenths (or decimals when `dimFormat === 'decimal'`).
- `DEFAULTS` is the single source of construction rules. `DEFAULT_FIELDS` (numeric) and `DEFAULT_TEXT` (string) drive the setup form; `resolveDefaults()` layers a job's raw string overrides onto `DEFAULTS`. Adding a rule means adding it to `DEFAULTS` and to one of those two lists.
- `TYPES` defines the cabinet catalog (code, category, SKU image under `public/assets/sku/`, default H/D/toe). `defaultLayout()` gives each type its face sections; a cabinet with `layout: null` uses it, and the Configurator writes an explicit `layout` when the user edits faces.
- `buildCabinet()` turns one `CabInput` into case parts, fronts, drawer boxes, hardware, and `Section`s (face geometry used by elevations). Section heights of `''` are "auto" and share the remaining opening height.
- `buildJob()` aggregates across cabinets by material, then runs `sawPlan()`, a two-stage guillotine panel-saw optimizer (trim, rip full-length strips along grain, crosscut; parts never rotate). This replaced CNC-style nesting on purpose.

**Presets (`src/lib/presets.ts`).** A construction method is a named set of `RawDefaults` overrides. Choosing a preset replaces the job's `defaults` wholesale; `isCustomized()` reports whether the job has drifted from its preset (comparing numeric rules by parsed value). `OPTIONS` lists the dropdown choices for material and hardware fields; anything else goes through the "Other…" entry.

**UI (`src/components`).** `CutlistApp` owns all state and switches between the setup view (`JobSetup`) and the items view (`CabinetList` + `Configurator` + report tabs from `Reports.tsx`). Printing sets a `printing` flag that renders every report at once; `globals.css` print rules hide `[data-print-hide]` and page-break after each `[data-report]`. Tailwind theme colors (`ink`, `muted`, `accent`, `line`, etc.) and the shared `.field`, `.card`, `.th`/`.td` classes are defined in `src/app/globals.css`.

## Design handoff bundle

`project/` and `chats/` are the original Claude Design handoff (HTML prototype, `cutlist-engine.js`, `support.js`, chat transcript, sample packet PDFs). They are reference material only: `project` is excluded from `tsconfig.json`, nothing imports from it, and the TypeScript engine has since diverged from the prototype's JS (rule changes are recorded in git history). Consult the sample packet PDF when a construction rule is in question; don't edit the prototype.
