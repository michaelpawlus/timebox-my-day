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

### Backlog

| Command | Purpose |
|---------|---------|
| `timebox backlog add --title "..." --duration N --priority hard\|soft\|none` | Add backlog item |
| `timebox backlog add ... [--deadline DATE] [--outdoor] [--daylight] [--weekend]` | Add with constraints |
| `timebox backlog list [--priority ...] [--status ...]` | List backlog items (excludes completed by default) |
| `timebox backlog update --id <id> [--title ...] [--duration N] [--priority ...]` | Update backlog item |
| `timebox backlog remove --id <id>` | Remove backlog item |
| `timebox backlog complete --id <id>` | Mark item completed |

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
| `timebox calendar import <file>` | Import ICS file as busy events |

## Weekly Planning Workflow

When the user asks you to plan their week, follow this workflow:

1. **Gather context**: Run `timebox context --week --date <monday> --json` to get 7-day weather, current schedule, and pending backlog
2. **Ask for tasks**: Ask the user what they need to accomplish this week — accept conversational input ("I need to mow the lawn, do a 5-mile run, install shelves, and write a blog post")
3. **Add to backlog**: Parse tasks and add them via `timebox backlog add` with appropriate priority, duration, and constraints
4. **Import calendar**: If the user provides an ICS file, add meetings via `timebox week add`
5. **Schedule fixed blocks first**: Meetings and immovable commitments
6. **Weather-aware outdoor tasks**: Check per-day outdoor scores — schedule outdoor tasks (running, lawn work, etc.) on the best weather days during the best outdoor windows
7. **Deep focus placement**: Schedule focus blocks >= 120 min, preferably mornings (09:00-12:00)
8. **Quick task bundles**: Group small tasks (< 30 min) into 30-60 min blocks in remaining gaps
9. **Weekend loading**: House projects and flexible tasks prefer weekends
10. **Priority ordering**: Hard deadlines first, then soft deadlines, then no-deadline items
11. **Verify**: Run `timebox week show --json` to confirm no conflicts and reasonable gaps
12. **Mark scheduled**: Run `timebox backlog update --id <id> --status scheduled` for items placed
13. **Export**: Run `timebox week export --format markdown` — user photographs output for Skylight

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
