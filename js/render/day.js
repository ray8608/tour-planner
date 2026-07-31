/* ============================================================
   render/day.js — 日面板：日標題/出發時間/統計 + 時間軸脊柱
   時間軸序列：起點飯店 →（路線→景點）* → 返回路線 → 終點飯店
   ============================================================ */

import {
  escapeHtml,
  escapeAttr,
  fmtMins,
  routeKey,
  hotelStartId,
  hotelEndId,
  getDayDate,
  getDayIsoDate,
  SPOT_CATEGORIES,
  getCategory,
  TRANSPORT_MODES,
} from "../utils.js";
import { computeTimeline, computeDayStats, formatSlot } from "../timeline.js";
import { weatherBadgeParts } from "../services/weather.js";

export function renderDayPanel(state, day, ctx = {}) {
  const idx = state.days.indexOf(day);
  const slots = computeTimeline(day, state.routes);
  const stats = computeDayStats(day, slots, state.routes);
  const dateStr = getDayDate(state.tripStartDate, idx);
  const iso = getDayIsoDate(state.tripStartDate, idx);
  const weatherHtml = renderWeatherBadge(state, ctx.weather ? ctx.weather[iso] : undefined);

  return `
    <section class="day-panel" aria-label="${escapeAttr(day.label)}">
      <div class="day-head">
        <input class="day-title" type="text"
               data-action="day-label" data-day="${escapeAttr(day.id)}"
               value="${escapeAttr(day.label)}"
               placeholder="第 ${idx + 1} 天" aria-label="這一天的名稱" />
        <div class="day-head__meta">
          <label class="dur-field">
            <span>出發</span>
            <input class="time-input" type="time"
                   data-action="day-start-time" data-day="${escapeAttr(day.id)}"
                   value="${escapeAttr(day.startTime)}" aria-label="出發時間" />
          </label>
          ${dateStr ? `<span class="stat-chip">${escapeHtml(dateStr)}</span>` : ""}
          ${weatherHtml}
          ${renderStats(stats)}
        </div>
      </div>

      ${renderTimeline(state, day, slots)}

      <div class="app-header__actions" style="justify-content:flex-end;margin-top:16px;gap:8px">
        <button class="btn btn--ghost" data-action="auto-fill-day" data-day="${escapeAttr(day.id)}"
                title="自動查詢並填入本天各段交通時間">⏱ 自動填通勤</button>
        <button class="btn btn--ghost" data-action="copy-day" data-day="${escapeAttr(day.id)}">⧉ 複製此天</button>
        <button class="btn btn--ghost btn--danger" data-action="delete-day" data-day="${escapeAttr(day.id)}"
                ${state.days.length <= 1 ? "disabled" : ""}>🗑 刪除此天</button>
      </div>
    </section>
  `;
}

function renderWeatherBadge(state, cached) {
  if (!state.settings.weatherCity || !state.settings.weatherGeo) return "";
  if (cached === undefined) return `<span class="weather-badge weather-badge--loading">⏳</span>`;
  if (cached === null) return "";
  const p = weatherBadgeParts(cached);
  if (!p) return "";
  return `<span class="weather-badge">
    ${p.emoji ? `<span class="weather-icon">${p.emoji}</span>` : ""}
    <span class="weather-temp">${escapeHtml(p.temp)}</span>
    ${p.rain ? `<span class="weather-rain">${escapeHtml(p.rain)}</span>` : ""}
  </span>`;
}

function renderStats(stats) {
  if (stats.spotCount === 0) return "";
  const chips = [`<span class="stat-chip"><b>${stats.spotCount}</b> 景點</span>`];
  const stay = fmtMins(stats.stayTotal);
  if (stay) chips.push(`<span class="stat-chip">停留 <b>${escapeHtml(stay)}</b></span>`);
  const transit = fmtMins(stats.transitTotal);
  if (transit) chips.push(`<span class="stat-chip">交通 <b>${escapeHtml(transit)}</b></span>`);
  if (stats.totalMins !== null) {
    const total = fmtMins(stats.totalMins);
    if (total) chips.push(`<span class="stat-chip">共 <b>${escapeHtml(total)}</b></span>`);
  }
  if (stats.freeMins !== null && stats.freeMins < 0) {
    const over = fmtMins(Math.abs(stats.freeMins)) || "0m";
    chips.push(`<span class="stat-chip stat-chip--warn">⚠ 超時 <b>${escapeHtml(over)}</b></span>`);
  }
  return `<div class="day-stats">${chips.join("")}</div>`;
}

