# AGENTS

## Purpose
This file helps agentic coding tools work consistently in this repo.

## Project summary
- AniSeason is a weekly calendar for seasonal anime releases, localized to the user timezone.
- Users browse or search anime, then add shows to build a personal airing schedule.
- Data comes from the Jikan API (unofficial MyAnimeList API).

## Stack
- React 19 + Vite 7
- TypeScript 5.9 (strict)
- Tailwind CSS 4 + shadcn/ui primitives
- FullCalendar (timeGridWeek + listWeek)
- Luxon for timezones
- Vercel Analytics (client)

## Commands
Install deps:
```bash
npm install
```

Dev server:
```bash
npm run dev
```

Build:
```bash
npm run build
```

Lint:
```bash
npm run lint
```

Preview build:
```bash
npm run preview
```

Tests:
- No test runner configured (no test script or config found).
- Single-test command: not available until a test runner is added.

## Repo map
- src/App.tsx: app shell + layout + feedback wiring
- src/main.tsx: entry point
- src/components/: feature and layout components
- src/components/ui/: shadcn/ui primitives (Button, Card, etc.)
- src/hooks/: data and state hooks
- src/lib/api/jikan.ts: Jikan client, cache, rate limiting
- src/lib/utils/: parsing and time utilities
- src/lib/storage/: localStorage helpers
- src/types/: shared types
- public/tracker.js: optional visitor tracking

## Architecture notes
- Jikan API data is cached in localStorage with TTL and size limits.
- Selected anime IDs and cached anime metadata are stored in localStorage.
- Calendar events are derived client-side from broadcast strings.
- Feedback widget posts to /api/feedback (endpoint is outside this repo).
- JST to local conversions live in src/lib/utils/timezone.ts.

## TypeScript
- Strict mode is enabled; keep types precise and avoid any.
- Use type-only imports: `import type { Foo }`.
- Prefer explicit return types for exported helpers when non-trivial.
- Keep props/interfaces close to the component using them.

## React conventions
- Components: PascalCase; hooks: useX.
- Use memo/useMemo/useCallback where it reduces re-renders (see Sidebar and CalendarView).
- Use functional state updates when derived from previous state.
- Lazy-load heavy views with React.lazy + Suspense (CalendarView pattern).

## Imports
- Use alias `@/` for src paths (tsconfig + Vite).
- Order: external packages, then alias imports, then relative imports, then styles.
- Keep imports grouped; one blank line between groups.

## Formatting
- Use 2-space indentation.
- Use double quotes for strings.
- Use semicolons.
- Trailing commas in multi-line objects/arrays.
- Wrap long JSX props for readability.

## Styling
- Tailwind CSS is primary; avoid custom CSS unless needed.
- UI primitives live in src/components/ui; use them over bespoke markup.
- Compose class names with cn() from src/lib/utils.ts.
- Typography relies on font-display/font-sans tokens in src/index.css.

## Data and error handling
- Wrap fetch/localStorage with try/catch; log via console.error and set UI-friendly messages.
- JikanRateLimitError communicates retry guidance; keep it intact.
- Avoid throwing in render paths; bubble errors to hooks or handlers.

## Naming
- Types/interfaces: PascalCase (AnimeData, CalendarEvent).
- Constants: UPPER_SNAKE for module-level values (CACHE_DURATION).
- Functions/vars: camelCase; boolean names start with is/has/should.
- Props: suffix with Props when it clarifies intent.

## Local storage
- Keys are namespaced with "anime-calendar:".
- Validate parsed JSON before use; handle invalid data gracefully.

## Linting
- ESLint flat config in eslint.config.js; targets TS/TSX only.
- Build runs tsc -b; TS configs are no-emit.

## Deployment/analytics
- Vercel Analytics is initialized in src/main.tsx.
- public/tracker.js sends webhooks only on the production domain; avoid breaking it.

## Cursor/Copilot rules
- No .cursor/rules/, .cursorrules, or .github/copilot-instructions.md found.

## When adding new features
- Prefer extending existing hooks/utilities over new ones.
- Keep API calls in src/lib/api and map raw data to app-ready shapes.
- Keep UI components focused; split large ones like Sidebar if adding major sections.
- Add relevant types in src/types and re-use existing ones where possible.

## Quick tips for agents
- Check public/tracker.js before removing scripts in index.html.
- Calendar behavior depends on broadcast string parsing; update parser tests if you add them.
- Use DateTime from Luxon for timezone math; avoid manual Date offsets.
- Keep mobile layout considerations (see App.tsx mobile tab behavior).

## Known gaps
- No automated tests; add Vitest or similar if testing is required.
- No formatting tool configured; follow existing style.

## Files to start with
- src/App.tsx
- src/components/sidebar/Sidebar.tsx
- src/components/calendar/CalendarView.tsx
- src/lib/api/jikan.ts
- src/hooks/useSeasonalAnime.ts
- src/hooks/useAnimeData.ts

## Contacts
- None listed; use README for public links.
