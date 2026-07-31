/* ============================================================
   render/index.js — 頂層渲染：App shell、頁首、版面分派、設定抽屜、行動快捷列
   純函式，回傳 HTML 字串；動態值一律經 escapeHtml / escapeAttr。
   版面（A/B/C）由 state.settings.layout 決定；設定抽屜開關為純 UI（html[data-settings]）。
   ============================================================ */

import {
  escapeHtml,
  escapeAttr,
  getDayDate,
  getDayIsoDate,
  THEMES,
  TRANSPORT_MODES,
} from "../utils.js";
import { canUndo, canRedo, listTrips } from "../state.js";
import { weatherBadgeParts } from "../services/weather.js";
import { isCloudEnabled } from "../services/firebase.js";
import { renderDayPanel } from "./day.js";

const LAYOUTS = [
  { id: "A", label: "頁籤", icon: "▭" },
  { id: "B", label: "側欄", icon: "◧" },
  { id: "C", label: "捲動", icon: "≣" },
];
const FONT_SIZES = [
  { id: "small", label: "小", cue: "A" },
  { id: "normal", label: "中", cue: "A" },
  { id: "large", label: "大", cue: "A" },
];
const THEME_LABELS = { cream: "手帳", light: "明亮", dark: "暗色", cyberpunk: "霓虹" };
const WEATHER_MODELS = [
  { id: "", label: "自動（依國家）" },
  { id: "best_match", label: "Best match" },
  { id: "jma_seamless", label: "日本 JMA" },
  { id: "icon_seamless", label: "歐洲 ICON" },
  { id: "gfs_seamless", label: "美國 GFS" },
  { id: "ecmwf_ifs025", label: "ECMWF IFS" },
  { id: "cma_grapes_global", label: "中國 CMA" },
];

/** 整個 App 的 HTML。ctx 提供跨切面的檢視資料（如天氣快取）。 */
export function renderApp(state, ctx = {}) {
  const active = state.days.find((d) => d.id === state.activeDayId) || state.days[0];
  return `
    <div class="app app--layout-${escapeAttr(state.settings.layout)}">
      ${renderHeader(state)}
      ${renderBody(state, active, ctx)}
    </div>
    ${renderMobileBar(state)}
    ${renderSettingsPanel(state, ctx)}
    ${renderTripMenu()}
    ${renderHelpOverlay()}
  `;
}

/** 行程管理選單（切換 / 新增 / 刪除多趟行程）；開關為純 UI（html[data-trips]） */
function renderTripMenu() {
  const trips = listTrips();
  const items = trips
    .map(
      (t) => `
      <li class="trip-menu__item ${t.active ? "is-active" : ""}">
        <button class="trip-menu__pick" data-action="select-trip" data-index="${t.index}"
                title="切換到此行程" aria-label="切換到 ${escapeAttr(t.name || t.placeholder)}"
                aria-pressed="${t.active}">
          <span class="trip-menu__radio" aria-hidden="true"></span>
        </button>
        <input class="trip-menu__name" type="text"
               data-action="rename-trip" data-index="${t.index}"
               value="${escapeAttr(t.name)}" placeholder="${escapeAttr(t.placeholder)}"
               aria-label="行程名稱" />
        <span class="trip-menu__days">${t.days} 天</span>
        <button class="btn btn--icon btn--ghost btn--danger trip-menu__del"
                data-action="delete-trip" data-index="${t.index}"
                title="刪除此行程" aria-label="刪除行程 ${escapeAttr(t.name || t.placeholder)}"
                ${trips.length <= 1 ? "disabled" : ""}>✕</button>
      </li>`
    )
    .join("");
  return `
    <div class="trip-menu-backdrop" data-action="close-trips" aria-hidden="true"></div>
    <aside class="trip-menu" role="dialog" aria-modal="true" aria-label="行程管理">
      <div class="trip-menu__head">
        <h2>我的行程</h2>
        <button class="btn btn--icon" data-action="close-trips" aria-label="關閉行程選單">✕</button>
      </div>
      <ul class="trip-menu__list">${items}</ul>
      <button class="btn btn--primary trip-menu__new" data-action="new-trip">＋ 新增行程</button>
    </aside>
  `;
}

