/* RangkaianKu - mesin simulasi DC (MNA) */
(function (root) {
  'use strict';

  var DEFS = {
    battery:   { label: 'Baterai',  w: 64, h: 26, pins: [{ n: 'p', dx: -32, dy: 0 }, { n: 'n', dx: 32, dy: 0 }], props: { v: 9 },    hint: 'Sumber tegangan DC' },
    resistor:  { label: 'Resistor', w: 56, h: 18, pins: [{ n: 'a', dx: -28, dy: 0 }, { n: 'b', dx: 28, dy: 0 }],  props: { r: 330 },  hint: 'Hambatan (ohm)' },
    lamp:      { label: 'Lampu',    w: 44, h: 30, pins: [{ n: 'a', dx: -22, dy: 0 }, { n: 'b', dx: 22, dy: 0 }],  props: { r: 100 },  hint: 'Beban lampu' },
    led:       { label: 'LED',      w: 40, h: 26, pins: [{ n: 'a', dx: -20, dy: 0 }, { n: 'b', dx: 20, dy: 0 }],  props: { vf: 1.8 }, hint: 'Dioda cahaya' },
    switch:    { label: 'Saklar',   w: 48, h: 22, pins: [{ n: 'a', dx: -24, dy: 0 }, { n: 'b', dx: 24, dy: 0 }],  props: { closed: false }, hint: 'Buka/tutup jalur' },
    capacitor: { label: 'Kapasitor',w: 26, h: 30, pins: [{ n: 'a', dx: -13, dy: 0 }, { n: 'b', dx: 13, dy: 0 }],  props: { c: 100 },  hint: 'Terbuka untuk DC' },
    ground:    { label: 'Ground',   w: 28, h: 22, pins: [{ n: 'g', dx: 0, dy: -11 }], props: {}, hint: 'Titik acuan 0 V' }
  };

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

    var els = [], vSources = [];
    for (i = 0; i < comps.length; i++) {
      var c = comps[i];
      if (c.type === 'battery') vSources.push({ kind: 'v', id: c.id, a: nodeOf(c.id, 'p'), b: nodeOf(c.id, 'n'), value: Number(c.props && c.props.v) || 0 });
      else if (c.type === 'resistor') els.push({ kind: 'r', id: c.id, a: nodeOf(c.id, 'a'), b: nodeOf(c.id, 'b'), value: Math.max(0.01, Number(c.props && c.props.r) || 330) });
      else if (c.type === 'lamp') els.push({ kind: 'r', id: c.id, a: nodeOf(c.id, 'a'), b: nodeOf(c.id, 'b'), value: Math.max(0.01, Number(c.props && c.props.r) || 100), lamp: true });
      else if (c.type === 'switch') { if (c.props && c.props.closed) els.push({ kind: 'r', id: c.id, a: nodeOf(c.id, 'a'), b: nodeOf(c.id, 'b'), value: 0.005 }); }
      else if (c.type === 'led') els.push({ kind: 'led', id: c.id, a: nodeOf(c.id, 'a'), b: nodeOf(c.id, 'b'), vf: Number(c.props && c.props.vf) || 1.8, r: 10 });
    }

    var m = vSources.length;
    if (!m) return { ok: false, error: 'Belum ada sumber tegangan (baterai).' };

    var total = n + m;
    if (total > 120) return { ok: false, error: 'Rangkaian terlalu besar untuk simulasi.' };

    function build(ledStates) {
      var A = [], b = [], r2, c2;
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
        if (e.a === e.b) continue;
        if (e.kind === 'r') stampG(e.a, e.b, 1 / e.value);
        else if (e.kind === 'led' && ledStates[e.id]) {
          var g = 1 / e.r;
          stampG(e.a, e.b, g);
          inject(e.a, e.b, g * e.vf);
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

    var ledStates = {};
    for (i = 0; i < els.length; i++) if (els[i].kind === 'led') ledStates[els[i].id] = false;

    var sol = null, iter;
    for (iter = 0; iter < 40; iter++) {
      var sys = build(ledStates);
      sol = solveLinear(sys.A, sys.b);
      if (!sol) return { ok: false, error: 'Rangkaian tidak bisa dihitung (mungkin ada jalur singkat atau sumber tegangan bertabrakan).' };
      var changed = false;
      for (i = 0; i < els.length; i++) {
        var led = els[i];
        if (led.kind !== 'led') continue;
        var va = led.a >= 0 ? sol[led.a] : 0;
        var vb = led.b >= 0 ? sol[led.b] : 0;
        var vOn = (va - vb) - led.vf;
        var should = vOn > 0.02;
        if (should !== ledStates[led.id]) { ledStates[led.id] = should; changed = true; }
      }
      if (!changed) break;
    }

    var out = { ok: true, nodes: [], elements: [], warnings: [] };
    for (i = 0; i < roots.length; i++) out.nodes.push({ net: roots[i], v: sol[i] });
    for (i = 0; i < els.length; i++) {
      var el = els[i];
      var Va = el.a >= 0 ? sol[el.a] : 0, Vb = el.b >= 0 ? sol[el.b] : 0;
      var cur;
      if (el.kind === 'r') cur = (Va - Vb) / el.value;
      else cur = ledStates[el.id] ? ((Va - Vb) - el.vf) / el.r : 0;
      out.elements.push({ id: el.id, v: Va - Vb, i: cur, on: el.kind === 'led' ? ledStates[el.id] : undefined });
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
