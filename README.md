# Time-Box My Day

A tiny, client-side web app that imports your calendar for **today** from an **.ics** file, lets you **drag & drop** focused work blocks into the gaps, and exports the plan back to **.ics**—with a built-in **CSV→ICS** utility.

## Features

- 📅 **Import .ics calendars** - Upload your calendar file to see busy blocks for any day
- ⏰ **Create plan blocks** - Click the timeline or use the "+ New Block" button to add focused work time
- ✏️ **Edit & manage blocks** - Click blocks to edit title, time, location, and notes
- ⚠️ **Conflict detection** - Visual warnings when blocks overlap (non-blocking)
- 📤 **Export to .ics** - Download your plan blocks as a calendar file
- 📊 **CSV→ICS converter** - Upload CSV data and convert to calendar format
- 🔒 **100% client-side** - All processing happens in your browser, no data leaves your device
- 💾 **Auto-save** - Plan blocks persist in browser localStorage

## Getting Started

### Prerequisites

- Node.js 18+ and pnpm (or npm/yarn)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/timebox-my-day.git
cd timebox-my-day
```

2. Install dependencies:
```bash
pnpm install
# or: npm install
```

3. Run the development server:
```bash
pnpm dev
# or: npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

### Building for Production

```bash
pnpm build
pnpm start
```

## Usage

### Basic Workflow

1. **Import your calendar**: Click "Import" → upload your .ics file → see busy blocks
2. **Add plan blocks**: Click timeline or use "+ New Block" button
3. **Edit blocks**: Click any plan block to modify details
4. **Handle conflicts**: Yellow warnings appear for overlaps (you can still proceed)
5. **Export plan**: Click "Export Plan" to download your schedule

### CSV Import

Use the CSV→ICS utility to convert spreadsheet data:

**Required columns:**
- `title` - Event title
- `start` - Start time (ISO 8601: `2025-11-12T13:00`)
- `end` - End time (ISO 8601: `2025-11-12T14:00`)

**Optional columns:**
- `location`
- `description`
- `timezone` (IANA format, e.g., `America/New_York`)

**Example CSV:**
```csv
title,start,end,location,description
Deep Work,2025-11-12T09:00,2025-11-12T10:30,Home,Focus on quarterly deck
Team Sync,2025-11-12T14:00,2025-11-12T15:00,Office,Weekly check-in
```

### Keyboard Shortcuts

- **←/→** - Navigate between days (via date picker buttons)
- **Esc** - Close modals
- **Tab** - Navigate between UI elements

## Technical Details

### Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **State**: Zustand with localStorage persistence
- **Libraries**:
  - `ical.js` - ICS parsing
  - `papaparse` - CSV parsing
  - `zod` - Schema validation
  - `date-fns` - Date utilities

### Architecture

```
/
├── app/                    # Next.js app directory
│   ├── page.tsx           # Main page component
│   ├── layout.tsx         # Root layout
│   └── globals.css        # Global styles
├── components/            # React components
│   ├── ui/               # Reusable UI components
│   ├── Timeline.tsx      # Main timeline view
│   ├── ImportModal.tsx   # Import functionality
│   └── ...
├── lib/                   # Utilities and logic
│   ├── types.ts          # TypeScript interfaces
│   ├── ics-parse.ts      # ICS parsing
│   ├── ics-generate.ts   # ICS generation
│   ├── csv-parse.ts      # CSV parsing
│   ├── validation.ts     # Conflict detection
│   ├── time.ts           # Time utilities
│   └── store.ts          # Zustand store
└── samples/              # Sample test files
```

### Data Model

```typescript
interface BusyEvent {
  id: string
  title: string
  start: string  // ISO 8601
  end: string    // ISO 8601
  location?: string
  source: 'ics' | 'csv-ics'
}

interface PlanBlock {
  id: string
  title: string
  start: string  // ISO 8601
  end: string    // ISO 8601
  location?: string
  notes?: string
}
```

## Privacy & Security

🔒 **Your data never leaves your browser.** All file parsing, editing, and export operations happen entirely client-side. No data is sent to any server or stored in any database.

The app uses:
- Browser `FileReader` API for file uploads
- LocalStorage for persisting plan blocks
- No analytics or tracking

## Limitations (v0)

- **Date range**: Limited to today ±3 days
- **Recurring events**: Not supported (RRULE ignored)
- **Timezone handling**: Exports use UTC; your calendar app converts on import
- **All-day events**: Shown as ignored during import

## Deployment

### Deploy to Vercel

1. Push code to GitHub
2. Visit [vercel.com](https://vercel.com)
3. Import your GitHub repository
4. Accept default settings (Framework: Next.js)
5. Deploy!

Subsequent pushes to `main` automatically deploy to production.

## Development

### Project Commands

```bash
pnpm dev      # Start development server
pnpm build    # Build for production
pnpm start    # Start production server
pnpm lint     # Run ESLint
```

### File Structure Best Practices

- Components in `components/` should be reusable
- Business logic in `lib/` should be framework-agnostic
- Use TypeScript strict mode for type safety
- Follow Next.js App Router conventions

## Testing

### Manual Testing Checklist

- [ ] Import sample .ics with 3+ events
- [ ] Create 2 plan blocks via timeline click
- [ ] Edit a plan block (change title and duration)
- [ ] Delete a plan block
- [ ] Create overlapping blocks → see conflict warning
- [ ] Export plan → verify .ics downloads
- [ ] Re-import exported .ics into calendar app
- [ ] Upload sample CSV → validate rows
- [ ] Export CSV to .ics → download works
- [ ] Check "Load into Planner" → blocks appear

### Sample Files

Sample `.ics` and `.csv` files for testing are in the `/samples` directory.

## Roadmap

Future enhancements (see PRD for details):

- Multi-day and week view
- Timezone-aware export (VTIMEZONE support)
- Recurring event expansion (RRULE)
- PWA support with offline mode
- Drag-to-resize blocks
- Import deduplication
- Natural language time parsing for CSV
- Color themes and block templates

## Contributing

Contributions welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT License - see LICENSE file for details

## Acknowledgments

Built with:
- [Next.js](https://nextjs.org/)
- [ical.js](https://github.com/mozilla-comm/ical.js)
- [Papa Parse](https://www.papaparse.com/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Zustand](https://github.com/pmndrs/zustand)

---

**Note**: This is a v0 MVP. See the PRD for the full feature roadmap and technical specifications.

