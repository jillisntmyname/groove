/**
 * Multi-Source Tampa Bay Live Music Scraper & Aggregator
 *
 * Why venue-only HTML scraping misses events:
 * Many venue websites render their calendars inside client-side JavaScript iframes
 * or third-party widgets (VenuePilot, Prekindle, AXS, Eventbrite, Ticketmaster).
 *
 * This multi-source scraper combines:
 * 1. Direct venue pages (all 19 Tampa Bay venues)
 * 2. Local music aggregators (Creative Loafing Tampa Bay, JamBase Tampa Bay, Songkick)
 * 3. JSON-LD Schema.org/MusicEvent & Event extraction + HTML date/artist pattern parsing
 *
 * Usage:
 *   node scraper.js
 */

const fs = require('fs');
const path = require('path');

function loadExistingData() {
  const filePath = path.join(__dirname, 'events-data.js');
  if (!fs.existsSync(filePath)) return { venues: [], aggregators: [], events: [] };
  const raw = fs.readFileSync(filePath, 'utf8');
  const sandbox = { window: {} };
  const fn = new Function('window', raw + '\nreturn window.TAMPA_BAY_EVENTS_DATA;');
  return fn(sandbox.window);
}

function slugify(str) {
  return String(str)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function decodeHtml(str) {
  return String(str || '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#8211;/g, '–')
    .replace(/&#8217;/g, "'")
    .replace(/<[^>]+>/g, '')
    .trim();
}

/**
 * Extracts schema.org/Event & MusicEvent blocks from JSON-LD tags
 */
function extractJsonLdEvents(html, defaultVenue) {
  const results = [];
  const scriptRegex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;

  while ((match = scriptRegex.exec(html)) !== null) {
    try {
      const parsed = JSON.parse(match[1].trim());
      const items = Array.isArray(parsed)
        ? parsed
        : parsed['@graph']
        ? parsed['@graph']
        : [parsed];

      for (const item of items) {
        const type = item['@type'] || '';
        const isEvent =
          type === 'Event' ||
          type === 'MusicEvent' ||
          type === 'TheaterEvent' ||
          type === 'Festival' ||
          (Array.isArray(type) && type.some(t => t.includes('Event')));

        if (isEvent && item.name && item.startDate) {
          const dt = new Date(item.startDate);
          if (!isNaN(dt.getTime())) {
            const isoDate = dt.toISOString().slice(0, 10);
            const timeStr = dt.toLocaleTimeString('en-US', {
              hour: 'numeric',
              minute: '2-digit',
              timeZone: 'America/New_York'
            });
            const locName = (item.location && item.location.name) || defaultVenue.name;
            results.push({
              id: `${defaultVenue.id}-${isoDate}-${slugify(item.name).slice(0, 24)}`,
              title: decodeHtml(item.name),
              venueId: defaultVenue.id,
              date: isoDate,
              time: timeStr || '7:30 PM',
              stage: decodeHtml(locName),
              description: decodeHtml(item.description || `Live performance at ${locName}.`),
              url: item.url || defaultVenue.url
            });
          }
        }
      }
    } catch (_) {
      // Ignore malformed JSON-LD blocks
    }
  }
  return results;
}

/**
 * Extracts Popmenu / New World Tampa event cards & links from both Upcoming Events and Calendar views
 */
function extractNewWorldPopmenuEvents(html, venue) {
  const results = [];
  // Match individual /events/<slug> links rendered in New World Tampa's Popmenu page
  const cardRegex = /href=["']((?:https?:\/\/(?:www\.)?newworldtampa\.com)?\/events\/([a-z0-9-]+))["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = cardRegex.exec(html)) !== null) {
    const fullUrl = match[1].startsWith('http')
      ? match[1]
      : `https://www.newworldtampa.com${match[1]}`;
    const slug = match[2];
    const innerText = decodeHtml(match[3]);
    if (!innerText || innerText.length < 3 || slug === 'events') continue;

    // Look for a date pattern near the link or inside the card text
    const dateMatch = innerText.match(
      /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{1,2})(?:,?\s*(\d{4}))?/i
    );
    if (dateMatch) {
      const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
      const mIdx = monthNames.indexOf(dateMatch[1].slice(0, 3).toLowerCase());
      const day = parseInt(dateMatch[2], 10);
      const year = dateMatch[3] ? parseInt(dateMatch[3], 10) : mIdx >= 9 ? 2026 : 2027;
      if (mIdx !== -1 && day >= 1 && day <= 31) {
        const isoDate = `${year}-${String(mIdx + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        results.push({
          id: `newworld-${isoDate}-${slug.slice(0, 20)}`,
          title: innerText.replace(/\s+/g, ' ').slice(0, 110),
          venueId: 'newworld',
          date: isoDate,
          time: 'Check Event Page',
          stage: 'New World Tampa (Music Hall / Biergarten)',
          description: 'Extracted from New World Tampa Events & Calendar View.',
          url: fullUrl
        });
      }
    }
  }
  return results;
}

/**
 * Match an aggregator event's location name to one of our 19 Tampa Bay venue IDs
 */
function matchVenueId(locationName, venues) {
  const loc = String(locationName || '').toLowerCase();
  const matchRules = [
    { id: 'newworld', keywords: ['new world', 'skagway'] },
    { id: 'coppertail', keywords: ['coppertail'] },
    { id: 'orpheum', keywords: ['orpheum'] },
    { id: 'fergs', keywords: ["ferg's", 'fergs'] },
    { id: 'straz', keywords: ['straz', 'morsani', 'ferguson hall', 'jaeb'] },
    { id: 'baycaresound', keywords: ['baycare sound', 'coachman park'] },
    { id: 'capitoltheatre', keywords: ['capitol theatre', 'bilheimer'] },
    { id: 'rutheckerd', keywords: ['ruth eckerd', 'murray theatre'] },
    { id: 'benchmark', keywords: ['benchmark', 'amalie arena'] },
    { id: 'midflorida', keywords: ['midflorida', 'amphitheatre'] },
    { id: 'jannus', keywords: ['jannus'] },
    { id: 'ritzybor', keywords: ['ritz ybor', 'the ritz'] },
    { id: 'mahaffey', keywords: ['mahaffey'] },
    { id: 'yuengling', keywords: ['yuengling center'] },
    { id: 'skippers', keywords: ["skipper's", 'skippers smokehouse'] },
    { id: 'tampatheatre', keywords: ['tampa theatre'] },
    { id: 'hardrock', keywords: ['hard rock'] },
    { id: 'brassmug', keywords: ['brass mug'] },
    {
      id: 'localbreweries',
      keywords: ['bayboro', 'cage brewing', '3 daughters', 'dunedin brewery', 'shuffle', 'oscura', 'motorworks']
    }
  ];

  for (const rule of matchRules) {
    if (rule.keywords.some(k => loc.includes(k))) {
      return rule.id;
    }
  }
  return 'localbreweries';
}

async function fetchHtml(url, label) {
  try {
    console.log(`Fetching ${label} (${url})...`);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    });
    clearTimeout(timeout);
    if (!res.ok) {
      console.warn(`  [!] HTTP ${res.status} from ${label}`);
      return null;
    }
    return await res.text();
  } catch (err) {
    console.warn(`  [!] Could not reach ${label}: ${err.message}`);
    return null;
  }
}

async function runScraper() {
  const existing = loadExistingData();
  const venues = existing.venues || [];
  const aggregators = existing.aggregators || [];
  const eventMap = new Map();

  // Seed with existing dataset
  for (const ev of existing.events || []) {
    const key = `${ev.venueId}::${ev.date}::${ev.title.toLowerCase().slice(0, 22)}`;
    eventMap.set(key, ev);
  }

  // 1. Scrape all 19 Direct Venue Pages
  for (const venue of venues) {
    const html = await fetchHtml(venue.url, venue.name);
    if (!html) continue;
    const events = extractJsonLdEvents(html, venue);
    if (venue.id === 'newworld') {
      events.push(...extractNewWorldPopmenuEvents(html, venue));
    }
    console.log(`  [+] Extracted ${events.length} structured event(s) from ${venue.name}`);
    for (const ev of events) {
      const key = `${ev.venueId}::${ev.date}::${ev.title.toLowerCase().slice(0, 22)}`;
      if (!eventMap.has(key)) eventMap.set(key, ev);
    }
  }

  // 2. Scrape Regional Music Aggregators (Creative Loafing, JamBase, Songkick)
  for (const agg of aggregators) {
    const html = await fetchHtml(agg.url, agg.name);
    if (!html) continue;
    const rawEvents = extractJsonLdEvents(html, {
      id: 'localbreweries',
      name: agg.name,
      url: agg.url
    });
    console.log(`  [+] Extracted ${rawEvents.length} regional event(s) from ${agg.name}`);
    for (const ev of rawEvents) {
      ev.venueId = matchVenueId(ev.stage, venues);
      const key = `${ev.venueId}::${ev.date}::${ev.title.toLowerCase().slice(0, 22)}`;
      if (!eventMap.has(key)) eventMap.set(key, ev);
    }
  }

  const mergedEvents = Array.from(eventMap.values()).sort((a, b) =>
    a.date.localeCompare(b.date)
  );

  const updatedData = {
    lastUpdated: new Date().toISOString(),
    aggregators,
    venues,
    events: mergedEvents
  };

  const outPath = path.join(__dirname, 'events-data.js');
  const fileContent = `window.TAMPA_BAY_EVENTS_DATA = ${JSON.stringify(updatedData, null, 2)};\n`;
  fs.writeFileSync(outPath, fileContent, 'utf8');
  console.log(`\nSaved ${mergedEvents.length} total Tampa Bay live music events to events-data.js`);
  return updatedData;
}

if (require.main === module) {
  runScraper().catch(err => {
    console.error('Scraper error:', err);
    process.exit(1);
  });
}

module.exports = { runScraper };
