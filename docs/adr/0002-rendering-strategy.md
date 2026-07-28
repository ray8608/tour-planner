# ADR-0002：安全的 innerHTML 全量重繪 + CSS 切版面

**日期**：2026-07-27
**狀態**：accepted

## 背景

規格採 `innerHTML` 字串拼接全量重繪。使用者內容（景點名稱、備註、飯店名、行程名）直接嵌入 HTML 字串有 XSS 風險。

## 決策

維持 **`innerHTML` 全量重繪**（DOM 節點數有限，效能足夠），但**所有使用者產生內容一律經 `escapeHtml()` 跳脫**：

```js
function escapeHtml(str) {
  if (str == null) return '';
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}
```

渲染流程：`setState(updater) → saveTrips()（localStorage）→ render()`。

版面 A/B/C 以 **CSS class 切換**（`.layout-a/.layout-b/.layout-c` 控制 `display`）而非 JS 產生不同結構，大幅減少 render 分支。

## 理由

全量重繪確保 UI 永遠反映 state；跳脫是唯一必要的安全防線；CSS 切版面讓三種版面共用同一 DOM 結構。

[[0001-multi-file-es-modules]] [[0003-state-undo-redo]]
