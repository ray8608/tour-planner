#!/usr/bin/env python3
"""開發用靜態伺服器。

零建置 ES module 架構沒有檔名 hash，瀏覽器很容易把舊版模組 / CSS
快取在記憶體，導致「改了程式卻要 Ctrl+Shift+R 才更新」。
此伺服器對所有回應送出 no-store 快取標頭，開發時重新整理即為最新，
不再需要硬重整。

用法：
    python3 serve.py [port]     # 預設 8080

僅供本機開發；正式部署走 GitHub Pages，與此檔無關。
"""
import os
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

# 不論從哪個工作目錄啟動，都服務此腳本所在的專案根目錄
os.chdir(os.path.dirname(os.path.abspath(__file__)))

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8080


class NoCacheHandler(SimpleHTTPRequestHandler):
    """在標準靜態服務上，強制停用快取並修正 JS MIME 型別。"""

    # 確保 ES module 以正確 MIME 送出（少數系統缺 .mjs 對應）
    extensions_map = {
        **SimpleHTTPRequestHandler.extensions_map,
        ".js": "text/javascript",
        ".mjs": "text/javascript",
    }

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def log_message(self, fmt, *args):
        # 靜音每次請求的雜訊，只在需要時保留錯誤
        pass


if __name__ == "__main__":
    with ThreadingHTTPServer(("", PORT), NoCacheHandler) as httpd:
        print(f"Dev server on http://localhost:{PORT}/  (no-cache，改完重整即最新)")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nstopped")
