/* RangkaianKu - mesin simulasi DC (MNA) */
(function (root) {
  'use strict';

  var DS = 'https://www.alldatasheet.com/view.jsp?Searchword=';
  var DEFS = {
    battery:   { label: 'Baterai',      w: 64, h: 26, pins: [{ n: 'p', dx: -32, dy: 0 }, { n: 'n', dx: 32, dy: 0 }], props: { v: 9 },          hint: 'Sumber tegangan DC', ds: '9V battery' },
    resistor:  { label: 'Resistor',     w: 56, h: 18, pins: [{ n: 'a', dx: -28, dy: 0 }, { n: 'b', dx: 28, dy: 0 }],  props: { r: 330 },        hint: 'Hambatan tetap', ds: 'resistor 1/4W' },
    pot:       { label: 'Potensiometer',w: 56, h: 20, pins: [{ n: 'a', dx: -28, dy: 0 }, { n: 'b', dx: 28, dy: 0 }],  props: { r: 10000 },      hint: 'Hambatan bisa diatur', ds: '10k potentiometer' },
    lamp:      { label: 'Lampu',        w: 44, h: 30, pins: [{ n: 'a', dx: -22, dy: 0 }, { n: 'b', dx: 22, dy: 0 }],  props: { r: 100 },        hint: 'Beban lampu', ds: 'lamp 12V' },
    led:       { label: 'LED',          w: 40, h: 26, pins: [{ n: 'a', dx: -20, dy: 0 }, { n: 'b', dx: 20, dy: 0 }],  props: { vf: 1.8 },       hint: 'Dioda cahaya', ds: 'LED 5mm red' },
    diode:     { label: 'Dioda',        w: 40, h: 26, pins: [{ n: 'a', dx: -20, dy: 0 }, { n: 'b', dx: 20, dy: 0 }],  props: { vf: 0.7 },       hint: 'Dioda silikon 1N4007', ds: '1N4007' },
    zener:     { label: 'Dioda Zener',  w: 40, h: 26, pins: [{ n: 'a', dx: -20, dy: 0 }, { n: 'b', dx: 20, dy: 0 }],  props: { vz: 5.1 },       hint: 'Penstabil tegangan', ds: '1N4733' },
    inductor:  { label: 'Induktor',     w: 56, h: 18, pins: [{ n: 'a', dx: -28, dy: 0 }, { n: 'b', dx: 28, dy: 0 }],  props: { r: 0.05 },       hint: 'Kumparan (DC = kabel)', ds: '10mH inductor' },
    fuse:      { label: 'Sekring',      w: 48, h: 20, pins: [{ n: 'a', dx: -24, dy: 0 }, { n: 'b', dx: 24, dy: 0 }],  props: { rating: 0.5 },   hint: 'Pengaman arus', ds: 'fuse 0.5A' },
    switch:    { label: 'Saklar',       w: 48, h: 22, pins: [{ n: 'a', dx: -24, dy: 0 }, { n: 'b', dx: 24, dy: 0 }],  props: { closed: false }, hint: 'Buka/tutup jalur', ds: 'SPST switch' },
    capacitor: { label: 'Kapasitor',    w: 26, h: 30, pins: [{ n: 'a', dx: -13, dy: 0 }, { n: 'b', dx: 13, dy: 0 }],  props: { c: 100 },        hint: 'Terbuka untuk DC', ds: '100nF capacitor' },
    ammeter:   { label: 'Amperemeter',  w: 44, h: 30, pins: [{ n: 'a', dx: -22, dy: 0 }, { n: 'b', dx: 22, dy: 0 }],  props: {},                hint: 'Ukur arus (seri)', ds: 'ammeter' },
    voltmeter: { label: 'Voltmeter',    w: 44, h: 30, pins: [{ n: 'a', dx: -22, dy: 0 }, { n: 'b', dx: 22, dy: 0 }],  props: {},                hint: 'Ukur tegangan (paralel)', ds: 'digital voltmeter' },
    csource:   { label: 'Sumber Arus',  w: 52, h: 26, pins: [{ n: 'a', dx: -26, dy: 0 }, { n: 'b', dx: 26, dy: 0 }],  props: { i: 0.01 },       hint: 'Arus konstan', ds: 'constant current source' },
    ldr:       { label: 'LDR',          w: 44, h: 30, pins: [{ n: 'a', dx: -22, dy: 0 }, { n: 'b', dx: 22, dy: 0 }],  props: { lux: 100 },      hint: 'Resistor peka cahaya', ds: 'LDR 5mm' },
    npn:       { label: 'Transistor NPN',w: 44, h: 48, pins: [{ n: 'b', dx: -22, dy: 0 }, { n: 'c', dx: 14, dy: -20 }, { n: 'e', dx: 14, dy: 20 }], props: { beta: 200, vbe: 0.7 }, hint: 'BC547 sebagai saklar', ds: 'BC547' },
    buzzer:    { label: 'Buzzer',       w: 36, h: 36, pins: [{ n: 'a', dx: -18, dy: 0 }, { n: 'b', dx: 18, dy: 0 }],  props: { r: 100 },        hint: 'Beban suara', ds: 'buzzer 5V' },
    ground:    { label: 'Ground',       w: 28, h: 22, pins: [{ n: 'g', dx: 0, dy: -11 }], props: {}, hint: 'Titik acuan 0 V', ds: '' }
  };

  Object.keys(DEFS).forEach(function (k) { DEFS[k].dsUrl = DEFS[k].ds ? DS + encodeURIComponent(DEFS[k].ds) : ''; });

  function pinPos(comp, pinName) {
    var d = DEFS[comp.type];
    if (!d) return null;
    var p = null;
    for (var i = 0; i < d.pins.length; i++) if (d.pins[i].n === pinName) p = d.pins[i];
    if (!p) return null;
    var rad = (comp.rot || 0) * Math.PI / 180;
    var c = Math.cos(rad), s = Math.sin(rad);
    return { x: comp.x + p.dx * c - p.dy * s, y: comp.y + p.dx * s + p.dy * c };
  }

  function key(c, p) { return c + ':' + p; }

  function solveLinear(A, b) {
    var n = b.length, i, j, k;
    for (i = 0; i < n; i++) {
      var piv = i;
      for (j = i + 1; j < n; j++) if (Math.abs(A[j][i]) > Math.abs(A[piv][i])) piv = j;
      if (Math.abs(A[piv][i]) < 1e-12) return null;
      if (piv !== i) { var t = A[piv]; A[piv] = A[i]; A[i] = t; var tb = b[piv]; b[piv] = b[i]; b[i] = tb; }
      for (j = i + 1; j < n; j++) {
        var f = A[j][i] / A[i][i];
        if (!f) continue;
        for (k = i; k < n; k++) A[j][k] -= f * A[i][k];
        b[j] -= f * b[i];
      }
    }
    var x = new Array(n);
    for (i = n - 1; i >= 0; i--) {
      var s = b[i];
      for (j = i + 1; j < n; j++) s -= A[i][j] * x[j];
      x[i] = s / A[i][i];
    }
    return x;
  }

  function simulate(components, wires) {
    var comps = components || [], ws = wires || [];
    var byId = {}, i, j;
    for (i = 0; i < comps.length; i++) byId[comps[i].id] = comps[i];
    if (!comps.length) return { ok: false, error: 'Kanvas masih kosong.' };

    var parent = {};
    function find(a) { while (parent[a] !== a) { parent[a] = parent[parent[a]]; a = parent[a]; } return a; }
    function union(a, b) {
      if (!(a in parent)) parent[a] = a;
      if (!(b in parent)) parent[b] = b;
      var ra = find(a), rb = find(b);
      if (ra !== rb) parent[rb] = ra;
    }

    for (i = 0; i < comps.length; i++) {
      var d = DEFS[comps[i].type];
      if (!d) continue;
      for (j = 0; j < d.pins.length; j++) union(key(comps[i].id, d.pins[j].n), key(comps[i].id, d.pins[j].n));
    }
    for (i = 0; i < ws.length; i++) {
      if (!byId[ws[i].ca] || !byId[ws[i].cb]) continue;
      union(key(ws[i].ca, ws[i].pa), key(ws[i].cb, ws[i].pb));
    }

    var groundRoot = null;
    for (i = 0; i < comps.length && groundRoot === null; i++) {
      if (comps[i].type === 'ground') groundRoot = find(key(comps[i].id, 'g'));
    }
    if (groundRoot === null) {
      for (i = 0; i < comps.length && groundRoot === null; i++) {
        if (comps[i].type === 'battery') groundRoot = find(key(comps[i].id, 'n'));
      }
    }
    if (groundRoot === null) return { ok: false, error: 'Tambahkan baterai atau ground dulu.' };

    var idx = {}, n = 0, roots = [];
    var allKeys = Object.keys(parent);
    for (i = 0; i < allKeys.length; i++) {
      var r = find(allKeys[i]);
      if (r === groundRoot) continue;
      if (!(r in idx)) { idx[r] = n++; roots.push(r); }
    }
    function nodeOf(c, p) {
      var r = find(key(c, p));
      return r === groundRoot ? -1 : idx[r];
    }

    function ldrOhm(lux) {
      var p = Math.min(1, Math.max(0, lux / 1000));
      return Math.pow(1e3 / 1e6, p) * 1e6;
    }

    function nv(v, def, min, max) {
      var n = Number(v);
      if (!isFinite(n)) return def;
      return Math.min(max, Math.max(min, n));
    }

    var els = [], vSources = [];
    for (i = 0; i < comps.length; i++) {
      var c = comps[i], t = c.type, P = c.props || {};
      var A = nodeOf(c.id, 'a'), B = nodeOf(c.id, 'b');
      if (t === 'battery') {
        vSources.push({ kind: 'v', id: c.id, a: nodeOf(c.id, 'p'), b: nodeOf(c.id, 'n'), value: nv(P.v, 9, 0.1, 100) });
      } else if (t === 'resistor') {
        els.push({ kind: 'r', id: c.id, a: A, b: B, value: nv(P.r, 330, 0.01, 1e7) });
      } else if (t === 'pot') {
        els.push({ kind: 'r', id: c.id, a: A, b: B, value: nv(P.r, 10000, 0.1, 1e7), pot: true });
      } else if (t === 'lamp') {
        els.push({ kind: 'r', id: c.id, a: A, b: B, value: nv(P.r, 100, 0.1, 1e7), lamp: true });
      } else if (t === 'inductor') {
        els.push({ kind: 'r', id: c.id, a: A, b: B, value: 0.05, inductor: true });
      } else if (t === 'fuse') {
        els.push({ kind: 'fuse', id: c.id, a: A, b: B, r: 0.02, rating: nv(P.rating, 0.5, 0.001, 100) });
      } else if (t === 'ammeter') {
        els.push({ kind: 'r', id: c.id, a: A, b: B, value: 0.001, meter: 'A' });
      } else if (t === 'voltmeter') {
        els.push({ kind: 'open', id: c.id, a: A, b: B, meter: 'V' });
      } else if (t === 'switch') {
        if (P.closed) els.push({ kind: 'r', id: c.id, a: A, b: B, value: 0.005 });
      } else if (t === 'led') {
        els.push({ kind: 'diode', id: c.id, a: A, b: B, vf: nv(P.vf, 1.8, 0.1, 30), r: 10 });
      } else if (t === 'diode') {
        els.push({ kind: 'diode', id: c.id, a: A, b: B, vf: nv(P.vf, 0.7, 0.1, 30), r: 10 });
      } else if (t === 'zener') {
        els.push({ kind: 'zener', id: c.id, a: A, b: B, vf: 0.7, vz: nv(P.vz, 5.1, 0.5, 50), r: 10 });
      } else if (t === 'csource') {
        els.push({ kind: 'i', id: c.id, a: A, b: B, value: nv(P.i, 0.01, -10, 10) });
      } else if (t === 'ldr') {
        var lux = nv(P.lux, 100, 0, 1000);
        els.push({ kind: 'r', id: c.id, a: A, b: B, value: ldrOhm(lux), ldr: true, lux: lux });
      } else if (t === 'buzzer') {
        els.push({ kind: 'r', id: c.id, a: A, b: B, value: nv(P.r, 100, 0.1, 1e7), buzzer: true });
      } else if (t === 'npn') {
        els.push({
          kind: 'npn', id: c.id,
          b: nodeOf(c.id, 'b'), cc: nodeOf(c.id, 'c'), e: nodeOf(c.id, 'e'),
          beta: nv(P.beta, 200, 1, 1000), vbe: nv(P.vbe, 0.7, 0.1, 2),
          rbe: 10, rce: 20
        });
      }
    }

    var m = vSources.length;
    var hasSource = m > 0 || els.some(function (e) { return e.kind === 'i'; });
    if (!hasSource) return { ok: false, error: 'Belum ada sumber tegangan atau sumber arus.' };

    var total = n + m;
    if (total > 120) return { ok: false, error: 'Rangkaian terlalu besar untuk simulasi.' };

    function build(st) {
      var A = [], b = [], r2;
      for (r2 = 0; r2 < total; r2++) { A.push(new Array(total).fill(0)); b.push(0); }
      function stampG(a, bb, g) {
        if (a >= 0) A[a][a] += g;
        if (bb >= 0) A[bb][bb] += g;
        if (a >= 0 && bb >= 0) { A[a][bb] -= g; A[bb][a] -= g; }
      }
      function inject(a, bb, cur) {
        if (a >= 0) b[a] += cur;
        if (bb >= 0) b[bb] -= cur;
      }
      for (var k = 0; k < els.length; k++) {
        var e = els[k];
        if (e.a === e.b && e.kind !== 'voltmeter') continue;
        if (e.kind === 'r') stampG(e.a, e.b, 1 / e.value);
        else if (e.kind === 'fuse') { if (!st.fuse[e.id]) stampG(e.a, e.b, 1 / e.r); }
        else if (e.kind === 'i') inject(e.a, e.b, e.value);
        else if (e.kind === 'diode' && st.diode[e.id]) {
          var g1 = 1 / e.r;
          stampG(e.a, e.b, g1);
          inject(e.a, e.b, g1 * e.vf);
        } else if (e.kind === 'zener') {
          var zs = st.zener[e.id];
          if (zs === 1) { var g2 = 1 / e.r; stampG(e.a, e.b, g2); inject(e.a, e.b, g2 * e.vf); }
          else if (zs === -1) { var g3 = 1 / e.r; stampG(e.a, e.b, g3); inject(e.a, e.b, -g3 * e.vz); }
        } else if (e.kind === 'npn') {
          var tr = st.npn[e.id];
          stampG(e.cc, e.e, 1e-9);
          if (tr && tr.be) {
            var gb = 1 / e.rbe;
            stampG(e.b, e.e, gb);
            inject(e.b, e.e, gb * e.vbe);
            if (tr.sat) stampG(e.cc, e.e, 1 / e.rce);
            else inject(e.e, e.cc, tr.ic);
          }
        }
      }
      for (var q = 0; q < vSources.length; q++) {
        var v = vSources[q], col = n + q;
        if (v.a >= 0) { A[v.a][col] += 1; A[col][v.a] += 1; }
        if (v.b >= 0) { A[v.b][col] -= 1; A[col][v.b] -= 1; }
        b[col] = v.value;
      }
      return { A: A, b: b };
    }

    var st = { diode: {}, zener: {}, fuse: {}, npn: {} };
    for (i = 0; i < els.length; i++) {
      if (els[i].kind === 'diode') st.diode[els[i].id] = false;
      if (els[i].kind === 'zener') st.zener[els[i].id] = 0;
      if (els[i].kind === 'fuse') st.fuse[els[i].id] = false;
      if (els[i].kind === 'npn') st.npn[els[i].id] = { be: false, sat: false, ic: 0 };
    }

    var sol = null, iter, k2;
    for (iter = 0; iter < 80; iter++) {
      var sys = build(st);
      sol = solveLinear(sys.A, sys.b);
      if (!sol) return { ok: false, error: 'Rangkaian tidak bisa dihitung (mungkin ada jalur singkat atau sumber tegangan bertabrakan).' };
      var changed = false;
      for (k2 = 0; k2 < els.length; k2++) {
        var e2 = els[k2];
        var va = e2.a >= 0 ? sol[e2.a] : 0;
        var vb = e2.b >= 0 ? sol[e2.b] : 0;
        var vd = va - vb;
        if (e2.kind === 'diode') {
          var on = vd - e2.vf > (st.diode[e2.id] ? -0.02 : 0.02);
          if (on !== st.diode[e2.id]) { st.diode[e2.id] = on; changed = true; }
        } else if (e2.kind === 'zener') {
          var next = 0;
          if (vd - e2.vf > (st.zener[e2.id] === 1 ? -0.02 : 0.02)) next = 1;
          else if (-vd - e2.vz > (st.zener[e2.id] === -1 ? -0.02 : 0.02)) next = -1;
          if (next !== st.zener[e2.id]) { st.zener[e2.id] = next; changed = true; }
        } else if (e2.kind === 'fuse' && !st.fuse[e2.id]) {
          if (Math.abs(vd / e2.r) > e2.rating) { st.fuse[e2.id] = true; changed = true; }
        } else if (e2.kind === 'npn') {
          var te = st.npn[e2.id];
          var vb = e2.b >= 0 ? sol[e2.b] : 0;
          var vc = e2.cc >= 0 ? sol[e2.cc] : 0;
          var ve = e2.e >= 0 ? sol[e2.e] : 0;
          var vbev = vb - ve, vcev = vc - ve;
          var beOn = vbev > e2.vbe + (te.be ? -0.02 : 0);
          var ib = beOn ? (vbev - e2.vbe) / e2.rbe : 0;
          var icNext = 0, satNext = false;
          if (beOn) {
            var active = e2.beta * ib;
            if (active * e2.rce > Math.max(0, vcev)) { satNext = true; icNext = Math.max(0, vcev) / e2.rce; }
            else { icNext = active; }
          }
          if (beOn !== te.be || satNext !== te.sat || Math.abs(icNext - te.ic) > 1e-7) {
            te.be = beOn; te.sat = satNext; te.ic = icNext; changed = true;
          }
        }
      }
      if (!changed) break;
    }

    var finalSys = build(st);
    var finalSol = solveLinear(finalSys.A, finalSys.b);
    if (finalSol) sol = finalSol;

    var out = { ok: true, nodes: [], elements: [], warnings: [] };
    for (i = 0; i < roots.length; i++) out.nodes.push({ net: roots[i], v: sol[i] });
    for (i = 0; i < els.length; i++) {
      var el = els[i];
      var Va = el.a >= 0 ? sol[el.a] : 0, Vb = el.b >= 0 ? sol[el.b] : 0;
      var cur = 0, extra = {};
      if (el.kind === 'r') cur = (Va - Vb) / el.value;
      else if (el.kind === 'fuse') cur = st.fuse[el.id] ? 0 : (Va - Vb) / el.r;
      else if (el.kind === 'i') cur = el.value;
      else if (el.kind === 'open') cur = 0;
      else if (el.kind === 'diode') {
        cur = st.diode[el.id] ? ((Va - Vb) - el.vf) / el.r : 0;
        extra.on = st.diode[el.id];
      } else if (el.kind === 'zener') {
        var zz = st.zener[el.id];
        cur = zz === 1 ? ((Va - Vb) - el.vf) / el.r : (zz === -1 ? ((Va - Vb) + el.vz) / el.r : 0);
        extra.on = zz !== 0;
        if (zz === -1) extra.note = 'zener ' + el.vz + ' V';
      }
      else if (el.kind === 'npn') {
        var tt = st.npn[el.id];
        var Vc = el.cc >= 0 ? sol[el.cc] : 0;
        var Ve = el.e >= 0 ? sol[el.e] : 0;
        cur = tt.be ? tt.ic : 0;
        extra.on = tt.be;
        extra.note = tt.sat ? 'jenuh' : (tt.be ? 'aktif' : 'cut-off');
        Va = Vc; Vb = Ve;
      }
      if (el.kind === 'fuse' && st.fuse[el.id]) {
        extra.note = 'sekring putus';
        extra.on = false;
        out.warnings.push('Sekring putus: arus melebihi ' + el.rating + ' A.');
      }
      if (el.meter === 'V') { extra.note = 'volt'; extra.on = undefined; }
      out.elements.push({ id: el.id, v: Va - Vb, i: cur, on: extra.on, note: extra.note });
    }
    for (i = 0; i < vSources.length; i++) {
      var vsI = sol[n + i];
      out.elements.push({ id: vSources[i].id, v: vSources[i].value, i: -vsI, source: true });
      if (Math.abs(vsI) > 5) out.warnings.push('Arus baterai sangat besar (' + Math.abs(vsI).toFixed(1) + ' A) - cek jalur singkat.');
    }
    for (i = 0; i < comps.length; i++) {
      if (comps[i].type === 'capacitor') out.elements.push({ id: comps[i].id, v: 0, i: 0, note: 'DC: terbuka' });
    }
    return out;
  }

  root.RK = root.RK || {};
  root.RK.DEFS = DEFS;
  root.RK.pinPos = pinPos;
  root.RK.simulate = simulate;
  if (typeof module !== 'undefined' && module.exports) module.exports = root.RK;
})(typeof window !== 'undefined' ? window : globalThis);
