# 天氣預報（Open-Meteo）實作計畫

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在行程標頭顯示天氣預報（圖示、最高/最低溫、降雨機率），使用 Open-Meteo 免費 API，無需 API key

**Architecture:** weatherCity/weatherGeo 加入 state.settings，天氣快取存 localStorage (weather-cache-v1)，fetchWeatherIfNeeded() 在 render() 後非同步觸發，renderWeatherBadge() 插入 renderDayHeader()，geocodeCity() 在設定面板確認按鈕時呼叫。

**Tech Stack:** Vanilla JS/CSS/HTML，Open-Meteo API（免費，無需 key），localStorage 快取，無外部依賴

---

## Key File Context

- **Single file:** `/media/weichen/4TB/tmp/clau/tour/tour-planner.html` (2521 lines)
- **`</style>` closing tag:** line 694 — insert new CSS immediately before this line
- **`defaultState()`:** lines 1026–1036
- **`migrateState()`:** lines 1038–1055
- **Module-level UI-state vars** (`let settingsOpen`, etc.): lines 1108–1129 — add new vars here
- **`renderDayHeader()`:** lines 1332–1342
- **`renderSettingsPanel()`:** lines 1345–1391 — last `</div>` before closing `</div>` is line 1389 (end of 「預設交通方式」group)
- **`renderLayoutB()`:** lines 1751–1777 — sidebar day buttons at lines 1753–1760
- **`render()` function:** lines 1845–1862 — `window.scrollTo` is on line 1861
- **`action === 'setting'` handler:** lines 2153–2158 — `SETTING_KEYS` array to extend
- **`getDayDate()`:** lines 869–875 — add `getDayIsoDate()` immediately after line 875

---

## Phase 1 — CSS

### Task 1.1 — Add weather badge CSS
- [ ] In `tour-planner.html`, find line 693 (`.trip-list-btn:hover { opacity: 0.8; }`) and insert the following block **after** that line, before `</style>` on line 694:

```css
    .weather-badge {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      font-size: 11px;
      color: var(--text-muted);
      white-space: nowrap;
    }
    .weather-temp { font-weight: 500; color: var(--text); }
    .weather-rain { color: #60a5fa; }
```

**Verification:** Open `tour-planner.html` in browser (python3 -m http.server 8080), open DevTools → Elements, confirm `.weather-badge` rule appears in Styles panel (even before weather data is added).

---

## Phase 2 — State structure

### Task 2.1 — Update `defaultState()`
- [ ] Find line 1032 in `tour-planner.html`:
  ```js
        settings: { layout: 'A', theme: 'cream', defaultTransport: 'driving', fontSize: 'normal' },
  ```
  Replace with:
  ```js
        settings: { layout: 'A', theme: 'cream', defaultTransport: 'driving', fontSize: 'normal', weatherCity: '', weatherGeo: null },
  ```

### Task 2.2 — Update `migrateState()`
- [ ] Find line 1054 in `tour-planner.html` (the `return s;` line inside `migrateState`):
  ```js
      return s;
  ```
  Replace with:
  ```js
      if (s.settings.weatherCity === undefined) s.settings.weatherCity = '';
      if (s.settings.weatherGeo  === undefined) s.settings.weatherGeo  = null;
      return s;
  ```

**Verification:** Open browser console, run `JSON.parse(localStorage.getItem('travel-planner-trips-v2'))` — confirm `settings` has `weatherCity` and `weatherGeo` keys after page reload.

---

## Phase 3 — Module-level variables

### Task 3.1 — Add UI-state variables for weather geocoding
- [ ] Find line 1108 in `tour-planner.html`:
  ```js
    let settingsOpen = false;
  ```
  Insert the following two lines **before** it:
  ```js
    let weatherGeoLoading = false;
    let weatherGeoError   = '';
  ```
  (Result: the new vars are on lines 1108–1109, and `settingsOpen` shifts to line 1110.)

---

## Phase 4 — Helper functions

