/* ============================================================
   state.js — 單一真實來源：狀態、預設、遷移、持久化、Undo/Redo
   - structuredClone 快照，歷史上限 50 步
   - 變更透過 commit() 進行；純讀取用 getState()
   ============================================================ */

import { genId } from "./utils.js";
import {
  TRIPS_KEY,
  LEGACY_KEY,
  normalizeTripsContainer,
  tripSummaries,
  removeAt,
} from "./trips.js";

const HISTORY_LIMIT = 50;

/** 建一個新的一天 */
export function makeDay(index) {
  return {
    id: genId(),
    label: `第 ${index} 天`,
    startTime: "",
    startHotelName: "",
    endHotelName: "",
    spots: [],
  };
}

/** 建一個新景點 */
export function makeSpot(name = "") {
  return {
    id: genId(),
    name,
    stayDuration: 0,
    notes: "",
    category: null,
    lat: null,
    lng: null,
    resolvedAddress: "",
  };
}

/** 全新的預設狀態（一趟旅程、一天） */
export function defaultState() {
  const d = makeDay(1);
  return {
    version: 3,
    tripName: "新旅程",
    tripStartDate: "",
    activeDayId: d.id,
    settings: {
      layout: "A",
      theme: "cream",
      fontSize: "normal",
      defaultTransport: "driving",
      weatherCity: "",
      weatherGeo: null,
      weatherModel: null,
      mapsMode: "off", // "off" | "on"（啟用 Google Maps 進階導航）
      mapsKey: "",
    },
    days: [d],
    routes: {},
  };
}

/** 遷移舊資料到目前結構（容錯） */
export function migrateState(raw) {
  const s = raw && typeof raw === "object" ? raw : {};
  const out = defaultState();
  if (typeof s.tripName === "string") out.tripName = s.tripName;
  if (typeof s.tripStartDate === "string") out.tripStartDate = s.tripStartDate;
  if (s.settings && typeof s.settings === "object") {
    out.settings = { ...out.settings, ...s.settings };
  }
  if (Array.isArray(s.days) && s.days.length) {
    out.days = s.days.map((d, i) => ({
      id: typeof d.id === "string" ? d.id : genId(),
      label: typeof d.label === "string" ? d.label : `第 ${i + 1} 天`,
      startTime: typeof d.startTime === "string" ? d.startTime : "",
      startHotelName: d.startHotelName || d.hotelName || "",
      endHotelName: d.endHotelName || d.hotelName || "",
      spots: Array.isArray(d.spots)
        ? d.spots.map((sp) => ({
            ...makeSpot(),
            ...sp,
            stayDuration: typeof sp.stayDuration === "number" ? sp.stayDuration : 0,
            category: sp.category ?? null,
          }))
        : [],
    }));
  }
  if (s.routes && typeof s.routes === "object") {
    Object.keys(s.routes).forEach((k) => {
      const r = s.routes[k] || {};
      out.routes[k] = {
        transport: r.transport || out.settings.defaultTransport,
        recordedTime: typeof r.recordedTime === "number" ? r.recordedTime : 0,
      };
    });
  }
  const hasActive = out.days.some((d) => d.id === s.activeDayId);
  out.activeDayId = hasActive ? s.activeDayId : out.days[0].id;
  return out;
}

// ---------------- 執行期狀態 ----------------
let allTrips = []; // 全部行程（每筆為單行程 state 形狀）
let activeIdx = 0; // 目前作用中的行程索引
let state = load(); // 作用中行程的即時內容（= allTrips[activeIdx]）
const undoStack = [];
const redoStack = [];
const listeners = new Set();

function safeParse(str) {
  try {
    return str ? JSON.parse(str) : null;
  } catch (_) {
    return null;
  }
}

/** 載入多行程容器（含舊單行程遷移），設定 allTrips/activeIdx，回傳作用中行程狀態 */
function load() {
  const container = safeParse(localStorage.getItem(TRIPS_KEY));
  const legacy = safeParse(localStorage.getItem(LEGACY_KEY));
  const norm = normalizeTripsContainer(container, legacy);
  if (!norm.trips.length) {
    norm.trips = [defaultState()];
    norm.activeIdx = 0;
  }
  allTrips = norm.trips;
  activeIdx = norm.activeIdx;
  return migrateState(allTrips[activeIdx]);
}