function renderTimeline(state, day, slots) {
  const items = [];

  // 起點飯店
  items.push(
    renderHotelItem({
      slot: slots[hotelStartId(day.id)],
      tag: "起點",
      dayId: day.id,
      field: "startHotelName",
      value: day.startHotelName,
      placeholder: "起點飯店 / 出發地",
    })
  );

  if (day.spots.length === 0) {
    items.push(`
      <li class="tl-item">
        <span class="tl-time"></span>
        <span class="tl-rail"><span class="tl-dot tl-dot--route"></span></span>
        <div class="tl-content">
          <p style="color:var(--text-muted);margin:8px 0">這一天還沒有景點，從下方新增第一個。</p>
        </div>
      </li>`);
  }

  day.spots.forEach((spot, i) => {
    const prevId = i === 0 ? hotelStartId(day.id) : day.spots[i - 1].id;
    const rk = routeKey(prevId, spot.id);
    items.push(renderRouteItem(state, day.id, rk, slots[rk]));
    items.push(renderSpotItem(state, day, spot, slots[spot.id]));
  });

  if (day.spots.length > 0) {
    const lastId = day.spots[day.spots.length - 1].id;
    const rk = routeKey(lastId, hotelEndId(day.id));
    items.push(renderRouteItem(state, day.id, rk, slots[rk]));
    items.push(
      renderHotelItem({
        slot: slots[hotelEndId(day.id)],
        tag: "終點",
        dayId: day.id,
        field: "endHotelName",
        value: day.endHotelName,
        placeholder: "終點飯店 / 返回地",
      })
    );
  }

  return `
    <ol class="timeline">${items.join("")}</ol>
    <div class="day-drop-zone" data-drop-zone data-day-id="${escapeAttr(day.id)}"
         aria-hidden="true" title="拖曳景點到此加入這一天"></div>
    <div class="add-spot-row">
      <button class="add-spot-btn" data-action="add-spot" data-day="${escapeAttr(day.id)}">＋ 新增景點</button>
    </div>
  `;
}

function renderHotelItem({ slot, tag, dayId, field, value, placeholder }) {
  return `
    <li class="tl-item">
      <span class="tl-time">${escapeHtml(formatSlot(slot))}</span>
      <span class="tl-rail"><span class="tl-dot tl-dot--hotel" style="--dot-color:var(--color-success)"></span></span>
      <div class="tl-content">
        <div class="hotel-card">
          <span class="hotel-card__tag">${escapeHtml(tag)}</span>
          <input type="text" data-action="hotel-name" data-day="${escapeAttr(dayId)}"
                 data-field="${escapeAttr(field)}" value="${escapeAttr(value)}"
                 placeholder="${escapeAttr(placeholder)}" aria-label="${escapeAttr(tag)}飯店名稱" />
        </div>
      </div>
    </li>`;
}

function renderRouteItem(state, dayId, rk, slot) {
  const route = state.routes[rk] || { transport: state.settings.defaultTransport, recordedTime: 0 };
  const rt = route.recordedTime || 0;
  const rh = Math.floor(rt / 60);
  const rm = rt % 60;
  const toggle = TRANSPORT_MODES.map(
    (m) => `<button data-action="route-transport" data-rk="${escapeAttr(rk)}" data-transport="${m.id}"
                    class="${route.transport === m.id ? "is-active" : ""}"
                    title="${m.label}" aria-label="${m.label}">${m.emoji}</button>`
  ).join("");
  return `
    <li class="tl-item">
      <span class="tl-time"><small>${slot && slot.end ? escapeHtml(slot.end) : ""}</small></span>
      <span class="tl-rail"><span class="tl-dot tl-dot--route"></span></span>
      <div class="tl-content">
        <div class="route-card">
          <span class="transport-toggle" role="group" aria-label="交通方式">${toggle}</span>
          <span class="route-mins">
            <input class="num-input" type="number" min="0" max="23"
                   data-action="route-time-h" data-rk="${escapeAttr(rk)}"
                   value="${rh || ""}" placeholder="0" aria-label="交通小時" /> <span>時</span>
            <input class="num-input" type="number" min="0" max="59" step="5"
                   data-action="route-time-m" data-rk="${escapeAttr(rk)}"
                   value="${rm || ""}" placeholder="0" aria-label="交通分鐘" /> <span>分</span>
          </span>
          <button class="btn btn--icon btn--ghost route-auto" data-action="auto-route"
                  data-day="${escapeAttr(dayId)}" data-rk="${escapeAttr(rk)}"
                  title="用 OSRM 估算交通時間" aria-label="自動估算交通時間">⚡</button>
        </div>
      </div>
    </li>`;
}