/** 依 layout 分派主體 */
function renderBody(state, active, ctx) {
  switch (state.settings.layout) {
    case "B":
      return `
        <div class="layout-b">
          ${renderSidebar(state, ctx)}
          <main class="layout-b__main">
            ${active ? renderDayPanel(state, active, ctx) : renderEmptyTrip()}
          </main>
        </div>`;
    case "C":
      return `
        <div class="layout-c">
          ${
            state.days.length
              ? state.days.map((d) => renderDayPanel(state, d, ctx)).join("")
              : renderEmptyTrip()
          }
          <button class="btn btn--primary add-day-block" data-action="add-day">＋ 新增一天</button>
        </div>`;
    case "A":
    default:
      return `
        ${renderDayTabs(state)}
        ${active ? renderDayPanel(state, active, ctx) : renderEmptyTrip()}`;
  }
}

function renderHeader(state) {
  return `
    <header class="app-header">
      <div class="app-header__top">
        <div class="app-header__titles">
          <input class="trip-title" type="text"
                 data-action="trip-name"
                 value="${escapeAttr(state.tripName)}"
                 placeholder="為這趟旅程命名…"
                 aria-label="旅程名稱" />
          <div class="trip-subtitle">
            <input class="date-input" type="date"
                   data-action="trip-start-date"
                   value="${escapeAttr(state.tripStartDate)}"
                   aria-label="出發日期" />
            <span>${state.days.length} 天行程</span>
            <label class="weather-city">
              <span aria-hidden="true">🌤</span>
              <input type="text" data-action="weather-city"
                     value="${escapeAttr(state.settings.weatherCity)}"
                     placeholder="天氣城市" aria-label="天氣預報城市" />
            </label>
          </div>
        </div>
        <div class="app-header__actions">
          <button class="btn btn--ghost trip-switch" data-action="toggle-trips"
                  title="切換 / 管理行程" aria-label="行程管理" aria-haspopup="dialog">
            📋 <span class="trip-switch__label">行程</span>
          </button>
          ${isCloudEnabled()
            ? `<button class="btn btn--ghost trip-switch" data-action="open-share"
                    title="雲端共用" aria-label="雲端共用區" aria-haspopup="dialog">
                ☁️ <span class="trip-switch__label">共用</span>
              </button>`
            : ""}
          ${renderThemeDots(state)}
          <button class="btn btn--icon" data-action="undo" title="復原 (Ctrl+Z)"
                  aria-label="復原" ${canUndo() ? "" : "disabled"}>↶</button>
          <button class="btn btn--icon" data-action="redo" title="重做 (Ctrl+Y)"
                  aria-label="重做" ${canRedo() ? "" : "disabled"}>↷</button>
          <button class="btn btn--icon" data-action="open-help" title="使用說明"
                  aria-label="開啟使用說明" aria-haspopup="dialog">❓</button>
          <button class="btn btn--icon" data-action="toggle-settings" title="設定"
                  aria-label="開啟設定" aria-haspopup="dialog">⚙</button>
        </div>
      </div>
    </header>
  `;
}

function renderThemeDots(state) {
  const dots = THEMES.map(
    (t) => `<button class="theme-dot theme-dot--${t} ${state.settings.theme === t ? "is-active" : ""}"
                    data-action="set-theme" data-theme="${t}"
                    title="主題：${escapeAttr(THEME_LABELS[t] || t)}" aria-label="切換主題 ${escapeAttr(THEME_LABELS[t] || t)}"></button>`
  ).join("");
  return `<span class="theme-dots" role="group" aria-label="主題切換">${dots}</span>`;
}

