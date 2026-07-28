/* ============================================================
   drag.js — 景點拖曳排序
   兩種操作：
     1) 拖到另一張卡片 → 插入到該卡片之前（moveSpotBefore，可跨天）
     2) 拖到某天的 drop zone → 附加到該天末端（moveSpotToDay）
   桌機用 HTML5 DnD；行動裝置用長按（200ms）觸控拖曳 + ghost 跟隨。
   移動的純變更邏輯在 spot-move.js（可獨立單元測試）；本檔只負責 DOM 接線。
   ============================================================ */

import { commit } from "./state.js";
import { moveSpotBefore, moveSpotToDay } from "./spot-move.js";

const LONG_PRESS_MS = 200; // 觸控長按進入拖曳的門檻
const TOUCH_SLOP = 5; // 長按前手指位移超過此像素視為捲動、取消拖曳

// ---------------- DOM 接線 ----------------
function clearDragClasses() {
  document
    .querySelectorAll(".dragging, .drag-over, .drag-over-zone")
    .forEach((el) => el.classList.remove("dragging", "drag-over", "drag-over-zone"));
}

/** 依 dropTarget 元素定位落點並套上高亮類別（拖曳中即時回饋） */
function highlightTarget(el, draggingSpotId) {
  document
    .querySelectorAll(".drag-over, .drag-over-zone")
    .forEach((n) => n.classList.remove("drag-over", "drag-over-zone"));
  const overCard = el && el.closest(".spot-card");
  const overZone = el && el.closest("[data-drop-zone]");
  if (overCard && overCard.dataset.spotId !== draggingSpotId) overCard.classList.add("drag-over");
  else if (overZone && !overCard) overZone.classList.add("drag-over-zone");
}

/** 依 dropTarget 元素套用實際移動（卡片優先於 drop zone） */
function applyDrop(el, spotId, fromDayId) {
  const card = el && el.closest(".spot-card");
  const zone = el && el.closest("[data-drop-zone]");
  if (card && card.dataset.spotId !== spotId) {
    commit((d) => moveSpotBefore(d, spotId, fromDayId, card.dataset.spotId, card.dataset.dayId));
  } else if (zone && !card) {
    commit((d) => moveSpotToDay(d, spotId, fromDayId, zone.dataset.dayId));
  }
}

/**
 * 綁定拖曳事件到 #app 根節點（事件委派；重繪替換內容不影響委派）。
 * @param {HTMLElement} root
 */
