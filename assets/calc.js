// SEM Prototype-BE hesap çekirdeği (saf fonksiyonlar, tarayıcı + Node)
// Birimler: SI (m, kg, s, N, W) aksi belirtilmedikçe.

export const G0 = 9.81;

// ---------------------------------------------------------------- araç ön ayarları
export const PRESETS = {
  baseline: {
    label: "1. yıl (ticari motor + kayış)",
    m_vehicle: 38, m_driver: 50, m_rot: 1.8, crr: 0.0032, cd: 0.13, area: 0.32, rho: 1.19,
    r_w: 0.234, f_bearing: 0.08, c_alpha: 3900, eta_prop: 0.94, a_cu: 0.20, p_idle: 3.0,
    p_sleep: 0.4, p_aux: 1.0, md_b: 0, md_c: 0, freewheel_drag: 0.04, p_max: 400,
  },
  target: {
    label: "Hedef tasarım (teker içi motor)",
    m_vehicle: 30, m_driver: 50, m_rot: 1.8, crr: 0.0025, cd: 0.11, area: 0.32, rho: 1.19,
    r_w: 0.234, f_bearing: 0.04, c_alpha: 3900, eta_prop: 0.985, a_cu: 0.14, p_idle: 0.35,
    p_sleep: 0.05, p_aux: 0.25, md_b: 0.025, md_c: 0.0003, freewheel_drag: 0, p_max: 400,
  },
  stretch: {
    label: "İddialı (2. yıl optimizasyon)",
    m_vehicle: 26, m_driver: 50, m_rot: 1.8, crr: 0.0020, cd: 0.095, area: 0.32, rho: 1.19,
    r_w: 0.234, f_bearing: 0.03, c_alpha: 3900, eta_prop: 0.99, a_cu: 0.11, p_idle: 0.25,
    p_sleep: 0.05, p_aux: 0.15, md_b: 0.018, md_c: 0.0002, freewheel_drag: 0, p_max: 400,
  },
};

// SEM Polonya (2026 Bölüm II, Madde 226): 11 tur, 14,6 km, en fazla 35 dk
export const DEFAULT_TRACK = {
  lap: 1327, laps: 11, t_max_min: 35, margin_min: 1.0, line_factor: 1.5,
  // temsili viraj listesi: [açı (derece), orta hat yarıçapı (m)]
  turns: [[90, 40], [45, 60], [60, 30], [30, 80], [45, 50], [30, 70], [60, 35]],
};

export const mStatic = (c) => c.m_vehicle + c.m_driver;
export const mEff = (c) => mStatic(c) + c.m_rot;

export function lapProfile(track) {
  const arcs = track.turns.map(([deg, r]) => [deg * Math.PI / 180 * r, r * track.line_factor]);
  const arcLen = arcs.reduce((s, a) => s + a[0], 0);
  const straight = Math.max(0, (track.lap - arcLen) / Math.max(1, arcs.length));
  const segs = [];
  for (const [L, R] of arcs) { segs.push([straight, Infinity]); segs.push([L, R]); }
  const edges = [0];
  for (const [L] of segs) edges.push(edges[edges.length - 1] + L);
  return { edges, radii: segs.map((s) => s[1]), arcLen, straight };
}

function radiusAt(profile, lap, s) {
  const x = s % lap;
  const e = profile.edges;
  let i = 0;
  while (i < e.length - 2 && x >= e[i + 1]) i++;
  return profile.radii[i];
}

// Mekanik direnç bileşenleri [N]
export function resist(c, v, R = Infinity, wind = 0) {
  const va = v + wind;
  const out = {
    yuvarlanma: c.crr * mStatic(c) * G0,
    aero: 0.5 * c.rho * c.cd * c.area * va * Math.abs(va),
    viraj: 0,
    rulman: c.f_bearing,
    motor_suruklenme: 0,
  };
  if (Number.isFinite(R) && v > 0.1) {
    const fy = mStatic(c) * v * v / R;
    out.viraj = fy * fy / c.c_alpha;
  }
  const w = v / c.r_w;
  out.motor_suruklenme = (c.md_b * w + c.md_c * w * w) / Math.max(v, 0.3);
  return out;
}

