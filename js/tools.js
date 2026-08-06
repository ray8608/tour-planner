/* ============================================================
   tools.js — 批次工具（UI 模組，自成一格）
   ------------------------------------------------------------
   兩個批次操作，皆與主渲染迴圈解耦：自建 #tools-root 容器、命令式管理
   對話框、以區域 querySelector 逐項更新進度，透過 state.js 的 commit()
   落地資料（commit 會重繪 #app，但不影響本模組的獨立容器）。

   1) 景點座標管理（openCoordManager）：列出所有景點並標示是否已定位，
      可勾選批次以 Nominatim（services/geocode.js，內建 2s 節流 + Photon 備援）查詢座標。
   2) 自動填通勤（openCommuteFill）：收集某天或所有天的路線段，逐段以
      geocode + OSRM 估算交通時間並填入，支援「覆蓋已有」與「每段緩衝分鐘」。
   ============================================================ */

import { escapeHtml, escapeAttr, routeKey, hotelStartId, hotelEndId } from "./utils.js";
import { getState, commit } from "./state.js";
import { openLocatePicker } from "./locate.js";
import { secondsToMinutes } from "./services/route.js";
import { geocodePlace, routeSeconds, navServiceName, activeGoogleKey, departureForDay, isGoogleAuthFailed } from "./services/nav.js";

let mount = null;

export function initTools() {
  if (mount) return;
  mount = document.createElement("div");
  mount.id = "tools-root";
  document.body.appendChild(mount);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && mount.dataset.open) closeTools();
  });
}

function openWith(html) {
  if (!mount) return;
  mount.innerHTML = `<div class="tool-backdrop"></div>${html}`;
  mount.dataset.open = "1";
  mount.querySelector(".tool-backdrop")?.addEventListener("click", closeTools);
  mount.querySelectorAll('[data-tool="close"]').forEach((b) => b.addEventListener("click", closeTools));
}

function closeTools() {
  if (!mount) return;
  mount.innerHTML = "";
  delete mount.dataset.open;
}

