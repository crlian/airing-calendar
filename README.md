# AniSeason

AniSeason is a weekly calendar for seasonal anime releases, localized to your
timezone. It lets you browse or search anime and build a personal airing
schedule.

## Live Site
https://aniseason.com

## Features
- Weekly time-grid calendar
- Seasonal release data and search
- Automatic timezone conversion
- Poster-based events with hover details

## Tech Stack
- React + Vite
- Tailwind CSS + shadcn/ui
- FullCalendar (timeGridWeek)
- Luxon (timezone handling)

## Visitor Tracking

This project includes visitor tracking functionality (`public/tracker.js`) that sends site visit data to a personal n8n webhook for Telegram notifications. This feature is enabled only on the live site (aniseason.com).

If you fork or deploy this project:
- The tracker will not send data unless you configure it with your own webhook URL
- You can disable tracking by removing the script tag from `index.html`
- Or replace the `WEBHOOK_URL` in `public/tracker.js` with your own endpoint

The tracker collects: session ID, visited page, referrer, timestamp, user agent, and hostname. Data is only sent once per unique visitor session.

## Development

Install dependencies:

```bash
npm install
```

Run the dev server:

```bash
npm run dev
```

Build for production:

```bash
npm run build
```

## Attribution & Disclaimer
- Data provided by Jikan API (unofficial MyAnimeList API).
- This project is not affiliated with or endorsed by MyAnimeList or Jikan.

## License
MIT. See `LICENSE`.