### Task 4.1 — Add `getDayIsoDate()`
- [ ] Find lines 869–875 in `tour-planner.html` (the `getDayDate` function):
  ```js
    function getDayDate(dayIndex) {
      if (!state.tripStartDate) return '';
      const d = new Date(state.tripStartDate + 'T00:00:00');
      d.setDate(d.getDate() + dayIndex);
      const w = ['日','一','二','三','四','五','六'];
      return `${d.getMonth()+1}/${d.getDate()}(${w[d.getDay()]})`;
    }
  ```
  Insert the following function **immediately after** (after the closing `}` on line 875):
  ```js

    function getDayIsoDate(dayIndex) {
      if (!state.tripStartDate) return '';
      const d = new Date(state.tripStartDate + 'T00:00:00');
      d.setDate(d.getDate() + dayIndex);
      return d.toISOString().slice(0, 10);
    }
  ```

### Task 4.2 — Add weather utility functions (cache + API + render)
- [ ] Find the comment `// ===== Google Maps URLs =====` (line 877 — shifts by a few lines after previous inserts, use text search). Insert the following block of code **immediately before** that comment:

```js
    // ===== Weather (Open-Meteo) =====
    const WEATHER_CACHE_KEY = 'weather-cache-v1';

    function wmoToEmoji(code) {
      if (code === null || code === undefined) return '';
      if (code === 0)                                      return '☀️';
      if (code === 1)                                      return '🌤️';
      if (code === 2)                                      return '⛅';
      if (code === 3)                                      return '☁️';
      if ([45, 48].includes(code))                         return '🌫️';
      if ([51,53,55,80,81,82].includes(code))              return '🌦️';
      if ([56,57,61,63,65,66,67].includes(code))           return '🌧️';
      if ([71,73,75,77,85,86].includes(code))              return '🌨️';
      if ([95,96,99].includes(code))                       return '⛈️';
      return '';
    }

    function loadWeatherCache() {
      try { return JSON.parse(localStorage.getItem(WEATHER_CACHE_KEY)) || {}; }
      catch (_) { return {}; }
    }

    function saveWeatherCache(cache) {
      // Evict oldest entries when more than 10 cities cached
      const keys = Object.keys(cache);
      if (keys.length > 10) {
        keys.sort((a, b) => (cache[a].forecastFetchedAt || 0) - (cache[b].forecastFetchedAt || 0));
        delete cache[keys[0]];
      }
      localStorage.setItem(WEATHER_CACHE_KEY, JSON.stringify(cache));
    }

    function getCachedForecast(city, date) {
      const cache = loadWeatherCache();
      const key   = city.trim().toLowerCase();
      const entry = cache[key];
      if (!entry) return undefined;
      if ((Date.now() - entry.forecastFetchedAt) > 3 * 60 * 60 * 1000) return undefined;
      return (date in entry.forecast) ? entry.forecast[date] : undefined;
    }

    async function geocodeCity(cityName) {
      const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityName)}&count=1&language=en&format=json`;
      const res  = await fetch(url);
      if (!res.ok) throw new Error('geocode network error');
      const data = await res.json();
      if (!data.results || !data.results.length) return null;   // null = 找不到
      const r = data.results[0];
      return { lat: r.latitude, lng: r.longitude, timezone: r.timezone, resolvedName: `${r.name}, ${r.country}` };
    }

    async function fetchForecast(lat, lng, timezone, startDate, endDate) {
      const params = new URLSearchParams({
        latitude:  lat,
        longitude: lng,
        daily:     'temperature_2m_max,temperature_2m_min,precipitation_probability_max,weathercode',
        timezone,
        start_date: startDate,
        end_date:   endDate,
      });
      const res  = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
      if (!res.ok) throw new Error('forecast network error');
      const data = await res.json();
      const d    = data.daily;
      const result = {};
      d.time.forEach((date, i) => {
        const tempMax   = d.temperature_2m_max[i];
        const tempMin   = d.temperature_2m_min[i];
        const precipProb = d.precipitation_probability_max[i];
        const weathercode = d.weathercode[i];
        // Store null explicitly when data is null (out of forecast range)
        result[date] = (tempMax === null && weathercode === null)
          ? null
          : { tempMax: Math.round(tempMax), tempMin: Math.round(tempMin), precipProb, weathercode };
      });
      return result;
    }

    let weatherFetchInFlight = false;

    async function fetchWeatherIfNeeded() {
      if (!state.tripStartDate || !state.settings.weatherGeo) return;
      if (weatherFetchInFlight) return;
      const { lat, lng, timezone } = state.settings.weatherGeo;
      const city = state.settings.weatherCity.trim().toLowerCase();
      const dates = state.days.map((_, i) => getDayIsoDate(i)).filter(Boolean);
      if (!dates.length) return;
      const startDate = dates[0];
      const endDate   = dates[dates.length - 1];
      const cache     = loadWeatherCache();
      const entry     = cache[city];
      const allCached = entry
        && (Date.now() - entry.forecastFetchedAt) < 3 * 60 * 60 * 1000
        && dates.every(d => d in entry.forecast);
      if (allCached) return;
      weatherFetchInFlight = true;
      try {
        const forecast = await fetchForecast(lat, lng, timezone, startDate, endDate);
        const newEntry = {
          ...(entry || { lat, lng, timezone, resolvedName: state.settings.weatherGeo.resolvedName, fetchedAt: Date.now() }),
          forecast: { ...(entry?.forecast || {}), ...forecast },
          forecastFetchedAt: Date.now(),
        };
        const newCache = { ...cache, [city]: newEntry };
        saveWeatherCache(newCache);
        render();
      } catch (_) {
        // Fail silently — retry on next render cycle
      } finally {
        weatherFetchInFlight = false;
      }
    }

    function renderWeatherBadge(dayIndex, isoDate) {
      if (!state.settings.weatherCity || !state.settings.weatherGeo) return '';
      const city    = state.settings.weatherCity;
      const cached  = getCachedForecast(city, isoDate);
      if (cached === undefined) {
        // Cache miss — show loading spinner only if geo is set (fetch will be triggered)
        return `<span class="weather-badge"><span>⏳</span></span>`;
      }
      if (cached === null) return '';   // Out of forecast range
      const emoji = wmoToEmoji(cached.weathercode);
      const rain  = cached.precipProb >= 20
        ? `<span class="weather-rain">💧${cached.precipProb}%</span>`
        : '';
      return `<span class="weather-badge">
        ${emoji ? `<span class="weather-icon">${emoji}</span>` : ''}
        <span class="weather-temp">${cached.tempMax}°/${cached.tempMin}°</span>
        ${rain}
      </span>`;
    }

