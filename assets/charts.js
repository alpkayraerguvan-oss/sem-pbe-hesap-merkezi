// Hafif SVG grafikleri: çizgi (crosshair + ipucu), yatay çubuk, tornado.
// Renkler CSS değişkenlerinden gelir (açık/koyu tema).

const NS = "http://www.w3.org/2000/svg";
const fmtTR = (v, d = 1) => Number(v).toLocaleString("tr-TR", { minimumFractionDigits: d, maximumFractionDigits: d });

function el(tag, attrs = {}, parent) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (parent) parent.appendChild(e);
  return e;
}

function niceTicks(min, max, n = 5) {
  if (min === max) { max = min + 1; }
  const span = max - min;
  const step0 = span / n;
  const mag = 10 ** Math.floor(Math.log10(step0));
  const err = step0 / mag;
  const step = (err >= 7.5 ? 10 : err >= 3.5 ? 5 : err >= 1.5 ? 2 : 1) * mag;
  const lo = Math.floor(min / step) * step, hi = Math.ceil(max / step) * step;
  const ticks = [];
  for (let v = lo; v <= hi + step * 1e-9; v += step) ticks.push(+v.toFixed(10));
  return { lo, hi, ticks, step };
}

function frame(container, height) {
  container.innerHTML = "";
  container.classList.add("chart");
  const w = Math.max(280, container.clientWidth || 600);
  const svg = el("svg", { viewBox: `0 0 ${w} ${height}`, width: "100%", height, role: "img" });
  container.appendChild(svg);
  const tip = document.createElement("div");
  tip.className = "chart-tip";
  tip.hidden = true;
  container.appendChild(tip);
  return { svg, tip, w };
}

function tableToggle(container, headers, rows, caption) {
  const wrap = document.createElement("div");
  wrap.className = "chart-table-wrap";
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "link-btn";
  btn.textContent = "Tablo olarak göster";
  const tbl = document.createElement("table");
  tbl.className = "data-table";
  tbl.hidden = true;
  if (caption) { const c = document.createElement("caption"); c.textContent = caption; tbl.appendChild(c); }
  const thead = tbl.createTHead().insertRow();
  headers.forEach((h) => { const th = document.createElement("th"); th.textContent = h; thead.appendChild(th); });
  const tb = tbl.createTBody();
  rows.forEach((r) => { const tr = tb.insertRow(); r.forEach((c) => { tr.insertCell().textContent = c; }); });
  btn.addEventListener("click", () => {
    tbl.hidden = !tbl.hidden;
    btn.textContent = tbl.hidden ? "Tablo olarak göster" : "Tabloyu gizle";
  });
  wrap.append(btn, tbl);
  container.after(wrap);
  const old = container.nextElementSibling?.nextElementSibling;
  if (old && old.classList?.contains("chart-table-wrap")) old.remove();
}

