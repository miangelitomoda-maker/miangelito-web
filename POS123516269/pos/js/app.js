(() => {
  const CLOUD_API = (window.POS_CONFIG && window.POS_CONFIG.CLOUD_API) || "https://www.miangelitomoda.com";
  const POS_API_KEY = (window.POS_CONFIG && window.POS_CONFIG.POS_API_KEY) || "";
  const SHOP_ID = (window.POS_CONFIG && window.POS_CONFIG.SHOP_ID) || "miangelito";
  let MACHINE_ID = localStorage.getItem("pos_machine_id") || "A";
  localStorage.setItem("pos_machine_id", MACHINE_ID);

  let lastBill = null;
  try{
    const raw = localStorage.getItem("pos_last_bill");
    if(raw) lastBill = JSON.parse(raw);
  }catch(e){}

  async function syncBillToCloud(payload){
    try{
      await fetch(CLOUD_API + "/api/bill", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-KEY": POS_API_KEY
        },
        body: JSON.stringify({
          shop_id: SHOP_ID,
          machine_id: MACHINE_ID,
          billNo: payload.billNo,
          tsMs: Date.now(),
          tsText: payload.ts,
          total: payload.total,
          paid: payload.paid,
          change: payload.change,
          sumQty: payload.sumQty,
          kinds: payload.kinds,
          customerName: payload.customerName || "",
          payload
        })
      });
      setConn(true, "已连接");
    }catch(e){
      console.warn("Cloud sync failed", e);
      setConn(false, "离线");
    }
  }

  const $ = (id) => document.getElementById(id);
  const fmtEUR = (n) => new Intl.NumberFormat("es-ES", { style:"currency", currency:"EUR" }).format(Number(n || 0));
  const money = (n) => (Math.round((Number(n) || 0) * 100) / 100).toFixed(2);

  function toNumber(x){
    const s = String(x || "").trim().replace(",", ".");
    if(!s) return NaN;
    const n = Number(s);
    return Number.isFinite(n) ? n : NaN;
  }

  let toastTimer = null;
  function toast(msg){
    const el = $("toast");
    if(!el) return;
    el.textContent = String(msg || "");
    el.classList.add("show");
    if(toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 1400);
  }

  function setConn(ok, label){
    const dot = $("dotConn");
    if(!dot) return;
    dot.classList.remove("ok", "bad");
    dot.classList.add(ok ? "ok" : "bad");
    $("connLabel").textContent = label;
  }

  const STORAGE_CUR = "POS_MOBILE_CUR_v5";
  let items = [];
  let step = "qty";
  let tmpQty = null;

  function loadCur(){
    try{
      const raw = localStorage.getItem(STORAGE_CUR);
      const v = raw ? JSON.parse(raw) : null;
      items = Array.isArray(v?.items) ? v.items : [];
    }catch{
      items = [];
    }
  }

  function saveCur(){
    localStorage.setItem(STORAGE_CUR, JSON.stringify({ items }));
  }

  function calc(){
    let total = 0, sumQty = 0;
    for(const it of items){
      total += Number(it.amount || 0);
      sumQty += Number(it.qty || 0);
    }
    return { total, sumQty, kinds: items.length };
  }

  function scrollListToBottom(force = false){
    const list = $("list");
    if(!list) return;
    requestAnimationFrame(() => {
      try{
        if(force){
          list.scrollTop = list.scrollHeight;
          return;
        }
        const maxScroll = list.scrollHeight - list.clientHeight;
        const nearBottom = (maxScroll - list.scrollTop) < 80;
        if(nearBottom || maxScroll <= 0) list.scrollTop = list.scrollHeight;
        else list.scrollTop = list.scrollHeight;
      }catch(e){}
    });
  }

  function render(){
    const { total, sumQty } = calc();
    $("kTotal").textContent = fmtEUR(total);
    $("kPieces").textContent = String(sumQty);

    const list = $("list");
    list.innerHTML = "";
    $("emptyHint").style.display = items.length ? "none" : "block";

    items.forEach((it, idx) => {
      const row = document.createElement("div");
      row.className = "it";
      row.innerHTML = `
        <div class="lineRow">
          <div class="lName">Ropa ${idx + 1}</div>
          <div class="lMid">${it.qty}×€${money(it.price)}</div>
          <div class="lAmt">€${money(it.amount)}</div>
          <button class="xDel" aria-label="删除" data-del="${idx}">✕</button>
        </div>
      `;
      list.appendChild(row);
    });

    list.querySelectorAll("button[data-del]").forEach(btn => {
      btn.addEventListener("click", () => {
        const i = Number(btn.getAttribute("data-del"));
        if(Number.isFinite(i)){
          items.splice(i, 1);
          saveCur();
          render();
          toast("已删除");
        }
      });
    });

    scrollListToBottom(true);
  }

  function setStep(next){
    step = next;
    const entry = $("line");
    const hint = $("lineStepHint");

    if(step === "qty"){
      entry.placeholder = "";
      if(hint) hint.textContent = "件数";
    }else{
      entry.placeholder = "";
      if(hint) hint.textContent = "单价";
    }
    entry.value = "";
  }

  function addItem(qty, price){
    const q = Number(qty);
    const p = Number(price);

    if(!Number.isFinite(q) || !Number.isInteger(q) || q === 0){
      toast("Piezas必须是整数");
      return false;
    }
    if(!Number.isFinite(p)){
      toast("Precio不对");
      return false;
    }

    const amount = Math.round(q * p * 100) / 100;
    items.push({ qty:q, price:p, amount });
    saveCur();
    render();
    return true;
  }

  function handleEnter(){
    const raw = String($("line").value || "").trim();
    if(!raw) return;

    const n = toNumber(raw);

    if(step === "qty"){
      if(!Number.isFinite(n) || !Number.isInteger(n) || n === 0){
        toast("Piezas必须是整数");
        return;
      }
      tmpQty = n;
      setStep("price");
      return;
    }

    if(step === "price"){
      if(!Number.isFinite(n)){
        toast("Precio不对");
        return;
      }
      const ok = addItem(tmpQty, n);
      if(ok){
        tmpQty = null;
        setStep("qty");
        toast("Añadido");
      }
    }
  }

  let entryEl = null;
  function setEntryTarget(el){
    entryEl = el || $("line");
  }

  function wantFocusEl(){
    const m = $("mask");
    if(m && m.style.display === "flex") return $("fPaid");
    return $("line");
  }

  function keepFocus(){
    const el = wantFocusEl();
    if(!el) return;
    if(document.activeElement === el) return;

    if(document.activeElement && document.activeElement.tagName === "BUTTON"){
      setTimeout(() => {
        try{ el.focus({ preventScroll:true }); }
        catch(e){ try{ el.focus(); }catch(_){} }
      }, 0);
      return;
    }

    try{ el.focus({ preventScroll:true }); }
    catch(e){ try{ el.focus(); }catch(_){} }
  }

  setInterval(keepFocus, 250);
  window.addEventListener("focus", () => setTimeout(keepFocus, 0));
  document.addEventListener("visibilitychange", () => {
    if(!document.hidden) setTimeout(keepFocus, 0);
  });

  function setEntry(v){
    const el = entryEl || $("line");
    el.value = v;
    if(el.id === "fPaid") updateChange();
  }

  function getEntry(){
    const el = entryEl || $("line");
    return String(el.value || "");
  }

  function appendChar(ch){
    let v = getEntry();

    if(ch === "."){
      if(!v) return setEntry("0.");
      if(v.includes(".")) return;
      return setEntry(v + ".");
    }

    if(/^\d$/.test(ch)){
      if(v === "0" && !v.includes(".")) return setEntry(ch);
      if(v === "-0" && !v.includes(".")) return setEntry("-" + ch);
      return setEntry(v + ch);
    }
  }

  function backspace(){
    const v = getEntry();
    if(!v) return;
    setEntry(v.slice(0, -1));
  }

  function clearEntry(){ setEntry(""); }

  function toggleSign(){
    let v = getEntry();
    if(!v) return setEntry("-");
    if(v === "-") return setEntry("");
    if(v.startsWith("-")) return setEntry(v.slice(1));
    return setEntry("-" + v);
  }

  const btnMinus = $("btnMinus");
  if(btnMinus){
    const onMinus = (e) => {
      e.preventDefault();
      toggleSign();
    };
    btnMinus.addEventListener("click", onMinus, { passive:false });
    btnMinus.addEventListener("touchstart", onMinus, { passive:false });
  }

  const keypadEl = $("keypad");

  function syncKeypadHeight(){
    try{
      const h = Math.round(keypadEl.getBoundingClientRect().height);
      if(h > 0) document.documentElement.style.setProperty("--kpH", h + "px");
    }catch(e){}
  }

  window.addEventListener("resize", syncKeypadHeight);
  setTimeout(syncKeypadHeight, 0);

  function onKey(e){
    const b = e.target.closest("button");
    if(!b) return;

    const k = b.getAttribute("data-k");
    if(!k) return;

    e.preventDefault();

    if(k === "bk") return backspace();
    if(k === "c") return clearEntry();
    if(k === "dot") return appendChar(".");

    const inPay = (entryEl && entryEl.id === "fPaid" && $("mask").style.display === "flex");
    if(inPay){
      if(k === "plus" || k === "ok") return $("btnSaveNoPrint").click();
      if(k === "minus") return;
    }

    if(k === "minus") return toggleSign();
    if(k === "plus") return handleEnter();
    if(k === "ok") return handleEnter();
    return appendChar(k);
  }

  keypadEl.addEventListener("click", onKey, { passive:false });
  keypadEl.addEventListener("touchstart", onKey, { passive:false });

  const mask = $("mask");

  function openPay(){
    const { total } = calc();
    if(total === 0){
      toast("No hay ropa en el ticket");
      return;
    }
    $("fTotal").value = money(total);
    $("fPaid").value = "";
    $("fChange").textContent = "0.00";
    mask.style.display = "flex";
    setEntryTarget($("fPaid"));
    setTimeout(() => {
      $("fPaid").focus();
      $("fPaid").select();
    }, 0);
  }

  function closePay(){
    mask.style.display = "none";
    setEntryTarget($("line"));
  }

  function updateChange(){
    const total = toNumber($("fTotal").value);
    const paid = toNumber($("fPaid").value);
    if(!Number.isFinite(paid)){
      $("fChange").textContent = "0.00";
      return;
    }
    $("fChange").textContent = money(paid - total);
  }

  function billNoFromDate(d){
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const da = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    const ss = String(d.getSeconds()).padStart(2, "0");
    return `${y}${m}${da}-${hh}${mm}${ss}`;
  }

  function buildPayload(paidOverride){
    const { total, sumQty, kinds } = calc();
    const now = new Date();
    const billNo = billNoFromDate(now);
    const paid = Number.isFinite(paidOverride) ? paidOverride : total;
    const change = paid - total;

    return {
      ts: now.toLocaleString("es-ES"),
      billNo,
      items: items.map((it, i) => ({ name:`Ropa ${i + 1}`, qty:it.qty, price:it.price, amount:it.amount })),
      total,
      paid,
      change,
      sumQty,
      kinds
    };
  }

  function receiptText(payload){
    const p = payload;
    const lines = [];
    lines.push("MI ANGELITO MODA");
    lines.push(`Ticket Nº: ${p.billNo}`);
    lines.push(`Fecha: ${p.ts}`);
    lines.push("");
    lines.push("Detalle:");
    (p.items || []).forEach((it, idx) => lines.push(`${idx + 1}. ${it.name}  ${it.qty} × ${money(it.price)}  = ${money(it.amount)}`));
    lines.push("");
    lines.push(`Piezas: ${p.sumQty}`);
    lines.push(`Total: € ${money(p.total)}`);
    if(Number.isFinite(p.paid)) lines.push(`Pagado: € ${money(p.paid)}`);
    if(Number.isFinite(p.change)) lines.push(`Cambio: € ${money(p.change)}`);
    return lines.join("\n");
  }

  function receiptHtml(payload){
    const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
    const p = payload;
    const rows = (p.items || []).map((it, idx) => `
      <tr>
        <td>${idx + 1}</td>
        <td>${esc(it.name)}</td>
        <td style="text-align:right">${esc(it.qty)}</td>
        <td style="text-align:right">€ ${money(it.price)}</td>
        <td style="text-align:right">€ ${money(it.amount)}</td>
      </tr>`).join("");

    return `<!doctype html><html><head><meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>Receipt</title>
      <style>
        body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;margin:18px;color:#111}
        h1{font-size:18px;margin:0 0 6px}
        .meta{font-size:12px;color:#555;margin:0 0 12px}
        table{width:100%;border-collapse:collapse;font-size:12px}
        th,td{border-bottom:1px solid #ddd;padding:6px 4px;vertical-align:top}
        th{font-size:11px;color:#555;text-align:left}
        .sum{margin-top:12px;font-size:13px}
        .sum b{font-size:15px}
        @media print{ body{margin:0} }
      </style></head><body>
      <h1>Mi Angelito Moda</h1>
      <div class="meta">Ticket Nº: ${esc(p.billNo)}<br/>Fecha: ${esc(p.ts)}</div>
      <table>
        <thead><tr><th>#</th><th>Ropa</th><th style="text-align:right">Piezas</th><th style="text-align:right">Precio</th><th style="text-align:right">Importe</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="sum">Piezas: <b>${esc(p.sumQty)}</b><br/>Total: <b>€ ${money(p.total)}</b><br/>Pagado: € ${money(p.paid)}<br/>Cambio: € ${money(p.change)}</div>
      <script>setTimeout(()=>{ try{ window.print(); }catch(e){} }, 250);<\/script>
      </body></html>`;
  }

  function openPrint(payload){
    const w = window.open("", "_blank");
    if(!w){
      toast("Popup bloqueado");
      return;
    }
    w.document.open();
    w.document.write(receiptHtml(payload));
    w.document.close();
    w.focus();
  }

  async function printViaBridge(payload){
    const cfg = (window.POS_CONFIG || {});
    const url = (cfg.PRINT_BRIDGE_URL || "").trim();
    if(!url) return false;

    const key = (cfg.PRINT_BRIDGE_KEY || "").trim();
    const printerName = (cfg.PRINTER_NAME || "").trim() || undefined;
    const text = receiptText(payload);

    try{
      const r = await fetch(url.replace(/\/$/, "") + "/print", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-PRINT-KEY": key
        },
        body: JSON.stringify({ printerName, text })
      });
      if(!r.ok) throw new Error("HTTP " + r.status);
      const data = await r.json().catch(() => ({}));
      return !!data.ok;
    }catch(e){
      console.warn("Print bridge failed", e);
      return false;
    }
  }

  function shareWhatsapp(payload){
    const text = receiptText(payload);
    const url = "https://wa.me/?text=" + encodeURIComponent(text);
    window.open(url, "_blank");
  }

  function finalize(paidOverride, opts = {}){
    const { total } = calc();
    if(total === 0) return;

    const paid = Number.isFinite(paidOverride) ? paidOverride : (total > 0 ? total : 0);
    const payload = buildPayload(paid);

    lastBill = payload;
    try{ localStorage.setItem("pos_last_bill", JSON.stringify(payload)); }catch(e){}

    syncBillToCloud(payload);

    items = [];
    saveCur();
    render();
    tmpQty = null;
    setStep("qty");
    closePay();
    toast("Cobrado");

    if(opts.print){
      printViaBridge(payload).then((ok) => {
        if(!ok) openPrint(payload);
      });
    }
  }

  $("btnUndo").addEventListener("click", () => {
    if(!items.length){
      toast("Nada que deshacer");
      return;
    }
    items.pop();
    saveCur();
    render();
    toast("Deshecho");
  });

  let clearTm = null;
  $("btnClear").addEventListener("touchstart", () => {
    if(!items.length) return;
    clearTm = setTimeout(() => {
      items = [];
      saveCur();
      render();
      tmpQty = null;
      setStep("qty");
      toast("Vaciado");
    }, 900);
  }, { passive:true });

  $("btnClear").addEventListener("touchend", () => {
    if(clearTm){
      clearTimeout(clearTm);
      clearTm = null;
    }
  });

  $("btnClear").addEventListener("click", () => {
    if(items.length) toast("Mantén 1s para vaciar");
    else toast("Ya está vacío");
  });

  $("btnPay").addEventListener("click", openPay);
  $("btnClose").addEventListener("click", closePay);
  mask.addEventListener("click", (e) => { if(e.target === mask) closePay(); });

  $("fPaid").addEventListener("input", updateChange);

  $("btnExact").addEventListener("click", () => {
    const total = toNumber($("fTotal").value);
    $("fPaid").value = money(total > 0 ? total : 0);
    updateChange();
    $("fPaid").focus();
    $("fPaid").select();
  });

  $("btnSaveNoPrint").addEventListener("click", () => {
    const total = toNumber($("fTotal").value);
    const raw = String($("fPaid").value || "").trim();
    const paid = raw ? toNumber(raw) : (total > 0 ? total : 0);
    if(!Number.isFinite(paid)) return;

    finalize(paid, { print:false });
    if(lastBill) shareWhatsapp(lastBill);
  });

  $("btnSave").addEventListener("click", () => {
    const total = toNumber($("fTotal").value);
    const raw = String($("fPaid").value || "").trim();
    const paid = raw ? toNumber(raw) : (total > 0 ? total : 0);
    if(!Number.isFinite(paid)){
      toast("Pagado不对");
      return;
    }
    finalize(paid, { print:true });
  });

  const maskHold = $("maskHold");
  const btnShare = $("btnShareBill");
  const holdListEl = $("holdList");
  const holdEmptyEl = $("holdEmpty");

  function loadHolds(){
    try{ return JSON.parse(localStorage.getItem("pos_holds") || "[]") || []; }
    catch(e){ return []; }
  }

  function saveHolds(holds){
    localStorage.setItem("pos_holds", JSON.stringify(holds || []));
  }

  function holdsSummary(h){
    let piezas = 0, total = 0;
    (h.items || []).forEach(it => {
      piezas += Number(it.qty || 0);
      total += Number(it.amount || 0);
    });
    return { piezas, total };
  }

  function closeHoldSheet(){ maskHold.style.display = "none"; }

  function renderHoldSheet(){
    const holds = loadHolds();
    holdListEl.innerHTML = "";
    holdEmptyEl.style.display = holds.length ? "none" : "block";

    holds.slice().reverse().forEach((h, revIdx) => {
      const idx = holds.length - 1 - revIdx;
      const s = holdsSummary(h);
      const row = document.createElement("div");
      row.className = "it";
      const dt = new Date(h.ts || Date.now());
      const time = dt.toLocaleString("es-ES", { hour:"2-digit", minute:"2-digit" });
      row.innerHTML = `
        <div class="lineRow">
          <div class="lName">Cuenta</div>
          <div class="lMid">${time} · ${s.piezas} piezas</div>
          <div class="lAmt">€${money(s.total)}</div>
          <button class="xDel" data-open="${idx}" aria-label="Abrir">↩</button>
        </div>
      `;
      holdListEl.appendChild(row);
    });

    holdListEl.querySelectorAll("button[data-open]").forEach(btn => {
      btn.addEventListener("click", () => {
        const idx = Number(btn.getAttribute("data-open"));
        const holds2 = loadHolds();
        const h = holds2[idx];
        if(!h) return;

        items = h.items || [];
        holds2.splice(idx, 1);
        saveHolds(holds2);

        saveCur();
        render();
        tmpQty = null;
        setStep("qty");
        closeHoldSheet();
        scrollListToBottom(true);
      });
    });
  }

  function openHoldSheet(){
    renderHoldSheet();
    maskHold.style.display = "flex";
  }

  function colgarActual(){
    if(!items.length) return;
    const holds = loadHolds();
    holds.push({ ts:Date.now(), items:items });
    saveHolds(holds);

    items = [];
    saveCur();
    render();
    tmpQty = null;
    setStep("qty");
  }

  if(btnShare){
    btnShare.addEventListener("click", (e) => {
      e.preventDefault();
      openHoldSheet();
    });
  }

  $("btnHoldClose")?.addEventListener("click", closeHoldSheet);
  $("btnHoldClose2")?.addEventListener("click", closeHoldSheet);
  maskHold?.addEventListener("click", (e) => { if(e.target === maskHold) closeHoldSheet(); });

  $("btnHoldSave")?.addEventListener("click", () => {
    colgarActual();
    openHoldSheet();
  });

  $("btnHoldClearAll")?.addEventListener("click", () => {
    saveHolds([]);
    openHoldSheet();
  });

  loadCur();
  render();
  setStep("qty");
  setConn(false, "Sin conexión");
  setEntryTarget($("line"));

  try{
    const list = $("list");
    if(list){
      const obs = new MutationObserver(() => scrollListToBottom(true));
      obs.observe(list, { childList:true, subtree:true });
    }
  }catch(e){}
})();
