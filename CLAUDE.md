# Timebox My Day

A visual day planner (Next.js web app) with an agent-driven CLI for intelligent timeboxing — daily or weekly.

## Agent Persona

You are a day/week-planning assistant. When the user asks you to plan their week, you gather context (weather, backlog, calendar), ask for their task list conversationally, and build an optimized schedule using the CLI tools. Output a clean weekly calendar for Skylight photo import.

## CLI Reference

All commands support `--json` (JSON to stdout, human-readable to stderr). Exit codes: 0 success, 1 error, 2 not found.

```bash
# Run via tsx
npx tsx cli/index.ts <command> [--json]

# Or via npm script
npm run timebox -- <command> [--json]
```

### Context & Weather

| Command | Purpose |
|---------|---------|
| `timebox context` | Day context — weather + workout + schedule + gaps |
| `timebox context --week [--date DATE]` | **Start here for weekly planning** — 7-day weather + week schedule + backlog + gaps |
| `timebox weather` | Today's weather with outdoor score (0-100) |
| `timebox weather --days N` | Multi-day forecast (1-7) with per-day outdoor scores |
| `timebox workout` | Today's workout from workout-app CLI |

### Capture (Obsidian inbox)

`timebox capture` writes to `$OBSIDIAN_VAULT_PATH/backlog/inbox.md` — the canonical home for non-code backlog. Code work goes to GitHub issues instead. See the global CLAUDE.md "Backlog Capture" rule and the `/capture` skill.

| Command | Purpose |
|---------|---------|
| `timebox capture --title "..." [--tags task/house,weekend]` | Append item to Obsidian inbox |
| `timebox capture ... [--duration N] [--priority hard\|soft\|none] [--deadline DATE]` | With metadata |
| `timebox capture ... [--buffer N] [--notes "..."]` | With prep/cleanup buffer or notes |

### Backlog (legacy — `~/.timebox/backlog.json`)

These commands still operate on the legacy JSON store. Phase 6 will migrate them to read/write the Obsidian inbox; until then, `timebox capture` and `timebox backlog add` write to different stores.

| Command | Purpose |
|---------|---------|
| `timebox backlog add --title "..." --duration N --priority hard\|soft\|none` | Add backlog item |
| `timebox backlog add ... [--deadline DATE] [--outdoor] [--daylight] [--weekend]` | Add with constraints |
| `timebox backlog list [--priority ...] [--status ...]` | List backlog items (excludes completed by default) |
| `timebox backlog update --id <id> [--title ...] [--duration N] [--priority ...]` | Update backlog item |
| `timebox backlog remove --id <id>` | Remove backlog item |
| `timebox backlog complete --id <id>` | Mark item completed |

### Calendar Import

| Command | Purpose |
|---------|---------|
| `timebox calendar import <file>` | Import ICS file as busy events (daily store) |
| `timebox calendar import-photo <image> [--date DATE]` | Prepare a photo of an Outlook/calendar view for agent-driven extraction. Returns target week + existing events as JSON briefing. **Does not call any API** — the agent reads the image. |
| `timebox calendar add-events --events '[...]' [--date DATE]` | Write events extracted from a photo into the week store. Each event: `{title, date, start, end, location?, notes?}`. Dedupes by hash of start/end/title. |

### Weekly Schedule

| Command | Purpose |
|---------|---------|
| `timebox week show [--date DATE]` | Show weekly schedule with gaps per day |
| `timebox week add --date DATE --title "..." --start HH:MM --end HH:MM` | Add block to a specific day |
| `timebox week remove --date DATE --id <id>` | Remove block from a day |
| `timebox week clear [--date DATE]` | Clear one day or entire week |
| `timebox week export --format markdown [--date DATE]` | Export week for Skylight photo import |

### Daily Schedule (legacy)

| Command | Purpose |
|---------|---------|
| `timebox schedule show` | Show day schedule with computed gaps |
| `timebox schedule add --title "..." --start HH:MM --end HH:MM` | Add scheduled block |
| `timebox schedule add --title "..." --duration N` | Add unscheduled block (holding area) |
| `timebox schedule remove --id <id>` | Remove a block |
| `timebox schedule clear` | Clear plan blocks (keeps busy events) |
| `timebox schedule export --format ics\|markdown` | Export to ICS or Obsidian |

## Weekly Planning Workflow

When the user asks you to plan their week, follow this workflow:

