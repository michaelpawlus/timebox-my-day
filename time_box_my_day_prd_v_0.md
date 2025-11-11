# Time-Box My Day — Product Requirements Document (PRD)

_Last updated: 2025‑11‑11_

## 0) One‑liner
A tiny, client‑side web app that imports your calendar for **today** from an **.ics** file, lets you **drag & drop** focused work blocks into the gaps, and exports the plan back to **.ics**—with a built‑in **CSV→ICS** utility.

---

## 1) Goals & Non‑Goals
**Goals (v0):**
- Parse uploaded `.ics` events for “today,” render them as **busy** blocks (read‑only).
- Let the user add/edit/delete **plan blocks** (title, start, duration, optional location/notes) via simple UI.
- **Export** plan blocks as a downloadable `.ics` file (separate calendar), without modifying the source file.
- Provide a **CSV→ICS** utility inside the app: upload CSV → preview → download `.ics` → (optionally) parse it back into the planner.
- All of the above works **fully client‑side** (no auth, no server DB).

**Non‑Goals (v0):**
- Calendar OAuth or write‑back to Google/Microsoft.
- Recurring events (RRULE) expansion; we’ll ignore/label them as unsupported for v0.
- Multi‑day planning and cross‑day drag; v0 is “today only” with a manual date picker limited to ±3 days.
- Notifications, reminders, or PWA offline mode (moved to backlog).

---

## 2) Personas & Primary Use Cases
- **Maker/Analyst**: Has meetings but wants to protect focused work time.
  - _US1_: Import today’s meetings; drop two 90‑minute focus blocks; export to share with self/manager.
- **Ops/Coordinator**: Needs to bulk create holds for a team schedule.
  - _US2_: Upload CSV of agenda items; convert to `.ics`; import into the planner to visualize gaps.

---

## 3) User Stories (MVP)
1. **Upload calendar (.ics)** and see a vertical timeline (default 08:00–18:00) with **busy** segments.
2. **Create plan block** by dragging on empty space or using a “+ New block” button; edit title/duration.
3. **Conflict signal** if a plan block overlaps a busy block or another plan block (non‑blocking warning).
4. **Change date** via a date picker (defaults to today, app uses local timezone for display).
5. **Export plan** as `timebox-plan-YYYY-MM-DD.ics` containing only the plan blocks.
6. **CSV→ICS utility**: Upload CSV → preview table with validation → export `.ics` and (optionally) load those items into the planner as plan blocks.

---

## 4) UX Flow (MVP)
- **Header**: Date picker • Import (.ics / .csv) • Export Plan (.ics) • Help (modal)
- **Timeline** (single column):
  - Hour ticks; meeting **busy** blocks in a muted color; plan blocks in a bold color.
  - Drag to create; resize ends to change duration; click to edit (title, start, duration, location, notes).
- **Import Modal**:
  - Tabs: _ICS_ | _CSV→ICS_.
  - ICS tab: Dropzone → parse preview: count of events for selected date and ignored items (e.g., recurring, all‑day outside window).
  - CSV tab: Dropzone → schema preview and validation errors → button **Download .ics** and **Load into Planner** (checkbox).
- **Toasts** for success/errors; inline error panel for validation.

---

## 5) Data Model (in memory)
```ts
// Calendar events parsed from ICS (read‑only)
interface BusyEvent {
  id: string;            // derived hash of DTSTART+DTEND+SUMMARY
  title: string;         // SUMMARY
  start: string;         // ISO 8601 in local time
  end: string;           // ISO 8601 in local time
  location?: string;
  source: 'ics' | 'csv-ics';
  allDay?: boolean;
}

// User-created plan blocks (editable)
interface PlanBlock {
  id: string;            // uuid
  title: string;         // default "Focus Block"
  start: string;         // ISO 8601 in local time
  end: string;           // ISO 8601 in local time
  location?: string;
  notes?: string;
}
```

