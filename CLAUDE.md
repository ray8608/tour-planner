# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

純瀏覽器旅遊行程規劃工具。無框架、無建置流程——直接用瀏覽器開啟 `tour-planner.html` 即可使用。

## Development

無需安裝或建置。開發時直接用瀏覽器開啟檔案：

```bash
open tour-planner.html          # macOS
xdg-open tour-planner.html      # Linux
```

或透過任意靜態伺服器（避免 CORS 問題）：

```bash
python3 -m http.server 8080
```

沒有測試框架、lint、或 CI pipeline。

## Architecture

**所有程式碼集中於 `tour-planner.html` 單一檔案**，結構如下：

1. **CSS**（`<style>`）— CSS 變數定義主題（dark/light），RWD breakpoints 在 600px 與 480px
2. **Firebase SDK**（CDN script tags）— `firebase-app-compat` + `firebase-firestore-compat`
3. **JavaScript**（單一 `<script>`）— 全部業務邏輯

### 狀態管理模式

單向資料流，無框架：

```
setState(updater) → updater(state) → save(localStorage) → render()
```

- `state`：主要應用狀態（tripName、days、routes、settings、activeDayId）
- `shareState`：共用面板 UI 狀態（與 Firebase 互動相關）
- `setState(fn)`：唯一修改 `state` 的入口，呼叫後自動存檔並重繪
- `setShareState(obj)`：直接 `Object.assign` 更新 `shareState` 再重繪

### 渲染模式

`render()` 每次整個重新生成 `#app` 的 innerHTML（字串拼接，非 Virtual DOM）。事件透過事件委派（event delegation）在 `#app` 層統一處理，以 `data-action` 屬性識別動作，`data-*` 傳遞參數。

### 三種版面（`state.settings.layout`）

| 值 | 函數 | 說明 |
|---|---|---|
| `A` | `renderLayoutA()` | 頁籤式 |
| `B` | `renderLayoutB()` | 側邊欄 |
| `C` | `renderLayoutC()` | 垂直捲動 |

### 時間軸計算

`computeTimeline(day)` 依出發時間 + 停留時間 + 交通時間，逐段累加計算每個 spot 與 route 的 `{start, end}`，結果存入 `slots` object（key 為 spotId 或 `fromId→toId`）。

### 路線資料結構

路線以 `state.routes` 儲存，key 為 `"spotId→spotId"`（由 `routeKey()` 生成）。飯店節點的 pseudo-id 為 `hs_{dayId}`（出發）與 `he_{dayId}`（返回）。

### 雲端共用

Firebase Firestore，collection：`shared_trips`。  
密碼與暗號均以 Web Crypto API SHA-256 hash 後儲存，明文不落地。  
`FIREBASE_CONFIG.projectId` 為空時自動停用雲端功能。

### 本地持久化

`localStorage` key：`travel-planner-v1`  
`travel-planner-imported-doc-id`：記錄最後匯入的雲端行程 docId

`migrateState(s)` 處理舊版資料升級（如舊版 `hotelName` 欄位拆分為 `startHotelName`/`endHotelName`）。

## 新增功能時需同步更新

1. `README.md` — 功能說明
2. `renderHelpOverlay()` — 說明頁面中的功能介紹文字
