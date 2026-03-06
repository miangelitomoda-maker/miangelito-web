# Windows USB Epson 打印桥（Mi Angelito POS）

## 作用
让 **网页 POS / Odoo 网页** 通过 HTTP 调用 Windows 电脑上的 USB Epson 热敏打印机（80mm）。

## 安装（一次性）
1) 在 Windows 上安装 Node.js (LTS)
2) 打开 PowerShell / CMD，进入本目录：
   `cd print-bridge-windows`
3) 执行：
   `npm install`

## 配置
- 在 Windows「控制面板 → 设备和打印机」确认你的打印机名称（例如：`EPSON TM-T20II`）。
- 修改 `config.json`：
  - `printerName`：打印机名称（留空=Windows默认打印机）
  - `apiKey`：设置一个强密码（POS 端也要填同样的）

## 启动
双击 `start.bat`（或运行 `npm start`）

启动后：
- `Print Bridge listening on http://0.0.0.0:7777`

## 测试
手机（同一 Wi-Fi）浏览器打开：
- `http://<Windows电脑IP>:7777/health`

返回 `ok:true` 即正常。

## POS 端配置
在 `js/config.js` 填：
- `PRINT_BRIDGE_URL: "http://<Windows电脑IP>:7777"`
- `PRINT_BRIDGE_KEY: "<你的apiKey>"`
- `PRINTER_NAME: "<你的printerName>"`

然后在 POS：
- `Cobrar → Guardar`  会优先走 80mm 打印桥（失败自动回退浏览器打印）。
