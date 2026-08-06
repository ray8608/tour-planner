/* ============================================================
   app.js — 控制器：初始化、渲染迴圈、事件委派、鍵盤 Undo/Redo
   渲染策略：innerHTML 全量重繪；文字輸入採即時更新（不重繪）以保留游標。
   ============================================================ */

import {
  getState,
  subscribe,
  commit,
  pushUndo,
  undo,
  redo,
  importState,
  switchTrip,
  newTrip,
  deleteTrip,
  renameTrip,
} from "./state.js";
import { renderApp } from "./render/index.js";
import { initDrag } from "./drag.js";
import { initShare, openShare, handleImportParam } from "./share.js";
import { initTools, openCoordManager, openCommuteFill } from "./tools.js";
import { initLocate, openLocatePicker } from "./locate.js";
import { makeDay, makeSpot } from "./state.js";
import { getDayIsoDate, hotelStartId, hotelEndId, routeKey } from "./utils.js";
import * as weather from "./services/weather.js";
import { secondsToMinutes } from "./services/route.js";
import { geocodePlace, routeSeconds, departureForDay } from "./services/nav.js";
import { exportJson, buildIcs, buildKml, buildCsv, validateImport, safeFileStem } from "./services/export.js";
import { zipStore, unzip } from "./services/zip.js";
import { tripToNotionFiles } from "./services/notion-export.js";
import { notionFilesToTrip } from "./services/notion-import.js";

const WEATHER_TTL_MS = 3 * 60 * 60 * 1000;
const root = document.getElementById("app");

/** 打字時即時更新、不重繪、不新增歷史 */
const liveUpdate = (mutator) => commit(mutator, { history: false, render: false });

/** 文字輸入類 action：input 即時更新，focus 期間僅記一次歷史 */
const TEXT_ACTIONS = new Set([
  "trip-name",
  "day-label",
  "spot-name",
  "hotel-name",
  "spot-notes",
]);

/** change 事件觸發重繪（會影響時間軸/版面） */
const CHANGE_ACTIONS = new Set([
  "trip-start-date",
  "day-start-time",
  "route-time-h",
  "route-time-m",
  "spot-dur-h",
  "spot-dur-m",
  "spot-category",
]);

// 每個欄位編輯 session 只推一次 undo 快照
let editing = false;

// ---------------- 渲染 ----------------
function render() {
  // 任何重繪（含 undo/redo 經由 subscribe 觸發）都結束當前文字編輯 session，
  // 確保下一次輸入會重新推一次 undo 快照。
  editing = false;
  const state = getState();
  applyChrome(state);
  root.innerHTML = renderApp(state, buildCtx(state));
  scheduleWeatherFetch(state);
}

/** 組出跨切面檢視資料：每日 iso → 天氣快取（read-through） */
function buildCtx(state) {
  const wmap = {};
  if (state.settings.weatherCity && state.settings.weatherGeo) {
    const cache = weather.loadWeatherCache();
    const now = Date.now();
    state.days.forEach((_, i) => {
      const iso = getDayIsoDate(state.tripStartDate, i);
      if (iso) wmap[iso] = weather.getCachedForecast(cache, state.settings.weatherCity, iso, now);
    });
  }
  return { weather: wmap };
}

/** 把主題 / 字級 / 版面套到 <html> */
function applyChrome(state) {
  const html = document.documentElement;
  html.dataset.theme = state.settings.theme;
  html.dataset.font = state.settings.fontSize;
  html.dataset.layout = state.settings.layout;
}

// ---------------- 設定抽屜（純 UI 狀態，不進 state、不記歷史） ----------------
function setSettingsOpen(open) {
  document.documentElement.dataset.settings = open ? "open" : "";
}
function toggleSettings() {
  setSettingsOpen(document.documentElement.dataset.settings !== "open");
}

// ---------------- 行程管理選單（純 UI 狀態，不進 state、不記歷史） ----------------
function setTripsOpen(open) {
  document.documentElement.dataset.trips = open ? "open" : "";
}
function toggleTrips() {
  setTripsOpen(document.documentElement.dataset.trips !== "open");
}