// ------------------------------------------------------------------ çizgi grafiği
export function lineChart(container, o) {
  const H = o.height || 280;
  const { svg, tip, w } = frame(container, H);
  const m = { l: 52, r: 16, t: 30, b: 40 };
  const all = o.series.flatMap((s) => s.points);
  if (!all.length) return;
  const xs = niceTicks(o.xMin ?? Math.min(...all.map((p) => p[0])), o.xMax ?? Math.max(...all.map((p) => p[0])), 6);
  const ys = niceTicks(o.yMin ?? Math.min(0, ...all.map((p) => p[1])), o.yMax ?? Math.max(...all.map((p) => p[1])), 5);
  const X = (v) => m.l + (v - xs.lo) / (xs.hi - xs.lo) * (w - m.l - m.r);
  const Y = (v) => H - m.b - (v - ys.lo) / (ys.hi - ys.lo) * (H - m.t - m.b);
  const g = el("g", {}, svg);
  for (const t of ys.ticks) {
    el("line", { x1: m.l, x2: w - m.r, y1: Y(t), y2: Y(t), class: "grid" }, g);
    el("text", { x: m.l - 8, y: Y(t) + 4, class: "tick", "text-anchor": "end" }, g).textContent = (o.yFmt || ((v) => fmtTR(v, 0)))(t);
  }
  for (const t of xs.ticks) {
    el("text", { x: X(t), y: H - m.b + 18, class: "tick", "text-anchor": "middle" }, g).textContent = (o.xFmt || ((v) => fmtTR(v, 0)))(t);
  }
  el("line", { x1: m.l, x2: w - m.r, y1: Y(ys.lo), y2: Y(ys.lo), class: "axis" }, g);
  if (o.xLabel) el("text", { x: (m.l + w - m.r) / 2, y: H - 4, class: "axis-label", "text-anchor": "middle" }, g).textContent = o.xLabel;
  if (o.yLabel) el("text", { x: 6, y: 14, class: "axis-label" }, g).textContent = o.yLabel;
  for (const r of o.refLines || []) {
    el("line", { x1: m.l, x2: w - m.r, y1: Y(r.y), y2: Y(r.y), class: "ref" }, g);
    el("text", { x: w - m.r, y: Y(r.y) + 15, class: "ref-label", "text-anchor": "end" }, g).textContent = r.label;
  }
  o.series.forEach((s) => {
    if (s.scatter) {
      s.points.forEach((p) => el("circle", { cx: X(p[0]), cy: Y(p[1]), r: 3.2, fill: `var(${s.color})`, class: "dot" }, g));
    } else {
      const d = s.points.map((p, i) => `${i ? "L" : "M"}${X(p[0]).toFixed(1)},${Y(p[1]).toFixed(1)}`).join("");
      el("path", { d, fill: "none", stroke: `var(${s.color})`, "stroke-width": 2, "stroke-linejoin": "round" }, g);
    }
  });
  // lejant (>=2 seri)
  if (o.series.length > 1) {
    const lg = document.createElement("div");
    lg.className = "legend";
    lg.innerHTML = o.series.map((s) => `<span><i style="background:var(${s.color})"></i>${s.name}</span>`).join("");
    container.prepend(lg);
  }
  // crosshair + ipucu
  const cross = el("line", { y1: m.t, y2: H - m.b, class: "crosshair", visibility: "hidden" }, svg);
  const hit = el("rect", { x: m.l, y: m.t, width: w - m.l - m.r, height: H - m.t - m.b, fill: "transparent" }, svg);
  const nearest = (pts, x) => {
    let lo = 0, hi = pts.length - 1;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (pts[mid][0] < x) lo = mid; else hi = mid; }
    return Math.abs(pts[lo][0] - x) < Math.abs(pts[hi][0] - x) ? pts[lo] : pts[hi];
  };
  const move = (ev) => {
    const r = svg.getBoundingClientRect();
    const px = (ev.clientX - r.left) * (w / r.width);
    const xv = xs.lo + (px - m.l) / (w - m.l - m.r) * (xs.hi - xs.lo);
    const rows = o.series.map((s) => [s, nearest([...s.points].sort((a, b) => a[0] - b[0]), xv)]);
    const xx = X(rows[0][1][0]);
    cross.setAttribute("x1", xx); cross.setAttribute("x2", xx); cross.setAttribute("visibility", "visible");
    tip.hidden = false;
    tip.innerHTML = `<b>${(o.xFmt || ((v) => fmtTR(v, 1)))(rows[0][1][0])} ${o.xUnit || ""}</b>` +
      rows.map(([s, p]) => `<div><i style="background:var(${s.color})"></i>${s.name}: <b>${(o.tipFmt || ((v) => fmtTR(v, 2)))(p[1])}</b> ${o.yUnit || ""}</div>`).join("");
    const cx = xx / w * r.width;
    tip.style.left = `${Math.min(r.width - tip.offsetWidth - 4, cx + 12)}px`;
    tip.style.top = "8px";
  };
  hit.addEventListener("pointermove", move);
  hit.addEventListener("pointerleave", () => { tip.hidden = true; cross.setAttribute("visibility", "hidden"); });
  if (o.table !== false) {
    const s0 = o.series[0];
    const step = Math.max(1, Math.floor(s0.points.length / 40));
    const rows = s0.points.filter((_, i) => i % step === 0).map((p) => [fmtTR(p[0], 1), ...o.series.map((s) => {
      const q = nearest([...s.points].sort((a, b) => a[0] - b[0]), p[0]); return fmtTR(q[1], 2);
    })]);
    tableToggle(container, [o.xLabel || "x", ...o.series.map((s) => s.name)], rows, o.caption);
  }
}

