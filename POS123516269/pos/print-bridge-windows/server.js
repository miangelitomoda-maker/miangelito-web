const fs = require("fs");
const path = require("path");
const express = require("express");
const bodyParser = require("body-parser");
const { execFile } = require("child_process");

const cfgPath = path.join(__dirname, "config.json");
const cfg = JSON.parse(fs.readFileSync(cfgPath, "utf8"));

const PORT = cfg.port || 7777;
const API_KEY = cfg.apiKey || "CHANGE_ME";
const DEFAULT_PRINTER = (cfg.printerName || "").trim();

const app = express();
app.use(bodyParser.json({ limit: "500kb" }));

app.get("/health", (req, res) => res.json({ ok: true, printer: DEFAULT_PRINTER || null, port: PORT }));

function printTextWindows(text, printerName){
  return new Promise((resolve, reject) => {
    const pn = (printerName || "").replace(/"/g,'""');
    // PowerShell: write temp file then Out-Printer
    const ps = `
$ErrorActionPreference='Stop';
$text = @"
${String(text).replace(/`/g,"``")}
"@;
$tmp = [System.IO.Path]::GetTempFileName();
[System.IO.File]::WriteAllText($tmp, $text, [System.Text.Encoding]::UTF8);
if ("${pn}".Length -gt 0) {
  Get-Content -Path $tmp | Out-Printer -Name "${pn}";
} else {
  Get-Content -Path $tmp | Out-Printer;
}
Remove-Item $tmp -Force;
`;
    execFile("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", ps], { windowsHide: true }, (err, stdout, stderr) => {
      if(err) return reject(new Error(stderr || err.message));
      resolve(true);
    });
  });
}

app.post("/print", async (req, res) => {
  try{
    const key = req.get("X-PRINT-KEY") || "";
    if(API_KEY && key !== API_KEY) return res.status(401).json({ ok:false, error:"Unauthorized" });

    const body = req.body || {};
    const text = body.text;
    const printerName = (body.printerName || DEFAULT_PRINTER || "").trim();
    if(!text) return res.status(400).json({ ok:false, error:"Missing text" });

    await printTextWindows(text, printerName);
    res.json({ ok:true });
  }catch(e){
    res.status(500).json({ ok:false, error:String(e.message || e) });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Print Bridge listening on http://0.0.0.0:${PORT}`);
  console.log(`Default printer: ${DEFAULT_PRINTER || "(Windows default)"}`);
});