export function initDrag(root) {
  // ---- 桌機 HTML5 DnD ----
  let dragState = null;

  root.addEventListener("dragstart", (e) => {
    const card = e.target.closest(".spot-card");
    if (!card) return;
    // 從輸入元素起拖時取消，保留文字選取/互動；僅允許從卡片非互動區（含握把）起拖
    if (e.target.closest("input, textarea, select, a")) {
      e.preventDefault();
      return;
    }
    dragState = { spotId: card.dataset.spotId, fromDayId: card.dataset.dayId };
    card.classList.add("dragging");
    if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
  });

  root.addEventListener("dragend", () => {
    clearDragClasses();
    dragState = null;
  });

  root.addEventListener("dragover", (e) => {
    if (!dragState) return;
    const card = e.target.closest(".spot-card");
    const zone = e.target.closest("[data-drop-zone]");
    if (!card && !zone) return;
    e.preventDefault(); // 允許 drop
    if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
    highlightTarget(e.target, dragState.spotId);
  });

  root.addEventListener("dragleave", (e) => {
    const card = e.target.closest(".spot-card");
    const zone = e.target.closest("[data-drop-zone]");
    if (card) card.classList.remove("drag-over");
    if (zone) zone.classList.remove("drag-over-zone");
  });

  root.addEventListener("drop", (e) => {
    if (!dragState) return;
    e.preventDefault();
    applyDrop(e.target, dragState.spotId, dragState.fromDayId);
    dragState = null; // 落點若無效，dragend 亦會清理
  });

  // ---- 行動觸控長按拖曳 ----
  let touchDrag = null; // { spotId, fromDayId, offsetX, offsetY }
  let touchGhost = null; // 跟隨手指的複製卡片
  let touchTimer = null; // 長按計時器
  let touchStart = null; // 長按前的起始資訊

  const cancelTouch = () => {
    if (touchTimer) {
      clearTimeout(touchTimer);
      touchTimer = null;
    }
    touchStart = null;
    if (touchGhost) {
      touchGhost.remove();
      touchGhost = null;
    }
    clearDragClasses();
    touchDrag = null;
  };

  root.addEventListener(
    "touchstart",
    (e) => {
      const handle = e.target.closest(".drag-handle");
      if (!handle) return;
      const card = handle.closest(".spot-card");
      if (!card) return;
      const touch = e.touches[0];
      const rect = card.getBoundingClientRect();
      touchStart = {
        spotId: card.dataset.spotId,
        fromDayId: card.dataset.dayId,
        offsetX: touch.clientX - rect.left,
        offsetY: touch.clientY - rect.top,
        startX: touch.clientX,
        startY: touch.clientY,
        card,
        rect,
      };
      touchTimer = setTimeout(() => {
        if (!touchStart) return;
        const t = touchStart;
        touchDrag = { spotId: t.spotId, fromDayId: t.fromDayId, offsetX: t.offsetX, offsetY: t.offsetY };
        touchGhost = t.card.cloneNode(true);
        touchGhost.style.cssText =
          `position:fixed;z-index:9999;pointer-events:none;opacity:0.85;` +
          `width:${t.rect.width}px;left:${t.startX - t.offsetX}px;top:${t.startY - t.offsetY}px;` +
          `box-shadow:0 8px 24px rgba(0,0,0,0.4);`;
        document.body.appendChild(touchGhost);
        t.card.classList.add("dragging");
        touchStart = null;
      }, LONG_PRESS_MS);
    },
    { passive: true }
  );

  root.addEventListener(
    "touchmove",
    (e) => {
      const touch = e.touches[0];
      // 尚未進入拖曳：若位移超過門檻，視為捲動並取消長按
      if (!touchDrag) {
        if (touchStart && touchTimer) {
          const dx = touch.clientX - touchStart.startX;
          const dy = touch.clientY - touchStart.startY;
          if (Math.abs(dx) > TOUCH_SLOP || Math.abs(dy) > TOUCH_SLOP) {
            clearTimeout(touchTimer);
            touchTimer = null;
            touchStart = null;
          }
        }
        return;
      }
      if (!touchGhost) return;
      e.preventDefault(); // 拖曳中阻止頁面捲動
      touchGhost.style.left = touch.clientX - touchDrag.offsetX + "px";
      touchGhost.style.top = touch.clientY - touchDrag.offsetY + "px";
      // 暫時隱藏 ghost 才能命中其下方的落點元素
      touchGhost.style.display = "none";
      const el = document.elementFromPoint(touch.clientX, touch.clientY);
      touchGhost.style.display = "";
      highlightTarget(el, touchDrag.spotId);
    },
    { passive: false }
  );

  const endTouchDrag = (touch) => {
    if (touchTimer) {
      clearTimeout(touchTimer);
      touchTimer = null;
    }
    touchStart = null;
    if (!touchDrag) return;
    if (touchGhost) {
      touchGhost.remove();
      touchGhost = null;
    }
    clearDragClasses();
    const el = touch ? document.elementFromPoint(touch.clientX, touch.clientY) : null;
    applyDrop(el, touchDrag.spotId, touchDrag.fromDayId);
    touchDrag = null;
  };

  root.addEventListener("touchend", (e) => endTouchDrag(e.changedTouches[0]));
  root.addEventListener("touchcancel", cancelTouch);
}
