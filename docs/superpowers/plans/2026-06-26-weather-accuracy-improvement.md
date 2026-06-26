# Weather Forecast Accuracy Improvement — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve Open-Meteo weather forecast accuracy by using regional models (JMA for Japan/Taiwan, CMA for China, ICON for Korea/Europe), fixing the deprecated `weathercode` API field name, adding precipitation amount, and providing a manual model override in settings.

**Architecture:** All changes are in `tour-planner.html` (single-file app). Touches 5 functions (`geocodeCity`, `fetchForecast`, `fetchWeatherIfNeeded`, `renderWeatherBadge`, `renderSettingsPanel`) plus `defaultState`/`migrateState`. Cache key is bumped from `v1` to `v2` to invalidate stale data.

**Tech Stack:** Vanilla JS, Open-Meteo REST API, localStorage

---

### Task 1: Bump cache key & update geocodeCity to store countryCode

**Files:**
- Modify: `tour-planner.html:1149` (WEATHER_CACHE_KEY)
- Modify: `tour-planner.html:1189–1198` (geocodeCity)

- [ ] **Step 1: Change the cache key constant**

Find line 1149:
```js
const WEATHER_CACHE_KEY = 'weather-cache-v1';
```
Replace with:
```js
const WEATHER_CACHE_KEY = 'weather-cache-v2';
```

- [ ] **Step 2: Update geocodeCity to capture countryCode**

Find lines 1196–1197 inside `geocodeCity`:
```js
      const r = data.results[0];
      return { lat: r.latitude, lng: r.longitude, timezone: r.timezone, resolvedName: `${r.name}, ${r.country}` };
```
Replace with:
```js
      const r = data.results[0];
      return { lat: r.latitude, lng: r.longitude, timezone: r.timezone, countryCode: r.country_code, resolvedName: `${r.name}, ${r.country}` };
```

- [ ] **Step 3: Commit**

```bash
git add tour-planner.html
git commit -m "feat: bump weather cache to v2; store countryCode in weatherGeo"
```

---

### Task 2: Add getModelForCountry helper

**Files:**
- Modify: `tour-planner.html` — insert after line 1198 (end of `geocodeCity`)

- [ ] **Step 1: Insert the helper function**

After the closing `}` of `geocodeCity` (line 1198), insert:

```js
    function getModelForCountry(countryCode) {
      if (!countryCode) return 'best_match';
      const code = countryCode.toUpperCase();
      if (code === 'JP' || code === 'TW') return 'jma_seamless';
      if (code === 'CN') return 'cma_grapes_global';
      if (['KR','DE','FR','IT','ES','GB','AT','CH','NL','BE','PL','CZ',
           'SE','NO','DK','FI','PT','GR','HU','RO','SK','SI','HR',
           'BG','RS','BA','ME','MK','AL'].includes(code)) return 'icon_seamless';
      return 'best_match';
    }
```

- [ ] **Step 2: Verify in browser console**

Open `tour-planner.html` in browser, open DevTools console, run:
```js
getModelForCountry('JP')  // → "jma_seamless"
getModelForCountry('TW')  // → "jma_seamless"
getModelForCountry('CN')  // → "cma_grapes_global"
getModelForCountry('KR')  // → "icon_seamless"
getModelForCountry('DE')  // → "icon_seamless"
getModelForCountry('US')  // → "best_match"
getModelForCountry(null)  // → "best_match"
```

- [ ] **Step 3: Commit**

```bash
git add tour-planner.html
git commit -m "feat: add getModelForCountry helper for regional weather model selection"
```

---

### Task 3: Update fetchForecast (new params, model, fix weather_code)

**Files:**
- Modify: `tour-planner.html:1200–1224` (fetchForecast)

- [ ] **Step 1: Replace the entire fetchForecast function**

Find the function starting at line 1200:
```js
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
        const tempMax    = d.temperature_2m_max[i];
        const tempMin    = d.temperature_2m_min[i];
        const precipProb = d.precipitation_probability_max[i];
        const weathercode = d.weathercode[i];
        result[date] = (tempMax === null && weathercode === null)
          ? null
          : { tempMax: Math.round(tempMax), tempMin: Math.round(tempMin), precipProb, weathercode };
      });
      return result;
    }
```

Replace with:
```js
    async function fetchForecast(lat, lng, timezone, startDate, endDate, model) {
      const params = new URLSearchParams({
        latitude:   lat,
        longitude:  lng,
        daily:      'temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,weather_code',
        timezone,
        start_date: startDate,
        end_date:   endDate,
        models:     model || 'best_match',
      });
      const res  = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
      if (!res.ok) throw new Error('forecast network error');
      const data = await res.json();
      const d    = data.daily;
      const result = {};
      d.time.forEach((date, i) => {
        const tempMax    = d.temperature_2m_max[i];
        const tempMin    = d.temperature_2m_min[i];
        const precipProb = d.precipitation_probability_max[i];
        const precipSum  = d.precipitation_sum[i];
        const weatherCode = d.weather_code[i];
        result[date] = (tempMax === null && weatherCode === null)
          ? null
          : { tempMax: Math.round(tempMax), tempMin: Math.round(tempMin), precipProb, precipSum, weatherCode };
      });
      return result;
    }
```

