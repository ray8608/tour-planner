# ADR-0003：structuredClone 快照式 Undo/Redo（上限 50 步）

**日期**：2026-07-27
**狀態**：accepted

## 背景

規格採 `setState(updater)` 模式，每次修改深層複製整個 state 推入 undo stack。

## 決策

用瀏覽器原生 `structuredClone()` 做深層快照，`undoStack` 最多 50 步：

```js
function setState(updater, { recordHistory = true } = {}) {
  if (recordHistory) {
    undoStack.push(structuredClone(state));
    if (undoStack.length > 50) undoStack.shift();
    redoStack = [];
  }
  updater(state);
  saveTrips();
  render();
}
```

## 理由

`structuredClone()` 為原生實作、能處理 Date/Map/Set，優於 `JSON.parse(JSON.stringify())`；50 步 × ~50KB ≈ 2.5MB，可接受；無需引入命令模式等抽象。

## 不記錄 undo 的操作

版面切換、主題切換、字體切換、天氣自動抓取、API 查詢結果（OSRM 交通時間自動填入）。

[[0002-rendering-strategy]]