function renderSpotItem(state, day, spot, slot) {
  const cat = getCategory(spot.category);
  // 僅在 category 為合法 enum 時才組出 CSS 變數，避免不受信任的匯入狀態注入 style 屬性
  const catColor = cat ? `var(--cat-${cat.id})` : "var(--border-strong)";
  const h = Math.floor((spot.stayDuration || 0) / 60);
  const m = (spot.stayDuration || 0) % 60;
  const options = SPOT_CATEGORIES.map(
    (c) => `<option value="${c.id}" ${spot.category === c.id ? "selected" : ""}>${c.emoji} ${c.label}</option>`
  ).join("");

  return `
    <li class="tl-item" style="--cat-color:${catColor}">
      <span class="tl-time">${escapeHtml(formatSlot(slot))}</span>
      <span class="tl-rail"><span class="tl-dot" style="--dot-color:${catColor}"></span></span>
      <div class="tl-content">
        <div class="spot-card" style="--cat-color:${catColor}"
             data-spot-id="${escapeAttr(spot.id)}" data-day-id="${escapeAttr(day.id)}" draggable="true">
          <div class="spot-card__head">
            <span class="drag-handle" title="拖曳排序" aria-hidden="true">⠿</span>
            <span class="spot-cat" title="分類">${cat ? cat.emoji : "🏷"}</span>
            <input class="spot-name" type="text"
                   data-action="spot-name" data-day="${escapeAttr(day.id)}" data-spot="${escapeAttr(spot.id)}"
                   value="${escapeAttr(spot.name)}" placeholder="景點名稱" aria-label="景點名稱" />
            <div class="spot-card__actions">
              <button class="btn btn--icon btn--ghost ${spot.lat != null ? "is-located" : ""}"
                      data-action="geocode-spot"
                      data-day="${escapeAttr(day.id)}" data-spot="${escapeAttr(spot.id)}"
                      title="${spot.lat != null ? "已定位：" + escapeAttr(spot.resolvedAddress || "") : "以名稱定位座標"}"
                      aria-label="定位座標">${spot.lat != null ? "📍" : "🔍"}</button>
              <button class="btn btn--icon btn--ghost" data-action="move-spot-up"
                      data-day="${escapeAttr(day.id)}" data-spot="${escapeAttr(spot.id)}"
                      title="上移" aria-label="上移">↑</button>
              <button class="btn btn--icon btn--ghost" data-action="move-spot-down"
                      data-day="${escapeAttr(day.id)}" data-spot="${escapeAttr(spot.id)}"
                      title="下移" aria-label="下移">↓</button>
              <button class="btn btn--icon btn--ghost btn--danger" data-action="delete-spot"
                      data-day="${escapeAttr(day.id)}" data-spot="${escapeAttr(spot.id)}"
                      title="刪除" aria-label="刪除景點">✕</button>
            </div>
          </div>
          <div class="spot-card__body">
            <span class="dur-field">
              <label>停留</label>
              <input class="num-input" type="number" min="0" max="23"
                     data-action="spot-dur-h" data-day="${escapeAttr(day.id)}" data-spot="${escapeAttr(spot.id)}"
                     value="${h || ""}" placeholder="0" aria-label="停留小時" /> <span>時</span>
              <input class="num-input" type="number" min="0" max="59" step="5"
                     data-action="spot-dur-m" data-day="${escapeAttr(day.id)}" data-spot="${escapeAttr(spot.id)}"
                     value="${m || ""}" placeholder="0" aria-label="停留分鐘" /> <span>分</span>
            </span>
            <select class="cat-select" data-action="spot-category"
                    data-day="${escapeAttr(day.id)}" data-spot="${escapeAttr(spot.id)}" aria-label="分類">
              <option value="">未分類</option>
              ${options}
            </select>
          </div>
          <textarea class="spot-notes" rows="1"
                    data-action="spot-notes" data-day="${escapeAttr(day.id)}" data-spot="${escapeAttr(spot.id)}"
                    placeholder="備註 / 地址 / 訂位資訊…">${escapeHtml(spot.notes)}</textarea>
          ${
            spot.resolvedAddress
              ? `<a class="spot-address" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                  spot.lat != null && spot.lng != null ? spot.lat + "," + spot.lng : spot.resolvedAddress
                )}" target="_blank" rel="noopener">📌 ${escapeHtml(spot.resolvedAddress)}</a>`
              : ""
          }
        </div>
      </div>
    </li>`;
}