- [ ] **Step 2: Commit**

```bash
git add tour-planner.html
git commit -m "feat: update fetchForecast — regional model param, precipitation_sum, weather_code"
```

---

### Task 4: Update fetchWeatherIfNeeded to resolve and pass model

**Files:**
- Modify: `tour-planner.html:1228–1259` (fetchWeatherIfNeeded)

- [ ] **Step 1: Add model resolution after the destructuring on line 1231**

Find:
```js
      const { lat, lng, timezone } = state.settings.weatherGeo;
```
Replace with:
```js
      const { lat, lng, timezone } = state.settings.weatherGeo;
      const model = state.settings.weatherModel || getModelForCountry(state.settings.weatherGeo.countryCode);
```

- [ ] **Step 2: Pass model to fetchForecast**

Find:
```js
        const forecast = await fetchForecast(lat, lng, timezone, startDate, endDate);
```
Replace with:
```js
        const forecast = await fetchForecast(lat, lng, timezone, startDate, endDate, model);
```

- [ ] **Step 3: Commit**

```bash
git add tour-planner.html
git commit -m "feat: resolve regional weather model in fetchWeatherIfNeeded"
```

---

### Task 5: Update renderWeatherBadge (new field names + display logic)

**Files:**
- Modify: `tour-planner.html:1261–1278` (renderWeatherBadge)

- [ ] **Step 1: Replace renderWeatherBadge**

Find the function:
```js
    function renderWeatherBadge(dayIndex, isoDate) {
      if (!state.settings.weatherCity || !state.settings.weatherGeo) return '';
      const city    = state.settings.weatherCity;
      const cached  = getCachedForecast(city, isoDate);
      if (cached === undefined) {
        return `<span class="weather-badge"><span>⏳</span></span>`;
      }
      if (cached === null) return '';
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

Replace with:
```js
    function renderWeatherBadge(dayIndex, isoDate) {
      if (!state.settings.weatherCity || !state.settings.weatherGeo) return '';
      const city    = state.settings.weatherCity;
      const cached  = getCachedForecast(city, isoDate);
      if (cached === undefined) {
        return `<span class="weather-badge"><span>⏳</span></span>`;
      }
      if (cached === null) return '';
      const emoji = wmoToEmoji(cached.weatherCode);
      let rain = '';
      if (cached.precipProb >= 50) {
        const sum = cached.precipSum;
        rain = (sum != null && sum >= 1)
          ? `<span class="weather-rain">💧${Number.isInteger(sum) ? sum : sum.toFixed(1)}mm</span>`
          : `<span class="weather-rain">💧${cached.precipProb}%</span>`;
      } else if (cached.precipProb >= 20) {
        rain = `<span class="weather-rain">💧${cached.precipProb}%</span>`;
      }
      return `<span class="weather-badge">
        ${emoji ? `<span class="weather-icon">${emoji}</span>` : ''}
        <span class="weather-temp">${cached.tempMax}°/${cached.tempMin}°</span>
        ${rain}
      </span>`;
    }
```

- [ ] **Step 2: Commit**

```bash
git add tour-planner.html
git commit -m "feat: update weather badge — weatherCode field, precipitation_sum display"
```

---

### Task 6: Add weatherModel to defaultState and migrateState

**Files:**
- Modify: `tour-planner.html:1657` (defaultState)
- Modify: `tour-planner.html:1698–1699` (migrateState)

- [ ] **Step 1: Add weatherModel to defaultState**

Find line 1657:
```js
        settings: { layout: 'A', theme: 'cream', defaultTransport: 'driving', fontSize: 'normal', weatherCity: '', weatherGeo: null },
```
Replace with:
```js
        settings: { layout: 'A', theme: 'cream', defaultTransport: 'driving', fontSize: 'normal', weatherCity: '', weatherGeo: null, weatherModel: null },
```

- [ ] **Step 2: Add migration for weatherModel**

Find lines 1698–1699:
```js
      if (s.settings.weatherCity === undefined) s.settings.weatherCity = '';
      if (s.settings.weatherGeo  === undefined) s.settings.weatherGeo  = null;
```
Replace with:
```js
      if (s.settings.weatherCity  === undefined) s.settings.weatherCity  = '';
      if (s.settings.weatherGeo   === undefined) s.settings.weatherGeo   = null;
      if (s.settings.weatherModel === undefined) s.settings.weatherModel = null;
