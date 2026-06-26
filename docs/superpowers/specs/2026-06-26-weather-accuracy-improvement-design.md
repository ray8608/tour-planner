# Weather Forecast Accuracy Improvement — Design Spec

**Date:** 2026-06-26  
**Status:** Approved

## Problem

The weather forecast shown in the tour planner is inaccurate across three dimensions: temperature, weather conditions, and precipitation probability. Root causes:

1. No weather model specified — Open-Meteo defaults to a global model that is less accurate for Asia
2. `weathercode` parameter name is outdated (new API uses `weather_code`)
3. Only precipitation probability is shown — no rainfall amount, making "40% chance" hard to interpret

Primary use case: Asia trips (Japan, Korea, Taiwan, China), 7 days or fewer before departure — the ideal window for high-resolution regional models.

## Changes

### 1. Regional Model Auto-Selection

`geocodeCity()` stores `countryCode` from the geocoding API response alongside `lat`, `lng`, `timezone`, `resolvedName`.

A new helper `getModelForCountry(countryCode)` maps country to the best available Open-Meteo model:

| Country Code | Model | Rationale |
|---|---|---|
| `JP` | `jma_seamless` | Japan Meteorological Agency |
| `TW` | `jma_seamless` | JMA coverage includes Taiwan |
| `CN` | `cma_grapes_global` | China Meteorological Administration |
| `KR` | `icon_seamless` | No KMA model in Open-Meteo; ICON performs well in Northeast Asia |
| European countries¹ | `icon_seamless` | ECMWF/DWD ICON |
| All others | `best_match` | Open-Meteo automatic selection |

¹ European country codes: `DE FR IT ES GB AT CH NL BE PL CZ SE NO DK FI PT GR HU RO SK SI HR BG RS BA HR ME MK AL`

The resolved model is stored in `state.settings.weatherGeo` so it is available when fetching forecasts.

### 2. Manual Model Override in Settings

`state.settings` gains a new field: `weatherModel: null` (null = auto).

The settings panel adds a dropdown next to the weather city input with these options:

| Value | Label |
|---|---|
| `null` | 自動（根據城市） |
| `jma_seamless` | JMA（日本氣象廳，日本／台灣）|
| `cma_grapes_global` | CMA（中國氣象局，中國）|
| `icon_seamless` | ICON（東北亞／歐洲）|
| `gfs_seamless` | GFS（美國 NOAA，全球通用）|
| `best_match` | best_match（Open-Meteo 預設）|

`fetchForecast()` resolves the model in this priority order:
1. `state.settings.weatherModel` (manual override, if not null)
2. `getModelForCountry(state.settings.weatherGeo.countryCode)` (auto-detected)

### 3. API Parameter Fixes

`fetchForecast()` `daily` parameter changes:

```
Before: temperature_2m_max,temperature_2m_min,precipitation_probability_max,weathercode
After:  temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,weather_code
```

- `weathercode` → `weather_code` (current API field name)
- Add `precipitation_sum` (unit: mm)
- Add `models` parameter using resolved model from step 1/2

### 4. Weather Badge Display Logic

Updated precipitation display in `renderWeatherBadge()`:

| Condition | Display |
|---|---|
| `precipProb >= 50%` | `💧{sum}mm` |
| `precipProb >= 20%` and `< 50%` | `💧{prob}%` |
| `precipProb < 20%` | *(no precipitation indicator)* |

The `precipitation_sum` value is rounded to one decimal place (e.g., `💧12.3mm`). If `precipitation_sum` is null or 0 but `precipProb >= 50%`, fall back to showing the percentage.

### 5. Cache Key Bump

`WEATHER_CACHE_KEY` changes from `weather-cache-v1` to `weather-cache-v2`.

The new cache entry structure adds `precipitation_sum` to each date's forecast object:

```js
result[date] = {
  tempMax, tempMin,
  precipProb,      // precipitation_probability_max
  precipSum,       // precipitation_sum (mm)
  weatherCode,     // weather_code (renamed from weathercode)
}
```

Old `weather-cache-v1` entries are ignored and will be garbage-collected by the browser.

## Out of Scope

- Wind speed, UV index, humidity — not needed for current use case
- Temperature unit toggle (°C/°F)
- Hourly forecasts
- Multi-city weather (one weather city per trip)