// Elektrik gücü (joulemetreden geçen), mekanik çıkış p_mech [W] için
export function elecPower(c, pMech, v) {
  const w = Math.max(v / c.r_w, 1.0);
  const t = pMech / w;
  const bakir = c.a_cu * t * t;
  const surucu_aktarma = pMech / c.eta_prop - pMech;
  return { p: pMech + surucu_aktarma + bakir + c.p_idle, parts: { bakir, surucu_aktarma, bosta: c.p_idle } };
}

// Zaman adımlı simülasyon. strategy: "sabit" | "pg"
export function simulate(c, track, o) {
  const prof = lapProfile(track);
  const dist = track.lap * track.laps;
  const dt = o.dt || 0.05;
  let s = 0, v = 0, t = 0, e = 0, on = true;
  const acc = { yuvarlanma: 0, aero: 0, viraj: 0, rulman: 0, motor_suruklenme: 0, bakir: 0, surucu_aktarma: 0, bosta: 0, yardimci: 0, kinetik_son: 0 };
  const trace = [];
  const me = mEff(c);
  let k = 0;
  while (s < dist && t < 7200) {
    const f = resist(c, v, radiusAt(prof, track.lap, s), o.wind || 0);
    const fRes = f.yuvarlanma + f.aero + f.viraj + f.rulman + f.motor_suruklenme + (on ? 0 : c.freewheel_drag);
    let pMech;
    if (o.strategy === "sabit") {
      if (v < o.v_c - 0.02) pMech = v < 0.5 * o.v_c ? c.p_max : Math.min(c.p_max, 250);
      else pMech = fRes * v;
      on = true;
    } else {
      if (v <= o.v_lo) on = true; else if (v >= o.v_hi) on = false;
      pMech = on ? (v < 0.8 * o.v_lo ? c.p_max : o.p_pulse) : 0;
    }
    let pEl, parts;
    if (on && pMech > 0) { const r = elecPower(c, pMech, v); pEl = r.p; parts = r.parts; }
    else { pEl = c.p_sleep; parts = { bakir: 0, surucu_aktarma: 0, bosta: c.p_sleep }; }
    pEl += c.p_aux;
    const fTrac = pMech / Math.max(v, 0.3);
    const a = (fTrac - fRes) / me;
    v = Math.max(0, v + a * dt);
    s += v * dt; t += dt; e += pEl * dt;
    acc.yuvarlanma += f.yuvarlanma * v * dt; acc.aero += f.aero * v * dt; acc.viraj += f.viraj * v * dt;
    acc.rulman += f.rulman * v * dt; acc.motor_suruklenme += f.motor_suruklenme * v * dt;
    acc.bakir += parts.bakir * dt; acc.surucu_aktarma += parts.surucu_aktarma * dt; acc.bosta += parts.bosta * dt;
    acc.yardimci += c.p_aux * dt;
    if (o.log && (k++ % Math.max(1, Math.round(0.5 / dt)) === 0)) trace.push([t, s, v * 3.6, pEl]);
  }
  acc.kinetik_son = 0.5 * me * v * v;
  const wh = e / 3600;
  const lossesWh = Object.fromEntries(Object.entries(acc).map(([kk, val]) => [kk, val / 3600]));
  return { t, wh, km_kwh: (dist / 1000) / (wh / 1000), lossesWh, trace };
}

export function targetTime(track) { return (track.t_max_min - track.margin_min) * 60; }

export function bestConstant(c, track, wind = 0, log = false) {
  const T = targetTime(track);
  const dist = track.lap * track.laps;
  let vc = dist / T * 1.012;
  let r = simulate(c, track, { strategy: "sabit", v_c: vc, wind, dt: 0.1 });
  for (let i = 0; i < 6; i++) { vc *= r.t / T; r = simulate(c, track, { strategy: "sabit", v_c: vc, wind, dt: 0.1 }); }
  r = simulate(c, track, { strategy: "sabit", v_c: vc, wind, dt: 0.05, log });
  return { ...r, v_c: vc * 3.6 };
}