```

- [ ] **Step 3: Commit**

```bash
git add tour-planner.html
git commit -m "feat: add weatherModel field to state with migration"
```

---

### Task 7: Add model dropdown to settings panel + change handler

**Files:**
- Modify: `tour-planner.html:2163–2182` (weather city settings-group in renderSettingsPanel)
- Modify: `tour-planner.html:3262` (change event handler)

- [ ] **Step 1: Add model select inside the weather settings group**

Find the closing line of the weather settings group. The group ends with:
```js
              ${weatherGeoError
                ? `<div style="font-size:11px;color:#f87171;margin-top:4px">${escHtml(weatherGeoError)}</div>`
                : state.settings.weatherGeo && !state.tripStartDate
                  ? `<div style="font-size:11px;color:var(--text-muted);margin-top:4px">✓ ${escHtml(state.settings.weatherGeo.resolvedName)}　<span style="color:#f87171">需設定旅程開始日期才能顯示天氣</span></div>`
                  : state.settings.weatherGeo
                    ? `<div style="font-size:11px;color:var(--text-muted);margin-top:4px">✓ ${escHtml(state.settings.weatherGeo.resolvedName)}</div>`
                    : ''}
            </div>
```

Replace with:
```js
              ${weatherGeoError
                ? `<div style="font-size:11px;color:#f87171;margin-top:4px">${escHtml(weatherGeoError)}</div>`
                : state.settings.weatherGeo && !state.tripStartDate
                  ? `<div style="font-size:11px;color:var(--text-muted);margin-top:4px">✓ ${escHtml(state.settings.weatherGeo.resolvedName)}　<span style="color:#f87171">需設定旅程開始日期才能顯示天氣</span></div>`
                  : state.settings.weatherGeo
                    ? `<div style="font-size:11px;color:var(--text-muted);margin-top:4px">✓ ${escHtml(state.settings.weatherGeo.resolvedName)}</div>`
                    : ''}
              <div style="margin-top:8px">
                <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px">天氣模型</div>
                <select data-action="weather-model-select"
                  style="width:100%;box-sizing:border-box;border:1px solid var(--border);border-radius:4px;padding:5px 8px;font-size:12px;background:var(--input-bg);color:var(--text)">
                  <option value="null" ${!state.settings.weatherModel ? 'selected' : ''}>自動（根據城市）</option>
                  <option value="jma_seamless" ${state.settings.weatherModel === 'jma_seamless' ? 'selected' : ''}>JMA（日本氣象廳，日本／台灣）</option>
                  <option value="cma_grapes_global" ${state.settings.weatherModel === 'cma_grapes_global' ? 'selected' : ''}>CMA（中國氣象局，中國）</option>
                  <option value="icon_seamless" ${state.settings.weatherModel === 'icon_seamless' ? 'selected' : ''}>ICON（東北亞／歐洲）</option>
                  <option value="gfs_seamless" ${state.settings.weatherModel === 'gfs_seamless' ? 'selected' : ''}>GFS（美國 NOAA，全球通用）</option>
                  <option value="best_match" ${state.settings.weatherModel === 'best_match' ? 'selected' : ''}>best_match（Open-Meteo 預設）</option>
                </select>
              </div>
            </div>
```

- [ ] **Step 2: Add change handler for weather-model-select**

Find in the `change` event listener (around line 3262), after the last `if` block inside the listener (before the closing `}`), add:

```js
        if (action === 'weather-model-select') {
          const val = e.target.value;
          setState(s => { s.settings.weatherModel = val === 'null' ? null : val; }, { recordHistory: false });
          return;
        }
```

- [ ] **Step 3: Commit**

```bash
git add tour-planner.html
git commit -m "feat: add weather model dropdown to settings panel"
```

---

### Task 8: Manual browser verification

- [ ] **Step 1: Open the app**

```bash
python3 -m http.server 8080
# open http://localhost:8080/tour-planner.html
```

- [ ] **Step 2: Verify cache invalidation**

Open DevTools → Application → Local Storage. Confirm there is no `weather-cache-v1` key (or it is ignored). The key `weather-cache-v2` should appear after a weather fetch.

- [ ] **Step 3: Test Japanese city auto-model selection**

1. Go to ⚙️ Settings → 天氣城市 → type `Tokyo` → 確認
2. The model dropdown should show 「自動（根據城市）」selected
3. Open DevTools → Network → filter `open-meteo` — confirm the forecast request URL contains `models=jma_seamless`

- [ ] **Step 4: Test Taiwanese city**

1. Change city to `Taipei` → 確認
2. Network request should contain `models=jma_seamless`

- [ ] **Step 5: Test manual model override**

1. Change model dropdown to `GFS（美國 NOAA，全球通用）`
2. Clear weather cache via DevTools (delete `weather-cache-v2`) and reload
3. Network request should now contain `models=gfs_seamless` regardless of city

- [ ] **Step 6: Test precipitation display**

Set a travel date within the next 7 days. On a day where weather data loads:
- If `precipProb >= 50%` → badge should show `💧Xmm` (not `%`)
- If `precipProb 20–49%` → badge should show `💧X%`
- If `precipProb < 20%` → no rain indicator

- [ ] **Step 7: Final commit (update help overlay last-update)**

Update the last-update date in `renderHelpOverlay()` to today's date, then:

```bash
git add tour-planner.html
git commit -m "feat: improve weather accuracy — regional models, precipitation_sum, weather_code fix"
```