/** 將作用中行程寫回容器並持久化整個 trips 集合 */
function persist() {
  try {
    allTrips[activeIdx] = state;
    localStorage.setItem(TRIPS_KEY, JSON.stringify({ trips: allTrips, activeIdx }));
  } catch (_) {
    /* 配額或隱私模式：忽略 */
  }
}

export function getState() {
  return state;
}

/** 訂閱狀態變更；回傳取消訂閱函式 */
export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notify() {
  listeners.forEach((fn) => fn(state));
}

/**
 * 以 mutator 變更狀態。
 * @param {(draft:object)=>void} mutator - 直接改動傳入的複本
 * @param {{history?:boolean, render?:boolean}} [opts]
 *   history:true(預設) 會先推入 undo 快照；render:true(預設) 會通知重繪
 */
export function commit(mutator, opts = {}) {
  const { history = true, render = true } = opts;
  if (history) {
    undoStack.push(structuredClone(state));
    if (undoStack.length > HISTORY_LIMIT) undoStack.shift();
    redoStack.length = 0;
  }
  const draft = structuredClone(state);
  mutator(draft);
  state = draft;
  persist();
  if (render) notify();
}

/** 手動推入一個 undo 快照（用於文字輸入：打字前先存 pre-edit 狀態） */
export function pushUndo() {
  undoStack.push(structuredClone(state));
  if (undoStack.length > HISTORY_LIMIT) undoStack.shift();
  redoStack.length = 0;
}

export function canUndo() { return undoStack.length > 0; }
export function canRedo() { return redoStack.length > 0; }

export function undo() {
  if (!undoStack.length) return;
  redoStack.push(structuredClone(state));
  state = undoStack.pop();
  persist();
  notify();
}

export function redo() {
  if (!redoStack.length) return;
  undoStack.push(structuredClone(state));
  state = redoStack.pop();
  persist();
  notify();
}

/** 取得目前作用中的一天（找不到回退第一天） */
export function getActiveDay() {
  return state.days.find((d) => d.id === state.activeDayId) || state.days[0];
}

/** 以匯入資料取代作用中行程（經 migrateState 容錯）；清空歷史後存檔重繪 */
export function importState(raw) {
  state = migrateState(raw);
  undoStack.length = 0;
  redoStack.length = 0;
  persist();
  notify();
}

// ---------------- 多行程管理 ----------------
/** 目前所有行程的摘要清單（index / name / days / active） */
export function listTrips() {
  return tripSummaries(allTrips, activeIdx);
}

/** 目前作用中的行程索引 */
export function activeTripIndex() {
  return activeIdx;
}

/** 載入 activeIdx 指向的行程為作用狀態；清空歷史、存檔、重繪 */
function loadActive() {
  state = migrateState(allTrips[activeIdx]);
  undoStack.length = 0;
  redoStack.length = 0;
  persist();
  notify();
}

/** 新增一筆空白行程並切換過去 */
export function newTrip() {
  allTrips[activeIdx] = state; // 先固化目前行程
  allTrips.push(defaultState());
  activeIdx = allTrips.length - 1;
  loadActive();
}

/** 切換到指定索引的行程 */
export function switchTrip(idx) {
  if (idx === activeIdx || idx < 0 || idx >= allTrips.length) return;
  allTrips[activeIdx] = state;
  activeIdx = idx;
  loadActive();
}

/** 刪除指定索引的行程（至少保留一筆） */
export function deleteTrip(idx) {
  if (allTrips.length <= 1 || idx < 0 || idx >= allTrips.length) return;
  allTrips[activeIdx] = state;
  const r = removeAt(allTrips, activeIdx, idx);
  allTrips = r.trips;
  activeIdx = r.activeIdx;
  loadActive();
}

/**
 * 重新命名指定索引的行程（即時儲存，不記歷史、不重繪以保留輸入游標）。
 * 作用中行程改寫 state.tripName；其餘直接改寫 allTrips[idx]（不可變）。
 * @param {number} idx
 * @param {string} name
 */
export function renameTrip(idx, name) {
  if (idx < 0 || idx >= allTrips.length) return;
  if (idx === activeIdx) {
    state = { ...state, tripName: name };
  } else {
    allTrips[idx] = { ...allTrips[idx], tripName: name };
  }
  persist();
}