```

**Verification:** In browser console, run `wmoToEmoji(0)` — should return `'☀️'`. Run `wmoToEmoji(80)` — should return `'🌦️'`. Run `loadWeatherCache()` — should return `{}`.

---

## Phase 5 — Update `render()` to trigger weather fetch

### Task 5.1 — Call `fetchWeatherIfNeeded` after render
- [ ] Find line 1861 in `tour-planner.html` (inside `render()`, after innerHTML assignment):
  ```js
      window.scrollTo(0, scrollY);
    }
  ```
  Replace with:
  ```js
      window.scrollTo(0, scrollY);
      setTimeout(fetchWeatherIfNeeded, 0);
    }
  ```

---

## Phase 6 — Update `renderDayHeader()`

### Task 6.1 — Insert weather badge into day header
- [ ] Find the `renderDayHeader` function (lines 1332–1342). Replace the entire function body:
  ```js
    function renderDayHeader(day) {
      const dayIndex = state.days.findIndex(d => d.id === day.id);
      const dateStr  = getDayDate(dayIndex);
      return `
        <div class="day-content-header">
          <input class="day-name-input" value="${escHtml(day.label)}"
            data-action="day-name" data-day-id="${day.id}">
          ${dateStr ? `<span style="font-size:12px;color:var(--text-muted)">${escHtml(dateStr)}</span>` : ''}
          ${renderDeleteDayBtn(day)}
        </div>`;
    }
  ```
  With:
  ```js
    function renderDayHeader(day) {
      const dayIndex     = state.days.findIndex(d => d.id === day.id);
      const dateStr      = getDayDate(dayIndex);
      const isoDate      = getDayIsoDate(dayIndex);
      const weatherHtml  = isoDate ? renderWeatherBadge(dayIndex, isoDate) : '';
      return `
        <div class="day-content-header">
          <input class="day-name-input" value="${escHtml(day.label)}"
            data-action="day-name" data-day-id="${day.id}">
          ${dateStr ? `<span style="font-size:12px;color:var(--text-muted)">${escHtml(dateStr)}</span>` : ''}
          ${weatherHtml}
          ${renderDeleteDayBtn(day)}
        </div>`;
    }
  ```

---

## Phase 7 — Update Layout B sidebar to show weather

### Task 7.1 — Add weather icon + max temp to Layout B sidebar day buttons
- [ ] Find the `renderLayoutB()` function. Locate the `items` mapping (lines 1753–1760):
  ```js
      const items = state.days.map((d, i) => {
        const dateStr = getDayDate(i);
        return `
          <button class="sidebar-day-btn ${d.id === active?.id ? 'active' : ''}"
            data-action="select-day" data-day-id="${d.id}"
            style="${dateStr ? 'white-space:normal;line-height:1.4' : ''}">${escHtml(d.label)}${dateStr ? `<span style="display:block;font-size:10px;opacity:0.7">${escHtml(dateStr)}</span>` : ''}</button>
        `;
      }).join('');
  ```
  Replace with:
  ```js
      const items = state.days.map((d, i) => {
        const dateStr = getDayDate(i);
        const isoDate = getDayIsoDate(i);
        const wCache  = isoDate && state.settings.weatherCity && state.settings.weatherGeo
          ? getCachedForecast(state.settings.weatherCity, isoDate)
          : undefined;
        const wSnippet = (wCache && wCache !== null)
          ? ` <span style="font-size:10px;opacity:0.85">${wmoToEmoji(wCache.weathercode)} ${wCache.tempMax}°</span>`
          : '';
        return `
          <button class="sidebar-day-btn ${d.id === active?.id ? 'active' : ''}"
            data-action="select-day" data-day-id="${d.id}"
            style="${dateStr ? 'white-space:normal;line-height:1.4' : ''}">${escHtml(d.label)}${dateStr ? `<span style="display:block;font-size:10px;opacity:0.7">${escHtml(dateStr)}${wSnippet}</span>` : ''}</button>
        `;
      }).join('');
  ```

---

## Phase 8 — Settings panel: weather city input

### Task 8.1 — Add weather city group to `renderSettingsPanel()`
- [ ] Find lines 1381–1388 inside `renderSettingsPanel()` — the 「預設交通方式」group:
  ```js
            <div class="settings-group">
              <div class="settings-label">預設交通方式</div>
              <div class="toggle-group">
                ${tb('defaultTransport','driving','🚗 開車')}
                ${tb('defaultTransport','transit','🚌 大眾')}
                ${tb('defaultTransport','walking','🚶 步行')}
              </div>
            </div>
  ```
  Insert the following block **immediately after** that closing `</div>` (before the final `</div>` that closes `.settings-panel`):
  ```js
            <div class="settings-group">
              <div class="settings-label">天氣城市</div>
              <div style="display:flex;gap:6px;align-items:center">
                <input style="flex:1;border:1px solid var(--border);border-radius:4px;padding:5px 8px;font-size:13px;background:var(--input-bg);color:var(--text)"
                  placeholder="Tokyo, 台北, Paris…"
                  value="${escHtml(state.settings.weatherCity || '')}"
                  data-action="weather-city-input">
                <button class="btn-accent" data-action="confirm-weather-city"
                  ${weatherGeoLoading ? 'disabled' : ''}
                  style="white-space:nowrap">${weatherGeoLoading ? '查詢中…' : '確認'}</button>
              </div>
              ${weatherGeoError
                ? `<div style="font-size:11px;color:#f87171;margin-top:4px">${escHtml(weatherGeoError)}</div>`
                : state.settings.weatherGeo
                  ? `<div style="font-size:11px;color:var(--text-muted);margin-top:4px">✓ ${escHtml(state.settings.weatherGeo.resolvedName)}</div>`
                  : ''}
            </div>
  ```

---

## Phase 9 — Event handlers

### Task 9.1 — Add `weather-city-input` change handler (input event listener)
- [ ] Find the `input` event listener in `attachEvents()`. Look for the block that handles `data-action` on input elements. There should be an `app.addEventListener('input', ...)` or similar. Check with:

  ```bash
  grep -n "addEventListener('input'\|addEventListener(\"input\"" /media/weichen/4TB/tmp/clau/tour/tour-planner.html
  ```

  Read that section and add a new case for `weather-city-input`:
  ```js
        if (action === 'weather-city-input') {
          setState(s => { s.settings.weatherCity = e.target.value; });
          return;
        }
  ```
  Place it alongside the other input handlers (same `input` event listener block).

### Task 9.2 — Add `confirm-weather-city` click handler
- [ ] Find the `action === 'setting'` click handler at line 2153 (may shift slightly). Insert the following block **immediately after** the closing `}` of that handler (after line 2158):

  ```js
        if (action === 'confirm-weather-city') {
          const city = state.settings.weatherCity.trim();
          if (!city) return;
          weatherGeoLoading = true;
          weatherGeoError   = '';
          render();
          geocodeCity(city).then(geo => {
            weatherGeoLoading = false;
            if (!geo) {
              weatherGeoError = '找不到城市，請確認拼寫';
              render();
            } else {
              weatherGeoError = '';
              setState(s => { s.settings.weatherGeo = geo; });
            }
          }).catch(() => {
            weatherGeoLoading = false;
            weatherGeoError = '無法查詢城市，請稍後再試';
            render();
          });
          return;
        }
  ```

### Task 9.3 — Extend `SETTING_KEYS` allowlist
- [ ] Find the `SETTING_KEYS` array at the `action === 'setting'` handler:
  ```js
          const SETTING_KEYS = ['layout', 'theme', 'defaultTransport', 'fontSize'];
  ```
  Replace with:
  ```js
          const SETTING_KEYS = ['layout', 'theme', 'defaultTransport', 'fontSize', 'weatherCity', 'weatherGeo'];
  ```
  (Note: `weatherCity` is handled by `weather-city-input`, not `setting`, but adding to the allowlist future-proofs against accidental leakage. The confirm flow above sets `weatherGeo` via `setState` directly.)

  Actually — `weatherCity` and `weatherGeo` should NOT be set via the generic `setting` toggle handler (they use dedicated actions). Leave `SETTING_KEYS` unchanged. **Skip this sub-task.**

---

## Phase 10 — Manual browser verification

### Task 10.1 — Basic smoke test
- [ ] Open `tour-planner.html` via static server (`python3 -m http.server 8080`, navigate to `http://localhost:8080/tour-planner.html`)
- [ ] Open ⚙️ Settings panel — verify new「天氣城市」group appears at the bottom with an input + 確認 button
- [ ] Reload page — confirm existing trips/data still load correctly (migration worked)

