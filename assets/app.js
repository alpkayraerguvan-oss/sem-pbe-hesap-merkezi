import * as C from "./calc.js";
import { lineChart, barChart, tornado } from "./charts.js";

const LS_KEY = "sem-pbe-hesap-v1";
const nf = (v, d = 1) => Number(v).toLocaleString("tr-TR", { minimumFractionDigits: d, maximumFractionDigits: d });
const $ = (id) => document.getElementById(id);

const DEFAULT_CG = [
  ["Sürücü (tam ekipman)", 50.0, 1100, 230],
  ["Monokok (taban, yanlar, kuyular, bölme)", 6.5, 1200, 160],
  ["Üst gövde kabuğu", 2.2, 1400, 380],
  ["Kanopi + menteşe/kilit", 1.5, 1420, 480],
  ["Roll bar (Al 6061)", 0.5, 1872, 420],
  ["Koltuk + kemer + kafalık", 1.9, 1260, 150],
  ["Ön tekerler (2)", 1.62, 750, 234],
  ["Arka teker", 0.81, 2170, 234],
  ["Teker içi motor", 2.4, 2170, 234],
  ["Ön pivotlar, akslar, rulmanlar", 1.6, 750, 234],
  ["Direksiyon sistemi", 0.7, 1000, 280],
  ["Fren sistemleri", 1.8, 900, 220],
  ["Arka çatal", 0.8, 2050, 234],
  ["Batarya + BMS + çelik tepsi", 1.25, 2030, 138],
  ["Motor sürücü", 0.25, 2027, 118],
  ["Kablolama, sigorta, acil stop", 0.6, 1700, 200],
  ["Joulemetre", 0.2, 2002, 164],
  ["Korna + DC/DC", 0.35, 110, 205],
  ["Telemetri + gösterge", 0.25, 1300, 300],
  ["Aynalar, bağlantı, boya", 1.2, 1375, 300],
].map(([name, m, x, z]) => ({ name, m, x, z }));

const BRAKE_PRESETS = {
  front: { n_wheels: 2, lever_ratio: 4, f_limit_n: 300, mc_d_mm: 12, label: "Ön sistem" },
  rear: { n_wheels: 1, lever_ratio: 4, f_limit_n: 100, mc_d_mm: 10, label: "Arka sistem" },
};

function loadStore() { try { return JSON.parse(localStorage.getItem(LS_KEY)) || {}; } catch { return {}; } }
const defaults = {
  preset: "target",
  car: { ...C.PRESETS.target },
  track: { ...C.DEFAULT_TRACK, turns: C.DEFAULT_TRACK.turns.map((t) => [...t]), wind: 0 },
  quick: { v: 25.8, dist: 14.6 },
  pg: { v_lo: 24.3, v_hi: 27.3, p_pulse: 120 },
  lap: { lap: 1327, laps: 11, t_max_min: 35, margin_s: 60 },
  steer: { wb_mm: 1420, track_mm: 510, delta_i_deg: 12, r_w_mm: 234, r_req_m: 8 },
  brakeSys: "rear",
  brake: { m_total: 80, grade: 0.2, r_w_mm: 234, r_disc_mm: 62, mu: 0.4, piston_d_mm: 22, pistons_per_side: 1, ...BRAKE_PRESETS.rear },
  rb: { d_mm: 25, t_mm: 2, span_mm: 400, sigma_y: 276, E_gpa: 69, load_n: 700, support: "basit", helmet_top_mm: 524, bar_top_mm: 591 },
  bat: { v_nom: 3.6, v_max: 4.2, ah: 2.8, s: 12, p: 1, cell_g: 46, i_cont: 25, wh_attempt: 16, dod: 0.8, p_peak: 400 },
  dim: { h: 607, track: 510, wb: 1420, width: 670, length: 2750, mass: 30 },
  cg: { x_fa: 750, x_ra: 2170, track: 510, rows: DEFAULT_CG },
  cdText: "",
  cdp: { m_static: 80, m_eff: 81.8, rho: 1.19, f_bearing: 0.04, area: 0.32 },
  aero: { L: 2.75, area: 0.32, vKmh: 25.8, addon: 0.03, regime: "turb", rho: 1.19 },
  theme: "auto",
};
const state = { ...defaults, ...loadStore() };
for (const k of Object.keys(defaults)) {
  if (defaults[k] && typeof defaults[k] === "object" && !Array.isArray(defaults[k])) state[k] = { ...defaults[k], ...(state[k] || {}) };
}
let saveTimer;
function save() { clearTimeout(saveTimer); saveTimer = setTimeout(() => { try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch { /* depolama kapalı */ } }, 250); }