- **Time window**: default 08:00–18:00; adjustable via UI dropdowns in 30‑min increments.
- **Timezone**: Display in the browser’s timezone; store as ISO strings (local). For export, write `TZID` or UTC with `Z` per chosen option.

---

## 6) File Formats
### 6.1 CSV schema (v0)
Required columns (case‑insensitive):
- `title` (string)
- `start` (ISO 8601, e.g., `2025-11-12T13:00` or `2025-11-12 13:00`)
- `end` (ISO 8601)
Optional:
- `location` (string)
- `description` (string)
- `timezone` (IANA, e.g., `America/New_York`) — if present, interpret start/end in that zone; otherwise treat as local zone.

**Sample CSV**
```
title,start,end,location,description,timezone
Deep Work Block,2025-11-12T09:00,2025-11-12T10:30,Home Office,Quarterly deck,America/New_York
Run Outside,2025-11-12T12:15,2025-11-12T13:00,Neighborhood,Easy 45min,
```

### 6.2 Exported ICS fields
- `BEGIN:VCALENDAR` … `PRODID:timeboxer` … `VERSION:2.0`
- For each **PlanBlock** → `VEVENT` with `UID`, `DTSTAMP`, `SUMMARY`, `DTSTART`, `DTEND`, `DESCRIPTION`, optional `LOCATION`.
- **Timezone handling** (v0): export in **UTC** with `Z` to keep simple. (Add TZID/VTimeZone in backlog.)

---

## 7) Tech Choices
- **Framework**: Next.js (App Router) + TypeScript + Tailwind.
- **State**: Zustand (lightweight) or React state for MVP.
- **Parsing**: `ical.js` (ICS), `papaparse` (CSV), `zod` (validation), `date-fns`.
- **ICS generation**: small util that writes VCALENDAR/VEVENT strings (no heavy dependency) for v0.
- **Charts/None**: No charts in MVP.
- **Build/Deploy**: Vercel (Hobby) with GitHub integration.

Rationale: fully client‑side for uploads keeps us simple and avoids serverless payload limits. No persistence in v0.

---

## 8) Validation & Errors (MVP)
- CSV: missing required columns → block export; per‑row inline errors (line number, message).
- ICS: if file has no events on the selected date → show empty state with guidance.
- Time overlaps: soft warnings when plan overlaps busy or another plan block.
- Malformed dates: highlight fields, do not crash; provide copyable error log.

---

## 9) Accessibility
- Keyboard: block creation via button (not only drag), arrow‑key resize by 15‑minute steps.
- ARIA roles/labels for timeline; visible focus rings; sufficient contrast.

---

## 10) Security & Privacy
- Files processed **entirely in browser**; no network calls on import/export in MVP.
- Add a privacy note in Help modal (what the app does/doesn’t send).

---

## 11) Performance Constraints
- Target first load < 150KB JS (gzipped) for MVP; avoid large deps.
- Keep parsing on a Web Worker if files > ~2MB (backlog); MVP can run on main thread.

---

## 12) Definition of Done (MVP)
- Can import an `.ics` with at least 3 events; shows busy blocks in the correct local times for the selected date.
- Can create/edit/delete plan blocks; conflict warnings appear.
- Can export an `.ics` containing only plan blocks; file imports cleanly into Apple/Google/Outlook.
- CSV→ICS tab can validate and export a valid `.ics`; optional “Load into Planner” inserts those items as plan blocks.
- Basic a11y pass (keyboard + labels) and mobile‑friendly layout.

---

## 13) Milestones
**M0 — Scaffold (0.5d)**
- Next.js app, Tailwind, basic timeline UI with hour ticks.

**M1 — ICS Import (1d)**
- Parse `.ics`, map to BusyEvent[], render as read‑only.

**M2 — Planner (1d)**
- Create/edit/resize plan blocks; conflict warnings; local storage autosave.

