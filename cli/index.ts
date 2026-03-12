#!/usr/bin/env npx tsx
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

function output(data: unknown, json: boolean): void {
  if (json) {
    process.stdout.write(JSON.stringify(data, null, 2) + '\n')
  } else {
    process.stderr.write(String(data) + '\n')
  }
}

function errorOut(msg: string, json: boolean, code: number = 1): never {
  if (json) {
    process.stdout.write(JSON.stringify({ error: msg, code }) + '\n')
  } else {
    process.stderr.write(`Error: ${msg}\n`)
  }
  process.exit(code)
}

yargs(hideBin(process.argv))
  .option('json', {
    type: 'boolean',
    default: false,
    description: 'Output as JSON (stdout)',
  })
  .command(
    'weather',
    'Fetch today\'s weather with outdoor score',
    () => {},
    async (argv) => {
      try {
        const { fetchWeather, formatWeatherHuman } = await import('./commands/weather')
        const data = await fetchWeather()
        if (argv.json) {
          output(data, true)
        } else {
          output(formatWeatherHuman(data), false)
        }
      } catch (err) {
        errorOut(err instanceof Error ? err.message : String(err), argv.json as boolean)
      }
    },
  )
  .command(
    'workout',
    'Get today\'s workout from workout-app',
    () => {},
    async (argv) => {
      try {
        const { fetchWorkout, formatWorkoutHuman } = await import('./commands/workout')
        const data = await fetchWorkout()
        if (argv.json) {
          output(data, true)
        } else {
          output(formatWorkoutHuman(data), false)
        }
      } catch (err) {
        errorOut(err instanceof Error ? err.message : String(err), argv.json as boolean)
      }
    },
  )
  .command(
    'calendar',
    'Calendar operations',
    (yargs) => {
      return yargs.command(
        'import <file>',
        'Import events from an ICS file',
        (yargs) => {
          return yargs.positional('file', {
            type: 'string',
            description: 'Path to ICS file',
            demandOption: true,
          })
        },
        async (argv) => {
          try {
            const { importCalendar, formatImportHuman } = await import('./commands/calendar')
            const result = await importCalendar(argv.file as string)
            if (argv.json) {
              output(result, true)
            } else {
              output(formatImportHuman(result), false)
            }
          } catch (err) {
            errorOut(err instanceof Error ? err.message : String(err), argv.json as boolean)
          }
        },
      ).demandCommand(1, 'Please specify a calendar subcommand')
    },
  )
  .command(
    'schedule',
    'Manage day schedule',
    (yargs) => {
      return yargs
        .command(
          'show',
          'Show day schedule with gaps',
          () => {},
          async (argv) => {
            try {
              const { showSchedule, formatScheduleHuman } = await import('./commands/schedule')
              const view = showSchedule()
              if (argv.json) {
                output(view, true)
              } else {
                output(formatScheduleHuman(view), false)
              }
            } catch (err) {
              errorOut(err instanceof Error ? err.message : String(err), argv.json as boolean)
            }
          },
        )
        .command(
          'add',
          'Add a plan block',
          (yargs) => {
            return yargs
              .option('title', { type: 'string', demandOption: true, description: 'Block title' })
              .option('start', { type: 'string', description: 'Start time (HH:MM)' })
              .option('end', { type: 'string', description: 'End time (HH:MM)' })
              .option('duration', { type: 'number', description: 'Duration in minutes (for unscheduled blocks)' })
              .option('notes', { type: 'string', description: 'Optional notes' })
          },
          async (argv) => {
            try {
              const { addScheduleBlock } = await import('./commands/schedule')
              const result = addScheduleBlock({
                title: argv.title as string,
                start: argv.start as string | undefined,
                end: argv.end as string | undefined,
                duration: argv.duration as number | undefined,
                notes: argv.notes as string | undefined,
              })
              if (argv.json) {
                output(result, true)
              } else {
                const label = result.type === 'scheduled' ? 'Scheduled' : 'Added to holding area'
                output(`${label}: ${argv.title} [${result.block.id}]`, false)
              }
            } catch (err) {
              errorOut(err instanceof Error ? err.message : String(err), argv.json as boolean)
            }
          },
        )
        .command(
          'remove',
          'Remove a block by ID',
          (yargs) => {
            return yargs.option('id', { type: 'string', demandOption: true, description: 'Block ID' })
          },
          async (argv) => {
            try {
              const { removeScheduleBlock } = await import('./commands/schedule')
              const result = removeScheduleBlock(argv.id as string)
              if (!result.found) {
                errorOut(`Block not found: ${argv.id}`, argv.json as boolean, 2)
              }
              if (argv.json) {
                output({ removed: argv.id }, true)
              } else {
                output(`Removed: ${argv.id}`, false)
              }
            } catch (err) {
              errorOut(err instanceof Error ? err.message : String(err), argv.json as boolean)
            }
          },
        )
        .command(
          'clear',
          'Clear all plan blocks (keeps busy events)',
          () => {},
          async (argv) => {
            try {
              const { clearSchedule } = await import('./commands/schedule')
              const result = clearSchedule()
              if (argv.json) {
                output(result, true)
              } else {
                output(`Cleared ${result.cleared} blocks`, false)
              }
            } catch (err) {
              errorOut(err instanceof Error ? err.message : String(err), argv.json as boolean)
            }
          },
        )
        .command(
          'export',
          'Export schedule to ICS or markdown',
          (yargs) => {
            return yargs.option('format', {
              type: 'string',
              choices: ['ics', 'markdown'] as const,
              demandOption: true,
              description: 'Export format',
            })
          },
          async (argv) => {
            try {
              const { exportSchedule } = await import('./commands/schedule')
              const result = exportSchedule(argv.format as 'ics' | 'markdown')
              if (argv.json) {
                output({ path: result.path, format: argv.format }, true)
              } else {
                output(`Exported to: ${result.path}`, false)
              }
            } catch (err) {
              errorOut(err instanceof Error ? err.message : String(err), argv.json as boolean)
            }
          },
        )
        .demandCommand(1, 'Please specify a schedule subcommand')
    },
  )
  .command(
    'context',
    'Get full day context (weather + workout + schedule + gaps)',
    () => {},
    async (argv) => {
      try {
        const { getContext, formatContextHuman } = await import('./commands/context')
        const data = await getContext()
        if (argv.json) {
          output(data, true)
        } else {
          output(formatContextHuman(data), false)
        }
      } catch (err) {
        errorOut(err instanceof Error ? err.message : String(err), argv.json as boolean)
      }
    },
  )
  .demandCommand(1, 'Please specify a command')
  .strict()
  .help()
  .parse()