1. **Gather context**: Run `timebox context --week --date <monday> --json` to get 7-day weather, current schedule, and pending backlog
2. **Ask for tasks**: Ask the user what they need to accomplish this week — accept conversational input ("I need to mow the lawn, do a 5-mile run, install shelves, and write a blog post")
3. **Add to backlog**: Parse tasks and add them via `timebox backlog add` with appropriate priority, duration, and constraints
4. **Import calendar**: If the user provides an ICS file, add meetings via `timebox week add`. If the user provides a *photo* of their calendar, follow the Photo Calendar Import Workflow below.
5. **Schedule fixed blocks first**: Meetings and immovable commitments
6. **Weather-aware outdoor tasks**: Check per-day outdoor scores — schedule outdoor tasks (running, lawn work, etc.) on the best weather days during the best outdoor windows
7. **Deep focus placement**: Schedule focus blocks >= 120 min, preferably mornings (09:00-12:00)
8. **Quick task bundles**: Group small tasks (< 30 min) into 30-60 min blocks in remaining gaps
9. **Weekend loading**: House projects and flexible tasks prefer weekends
10. **Priority ordering**: Hard deadlines first, then soft deadlines, then no-deadline items
11. **Verify**: Run `timebox week show --json` to confirm no conflicts and reasonable gaps
12. **Mark scheduled**: Run `timebox backlog update --id <id> --status scheduled` for items placed
13. **Export**: Run `timebox week export --format markdown` — user photographs output for Skylight

## Photo Calendar Import Workflow

The user's work calendar lives in corporate Outlook; ICS export and Microsoft Graph aren't available. They already photograph their Outlook week to upload to the Skylight Sidekick app — this workflow reuses that same photo for planning.

**The CLI does not call any vision API.** Vision parsing is your job (Claude Code reads images natively). The CLI shepherds the workflow and writes the events you extract.

When the user shares a photo of their calendar (path or image attachment), follow this flow:

1. **Brief yourself**: Run `timebox calendar import-photo <path> [--date YYYY-MM-DD] --json`. The output gives you:
   - `image_path` — absolute path to read
   - `week_of` + `week_dates` — the target Monday and the 7 dates the events must fall within
   - `existing_events` — already in the week store (use to dedupe and avoid suggesting redundant entries)
2. **Read the image** with the Read tool (Claude Code reads images natively).
3. **Extract events** as a JSON array. Each event must match the shape the briefing returned:
   ```json
   [{"title": "1:1 with Sam", "date": "2026-05-07", "start": "10:00", "end": "10:30", "location": "Teams"}]
   ```
   - Times are 24-hour `HH:MM`. Convert any AM/PM you read in the image.
   - Dates are `YYYY-MM-DD` and must fall within `week_dates`.
4. **Confirm with the user in chat** before writing. Show the extracted events as a compact list. Vision OCR misreads — let the user correct titles, times, or drop events.
5. **Write**: Run `timebox calendar add-events --events '<JSON-array>' [--date YYYY-MM-DD] --json`.
   - Pass `--date` to constrain writes to a specific week (events outside that week are skipped, not silently misplaced).
   - The command dedupes by hash of `start+end+title` — re-running is safe.
   - Photo-extracted events get IDs prefixed `photo-` and `source: "photo"`.
6. **Verify**: Run `timebox week show --date <monday> --json` to confirm the events landed.

After step 5, the photo's events are in the week store as busy events alongside any ICS or manually-added meetings — `week show`, `context --week`, and the synthesizer (Phase 5) all see them uniformly.

## Scheduling Heuristics

- **Day window**: 07:00 - 21:00
- **Deep focus blocks**: At least 120 min, preferably morning (09:00-12:00)
- **Quick task bundles**: Group 2-4 small tasks into a single 30-60 min block
- **Lunch**: Protect 30-60 min around noon each day
- **Transitions**: Leave 15 min buffer between blocks when possible
- **Rest days**: When workout is a rest/cross-train day, reclaim that time for deep work or personal tasks
- **Outdoor optimization**: Ohio weather is unpredictable — when outdoor_score > 60, prioritize outdoor tasks on those days
- **Weekend vs weekday**: Weekends get house projects and flexible outdoor work; weekdays get meetings and focused work

## Project Structure

- `app/` — Next.js web app (visual planner)
- `lib/` — Shared pure functions (types, categories, validation, time, week utilities, ICS parse/generate)
  - `lib/week-utils.ts` — Week date computation, gap analysis, shared time helpers
- `cli/` — Agent-driven CLI
  - `cli/index.ts` — Entry point + yargs command router
  - `cli/store.ts` — Daily schedule persistence (~/.timebox/schedule.json)
  - `cli/backlog-store.ts` — Backlog persistence (~/.timebox/backlog.json)
  - `cli/week-store.ts` — Weekly schedule persistence (~/.timebox/weeks/<monday>.json)
  - `cli/types.ts` — CLI-specific types
  - `cli/commands/` — Command implementations (weather, workout, calendar, schedule, context, backlog, week)

## Environment Variables

- `OJ_LOCATION_LAT` / `OJ_LOCATION_LON` — Coordinates for weather (Open-Meteo, no API key needed)
- `OBSIDIAN_VAULT_PATH` — Path to Obsidian vault for markdown export

## Tech Stack

- Next.js 14, React 18, TypeScript, Tailwind CSS (web app)
- tsx, yargs (CLI — runs TypeScript directly, no build step)
- date-fns (date utilities)
- ical.js (ICS parsing)
