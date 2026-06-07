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
    'Fetch weather forecast with outdoor score',
    (yargs) => {
      return yargs.option('days', {
        type: 'number',
        default: 1,
        description: 'Number of forecast days (1-7)',
      })
    },
    async (argv) => {
      try {
        const days = argv.days as number
        if (days > 1) {
          const { fetchMultiDayWeather, formatMultiDayWeatherHuman } = await import('./commands/weather')
          const data = await fetchMultiDayWeather(days)
          if (argv.json) {
            output(data, true)
          } else {
            output(formatMultiDayWeatherHuman(data), false)
          }
        } else {
          const { fetchWeather, formatWeatherHuman } = await import('./commands/weather')
          const data = await fetchWeather()
          if (argv.json) {
            output(data, true)
          } else {
            output(formatWeatherHuman(data), false)
          }
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
      return yargs
        .command(
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
        )
        .command(
          'import-photo <image>',
          'Prepare a photo of a calendar for agent-driven event extraction',
          (yargs) => {
            return yargs
              .positional('image', {
                type: 'string',
                description: 'Path to calendar photo (jpg/jpeg/png/webp/heic)',
                demandOption: true,
              })
              .option('date', {
                type: 'string',
                description: 'Any date in the target week (YYYY-MM-DD). Defaults to current week.',
              })
          },
          async (argv) => {
            try {
              const { importPhoto, formatImportPhotoHuman } = await import('./commands/calendar')
              const briefing = importPhoto(argv.image as string, argv.date as string | undefined)
              if (argv.json) {
                output(briefing, true)
              } else {
                output(formatImportPhotoHuman(briefing), false)
              }
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err)
              const code = msg.startsWith('Image not found') ? 2 : 1
              errorOut(msg, argv.json as boolean, code)
            }
          },
        )
        .command(
          'add-events',
          'Write events extracted from a photo into the week store',
          (yargs) => {
            return yargs
              .option('events', {
                type: 'string',
                demandOption: true,
                description: 'JSON array of events: [{title,date,start,end,location?,notes?}]',
              })
              .option('date', {
                type: 'string',
                description: 'Constrain writes to the week containing this date (YYYY-MM-DD)',
              })
          },
          async (argv) => {
            try {
              const { addEventsFromPhoto, formatAddEventsHuman } = await import('./commands/calendar')
              let parsed: unknown
              try {
                parsed = JSON.parse(argv.events as string)
              } catch (err) {
                throw new Error(`Invalid JSON for --events: ${err instanceof Error ? err.message : String(err)}`)
              }
              const result = addEventsFromPhoto(parsed as never, argv.date as string | undefined)
              if (argv.json) {
                output(result, true)
              } else {
                output(formatAddEventsHuman(result), false)
              }
            } catch (err) {
              errorOut(err instanceof Error ? err.message : String(err), argv.json as boolean)
            }
          },
        )
        .demandCommand(1, 'Please specify a calendar subcommand')
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
    'backlog',
    'Manage task backlog',
    (yargs) => {
      return yargs
        .command(
          'add',
          'Add a backlog item (writes to the Obsidian inbox; alias for capture)',
          (yargs) => {
            return yargs
              .option('title', { type: 'string', demandOption: true, description: 'Task title' })
              .option('duration', { type: 'number', description: 'Estimated duration in minutes' })
              .option('priority', { type: 'string', choices: ['hard', 'soft', 'none'], default: 'none', description: 'Priority level' })
              .option('deadline', { type: 'string', description: 'Deadline date (YYYY-MM-DD)' })
              .option('tags', { type: 'string', description: 'Comma-separated tags (e.g. task/house,outdoor)' })
              .option('outdoor', { type: 'boolean', default: false, description: 'Requires good weather' })
              .option('daylight', { type: 'boolean', default: false, description: 'Requires daylight' })
              .option('weekend', { type: 'boolean', default: false, description: 'Weekend only' })
          },
          async (argv) => {
            try {
              const { addItem } = await import('./commands/backlog')
              const item = addItem({
                title: argv.title as string,
                duration: argv.duration as number | undefined,
                priority: argv.priority as string,
                deadline: argv.deadline as string | undefined,
                outdoor: argv.outdoor as boolean,
                daylight: argv.daylight as boolean,
                weekend: argv.weekend as boolean,
                tags: argv.tags ? (argv.tags as string).split(',').map(t => t.trim()).filter(Boolean) : undefined,
              })
              if (argv.json) {
                output(item, true)
              } else {
                output(`Added: ${item.title} [${item.id.substring(0, 8)}]`, false)
              }
            } catch (err) {
              errorOut(err instanceof Error ? err.message : String(err), argv.json as boolean)
            }
          },
        )
        .command(
          'list',
          'List backlog items',
          (yargs) => {
            return yargs
              .option('priority', { type: 'string', choices: ['hard', 'soft', 'none'], description: 'Filter by priority' })
              .option('status', { type: 'string', choices: ['pending', 'scheduled', 'completed', 'all'], description: 'Filter by status' })
          },
          async (argv) => {
            try {
              const { listItems, formatBacklogHuman } = await import('./commands/backlog')
              const items = listItems({
                priority: argv.priority as string | undefined,
                status: argv.status as string | undefined,
              })
              if (argv.json) {
                output(items, true)
              } else {
                output(formatBacklogHuman(items), false)
              }
            } catch (err) {
              errorOut(err instanceof Error ? err.message : String(err), argv.json as boolean)
            }
          },
        )
        .command(
          'update',
          'Update a backlog item',
          (yargs) => {
            return yargs
              .option('id', { type: 'string', demandOption: true, description: 'Item ID' })
              .option('title', { type: 'string', description: 'New title' })
              .option('duration', { type: 'number', description: 'New duration in minutes' })
              .option('priority', { type: 'string', choices: ['hard', 'soft', 'none'], description: 'New priority' })
              .option('deadline', { type: 'string', description: 'New deadline (YYYY-MM-DD)' })
              .option('status', { type: 'string', choices: ['pending', 'scheduled', 'completed'], description: 'New status' })
          },
          async (argv) => {
            try {
              const { updateItem } = await import('./commands/backlog')
              const { item, found } = updateItem(argv.id as string, {
                title: argv.title as string | undefined,
                duration: argv.duration as number | undefined,
                priority: argv.priority as string | undefined,
                deadline: argv.deadline as string | undefined,
                status: argv.status as string | undefined,
              })
              if (!found) {
                errorOut(`Item not found: ${argv.id}`, argv.json as boolean, 2)
              }
              if (argv.json) {
                output(item, true)
              } else {
                output(`Updated: ${argv.id}`, false)
              }
            } catch (err) {
              errorOut(err instanceof Error ? err.message : String(err), argv.json as boolean)
            }
          },
        )
        .command(
          'remove',
          'Remove a backlog item',
          (yargs) => {
            return yargs.option('id', { type: 'string', demandOption: true, description: 'Item ID' })
          },
          async (argv) => {
            try {
              const { removeItem } = await import('./commands/backlog')
              const { found } = removeItem(argv.id as string)
              if (!found) {
                errorOut(`Item not found: ${argv.id}`, argv.json as boolean, 2)
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
          'complete',
          'Mark a backlog item as completed',
          (yargs) => {
            return yargs.option('id', { type: 'string', demandOption: true, description: 'Item ID' })
          },
          async (argv) => {
            try {
              const { completeItem } = await import('./commands/backlog')
              const { item, found } = completeItem(argv.id as string)
              if (!found) {
                errorOut(`Item not found: ${argv.id}`, argv.json as boolean, 2)
              }
              if (argv.json) {
                output(item, true)
              } else {
                output(`Completed: ${argv.id}`, false)
              }
            } catch (err) {
              errorOut(err instanceof Error ? err.message : String(err), argv.json as boolean)
            }
          },
        )
        .command(
          'migrate',
          'One-time import of legacy ~/.timebox/backlog.json into the Obsidian inbox',
          (yargs) => {
            return yargs.option('dry-run', { type: 'boolean', default: false, description: 'Preview without writing' })
          },
          async (argv) => {
            try {
              const { migrateBacklog, formatMigrateHuman } = await import('./commands/backlog-migrate')
              const result = migrateBacklog({ dryRun: argv['dry-run'] as boolean })
              if (argv.json) {
                output(result, true)
              } else {
                output(formatMigrateHuman(result), false)
              }
            } catch (err) {
              errorOut(err instanceof Error ? err.message : String(err), argv.json as boolean)
            }
          },
        )
        .command(
          'refine',
          'Briefing of unrefined Obsidian inbox items (default), or apply/delete subcommand',
          (yargs) => {
            return yargs
              .command(
                'apply',
                'Apply metadata updates to a specific inbox item',
                (yargs) => {
                  return yargs
                    .option('id', { type: 'string', demandOption: true, description: 'Inbox item ID (from briefing)' })
                    .option('duration', { type: 'number', description: 'Duration in minutes' })
                    .option('buffer', { type: 'number', description: 'Prep/cleanup buffer in minutes' })
                    .option('priority', { type: 'string', choices: ['hard', 'soft', 'none'], description: 'Priority' })
                    .option('deadline', { type: 'string', description: 'Deadline (YYYY-MM-DD)' })
                    .option('notes', { type: 'string', description: 'Free-text notes' })
                    .option('tags', { type: 'string', description: 'Comma-separated tags to add (e.g. task/house,weekend)' })
                    .option('remove-tags', { type: 'string', description: 'Comma-separated tags to remove' })
                    .option('dry-run', { type: 'boolean', default: false, description: 'Preview the diff without writing' })
                },
                async (argv) => {
                  try {
                    const { refineApply, formatRefineApplyHuman } = await import('./commands/refine')
                    const tags = argv.tags
                      ? (argv.tags as string).split(',').map(t => t.trim()).filter(t => t.length > 0)
                      : undefined
                    const removeTags = argv['remove-tags']
                      ? (argv['remove-tags'] as string).split(',').map(t => t.trim()).filter(t => t.length > 0)
                      : undefined
                    const result = refineApply({
                      id: argv.id as string,
                      duration: argv.duration as number | undefined,
                      buffer: argv.buffer as number | undefined,
                      priority: argv.priority as string | undefined,
                      deadline: argv.deadline as string | undefined,
                      notes: argv.notes as string | undefined,
                      tags,
                      removeTags,
                      dryRun: argv['dry-run'] as boolean,
                    })
                    if (!result.found) {
                      errorOut(`Item not found: ${argv.id}`, argv.json as boolean, 2)
                    }
                    if (argv.json) {
                      output(result, true)
                    } else {
                      output(formatRefineApplyHuman(result), false)
                    }
                  } catch (err) {
                    errorOut(err instanceof Error ? err.message : String(err), argv.json as boolean)
                  }
                },
              )
              .command(
                'delete',
                'Remove an inbox item entirely',
                (yargs) => {
                  return yargs.option('id', { type: 'string', demandOption: true, description: 'Inbox item ID' })
                },
                async (argv) => {
                  try {
                    const { refineDelete, formatRefineDeleteHuman } = await import('./commands/refine')
                    const result = refineDelete({ id: argv.id as string })
                    if (!result.found) {
                      errorOut(`Item not found: ${argv.id}`, argv.json as boolean, 2)
                    }
                    if (argv.json) {
                      output(result, true)
                    } else {
                      output(formatRefineDeleteHuman(result), false)
                    }
                  } catch (err) {
                    errorOut(err instanceof Error ? err.message : String(err), argv.json as boolean)
                  }
                },
              )
              .option('limit', { type: 'number', description: 'Cap the number of unrefined items returned' })
              .command(
                '$0',
                'Briefing of unrefined items in the Obsidian inbox',
                () => {},
                async (argv) => {
                  try {
                    const { refineList, formatRefineBriefingHuman } = await import('./commands/refine')
                    const briefing = refineList({ limit: argv.limit as number | undefined })
                    if (argv.json) {
                      output(briefing, true)
                    } else {
                      output(formatRefineBriefingHuman(briefing), false)
                    }
                  } catch (err) {
                    errorOut(err instanceof Error ? err.message : String(err), argv.json as boolean)
                  }
                },
              )
          },
        )
        .demandCommand(1, 'Please specify a backlog subcommand')
    },
  )
  .command(
    'week',
    'Manage weekly schedule',
    (yargs) => {
      return yargs
        .command(
          'show',
          'Show weekly schedule with gaps',
          (yargs) => {
            return yargs.option('date', { type: 'string', description: 'Any date in the target week (YYYY-MM-DD)' })
          },
          async (argv) => {
            try {
              const { showWeek, formatWeekHuman } = await import('./commands/week')
              const data = showWeek(argv.date as string | undefined)
              if (argv.json) {
                output(data, true)
              } else {
                output(formatWeekHuman(data, data.dailyGaps), false)
              }
            } catch (err) {
              errorOut(err instanceof Error ? err.message : String(err), argv.json as boolean)
            }
          },
        )
        .command(
          'add',
          'Add a block to a day',
          (yargs) => {
            return yargs
              .option('date', { type: 'string', demandOption: true, description: 'Target date (YYYY-MM-DD)' })
              .option('title', { type: 'string', demandOption: true, description: 'Block title' })
              .option('start', { type: 'string', demandOption: true, description: 'Start time (HH:MM)' })
              .option('end', { type: 'string', demandOption: true, description: 'End time (HH:MM)' })
              .option('category', { type: 'string', description: 'Block category' })
              .option('notes', { type: 'string', description: 'Optional notes' })
          },
          async (argv) => {
            try {
              const { addWeekBlock } = await import('./commands/week')
              const { block, weekOf } = addWeekBlock({
                date: argv.date as string,
                title: argv.title as string,
                start: argv.start as string,
                end: argv.end as string,
                category: argv.category as string | undefined,
                notes: argv.notes as string | undefined,
              })
              if (argv.json) {
                output({ block, weekOf }, true)
              } else {
                output(`Added: ${block.title} on ${argv.date} ${argv.start}-${argv.end} [${block.id.substring(0, 8)}]`, false)
              }
            } catch (err) {
              errorOut(err instanceof Error ? err.message : String(err), argv.json as boolean)
            }
          },
        )
        .command(
          'remove',
          'Remove a block from a day',
          (yargs) => {
            return yargs
              .option('date', { type: 'string', demandOption: true, description: 'Target date (YYYY-MM-DD)' })
              .option('id', { type: 'string', demandOption: true, description: 'Block ID' })
          },
          async (argv) => {
            try {
              const { removeWeekBlock } = await import('./commands/week')
              const { found } = removeWeekBlock(argv.date as string, argv.id as string)
              if (!found) {
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
          'Clear plan blocks from a day or entire week',
          (yargs) => {
            return yargs.option('date', { type: 'string', description: 'Clear specific day (YYYY-MM-DD). Omit to clear entire week.' })
          },
          async (argv) => {
            try {
              const { clearWeekDay } = await import('./commands/week')
              const { cleared, weekOf } = clearWeekDay(argv.date as string | undefined)
              if (argv.json) {
                output({ cleared, weekOf }, true)
              } else {
                output(`Cleared ${cleared} blocks from ${argv.date || `week of ${weekOf}`}`, false)
              }
            } catch (err) {
              errorOut(err instanceof Error ? err.message : String(err), argv.json as boolean)
            }
          },
        )
        .command(
          'export',
          'Export weekly schedule',
          (yargs) => {
            return yargs
              .option('format', {
                type: 'string',
                choices: ['markdown'] as const,
                demandOption: true,
                description: 'Export format',
              })
              .option('date', { type: 'string', description: 'Any date in the target week (YYYY-MM-DD)' })
          },
          async (argv) => {
            try {
              const { exportWeek } = await import('./commands/week')
              const result = exportWeek(argv.format as 'markdown', argv.date as string | undefined)
              if (argv.json) {
                output(result, true)
              } else {
                if (result.path) {
                  output(`Exported to: ${result.path}`, false)
                } else {
                  output(result.content, false)
                }
              }
            } catch (err) {
              errorOut(err instanceof Error ? err.message : String(err), argv.json as boolean)
            }
          },
        )
        .demandCommand(1, 'Please specify a week subcommand')
    },
  )
  .command(
    'capture',
    'Capture an idea/task to the Obsidian backlog inbox',
    (yargs) => {
      return yargs
        .option('title', { type: 'string', demandOption: true, description: 'Item title' })
        .option('tags', { type: 'string', description: 'Comma-separated tags (e.g. task/house,weekend)' })
        .option('duration', { type: 'number', description: 'Estimated duration in minutes' })
        .option('buffer', { type: 'number', description: 'Prep/cleanup buffer in minutes' })
        .option('priority', { type: 'string', choices: ['hard', 'soft', 'none'], description: 'Priority level' })
        .option('deadline', { type: 'string', description: 'Deadline (YYYY-MM-DD)' })
        .option('notes', { type: 'string', description: 'Optional notes' })
    },
    async (argv) => {
      try {
        const { captureItem, formatCaptureHuman } = await import('./commands/capture')
        const tags = argv.tags
          ? (argv.tags as string).split(',').map(t => t.trim()).filter(t => t.length > 0)
          : undefined
        const result = captureItem({
          title: argv.title as string,
          tags,
          duration: argv.duration as number | undefined,
          buffer: argv.buffer as number | undefined,
          priority: argv.priority as string | undefined,
          deadline: argv.deadline as string | undefined,
          notes: argv.notes as string | undefined,
        })
        if (argv.json) {
          output(result, true)
        } else {
          output(formatCaptureHuman(result), false)
        }
      } catch (err) {
        errorOut(err instanceof Error ? err.message : String(err), argv.json as boolean)
      }
    },
  )
  .command(
    'catalog',
    'Manage cross-repo code work catalog',
    (yargs) => {
      return yargs
        .command(
          'refresh',
          'Refresh code catalog by scanning ~/projects/* GitHub repos',
          (yargs) => {
            return yargs.option('root', {
              type: 'string',
              description: 'Override projects root (defaults to ~/projects)',
            })
          },
          async (argv) => {
            try {
              const { refreshCatalog, formatRefreshHuman } = await import('./commands/catalog')
              const result = await refreshCatalog({ root: argv.root as string | undefined })
              if (argv.json) {
                output(result, true)
              } else {
                output(formatRefreshHuman(result), false)
              }
            } catch (err) {
              errorOut(err instanceof Error ? err.message : String(err), argv.json as boolean)
            }
          },
        )
        .command(
          'list',
          'List catalog issues with optional filters',
          (yargs) => {
            return yargs
              .option('repo', { type: 'string', description: 'Substring match against owner/name' })
              .option('max-loe', {
                type: 'string',
                choices: ['S', 'M', 'L', 'XL'] as const,
                description: 'Cap level of effort (e.g. M includes S and M)',
              })
              .option('impact', {
                type: 'string',
                choices: ['low', 'med', 'high'] as const,
                description: 'Filter by impact',
              })
          },
          async (argv) => {
            try {
              const { listCatalog, formatListHuman } = await import('./commands/catalog')
              const result = listCatalog({
                repo: argv.repo as string | undefined,
                maxLoe: argv['max-loe'] as 'S' | 'M' | 'L' | 'XL' | undefined,
                impact: argv.impact as 'low' | 'med' | 'high' | undefined,
              })
              if (argv.json) {
                output(result, true)
              } else {
                output(formatListHuman(result), false)
              }
            } catch (err) {
              errorOut(err instanceof Error ? err.message : String(err), argv.json as boolean)
            }
          },
        )
        .demandCommand(1, 'Please specify a catalog subcommand')
    },
  )
  .command(
    'plan-day',
    'Synthesize 3 archetype day plans from all sources',
    (yargs) => {
      return yargs
        .option('date', { type: 'string', description: 'Target date (YYYY-MM-DD). Defaults to today.' })
        .option('apply', { type: 'number', description: 'Apply plan N (1-indexed) — writes its blocks to the week store' })
    },
    async (argv) => {
      try {
        const { planDay, formatPlanDayHuman } = await import('./commands/plan-day')
        const result = await planDay({
          date: argv.date as string | undefined,
          apply: argv.apply as number | undefined,
        })
        if (argv.json) {
          output(result, true)
        } else {
          output(formatPlanDayHuman(result), false)
        }
      } catch (err) {
        errorOut(err instanceof Error ? err.message : String(err), argv.json as boolean)
      }
    },
  )
  .command(
    'context',
    'Get planning context (daily or weekly)',
    (yargs) => {
      return yargs
        .option('week', { type: 'boolean', default: false, description: 'Get weekly context' })
        .option('date', { type: 'string', description: 'Target date (for weekly context)' })
    },
    async (argv) => {
      try {
        if (argv.week) {
          const { getWeeklyContext, formatWeeklyContextHuman } = await import('./commands/context')
          const data = await getWeeklyContext(argv.date as string | undefined)
          if (argv.json) {
            output(data, true)
          } else {
            output(formatWeeklyContextHuman(data), false)
          }
        } else {
          const { getContext, formatContextHuman } = await import('./commands/context')
          const data = await getContext()
          if (argv.json) {
            output(data, true)
          } else {
            output(formatContextHuman(data), false)
          }
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