### Task 10.2 — Geocoding test
- [ ] Type `Tokyo` in the weather city input, click 確認
- [ ] Verify button shows「查詢中…」briefly, then resolves to「✓ Tokyo, Japan」
- [ ] Open browser DevTools → Application → Local Storage → check `weather-cache-v1` key does NOT yet have forecast data (only after render triggers fetch)
- [ ] Verify `state.settings.weatherGeo` is now set: run `JSON.parse(localStorage.getItem('travel-planner-trips-v2')).trips[0].settings.weatherGeo` in console

### Task 10.3 — Forecast display test
- [ ] Set `state.tripStartDate` to today or a near-future date via the trip date input (if it exists) OR via console: `setState(s => { s.tripStartDate = '2026-05-29'; })`
- [ ] Reload or trigger re-render — verify each day header shows `⏳` briefly then shows weather badge like `🌤️ 22°/18° 💧30%`
- [ ] Open Application → Local Storage → `weather-cache-v1` — confirm forecast data is cached for the queried city/dates
- [ ] Reload page — verify weather shows immediately (from cache, no `⏳`)

### Task 10.4 — Layout B sidebar test
- [ ] Switch to Layout B in settings
- [ ] Confirm sidebar day buttons show weather icon + max temp below the date (e.g., `🌤️ 22°`)