// ---------------- 使用說明覆蓋層（純 UI 狀態，不進 state、不記歷史） ----------------
function setHelpOpen(open) {
  document.documentElement.dataset.help = open ? "open" : "";
}

// ---------------- 匯出 / 匯入 ----------------
/** 觸發瀏覽器下載（非純：Blob + 暫時性 <a>） */
function downloadFile(filename, mime, content) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** ICS DTSTAMP：UTC "YYYYMMDDTHHMMSSZ" */
function icsStamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}T${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`;
}

/** 讀取使用者選擇的 JSON 檔 → 驗證 → 確認 → 取代目前行程 */
function handleImportFile(input) {
  const file = input.files && input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    input.value = ""; // 允許重選同一檔
    const res = validateImport(String(reader.result));
    if (!res.ok) {
      alert("匯入失敗：" + res.error);
      return;
    }
    if (!confirm("是否以此備份覆蓋目前行程？此動作無法復原。")) return;
    importState(res.data);
    setSettingsOpen(false);
  };
  reader.onerror = () => alert("讀取檔案失敗");
  reader.readAsText(file);
}

/** 讀取 Notion 匯出 ZIP → 解壓 → 建行程 → 確認 → 取代目前行程 */
async function handleImportNotionZip(input) {
  const file = input.files && input.files[0];
  if (!file) return;
  input.value = ""; // 允許重選同一檔
  try {
    const buf = new Uint8Array(await file.arrayBuffer());
    const files = await unzip(buf);
    const { state, report } = notionFilesToTrip(files);
    const c = report.counts;
    const sideCount = c.accommodations + c.flights + c.guides + c.todos;
    const summary =
      `將匯入：${c.days} 天、${c.spots} 景點、${c.legs} 段交通、` +
      `${c.accommodations} 住宿、${c.flights} 航班、${c.guides} 攻略、${c.todos} 待辦。\n` +
      (sideCount > 0 ? `\n※ 住宿／航班／攻略／待辦目前僅保留供再匯出，App 內尚無編輯介面。\n` : "") +
      (report.dropped.length ? `\n未完整匯入：\n- ${report.dropped.join("\n- ")}\n` : "") +
      `\n是否以此取代目前行程？此動作無法復原。`;
    if (!confirm(summary)) return;
    importState(state);
    setSettingsOpen(false);
  } catch (err) {
    alert("匯入失敗：無法解析 Notion ZIP（" + (err && err.message ? err.message : err) + "）");
  }
}

// ---------------- 輔助：定位 day / spot ----------------
function findDay(draft, dayId) {
  return draft.days.find((d) => d.id === dayId);
}
function findSpot(draft, dayId, spotId) {
  const d = findDay(draft, dayId);
  return d ? d.spots.find((s) => s.id === spotId) : null;
}
function ensureRoute(draft, rk) {
  if (!draft.routes[rk]) {
    draft.routes[rk] = { transport: draft.settings.defaultTransport, recordedTime: 0 };
  }
  return draft.routes[rk];
}

// ---------------- 事件：click ----------------
function onClick(e) {
  const el = e.target.closest("[data-action]");
  if (!el || !root.contains(el)) return;
  const { action, day: dayId, spot: spotId, rk, transport, theme, index } = el.dataset;

  switch (action) {
    // ---- 行程管理選單（多行程；純 UI 開關不記 undo）----
    case "toggle-trips":
      toggleTrips();
      return;

    case "close-trips":
      setTripsOpen(false);
      return;

    case "select-trip":
      switchTrip(Number(index));
      setTripsOpen(false);
      return;

    case "new-trip":
      newTrip(); // 建立空白行程並切換過去；選單保持開啟以便立即命名
      return;

    // ---- 雲端共用（面板為獨立模組，渲染於 #overlay-root）----
    case "open-share":
      openShare();
      return;

    case "delete-trip":
      // 最後一筆行程不可刪（state.js deleteTrip 亦有守衛；按鈕於此情況 disabled）
      if (!confirm("確定刪除這趟行程？此動作無法復原。")) return;
      deleteTrip(Number(index));
      return;

    case "add-day":
      commit((d) => {
        const nd = makeDay(d.days.length + 1);
        d.days.push(nd);
        d.activeDayId = nd.id;
      });
      break;

    case "select-day":
      commit((d) => { d.activeDayId = dayId; }, { history: false });
      break;

    case "delete-day":
      if (getState().days.length <= 1) return;
      commit((d) => {
        const i = d.days.findIndex((x) => x.id === dayId);
        if (i < 0) return;
        d.days.splice(i, 1);
        if (d.activeDayId === dayId) {
          d.activeDayId = d.days[Math.max(0, i - 1)].id;
        }
      });
      break;

    case "copy-day":
      commit((d) => {
        const src = findDay(d, dayId);
        if (!src) return;
        const clone = structuredClone(src);
        clone.id = makeDay(0).id;
        clone.label = src.label + "（複本）";
        // 建立 舊 id → 新 id 對照（含飯店端點），以便同步重建該天的 routes
        const idMap = {
          [hotelStartId(src.id)]: hotelStartId(clone.id),
          [hotelEndId(src.id)]: hotelEndId(clone.id),
        };
        clone.spots = clone.spots.map((s) => {
          const nid = makeSpot().id;
          idMap[s.id] = nid;
          return { ...s, id: nid };
        });
        // 把來源天所有端點皆已重映射的 routes 條目，複製到新鍵下
        Object.entries(d.routes).forEach(([rk, val]) => {
          const [f, t] = rk.split("→");
          if (idMap[f] && idMap[t]) {
            d.routes[routeKey(idMap[f], idMap[t])] = { ...val };
          }
        });
        const i = d.days.findIndex((x) => x.id === dayId);
        d.days.splice(i + 1, 0, clone);
        d.activeDayId = clone.id;
      });
      break;

    case "add-spot":
      commit((d) => {
        const day = findDay(d, dayId);
        if (day) day.spots.push(makeSpot());
      });
      break;

    case "delete-spot":
      commit((d) => {
        const day = findDay(d, dayId);
        if (!day) return;
        day.spots = day.spots.filter((s) => s.id !== spotId);
        // 清除引用已刪除景點的孤兒 routes，避免持久化狀態無限膨脹
        Object.keys(d.routes).forEach((rk) => {
          const [f, t] = rk.split("→");
          if (f === spotId || t === spotId) delete d.routes[rk];
        });
      });
      break;

    case "move-spot-up":
    case "move-spot-down":
      commit((d) => {
        const day = findDay(d, dayId);
        if (!day) return;
        const i = day.spots.findIndex((s) => s.id === spotId);
        const j = action === "move-spot-up" ? i - 1 : i + 1;
        if (i < 0 || j < 0 || j >= day.spots.length) return;
        [day.spots[i], day.spots[j]] = [day.spots[j], day.spots[i]];
      });
      break;

    case "route-transport":
      commit((d) => {
        const r = ensureRoute(d, rk);
        r.transport = transport;
      });
      break;

    case "set-theme":
      commit((d) => { d.settings.theme = theme; }, { history: false });
      break;

    // ---- 設定抽屜相關（UI 設定不記 undo）----
    case "toggle-settings":
      toggleSettings();
      return;

    case "close-settings":
      setSettingsOpen(false);
      return;

    case "open-help":
      setHelpOpen(true);
      return;

    case "close-help":
      setHelpOpen(false);
      return;

    case "set-layout":
      commit((d) => { d.settings.layout = el.dataset.value; }, { history: false });
      break;

    case "set-font":
      commit((d) => { d.settings.fontSize = el.dataset.value; }, { history: false });
      break;

    case "set-theme-btn":
      commit((d) => { d.settings.theme = el.dataset.value; }, { history: false });
      break;

    case "set-transport":
      commit((d) => { d.settings.defaultTransport = el.dataset.value; }, { history: false });
      break;

    case "set-maps-mode":
      commit((d) => { d.settings.mapsMode = el.dataset.value === "on" ? "on" : "off"; }, { history: false });
      break;

    // ---- 匯出（純函式產生內容 → 下載）----
    case "export-json": {
      const st = getState();
      const r = exportJson(st, st.tripStartDate || "");
      downloadFile(r.filename, r.mime, r.content);
      return;
    }
    case "export-ics": {
      const st = getState();
      downloadFile(`${safeFileStem(st.tripName)}.ics`, "text/calendar;charset=utf-8", buildIcs(st, icsStamp()));
      return;
    }
    case "export-kml": {
      const st = getState();
      downloadFile(`${safeFileStem(st.tripName)}.kml`, "application/vnd.google-earth.kml+xml", buildKml(st));
      return;
    }
    case "export-csv": {
      const st = getState();
      downloadFile(`${safeFileStem(st.tripName)}.csv`, "text/csv;charset=utf-8", buildCsv(st));
      return;
    }
    case "export-notion": {
      const st = getState();
      const zip = zipStore(tripToNotionFiles(st));
      downloadFile(`${safeFileStem(st.tripName)}-notion.zip`, "application/zip", zip);
      return;
    }

    case "geocode-spot":
      geocodeSpot(dayId, spotId, el);
      break;

    case "auto-route":
      autoRoute(dayId, rk, el);
      break;

    case "open-coord-manager":
      openCoordManager();
      return;

    case "auto-fill-day":
      openCommuteFill(dayId);
      return;

    case "auto-fill-all":
      openCommuteFill("all");
      return;

    case "undo":
      undo();
      break;

    case "redo":
      redo();
      break;

    default:
      break;
  }
}

// ---------------- 事件：input（即時、不重繪） ----------------
function onInput(e) {
  const el = e.target.closest("[data-action]");
  if (!el) return;
  const { action, day: dayId, spot: spotId, field, index } = el.dataset;

  // 行程改名：即時存值（不重繪、不記歷史；undo 僅作用於作用中行程）
  if (action === "rename-trip") {
    renameTrip(Number(index), el.value);
    return;
  }
  // 天氣城市：即時存值（不重繪、不記歷史），實際 geocode 於 change 時進行
  if (action === "weather-city") {
    const v = el.value;
    liveUpdate((d) => { d.settings.weatherCity = v; });
    return;
  }
  // Google Maps API Key：即時存值（不重繪、不記歷史）
  if (action === "set-maps-key") {
    const v = el.value;
    liveUpdate((d) => { d.settings.mapsKey = v; });
    return;
  }
  if (!TEXT_ACTIONS.has(action)) return;

  if (!editing) {
    pushUndo();
    editing = true;
  }

  const val = el.value;
  liveUpdate((d) => {
    switch (action) {
      case "trip-name":
        d.tripName = val;
        break;
      case "day-label": {
        const day = findDay(d, dayId);
        if (day) day.label = val;
        break;
      }
      case "hotel-name": {
        const day = findDay(d, dayId);
        if (day && field) day[field] = val;
        break;
      }
      case "spot-name": {
        const s = findSpot(d, dayId, spotId);
        if (s) s.name = val;
        break;
      }
      case "spot-notes": {
        const s = findSpot(d, dayId, spotId);
        if (s) s.notes = val;
        break;
      }
      default:
        break;
    }
  });
}

// ---------------- 事件：change（重繪） ----------------
function onChange(e) {
  const el = e.target.closest("[data-action]");
  if (!el) return;
  const { action, day: dayId, spot: spotId, rk } = el.dataset;

  // 匯入 JSON 備份（file input）
  if (action === "import-file") {
    handleImportFile(el);
    return;
  }
  // 匯入 Notion 匯出 ZIP（file input）
  if (action === "import-notion-file") {
    handleImportNotionZip(el);
    return;
  }
  // 天氣城市：失焦時 geocode
  if (action === "weather-city") {
    resolveWeatherCity(el.value);
    return;
  }
  // 天氣模型：換模型即清該城快取，強制以新模型重抓
  if (action === "set-weather-model") {
    const v = el.value || null;
    const city = (getState().settings.weatherCity || "").trim().toLowerCase();
    if (city) {
      const cache = weather.loadWeatherCache();
      delete cache[city];
      weather.saveWeatherCache(cache);
    }
    commit((d) => { d.settings.weatherModel = v; }, { history: false });
    return;
  }
  // 文字欄位失焦 → 結束本次編輯 session
  if (TEXT_ACTIONS.has(action)) {
    editing = false;
    return;
  }
  if (!CHANGE_ACTIONS.has(action)) return;

  const val = el.value;
  const num = Math.max(0, Math.floor(Number(val) || 0));

  commit((d) => {
    switch (action) {
      case "trip-start-date":
        d.tripStartDate = val;
        break;
      case "day-start-time": {
        const day = findDay(d, dayId);
        if (day) day.startTime = val;
        break;
      }
      case "route-time-h": {
        const r = ensureRoute(d, rk);
        r.recordedTime = Math.min(23, num) * 60 + ((r.recordedTime || 0) % 60);
        break;
      }
      case "route-time-m": {
        const r = ensureRoute(d, rk);
        r.recordedTime = Math.floor((r.recordedTime || 0) / 60) * 60 + Math.min(59, num);
        break;
      }
      case "spot-dur-h": {
        const s = findSpot(d, dayId, spotId);
        if (s) s.stayDuration = Math.min(23, num) * 60 + (s.stayDuration % 60);
        break;
      }
      case "spot-dur-m": {
        const s = findSpot(d, dayId, spotId);
        if (s) s.stayDuration = Math.floor(s.stayDuration / 60) * 60 + Math.min(59, num);
        break;
      }
      case "spot-category": {
        const s = findSpot(d, dayId, spotId);
        if (s) s.category = val || null;
        break;
      }
      default:
        break;
    }
  });
}

// ---------------- 鍵盤：Undo / Redo ----------------
function onKeydown(e) {
  if (e.key === "Escape") {
    setSettingsOpen(false);
    setTripsOpen(false);
    setHelpOpen(false);
    return;
  }
  const mod = e.ctrlKey || e.metaKey;
  if (!mod) return;
  const key = e.key.toLowerCase();
  if (key === "z" && !e.shiftKey) {
    e.preventDefault();
    undo();
  } else if ((key === "z" && e.shiftKey) || key === "y") {
    e.preventDefault();
    redo();
  }
}

// ---------------- 非同步：天氣 ----------------
let weatherInFlight = false;

/** 城市名 → geocode 取得座標並存入 settings（觸發預報抓取） */
async function resolveWeatherCity(cityRaw) {
  const city = (cityRaw || "").trim();
  if (!city) {
    commit((d) => { d.settings.weatherGeo = null; d.settings.weatherCity = ""; }, { history: false });
    return;
  }
  try {
    const lang = (navigator.language || "zh").split("-")[0];
    const geo = await weather.geocodeCity(city, lang);
    commit((d) => { d.settings.weatherCity = city; d.settings.weatherGeo = geo; }, { history: false });
  } catch (_) {
    /* geocode 失敗：靜默，維持文字 */
  }
}

/** 依需要抓取每日預報（快取未命中或過期時）；抓完重繪 */
async function scheduleWeatherFetch(state) {
  const { weatherCity, weatherGeo, weatherModel } = state.settings;
  if (!state.tripStartDate || !weatherGeo || !weatherCity || weatherInFlight) return;
  const dates = state.days.map((_, i) => getDayIsoDate(state.tripStartDate, i)).filter(Boolean);
  if (!dates.length) return;

  const cache = weather.loadWeatherCache();
  const key = weatherCity.trim().toLowerCase();
  const entry = cache[key];
  const fresh =
    entry &&
    Date.now() - entry.forecastFetchedAt < WEATHER_TTL_MS &&
    dates.every((d) => d in entry.forecast);
  if (fresh) return;

  weatherInFlight = true;
  try {
    const model = weatherModel || weather.getModelForCountry(weatherGeo.countryCode);
    const forecast = await weather.fetchForecast(
      weatherGeo.lat, weatherGeo.lng, weatherGeo.timezone,
      dates[0], dates[dates.length - 1], model
    );
    const newEntry = {
      lat: weatherGeo.lat,
      lng: weatherGeo.lng,
      timezone: weatherGeo.timezone,
      resolvedName: weatherGeo.resolvedName,
      ...(entry || {}),
      forecast: { ...(entry?.forecast || {}), ...forecast },
      forecastFetchedAt: Date.now(),
    };
    weather.saveWeatherCache({ ...cache, [key]: newEntry });
    render(); // 顯示 badge
  } catch (_) {
    /* 靜默：下次重繪再試 */
  } finally {
    weatherInFlight = false;
  }
}

// ---------------- 非同步：地理編碼 / 路線 ----------------
/** 定位單一景點座標（以名稱） */
async function geocodeSpot(dayId, spotId, btn) {
  const day = getState().days.find((d) => d.id === dayId);
  const spot = day && day.spots.find((s) => s.id === spotId);
  if (!spot || !spot.name.trim()) return;
  btn.classList.add("is-busy");
  try {
    const geo = await geocodePlace(spot.name.trim());
    if (geo) {
      commit((d) => {
        const s = d.days.find((x) => x.id === dayId)?.spots.find((x) => x.id === spotId);
        if (s) { s.lat = geo.lat; s.lng = geo.lng; s.resolvedAddress = geo.address; }
      });
    }
  } catch (_) {
    /* geocode 失敗：靜默 */
  } finally {
    // 成功時 commit 重繪已置換此按鈕（no-op）；失敗/無結果時於此清除忙碌狀態
    btn.classList.remove("is-busy");
  }
}

/** 解析路線端點（飯店以名稱 geocode；景點用既有座標或以名稱 geocode） */
async function resolveEndpointCoords(day, id) {
  if (id === hotelStartId(day.id) || id === hotelEndId(day.id)) {
    const name = ((id === hotelStartId(day.id) ? day.startHotelName : day.endHotelName) || "").trim();
    if (!name) return null;
    return geocodePlace(name);
  }
  const spot = day.spots.find((s) => s.id === id);
  if (!spot) return null;
  if (spot.lat != null && spot.lng != null) return { lat: spot.lat, lng: spot.lng };
  if (!spot.name.trim()) return null;
  return geocodePlace(spot.name.trim());
}

/** 以 OSRM 估算某段交通時間並填入 recordedTime */
async function autoRoute(dayId, rk, btn) {
  const day = getState().days.find((d) => d.id === dayId);
  if (!day) return;
  const [fromId, toId] = rk.split("→");
  const route = getState().routes[rk] || { transport: getState().settings.defaultTransport };
  btn.classList.add("is-busy");
  try {
    const [from, to] = await Promise.all([
      resolveEndpointCoords(day, fromId),
      resolveEndpointCoords(day, toId),
    ]);
    if (!from || !to) return;
    const seconds = await routeSeconds(from, to, route.transport, departureForDay(dayId));
    if (seconds == null) return;
    const mins = secondsToMinutes(seconds);
    commit((d) => {
      if (!d.routes[rk]) d.routes[rk] = { transport: route.transport, recordedTime: 0 };
      d.routes[rk].recordedTime = mins;
    });
  } catch (_) {
    /* 路線估算失敗：靜默 */
  } finally {
    btn.classList.remove("is-busy");
  }
}

// ---------------- 初始化 ----------------
function init() {
  root.addEventListener("click", onClick);
  root.addEventListener("input", onInput);
  root.addEventListener("change", onChange);
  document.addEventListener("keydown", onKeydown);
  initDrag(root);
  initShare();
  initTools();
  initLocate();
  subscribe(render);
  render();
  handleImportParam(); // ?import=<docId> 分享連結
}

init();