export function pulseGlideAt(c, track, dvKmh, pPulse, wind = 0, log = false) {
  const T = targetTime(track);
  const dist = track.lap * track.laps;
  let vMid = dist / T, lo = 0, hi = 0, r = null;
  for (let i = 0; i < 7; i++) {
    lo = vMid - dvKmh / 3.6 / 2; hi = vMid + dvKmh / 3.6 / 2;
    r = simulate(c, track, { strategy: "pg", v_lo: lo, v_hi: hi, p_pulse: pPulse, wind, dt: 0.1 });
    vMid *= r.t / T;
  }
  if (log) r = simulate(c, track, { strategy: "pg", v_lo: lo, v_hi: hi, p_pulse: pPulse, wind, dt: 0.05, log: true });
  return { ...r, v_lo: lo * 3.6, v_hi: hi * 3.6, p_pulse: pPulse };
}

export function bestPulseGlide(c, track, wind = 0) {
  const T = targetTime(track);
  let best = null;
  for (const p of [80, 120, 160, 220, 300]) {
    for (const dv of [1, 2, 3, 4, 6]) {
      const r = pulseGlideAt(c, track, dv, p, wind);
      if (r.t <= T * 1.003 && (!best || r.wh < best.wh)) best = r;
    }
  }
  return best ? pulseGlideAt(c, track, (best.v_hi - best.v_lo), best.p_pulse, wind, true) : null;
}

export const SENS_TESTS = [
  ["Yuvarlanma katsayısı Crr", ["crr"], 0.2],
  ["Aerodinamik Cd·A", ["cd"], 0.2],
  ["Araç kütlesi", ["m_vehicle"], 0.2],
  ["Motor/sürücü bakır kaybı", ["a_cu"], 0.5],
  ["Boşta + yardımcı tüketim", ["p_aux", "p_idle"], 1.0],
  ["Viraj sertliği (lastik)", ["c_alpha"], -0.2],
];

export function sensitivity(c, track) {
  const ref = bestConstant(c, track).km_kwh;
  const items = SENS_TESTS.map(([label, keys, frac]) => {
    const vals = [-1, 1].map((sg) => {
      const cc = { ...c };
      for (const k of keys) cc[k] = c[k] * (1 + sg * frac);
      return bestConstant(cc, track).km_kwh - ref;
    });
    return { label, frac, eksi: vals[0], arti: vals[1] };
  });
  return { ref, items };
}

// Sabit hızda kararlı durum (viraj yok) — hızlı hesap
export function steadyState(c, vKmh, distKm) {
  const v = vKmh / 3.6;
  const f = resist(c, v);
  const fTot = f.yuvarlanma + f.aero + f.rulman + f.motor_suruklenme;
  const pWheel = fTot * v;
  const el = elecPower(c, pWheel, v);
  const pElec = el.p + c.p_aux;
  const tH = distKm / vKmh;
  const wh = pElec * tH;
  return { f, fTot, pWheel, pElec, eta: pWheel / pElec, wh, km_kwh: distKm / (wh / 1000), whPerKm: wh / distKm };
}

// ---------------------------------------------------------------- direksiyon / dönüş
export function steering({ wb_mm, track_mm, delta_i_deg, r_w_mm, r_req_m = 8 }) {
  const wb = wb_mm / 1000, t = track_mm / 1000;
  const di = delta_i_deg * Math.PI / 180;
  const Rc = t / 2 + wb / Math.tan(di);          // arka teker (aks ortası) yarıçapı
  const delta_o = Math.atan(wb / (Rc + t / 2));
  const R_outer = Math.hypot(wb, Rc + t / 2);    // kural: dış tekerin izlediği yarıçap
  const reqOuter = Math.asin(Math.min(1, wb / r_req_m));
  const RcReq = Math.sqrt(r_req_m * r_req_m - wb * wb) - t / 2;
  const reqInner = Math.atan(wb / (RcReq - t / 2));
  const armAngle = Math.atan((t / 2) / wb);
  const sweep = (r_w_mm || 234) * Math.sin(di);
  return {
    R_outer, Rc, delta_o_deg: delta_o * 180 / Math.PI,
    req_outer_deg: reqOuter * 180 / Math.PI, req_inner_deg: reqInner * 180 / Math.PI,
    ackermann_arm_deg: armAngle * 180 / Math.PI, sweep_mm: sweep, ok: R_outer <= r_req_m,
  };
}