**M3 — Export (0.5d)**
- Generate `.ics` for plan blocks (UTC), download.

**M4 — CSV→ICS Utility (0.5–1d)**
- CSV parse/validate; export `.ics`; optional load‑into‑planner.

---

## 14) Agent‑Ready Backlog (post‑MVP issues)
1. **Timezone‑aware export**: Add `VTIMEZONE` & `TZID` support; respect per‑event timezones.
2. **Date window**: Multi‑day and week view; adjustable working hours presets.
3. **Rules engine (JSON)**: e.g., `if(weather=="Clear" && free>=45m) => insert "Outdoor Block"`.
4. **Weather adapter**: Open‑Meteo client (no API key) + simple iconography.
5. **PWA**: Installable, offline cache, local notifications (if permitted).
6. **iCal RRULE**: Expand recurring events for selected date.
7. **Import dedupe**: Hash events across multiple uploads; show “already loaded” counter.
8. **CSV natural language times**: “Fri 3pm for 45m” → parse with chrono.
9. **Theming & presets**: Color schemes, default block templates.
10. **Unit & E2E tests**: Vitest + Playwright; CI via GitHub Actions.

---

## 15) Repo Structure (proposed)
```
/ (root)
  README.md
  LICENSE
  /app
    /timebox (timeline UI, editor)
    /import (modal components)
    layout.tsx
    page.tsx
  /components (Button, Modal, Timeline, BlockCard, Dropzone)
  /lib (ics-parse.ts, ics-generate.ts, csv-parse.ts, time.ts, validation.ts)
  /styles (globals.css)
```

---

## 16) Developer Commands
- `pnpm dev` — run locally
- `pnpm build && pnpm start` — production preview
- `pnpm lint` — lint
- `pnpm test` — tests (post‑MVP)

---

## 17) In‑App Help (copy, MVP)
- _“Your calendar never leaves your browser. Upload an .ics file to visualize today’s meetings as busy blocks. Drag to create plan blocks, then export a separate .ics you can add to your calendar.”_

---

## 18) Deployment Guide (Vercel + GitHub)
1. **Create repo** (GitHub): `timebox-my-day` → add README and license.
2. **Scaffold** locally: `npx create-next-app@latest` (TS + Tailwind). Commit/push to `main`.
3. **Create Vercel account** (GitHub login) → **Import Project** → select the repo.
4. Accept auto‑detected settings (Framework: Next.js; Build: `next build`; Output: default).
5. Click **Deploy** → wait for the first build → copy the live URL.
6. Subsequent pushes to `main` auto‑deploy to Production; pull requests get **Preview** URLs.
7. (Optional) Add a custom domain in Vercel → **Domains** → assign to Production.

_Tip: Because we parse `.ics`/`.csv` entirely on the client, there are no serverless size limits to worry about for uploads in v0. If you later add server uploads, consider direct‑to‑blob uploads._

---

## 19) Risks & Mitigations
- **ICS variance** (different calendar vendors): keep parser strict but surface ignored fields; maintain a sample set for regressions.
- **Timezone confusion**: v0 exports UTC; show a clear banner: “Exports are UTC (calendar will convert to local on import).”
- **Large files**: very big `.ics` might feel slow; add file size soft cap (e.g., 5MB) and suggest splitting.

---

## 20) Acceptance Checklist (for hand‑off)
- [ ] Import sample `.ics` (3+ meetings) → busy blocks appear correctly for a chosen date.
- [ ] Create 2 plan blocks; drag/resize; warnings on overlap.
- [ ] Export plan `.ics`; re‑import into Google/Outlook without errors.
- [ ] CSV→ICS: invalid rows are flagged; valid export works; optional load‑into‑planner works.
- [ ] Lighthouse ≥ 90 for Performance & Accessibility on desktop.

---

## 21) License & Attribution
- MIT License. Include third‑party library licenses in `NOTICE` if required.

