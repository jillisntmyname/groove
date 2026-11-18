(function () {
  const DATA = window.TAMPA_BAY_EVENTS_DATA || { venues: [], aggregators: [], events: [] };
  const venuesMap = new Map(DATA.venues.map(v => [v.id, v]));

  // State
  const today = new Date();
  const todayIsoDefault = formatIsoDate(today.getFullYear(), today.getMonth(), today.getDate());
  const state = {
    year: today.getFullYear(),
    month: today.getMonth(), // 0-indexed
    selectedDate: todayIsoDefault,
    activeVenues: new Set(DATA.venues.map(v => v.id)),
    searchQuery: '',
    freeOnly: false,
    viewMode: 'calendar' // 'calendar' | 'list'
  };

  // DOM Elements
  const venuesPanel = document.getElementById('venuesPanel');
  const mobileFilterToggleBtn = document.getElementById('mobileFilterToggleBtn');
  const activeVenueCountBadge = document.getElementById('activeVenueCountBadge');
  const mobilePreviewToggleBtn = document.getElementById('mobilePreviewToggleBtn');
  const quickPills = document.querySelectorAll('.quick-pill');

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
  const mobileDayAgenda = document.getElementById('mobileDayAgenda');
  const calendarViewWrapper = document.getElementById('calendarViewWrapper');
  const listViewWrapper = document.getElementById('listViewWrapper');
  const viewCalendarBtn = document.getElementById('viewCalendarBtn');
  const viewListBtn = document.getElementById('viewListBtn');
  const exportMonthIcsBtn = document.getElementById('exportMonthIcsBtn');
  const refreshLiveBtn = document.getElementById('refreshLiveBtn');
  const statsPill = document.getElementById('statsPill');

  // Mobile Bottom Nav Elements
  const navCalBtn = document.getElementById('navCalBtn');
  const navListBtn = document.getElementById('navListBtn');
  const navTonightBtn = document.getElementById('navTonightBtn');
  const navVenuesBtn = document.getElementById('navVenuesBtn');
  const navExportBtn = document.getElementById('navExportBtn');

  // Modal Elements
  const eventModal = document.getElementById('eventModal');
  const modalCloseBtn = document.getElementById('modalCloseBtn');
  const modalVenueTag = document.getElementById('modalVenueTag');
  const modalTitle = document.getElementById('modalTitle');
  const modalDate = document.getElementById('modalDate');
  const modalTime = document.getElementById('modalTime');
  const modalStage = document.getElementById('modalStage');
  const modalAddress = document.getElementById('modalAddress');
  const modalDirectionsLink = document.getElementById('modalDirectionsLink');
  const modalDescription = document.getElementById('modalDescription');
  const modalTicketLink = document.getElementById('modalTicketLink');
  const modalGoogleCalLink = document.getElementById('modalGoogleCalLink');
  const modalIcsBtn = document.getElementById('modalIcsBtn');
  const modalShareBtn = document.getElementById('modalShareBtn');

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
      if (state.freeOnly) {
        const freeHay = `${ev.title} ${ev.stage || ''} ${ev.description || ''}`.toLowerCase();
        if (!freeHay.includes('free') && !freeHay.includes('no cover') && !freeHay.includes('open mic')) {
          return false;
        }
      }
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

  // Render Venue Chips
  function renderVenueChips() {
    const monthPrefix = `${state.year}-${String(state.month + 1).padStart(2, '0')}-`;
    if (originalVenueChips) originalVenueChips.innerHTML = '';
    if (expandedVenueChips) expandedVenueChips.innerHTML = '';
    if (activeVenueCountBadge) activeVenueCountBadge.textContent = state.activeVenues.size;

    DATA.venues.forEach(venue => {
      const chip = createVenueChipElement(venue, monthPrefix);
      if (venue.group === 'original' && originalVenueChips) {
        originalVenueChips.appendChild(chip);
      } else if (expandedVenueChips) {
        expandedVenueChips.appendChild(chip);
      }
    });
  }

  // Render Mobile Selected Day Agenda
  function renderMobileDayAgenda(eventsByDate) {
    if (!mobileDayAgenda) return;
    const dayEvents = eventsByDate.get(state.selectedDate) || [];
    mobileDayAgenda.innerHTML = '';

    const header = document.createElement('div');
    header.className = 'agenda-header';
    header.innerHTML = `
      <div class="agenda-date-title">📅 ${formatDisplayDate(state.selectedDate)}</div>
      <span class="agenda-count-badge">${dayEvents.length} show${dayEvents.length === 1 ? '' : 's'}</span>
    `;
    mobileDayAgenda.appendChild(header);

    if (dayEvents.length === 0) {
      const empty = document.createElement('div');
      empty.style.cssText = 'color: var(--text-secondary); font-size: 0.85rem; padding: 0.85rem 0; text-align: center;';
      empty.textContent = 'No shows matching your current filters on this date. Tap another day with colored dots above!';
      mobileDayAgenda.appendChild(empty);
      return;
    }

    const cardsList = document.createElement('div');
    cardsList.className = 'agenda-cards';

    dayEvents.forEach(ev => {
      const venue = venuesMap.get(ev.venueId);
      const card = document.createElement('div');
      card.className = 'agenda-card';
      card.style.setProperty('--ev-color', venue ? venue.color : '#6366f1');

      card.innerHTML = `
        <div class="agenda-card-top">
          <span>${venue ? venue.name : ev.venueId}</span>
          <span class="agenda-card-time">${ev.time || 'TBA'}</span>
        </div>
        <div class="agenda-card-title">${ev.title}</div>
        <div class="agenda-card-stage">📍 ${ev.stage || (venue ? venue.city : '')}</div>
      `;

      card.addEventListener('click', () => openEventModal(ev));
      cardsList.appendChild(card);
    });

    mobileDayAgenda.appendChild(cardsList);
  }

  // Render Monthly Grid
  function renderCalendarGrid(filteredEvents) {
    daysGrid.innerHTML = '';
    const year = state.year;
    const month = state.month;

    const firstDayOfMonth = new Date(year, month, 1);
    const startWeekday = firstDayOfMonth.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const todayIso = formatIsoDate(today.getFullYear(), today.getMonth(), today.getDate());

    // Group events by date string
    const eventsByDate = new Map();
    for (const ev of filteredEvents) {
      if (!eventsByDate.has(ev.date)) eventsByDate.set(ev.date, []);
      eventsByDate.get(ev.date).push(ev);
    }

    // Ensure selectedDate falls in the currently viewed month if user navigated months
    const monthPrefix = `${year}-${String(month + 1).padStart(2, '0')}-`;
    if (!state.selectedDate.startsWith(monthPrefix)) {
      if (todayIso.startsWith(monthPrefix)) {
        state.selectedDate = todayIso;
      } else {
        // Pick first day in month that has events, or the 1st of the month
        const monthDatesWithEvents = Array.from(eventsByDate.keys())
          .filter(d => d.startsWith(monthPrefix))
          .sort();
        state.selectedDate = monthDatesWithEvents[0] || formatIsoDate(year, month, 1);
      }
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
      const isSelected = isoDate === state.selectedDate;
      const dayEvents = eventsByDate.get(isoDate) || [];

      const cell = document.createElement('div');
      cell.className = `day-cell ${isOutside ? 'outside-month' : ''} ${isToday ? 'today' : ''} ${isSelected ? 'mobile-selected' : ''}`;

      const header = document.createElement('div');
      header.className = 'day-header';
      header.innerHTML = `
        <span class="day-number">${dayNum}</span>
        ${isToday ? '<span class="today-tag">Today</span>' : dayEvents.length > 0 ? `<span class="day-count-label">${dayEvents.length} show${dayEvents.length > 1 ? 's' : ''}</span>` : ''}
      `;
      cell.appendChild(header);

      // Mobile color dots (up to 6 dots per cell)
      if (dayEvents.length > 0) {
        const dotsWrap = document.createElement('div');
        dotsWrap.className = 'mobile-day-dots';
        dayEvents.slice(0, 6).forEach(ev => {
          const venue = venuesMap.get(ev.venueId);
          const dot = document.createElement('span');
          dot.className = 'mobile-dot';
          dot.style.background = venue ? venue.color : '#6366f1';
          dotsWrap.appendChild(dot);
        });
        cell.appendChild(dotsWrap);
      }

      // Desktop full event pills
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

        pill.addEventListener('click', e => {
          e.stopPropagation();
          openEventModal(ev);
        });
        eventsContainer.appendChild(pill);
      });

      cell.appendChild(eventsContainer);

      // Clicking a day cell selects it on mobile and updates the agenda below
      cell.addEventListener('click', () => {
        state.selectedDate = isoDate;
        renderCalendarGrid(filteredEvents);
      });

      daysGrid.appendChild(cell);
    }

    renderMobileDayAgenda(eventsByDate);
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
    const addr = venue ? venue.address : 'Tampa Bay, FL';
    modalAddress.textContent = addr;
    if (modalDirectionsLink) {
      modalDirectionsLink.href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        (venue ? venue.name + ' ' : '') + addr
      )}`;
    }
    modalDescription.textContent = ev.description || '';

    const targetUrl = ev.url || (venue ? venue.url : '#');
    modalTicketLink.href = targetUrl;
    modalGoogleCalLink.href = buildGoogleCalendarUrl(ev);

    modalIcsBtn.onclick = () => {
      const ics = generateIcsContent([ev]);
      downloadIcsFile(`${ev.id}.ics`, ics);
    };

    if (modalShareBtn) {
      modalShareBtn.onclick = async () => {
        const shareData = {
          title: `${ev.title} @ ${venue ? venue.shortName : 'Tampa Bay'}`,
          text: `${ev.title} on ${formatDisplayDate(ev.date)} (${ev.time || ''}) at ${venue ? venue.name : ''}`,
          url: targetUrl
        };
        if (navigator.share) {
          try {
            await navigator.share(shareData);
          } catch (_) {}
        } else if (navigator.clipboard) {
          await navigator.clipboard.writeText(`${shareData.text} - ${shareData.url}`);
          modalShareBtn.textContent = '✓ Link Copied!';
          setTimeout(() => {
            modalShareBtn.textContent = '📤 Share Show';
          }, 1800);
        }
      };
    }

    eventModal.classList.add('open');
  }

  function closeEventModal() {
    eventModal.classList.remove('open');
  }

  function setViewMode(mode) {
    state.viewMode = mode;
    const isCal = mode === 'calendar';
    viewCalendarBtn.classList.toggle('active', isCal);
    viewListBtn.classList.toggle('active', !isCal);
    calendarViewWrapper.classList.toggle('hidden', !isCal);
    listViewWrapper.classList.toggle('active', !isCal);
    if (navCalBtn) navCalBtn.classList.toggle('active', isCal);
    if (navListBtn) navListBtn.classList.toggle('active', !isCal);
  }

  function renderAll() {
    monthTitle.textContent = `${MONTH_NAMES[state.month]} ${state.year}`;
    const filteredEvents = getFilteredEvents();
    const monthEvents = getMonthEvents(filteredEvents, state.year, state.month);

    statsPill.innerHTML = `<strong>${monthEvents.length}</strong> show${monthEvents.length === 1 ? '' : 's'} in <strong>${MONTH_NAMES[state.month]}</strong> (${state.activeVenues.size} venues)`;

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

  function jumpToToday() {
    state.year = today.getFullYear();
    state.month = today.getMonth();
    state.selectedDate = formatIsoDate(today.getFullYear(), today.getMonth(), today.getDate());
    renderAll();
  }

  todayBtn.addEventListener('click', jumpToToday);

  // Mobile Venues Drawer Toggle
  if (mobileFilterToggleBtn && venuesPanel) {
    mobileFilterToggleBtn.addEventListener('click', () => {
      const isOpen = venuesPanel.classList.toggle('mobile-open');
      mobileFilterToggleBtn.setAttribute('aria-expanded', String(isOpen));
      if (navVenuesBtn) navVenuesBtn.classList.toggle('active', isOpen);
    });
  }

  // Desktop "📱 Phone View" Simulator Toggle
  if (mobilePreviewToggleBtn) {
    mobilePreviewToggleBtn.addEventListener('click', () => {
      const isPhone = document.body.classList.toggle('phone-preview-mode');
      mobilePreviewToggleBtn.textContent = isPhone ? '🖥️ Desktop View' : '📱 Phone View';
      renderAll();
    });
  }

  // Mobile Quick Horizontal Filter Pills
  quickPills.forEach(pill => {
    pill.addEventListener('click', () => {
      quickPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      const mode = pill.getAttribute('data-quick');
      state.freeOnly = false;

      if (mode === 'all') {
        DATA.venues.forEach(v => state.activeVenues.add(v.id));
      } else if (mode === 'original') {
        state.activeVenues.clear();
        DATA.venues.filter(v => v.group === 'original').forEach(v => state.activeVenues.add(v.id));
      } else if (mode === 'free') {
        DATA.venues.forEach(v => state.activeVenues.add(v.id));
        state.freeOnly = true;
      } else {
        state.activeVenues.clear();
        DATA.venues.forEach(v => {
          const reg = `${v.region || ''} ${v.city || ''}`.toLowerCase();
          if (reg.includes(mode) || v.id === 'localbreweries') {
            state.activeVenues.add(v.id);
          }
        });
      }
      renderAll();
    });
  });

  selectAllVenuesBtn.addEventListener('click', () => {
    state.freeOnly = false;
    DATA.venues.forEach(v => state.activeVenues.add(v.id));
    renderAll();
  });

  if (selectOriginalVenuesBtn) {
    selectOriginalVenuesBtn.addEventListener('click', () => {
      state.freeOnly = false;
      state.activeVenues.clear();
      DATA.venues.filter(v => v.group === 'original').forEach(v => state.activeVenues.add(v.id));
      renderAll();
    });
  }

  regionFilterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      state.freeOnly = false;
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

  viewCalendarBtn.addEventListener('click', () => setViewMode('calendar'));
  viewListBtn.addEventListener('click', () => setViewMode('list'));

  function exportCurrentMonthIcs() {
    const filtered = getFilteredEvents();
    const monthEvents = getMonthEvents(filtered, state.year, state.month);
    if (monthEvents.length === 0) {
      alert('No events in this month to export.');
      return;
    }
    const ics = generateIcsContent(monthEvents);
    const monthSlug = `${MONTH_NAMES[state.month].toLowerCase()}-${state.year}`;
    downloadIcsFile(`tampa-bay-shows-${monthSlug}.ics`, ics);
  }

  exportMonthIcsBtn.addEventListener('click', exportCurrentMonthIcs);

  // Mobile Bottom Nav Handlers
  if (navCalBtn) {
    navCalBtn.addEventListener('click', () => {
      if (venuesPanel) venuesPanel.classList.remove('mobile-open');
      if (navVenuesBtn) navVenuesBtn.classList.remove('active');
      setViewMode('calendar');
    });
  }
  if (navListBtn) {
    navListBtn.addEventListener('click', () => {
      if (venuesPanel) venuesPanel.classList.remove('mobile-open');
      if (navVenuesBtn) navVenuesBtn.classList.remove('active');
      setViewMode('list');
    });
  }
  if (navTonightBtn) {
    navTonightBtn.addEventListener('click', () => {
      if (venuesPanel) venuesPanel.classList.remove('mobile-open');
      if (navVenuesBtn) navVenuesBtn.classList.remove('active');
      setViewMode('calendar');
      jumpToToday();
      if (mobileDayAgenda) {
        mobileDayAgenda.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    });
  }
  if (navVenuesBtn && venuesPanel) {
    navVenuesBtn.addEventListener('click', () => {
      const isOpen = venuesPanel.classList.toggle('mobile-open');
      navVenuesBtn.classList.toggle('active', isOpen);
      if (isOpen) {
        venuesPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  }
  if (navExportBtn) {
    navExportBtn.addEventListener('click', exportCurrentMonthIcs);
  }

  if (refreshLiveBtn) {
    refreshLiveBtn.addEventListener('click', async () => {
      const originalText = refreshLiveBtn.textContent;
      refreshLiveBtn.textContent = 'Syncing...';
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