// ---------------------------------------------------------------- fren %20 eğim
export function brakeIncline({ m_total, grade = 0.2, r_w_mm, n_wheels, r_disc_mm, mu, piston_d_mm, pistons_per_side,
  mc_d_mm, lever_ratio, f_limit_n }) {
  const th = Math.atan(grade);
  const F = m_total * G0 * Math.sin(th);                   // gereken toplam fren kuvveti (yer)
  const T_total = F * r_w_mm / 1000;                        // toplam tekerlek torku
  const T_wheel = T_total / n_wheels;
  const A_p = pistons_per_side * Math.PI * (piston_d_mm / 2000) ** 2;  // bir taraftaki piston alanı
  const F_clamp = T_wheel / (2 * mu * r_disc_mm / 1000);   // iki balata
  const p = F_clamp / A_p;                                  // Pa
  const A_mc = Math.PI * (mc_d_mm / 2000) ** 2;
  const F_mc = p * A_mc;
  const F_input = F_mc / lever_ratio;
  return { F, T_total, T_wheel, F_clamp, p_bar: p / 1e5, F_mc, F_input, margin: f_limit_n / F_input, ok: F_input <= f_limit_n };
}

// ---------------------------------------------------------------- roll bar 700 N
export function rollbar({ d_mm, t_mm, span_mm, sigma_y, E_gpa, load_n = 700, support = "basit", helmet_top_mm, bar_top_mm }) {
  const D = d_mm, d = d_mm - 2 * t_mm, L = span_mm;
  const I = Math.PI * (D ** 4 - d ** 4) / 64;               // mm^4
  const Z = I / (D / 2);
  const M = support === "ankastre" ? load_n * L / 8 : load_n * L / 4;  // N·mm
  const sigma = M / Z;                                       // MPa
  const E = E_gpa * 1000;                                    // MPa
  const defl = support === "ankastre" ? load_n * L ** 3 / (192 * E * I) : load_n * L ** 3 / (48 * E * I);
  const mass_per_m = Math.PI * (D * D - d * d) / 4 * 1e-6 * 2700; // Al için kg/m
  const clearance = (bar_top_mm ?? 0) - (helmet_top_mm ?? 0);
  return { I, Z, M, sigma, sf: sigma_y / sigma, defl, mass_per_m, clearance, ok: sigma_y / sigma >= 2 && clearance >= 50 };
}

// ---------------------------------------------------------------- batarya
export function battery({ v_nom, v_max, ah, s, p, cell_g, i_cont, wh_attempt, dod = 0.8, p_peak }) {
  const Vn = s * v_nom, Vmax = s * v_max, Vmin = s * 3.0;
  const wh = s * p * ah * v_nom;
  const mass = s * p * cell_g / 1000;
  const iMax = p * i_cont;
  const iPeak = p_peak / Vmin;
  const attempts = wh * dod / wh_attempt;
  return { Vn, Vmax, wh, mass, iMax, iPeak, attempts, okV: Vmax <= 60, okWh: wh <= 1000, okI: iPeak <= iMax,
    fuse: Math.ceil(iPeak * 1.5 / 5) * 5 };
}

// ---------------------------------------------------------------- boyut uyumu (Madde 39)
export function dimensions({ h, track, wb, width, length, mass }) {
  return [
    { key: "Yükseklik < 1000 mm", val: `${h} mm`, ok: h < 1000 },
    { key: "İz genişliği ≥ 500 mm", val: `${track} mm`, ok: track >= 500 },
    { key: "Yükseklik / iz < 1,25", val: (h / track).toFixed(3), ok: h / track < 1.25 },
    { key: "Dingil mesafesi ≥ 1000 mm", val: `${wb} mm`, ok: wb >= 1000 },
    { key: "Toplam genişlik ≤ 1300 mm", val: `${width} mm`, ok: width <= 1300 },
    { key: "Toplam uzunluk ≤ 3500 mm", val: `${length} mm`, ok: length <= 3500 },
    { key: "Araç kütlesi (sürücüsüz) ≤ 140 kg", val: `${mass} kg`, ok: mass <= 140 },
  ];
}