/** Layout A：可水平捲動的天分頁 */
function renderDayTabs(state) {
  const tabs = state.days
    .map((d, i) => {
      const dateStr = getDayDate(state.tripStartDate, i);
      const isActive = d.id === state.activeDayId;
      return `
        <button class="day-tab ${isActive ? "is-active" : ""}"
                data-action="select-day" data-day="${escapeAttr(d.id)}"
                aria-pressed="${isActive}">
          <span class="day-tab__label">${escapeHtml(d.label || `第 ${i + 1} 天`)}</span>
          ${dateStr ? `<span class="day-tab__date">${escapeHtml(dateStr)}</span>` : ""}
        </button>`;
    })
    .join("");
  return `
    <nav class="day-tabs" aria-label="每日分頁">
      ${tabs}
      <button class="day-tab day-tab--add" data-action="add-day"
              title="新增一天" aria-label="新增一天">＋</button>
    </nav>
  `;
}

/** Layout B：側邊欄（各天摘要 + 天氣） */
function renderSidebar(state, ctx) {
  const items = state.days
    .map((d, i) => {
      const dateStr = getDayDate(state.tripStartDate, i);
      const isActive = d.id === state.activeDayId;
      const iso = getDayIsoDate(state.tripStartDate, i);
      const cached = ctx.weather ? ctx.weather[iso] : undefined;
      const wx = cached ? weatherBadgeParts(cached) : null;
      return `
        <button class="side-day ${isActive ? "is-active" : ""}"
                data-action="select-day" data-day="${escapeAttr(d.id)}"
                aria-pressed="${isActive}">
          <span class="side-day__label">${escapeHtml(d.label || `第 ${i + 1} 天`)}</span>
          <span class="side-day__meta">
            ${dateStr ? `<span class="side-day__date">${escapeHtml(dateStr)}</span>` : ""}
            ${wx ? `<span class="side-day__wx">${wx.emoji || ""} ${escapeHtml(wx.temp)}</span>` : ""}
          </span>
          <span class="side-day__count">${d.spots.length} 景點</span>
        </button>`;
    })
    .join("");
  return `
    <aside class="layout-b__side" aria-label="每日清單">
      ${items}
      <button class="side-day side-day--add" data-action="add-day"
              aria-label="新增一天">＋ 新增一天</button>
    </aside>
  `;
}

/** 行動裝置底部固定快捷列 */
function renderMobileBar(state) {
  const active = state.activeDayId;
  return `
    <nav class="mobile-bar" aria-label="快捷操作">
      <button class="mobile-bar__btn" data-action="add-spot" data-day="${escapeAttr(active)}"
              aria-label="新增景點">＋<small>景點</small></button>
      <button class="mobile-bar__btn" data-action="add-day"
              aria-label="新增一天">＋<small>天</small></button>
      <button class="mobile-bar__btn" data-action="undo" ${canUndo() ? "" : "disabled"}
              aria-label="復原">↶<small>復原</small></button>
      <button class="mobile-bar__btn" data-action="redo" ${canRedo() ? "" : "disabled"}
              aria-label="重做">↷<small>重做</small></button>
      <button class="mobile-bar__btn" data-action="toggle-settings"
              aria-label="設定">⚙<small>設定</small></button>
    </nav>
  `;
}

