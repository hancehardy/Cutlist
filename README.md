# Cabinet Cutlist

Next.js + Tailwind + SQLite app built from the Claude Design handoff in `project/` (see below).

Requires **Node 22 or 24 LTS** (`.nvmrc` pins 22). Odd-numbered releases such as Node 23 aren't supported: the SQLite driver has no prebuilt binary for them and would need Xcode tools to compile.

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # engine tests (numbers checked against the 3DB15 sample packet)
npm run build && npm start
```

- **Data:** jobs autosave to SQLite at `data/cutlist.db` (override with `CUTLIST_DB=/path/file.db`). A new database is seeded with the 3DB15 sample job.
- **Job setup page:** new jobs start here: job details, construction method (frameless presets in `src/lib/presets.ts`), materials and hardware (dropdowns with Other…) and construction rules. **Continue to items** opens item entry; **Edit setup** on the job summary card returns to it.
- **Jobs menu** (next to the title): switch jobs, new / new from sample, import and export `.cutlist.json`, fraction or decimal dimensions, delete.
- **Code map:** `src/lib/engine.ts` construction rules and report math · `src/lib/job.ts` job document + import validation · `src/lib/presets.ts` construction presets and dropdown choices · `src/lib/db.ts` SQLite · `src/app/api/jobs` REST API · `src/components` UI.

---

# CODING AGENTS: READ THIS FIRST

This is a **handoff bundle** from Claude Design (claude.ai/design).

A user mocked up designs in HTML/CSS/JS using an AI design tool, then exported this bundle so a coding agent can implement the designs for real.

## What you should do — IMPORTANT

**Read the chat transcripts first.** There are 1 chat transcript(s) in `chats/`. The transcripts show the full back-and-forth between the user and the design assistant — they tell you **what the user actually wants** and **where they landed** after iterating. Don't skip them. The final HTML files are the output, but the chat is where the intent lives.

**Read `project/Cabinet Cutlist.dc.html` in full.** The user had this file open when they triggered the handoff, so it's almost certainly the primary design they want built. Read it top to bottom — don't skim. Then **follow its imports**: open every file it pulls in (shared components, CSS, scripts) so you understand how the pieces fit together before you start implementing.

**If anything is ambiguous, ask the user to confirm before you start implementing.** It's much cheaper to clarify scope up front than to build the wrong thing.

## About the design files

The design medium is **HTML/CSS/JS** — these are prototypes, not production code. Your job is to **recreate them pixel-perfectly** in whatever technology makes sense for the target codebase (React, Vue, native, whatever fits). Match the visual output; don't copy the prototype's internal structure unless it happens to fit.

**Don't render these files in a browser or take screenshots unless the user asks you to.** Everything you need — dimensions, colors, layout rules — is spelled out in the source. Read the HTML and CSS directly; a screenshot won't tell you anything they don't.

## Bundle contents

- `README.md` — this file
- `chats/` — conversation transcripts (read these!)
- `project/` — the `Copy of Cabinet cutlist app design` project files (HTML prototypes, assets, components)