// ------------------------------------------------------------------ form / kpi yardımcıları
function buildForm(container, fields, obj, onChange) {
  container.innerHTML = "";
  for (const f of fields) {
    if (f.group) { const g = document.createElement("div"); g.className = "group-title"; g.textContent = f.group; container.appendChild(g); continue; }
    const lab = document.createElement("label");
    lab.className = "field";
    const sp = document.createElement("span"); sp.textContent = f.label; lab.appendChild(sp);
    const row = document.createElement("div"); row.className = "row";
    let input;
    if (f.options) {
      input = document.createElement("select");
      for (const [v, t] of f.options) { const o = document.createElement("option"); o.value = v; o.textContent = t; input.appendChild(o); }
      input.value = obj[f.id];
    } else {
      input = document.createElement("input");
      input.type = "number"; input.step = f.step ?? "any"; input.inputMode = "decimal";
      if (f.min != null) input.min = f.min;
      input.value = obj[f.id];
    }
    input.addEventListener("input", () => {
      const v = f.options ? input.value : parseFloat(input.value);
      if (f.options || Number.isFinite(v)) { obj[f.id] = v; save(); onChange && onChange(f.id); }
    });
    row.appendChild(input);
    if (f.unit) { const u = document.createElement("span"); u.className = "unit"; u.textContent = f.unit; row.appendChild(u); }
    lab.appendChild(row);
    if (f.hint) { const s = document.createElement("small"); s.textContent = f.hint; lab.appendChild(s); }
    container.appendChild(lab);
  }
}
const ICON_OK = '<svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="7.5" fill="currentColor"/><path d="M4.4 8.3l2.3 2.3 5-5" stroke="#fff" stroke-width="1.9" fill="none" stroke-linecap="round"/></svg>';
const ICON_BAD = '<svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="7.5" fill="currentColor"/><path d="M5.3 5.3l5.4 5.4M10.7 5.3l-5.4 5.4" stroke="#fff" stroke-width="1.9" stroke-linecap="round"/></svg>';
const statusHtml = (ok, okText = "Uygun", badText = "Uygun değil") =>
  `<div class="status ${ok ? "ok" : "bad"}">${ok ? ICON_OK : ICON_BAD}${ok ? okText : badText}</div>`;
function kpis(container, list) {
  container.innerHTML = list.map((k) => `<div class="kpi${k.hero ? " hero" : ""}"><div class="k">${k.k}</div><div class="v">${k.v}${k.u ? `<small>${k.u}</small>` : ""}</div>${k.ok == null ? "" : statusHtml(k.ok, k.okText, k.badText)}</div>`).join("");
}

