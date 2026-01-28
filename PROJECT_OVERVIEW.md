# Project Overview

## Summary
- AniSeason is a weekly calendar for seasonal anime releases, localized to the user's timezone.
- The app is client-side React + Vite; no backend code lives in this repo.

Resumen (ES): calendario semanal de estrenos de anime con conversion de zona horaria local.

## Core user flows
- Browse seasonal titles or search by name.
- Add/remove anime to build a personal schedule.
- View airings in a weekly calendar (time grid on desktop, list on mobile).
- Send feedback from the floating widget.

## Data sources and integrations
- Jikan API (unofficial MyAnimeList API) for seasonal/search data.
- Feedback posts to `/api/feedback` (serverless endpoint outside this repo).
- Optional Cloudflare Turnstile via `VITE_TURNSTILE_SITE_KEY`.
- Vercel Analytics in `src/main.tsx`.
- `public/tracker.js` sends webhooks only on the production domain.

## Key structure
- `src/App.tsx`: app shell, mobile tabs, feedback wiring.
- `src/components/`: Sidebar, CalendarView, FeedbackWidget, and UI pieces.
- `src/hooks/`: data and state hooks (seasonal data, selections, preferences).
- `src/lib/api/jikan.ts`: Jikan client with caching and rate limiting.
- `src/lib/utils/`: parser and timezone helpers.
- `src/lib/storage/`: localStorage helpers.
- `src/types/`: shared TypeScript types.

## Runtime behavior
- Seasonal data loads on mount and is cached in localStorage.
- Selected anime IDs and metadata persist in localStorage.
- Calendar events are derived client-side from broadcast strings.
- JST broadcast times are converted to the user's local timezone via Luxon.

## Local development
- Install: `npm install`
- Dev server: `npm run dev`
- Build: `npm run build`
- Lint: `npm run lint`
- Tests: none configured