// ---------------------------------------------------------------- ağırlık merkezi
export function cog(rows, { x_fa, x_ra, track }) {
  const M = rows.reduce((s, r) => s + r.m, 0);
  const xg = rows.reduce((s, r) => s + r.m * r.x, 0) / M;
  const zg = rows.reduce((s, r) => s + r.m * r.z, 0) / M;
  const wb = x_ra - x_fa;
  const rear = M * (xg - x_fa) / wb, front = M - rear;
  const axLen = Math.hypot(wb, track / 2);
  const d = (track / 2) * (x_ra - xg) / axLen;
  const phi = Math.atan2(track / 2, wb);
  const ay = d / (zg * Math.cos(phi));
  return { M, xg, zg, front, rear, frontPct: 100 * front / M, d, ay };
}

// ---------------------------------------------------------------- coast-down analizi
// Model: m_eff·dv/dt = -(A + B·v²)  ->  Crr = (A - F_rulman)/(m·g), CdA = 2B/ρ
// Analitik çözüm v(t) = c·tan(atan(v0/c) - k·t), c = √(A/B), k = √(A·B)/m_eff
// Önce sonlu farklarla ilk tahmin, sonra hız eğrisine Nelder–Mead ile doğrudan uydurma (gürültüye dayanıklı).
export function nelderMead(f, x0, step, iters = 600) {
  const n = x0.length;
  let S = [x0.slice()];
  for (let i = 0; i < n; i++) { const x = x0.slice(); x[i] += step[i]; S.push(x); }
  let F = S.map(f);
  for (let it = 0; it < iters; it++) {
    const ord = F.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0]).map((p) => p[1]);
    S = ord.map((i) => S[i]); F = ord.map((i) => F[i]);
    const cen = Array(n).fill(0);
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) cen[j] += S[i][j] / n;
    const w = S[n];
    const r = cen.map((c, j) => c + (c - w[j])); const fr = f(r);
    if (fr < F[0]) {
      const e = cen.map((c, j) => c + 2 * (c - w[j])); const fe = f(e);
      if (fe < fr) { S[n] = e; F[n] = fe; } else { S[n] = r; F[n] = fr; }
    } else if (fr < F[n - 1]) { S[n] = r; F[n] = fr; } else {
      const k = cen.map((c, j) => c + 0.5 * (w[j] - c)); const fk = f(k);
      if (fk < F[n]) { S[n] = k; F[n] = fk; } else {
        for (let i = 1; i <= n; i++) { S[i] = S[i].map((x, j) => S[0][j] + 0.5 * (x - S[0][j])); F[i] = f(S[i]); }
      }
    }
  }
  const b = F.indexOf(Math.min(...F));
  return S[b];
}

function cdModel(A, B, v0, m, t) {
  const c = Math.sqrt(A / B), k = Math.sqrt(A * B) / m;
  const arg = Math.atan(v0 / c) - k * t;
  return arg > 0 ? c * Math.tan(arg) : 0;
}