### Task 10.5 — Edge case: no date set
- [ ] Clear `tripStartDate`: open trip date input and clear it
- [ ] Verify no weather badge appears, no errors in console

### Task 10.6 — Edge case: invalid city
- [ ] Type `xyznotacity123` in weather city input, click 確認
- [ ] Verify error message「找不到城市，請確認拼寫」appears below the input

### Task 10.7 — Cache expiry test (optional, skip if time-constrained)
- [ ] In Application → Local Storage, edit `weather-cache-v1`, change `forecastFetchedAt` to `1` (very old timestamp)
- [ ] Trigger a render — verify `⏳` shows, then fresh data fetched and cached with current timestamp

---

## Phase 11 — Git commit

### Task 11.1 — Commit weather forecast feature
- [ ] Stage the single changed file:
  ```bash
  git add tour-planner.html
  ```
- [ ] Commit:
  ```bash
  git commit -m "feat: add Open-Meteo weather forecast to day headers

  - Add weatherCity/weatherGeo to state.settings with migration
  - Cache forecasts in localStorage (weather-cache-v1, 3h TTL)
  - renderWeatherBadge() shows emoji, max/min temp, rain probability
  - Weather city geocoding UI in settings panel with loading/error states
  - Layout B sidebar shows icon + max temp per day
  - fetchWeatherIfNeeded() fires async after render(), no blocking"
  ```