// ------------------------------------------------------------------ 1. araç & enerji
const CAR_FIELDS = [
  { group: "Kütle" },
  { id: "m_vehicle", label: "Araç kütlesi (sürücüsüz)", unit: "kg", step: 0.5 },
  { id: "m_driver", label: "Sürücü (tam ekipman, min. 50,0)", unit: "kg", step: 0.5 },
  { id: "m_rot", label: "Eşdeğer dönen kütle", unit: "kg", step: 0.1, hint: "Σ I/r² — tekerler ve rotor" },
  { group: "Lastik ve yuvarlanma" },
  { id: "crr", label: "Yuvarlanma katsayısı Crr", unit: "–", step: 0.0001 },
  { id: "f_bearing", label: "Rulman/conta sürtünmesi", unit: "N", step: 0.01 },
  { id: "c_alpha", label: "Toplam viraj sertliği Cα", unit: "N/rad", step: 50 },
  { id: "r_w", label: "Teker yarıçapı", unit: "m", step: 0.001 },
  { group: "Aerodinamik" },
  { id: "cd", label: "Sürükleme katsayısı Cd", unit: "–", step: 0.005 },
  { id: "area", label: "Cephe alanı A", unit: "m²", step: 0.005 },
  { id: "rho", label: "Hava yoğunluğu ρ", unit: "kg/m³", step: 0.01 },
  { group: "Güç aktarma ve elektronik (joulemetreden geçen)" },
  { id: "eta_prop", label: "Sürücü + aktarma oransal verimi", unit: "–", step: 0.005 },
  { id: "a_cu", label: "Bakır kaybı katsayısı a (teker torkuna göre)", unit: "W/(N·m)²", step: 0.01 },
  { id: "p_idle", label: "Sürücü boşta kaybı (motor aktif)", unit: "W", step: 0.05 },
  { id: "p_sleep", label: "Süzülmede bekleme", unit: "W", step: 0.01 },
  { id: "p_aux", label: "Yardımcı tüketim (telemetri, sensör)", unit: "W", step: 0.05 },
  { id: "md_b", label: "Motor sürüklenmesi b (direkt tahrik)", unit: "W·s/rad", step: 0.001 },
  { id: "md_c", label: "Motor sürüklenmesi c", unit: "W·s²/rad²", step: 0.0001 },
  { id: "freewheel_drag", label: "Serbest makara sürtünmesi", unit: "N", step: 0.01 },
  { id: "p_max", label: "İvmelenme güç sınırı", unit: "W", step: 10 },
];
function renderQuick() {
  const q = C.steadyState(state.car, state.quick.v, state.quick.dist);
  kpis($("quickOut"), [
    { k: "Tahmini verim", v: nf(q.km_kwh, 0), u: "km/kWh", hero: true },
    { k: "Enerji / deneme", v: nf(q.wh, 2), u: "Wh" },
    { k: "Tüketim", v: nf(q.whPerKm, 3), u: "Wh/km" },
    { k: "Tekerlek gücü", v: nf(q.pWheel, 1), u: "W" },
    { k: "Elektrik gücü", v: nf(q.pElec, 1), u: "W" },
    { k: "Sistem verimi", v: nf(100 * q.eta, 1), u: "%" },
    { k: "Yuvarlanma kuvveti", v: nf(q.f.yuvarlanma, 2), u: "N" },
    { k: "Aerodinamik kuvvet", v: nf(q.f.aero, 2), u: "N" },
    { k: "Rulman + motor sürüklenme", v: nf(q.f.rulman + q.f.motor_suruklenme, 2), u: "N" },
  ]);
  const pts = (fn) => Array.from({ length: 31 }, (_, i) => { const v = 10 + i; return [v, fn(v)]; });
  lineChart($("powerChart"), {
    series: [
      { name: "Yuvarlanma gücü", color: "--series-2", points: pts((v) => C.resist(state.car, v / 3.6).yuvarlanma * v / 3.6) },
      { name: "Aerodinamik güç", color: "--series-3", points: pts((v) => C.resist(state.car, v / 3.6).aero * v / 3.6) },
      { name: "Tekerlek gücü (toplam)", color: "--series-1", points: pts((v) => C.steadyState(state.car, v, 1).pWheel) },
      { name: "Elektrik gücü (joulemetre)", color: "--series-4", points: pts((v) => C.steadyState(state.car, v, 1).pElec) },
    ],
    xLabel: "Hız (km/sa)", yLabel: "Güç (W)", xUnit: "km/sa", yUnit: "W", height: 270, caption: "Hıza göre güç bileşenleri",
  });
}
function renderCar() {
  buildForm($("carForm"), CAR_FIELDS, state.car, () => { markPreset(null); renderQuick(); });
  buildForm($("quickForm"), [
    { id: "v", label: "Sabit hız", unit: "km/sa", step: 0.1 },
    { id: "dist", label: "Mesafe", unit: "km", step: 0.1 },
  ], state.quick, renderQuick);
  renderQuick();
}
function markPreset(key) {
  state.preset = key; save();
  document.querySelectorAll("[data-preset]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.preset === key)));
}
document.querySelectorAll("[data-preset]").forEach((b) => b.addEventListener("click", () => {
  state.car = { ...C.PRESETS[b.dataset.preset] };
  markPreset(b.dataset.preset);
  renderCar();
}));

// ------------------------------------------------------------------ 2. strateji
const TRACK_FIELDS = [
  { id: "lap", label: "Tur uzunluğu", unit: "m", step: 1 },
  { id: "laps", label: "Tur sayısı", unit: "tur", step: 1 },
  { id: "t_max_min", label: "Süre sınırı", unit: "dk", step: 0.5 },
  { id: "margin_min", label: "Güvenlik payı", unit: "dk", step: 0.1 },
  { id: "line_factor", label: "İdeal çizgi yarıçap katsayısı", unit: "×", step: 0.05 },
  { id: "wind", label: "Sabit karşı rüzgâr (+)", unit: "m/s", step: 0.5 },
];
const turnsToText = (t) => t.map(([a, r]) => `${a}/${r}`).join(", ");
function parseTurns(s) {
  const out = [];
  for (const part of s.split(/[,;\n]+/)) {
    const m = part.trim().match(/^(-?\d+(?:[.,]\d+)?)\s*\/\s*(\d+(?:[.,]\d+)?)$/);
    if (m) out.push([Math.abs(parseFloat(m[1].replace(",", "."))), parseFloat(m[2].replace(",", "."))]);
  }
  return out;
}
let lastSim = null;
function renderStrategySetup() {
  buildForm($("trackForm"), TRACK_FIELDS, state.track);
  buildForm($("pgForm"), [
    { id: "v_lo", label: "Alt hız", unit: "km/sa", step: 0.1 },
    { id: "v_hi", label: "Üst hız", unit: "km/sa", step: 0.1 },
    { id: "p_pulse", label: "Darbe gücü", unit: "W", step: 10 },
  ], state.pg);
  const ti = $("turnsInput");
  ti.value = turnsToText(state.track.turns);
  ti.oninput = () => { const t = parseTurns(ti.value); if (t.length) { state.track.turns = t; save(); } };
  if (lastSim) renderSim(lastSim);
}
function simRow(name, r, extra = "") {
  const avg = (state.track.lap * state.track.laps) / r.t * 3.6;
  const ok = r.t <= state.track.t_max_min * 60;
  return `<tr><td>${name}${extra}</td><td>${C.fmtTime(r.t)} ${ok ? "" : "⚠"}</td><td>${nf(avg, 2)}</td><td>${nf(r.wh, 2)}</td><td><b>${nf(r.km_kwh, 0)}</b></td></tr>`;
}
function renderSim(s) {
  const { cst, pg, manual } = s;
  const rows = [simRow("Sabit hız", cst, ` <span class="badge">${nf(cst.v_c, 2)} km/sa</span>`)];
  if (pg) rows.push(simRow("Pulse &amp; glide (optimum)", pg, ` <span class="badge">${nf(pg.v_lo, 1)}–${nf(pg.v_hi, 1)} km/sa, ${pg.p_pulse} W</span>`));
  if (manual) rows.push(simRow("Pulse &amp; glide (elle)", manual, ` <span class="badge">${nf(manual.v_lo, 1)}–${nf(manual.v_hi, 1)} km/sa, ${manual.p_pulse} W</span>`));
  const best = [cst, pg, manual].filter(Boolean).filter((r) => r.t <= state.track.t_max_min * 60).sort((a, b) => a.wh - b.wh)[0] || cst;
  $("simOut").innerHTML = `<div class="table-scroll"><table class="plain sim-table"><thead><tr><th>Strateji</th><th>Süre</th><th>Ort. km/sa</th><th>Wh</th><th>km/kWh</th></tr></thead><tbody>${rows.join("")}</tbody></table></div>
    <p class="note">Mesafe ${nf(state.track.lap * state.track.laps / 1000, 2)} km · hedef süre ${C.fmtTime(C.targetTime(state.track))} · ⚠ = süre sınırı aşıldı (geçersiz deneme).</p>`;
  const names = { yuvarlanma: "Yuvarlanma", aero: "Aerodinamik", viraj: "Viraj (kayma açısı)", rulman: "Rulman", motor_suruklenme: "Motor sürüklenmesi",
    bakir: "Bakır kaybı", surucu_aktarma: "Sürücü/aktarma", bosta: "Sürücü boşta/bekleme", yardimci: "Yardımcı tüketim", kinetik_son: "Bitişte kalan kinetik" };
  const items = Object.entries(best.lossesWh).map(([k, v]) => ({ label: names[k], value: v })).sort((a, b) => b.value - a.value);
  const tot = items.reduce((s, i) => s + i.value, 0);
  items.forEach((i, idx) => { i.show = idx < 3; i.text = `${nf(i.value, 2)} Wh (%${nf(100 * i.value / tot, 0)})`; });
  barChart($("lossChart"), { items, unit: "Wh", xLabel: "Bir denemede enerji (Wh)", caption: "Kayıp kalemleri" });
  const cut = (tr) => tr.filter((p) => p[0] <= 600).map((p) => [p[0], p[2]]);
  const series = [{ name: "Sabit hız", color: "--series-1", points: cut(cst.trace) }];
  if (pg) series.push({ name: "Pulse & glide (optimum)", color: "--series-2", points: cut(pg.trace) });
  if (manual) series.push({ name: "Pulse & glide (elle)", color: "--series-3", points: cut(manual.trace) });
  const vmin = (state.track.lap * state.track.laps) / (state.track.t_max_min * 60) * 3.6;
  lineChart($("traceChart"), { series, xLabel: "Zaman (s)", yLabel: "Hız (km/sa)", xUnit: "s", yUnit: "km/sa", yMin: 0, height: 260,
    refLines: [{ y: vmin, label: `kural: min. ort. ${nf(vmin, 2)} km/sa` }], caption: "Hız profili" });
}
function runSim(manualOnly = false) {
  const btns = [$("runSim"), $("runManual")];
  btns.forEach((b) => { b.disabled = true; });
  $("simOut").innerHTML = '<p class="muted">Hesaplanıyor…</p>';
  setTimeout(() => {
    const tr = { ...state.track, turns: state.track.turns };
    const cst = C.bestConstant(state.car, tr, state.track.wind || 0, true);
    let pg = lastSim?.pg || null;
    if (!manualOnly || !pg) pg = C.bestPulseGlide(state.car, tr, state.track.wind || 0);
    let manual = null;
    if (manualOnly) {
      manual = C.simulate(state.car, tr, { strategy: "pg", v_lo: state.pg.v_lo / 3.6, v_hi: state.pg.v_hi / 3.6, p_pulse: state.pg.p_pulse, wind: state.track.wind || 0, dt: 0.05, log: true });
      Object.assign(manual, { v_lo: state.pg.v_lo, v_hi: state.pg.v_hi, p_pulse: state.pg.p_pulse });
    }
    lastSim = { cst, pg, manual };
    renderSim(lastSim);
    btns.forEach((b) => { b.disabled = false; });
  }, 30);
}
$("runSim").addEventListener("click", () => runSim(false));
$("runManual").addEventListener("click", () => runSim(true));

// ------------------------------------------------------------------ 3. duyarlılık
$("runSens").addEventListener("click", () => {
  $("sensRef").textContent = "Hesaplanıyor…";
  setTimeout(() => {
    const s = C.sensitivity(state.car, state.track);
    $("sensRef").textContent = `Referans (sabit hız): ${nf(s.ref, 0)} km/kWh`;
    const items = s.items.map((i) => ({ label: `${i.label} (${i.frac === 1 ? "0…2×" : "±%" + Math.round(Math.abs(i.frac) * 100)})`, neg: i.eksi, pos: i.arti }))
      .sort((a, b) => Math.max(Math.abs(b.neg), Math.abs(b.pos)) - Math.max(Math.abs(a.neg), Math.abs(a.pos)));
    tornado($("sensChart"), { items, xLabel: "Verimdeki değişim (km/kWh)", caption: "Duyarlılık" });
  }, 30);
});

// ------------------------------------------------------------------ 4. tur planı
function renderLap() {
  const r = C.lapPlan(state.lap);
  kpis($("lapOut"), [
    { k: "Toplam mesafe", v: nf(r.dist / 1000, 2), u: "km" },
    { k: "Kural: min. ortalama hız", v: nf(r.vMin, 2), u: "km/sa" },
    { k: "Hedef ortalama hız", v: nf(r.vTarget, 2), u: "km/sa", hero: true },
    { k: "Hedef tur süresi", v: C.fmtTime(r.lapT), u: "dk:sn" },
  ]);
  $("lapTable").innerHTML = `<div class="table-scroll"><table class="plain"><thead><tr><th>Tur</th><th>Tur sonu hedef zaman</th><th>Kümülatif mesafe</th></tr></thead><tbody>${
    r.rows.map((x) => `<tr><td>${x.lap}</td><td>${C.fmtTime(x.t)}</td><td>${nf(x.dist / 1000, 3)} km</td></tr>`).join("")}</tbody></table></div>`;
}
buildForm($("lapForm"), [
  { id: "lap", label: "Tur uzunluğu", unit: "m", step: 1 },
  { id: "laps", label: "Tur sayısı", unit: "tur", step: 1 },
  { id: "t_max_min", label: "Süre sınırı", unit: "dk", step: 0.5 },
  { id: "margin_s", label: "Güvenlik payı", unit: "s", step: 5 },
], state.lap, renderLap);

// ------------------------------------------------------------------ 5. direksiyon
function renderSteer() {
  const r = C.steering(state.steer);
  kpis($("steerOut"), [
    { k: "Dış teker dönüş yarıçapı", v: nf(r.R_outer, 2), u: "m", hero: true, ok: r.ok, okText: `≤ ${nf(state.steer.r_req_m, 1)} m`, badText: `> ${nf(state.steer.r_req_m, 1)} m — açıyı artırın` },
    { k: "Dış teker açısı (Ackermann)", v: nf(r.delta_o_deg, 2), u: "°" },
    { k: `${nf(state.steer.r_req_m, 1)} m için gereken iç açı`, v: nf(r.req_inner_deg, 2), u: "°" },
    { k: `${nf(state.steer.r_req_m, 1)} m için gereken dış açı`, v: nf(r.req_outer_deg, 2), u: "°" },
    { k: "Arka teker yarıçapı", v: nf(r.Rc, 2), u: "m" },
    { k: "Ackermann kol açısı (içe)", v: nf(r.ackermann_arm_deg, 2), u: "°" },
    { k: "Teker kenarı yanal süpürme", v: nf(r.sweep_mm, 1), u: "mm" },
  ]);
}
buildForm($("steerForm"), [
  { id: "wb_mm", label: "Dingil mesafesi", unit: "mm", step: 5 },
  { id: "track_mm", label: "Ön iz genişliği", unit: "mm", step: 5 },
  { id: "delta_i_deg", label: "İç teker maks. direksiyon açısı", unit: "°", step: 0.1 },
  { id: "r_w_mm", label: "Teker dış yarıçapı", unit: "mm", step: 1 },
  { id: "r_req_m", label: "Kural sınırı", unit: "m", step: 0.5 },
], state.steer, renderSteer);

// ------------------------------------------------------------------ 6. fren
const BRAKE_FIELDS = [
  { id: "m_total", label: "Toplam kütle (araç + sürücü)", unit: "kg", step: 1 },
  { id: "grade", label: "Eğim", unit: "oran", step: 0.01, hint: "%20 = 0,20" },
  { id: "r_w_mm", label: "Teker yarıçapı", unit: "mm", step: 1 },
  { id: "n_wheels", label: "Bu sistemin frenlediği teker", unit: "adet", step: 1 },
  { id: "r_disc_mm", label: "Disk etkin yarıçapı", unit: "mm", step: 1, hint: "Ø140 disk ≈ 62 mm" },
  { id: "mu", label: "Balata sürtünme katsayısı", unit: "–", step: 0.01 },
  { id: "piston_d_mm", label: "Kaliper piston çapı", unit: "mm", step: 0.5 },
  { id: "pistons_per_side", label: "Taraf başına piston", unit: "adet", step: 1 },
  { id: "mc_d_mm", label: "Ana silindir çapı", unit: "mm", step: 0.5 },
  { id: "lever_ratio", label: "Pedal/kol oranı", unit: ":1", step: 0.1 },
  { id: "f_limit_n", label: "Rahat uygulanabilir kuvvet", unit: "N", step: 5 },
];
function renderBrake() {
  const r = C.brakeIncline(state.brake);
  kpis($("brakeOut"), [
    { k: "Gereken el/ayak kuvveti", v: nf(r.F_input, 1), u: "N", hero: true, ok: r.ok, okText: `Sınırın altında (pay ${nf(r.margin, 1)}×)`, badText: "Sınırı aşıyor — oran/çap değiştirin" },
    { k: "Eğimde tutma kuvveti", v: nf(r.F, 1), u: "N" },
    { k: "Toplam teker torku", v: nf(r.T_total, 1), u: "N·m" },
    { k: "Teker başına tork", v: nf(r.T_wheel, 1), u: "N·m" },
    { k: "Balata sıkma kuvveti", v: nf(r.F_clamp, 0), u: "N" },
    { k: "Hidrolik basınç", v: nf(r.p_bar, 1), u: "bar" },
  ]);
}
function renderBrakeForm() {
  buildForm($("brakeForm"), BRAKE_FIELDS, state.brake, renderBrake);
  document.querySelectorAll("[data-brake]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.brake === state.brakeSys)));
  renderBrake();
}
document.querySelectorAll("[data-brake]").forEach((b) => b.addEventListener("click", () => {
  state.brakeSys = b.dataset.brake;
  Object.assign(state.brake, BRAKE_PRESETS[b.dataset.brake]);
  save(); renderBrakeForm();
}));

// ------------------------------------------------------------------ 7. roll bar
function renderRb() {
  const r = C.rollbar(state.rb);
  kpis($("rbOut"), [
    { k: "Eğilme gerilmesi", v: nf(r.sigma, 1), u: "MPa" },
    { k: "Güvenlik katsayısı (akma)", v: nf(r.sf, 2), u: "", hero: true, ok: r.sf >= 2, okText: "≥ 2", badText: "< 2 — kesiti büyütün" },
    { k: "Elastik sehim", v: nf(r.defl, 2), u: "mm" },
    { k: "Kask üstü pay", v: nf(r.clearance, 0), u: "mm", ok: r.clearance >= 50, okText: "≥ 50 mm", badText: "< 50 mm" },
    { k: "Atalet momenti I", v: nf(r.I, 0), u: "mm⁴" },
    { k: "Birim kütle (Al)", v: nf(r.mass_per_m, 3), u: "kg/m" },
  ]);
}
buildForm($("rbForm"), [
  { id: "d_mm", label: "Boru dış çapı", unit: "mm", step: 0.5 },
  { id: "t_mm", label: "Et kalınlığı", unit: "mm", step: 0.1 },
  { id: "span_mm", label: "Mesnetler arası açıklık", unit: "mm", step: 10 },
  { id: "load_n", label: "Yük", unit: "N", step: 10 },
  { id: "support", label: "Mesnet tipi", options: [["basit", "Basit mesnet (F·L/4)"], ["ankastre", "Ankastre (F·L/8)"]] },
  { id: "sigma_y", label: "Akma dayanımı", unit: "MPa", step: 1, hint: "6061-T6 ≈ 276, 7075-T6 ≈ 503" },
  { id: "E_gpa", label: "Elastisite modülü", unit: "GPa", step: 1 },
  { id: "helmet_top_mm", label: "Kask tepesi (yerden)", unit: "mm", step: 1 },
  { id: "bar_top_mm", label: "Roll bar tepesi (yerden)", unit: "mm", step: 1 },
], state.rb, renderRb);

// ------------------------------------------------------------------ 8. batarya
function renderBat() {
  const r = C.battery(state.bat);
  kpis($("batOut"), [
    { k: "Nominal gerilim", v: nf(r.Vn, 1), u: "V" },
    { k: "Maksimum gerilim", v: nf(r.Vmax, 1), u: "V", ok: r.okV, okText: "≤ 60 V", badText: "> 60 V yasak" },
    { k: "Enerji", v: nf(r.wh, 0), u: "Wh", ok: r.okWh, okText: "≤ 1000 Wh", badText: "> 1000 Wh yasak" },
    { k: "Şarj başına deneme", v: nf(r.attempts, 1), u: "deneme", hero: true },
    { k: "Hücre kütlesi", v: nf(r.mass, 2), u: "kg" },
    { k: "Paket sürekli akım", v: nf(r.iMax, 0), u: "A" },
    { k: "Tepe akım (min. gerilimde)", v: nf(r.iPeak, 1), u: "A", ok: r.okI, okText: "Hücre sınırında", badText: "Hücre sınırını aşıyor" },
    { k: "Önerilen sigorta (başlangıç)", v: nf(r.fuse, 0), u: "A" },
  ]);
}
buildForm($("batForm"), [
  { id: "s", label: "Seri hücre (S)", unit: "adet", step: 1 },
  { id: "p", label: "Paralel hücre (P)", unit: "adet", step: 1 },
  { id: "v_nom", label: "Hücre nominal gerilimi", unit: "V", step: 0.05 },
  { id: "v_max", label: "Hücre maks. gerilimi", unit: "V", step: 0.05 },
  { id: "ah", label: "Hücre kapasitesi", unit: "Ah", step: 0.1 },
  { id: "cell_g", label: "Hücre kütlesi", unit: "g", step: 1 },
  { id: "i_cont", label: "Hücre sürekli akım sınırı", unit: "A", step: 1 },
  { id: "p_peak", label: "Tepe elektrik gücü", unit: "W", step: 10 },
  { id: "wh_attempt", label: "Deneme başına enerji", unit: "Wh", step: 0.5, hint: "Strateji sekmesinden alın" },
  { id: "dod", label: "Kullanılabilir deşarj oranı", unit: "–", step: 0.05 },
], state.bat, renderBat);

// ------------------------------------------------------------------ 9. boyut
function renderDim() {
  const rows = C.dimensions(state.dim);
  $("dimOut").innerHTML = `<ul class="checklist">${rows.map((r) => `<li><span>${r.key}</span><span><b>${r.val}</b> ${statusHtml(r.ok)}</span></li>`).join("")}</ul>`;
}
buildForm($("dimForm"), [
  { id: "h", label: "Toplam yükseklik", unit: "mm", step: 1 },
  { id: "track", label: "İz genişliği (temas merkezleri)", unit: "mm", step: 1 },
  { id: "wb", label: "Dingil mesafesi", unit: "mm", step: 1 },
  { id: "width", label: "Toplam genişlik", unit: "mm", step: 1 },
  { id: "length", label: "Toplam uzunluk", unit: "mm", step: 1 },
  { id: "mass", label: "Araç kütlesi (sürücüsüz)", unit: "kg", step: 0.5 },
], state.dim, renderDim);

// ------------------------------------------------------------------ 10. ağırlık merkezi
function renderCg() {
  const t = $("cgTable");
  t.innerHTML = `<div class="table-scroll"><table class="plain cg-table"><thead><tr><th>Bileşen</th><th>kg</th><th>X mm</th><th>Z mm</th><th></th></tr></thead><tbody>${
    state.cg.rows.map((r, i) => `<tr><td><input data-i="${i}" data-k="name" value="${r.name.replace(/"/g, "&quot;")}" aria-label="Bileşen adı"></td><td><input type="number" step="any" data-i="${i}" data-k="m" value="${r.m}" aria-label="Kütle"></td><td><input type="number" step="any" data-i="${i}" data-k="x" value="${r.x}" aria-label="X"></td><td><input type="number" step="any" data-i="${i}" data-k="z" value="${r.z}" aria-label="Z"></td><td><button type="button" class="link-btn" data-del="${i}" aria-label="Satırı sil">Sil</button></td></tr>`).join("")}</tbody></table></div>`;
  t.querySelectorAll("input").forEach((inp) => inp.addEventListener("input", () => {
    const r = state.cg.rows[+inp.dataset.i];
    r[inp.dataset.k] = inp.dataset.k === "name" ? inp.value : parseFloat(inp.value) || 0;
    save(); renderCgOut();
  }));
  t.querySelectorAll("[data-del]").forEach((b) => b.addEventListener("click", () => { state.cg.rows.splice(+b.dataset.del, 1); save(); renderCg(); }));
  renderCgOut();
}
function renderCgOut() {
  const r = C.cog(state.cg.rows, state.cg);
  kpis($("cgOut"), [
    { k: "Toplam kütle (sürücü dahil)", v: nf(r.M, 1), u: "kg" },
    { k: "Ağırlık merkezi X", v: nf(r.xg, 0), u: "mm" },
    { k: "Ağırlık merkezi Z", v: nf(r.zg, 0), u: "mm" },
    { k: "Ön aks yükü", v: nf(r.front, 1), u: `kg (%${nf(r.frontPct, 0)})` },
    { k: "Arka aks yükü", v: nf(r.rear, 1), u: "kg" },
    { k: "Statik devrilme eşiği", v: nf(r.ay, 2), u: "g", hero: true, ok: r.ay >= 0.6, okText: "≥ 0,6 g", badText: "< 0,6 g — AM'yi alçaltın/öne alın" },
  ]);
}
buildForm($("cgGeom"), [
  { id: "x_fa", label: "Ön aks X", unit: "mm", step: 1 },
  { id: "x_ra", label: "Arka aks X", unit: "mm", step: 1 },
  { id: "track", label: "Ön iz", unit: "mm", step: 1 },
], state.cg, renderCgOut);
$("cgAdd").addEventListener("click", () => { state.cg.rows.push({ name: "Yeni bileşen", m: 0.5, x: 1375, z: 250 }); save(); renderCg(); });
$("cgReset").addEventListener("click", () => { state.cg.rows = DEFAULT_CG.map((r) => ({ ...r })); save(); renderCg(); });

