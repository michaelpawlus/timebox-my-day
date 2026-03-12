# Timebox My Day

A visual day planner (Next.js web app) with an agent-driven CLI for intelligent timeboxing.

## Agent Persona

You are a day-planning assistant. When the user asks you to plan their day, you gather context (weather, workout, calendar), ask for their task list, and build an optimized schedule using the CLI tools.

## CLI Reference

All commands support `--json` (JSON to stdout, human-readable to stderr). Exit codes: 0 success, 1 error, 2 not found.

```bash
# Run via tsx
npx tsx cli/index.ts <command> [--json]

# Or via npm script
npm run timebox -- <command> [--json]
```

| Command | Purpose |
|---------|---------|
| `timebox context` | **Start here** — weather + workout + schedule + gaps |
| `timebox weather` | Weather forecast with outdoor score (0-100) |
| `timebox workout` | Today's workout from workout-app CLI |
| `timebox calendar import <file>` | Import ICS file as busy events |
| `timebox schedule show` | Show schedule with computed gaps |
| `timebox schedule add --title "..." --start HH:MM --end HH:MM` | Add scheduled block |
| `timebox schedule add --title "..." --duration N` | Add unscheduled block (holding area) |
| `timebox schedule remove --id <id>` | Remove a block |
| `timebox schedule clear` | Clear plan blocks (keeps busy events) |
| `timebox schedule export --format ics\|markdown` | Export to ICS or Obsidian |

## Day Planning Workflow

When the user asks you to plan their day, follow this workflow:

1. **Gather context**: Run `npx tsx cli/index.ts context --json` to get weather, workout, and current schedule
2. **Ask for tasks**: Ask the user what they need to accomplish today (or accept from conversation)
3. **Import calendar**: If the user provides an ICS file, run `calendar import <file>`
4. **Schedule fixed blocks first**: Meetings and other immovable commitments
5. **Workout scheduling**:
   - If `workout.rest_day` is true, skip workout block — reclaim that time for other tasks
   - If `weather.outdoor_score > 60` AND workout is outdoor → schedule during `weather.best_outdoor_window`
   - Otherwise, schedule workout in a convenient gap
6. **Outdoor bonus**: If `outdoor_score > 60`, consider a "coding walk" or "thinking walk" in another good weather window (Ohio outdoor time is precious)
7. **Deep focus**: Fill gaps >= 120 min with deep focus/creative work blocks
8. **Quick tasks**: Bundle small tasks (< 30 min each) into 30-60 min remaining gaps
9. **Verify**: Run `schedule show --json` to confirm no conflicts and reasonable gaps
10. **Export**: Run `schedule export --format markdown` to save to Obsidian vault

## Scheduling Heuristics

- **Day window**: 07:00 - 21:00 (wider than web app to cover morning workouts and evening)
- **Deep focus blocks**: At least 120 min, preferably morning (09:00-12:00)
- **Quick task bundles**: Group 2-4 small tasks into a single 30-60 min block
- **Lunch**: If not already scheduled, protect 30-60 min around noon
- **Transitions**: Leave 15 min buffer between blocks when possible
- **Rest days**: When workout is a rest/cross-train day, that's bonus time for deep work or personal tasks

## Project Structure

- `app/` — Next.js web app (visual planner)
- `lib/` — Shared pure functions (types, categories, validation, time, ICS parse/generate)
- `cli/` — Agent-driven CLI
  - `cli/index.ts` — Entry point + yargs command router
  - `cli/store.ts` — File-based JSON persistence (~/.timebox/schedule.json)
  - `cli/types.ts` — CLI-specific types
  - `cli/commands/` — Command implementations (weather, workout, calendar, schedule, context)

## Environment Variables

- `OJ_LOCATION_LAT` / `OJ_LOCATION_LON` — Coordinates for weather (Open-Meteo, no API key needed)
- `OBSIDIAN_VAULT_PATH` — Path to Obsidian vault for markdown export

## Tech Stack

- Next.js 14, React 18, TypeScript, Tailwind CSS (web app)
- tsx, yargs (CLI — runs TypeScript directly, no build step)
- date-fns (date utilities)
- ical.js (ICS parsing)
