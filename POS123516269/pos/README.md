# Mi Angelito Moda POS (Multi-file)

## 部署
把整个目录部署到 Cloudflare Pages（或任意静态服务器）。

## 维护规则（UI 锁定）
- `index.html`：UI 锁住（尽量不改）
- `js/config.js`：配置（API、店铺号、打印桥地址）
- `js/app.js`：功能逻辑（后续增强都在这里做）

下一步（功能增强优先级建议）：
1. Windows USB Epson 打印桥（网页一键 80mm）
2. 打印失败重试 + 队列
3. Odoo 也复用同一套打印桥


## 80mm 打印（Windows USB Epson）
见 `print-bridge-windows/README_WINDOWS_PRINT_BRIDGE.md`。