// ------------------------------------------------------------------ 11. coast-down
const CD_FIELDS = [
  { id: "m_static", label: "Toplam kütle (sürücü dahil)", unit: "kg", step: 0.5 },
  { id: "m_eff", label: "Eşdeğer kütle (+ dönen)", unit: "kg", step: 0.1 },
  { id: "rho", label: "Hava yoğunluğu", unit: "kg/m³", step: 0.01 },
  { id: "f_bearing", label: "Rulman sürtünmesi (ayrı ölçüm)", unit: "N", step: 0.01 },
  { id: "area", label: "Cephe alanı A", unit: "m²", step: 0.005 },
];
function sampleCoastdown() {
  Object.assign(state.cdp, { m_static: C.mStatic(state.car), m_eff: C.mEff(state.car), rho: state.car.rho,
    f_bearing: state.car.f_bearing, area: state.car.area });
  buildForm($("cdForm"), CD_FIELDS, state.cdp);
  const pts = C.syntheticCoastdown(state.car, 30, 12, 0.08);
  $("cdData").value = "# zaman_s, hiz_km/sa (örnek: mevcut araç parametrelerinden üretildi)\n" + pts.map((p) => `${p[0]}, ${p[1]}`).join("\n");
  state.cdText = $("cdData").value; save();
}
function runCoastdown() {
  const pts = $("cdData").value.split(/\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith("#"))
    .map((l) => l.split(/[;,\t ]+/).map((x) => parseFloat(x.replace(",", "."))));
  const fit = C.coastdown(pts, state.cdp);
  if (!fit) { $("cdOut").innerHTML = '<p class="muted">En az 4 geçerli satır gerekli.</p>'; return; }
  kpis($("cdOut"), [
    { k: "Yuvarlanma katsayısı Crr", v: nf(fit.crr, 5), u: "", hero: true },
    { k: "CdA", v: nf(fit.cda, 4), u: "m²" },
    { k: "Cd (girilen A ile)", v: nf(fit.cda / state.cdp.area, 3), u: "" },
    { k: "Sabit direnç A", v: nf(fit.A, 3), u: "N" },
    { k: "Aero katsayısı B", v: nf(fit.B, 5), u: "N·s²/m²" },
    { k: "Uyum R² (hız eğrisi)", v: nf(fit.r2, 4), u: `(${fit.n} nokta)` },
    { k: "Hız hatası (RMS)", v: nf(fit.rmse, 3), u: "km/sa" },
  ]);
  lineChart($("cdChart"), {
    series: [
      { name: "Ölçüm", color: "--series-1", points: fit.data.map((p) => [p[0], p[1]]), scatter: true },
      { name: "Model (uyum)", color: "--series-2", points: fit.fit },
    ],
    xLabel: "Zaman (s)", yLabel: "Hız (km/sa)", xUnit: "s", yUnit: "km/sa", height: 260, caption: "Coast-down verisi ve model",
  });
}
buildForm($("cdForm"), CD_FIELDS, state.cdp);
$("cdRun").addEventListener("click", runCoastdown);
$("cdSample").addEventListener("click", () => { sampleCoastdown(); runCoastdown(); });
$("cdData").addEventListener("input", () => { state.cdText = $("cdData").value; save(); });