---

## Implementation Notes

### Function insertion order summary (all in `tour-planner.html`)

| New function / var | Insert location |
|---|---|
| `.weather-badge` CSS | Before `</style>` on line 694 |
| `weatherCity/weatherGeo` in `defaultState` | Line 1032 — extend settings object literal |
| migration lines in `migrateState` | Before `return s;` on line 1054 |
| `let weatherGeoLoading`, `let weatherGeoError` | Before `let settingsOpen` on line 1108 |
| `getDayIsoDate()` | After `getDayDate()` closing `}` on line 875 |
| Weather utility block (cache, API, render fns) | Before `// ===== Google Maps URLs =====` |
| `setTimeout(fetchWeatherIfNeeded, 0)` | Inside `render()`, after `window.scrollTo` |
| `renderDayHeader` update | Replace lines 1332–1342 |
| Layout B `items` map update | Replace the `items` mapping inside `renderLayoutB()` |
| Weather city group in `renderSettingsPanel` | After 「預設交通方式」`</div>` group, before closing `.settings-panel` `</div>` |
| `weather-city-input` input handler | Inside `app.addEventListener('input', ...)` block |
| `confirm-weather-city` click handler | After `action === 'setting'` block |

### API URLs (verbatim)

- Geocoding: `https://geocoding-api.open-meteo.com/v1/search?name=<city>&count=1&language=en&format=json`
- Forecast: `https://api.open-meteo.com/v1/forecast?latitude=<lat>&longitude=<lng>&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weathercode&timezone=<tz>&start_date=<YYYY-MM-DD>&end_date=<YYYY-MM-DD>`

### Silent failure contract

- Geocoding network failure → `weatherGeoError = '無法查詢城市，請稍後再試'`, `weatherGeo` unchanged
- Forecast fetch failure → caught silently, no badge rendered, retry on next `render()` cycle
- No `alert()` calls anywhere in this feature

### Do NOT modify

- Firebase / cloud sharing functions — weather data never enters `state.days` or synced state
- Layout C (`renderLayoutC`) — `renderDayHeader` is shared, weather appears automatically
- Any existing `SETTING_KEYS` toggle — `weatherCity`/`weatherGeo` use dedicated actions