export function coastdown(points, { m_static, m_eff, rho, f_bearing = 0 }) {
  const P = points.filter((p) => p.length >= 2 && Number.isFinite(p[0]) && Number.isFinite(p[1])).sort((a, b) => a[0] - b[0]);
  if (P.length < 4) return null;
  const t0 = P[0][0];
  const T = P.map((p) => p[0] - t0), Vd = P.map((p) => p[1] / 3.6);
  // 1) sonlu farklarla ilk tahmin
  const xs = [], ys = [];
  for (let i = 1; i < P.length; i++) {
    const dt = T[i] - T[i - 1]; if (dt <= 0) continue;
    const vm = (Vd[i] + Vd[i - 1]) / 2;
    xs.push(vm * vm); ys.push(-m_eff * (Vd[i] - Vd[i - 1]) / dt);
  }
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0, sxx = 0;
  for (let i = 0; i < n; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; }
  let B0 = sxx > 0 ? sxy / sxx : 0.02, A0 = my - B0 * mx;
  if (!(A0 > 0.2)) A0 = Math.max(0.2, my * 0.7);
  if (!(B0 > 0.002)) B0 = 0.02;
  // 2) hız eğrisine doğrudan uydurma (log-parametre ile pozitiflik)
  const sse = ([la, lb, v0]) => {
    const A = Math.exp(la), B = Math.exp(lb);
    let e = 0;
    for (let i = 0; i < T.length; i++) { const d = cdModel(A, B, v0, m_eff, T[i]) - Vd[i]; e += d * d; }
    return e;
  };
  const best = nelderMead(sse, [Math.log(A0), Math.log(B0), Vd[0]], [0.3, 0.3, 0.1]);
  const best2 = nelderMead(sse, best, [0.05, 0.05, 0.02]);
  const A = Math.exp(best2[0]), B = Math.exp(best2[1]), v0 = best2[2];
  const meanV = Vd.reduce((a, b) => a + b, 0) / Vd.length;
  const ssTot = Vd.reduce((s2, v) => s2 + (v - meanV) ** 2, 0);
  const res = sse(best2);
  const rmse = Math.sqrt(res / Vd.length) * 3.6;
  const fit = [];
  const tEnd = T[T.length - 1];
  for (let t = 0; t <= tEnd + 1e-9; t += Math.max(0.25, tEnd / 300)) fit.push([t + t0, cdModel(A, B, v0, m_eff, t) * 3.6]);
  return { A, B, crr: (A - f_bearing) / (m_static * G0), cda: 2 * B / rho, r2: 1 - res / ssTot, rmse, n: P.length, fit, data: P };
}

export function syntheticCoastdown(c, v0Kmh = 30, v1Kmh = 12, noise = 0.05) {
  const pts = [];
  let v = v0Kmh / 3.6, t = 0, seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 - 0.5; };
  const A = c.crr * mStatic(c) * G0 + c.f_bearing;
  const B = 0.5 * c.rho * c.cd * c.area;
  while (v * 3.6 > v1Kmh) {
    if (Math.abs(t / 2 - Math.round(t / 2)) < 1e-6) pts.push([+t.toFixed(1), +(v * 3.6 + rnd() * 2 * noise).toFixed(3)]);
    const a = -(A + B * v * v) / mEff(c);
    v += a * 0.1; t += 0.1;
  }
  return pts;
}

// ---------------------------------------------------------------- aerodinamik tahmin (Hoerner)
export function aeroEstimate({ L, area, vKmh, nu = 1.5e-5, addon = 0.03, rho = 1.19, regime = "turb" }) {
  const d = Math.sqrt(4 * area / Math.PI);
  const fin = L / d;
  const v = vKmh / 3.6;
  const Re = v * L / nu;
  const cf = regime === "lam" ? 1.328 / Math.sqrt(Re) : regime === "mix" ? 0.074 / Re ** 0.2 - 1700 / Re : 0.074 / Re ** 0.2;
  const cdBody = cf * (3 * fin + 4.5 * Math.sqrt(1 / fin) + 21 / (fin * fin));
  const cd = cdBody + addon;
  const cda = cd * area;
  const F = 0.5 * rho * cda * v * v;
  return { d, fin, Re, cf, cdBody, cd, cda, F, P: F * v };
}

// ---------------------------------------------------------------- tur planı
export function lapPlan({ lap, laps, t_max_min, margin_s }) {
  const dist = lap * laps;
  const tTarget = t_max_min * 60 - margin_s;
  const vMin = dist / (t_max_min * 60) * 3.6;
  const vTarget = dist / tTarget * 3.6;
  const lapT = tTarget / laps;
  const rows = Array.from({ length: laps }, (_, i) => ({ lap: i + 1, t: lapT * (i + 1), dist: lap * (i + 1) }));
  return { dist, vMin, vTarget, lapT, rows };
}

export function fmtTime(s) {
  const m = Math.floor(s / 60), ss = Math.round(s - m * 60);
  return `${m}:${String(ss).padStart(2, "0")}`;
}