// ------------------------------------------------------------------ 12. aero
function renderAero() {
  const r = C.aeroEstimate(state.aero);
  kpis($("aeroOut"), [
    { k: "Eşdeğer çap d", v: nf(r.d, 3), u: "m" },
    { k: "Narinlik L/d", v: nf(r.fin, 2), u: "" },
    { k: "Reynolds sayısı", v: r.Re.toExponential(2).replace(".", ","), u: "" },
    { k: "Sürtünme katsayısı Cf", v: nf(r.cf, 5), u: "" },
    { k: "Gövde Cd (Hoerner)", v: nf(r.cdBody, 3), u: "" },
    { k: "Toplam Cd tahmini", v: nf(r.cd, 3), u: "", hero: true },
    { k: "CdA", v: nf(r.cda, 4), u: "m²" },
    { k: "Sürükleme kuvveti", v: nf(r.F, 2), u: "N" },
    { k: "Sürükleme gücü", v: nf(r.P, 1), u: "W" },
  ]);
}
buildForm($("aeroForm"), [
  { id: "L", label: "Gövde uzunluğu", unit: "m", step: 0.01 },
  { id: "area", label: "Cephe alanı", unit: "m²", step: 0.005 },
  { id: "vKmh", label: "Hız", unit: "km/sa", step: 0.1 },
  { id: "addon", label: "Ek ΔCd (teker, açıklık, zemin)", unit: "–", step: 0.005 },
  { id: "regime", label: "Sınır tabaka", options: [["turb", "Tam türbülanslı"], ["mix", "Karma (geçişli)"], ["lam", "Laminer (iyimser)"]] },
  { id: "rho", label: "Hava yoğunluğu", unit: "kg/m³", step: 0.01 },
], state.aero, renderAero);

