/* ============================================================
   locate.js — 選地點對話框（景點／飯店手動定位、候選挑選）
   ------------------------------------------------------------
   自建 #locate-root 獨立容器（比照 tools.js），與主渲染迴圈解耦。
   開啟即以目前名稱查 geocodeCandidates（nav 門面：Google 先、回退 OSM），
   列出多筆候選；點選任一列即以 commit 寫回座標與地址；可改字重搜、清除定位。
   target:
     { kind:"spot",  dayId, spotId }
     { kind:"hotel", dayId, field:"startHotelName"|"endHotelName" }
   ============================================================ */

import { escapeHtml, escapeAttr } from "./utils.js";
import { getState, commit } from "./state.js";
import { geocodeCandidates, navServiceName, activeGoogleKey, isGoogleAuthFailed } from "./services/nav.js";

let mount = null;

export function initLocate() {
  if (mount) return;
  mount = document.createElement("div");
  mount.id = "locate-root";
  document.body.appendChild(mount);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && mount.dataset.open) closeLocate();
  });
}

function closeLocate() {
  if (!mount) return;
  mount.innerHTML = "";
  delete mount.dataset.open;
}

/** 由 target 取得目前名稱與已解析地址（供標題/預填/狀態） */
function readTarget(target) {
  const day = getState().days.find((d) => d.id === target.dayId);
  if (!day) return null;
  if (target.kind === "spot") {
    const spot = day.spots.find((s) => s.id === target.spotId);
    if (!spot) return null;
    return { name: (spot.name || "").trim(), located: spot.lat != null, address: spot.resolvedAddress || "" };
  }
  const isStart = target.field === "startHotelName";
  return {
    name: ((isStart ? day.startHotelName : day.endHotelName) || "").trim(),
    located: (isStart ? day.startHotelLat : day.endHotelLat) != null,
    address: (isStart ? day.startHotelAddress : day.endHotelAddress) || "",
  };
}

/** 把選定座標/地址寫回 target（spot 或 hotel）；lat=null 表示清除定位 */
function saveTarget(target, lat, lng, address) {
  commit((d) => {
    const day = d.days.find((x) => x.id === target.dayId);
    if (!day) return;
    if (target.kind === "spot") {
      const sp = day.spots.find((x) => x.id === target.spotId);
      if (sp) { sp.lat = lat; sp.lng = lng; sp.resolvedAddress = address; }
      return;
    }
    if (target.field === "startHotelName") {
      day.startHotelLat = lat; day.startHotelLng = lng; day.startHotelAddress = address;
    } else {
      day.endHotelLat = lat; day.endHotelLng = lng; day.endHotelAddress = address;
    }
  });
}

export function openLocatePicker(target) {
  if (!mount) initLocate();
  const info = readTarget(target);
  if (!info) return;

  mount.innerHTML = `
    <div class="tool-backdrop"></div>
    <div class="tool-dialog" role="dialog" aria-modal="true" aria-label="選擇地點">
      <div class="tool-title">📍 選擇地點${info.name ? "：" + escapeHtml(info.name) : ""}</div>
      <p class="tool-desc">找不到或選錯時，可改下方關鍵字重新搜尋，再從候選清單挑選正確地點。透過${escapeHtml(navServiceName())}查詢。</p>
      <div class="tool-bar" style="gap:8px">
        <input type="text" id="locate-q" class="share-input" style="flex:1"
               value="${escapeAttr(info.name)}" placeholder="輸入地名或地址…" aria-label="搜尋地點" />
        <button class="btn btn--sm btn--primary" id="locate-search">搜尋</button>
      </div>
      <div class="tool-list" id="locate-list"></div>
      <div class="tool-status" id="locate-status"></div>
      <div class="tool-actions">
        <button class="btn btn--sm btn--ghost" data-locate="close">關閉</button>
        <button class="btn btn--sm btn--ghost btn--danger" id="locate-clear" ${info.located ? "" : "disabled"}>清除定位</button>
      </div>
    </div>`;
  mount.dataset.open = "1";

  const backdrop = mount.querySelector(".tool-backdrop");
  const input = mount.querySelector("#locate-q");
  const searchBtn = mount.querySelector("#locate-search");
  const listEl = mount.querySelector("#locate-list");
  const statusEl = mount.querySelector("#locate-status");
  const clearBtn = mount.querySelector("#locate-clear");

  backdrop?.addEventListener("click", closeLocate);
  mount.querySelector('[data-locate="close"]')?.addEventListener("click", closeLocate);

  const googleWarn = () =>
    activeGoogleKey() && isGoogleAuthFailed()
      ? "（⚠ Google 驗證失敗，已改用免費服務）"
      : "";

  async function runSearch() {
    const q = (input.value || "").trim();
    if (!q) { statusEl.textContent = "請先輸入地名或地址"; return; }
    searchBtn.disabled = true;
    listEl.innerHTML = "";
    statusEl.textContent = "查詢中…";
    let results = [];
    try {
      results = await geocodeCandidates(q);
    } catch (_) {
      results = [];
    }
    searchBtn.disabled = false;
    if (!results.length) {
      statusEl.textContent = "找不到，請改關鍵字重試" + googleWarn();
      return;
    }
    statusEl.textContent = `找到 ${results.length} 筆，點選採用` + googleWarn();
    listEl.innerHTML = results
      .map(
        (r, i) => `
        <button class="tool-row locate-pick" data-idx="${i}" style="width:100%;text-align:left;cursor:pointer">
          <span class="tool-icon">📌</span>
          <span class="tool-row__name">${escapeHtml(r.address || `${r.lat}, ${r.lng}`)}</span>
        </button>`
      )
      .join("");
    listEl.querySelectorAll(".locate-pick").forEach((btn) => {
      btn.addEventListener("click", () => {
        const r = results[Number(btn.dataset.idx)];
        if (!r) return;
        saveTarget(target, r.lat, r.lng, r.address || "");
        closeLocate();
      });
    });
  }

  searchBtn.addEventListener("click", runSearch);
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") runSearch(); });
  clearBtn?.addEventListener("click", () => {
    saveTarget(target, null, null, "");
    closeLocate();
  });

  // 開啟即自動搜一次（有名稱時）
  if (info.name) runSearch();
  else input.focus();
}
