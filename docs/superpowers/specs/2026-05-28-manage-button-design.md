# 管理按鈕設計文件

**日期：** 2026-05-28  
**功能：** 將共用面板的刪除（垃圾桶）按鈕改為「管理」按鈕，內含刪除行程與更換密碼兩個選項

---

## 功能概述

使用者上傳共用行程後，目前只能刪除該行程。本次改動新增「更換密碼」功能，並將原本的垃圾桶按鈕整合為「管理」按鈕，透過彈出對話框提供兩個操作選項。

---

## UI 設計

### 行程列表列

原本：`[匯入] [覆蓋] [🗑]`  
改後：`[匯入] [覆蓋] [管理]`

「管理」按鈕樣式與現有「匯入」「覆蓋」按鈕一致。

### 管理對話框 — 主畫面（`manageView = 'main'`）

```
┌─────────────────────────────────┐
│ 管理：{行程名稱}            [✕] │
├─────────────────────────────────┤
│  [🔑 更換密碼]  [🗑 刪除行程]  │
└─────────────────────────────────┘
```

- 右上角 ✕ 關閉對話框
- 點「🔑 更換密碼」→ 切換為更換密碼畫面（同一對話框）
- 點「🗑 刪除行程」→ 執行現有刪除流程（與目前垃圾桶行為相同）

### 管理對話框 — 更換密碼畫面（`manageView = 'changePassword'`）

```
┌─────────────────────────────────┐
│ [←] 更換密碼：{行程名稱}   [✕] │
├─────────────────────────────────┤
│  舊密碼：[__________________]   │
│  新密碼：[__________________]   │
│  （錯誤提示，紅色）             │
│  [確認更換]                     │
└─────────────────────────────────┘
```

- ← 返回主畫面（不關閉對話框）
- 密碼欄位使用 `type="text" class="pw-mask"` 避免 Chrome 密碼管理器警告
- 確認更換時 loading 狀態（按鈕 disabled）
- 成功後關閉對話框
- 失敗（舊密碼錯誤）顯示紅色錯誤訊息

---

## 刪除流程（維持現有行為）

垃圾桶按鈕移除後，刪除行程改由「管理 → 🗑 刪除行程」觸發。執行邏輯不變：
1. 顯示確認提示
2. 使用者輸入刪除密碼
3. hash 後與 Firestore `passwordHash` 比對
4. 符合則刪除文件

---

## 更換密碼流程

1. 使用者輸入舊密碼 + 新密碼
2. `sha256(舊密碼)` → 與 Firestore 文件的 `passwordHash` 比對
3. 比對成功 → `sha256(新密碼)` → `doc.update({ passwordHash: newHash })`
4. 比對失敗 → 顯示「密碼錯誤」，欄位清空

---

## 狀態管理

在 `shareState` 新增：

```js
managingTrip: null,    // 目前開啟管理對話框的行程物件（null = 關閉）
manageView: 'main',    // 'main' | 'changePassword'
```

現有 `shareState` 欄位（`deletingTrip`、`deleteError` 等）維持不變，刪除流程繼續使用。

---

## 資料層

Firestore `shared_trips` 文件現有欄位：

| 欄位 | 說明 |
|------|------|
| `passwordHash` | 刪除密碼的 SHA-256 hash |
| `name` | 行程名稱 |
| 其他 | 不受影響 |

**無需 schema 變更。** 更換密碼只是更新 `passwordHash` 欄位。

---

## 實作範圍

1. `shareState` 新增 `managingTrip`、`manageView` 欄位
2. 行程列表渲染：垃圾桶按鈕 → 「管理」文字按鈕（`data-action="manage-trip"`）
3. `render()` 中加入管理對話框的 HTML（`managingTrip !== null` 時顯示）
4. 事件處理：
   - `manage-trip` → 設定 `managingTrip`、`manageView = 'main'`
   - `manage-close` → 清除 `managingTrip`
   - `manage-change-pw-view` → 切換 `manageView = 'changePassword'`
   - `manage-back` → 切換 `manageView = 'main'`
   - `manage-change-pw-submit` → 執行更換密碼邏輯
   - `manage-delete` → 觸發現有刪除流程
5. 新增 `changeTripPassword(trip, oldPw, newPw)` async 函數