// ------------------------------------------------------------------ sekmeler, tema, yeniden çizim
const RENDER = {
  arac: renderCar, strateji: renderStrategySetup, tur: renderLap, direksiyon: renderSteer, fren: renderBrakeForm,
  rollbar: renderRb, batarya: renderBat, boyut: renderDim, agirlik: renderCg, aero: renderAero,
  coastdown: () => { $("cdData").value = state.cdText || ""; if (!state.cdText) sampleCoastdown(); runCoastdown(); },
  duyarlilik: () => { if (!$("sensChart").innerHTML) $("runSens").click(); },
  kaynak: () => {},
};
function show(tab) {
  if (!RENDER[tab]) tab = "arac";
  document.querySelectorAll("section.tab").forEach((s) => { s.hidden = s.id !== tab; });
  document.querySelectorAll(".sidenav a").forEach((a) => { if (a.dataset.tab === tab) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current"); });
  RENDER[tab]();
  window.scrollTo(0, 0);
  if (tab === "strateji" && !lastSim) runSim(false);
}
window.addEventListener("hashchange", () => show(location.hash.slice(1)));
let rz;
window.addEventListener("resize", () => { clearTimeout(rz); rz = setTimeout(() => show(location.hash.slice(1) || "arac"), 200); });

const THEMES = ["auto", "light", "dark"];
const THEME_TXT = { auto: "Tema: Otomatik", light: "Tema: Açık", dark: "Tema: Koyu" };
function applyTheme() {
  if (state.theme === "auto") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = state.theme;
  $("themeBtn").textContent = THEME_TXT[state.theme];
}
$("themeBtn").addEventListener("click", () => { state.theme = THEMES[(THEMES.indexOf(state.theme) + 1) % 3]; save(); applyTheme(); });

applyTheme();
markPreset(state.preset);
show(location.hash.slice(1) || "arac");