/** 設定抽屜（右側滑入）：版面 / 主題 / 字體 / 預設交通 / 天氣 / Google Maps */
function renderSettingsPanel(state, ctx) {
  const s = state.settings;
  const seg = (name, action, options, current) => {
    const btns = options
      .map(
        (o) => `<button class="seg-btn ${current === o.id ? "is-active" : ""}"
                        data-action="${action}" data-value="${escapeAttr(o.id)}"
                        aria-pressed="${current === o.id}">${escapeHtml(o.label)}</button>`
      )
      .join("");
    return `<div class="set-row"><span class="set-label">${escapeHtml(name)}</span>
      <div class="seg" role="group" aria-label="${escapeAttr(name)}">${btns}</div></div>`;
  };

  const modelOpts = WEATHER_MODELS.map(
    (m) => `<option value="${escapeAttr(m.id)}" ${s.weatherModel === m.id || (!s.weatherModel && m.id === "") ? "selected" : ""}>${escapeHtml(m.label)}</option>`
  ).join("");

  const mapsOn = s.mapsMode === "on";
  return `
    <div class="settings-backdrop" data-action="close-settings" aria-hidden="true"></div>
    <aside class="settings-panel" role="dialog" aria-modal="true" aria-label="設定">
      <div class="settings-panel__head">
        <h2>設定</h2>
        <button class="btn btn--icon" data-action="close-settings" aria-label="關閉設定">✕</button>
      </div>
      <div class="settings-panel__body">
        ${seg("版面", "set-layout", LAYOUTS, s.layout)}
        ${seg("字體大小", "set-font", FONT_SIZES, s.fontSize)}
        ${seg(
          "主題",
          "set-theme-btn",
          THEMES.map((t) => ({ id: t, label: THEME_LABELS[t] || t })),
          s.theme
        )}
        ${seg("預設交通", "set-transport", TRANSPORT_MODES.map((m) => ({ id: m.id, label: `${m.emoji} ${m.label}` })), s.defaultTransport)}

        <div class="set-row set-row--col">
          <span class="set-label">天氣城市</span>
          <input class="set-input" type="text" data-action="weather-city"
                 value="${escapeAttr(s.weatherCity)}" placeholder="例：Tokyo、台北" aria-label="天氣城市" />
        </div>
        <div class="set-row set-row--col">
          <span class="set-label">天氣模型</span>
          <select class="set-select" data-action="set-weather-model" aria-label="天氣模型">${modelOpts}</select>
        </div>

        <div class="set-row set-row--col">
          <span class="set-label">Google Maps API Key<small>（選填，啟用後座標／路線改用 Google）</small></span>
          <div class="seg" role="group" aria-label="Google Maps 模式">
            <button class="seg-btn ${!mapsOn ? "is-active" : ""}" data-action="set-maps-mode" data-value="off" aria-pressed="${!mapsOn}">停用</button>
            <button class="seg-btn ${mapsOn ? "is-active" : ""}" data-action="set-maps-mode" data-value="on" aria-pressed="${mapsOn}">啟用</button>
          </div>
          <input class="set-input ${mapsOn ? "" : "is-hidden"}" type="text" data-action="set-maps-key"
                 value="${escapeAttr(s.mapsKey || "")}" placeholder="貼上 API Key" aria-label="Google Maps API Key" autocomplete="off" />
        </div>

        <div class="set-row set-row--col">
          <span class="set-label">工具<small>（批次操作；未填 API Key 時用免費 OpenStreetMap）</small></span>
          <div class="data-grid">
            <button class="btn btn--ghost" data-action="open-coord-manager" title="批次查詢景點座標">🔍 查座標</button>
            <button class="btn btn--ghost" data-action="auto-fill-all" title="自動填入所有天交通時間">⏱ 填通勤</button>
          </div>
        </div>

        <div class="set-row set-row--col set-data">
          <span class="set-label">資料<small>（匯出 / 匯入行程）</small></span>
          <div class="data-grid">
            <button class="btn btn--ghost" data-action="export-json" title="下載完整備份">⬇ JSON</button>
            <button class="btn btn--ghost" data-action="export-ics" title="匯出行事曆">📅 ICS</button>
            <button class="btn btn--ghost" data-action="export-kml" title="匯出 Google My Maps">🗺 KML</button>
            <button class="btn btn--ghost" data-action="export-csv" title="匯出試算表">📊 CSV</button>
            <button class="btn btn--ghost" data-action="export-notion" title="匯出 Notion 可匯入的 ZIP（Markdown + CSV）">🔗 Notion</button>
          </div>
          <label class="btn btn--ghost import-btn">
            ⬆ 匯入 JSON 備份
            <input type="file" accept=".json,application/json" data-action="import-file"
                   class="sr-only" aria-label="選擇 JSON 備份檔" />
          </label>
          <label class="btn btn--ghost import-btn">
            ⬆ 匯入 Notion ZIP
            <input type="file" accept=".zip,application/zip" data-action="import-notion-file"
                   class="sr-only" aria-label="選擇 Notion 匯出 ZIP" />
          </label>
        </div>
      </div>
    </aside>
  `;
}

