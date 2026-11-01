# Cabinet Cutlist

Next.js + Tailwind + SQLite app built from the Claude Design handoff in `project/` (see below).

Requires **Node 22 or 24 LTS** (`.nvmrc` pins 22). Odd-numbered releases such as Node 23 aren't supported: the SQLite driver has no prebuilt binary for them and would need Xcode tools to compile.

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # engine tests (numbers checked against the 3DB15 sample packet)
npm run build && npm start
```

- **Accounts:** the first visit asks you to create an account, which becomes the shop **admin** and takes over any jobs already saved. Anyone can sign up afterwards; a user sees only their own jobs, an admin sees every job, the Admin page and its Users tab (roles, password resets, deletes). Passwords are hashed with scrypt; sessions are a 30-day httpOnly cookie. Sign out from the top bar.
- **Data:** jobs autosave to SQLite at `data/cutlist.db` (override with `CUTLIST_DB=/path/file.db`). A new database is seeded with the 3DB15 sample job.
- **Job setup page:** new jobs start here: job details, construction method and its rules, case, back, front and toe kick materials (from the Admin table, or Other… with its own thickness and sheet size; toe kick is what toe kick skins are cut from) (what toe kick skins are cut from), fronts (door front style, drawer front style with grain direction, drawer box type; only slab styles are cut and optimized, other styles are ordered and only listed on the door list) and hardware (dropdowns with Other…). **Continue to items** opens item entry; **Edit setup** on the job summary card returns to it.
- **Accessories:** the Accessory category holds cut panels rather than boxes: filler, end panel and toe kick skin out of the box, each a single panel of width x height in a chosen job material with its own grain and edge banding (no construction method, faces or hardware). Add more under Admin › Cabinet boxes with the Accessory category, or give any new category the \"one cut panel\" construction style.
- **Cabinet list:** one cabinet per row, with no quantity field; **Duplicate** adds a copy of a row (faces included) right below it.
- **Configure tab:** click a face in the drawing to edit it; **Save as box…** stores the cabinet's faces and size as a new box in the shop catalog (and can switch the cabinet onto it) so the configuration can be reused on later jobs.
- **Reports and printing:** the Cut list and Optimize tabs are visible to admins only; everyone sees Doors, Drawers, Assembly, Sheets and Hardware. The **Print** menu prints the report on screen, a checked set of reports, or the whole packet, one report per page.
- **Sheets tab:** full sheets of each material the job needs, totalled from the panel saw plans, with parts placed, yield and estimated lineal feet of edge banding (fronts all round; the exposed edge of ends, decks, tops, shelves, partitions and stretchers); parts too large for the sheet are called out.
- **Jobs** (the button next to the title) offers New job and Job history. The history at `/jobs` is a searchable list of your jobs with client, catalog, cabinet count and dates: open, delete, new, new from sample or import a `.cutlist.json` there. Admins see every job with a per-user filter. Fraction or decimal dimensions and Export are on the job setup page.
- **Admin page** (`/admin`, linked from the top bar): the materials table (name, thickness, sheet width and length), the door and drawer front styles (slab or ordered, grain for drawer fronts), the drawer box types and hardware dropdown choices, the panel saw settings (kerf, edge trim), the construction methods (rules only), and the cabinet boxes: categories (each with a case construction style: base, wall or tall) and the box types in them, with a code, default size, picker image and standard faces. Saved to the same database. A job copies its method rules, materials and hardware when it is set up; saw settings apply to every job live.
- **Code map:** `src/lib/engine.ts` construction rules, built-in cabinet catalog and report math · `src/lib/job.ts` job document + import validation · `src/lib/presets.ts` built-in method and hardware choices · `src/lib/shop.ts` shop settings document (materials, choices, saw, methods) · `src/lib/db.ts` SQLite (jobs, settings, users, sessions) · `src/lib/auth.ts` session cookie helpers · `src/lib/password.ts` hashing · `src/app/api/jobs`, `src/app/api/shop`, `src/app/api/auth`, `src/app/api/users` REST API · `src/components` UI, `src/components/admin` admin page.

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
