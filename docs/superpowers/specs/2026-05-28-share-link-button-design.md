# 分享連結按鈕設計文件

**日期：** 2026-05-28  
**功能：** 在共用區行程列表加入「分享」按鈕，讓使用者隨時複製已上傳行程的分享連結

---

## 問題

目前分享連結只在上傳後短暫顯示，使用者若未記錄則無法再取得。

---

## 解法

行程的分享連結可由 Firestore doc ID 隨時重建（`?import=<trip.id>`），無需重新上傳。在每個行程列加入「分享」按鈕，一鍵複製連結即可。

---

## UI 設計

公開與非公開分頁的每個行程列：

```
[匯入]  [覆蓋]  [分享]  [管理]
```

「分享」按鈕樣式與其他按鈕（btn-ghost）一致。

**點擊行為：**
1. 組出 URL：`${location.origin}${location.pathname}?import=${trip.id}`
2. 呼叫 `navigator.clipboard.writeText(url)`
3. 按鈕文字短暫變成「✅」（1.5 秒後恢復），提示複製成功

---

## 實作範圍

1. `renderPublicTabBody()` 與 `renderPrivateTabBody()` 的行程列，在「覆蓋」與「管理」之間加入「分享」按鈕（`data-action="copy-trip-link" data-trip-id="${trip.id}"`）
2. 事件處理器：`copy-trip-link` → 組 URL → 複製到剪貼簿 → 短暫替換按鈕文字為「✅」

---

## 資料層

無任何後端或狀態變更，純前端操作。