// ------------------------------------------------------------------ yatay çubuk
export function barChart(container, o) {
  const items = o.items;
  const rowH = 30, H = items.length * rowH + 44;
  const { svg, tip, w } = frame(container, H);
  const labelW = Math.min(240, Math.max(130, w * 0.36));
  const m = { l: labelW, r: 70, t: 8, b: 34 };
  const max = Math.max(...items.map((i) => i.value)) || 1;
  const xs = niceTicks(0, max, 5);
  const X = (v) => m.l + v / xs.hi * (w - m.l - m.r);
  for (const t of xs.ticks) {
    el("line", { x1: X(t), x2: X(t), y1: m.t, y2: H - m.b, class: "grid" }, svg);
    el("text", { x: X(t), y: H - m.b + 16, class: "tick", "text-anchor": "middle" }, svg).textContent = fmtTR(t, xs.step < 1 ? 1 : 0);
  }
  if (o.xLabel) el("text", { x: (m.l + w - m.r) / 2, y: H - 2, class: "axis-label", "text-anchor": "middle" }, svg).textContent = o.xLabel;
  items.forEach((it, i) => {
    const y = m.t + i * rowH + 5;
    el("text", { x: m.l - 8, y: y + rowH / 2 - 1, class: "tick strong", "text-anchor": "end" }, svg).textContent = it.label;
    const bw = Math.max(2, X(it.value) - m.l);
    const r = el("rect", { x: m.l, y, width: bw, height: rowH - 10, rx: 3, fill: `var(${it.color || o.color || "--series-1"})` }, svg);
    if (it.show) el("text", { x: m.l + bw + 6, y: y + rowH / 2 - 1, class: "tick" }, svg).textContent = it.text || fmtTR(it.value, 2);
    const hit = el("rect", { x: 0, y: y - 4, width: w, height: rowH, fill: "transparent" }, svg);
    hit.addEventListener("pointermove", (ev) => {
      const rr = svg.getBoundingClientRect();
      tip.hidden = false;
      tip.innerHTML = `<b>${it.label}</b><div>${it.text || fmtTR(it.value, 2)} ${o.unit || ""}</div>`;
      tip.style.left = `${Math.min(rr.width - tip.offsetWidth - 4, ev.clientX - rr.left + 12)}px`;
      tip.style.top = `${(y / H) * rr.height}px`;
      r.setAttribute("opacity", 0.85);
    });
    hit.addEventListener("pointerleave", () => { tip.hidden = true; r.setAttribute("opacity", 1); });
  });
  tableToggle(container, ["Kalem", o.unit || "Değer"], items.map((i) => [i.label, i.text || fmtTR(i.value, 2)]), o.caption);
}

// ------------------------------------------------------------------ tornado (duyarlılık)
export function tornado(container, o) {
  const items = o.items;
  const rowH = 32, H = items.length * rowH + 50;
  const { svg, tip, w } = frame(container, H);
  const labelW = Math.min(250, Math.max(140, w * 0.38));
  const m = { l: labelW, r: 40, t: 8, b: 40 };
  const ext = Math.max(...items.flatMap((i) => [Math.abs(i.neg), Math.abs(i.pos)])) || 1;
  const xs = niceTicks(-ext, ext, 6);
  const X = (v) => m.l + (v - xs.lo) / (xs.hi - xs.lo) * (w - m.l - m.r);
  for (const t of xs.ticks) {
    el("line", { x1: X(t), x2: X(t), y1: m.t, y2: H - m.b, class: "grid" }, svg);
    el("text", { x: X(t), y: H - m.b + 16, class: "tick", "text-anchor": "middle" }, svg).textContent = (t > 0 ? "+" : "") + fmtTR(t, 0);
  }
  el("line", { x1: X(0), x2: X(0), y1: m.t, y2: H - m.b, class: "axis zero" }, svg);
  if (o.xLabel) el("text", { x: (m.l + w - m.r) / 2, y: H - 4, class: "axis-label", "text-anchor": "middle" }, svg).textContent = o.xLabel;
  items.forEach((it, i) => {
    const y = m.t + i * rowH + 5;
    el("text", { x: m.l - 8, y: y + rowH / 2 - 1, class: "tick strong", "text-anchor": "end" }, svg).textContent = it.label;
    const good = Math.max(it.neg, it.pos), bad = Math.min(it.neg, it.pos);
    el("rect", { x: X(0) + 1, y, width: Math.max(1, X(good) - X(0) - 1), height: rowH - 12, rx: 3, fill: "var(--series-1)" }, svg);
    el("rect", { x: X(bad), y, width: Math.max(1, X(0) - X(bad) - 1), height: rowH - 12, rx: 3, fill: "var(--negative)" }, svg);
    const hit = el("rect", { x: 0, y: y - 4, width: w, height: rowH, fill: "transparent" }, svg);
    hit.addEventListener("pointermove", (ev) => {
      const rr = svg.getBoundingClientRect();
      tip.hidden = false;
      tip.innerHTML = `<b>${it.label}</b><div><i style="background:var(--series-1)"></i>İyileşirse: <b>+${fmtTR(good, 0)}</b> km/kWh</div><div><i style="background:var(--negative)"></i>Kötüleşirse: <b>${fmtTR(bad, 0)}</b> km/kWh</div>`;
      tip.style.left = `${Math.min(rr.width - tip.offsetWidth - 4, ev.clientX - rr.left + 12)}px`;
      tip.style.top = `${(y / H) * rr.height}px`;
    });
    hit.addEventListener("pointerleave", () => { tip.hidden = true; });
  });
  const lg = document.createElement("div");
  lg.className = "legend";
  lg.innerHTML = `<span><i style="background:var(--series-1)"></i>Parametre iyileşirse</span><span><i style="background:var(--negative)"></i>Parametre kötüleşirse</span>`;
  container.prepend(lg);
  tableToggle(container, ["Parametre", "İyileşirse (km/kWh)", "Kötüleşirse (km/kWh)"],
    items.map((i) => [i.label, "+" + fmtTR(Math.max(i.neg, i.pos), 0), fmtTR(Math.min(i.neg, i.pos), 0)]), o.caption);
}