/**
 * 使用說明覆蓋層。開關為純 UI（html[data-help="open"]），內容為靜態文件。
 * 雲端共用段落僅在 isCloudEnabled() 為真時顯示（與 ☁️ 共用按鈕的顯示條件一致）。
 * ⚠️ 新增功能時，請同步更新本頁內容與底部「最後更新」欄位。
 */
function renderHelpOverlay() {
  const cloudSection = isCloudEnabled()
    ? `
        <section class="help-section">
          <h3 class="help-section__title">☁️ 雲端共用</h3>
          <p class="help-item">• 點頂部 <b>☁️ 共用</b> 開啟共用區，預設為<b>公開</b>分頁。</p>
          <p class="help-item">• <b>↑ 上傳目前行程</b>：設定<b>刪除密碼</b>後上傳；之後要覆蓋或刪除該筆雲端行程都需輸入此密碼。</p>
          <p class="help-item">• <b>公開</b>行程所有人都能在公開分頁看到並匯入；<b>非公開</b>行程需輸入<b>暗號</b>查詢才看得到。</p>
          <p class="help-item">• 同一個暗號可放多筆行程，適合家族／小群體各自上傳版本互相比較。</p>
          <p class="help-item">• <b>覆蓋</b>：用目前行程更新某筆雲端行程（需密碼）。<b>管理</b>：更換密碼或刪除（需密碼）。</p>
          <p class="help-item">• 上傳成功後會產生<b>分享連結</b>（<code>?import=…</code>），對方開啟即跳出確認並自動匯入；點<b>分享</b>可隨時重新複製連結。</p>
          <p class="help-note">※ 密碼與暗號僅以 SHA-256 雜湊儲存，屬「防意外、非加密等級」的裝置端把關。</p>
        </section>`
    : "";
  return `
    <div class="help-backdrop" data-action="close-help" aria-hidden="true"></div>
    <aside class="help-panel" role="dialog" aria-modal="true" aria-label="使用說明">
      <div class="help-panel__head">
        <h2>❓ 使用說明</h2>
        <button class="btn btn--icon" data-action="close-help" aria-label="關閉使用說明">✕</button>
      </div>
      <div class="help-panel__body">
        <section class="help-section">
          <h3 class="help-section__title">🗓 行程規劃</h3>
          <p class="help-item">• 頂部輸入框可改<b>旅程名稱</b>與<b>出發日期</b>；設定日期後每天標籤自動顯示實際日期。</p>
          <p class="help-item">• 點 <b>📋 行程</b> 可<b>新增／切換／重新命名／刪除</b>多趟行程，各自獨立儲存。</p>
          <p class="help-item">• <b>＋ 新增一天</b> 增加天數；<b>＋ 新增景點</b> 在當天加入景點，可設定名稱、停留時間、備註與分類。</p>
          <p class="help-item">• 景點之間可設定<b>交通方式</b>與<b>交通時間</b>，時間軸會自動累加計算每站抵達／離開時間。</p>
          <p class="help-item">• 拖曳景點卡片可<b>調整順序</b>；每天可設定<b>出發地</b>與<b>當晚住宿</b>。</p>
          <p class="help-item">• 每段路線可點 <b>⏱</b> 自動估算單段交通時間；每天底部 <b>⏱ 自動填通勤</b> 可批次填入當天所有段。</p>
        </section>

        <section class="help-section">
          <h3 class="help-section__title">🔧 批次工具（設定面板）</h3>
          <p class="help-item">• <b>🔍 查座標</b>：列出所有景點並批次查詢地理座標（🟢 已定位 / 🔴 未定位），供匯出 KML／CSV 定位更精準。</p>
          <p class="help-item">• <b>⏱ 填通勤</b>：一鍵估算<b>所有天</b>各段交通時間，可選是否<b>覆蓋已有時間</b>並設定每段<b>緩衝分鐘</b>（供停車／找路預留）。</p>
          <p class="help-note">※ 預設透過免費 OpenStreetMap 服務（Nominatim + OSRM），逐段查詢較慢屬正常，大眾運輸以開車路線近似；於設定填入 Google Maps API Key 後改用 Google（座標更準、大眾運輸查真實班次）。</p>
        </section>

        <section class="help-section">
          <h3 class="help-section__title">💾 匯出 / 匯入（設定面板「資料」區）</h3>
          <p class="help-item">• <b>⬇ JSON</b>：下載完整備份；<b>⬆ 匯入 JSON 備份</b>：從備份還原（會覆蓋目前行程）。</p>
          <p class="help-item">• <b>📅 ICS</b>：匯出行事曆（需先設出發日期）；<b>🗺 KML</b>：匯入 Google My Maps；<b>📊 CSV</b>：試算表。</p>
          <p class="help-item">• <b>🔗 Notion</b>：匯出 Notion 可 import 的 <code>.zip</code>（頁面 Markdown＋行程／住宿／交通／攻略 CSV）。</p>
          <p class="help-item">• <b>⬆ 匯入 Notion ZIP</b>：讀取 Notion「Export → Markdown &amp; CSV」的 <code>.zip</code>，解析行程、住宿、航班、攻略與待辦（<b>取代式</b>，匯入前顯示數量摘要）。</p>
          <p class="help-note">※ Notion 匯出不含經緯度，匯入後請用 <b>🔍 查座標</b> 重新定位；地圖圖片不匯入、外部連結彙整到行程備註。</p>
        </section>
${cloudSection}
        <section class="help-section">
          <h3 class="help-section__title">↩ 復原 / 重做</h3>
          <p class="help-item">• <b>Ctrl/Cmd+Z</b> 復原、<b>Ctrl+Y</b>（或 <b>Cmd+Shift+Z</b>）重做；頂部 ↶ ↷ 按鈕功能相同。</p>
          <p class="help-item">• 按 <b>Esc</b> 可關閉設定、行程選單、共用面板與本說明。</p>
        </section>

        <section class="help-section">
          <h3 class="help-section__title">⚙️ 設定</h3>
          <p class="help-item">• <b>版面</b>：A 頁籤 / B 側邊欄 / C 垂直捲動；另可調<b>字體大小</b>。</p>
          <p class="help-item">• <b>主題</b>：手帳（預設）/ 明亮 / 暗色 / 霓虹；頂部色點可快速切換。</p>
          <p class="help-item">• <b>天氣城市</b>：輸入城市名顯示每天天氣（Open-Meteo，僅約未來 16 天），可選天氣模型。</p>
          <p class="help-item">• <b>Google Maps API Key</b>（選填）：啟用並填入後，景點座標查詢與自動填通勤改用 <b>Google Maps</b>（座標更準、大眾運輸查真實班次；Google 查不到時自動回退 OSM）；未填則全程使用免費 Nominatim / OSRM。</p>
        </section>
      </div>
      <div class="help-panel__foot">
        <b>最後更新</b>：新增 Notion 橋接——<b>🔗 Notion</b> 匯出 Notion 可 import 的 ZIP（Markdown＋CSV），<b>⬆ 匯入 Notion ZIP</b> 可讀取 Notion 匯出的 <code>.zip</code>（取代式，含住宿／航班／攻略／待辦與匯入摘要）（2026-07-31）
      </div>
    </aside>
  `;
}

function renderEmptyTrip() {
  return `
    <div class="empty-state">
      <h3>還沒有任何一天</h3>
      <p>新增第一天，開始編排你的行程。</p>
      <button class="btn btn--primary" data-action="add-day">＋ 新增一天</button>
    </div>
  `;
}
