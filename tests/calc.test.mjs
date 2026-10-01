// node tests/calc.test.mjs  — hesap çekirdeği doğrulama
import assert from "node:assert/strict";
import * as C from "../assets/calc.js";

const T = C.DEFAULT_TRACK;
const t0 = Date.now();
const res = {};
for (const [k, car] of Object.entries(C.PRESETS)) {
  const c = C.bestConstant(car, T);
  const pg = C.bestPulseGlide(car, T);
  res[k] = { sabit: Math.round(c.km_kwh), pg: Math.round(pg.km_kwh), t: (c.t / 60).toFixed(2), vc: c.v_c.toFixed(2) };
}
console.log(res, `${Date.now() - t0} ms`);
// Python referansı: baseline 646/656, target 936/926, stretch 1179/1163 (±2%)
const near = (a, b, tol = 0.02) => Math.abs(a - b) / b <= tol;
assert.ok(near(res.baseline.sabit, 646) && near(res.baseline.pg, 656));
assert.ok(near(res.target.sabit, 936) && near(res.target.pg, 926));
assert.ok(near(res.stretch.sabit, 1179) && near(res.stretch.pg, 1163));

// enerji dengesi kapanmalı
const r = C.bestConstant(C.PRESETS.target, T);
const sum = Object.values(r.lossesWh).reduce((s, v) => s + v, 0);
assert.ok(Math.abs(sum - r.wh) / r.wh < 0.01, `denge ${sum} vs ${r.wh}`);

// direksiyon: WB 1420, iz 510, iç teker 12° -> R_dış < 8 m
const st = C.steering({ wb_mm: 1420, track_mm: 510, delta_i_deg: 12, r_w_mm: 234 });
console.log("direksiyon", st.R_outer.toFixed(2), st.delta_o_deg.toFixed(2), st.req_inner_deg.toFixed(2));
assert.ok(st.ok && st.R_outer > 6 && st.R_outer < 8);

// roll bar: Ø25x2 Al6061, 400 mm açıklık, 700 N -> ~91 MPa
const rb = C.rollbar({ d_mm: 25, t_mm: 2, span_mm: 400, sigma_y: 276, E_gpa: 69, helmet_top_mm: 524, bar_top_mm: 591 });
console.log("rollbar", rb.sigma.toFixed(1), rb.sf.toFixed(2), rb.defl.toFixed(3));
assert.ok(rb.sigma > 85 && rb.sigma < 95);

// fren
const br = C.brakeIncline({ m_total: 80, r_w_mm: 234, n_wheels: 1, r_disc_mm: 62, mu: 0.4, piston_d_mm: 22,
  pistons_per_side: 1, mc_d_mm: 10, lever_ratio: 4, f_limit_n: 100 });
console.log("fren", br.F.toFixed(1), br.T_wheel.toFixed(1), br.F_input.toFixed(1));

// batarya 12S1P
const ba = C.battery({ v_nom: 3.6, v_max: 4.2, ah: 2.8, s: 12, p: 1, cell_g: 46, i_cont: 25, wh_attempt: 16, p_peak: 400 });
console.log("batarya", ba.Vn, ba.Vmax.toFixed(1), ba.wh.toFixed(0), ba.attempts.toFixed(1), ba.fuse);
assert.ok(ba.okV && ba.okWh);

// coast-down: sentetik veriden parametreleri geri bulmalı
const pts = C.syntheticCoastdown(C.PRESETS.target, 30, 12, 0.0);
const fit = C.coastdown(pts, { m_static: 80, m_eff: 81.8, rho: 1.19, f_bearing: 0.04 });
console.log("coastdown crr", fit.crr.toFixed(5), "cda", fit.cda.toFixed(4), "r2", fit.r2.toFixed(4), "n", fit.n);
assert.ok(Math.abs(fit.crr - 0.0025) < 0.0002 && Math.abs(fit.cda - 0.0352) < 0.003);

// aero
const ae = C.aeroEstimate({ L: 2.75, area: 0.32, vKmh: 25.9 });
console.log("aero", ae.fin.toFixed(2), ae.Re.toExponential(2), ae.cdBody.toFixed(4), ae.cd.toFixed(3));

// boyutlar
assert.ok(C.dimensions({ h: 607, track: 510, wb: 1420, width: 670, length: 2750, mass: 30 }).every((r) => r.ok));
console.log("TÜM TESTLER GEÇTİ");

// gürültülü coast-down (±0,08 km/sa) -> %10 içinde geri bulunmalı
{
  const noisy = C.syntheticCoastdown(C.PRESETS.target, 30, 12, 0.08);
  const f2 = C.coastdown(noisy, { m_static: 80, m_eff: 81.8, rho: 1.19, f_bearing: 0.04 });
  console.log("gürültülü coastdown crr", f2.crr.toFixed(5), "cda", f2.cda.toFixed(4), "r2", f2.r2.toFixed(4), "rmse", f2.rmse.toFixed(3));
  assert.ok(Math.abs(f2.crr - 0.0025) / 0.0025 < 0.1 && Math.abs(f2.cda - 0.0352) / 0.0352 < 0.12);
  console.log("GÜRÜLTÜLÜ COAST-DOWN TESTİ GEÇTİ");
}
