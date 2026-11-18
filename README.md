# Tampa Bay Live Music & Venue Calendar

An interactive monthly calendar and event aggregator covering 8 premier live music and entertainment venues around Tampa Bay:

1. **New World Tampa** (`https://www.newworldtampa.com/events`)
2. **Coppertail Brewing Co.** (`https://coppertailbrewing.com/live`)
3. **The Orpheum** (`https://www.theorpheum.com/`)
4. **Ferg's Sports Bar & Pavilion** (`https://fergssportsbar.com/upcoming-events/`)
5. **Straz Center** (`https://www.strazcenter.org/calendar/`)
6. **Ruth Eckerd Hall & Affiliated Venues** (`https://www.rutheckerdhall.com/events`)
7. **Benchmark International Arena** (`https://www.benchmarkintlarena.com/events/`)
8. **MIDFLORIDA Credit Union Amphitheatre** (`https://www.midfloridaamp.com/shows`)

---

## Features

- **Interactive Monthly Calendar Grid & Chronological List View**: Browse shows by month, see today's shows highlighted, or switch to a chronological list.
- **Color-Coded Venue Filtering**: Click any venue chip at the top to toggle its shows on/off, view how many shows each venue has that month, or click the `↗` icon to open the venue's official events page directly.
- **Instant Band / Artist Search**: Filter the calendar in real time by band name, tour title, genre, or stage.
- **Google Calendar & iCal (`.ics`) Export**:
  - Click any show to add it directly to **Google Calendar** with one click or download an `.ics` file for Apple/Outlook Calendar.
  - Click **📅 Export Month (.ics)** in the header to export all currently filtered shows for the active month at once.
- **Automated Venue Scraper (`scraper.js`)**: Fetches and parses structured event data from the venues and updates `events-data.js`.

---

## Running Locally

1. **Open Directly**: You can double-click `index.html` to open the calendar immediately in any browser without running a server.
2. **Run with Local Server & Live Scraper**:
   ```bash
   node server.js
   ```
   Then visit `http://localhost:3000`. Clicking **↻ Sync Venues** in the top bar will trigger `scraper.js` to fetch new events.
3. **Run Scraper CLI Manually**:
   ```bash
   node scraper.js
   ```

---

## Free Online Hosting (Access from Phone or Anywhere)

### Option A: GitHub Pages (with Automatic Daily Scraping)
1. Create a free GitHub repository and push this folder to it.
2. Go to **Settings → Pages** and set the source branch to `main` (root `/`).
3. The included GitHub Action (`.github/workflows/update-events.yml`) will automatically run `node scraper.js` every morning and commit any new shows to `events-data.js`.

### Option B: Netlify (Drag-and-Drop or Git Deploy)
1. Go to [app.netlify.com/drop](https://app.netlify.com/drop) and drag the `tampa-bay-music-calendar` folder into your browser, **or** connect your GitHub repo to Netlify.
2. You'll immediately get a live `https://...netlify.app` URL that works on mobile and desktop.
