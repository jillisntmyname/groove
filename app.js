(function () {
  const DATA = window.TAMPA_BAY_EVENTS_DATA || { venues: [], aggregators: [], events: [] };
  const venuesMap = new Map(DATA.venues.map(v => [v.id, v]));

  // State
  const today = new Date();
  const state = {
    year: today.getFullYear(),
    month: today.getMonth(), // 0-indexed
    activeVenues: new Set(DATA.venues.map(v => v.id)),
    searchQuery: '',
    viewMode: 'calendar' // 'calendar' | 'list'
  };

  // DOM Elements
  const originalVenueChips = document.getElementById('originalVenueChips');
  const expandedVenueChips = document.getElementById('expandedVenueChips');
  const aggregatorLinks = document.getElementById('aggregatorLinks');
  const selectAllVenuesBtn = document.getElementById('selectAllVenuesBtn');
  const selectOriginalVenuesBtn = document.getElementById('selectOriginalVenuesBtn');
  const clearVenuesBtn = document.getElementById('clearVenuesBtn');
  const regionFilterBtns = document.querySelectorAll('.region-filter-btn');
  const searchInput = document.getElementById('searchInput');
  const clearSearchBtn = document.getElementById('clearSearchBtn');
  const prevMonthBtn = document.getElementById('prevMonthBtn');
  const nextMonthBtn = document.getElementById('nextMonthBtn');
  const todayBtn = document.getElementById('todayBtn');
  const monthTitle = document.getElementById('monthTitle');
  const daysGrid = document.getElementById('daysGrid');
  const calendarViewWrapper = document.getElementById('calendarViewWrapper');
  const listViewWrapper = document.getElementById('listViewWrapper');
  const viewCalendarBtn = document.getElementById('viewCalendarBtn');
  const viewListBtn = document.getElementById('viewListBtn');
  const exportMonthIcsBtn = document.getElementById('exportMonthIcsBtn');
  const refreshLiveBtn = document.getElementById('refreshLiveBtn');
  const statsPill = document.getElementById('statsPill');

  // Modal Elements
  const eventModal = document.getElementById('eventModal');
  const modalCloseBtn = document.getElementById('modalCloseBtn');
  const modalVenueTag = document.getElementById('modalVenueTag');
  const modalTitle = document.getElementById('modalTitle');
  const modalDate = document.getElementById('modalDate');
  const modalTime = document.getElementById('modalTime');
  const modalStage = document.getElementById('modalStage');
  const modalAddress = document.getElementById('modalAddress');
  const modalDescription = document.getElementById('modalDescription');
  const modalTicketLink = document.getElementById('modalTicketLink');
  const modalGoogleCalLink = document.getElementById('modalGoogleCalLink');
  const modalIcsBtn = document.getElementById('modalIcsBtn');

  const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  function formatIsoDate(year, month, day) {
    const mm = String(month + 1).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    return `${year}-${mm}-${dd}`;
  }

  function formatDisplayDate(isoDate) {
    const [y, m, d] = isoDate.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    return dt.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  }

  function getFilteredEvents() {
    const q = state.searchQuery.trim().toLowerCase();
    return DATA.events.filter(ev => {
      if (!state.activeVenues.has(ev.venueId)) return false;
      if (q) {
        const venue = venuesMap.get(ev.venueId);
        const hay = `${ev.title} ${ev.description || ''} ${ev.stage || ''} ${venue ? venue.name + ' ' + venue.city : ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }

  function getMonthEvents(filteredEvents, year, month) {
    const prefix = `${year}-${String(month + 1).padStart(2, '0')}-`;
    return filteredEvents.filter(ev => ev.date.startsWith(prefix));
  }

  function renderAggregators() {
    if (!aggregatorLinks || !DATA.aggregators) return;
    aggregatorLinks.innerHTML = '';
    DATA.aggregators.forEach(agg => {
      const a = document.createElement('a');
      a.href = agg.url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.className = 'aggregator-pill';
      a.title = agg.description;
      a.textContent = `${agg.name} ↗`;
      aggregatorLinks.appendChild(a);
    });
  }

  function createVenueChipElement(venue, monthPrefix) {
    const isActive = state.activeVenues.has(venue.id);
    const countInMonth = DATA.events.filter(
      e => e.venueId === venue.id && e.date.startsWith(monthPrefix)
    ).length;

    const chip = document.createElement('div');
    chip.className = `venue-chip ${isActive ? 'active' : ''}`;
    chip.style.setProperty('--chip-color', venue.color);
    chip.style.setProperty('--chip-bg', venue.bg);
    chip.style.setProperty('--chip-border', venue.border);

    chip.innerHTML = `
      <div class="venue-chip-left">
        <span class="venue-dot"></span>
        <div class="venue-chip-info">
          <span class="venue-chip-name" title="${venue.name}">${venue.shortName}</span>
          <span class="venue-chip-city">${venue.city}</span>
        </div>
      </div>
      <div class="venue-chip-right">
        <span class="venue-count-badge" title="${countInMonth} events this month">${countInMonth}</span>
        <a href="${venue.url}" target="_blank" rel="noopener noreferrer" class="venue-ext-link" title="Open ${venue.name} Official Events Page" onclick="event.stopPropagation()">↗</a>
      </div>
    `;

    chip.addEventListener('click', () => {
      if (state.activeVenues.has(venue.id)) {
        state.activeVenues.delete(venue.id);
      } else {
        state.activeVenues.add(venue.id);
      }
      renderAll();
    });

    return chip;
  }

  // Render Venue Chips (Split into Original 8 and Expanded Venues)
  function renderVenueChips() {
    const monthPrefix = `${state.year}-${String(state.month + 1).padStart(2, '0')}-`;
    if (originalVenueChips) originalVenueChips.innerHTML = '';
    if (expandedVenueChips) expandedVenueChips.innerHTML = '';

    DATA.venues.forEach(venue => {
      const chip = createVenueChipElement(venue, monthPrefix);
      if (venue.group === 'original' && originalVenueChips) {
        originalVenueChips.appendChild(chip);
      } else if (expandedVenueChips) {
        expandedVenueChips.appendChild(chip);
      }
    });
  }

  // Render Monthly Grid
  function renderCalendarGrid(filteredEvents) {
    daysGrid.innerHTML = '';
    const year = state.year;
    const month = state.month;

    const firstDayOfMonth = new Date(year, month, 1);
    const startWeekday = firstDayOfMonth.getDay(); // 0 (Sun) - 6 (Sat)
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const todayIso = formatIsoDate(today.getFullYear(), today.getMonth(), today.getDate());

    // Group events by date string
    const eventsByDate = new Map();
    for (const ev of filteredEvents) {
      if (!eventsByDate.has(ev.date)) eventsByDate.set(ev.date, []);
      eventsByDate.get(ev.date).push(ev);
    }

    const totalCells = Math.ceil((startWeekday + daysInMonth) / 7) * 7;

    for (let i = 0; i < totalCells; i++) {
      let cellYear = year;
      let cellMonth = month;
      let dayNum = i - startWeekday + 1;
      let isOutside = false;

      if (dayNum < 1) {
        isOutside = true;
        cellMonth = month - 1;
        if (cellMonth < 0) {
          cellMonth = 11;
          cellYear = year - 1;
        }
        dayNum = daysInPrevMonth + dayNum;
      } else if (dayNum > daysInMonth) {
        isOutside = true;
        dayNum = dayNum - daysInMonth;
        cellMonth = month + 1;
        if (cellMonth > 11) {
          cellMonth = 0;
          cellYear = year + 1;
        }
      }

      const isoDate = formatIsoDate(cellYear, cellMonth, dayNum);
      const isToday = isoDate === todayIso;
      const dayEvents = eventsByDate.get(isoDate) || [];

      const cell = document.createElement('div');
      cell.className = `day-cell ${isOutside ? 'outside-month' : ''} ${isToday ? 'today' : ''}`;

      const header = document.createElement('div');
      header.className = 'day-header';
      header.innerHTML = `
        <span class="day-number">${dayNum}</span>
        ${isToday ? '<span class="today-tag">Today</span>' : dayEvents.length > 0 ? `<span style="font-size:0.65rem;color:var(--text-muted);">${dayEvents.length} show${dayEvents.length > 1 ? 's' : ''}</span>` : ''}
      `;
      cell.appendChild(header);

      const eventsContainer = document.createElement('div');
      eventsContainer.className = 'day-events';

      dayEvents.forEach(ev => {
        const venue = venuesMap.get(ev.venueId);
        const pill = document.createElement('button');
        pill.type = 'button';
        pill.className = 'event-pill';
        pill.style.setProperty('--ev-color', venue ? venue.color : '#6366f1');
        pill.style.setProperty('--ev-bg', venue ? venue.bg : 'rgba(99, 102, 241, 0.15)');

        pill.innerHTML = `
          <div class="event-pill-venue">
            <span>${venue ? venue.shortName : ev.venueId}</span>
            <span class="event-pill-time">${ev.time || ''}</span>
          </div>
          <div class="event-pill-title">${ev.title}</div>
        `;

        pill.addEventListener('click', () => openEventModal(ev));
        eventsContainer.appendChild(pill);
      });

      cell.appendChild(eventsContainer);
      daysGrid.appendChild(cell);
    }
  }

  // Render List View
  function renderListView(monthEvents) {
    listViewWrapper.innerHTML = '';

    if (monthEvents.length === 0) {
      listViewWrapper.innerHTML = `
        <div class="empty-state">
          <h3>No matching shows found in ${MONTH_NAMES[state.month]} ${state.year}</h3>
          <p>Try clearing your search filter, enabling more venues, or switching to another month.</p>
        </div>
      `;
      return;
    }

    const sorted = [...monthEvents].sort((a, b) => a.date.localeCompare(b.date));
    const groups = new Map();
    for (const ev of sorted) {
      if (!groups.has(ev.date)) groups.set(ev.date, []);
      groups.get(ev.date).push(ev);
    }

    for (const [dateStr, events] of groups.entries()) {
      const groupEl = document.createElement('div');
      groupEl.className = 'list-date-group';

      const headerEl = document.createElement('div');
      headerEl.className = 'list-date-header';
      headerEl.innerHTML = `
        <span>${formatDisplayDate(dateStr)}</span>
        <span style="color: var(--text-secondary); font-size: 0.8rem;">${events.length} show${events.length === 1 ? '' : 's'}</span>
      `;
      groupEl.appendChild(headerEl);

      events.forEach(ev => {
        const venue = venuesMap.get(ev.venueId);
        const row = document.createElement('div');
        row.className = 'list-event-row';
        row.style.setProperty('--ev-color', venue ? venue.color : '#6366f1');

        row.innerHTML = `
          <div class="list-event-main">
            <div class="list-venue-badge">
              <span class="venue-dot" style="background:${venue ? venue.color : '#6366f1'}"></span>
              <span>${venue ? venue.name : ev.venueId}</span>
              <span style="color: var(--text-muted)">•</span>
              <span style="color: var(--text-secondary)">${ev.time || 'TBA'}</span>
              ${ev.stage ? `<span style="color: var(--text-muted)">• ${ev.stage}</span>` : ''}
            </div>
            <div class="list-event-title">${ev.title}</div>
            <div class="list-event-desc">${ev.description || ''}</div>
          </div>
          <div class="list-event-actions">
            <button type="button" class="btn btn-sm details-btn">Details & Calendar</button>
            <a href="${ev.url || (venue && venue.url)}" target="_blank" rel="noopener noreferrer" class="btn btn-sm btn-primary">Tickets / Venue ↗</a>
          </div>
        `;

        row.querySelector('.details-btn').addEventListener('click', () => openEventModal(ev));
        groupEl.appendChild(row);
      });

      listViewWrapper.appendChild(groupEl);
    }
  }

  // Google Calendar & iCal Export Helpers
  function parseEventDateTime(isoDate, timeStr) {
    const [y, m, d] = isoDate.split('-').map(Number);
    let hours = 19;
    let minutes = 30;

    if (timeStr) {
      const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
      if (match) {
        hours = parseInt(match[1], 10);
        minutes = parseInt(match[2], 10);
        const period = match[3].toUpperCase();
        if (period === 'PM' && hours < 12) hours += 12;
        if (period === 'AM' && hours === 12) hours = 0;
      }
    }

    const pad = n => String(n).padStart(2, '0');
    const startLocal = `${y}${pad(m)}${pad(d)}T${pad(hours)}${pad(minutes)}00`;
    const endHours = Math.min(hours + 3, 23);
    const endLocal = `${y}${pad(m)}${pad(d)}T${pad(endHours)}${pad(minutes)}00`;
    return { startLocal, endLocal };
  }

  function buildGoogleCalendarUrl(ev) {
    const venue = venuesMap.get(ev.venueId);
    const { startLocal, endLocal } = parseEventDateTime(ev.date, ev.time);
    const title = `${ev.title} @ ${venue ? venue.shortName : ''}`;
    const details = `${ev.description || ''}\n\nVenue Events Page: ${ev.url || (venue && venue.url)}`;
    const location = venue ? `${venue.name}, ${venue.address}` : 'Tampa Bay, FL';

    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: title,
      dates: `${startLocal}/${endLocal}`,
      details: details,
      location: location,
      ctz: 'America/New_York'
    });
    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  }

  function generateIcsContent(eventsList) {
    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Tampa Bay Live Music Calendar//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH'
    ];

    eventsList.forEach(ev => {
      const venue = venuesMap.get(ev.venueId);
      const { startLocal, endLocal } = parseEventDateTime(ev.date, ev.time);
      const location = venue ? `${venue.name}, ${venue.address}` : 'Tampa Bay, FL';
      const summary = `${ev.title} (${venue ? venue.shortName : ''})`.replace(/[,;]/g, ' ');
      const desc = `${ev.description || ''} - Link: ${ev.url || ''}`.replace(/\r?\n/g, ' ');

      lines.push(
        'BEGIN:VEVENT',
        `UID:${ev.id}@tampabaymusiccalendar.local`,
        `DTSTAMP:${startLocal}Z`,
        `DTSTART;TZID=America/New_York:${startLocal}`,
        `DTEND;TZID=America/New_York:${endLocal}`,
        `SUMMARY:${summary}`,
        `DESCRIPTION:${desc}`,
        `LOCATION:${location.replace(/[,;]/g, ' ')}`,
        `URL:${ev.url || (venue && venue.url) || ''}`,
        'END:VEVENT'
      );
    });

    lines.push('END:VCALENDAR');
    return lines.join('\r\n');
  }

  function downloadIcsFile(filename, content) {
    const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // Modal Handler
  function openEventModal(ev) {
    const venue = venuesMap.get(ev.venueId);

    modalVenueTag.textContent = venue ? `${venue.name} • ${venue.city}` : ev.venueId;
    modalVenueTag.style.background = venue ? venue.bg : 'rgba(99,102,241,0.2)';
    modalVenueTag.style.color = venue ? venue.color : '#818cf8';
    modalVenueTag.style.border = `1px solid ${venue ? venue.border : 'transparent'}`;

    modalTitle.textContent = ev.title;
    modalDate.textContent = formatDisplayDate(ev.date);
    modalTime.textContent = ev.time || 'Check Venue Page';
    modalStage.textContent = ev.stage || (venue ? venue.name : '');
    modalAddress.textContent = venue ? venue.address : 'Tampa Bay, FL';
    modalDescription.textContent = ev.description || '';

    modalTicketLink.href = ev.url || (venue ? venue.url : '#');
    modalGoogleCalLink.href = buildGoogleCalendarUrl(ev);

    modalIcsBtn.onclick = () => {
      const ics = generateIcsContent([ev]);
      downloadIcsFile(`${ev.id}.ics`, ics);
    };

    eventModal.classList.add('open');
  }

  function closeEventModal() {
    eventModal.classList.remove('open');
  }

  function renderAll() {
    monthTitle.textContent = `${MONTH_NAMES[state.month]} ${state.year}`;
    const filteredEvents = getFilteredEvents();
    const monthEvents = getMonthEvents(filteredEvents, state.year, state.month);

    statsPill.innerHTML = `Showing <strong>${monthEvents.length}</strong> show${monthEvents.length === 1 ? '' : 's'} in <strong>${MONTH_NAMES[state.month]}</strong> (${filteredEvents.length} total across ${state.activeVenues.size} venues)`;

    renderVenueChips();
    renderCalendarGrid(filteredEvents);
    renderListView(monthEvents);
  }

  // Event Listeners
  prevMonthBtn.addEventListener('click', () => {
    state.month--;
    if (state.month < 0) {
      state.month = 11;
      state.year--;
    }
    renderAll();
  });

  nextMonthBtn.addEventListener('click', () => {
    state.month++;
    if (state.month > 11) {
      state.month = 0;
      state.year++;
    }
    renderAll();
  });

  todayBtn.addEventListener('click', () => {
    state.year = today.getFullYear();
    state.month = today.getMonth();
    renderAll();
  });

  selectAllVenuesBtn.addEventListener('click', () => {
    DATA.venues.forEach(v => state.activeVenues.add(v.id));
    renderAll();
  });

  if (selectOriginalVenuesBtn) {
    selectOriginalVenuesBtn.addEventListener('click', () => {
      state.activeVenues.clear();
      DATA.venues.filter(v => v.group === 'original').forEach(v => state.activeVenues.add(v.id));
      renderAll();
    });
  }

  regionFilterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetRegion = btn.getAttribute('data-region').toLowerCase();
      state.activeVenues.clear();
      DATA.venues.forEach(v => {
        const reg = `${v.region || ''} ${v.city || ''}`.toLowerCase();
        if (reg.includes(targetRegion) || v.id === 'localbreweries') {
          state.activeVenues.add(v.id);
        }
      });
      renderAll();
    });
  });

  clearVenuesBtn.addEventListener('click', () => {
    state.activeVenues.clear();
    renderAll();
  });

  searchInput.addEventListener('input', e => {
    state.searchQuery = e.target.value;
    clearSearchBtn.classList.toggle('visible', state.searchQuery.length > 0);
    renderAll();
  });

  clearSearchBtn.addEventListener('click', () => {
    searchInput.value = '';
    state.searchQuery = '';
    clearSearchBtn.classList.remove('visible');
    renderAll();
  });

  viewCalendarBtn.addEventListener('click', () => {
    state.viewMode = 'calendar';
    viewCalendarBtn.classList.add('active');
    viewListBtn.classList.remove('active');
    calendarViewWrapper.classList.remove('hidden');
    listViewWrapper.classList.remove('active');
  });

  viewListBtn.addEventListener('click', () => {
    state.viewMode = 'list';
    viewListBtn.classList.add('active');
    viewCalendarBtn.classList.remove('active');
    calendarViewWrapper.classList.add('hidden');
    listViewWrapper.classList.add('active');
  });

  exportMonthIcsBtn.addEventListener('click', () => {
    const filtered = getFilteredEvents();
    const monthEvents = getMonthEvents(filtered, state.year, state.month);
    if (monthEvents.length === 0) {
      alert('No events in this month to export.');
      return;
    }
    const ics = generateIcsContent(monthEvents);
    const monthSlug = `${MONTH_NAMES[state.month].toLowerCase()}-${state.year}`;
    downloadIcsFile(`tampa-bay-shows-${monthSlug}.ics`, ics);
  });

  if (refreshLiveBtn) {
    refreshLiveBtn.addEventListener('click', async () => {
      const originalText = refreshLiveBtn.textContent;
      refreshLiveBtn.textContent = 'Syncing All Sources...';
      refreshLiveBtn.disabled = true;
      try {
        const res = await fetch('/api/refresh', { method: 'POST' });
        if (!res.ok) throw new Error('Local server not running');
        const json = await res.json();
        if (json.ok && json.data) {
          DATA.events = json.data.events;
          renderAll();
          refreshLiveBtn.textContent = '✓ Synced!';
        }
      } catch (_) {
        alert(
          'Live multi-source scrape runs via `node scraper.js` locally or automatically every morning via GitHub Actions when hosted online.'
        );
        refreshLiveBtn.textContent = originalText;
      } finally {
        setTimeout(() => {
          refreshLiveBtn.textContent = originalText;
          refreshLiveBtn.disabled = false;
        }, 2200);
      }
    });
  }

  modalCloseBtn.addEventListener('click', closeEventModal);
  eventModal.addEventListener('click', e => {
    if (e.target === eventModal) closeEventModal();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeEventModal();
  });

  // Initial render
  renderAggregators();
  renderAll();
})();
