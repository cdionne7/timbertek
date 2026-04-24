/* Yearly planner with two-way Google Calendar sync.
 *
 * All code runs client-side. Sign-in uses Google Identity Services (GIS) with an
 * OAuth 2.0 Client ID the user configures once. Events are read and written with
 * plain fetch() calls against the Calendar API v3 using the issued access token.
 *
 * Model: one "primary" event per day per cell. If Google returns multiple events
 * for a day, the cell shows the first and a "+N" badge — editing updates the first.
 */

(() => {
  "use strict";

  const CAL_API = "https://www.googleapis.com/calendar/v3";
  const SCOPES = "https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.readonly";
  const LS_CLIENT_ID = "ttek.calendar.clientId";
  const LS_CAL_ID = "ttek.calendar.calendarId";
  const LS_YEAR = "ttek.calendar.year";
  const LS_DEMO_PREFIX = "ttek.calendar.demo.";

  // Sample entries mirroring the spreadsheet screenshot so the page has
  // something to show before Google sign-in. Keyed as { monthIdx: { day: text } }.
  const DEMO_EVENTS = {
    0: { // January
      1: "Family lunch", 3: "Team meeting", 4: "Birthday — text here",
      6: "Kids return to school", 7: "Payday", 8: "Sarah's b-day — cake",
      10: "Pay rent", 11: "Birthday party", 12: "Call grandma",
      15: "Jake's birthday", 18: "Grocery shopping", 20: "Internal training",
    },
    1: { // February
      5: "Vacation", 9: "Family picnic", 11: "Doctor check-up",
      13: "Bill payment", 17: "Grocery shopping", 22: "Weekend getaway",
    },
    2: { // March
      4: "Team meeting", 6: "Anniversary", 7: "Payday",
      11: "Dad's birthday", 13: "Public holiday", 17: "St. Patrick's Day",
    },
    3: { 15: "Taxes due", 22: "Earth Day" },
    4: { 10: "Mother's Day" },
    5: { 21: "Father's Day" },
    6: { 4: "Independence Day" },
    9: { 31: "Halloween" },
    10: { 26: "Thanksgiving" },
    11: { 24: "Christmas Eve", 25: "Christmas", 31: "New Year's Eve" },
  };

  const MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const state = {
    year: new Date().getFullYear(),
    clientId: localStorage.getItem(LS_CLIENT_ID) || "",
    calendarId: localStorage.getItem(LS_CAL_ID) || "",
    accessToken: null,
    tokenExpiresAt: 0,
    tokenClient: null,
    /** Map of "YYYY-MM-DD" -> array of event objects for that day. */
    eventsByDate: new Map(),
    /** Per-cell save timers, keyed by ISO date. */
    saveTimers: new Map(),
  };

  // --- DOM refs -----------------------------------------------------------
  const el = {
    yearGrid: document.getElementById("yearGrid"),
    yearSelect: document.getElementById("yearSelect"),
    calendarSelect: document.getElementById("calendarSelect"),
    connectBtn: document.getElementById("connectBtn"),
    configBtn: document.getElementById("configBtn"),
    refreshBtn: document.getElementById("refreshBtn"),
    signOutBtn: document.getElementById("signOutBtn"),
    statusDot: document.getElementById("statusDot"),
    statusText: document.getElementById("statusText"),
    note: document.getElementById("plannerNote"),
    configModal: document.getElementById("configModal"),
    clientIdInput: document.getElementById("clientIdInput"),
    saveConfigBtn: document.getElementById("saveConfigBtn"),
    footerYear: document.getElementById("year"),
  };

  // --- Utilities ----------------------------------------------------------
  function pad2(n) { return n < 10 ? "0" + n : "" + n; }
  function isoDate(y, m, d) { return `${y}-${pad2(m + 1)}-${pad2(d)}`; }
  function daysInMonth(y, m) { return new Date(y, m + 1, 0).getDate(); }
  function addDaysISO(iso, days) {
    const [y, m, d] = iso.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d + days));
    return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`;
  }

  function setStatus(kind, text) {
    el.statusDot.className = "status-dot status-" + kind;
    el.statusText.textContent = text;
  }

  function setConnectedUI(connected) {
    el.connectBtn.textContent = connected ? "Reconnect" : "Connect Google Calendar";
    el.calendarSelect.disabled = !connected;
    el.refreshBtn.disabled = !connected;
    el.signOutBtn.disabled = !connected;
    // Inputs stay enabled in demo mode so the page is usable without sign-in.
    const inputs = el.yearGrid.querySelectorAll(".day-input");
    inputs.forEach((i) => { i.disabled = false; });
    if (connected) {
      el.note.innerHTML = `<strong>Connected.</strong> Edits write straight to your
        Google Calendar. Switch calendar or year from the toolbar above.`;
    } else {
      el.note.innerHTML = `<strong>Demo mode.</strong> Tap a day to edit — changes
        are saved only in this browser. To make it real, click
        <em>Connect Google Calendar</em> and edits will sync two-way.`;
    }
    el.note.classList.remove("is-hidden");
  }

  // --- Demo storage -------------------------------------------------------
  function demoKey(year) { return LS_DEMO_PREFIX + year; }
  function loadDemoOverrides(year) {
    try { return JSON.parse(localStorage.getItem(demoKey(year)) || "{}"); }
    catch { return {}; }
  }
  function saveDemoOverrides(year, map) {
    localStorage.setItem(demoKey(year), JSON.stringify(map));
  }
  function buildDemoEventsForYear(year) {
    const overrides = loadDemoOverrides(year);
    const map = new Map();
    // Seed defaults first
    for (const [mIdx, days] of Object.entries(DEMO_EVENTS)) {
      for (const [d, summary] of Object.entries(days)) {
        const iso = isoDate(year, Number(mIdx), Number(d));
        map.set(iso, [{ id: "demo:" + iso, summary, __demo: true }]);
      }
    }
    // Overrides wipe/replace defaults for that date
    for (const [iso, summary] of Object.entries(overrides)) {
      if (summary) map.set(iso, [{ id: "demo:" + iso, summary, __demo: true }]);
      else map.delete(iso);
    }
    return map;
  }

  // --- Year grid rendering ------------------------------------------------
  function renderYear(year) {
    state.year = year;
    el.yearGrid.innerHTML = "";
    const todayISO = (() => {
      const t = new Date();
      return isoDate(t.getFullYear(), t.getMonth(), t.getDate());
    })();

    for (let m = 0; m < 12; m++) {
      const card = document.createElement("article");
      card.className = "month-card";

      const head = document.createElement("header");
      head.className = "month-head";
      head.innerHTML = `<h3 class="month-name">${MONTHS[m]}</h3><span class="month-year">${year}</span>`;
      card.appendChild(head);

      const list = document.createElement("ol");
      list.className = "day-list";

      const totalDays = daysInMonth(year, m);
      for (let d = 1; d <= totalDays; d++) {
        const dt = new Date(year, m, d);
        const dow = dt.getDay();
        const iso = isoDate(year, m, d);
        const row = document.createElement("li");
        row.className = "day-row";
        row.dataset.date = iso;
        if (dow === 0 || dow === 6) row.classList.add("is-weekend");
        if (iso === todayISO) row.classList.add("is-today");

        row.innerHTML = `
          <span class="day-num">${d}</span>
          <span class="day-dow">${DOW[dow]}</span>
          <input type="text" class="day-input" aria-label="Event on ${MONTHS[m]} ${d}, ${year}" placeholder="" disabled />
        `;
        const input = row.querySelector(".day-input");
        input.addEventListener("input", onCellInput);
        input.addEventListener("blur", onCellBlur);
        input.addEventListener("keydown", (ev) => {
          if (ev.key === "Enter") { ev.preventDefault(); input.blur(); }
          if (ev.key === "Escape") {
            const orig = input.dataset.original || "";
            input.value = orig;
            input.blur();
          }
        });
        list.appendChild(row);
      }

      card.appendChild(list);
      el.yearGrid.appendChild(card);
    }

    // If not signed in, populate with demo data so the page is immediately usable.
    if (!state.accessToken) {
      state.eventsByDate = buildDemoEventsForYear(year);
    }
    applyEventsToGrid();
    if (!state.accessToken) setConnectedUI(false);
  }

  function applyEventsToGrid() {
    // Reset all cells first
    el.yearGrid.querySelectorAll(".day-row").forEach((row) => {
      const input = row.querySelector(".day-input");
      const iso = row.dataset.date;
      const list = state.eventsByDate.get(iso) || [];
      row.classList.remove("is-multi", "is-error", "is-saving");
      // Remove any previous "+N more" badge
      const prevBadge = row.querySelector(".day-more");
      if (prevBadge) prevBadge.remove();

      const primary = list[0];
      const text = primary ? (primary.summary || "") : "";
      input.value = text;
      input.dataset.original = text;
      input.dataset.eventId = primary ? primary.id : "";

      if (list.length > 1) {
        row.classList.add("is-multi");
        const badge = document.createElement("span");
        badge.className = "day-more";
        badge.textContent = `+${list.length - 1}`;
        const others = list.slice(1).map((e) => "• " + (e.summary || "(no title)")).join("\n");
        badge.title = `Other events on this day (not editable here):\n${others}`;
        row.appendChild(badge);
      }
    });
  }

  // --- Cell edit -> write-through ----------------------------------------
  function onCellInput(ev) {
    const input = ev.currentTarget;
    const row = input.closest(".day-row");
    const iso = row.dataset.date;
    // debounce save so rapid typing doesn't hammer the API
    if (state.saveTimers.has(iso)) clearTimeout(state.saveTimers.get(iso));
    const t = setTimeout(() => {
      state.saveTimers.delete(iso);
      saveCell(row, input).catch(() => {});
    }, 700);
    state.saveTimers.set(iso, t);
  }

  function onCellBlur(ev) {
    const input = ev.currentTarget;
    const row = input.closest(".day-row");
    const iso = row.dataset.date;
    // If a debounced save is pending, run it immediately on blur
    if (state.saveTimers.has(iso)) {
      clearTimeout(state.saveTimers.get(iso));
      state.saveTimers.delete(iso);
      saveCell(row, input).catch(() => {});
    }
  }

  async function saveCell(row, input) {
    const iso = row.dataset.date;
    const newText = input.value.trim();
    const original = (input.dataset.original || "").trim();
    const eventId = input.dataset.eventId || "";
    if (newText === original) return;

    // Demo mode: persist to localStorage only. Blank = remove.
    if (!state.accessToken || !state.calendarId) {
      const overrides = loadDemoOverrides(state.year);
      if (newText) overrides[iso] = newText;
      else overrides[iso] = ""; // sentinel so default demo entry is suppressed
      saveDemoOverrides(state.year, overrides);
      const list = state.eventsByDate.get(iso) || [];
      if (newText) {
        state.eventsByDate.set(iso, [{ id: "demo:" + iso, summary: newText, __demo: true }]);
      } else {
        state.eventsByDate.delete(iso);
      }
      input.dataset.original = newText;
      input.dataset.eventId = newText ? "demo:" + iso : "";
      return;
    }

    row.classList.remove("is-error");
    row.classList.add("is-saving");
    try {
      let savedEvent = null;
      if (!newText && eventId) {
        // Delete
        await deleteEvent(state.calendarId, eventId);
        // Remove from local cache
        const list = (state.eventsByDate.get(iso) || []).filter((e) => e.id !== eventId);
        if (list.length) state.eventsByDate.set(iso, list);
        else state.eventsByDate.delete(iso);
        savedEvent = null;
      } else if (newText && !eventId) {
        // Create all-day event
        savedEvent = await createEvent(state.calendarId, iso, newText);
        const list = state.eventsByDate.get(iso) || [];
        list.unshift(savedEvent);
        state.eventsByDate.set(iso, list);
      } else if (newText && eventId) {
        // Patch summary only
        savedEvent = await patchEvent(state.calendarId, eventId, { summary: newText });
        const list = state.eventsByDate.get(iso) || [];
        const idx = list.findIndex((e) => e.id === eventId);
        if (idx >= 0) list[idx] = savedEvent;
        else list.unshift(savedEvent);
        state.eventsByDate.set(iso, list);
      }
      input.dataset.original = newText;
      input.dataset.eventId = savedEvent ? savedEvent.id : "";
      row.classList.remove("is-saving");
    } catch (err) {
      row.classList.remove("is-saving");
      row.classList.add("is-error");
      setStatus("error", "Save failed: " + (err.message || "unknown error"));
      console.error(err);
    }
  }

  // --- Google OAuth via GIS ----------------------------------------------
  function ensureTokenClient() {
    if (!state.clientId) {
      alert("Please set your Google OAuth Client ID first (click Setup).");
      openConfigModal();
      return null;
    }
    if (!window.google || !google.accounts || !google.accounts.oauth2) {
      setStatus("error", "Google Identity Services not loaded yet — try again in a moment.");
      return null;
    }
    if (state.tokenClient && state.tokenClient.__clientId === state.clientId) {
      return state.tokenClient;
    }
    const client = google.accounts.oauth2.initTokenClient({
      client_id: state.clientId,
      scope: SCOPES,
      callback: onTokenResponse,
    });
    client.__clientId = state.clientId;
    state.tokenClient = client;
    return client;
  }

  function onTokenResponse(resp) {
    if (resp && resp.error) {
      setStatus("error", "Sign-in error: " + resp.error);
      return;
    }
    if (!resp || !resp.access_token) {
      setStatus("error", "No access token returned.");
      return;
    }
    state.accessToken = resp.access_token;
    const expiresIn = Number(resp.expires_in || 3600);
    state.tokenExpiresAt = Date.now() + expiresIn * 1000;
    setStatus("ok", "Connected");
    setConnectedUI(true);
    loadCalendarList()
      .then(() => loadYearEvents(state.year))
      .catch((err) => {
        setStatus("error", err.message || "Failed to load calendars");
        console.error(err);
      });
  }

  function connect() {
    const client = ensureTokenClient();
    if (!client) return;
    setStatus("busy", "Signing in…");
    client.requestAccessToken({ prompt: state.accessToken ? "" : "consent" });
  }

  function signOut() {
    if (state.accessToken && window.google && google.accounts && google.accounts.oauth2) {
      try { google.accounts.oauth2.revoke(state.accessToken, () => {}); } catch {}
    }
    state.accessToken = null;
    state.tokenExpiresAt = 0;
    state.eventsByDate = buildDemoEventsForYear(state.year);
    applyEventsToGrid();
    setConnectedUI(false);
    setStatus("offline", "Demo mode");
  }

  // --- Calendar API calls -------------------------------------------------
  async function apiFetch(url, opts = {}) {
    if (!state.accessToken) throw new Error("Not signed in");
    if (Date.now() > state.tokenExpiresAt - 10_000) {
      // Token near expiry — silently refresh
      await new Promise((resolve, reject) => {
        const client = ensureTokenClient();
        if (!client) return reject(new Error("No token client"));
        client.callback = (resp) => {
          onTokenResponse(resp);
          if (resp && resp.access_token) resolve();
          else reject(new Error(resp?.error || "Token refresh failed"));
          // Restore default callback
          client.callback = onTokenResponse;
        };
        client.requestAccessToken({ prompt: "" });
      });
    }
    const headers = Object.assign({
      Authorization: "Bearer " + state.accessToken,
      "Content-Type": "application/json",
    }, opts.headers || {});
    const res = await fetch(url, Object.assign({}, opts, { headers }));
    if (!res.ok) {
      let msg = `${res.status} ${res.statusText}`;
      try {
        const body = await res.json();
        if (body && body.error && body.error.message) msg = body.error.message;
      } catch {}
      throw new Error(msg);
    }
    if (res.status === 204) return null;
    return res.json();
  }

  async function loadCalendarList() {
    setStatus("busy", "Loading calendars…");
    const data = await apiFetch(`${CAL_API}/users/me/calendarList?minAccessRole=writer&maxResults=250`);
    const items = (data.items || []).sort((a, b) => {
      if (a.primary && !b.primary) return -1;
      if (b.primary && !a.primary) return 1;
      return (a.summary || "").localeCompare(b.summary || "");
    });
    el.calendarSelect.innerHTML = "";
    for (const cal of items) {
      const opt = document.createElement("option");
      opt.value = cal.id;
      opt.textContent = cal.summary + (cal.primary ? " (primary)" : "");
      el.calendarSelect.appendChild(opt);
    }
    // Pick saved calendar if present, else primary
    let chosen = state.calendarId;
    if (!chosen || !items.some((c) => c.id === chosen)) {
      const primary = items.find((c) => c.primary) || items[0];
      chosen = primary ? primary.id : "";
    }
    state.calendarId = chosen;
    if (chosen) {
      el.calendarSelect.value = chosen;
      localStorage.setItem(LS_CAL_ID, chosen);
    }
    setStatus("ok", "Connected");
  }

  async function loadYearEvents(year) {
    if (!state.calendarId) return;
    setStatus("busy", `Loading ${year} events…`);
    const timeMin = new Date(Date.UTC(year, 0, 1)).toISOString();
    const timeMax = new Date(Date.UTC(year + 1, 0, 1)).toISOString();
    const map = new Map();
    let pageToken = "";
    do {
      const params = new URLSearchParams({
        timeMin, timeMax,
        singleEvents: "true",
        orderBy: "startTime",
        maxResults: "2500",
      });
      if (pageToken) params.set("pageToken", pageToken);
      const data = await apiFetch(`${CAL_API}/calendars/${encodeURIComponent(state.calendarId)}/events?${params}`);
      for (const ev of data.items || []) {
        const iso = eventStartDateISO(ev);
        if (!iso) continue;
        // Only keep events that fall inside this year
        if (iso < `${year}-01-01` || iso > `${year}-12-31`) continue;
        const list = map.get(iso) || [];
        list.push(ev);
        map.set(iso, list);
      }
      pageToken = data.nextPageToken || "";
    } while (pageToken);

    state.eventsByDate = map;
    applyEventsToGrid();
    setStatus("ok", "Synced");
  }

  function eventStartDateISO(ev) {
    if (ev.start && ev.start.date) return ev.start.date; // all-day
    if (ev.start && ev.start.dateTime) {
      // Use local date component of the start time
      const dt = new Date(ev.start.dateTime);
      return isoDate(dt.getFullYear(), dt.getMonth(), dt.getDate());
    }
    return null;
  }

  function createEvent(calendarId, iso, summary) {
    const body = {
      summary,
      start: { date: iso },
      end: { date: addDaysISO(iso, 1) }, // all-day events use exclusive end
    };
    return apiFetch(`${CAL_API}/calendars/${encodeURIComponent(calendarId)}/events`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  function patchEvent(calendarId, eventId, patch) {
    return apiFetch(`${CAL_API}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
  }

  function deleteEvent(calendarId, eventId) {
    return apiFetch(`${CAL_API}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`, {
      method: "DELETE",
    });
  }

  // --- Config modal -------------------------------------------------------
  function openConfigModal() {
    el.clientIdInput.value = state.clientId || "";
    el.configModal.hidden = false;
    setTimeout(() => el.clientIdInput.focus(), 0);
  }
  function closeConfigModal() { el.configModal.hidden = true; }
  function saveConfig() {
    const val = el.clientIdInput.value.trim();
    if (!val) {
      alert("Client ID cannot be empty.");
      return;
    }
    state.clientId = val;
    localStorage.setItem(LS_CLIENT_ID, val);
    state.tokenClient = null; // force rebuild with new id
    closeConfigModal();
  }

  // --- Wire up ------------------------------------------------------------
  function populateYearSelect() {
    const thisYear = new Date().getFullYear();
    const saved = Number(localStorage.getItem(LS_YEAR)) || thisYear;
    for (let y = thisYear - 2; y <= thisYear + 3; y++) {
      const opt = document.createElement("option");
      opt.value = String(y);
      opt.textContent = String(y);
      if (y === saved) opt.selected = true;
      el.yearSelect.appendChild(opt);
    }
    state.year = Number(el.yearSelect.value) || thisYear;
  }

  function bindEvents() {
    el.yearSelect.addEventListener("change", () => {
      const y = Number(el.yearSelect.value);
      localStorage.setItem(LS_YEAR, String(y));
      renderYear(y);
      if (state.accessToken && state.calendarId) {
        loadYearEvents(y).catch((err) => {
          setStatus("error", err.message || "Failed to load events");
        });
      }
    });

    el.calendarSelect.addEventListener("change", () => {
      state.calendarId = el.calendarSelect.value;
      localStorage.setItem(LS_CAL_ID, state.calendarId);
      if (state.accessToken) {
        loadYearEvents(state.year).catch((err) => {
          setStatus("error", err.message || "Failed to load events");
        });
      }
    });

    el.connectBtn.addEventListener("click", connect);
    el.configBtn.addEventListener("click", openConfigModal);
    el.refreshBtn.addEventListener("click", () => {
      if (state.accessToken) loadYearEvents(state.year).catch((err) => {
        setStatus("error", err.message || "Failed to load events");
      });
    });
    el.signOutBtn.addEventListener("click", signOut);
    el.saveConfigBtn.addEventListener("click", saveConfig);
    el.configModal.addEventListener("click", (ev) => {
      if (ev.target.hasAttribute("data-close")) closeConfigModal();
    });
    document.addEventListener("keydown", (ev) => {
      if (ev.key === "Escape" && !el.configModal.hidden) closeConfigModal();
    });
  }

  function init() {
    if (el.footerYear) el.footerYear.textContent = new Date().getFullYear();
    populateYearSelect();
    bindEvents();
    renderYear(state.year);
    setStatus("offline", "Demo mode");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
