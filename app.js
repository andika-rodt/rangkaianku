/* RangkaianKu - antarmuka */
(function () {
  'use strict';

  var RK = window.RK, CORE = RK.CORE, DEFS = RK.DEFS;
  var SVGNS = 'http://www.w3.org/2000/svg';
  var KEY_DRAFT = 'rk.draft.v1';
  var KEY_LASTBUILD = 'rk.lastbuild.v1';

  var S = {
    circ: CORE.emptyCircuit(),
    saved: CORE.loadCircuits(),
    prefs: CORE.loadPrefs(),
    sel: null,
    mode: 'select',
    wireStart: null,
    view: { x: 0, y: 0, k: 1 },
    result: null,
    undo: [], redo: [],
    tab: 'canvas',
    installEvt: null,
    simOk: null
  };

  var $ = function (id) { return document.getElementById(id); };
  var svg, world, layerWires, layerComps, layerLive;

  function el(tag, attrs, text) {
    var n = document.createElementNS(SVGNS, tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'dataset') return;
      n.setAttribute(k, attrs[k]);
    });
    if (text != null) n.textContent = text;
    return n;
  }

  function toast(msg, kind) {
    var t = $('toast');
    t.textContent = msg;
    t.className = 'toast show ' + (kind || '');
    clearTimeout(t._timer);
    t._timer = setTimeout(function () { t.className = 'toast'; }, 2600);
  }

  /* ---------- riwayat ---------- */
  function snapshot() {
    S.undo.push(JSON.stringify({ components: S.circ.components, wires: S.circ.wires }));
    if (S.undo.length > 30) S.undo.shift();
    S.redo.length = 0;
  }
  function restore(json) {
    var d = JSON.parse(json);
    S.circ.components = d.components;
    S.circ.wires = d.wires;
    S.sel = null;
    S.result = null;
    renderAll();
    scheduleDraft();
  }
  function undo() {
    if (!S.undo.length) return;
    S.redo.push(JSON.stringify({ components: S.circ.components, wires: S.circ.wires }));
    restore(S.undo.pop());
    CORE.logAction('undo');
  }
  function redo() {
    if (!S.redo.length) return;
    S.undo.push(JSON.stringify({ components: S.circ.components, wires: S.circ.wires }));
    restore(S.redo.pop());
    CORE.logAction('redo');
  }

  /* ---------- draft ---------- */
  var draftTimer;
  function scheduleDraft() {
    clearTimeout(draftTimer);
    draftTimer = setTimeout(function () {
      try {
        localStorage.setItem(KEY_DRAFT, JSON.stringify({ schema: CORE.SCHEMA, components: S.circ.components, wires: S.circ.wires, name: S.circ.name }));
      } catch (e) { /* kuota penuh: abaikan */ }
    }, 400);
  }
  function loadDraft() {
    try {
      var raw = localStorage.getItem(KEY_DRAFT);
      if (!raw || raw.length > 400000) return null;
      var d = JSON.parse(raw);
      var c = CORE.validateCircuit(d, 'Draf terakhir');
      c.id = S.circ.id;
      return c;
    } catch (e) { return null; }
  }

  /* ---------- kanvas ---------- */
  function getComp(id) {
    for (var i = 0; i < S.circ.components.length; i++) if (S.circ.components[i].id === id) return S.circ.components[i];
    return null;
  }

  function toWorld(ev) {
    var r = svg.getBoundingClientRect();
    return { x: (ev.clientX - r.left - S.view.x) / S.view.k, y: (ev.clientY - r.top - S.view.y) / S.view.k };
  }

  function drawGrid() {
    var g = $('grid');
    while (g.firstChild) g.removeChild(g.firstChild);
    var size = 5000;
    var rect = el('rect', { x: -size, y: -size, width: size * 2, height: size * 2, fill: 'url(#dots)' });
    g.appendChild(rect);
  }

  function compSymbol(c, g) {
    var d = DEFS[c.type];
    var w = d.w, h = d.h;
    var body = el('rect', { x: -w / 2, y: -h / 2, width: w, height: h, rx: 7, class: 'cbody' });
    g.appendChild(body);

    if (c.type === 'battery') {
      g.appendChild(el('line', { x1: -8, y1: -h / 2 + 4, x2: -8, y2: h / 2 - 4, class: 'csym' }));
      g.appendChild(el('line', { x1: 8, y1: -h / 2 + 9, x2: 8, y2: h / 2 - 9, class: 'csym' }));
    } else if (c.type === 'resistor' || c.type === 'lamp') {
      var pts = [];
      for (var i = 0; i <= 8; i++) pts.push((-w / 2 + 8 + i * (w - 16) / 8) + ',' + (i % 2 ? -5 : 5));
      g.appendChild(el('polyline', { points: pts.join(' '), class: 'csym' }));
    } else if (c.type === 'led') {
      g.appendChild(el('circle', { cx: 0, cy: 0, r: 7, class: 'csym' }));
      g.appendChild(el('line', { x1: 7, y1: 0, x2: 15, y2: 0, class: 'csym' }));
    } else if (c.type === 'switch') {
      g.appendChild(el('line', { x1: -12, y1: 0, x2: 2, y2: c.props.closed ? 0 : -9, class: 'csym' }));
      g.appendChild(el('circle', { cx: -12, cy: 0, r: 2 })); g.appendChild(el('circle', { cx: 12, cy: 0, r: 2 }));
    } else if (c.type === 'capacitor') {
      g.appendChild(el('line', { x1: -4, y1: -10, x2: -4, y2: 10, class: 'csym' }));
      g.appendChild(el('line', { x1: 4, y1: -10, x2: 4, y2: 10, class: 'csym' }));
    } else if (c.type === 'ground') {
      g.appendChild(el('line', { x1: -10, y1: 4, x2: 10, y2: 4, class: 'csym' }));
      g.appendChild(el('line', { x1: -6, y1: 9, x2: 6, y2: 9, class: 'csym' }));
      g.appendChild(el('line', { x1: -2, y1: 14, x2: 2, y2: 14, class: 'csym' }));
    }

    var label = DEFS[c.type].label;
    if (c.type === 'battery') label = c.props.v + 'V';
    else if (c.type === 'resistor' || c.type === 'lamp') label = c.props.r + '\u03A9';
    else if (c.type === 'led') label = 'LED';
    else if (c.type === 'capacitor') label = c.props.c + 'nF';
    else if (c.type === 'switch') label = c.props.closed ? 'Tutup' : 'Buka';
    g.appendChild(el('text', { x: 0, y: h / 2 + (c.type === 'ground' ? 30 : 20), class: 'clabel' }, label));

    d.pins.forEach(function (p) {
      var rad = (c.rot || 0) * Math.PI / 180;
      var px = p.dx * Math.cos(rad) - p.dy * Math.sin(rad);
      var py = p.dx * Math.sin(rad) + p.dy * Math.cos(rad);
      var pin = el('circle', { cx: px, cy: py, r: S.mode === 'wire' ? 9 : 6, class: 'cpin' });
      pin.dataset.pin = p.n;
      if (S.wireStart && S.wireStart.comp === c.id && S.wireStart.pin === p.n) pin.classList.add('active');
      g.appendChild(pin);
    });
  }

  function renderCanvas() {
    while (layerWires.firstChild) layerWires.removeChild(layerWires.firstChild);
    while (layerComps.firstChild) layerComps.removeChild(layerComps.firstChild);
    while (layerLive.firstChild) layerLive.removeChild(layerLive.firstChild);

    S.circ.wires.forEach(function (w) {
      var ca = getComp(w.ca), cb = getComp(w.cb);
      if (!ca || !cb) return;
      var a = RK.pinPos(ca, w.pa), b = RK.pinPos(cb, w.pb);
      if (!a || !b) return;
      var dx = Math.abs(b.x - a.x), dy = Math.abs(b.y - a.y);
      var d;
      if (dx > dy) { var mx = (a.x + b.x) / 2; d = 'M' + a.x + ',' + a.y + 'L' + mx + ',' + a.y + 'L' + mx + ',' + b.y + 'L' + b.x + ',' + b.y; }
      else { var my = (a.y + b.y) / 2; d = 'M' + a.x + ',' + a.y + 'L' + a.x + ',' + my + 'L' + b.x + ',' + my + 'L' + b.x + ',' + b.y; }
      var hit = el('path', { d: d, class: 'whit' });
      hit.dataset.wire = w.id;
      layerWires.appendChild(hit);
      var line = el('path', { d: d, class: 'wire' + (S.sel && S.sel.kind === 'wire' && S.sel.id === w.id ? ' sel' : '') });
      layerWires.appendChild(line);
    });

    S.circ.components.forEach(function (c) {
      var g = el('g', { transform: 'translate(' + c.x + ',' + c.y + ') rotate(' + (c.rot || 0) + ')', class: 'comp' });
      g.dataset.comp = c.id;
      if (S.sel && S.sel.kind === 'comp' && S.sel.id === c.id) g.classList.add('sel');
      compSymbol(c, g);
      layerComps.appendChild(g);
    });

    if (S.result && S.result.ok) {
      S.result.elements.forEach(function (e) {
        var c = getComp(e.id);
        if (!c) return;
        var txt;
        if (e.note) txt = e.note;
        else if (e.source) txt = Math.abs(e.i * 1000).toFixed(1) + ' mA';
        else txt = (e.v).toFixed(2) + ' V \u00B7 ' + Math.abs(e.i * 1000).toFixed(1) + ' mA';
        var t = el('text', { x: c.x, y: c.y + DEFS[c.type].h / 2 + 34, class: 'live' + (e.on === false ? ' off' : '') }, txt);
        layerLive.appendChild(t);
      });
    }

    world.setAttribute('transform', 'translate(' + S.view.x + ',' + S.view.y + ') scale(' + S.view.k + ')');
  }

  function renderInspector() {
    var box = $('inspector');
    while (box.firstChild) box.removeChild(box.firstChild);
    var item = null;
    if (S.sel && S.sel.kind === 'comp') item = getComp(S.sel.id);
    if (!item) {
      box.classList.remove('show');
      box.appendChild(document.createTextNode(''));
      return;
    }
    box.classList.add('show');
    var title = document.createElement('div');
    title.className = 'insp-title';
    title.textContent = DEFS[item.type].label;
    box.appendChild(title);

    var fields = {
      battery: [['v', 'Tegangan (V)', 0.1, 100, 0.5]],
      resistor: [['r', 'Hambatan (\u03A9)', 0.1, 10000000, 10]],
      lamp: [['r', 'Hambatan (\u03A9)', 0.1, 10000000, 10]],
      led: [['vf', 'Tegangan maju (V)', 0.1, 30, 0.1]],
      capacitor: [['c', 'Kapasitansi (nF)', 0.1, 100000, 10]]
    }[item.type] || [];

    fields.forEach(function (f) {
      var wrap = document.createElement('label');
      wrap.className = 'field';
      wrap.textContent = f[1];
      var inp = document.createElement('input');
      inp.type = 'number';
      inp.min = f[2]; inp.max = f[3]; inp.step = f[4];
      inp.value = item.props[f[0]];
      inp.addEventListener('change', function () {
        var v = Number(inp.value);
        if (!isFinite(v) || v < f[2] || v > f[3]) { toast('Nilai di luar batas', 'warn'); inp.value = item.props[f[0]]; return; }
        snapshot();
        item.props[f[0]] = v;
        S.result = null;
        CORE.logAction('ubah-nilai', item.type + '.' + f[0] + '=' + v);
        renderAll();
        scheduleDraft();
      });
      wrap.appendChild(inp);
      box.appendChild(wrap);
    });

    if (item.type === 'switch') {
      var btn = document.createElement('button');
      btn.className = 'btn small';
      btn.textContent = item.props.closed ? 'Saklar: tertutup' : 'Saklar: terbuka';
      btn.addEventListener('click', function () {
        snapshot();
        item.props.closed = !item.props.closed;
        S.result = null;
        CORE.logAction('saklar', item.props.closed ? 'tutup' : 'buka');
        renderAll();
        scheduleDraft();
      });
      box.appendChild(btn);
    }

    var actions = document.createElement('div');
    actions.className = 'insp-actions';
    [['Putar', function () { snapshot(); item.rot = ((item.rot || 0) + 90) % 360; S.result = null; renderAll(); scheduleDraft(); }],
     ['Hapus', function () { deleteSelection(); }]].forEach(function (a) {
      var b = document.createElement('button');
      b.className = 'btn small ghost';
      b.textContent = a[0];
      b.addEventListener('click', a[1]);
      actions.appendChild(b);
    });
    box.appendChild(actions);
  }

  function deleteSelection() {
    if (!S.sel) return;
    snapshot();
    if (S.sel.kind === 'comp') {
      S.circ.components = S.circ.components.filter(function (c) { return c.id !== S.sel.id; });
      S.circ.wires = S.circ.wires.filter(function (w) { return w.ca !== S.sel.id && w.cb !== S.sel.id; });
    } else {
      S.circ.wires = S.circ.wires.filter(function (w) { return w.id !== S.sel.id; });
    }
    CORE.logAction('hapus', S.sel.kind);
    S.sel = null;
    S.result = null;
    renderAll();
    scheduleDraft();
  }

  /* ---------- interaksi ---------- */
  var drag = null, pan = null;

  function onPointerDown(ev) {
    if (ev.target.closest && ev.target.closest('#svg')) {
      var pinEl = ev.target.closest ? ev.target.closest('.cpin') : null;
      var compEl = ev.target.closest ? ev.target.closest('.comp') : null;
      var wireEl = ev.target.closest ? ev.target.closest('[data-wire]') : null;

      if (S.mode === 'wire' && pinEl && compEl) {
        var comp = getComp(compEl.dataset.comp);
        var pin = pinEl.dataset.pin;
        if (!S.wireStart) { S.wireStart = { comp: comp.id, pin: pin }; toast('Pilih pin tujuan'); }
        else if (S.wireStart.comp === comp.id && S.wireStart.pin === pin) { S.wireStart = null; }
        else {
          var dup = S.circ.wires.some(function (w) {
            return (w.ca === S.wireStart.comp && w.pa === S.wireStart.pin && w.cb === comp.id && w.pb === pin) ||
              (w.cb === S.wireStart.comp && w.pb === S.wireStart.pin && w.ca === comp.id && w.pa === pin);
          });
          if (dup) toast('Kabel itu sudah ada', 'warn');
          else {
            snapshot();
            S.circ.wires.push({ id: 'w' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), ca: S.wireStart.comp, pa: S.wireStart.pin, cb: comp.id, pb: pin });
            CORE.logAction('kabel', S.wireStart.comp + '>' + comp.id);
          }
          S.wireStart = null;
          S.result = null;
        }
        renderCanvas();
        return;
      }

      if (compEl) {
        var c = getComp(compEl.dataset.comp);
        S.sel = { kind: 'comp', id: c.id };
        if (S.mode === 'select') {
          drag = { id: c.id, start: toWorld(ev), orig: { x: c.x, y: c.y }, moved: false };
          try { svg.setPointerCapture(ev.pointerId); } catch (e) { /* diabaikan: pointer tidak valid */ }
        }
        renderAll();
        return;
      }
      if (wireEl) { S.sel = { kind: 'wire', id: wireEl.dataset.wire }; renderAll(); return; }

      S.sel = null;
      pan = { sx: ev.clientX, sy: ev.clientY, ox: S.view.x, oy: S.view.y };
      try { svg.setPointerCapture(ev.pointerId); } catch (e) { /* diabaikan */ }
      renderAll();
    }
  }

  function onPointerMove(ev) {
    if (drag) {
      var p = toWorld(ev);
      var c = getComp(drag.id);
      if (!c) return;
      var nx = Math.round((drag.orig.x + (p.x - drag.start.x)) / 10) * 10;
      var ny = Math.round((drag.orig.y + (p.y - drag.start.y)) / 10) * 10;
      if (nx !== c.x || ny !== c.y) {
        if (!drag.moved) { snapshot(); drag.moved = true; }
        c.x = nx; c.y = ny;
        S.result = null;
        renderCanvas();
      }
    } else if (pan) {
      S.view.x = pan.ox + (ev.clientX - pan.sx);
      S.view.y = pan.oy + (ev.clientY - pan.sy);
      renderCanvas();
    }
  }

  function onPointerUp() {
    if (drag && drag.moved) { CORE.logAction('geser', drag.id); scheduleDraft(); renderInspector(); }
    drag = null; pan = null;
  }

  /* ---------- aksi ---------- */
  function addComponent(type) {
    snapshot();
    var c = {
      id: 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
      type: type, x: Math.round((380 - S.view.x) / S.view.k / 10) * 10, y: Math.round((220 - S.view.y) / S.view.k / 10) * 10,
      rot: 0, props: JSON.parse(JSON.stringify(DEFS[type].props))
    };
    S.circ.components.push(c);
    S.sel = { kind: 'comp', id: c.id };
    S.result = null;
    CORE.logAction('tambah', type);
    renderAll();
    scheduleDraft();
  }

  function runSim() {
    var res = RK.simulate(S.circ.components, S.circ.wires);
    S.simOk = res.ok;
    S.result = res.ok ? res : null;
    if (!res.ok) { toast(res.error, 'warn'); CORE.logAction('simulasi-gagal', res.error); }
    else {
      CORE.logAction('simulasi', S.circ.components.length + ' komponen');
      if (res.warnings && res.warnings.length) toast(res.warnings[0], 'warn');
    }
    renderCanvas();
  }

  function saveCurrent() {
    var name = $('circuit-name').value;
    S.circ.name = CORE.cleanName(name, S.circ.name || 'Rangkaian baru');
    var copy = JSON.parse(JSON.stringify(S.circ));
    copy.updatedAt = Date.now();
    var i = S.saved.findIndex(function (c) { return c.id === copy.id; });
    if (i >= 0) S.saved[i] = copy; else S.saved.unshift(copy);
    if (S.saved.length > CORE.MAX_CIRCUITS) S.saved.length = CORE.MAX_CIRCUITS;
    if (CORE.saveCircuits(S.saved)) { CORE.logAction('simpan', S.circ.name); toast('Tersimpan: ' + S.circ.name); }
    else { toast('Gagal menyimpan (penyimpanan penuh?)', 'warn'); CORE.logError('save', 'localStorage penuh'); }
    $('circuit-name').value = S.circ.name;
    renderSaved();
  }

  /* ---------- render lainnya ---------- */
  function renderParts() {
    var list = $('parts-list');
    while (list.firstChild) list.removeChild(list.firstChild);
    Object.keys(DEFS).forEach(function (k) {
      var d = DEFS[k];
      var card = document.createElement('button');
      card.className = 'tile';
      var h = document.createElement('span');
      h.className = 'tile-title';
      h.textContent = d.label;
      var p = document.createElement('span');
      p.className = 'tile-sub';
      p.textContent = d.hint;
      card.appendChild(h); card.appendChild(p);
      card.addEventListener('click', function () { addComponent(k); setTab('canvas'); });
      list.appendChild(card);
    });
  }

  function renderSaved() {
    var list = $('saved-list');
    while (list.firstChild) list.removeChild(list.firstChild);
    if (!S.saved.length) {
      var empty = document.createElement('p');
      empty.className = 'muted';
      empty.textContent = 'Belum ada rangkaian tersimpan. Buat di kanvas lalu tekan Simpan.';
      list.appendChild(empty);
      return;
    }
    S.saved.forEach(function (c) {
      var card = document.createElement('div');
      card.className = 'card row';
      var info = document.createElement('div');
      info.className = 'grow';
      var t = document.createElement('div');
      t.className = 'card-title';
      t.textContent = c.name;
      var sub = document.createElement('div');
      sub.className = 'muted small';
      var dt = new Date(c.updatedAt || c.createdAt);
      sub.textContent = c.components.length + ' komponen \u00B7 ' + c.wires.length + ' kabel \u00B7 ' + dt.toLocaleDateString('id-ID');
      info.appendChild(t); info.appendChild(sub);

      var open = document.createElement('button');
      open.className = 'btn small';
      open.textContent = 'Buka';
      open.addEventListener('click', function () {
        S.circ = JSON.parse(JSON.stringify(c));
        S.sel = null; S.result = null; S.undo.length = 0; S.redo.length = 0;
        $('circuit-name').value = S.circ.name;
        CORE.logAction('buka', S.circ.name);
        setTab('canvas');
        renderAll();
        scheduleDraft();
      });

      var del = document.createElement('button');
      del.className = 'btn small ghost';
      del.textContent = 'Hapus';
      del.addEventListener('click', function () {
        S.saved = S.saved.filter(function (x) { return x.id !== c.id; });
        CORE.saveCircuits(S.saved);
        CORE.logAction('hapus-tersimpan', c.name);
        renderSaved();
      });

      card.appendChild(info); card.appendChild(open); card.appendChild(del);
      list.appendChild(card);
    });
  }

  function renderSystem() {
    $('sys-build').textContent = CORE.BUILD;
    var st = $('sys-selftest');
    while (st.firstChild) st.removeChild(st.firstChild);
    (S.selftest || []).forEach(function (t) {
      var row = document.createElement('div');
      row.className = 'row small';
      var badge = document.createElement('span');
      badge.className = 'dot ' + (t.ok ? 'ok' : 'bad');
      var txt = document.createElement('span');
      txt.className = 'grow';
      txt.textContent = t.name + (t.ok ? '' : ' \u2014 ' + t.error);
      row.appendChild(badge); row.appendChild(txt);
      st.appendChild(row);
    });

    var bugs = CORE.readBugLog();
    var bl = $('sys-bugs');
    while (bl.firstChild) bl.removeChild(bl.firstChild);
    if (!bugs.length) {
      var p = document.createElement('p');
      p.className = 'muted small';
      p.textContent = 'Tidak ada masalah tercatat.';
      bl.appendChild(p);
    } else {
      bugs.slice(0, 12).forEach(function (b) {
        var card = document.createElement('div');
        card.className = 'card small';
        var t = document.createElement('div');
        t.className = 'card-title';
        t.textContent = b.kind + ' \u00B7 build ' + b.build;
        var m = document.createElement('div');
        m.className = 'muted';
        m.textContent = b.message;
        var when = document.createElement('div');
        when.className = 'muted small';
        when.textContent = new Date(b.at).toLocaleString('id-ID') + (b.extra ? ' \u00B7 ' + b.extra : '');
        card.appendChild(t); card.appendChild(m); card.appendChild(when);
        bl.appendChild(card);
      });
    }
    $('bug-count').textContent = bugs.length ? bugs.length + ' tercatat' : '';
    $('btn-install').hidden = !S.installEvt;
  }

  function renderAll() {
    renderCanvas();
    renderInspector();
  }

  /* ---------- tab ---------- */
  function setTab(name) {
    S.tab = name;
    ['canvas', 'parts', 'saved', 'system'].forEach(function (t) {
      $('view-' + t).classList.toggle('active', t === name);
    });
    Array.prototype.forEach.call(document.querySelectorAll('.tabbar button'), function (b) {
      b.classList.toggle('on', b.dataset.tab === name);
    });
    if (name === 'saved') renderSaved();
    if (name === 'system') renderSystem();
  }

  /* ---------- ekspor / impor ---------- */
  function exportJSON() {
    var data = { app: 'RangkaianKu', schema: CORE.SCHEMA, build: CORE.BUILD, exportedAt: Date.now(), circuit: S.circ };
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = (S.circ.name || 'rangkaian').replace(/[^a-zA-Z0-9-_ ]/g, '') + '.json';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
    CORE.logAction('ekspor', S.circ.name);
    toast('File JSON diunduh');
  }

  function importFile(file) {
    if (!file) return;
    if (file.size > 512 * 1024) { toast('File terlalu besar (maks 512 KB)', 'warn'); CORE.logError('import', 'ukuran file ' + file.size); return; }
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var data = JSON.parse(String(reader.result));
        var circuit = CORE.validateCircuit(data.circuit || data, 'Impor');
        S.saved.unshift(circuit);
        if (!CORE.saveCircuits(S.saved)) throw new Error('gagal menyimpan hasil impor');
        CORE.logAction('impor', circuit.name);
        toast('Impor berhasil: ' + circuit.name);
        renderSaved();
      } catch (e) {
        toast('File tidak valid: ' + e.message, 'warn');
        CORE.logError('import', e.message);
      }
    };
    reader.onerror = function () { toast('Gagal membaca file', 'warn'); CORE.logError('import', 'read error'); };
    reader.readAsText(file);
  }

  /* ---------- boot ---------- */
  function boot() {
    svg = $('svg');
    world = $('world');
    layerWires = $('layer-wires');
    layerComps = $('layer-comps');
    layerLive = $('layer-live');

    CORE.guard();
    drawGrid();

    var draft = loadDraft();
    if (draft && draft.components.length) { S.circ = draft; toast('Draf terakhir dipulihkan'); }
    $('circuit-name').value = S.circ.name;

    S.selftest = RK.runSelfCheck();
    var failed = S.selftest.filter(function (t) { return !t.ok; });
    var failedNames = failed.map(function (t) { return t.name; });

    var previous = null;
    try { previous = JSON.parse(localStorage.getItem(KEY_LASTBUILD) || 'null'); } catch (e) { previous = null; }
    if (previous && previous.build && previous.build !== CORE.BUILD) {
      var oldFailed = Array.isArray(previous.failed) ? previous.failed : [];
      var newFailures = failedNames.filter(function (n) { return oldFailed.indexOf(n) < 0; });
      if (newFailures.length) {
        CORE.logError('regresi', 'build ' + previous.build + ' \u2192 ' + CORE.BUILD + ': ' + newFailures.join(', '));
        S.regression = { from: previous.build, tests: newFailures };
      }
      CORE.logAction('build-baru', previous.build + ' \u2192 ' + CORE.BUILD);
    }
    try {
      localStorage.setItem(KEY_LASTBUILD, JSON.stringify({ build: CORE.BUILD, failed: failedNames, at: Date.now() }));
    } catch (e) { /* abaikan */ }

    if (failed.length) {
      CORE.logError('selftest', failed.map(function (t) { return t.name + ': ' + t.error; }).join(' | '));
      var banner = $('banner');
      banner.textContent = failed.length + ' uji mandiri gagal \u2014 buka tab Sistem';
      banner.classList.add('show');
      banner.addEventListener('click', function () { setTab('system'); });
    }

    svg.addEventListener('pointerdown', onPointerDown);
    svg.addEventListener('pointermove', onPointerMove);
    svg.addEventListener('pointerup', onPointerUp);
    svg.addEventListener('pointercancel', onPointerUp);

    $('btn-mode-select').addEventListener('click', function () { S.mode = 'select'; S.wireStart = null; syncMode(); });
    $('btn-mode-wire').addEventListener('click', function () { S.mode = 'wire'; toast('Ketuk pin A lalu pin B'); syncMode(); });
    $('btn-rotate').addEventListener('click', function () {
      var c = S.sel && S.sel.kind === 'comp' ? getComp(S.sel.id) : null;
      if (!c) { toast('Pilih komponen dulu', 'warn'); return; }
      snapshot(); c.rot = ((c.rot || 0) + 90) % 360; S.result = null; renderAll(); scheduleDraft();
    });
    $('btn-delete').addEventListener('click', deleteSelection);
    $('btn-undo').addEventListener('click', undo);
    $('btn-redo').addEventListener('click', redo);
    $('btn-sim').addEventListener('click', runSim);
    $('btn-save').addEventListener('click', saveCurrent);
    $('zoomin').addEventListener('click', function () { zoom(1.2); });
    $('zoomout').addEventListener('click', function () { zoom(1 / 1.2); });
    $('fit').addEventListener('click', fit);

    Array.prototype.forEach.call(document.querySelectorAll('.tabbar button'), function (b) {
      b.addEventListener('click', function () { setTab(b.dataset.tab); });
    });

    $('btn-export').addEventListener('click', exportJSON);
    $('btn-import').addEventListener('click', function () { $('file-input').click(); });
    $('file-input').addEventListener('change', function (ev) { importFile(ev.target.files && ev.target.files[0]); ev.target.value = ''; });
    $('btn-clearbugs').addEventListener('click', function () { CORE.clearBugs(); renderSystem(); toast('Catatan bug dibersihkan'); });
    $('btn-reset').addEventListener('click', function () {
      if (!confirm('Hapus semua rangkaian tersimpan dan draf di perangkat ini?')) return;
      S.saved = []; CORE.saveCircuits([]);
      try { localStorage.removeItem(KEY_DRAFT); } catch (e) { /* abaikan */ }
      S.circ = CORE.emptyCircuit(); S.sel = null; S.result = null; S.undo.length = 0;
      $('circuit-name').value = S.circ.name;
      renderAll(); renderSaved(); toast('Data lokal dihapus');
    });
    $('btn-install').addEventListener('click', function () {
      if (!S.installEvt) return;
      S.installEvt.prompt();
      S.installEvt = null;
      renderSystem();
    });

    window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); S.installEvt = e; renderSystem(); });

    renderParts();
    renderSaved();
    renderSystem();
    renderAll();
    setTab('canvas');

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch(function (e) { CORE.logError('sw', e && e.message); });
    }
    CORE.logAction('boot', 'build ' + CORE.BUILD);
  }

  function syncMode() {
    $('btn-mode-select').classList.toggle('on', S.mode === 'select');
    $('btn-mode-wire').classList.toggle('on', S.mode === 'wire');
    S.wireStart = null;
    renderCanvas();
  }

  function zoom(f) {
    var cx = svg.clientWidth / 2, cy = svg.clientHeight / 2;
    var k = Math.min(3, Math.max(0.3, S.view.k * f));
    S.view.x = cx - (cx - S.view.x) * (k / S.view.k);
    S.view.y = cy - (cy - S.view.y) * (k / S.view.k);
    S.view.k = k;
    renderCanvas();
  }

  function fit() {
    if (!S.circ.components.length) { S.view = { x: 0, y: 0, k: 1 }; renderCanvas(); return; }
    var xs = S.circ.components.map(function (c) { return c.x; });
    var ys = S.circ.components.map(function (c) { return c.y; });
    var minX = Math.min.apply(null, xs) - 80, maxX = Math.max.apply(null, xs) + 80;
    var minY = Math.min.apply(null, ys) - 80, maxY = Math.max.apply(null, ys) + 100;
    var k = Math.min(svg.clientWidth / (maxX - minX), svg.clientHeight / (maxY - minY), 2);
    S.view.k = Math.max(0.3, k);
    S.view.x = (svg.clientWidth - (maxX - minX) * S.view.k) / 2 - minX * S.view.k;
    S.view.y = (svg.clientHeight - (maxY - minY) * S.view.k) / 2 - minY * S.view.k;
    renderCanvas();
  }

  document.addEventListener('DOMContentLoaded', boot);
})();