const cssId = (id) => (window.CSS && CSS.escape ? CSS.escape(id) : String(id).replace(/"/g, '\\"'));

/** 啟用了 Google 但金鑰驗證失敗時，於完成訊息追加提醒（否則空字串） */
function googleWarnSuffix() {
  return activeGoogleKey() && isGoogleAuthFailed()
    ? "（⚠ Google 驗證失敗，已改用免費服務，請檢查 API Key 並重新整理頁面）"
    : "";
}

/* ---------------- 景點座標管理 ---------------- */

export function openCoordManager() {
  if (!mount) initTools();
  const items = [];
  getState().days.forEach((day, i) => {
    const dayLabel = `第 ${i + 1} 天`;
    if ((day.startHotelName || "").trim()) {
      items.push({
        key: `hs_${day.id}`, kind: "hotel", dayId: day.id, field: "startHotelName",
        name: day.startHotelName.trim(), dayLabel: `${dayLabel}·起點`, hasCoords: day.startHotelLat != null,
      });
    }
    day.spots.forEach((spot) => {
      const name = (spot.name || "").trim();
      if (!name) return;
      items.push({
        key: `sp_${spot.id}`, kind: "spot", spotId: spot.id, dayId: day.id,
        name, dayLabel, hasCoords: spot.lat != null && spot.lng != null,
      });
    });
    if ((day.endHotelName || "").trim()) {
      items.push({
        key: `he_${day.id}`, kind: "hotel", dayId: day.id, field: "endHotelName",
        name: day.endHotelName.trim(), dayLabel: `${dayLabel}·終點`, hasCoords: day.endHotelLat != null,
      });
    }
  });

  const rows = items.length
    ? items
        .map(
          (it) => `
        <div class="tool-row" data-key="${escapeAttr(it.key)}">
          <input type="checkbox" class="tool-cb" data-key="${escapeAttr(it.key)}" ${it.hasCoords ? "" : "checked"} />
          <span class="tool-icon" data-key="${escapeAttr(it.key)}">${it.hasCoords ? "🟢" : "🔴"}</span>
          <span class="tool-row__name">${escapeHtml(it.name)}</span>
          <span class="tool-row__day">${escapeHtml(it.dayLabel)}</span>
          <button class="btn btn--sm btn--ghost tool-pick" data-key="${escapeAttr(it.key)}" title="手動選擇地點">選</button>
        </div>`
        )
        .join("")
    : `<div class="tool-empty">（尚無景點或飯店）</div>`;

  openWith(`
    <div class="tool-dialog" role="dialog" aria-modal="true" aria-label="座標管理">
      <div class="tool-title">🔍 座標管理</div>
      <p class="tool-desc">🟢 已定位 / 🔴 未定位。勾選後可批次查詢座標（供匯出 KML／CSV 定位更精準）；或按「選」手動挑選地點。透過${escapeHtml(navServiceName())}查詢，較慢請耐心等候。</p>
      <div class="tool-bar">
        <label class="tool-check"><input type="checkbox" id="tool-all" /> 全選</label>
        <button class="btn btn--sm btn--ghost" id="tool-fail">僅選未定位</button>
      </div>
      <div class="tool-list">${rows}</div>
      <div class="tool-status" id="tool-status"></div>
      <div class="tool-actions">
        <button class="btn btn--sm btn--ghost" data-tool="close">關閉</button>
        <button class="btn btn--sm btn--primary" id="tool-refresh" ${items.length ? "" : "disabled"}>查詢勾選項目</button>
      </div>
    </div>
  `);

  const cbFor = (key) => mount.querySelector(`.tool-cb[data-key="${cssId(key)}"]`);
  const iconFor = (key) => mount.querySelector(`.tool-icon[data-key="${cssId(key)}"]`);
  const statusEl = mount.querySelector("#tool-status");
  const refreshBtn = mount.querySelector("#tool-refresh");

  mount.querySelector("#tool-all")?.addEventListener("change", (e) => {
    items.forEach((it) => { const cb = cbFor(it.key); if (cb) cb.checked = e.target.checked; });
  });
  mount.querySelector("#tool-fail")?.addEventListener("click", () => {
    const allCb = mount.querySelector("#tool-all");
    if (allCb) allCb.checked = false;
    items.forEach((it) => { const cb = cbFor(it.key); if (cb) cb.checked = !it.hasCoords; });
  });

  // 每列「選」→ 開對話框（先關座標管理避免兩層對話框）
  mount.querySelectorAll(".tool-pick").forEach((btn) => {
    btn.addEventListener("click", () => {
      const it = items.find((x) => x.key === btn.dataset.key);
      if (!it) return;
      closeTools();
      openLocatePicker(
        it.kind === "hotel"
          ? { kind: "hotel", dayId: it.dayId, field: it.field }
          : { kind: "spot", dayId: it.dayId, spotId: it.spotId }
      );
    });
  });

  refreshBtn?.addEventListener("click", async () => {
    const selected = items.filter((it) => cbFor(it.key)?.checked);
    if (!selected.length) { statusEl.textContent = "請先勾選項目"; return; }
    refreshBtn.disabled = true;
    let ok = 0, fail = 0;
    for (let i = 0; i < selected.length; i++) {
      const it = selected[i];
      statusEl.textContent = `查詢中… ${i + 1} / ${selected.length}`;
      const icon = iconFor(it.key);
      if (icon) icon.textContent = "⏳";
      const geo = await geocodePlace(it.name);
      commit((d) => {
        const day = d.days.find((x) => x.id === it.dayId);
        if (!day) return;
        if (it.kind === "hotel") {
          if (it.field === "startHotelName") {
            day.startHotelLat = geo?.lat ?? null; day.startHotelLng = geo?.lng ?? null; day.startHotelAddress = geo?.address ?? "";
          } else {
            day.endHotelLat = geo?.lat ?? null; day.endHotelLng = geo?.lng ?? null; day.endHotelAddress = geo?.address ?? "";
          }
        } else {
          const sp = day.spots.find((x) => x.id === it.spotId);
          if (sp) { sp.lat = geo?.lat ?? null; sp.lng = geo?.lng ?? null; sp.resolvedAddress = geo?.address ?? null; }
        }
      });
      it.hasCoords = !!geo;
      if (icon) icon.textContent = geo ? "🟢" : "🔴";
      const cb = cbFor(it.key);
      if (cb) cb.checked = !geo;
      geo ? ok++ : fail++;
    }
    statusEl.textContent = `完成：成功 ${ok} 個` + (fail ? `、失敗 ${fail} 個（找不到地點）` : "") + googleWarnSuffix();
    refreshBtn.disabled = false;
  });
}

/* ---------------- 自動填通勤時間 ---------------- */

/** 收集路線段：每天以「飯店出發 → 各景點 → 飯店返回」串接相鄰節點 */
function collectSegments(days) {
  const list = Array.isArray(days) ? days : [days];
  const routes = getState().routes;
  const defaultTransport = getState().settings.defaultTransport;
  const segs = [];
  list.forEach((day) => {
    if (!day.spots.length) return;
    const fromNodes = [{ id: hotelStartId(day.id), name: day.startHotelName || "" }, ...day.spots];
    const toNodes = [...day.spots, { id: hotelEndId(day.id), name: day.endHotelName || "" }];
    fromNodes.forEach((from, i) => {
      const to = toNodes[i];
      const rk = routeKey(from.id, to.id);
      const route = routes[rk] || {};
      segs.push({
        rk,
        dayId: day.id,
        fromId: from.id,
        toId: to.id,
        fromName: (from.name || "").trim(),
        toName: (to.name || "").trim(),
        transport: route.transport || defaultTransport,
        hasTime: (route.recordedTime || 0) > 0,
      });
    });
  });
  return segs;
}

/** 解析節點座標：飯店端點優先用既有座標，無才 geocode；景點同理。以 cache 去重同名查詢 */
async function resolveNodeCoords(seg, endpoint, cache) {
  const day = getState().days.find((d) => d.id === seg.dayId);
  if (!day) return null;
  const nodeId = endpoint === "from" ? seg.fromId : seg.toId;
  const nodeName = endpoint === "from" ? seg.fromName : seg.toName;
  if (nodeId === hotelStartId(seg.dayId)) {
    if (day.startHotelLat != null && day.startHotelLng != null) return { lat: day.startHotelLat, lng: day.startHotelLng };
    return nodeName ? cachedGeocode(nodeName, cache) : null;
  }
  if (nodeId === hotelEndId(seg.dayId)) {
    if (day.endHotelLat != null && day.endHotelLng != null) return { lat: day.endHotelLat, lng: day.endHotelLng };
    return nodeName ? cachedGeocode(nodeName, cache) : null;
  }
  const spot = day.spots.find((s) => s.id === nodeId);
  if (!spot) return null;
  if (spot.lat != null && spot.lng != null) return { lat: spot.lat, lng: spot.lng };
  const nm = (spot.name || "").trim();
  return nm ? cachedGeocode(nm, cache) : null;
}

function cachedGeocode(name, cache) {
  if (cache.has(name)) return cache.get(name);
  const p = geocodePlace(name);
  cache.set(name, p);
  return p;
}

/**
 * @param {string} scope - dayId 或 "all"
 */
export function openCommuteFill(scope) {
  if (!mount) initTools();
  const state = getState();
  const days = scope === "all" ? state.days : state.days.filter((d) => d.id === scope);
  const scopeLabel = scope === "all" ? "（所有天）" : "（本天）";
  const segments = collectSegments(days);
  const fillable = segments.filter((s) => s.fromName && s.toName && s.transport !== "flight");

  openWith(`
    <div class="tool-dialog" role="dialog" aria-modal="true" aria-label="自動填通勤時間">
      <div class="tool-title">⏱ 自動填通勤時間${scopeLabel}</div>
      <p class="tool-desc">共 ${fillable.length} 段可估算路線，透過${escapeHtml(navServiceName())}逐段查詢，較慢請耐心等候。${activeGoogleKey() ? "大眾運輸會查真實班次耗時。" : "大眾運輸以開車路線近似。"}</p>
      <label class="tool-check"><input type="checkbox" id="tool-overwrite" checked /> 覆蓋已填入的時間</label>
      <label class="tool-field">
        <span>緩衝時間（分鐘）<small>　每段交通額外加上，供停車／找路等預留</small></span>
        <input type="number" id="tool-buffer" class="share-input" min="0" step="1" value="0" inputmode="numeric" />
      </label>
      <div class="tool-status" id="tool-status"></div>
      <div class="tool-actions">
        <button class="btn btn--sm btn--ghost" data-tool="close">關閉</button>
        <button class="btn btn--sm btn--primary" id="tool-run" ${fillable.length ? "" : "disabled"}>開始填入</button>
      </div>
    </div>
  `);

  const statusEl = mount.querySelector("#tool-status");
  const runBtn = mount.querySelector("#tool-run");

  runBtn?.addEventListener("click", async () => {
    const overwrite = mount.querySelector("#tool-overwrite")?.checked ?? true;
    const bufferMins = Math.max(0, parseInt(mount.querySelector("#tool-buffer")?.value || "0", 10) || 0);
    const targets = fillable.filter((s) => overwrite || !s.hasTime);
    const skippedExisting = fillable.length - targets.length;
    if (!targets.length) { statusEl.textContent = "沒有需要填入的路線段"; return; }

    runBtn.disabled = true;
    const cache = new Map();
    let ok = 0, fail = 0;
    for (let i = 0; i < targets.length; i++) {
      const seg = targets[i];
      statusEl.textContent = `查詢中… ${i + 1} / ${targets.length}`;
      const from = await resolveNodeCoords(seg, "from", cache);
      const to = await resolveNodeCoords(seg, "to", cache);
      if (!from || !to) { fail++; continue; }
      const secs = await routeSeconds(from, to, seg.transport, departureForDay(seg.dayId));
      if (secs == null) { fail++; continue; }
      const mins = secondsToMinutes(secs) + bufferMins;
      commit((d) => {
        if (!d.routes[seg.rk]) d.routes[seg.rk] = { transport: seg.transport, recordedTime: 0 };
        d.routes[seg.rk].recordedTime = mins;
      });
      ok++;
    }
    let msg = `完成：成功 ${ok} 段`;
    if (skippedExisting) msg += `、略過 ${skippedExisting} 段（已有時間）`;
    if (fail) msg += `、失敗 ${fail} 段（找不到地點）`;
    statusEl.textContent = msg + googleWarnSuffix();
    runBtn.disabled = false;
  });
}
