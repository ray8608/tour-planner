# 旅遊規劃工具 — 設計規格

**日期：** 2026-05-20
**類型：** 單一 HTML 檔案，純 Vanilla JS，無外部依賴

---

## 1. 總覽

一個可在本地瀏覽器開啟的單一 `.html` 檔案，用於規劃多日旅遊行程。使用者可自訂天數，為每天新增景點與停留時間，並透過 Google Maps 連結查看路線與一鍵導航。

---

## 2. 功能範圍

### 2.1 行程管理
- 行程名稱可編輯（inline click-to-edit）
- 自由新增 / 刪除天數，天數標籤可重新命名（預設「第N天」）
- 每天可新增多個景點，景點支援拖拉排序（HTML5 Drag and Drop API，卡片左側顯示拖拉把手 ⠿）
- 支援跨天移動：將景點從一天拖拉至另一天的景點列表中
- 景點移動後，**原位置**的前後路線連接器與**新位置**的前後路線連接器 `recordedTime` 自動清空，Google Maps 路線連結依新順序自動更新
- 每個景點包含：名稱、預計停留時間、備註（選填）

### 2.2 景點間路線連接器
- 相鄰景點之間自動出現路線連接器
- 連接器包含：
  - 交通方式下拉選單（🚗 開車 / 🚌 大眾運輸 / 🚶 步行），預設繼承全局設定，可單獨覆蓋
  - 「查看路線 ↗」按鈕：開新分頁至 Google Maps 路線頁面
  - 手動填入車程時間欄位（自由文字，例如「25 分鐘」）

### 2.3 Google Maps 連結格式
- 單一景點導航：
  ```
  https://www.google.com/maps/search/?api=1&query={景點名稱}
  ```
- 景點 A → 景點 B 路線：
  ```
  https://www.google.com/maps/dir/?api=1&origin={景點A}&destination={景點B}&travelmode={driving|transit|walking}
  ```
- 景點名稱以 `encodeURIComponent()` 編碼後代入

### 2.4 設定面板（⚙️ icon，右上角）
- **版面配置**：A 頁籤式 / B 側邊欄式 / C 垂直捲動式（點選即時切換）
- **顏色主題**：🌙 Dark / ☀️ Light（點選即時切換）
- **預設交通方式**：🚗 開車 / 🚌 大眾運輸 / 🚶 步行

### 2.5 資料儲存
- **localStorage 自動儲存**：每次資料異動立即寫入 `localStorage`（key: `travel-planner-data`），重開瀏覽器資料保留
- **匯出 JSON**：點「📤 匯出」下載 `.json` 檔案，檔名含旅遊名稱與日期
- **匯入 JSON**：點「📥 匯入」讀取 `.json` 檔案，覆蓋當前資料（提示確認）

---

## 3. 資料結構

```json
{
  "tripName": "日本東京 5 日遊",
  "settings": {
    "layout": "A",
    "theme": "dark",
    "defaultTransport": "driving"
  },
  "days": [
    {
      "id": "day-xxxxxxxx",
      "label": "第1天",
      "spots": [
        {
          "id": "spot-xxxxxxxx",
          "name": "淺草寺",
          "stayDuration": "2 小時",
          "notes": ""
        }
      ]
    }
  ],
  "routes": {
    "spot-xxxxxxxx→spot-yyyyyyyy": {
      "transport": "transit",
      "recordedTime": "18 分鐘"
    }
  }
}
```

- `id` 使用 `Date.now() + Math.random()` 產生的短 hash
- `routes` key 格式為 `{fromId}→{toId}`，只在使用者覆蓋交通方式或填入時間時才寫入

---

## 4. 版面配置

### A — 頁籤式
- Header 下方顯示天數頁籤列，選中天以底線或顏色標示
- 主內容區顯示當前選中天的景點列表
- 適合天數少、一次專注一天

### B — 側邊欄式
- 左側固定寬度欄位顯示天數列表
- 右側主區域顯示選中天景點
- 適合天數多、需快速切換

### C — 垂直捲動式
- 所有天數依序垂直排列，每天有明顯區隔標題
- 全行程一覽無遺，方便截圖或列印

---

## 5. 主題配色

### Dark 主題
| 用途 | 色碼 |
|------|------|
| 頁面背景 | `#0f172a` |
| 卡片背景 | `#1e293b` |
| Header 背景 | `#1e293b` |
| 主文字 | `#f1f5f9` |
| 次要文字 | `#94a3b8` |
| Accent / 連結 | `#7dd3fc` |
| Accent 背景 | `#1e3a5f` |
| 分隔線 | `#334155` |
| 車程時間輸入框填入值 | `#fbbf24` |

### Light 主題
| 用途 | 色碼 |
|------|------|
| 頁面背景 | `#f8fafc` |
| 卡片背景 | `#ffffff` |
| Header 背景 | `#3b82f6` |
| 主文字 | `#1e293b` |
| 次要文字 | `#94a3b8` |
| Accent / 連結 | `#2563eb` |
| Accent 背景 | `#dbeafe` |
| 分隔線 | `#e2e8f0` |
| 車程時間輸入框填入值 | `#f59e0b` |

主題切換以 CSS 自訂屬性（CSS variables）實作，切換時在 `<html>` 加/移除 `data-theme="light"` 屬性。

---

## 6. 實作細節

### CSS 架構
- 所有顏色以 CSS 變數定義於 `:root`（dark）及 `[data-theme="light"]`
- 版面切換以 `[data-layout="A"|"B"|"C"]` class 控制顯示邏輯
- 動畫：設定面板以 `transform + opacity` 展開/收起

### JS 架構（無框架）
- 單一 `AppState` 物件持有所有資料
- `render()` 函式依 state 重新繪製整個 UI（簡單 DOM 操作）
- 每次 `setState()` 後自動呼叫 `saveToLocalStorage()` 與 `render()`
- 事件委派（event delegation）處理動態產生的元素點擊

### 無障礙
- 所有可互動元素有 `aria-label`
- 鍵盤可操作（Tab 導航、Enter 確認）

---

## 7. 不在範圍內

- 後端 / 伺服器
- 帳號登入 / 雲端同步
- Google Maps Directions API（即時車程計算）— 未來可擴充
- 地圖嵌入顯示
- 多語言支援

---

## 8. 檔案輸出

- 單一檔案：`tour-planner.html`
- 所有 CSS 與 JS 內嵌於 `<style>` 和 `<script>` 標籤
