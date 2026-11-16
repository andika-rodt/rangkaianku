/* RangkaianKu - inti: penyimpanan aman, validasi, jurnal bug */
(function (root) {
  'use strict';

  var BUILD = '2026.11.16-r1';
  var SCHEMA = 1;
  var KEY_CIRCUITS = 'rk.circuits.v1';
  var KEY_BUGS = 'rk.buglog.v1';
  var KEY_PREFS = 'rk.prefs.v1';
  var MAX_BYTES = 512 * 1024;
  var MAX_CIRCUITS = 100;
  var MAX_COMPS = 200;
  var MAX_WIRES = 400;

  var TYPES = Object.keys(root.RK.DEFS);

  function safeGet(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return fallback;
      if (raw.length > MAX_BYTES) return fallback;
      var v = JSON.parse(raw);
      return v == null ? fallback : v;
    } catch (e) {
      logError('storage-read', e && e.message);
      return fallback;
    }
  }

  function safeSet(key, value) {
    try {
      var s = JSON.stringify(value);
      if (s.length > MAX_BYTES * 4) throw new Error('data terlalu besar');
      localStorage.setItem(key, s);
      return true;
    } catch (e) {
      logError('storage-write', e && e.message);
      return false;
    }
  }

  function cleanName(s, fallback) {
    var out = String(s == null ? '' : s)
      .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
      .replace(/[<>]/g, '')
      .trim()
      .slice(0, 40);
    return out || fallback;
  }

  function num(v, min, max, fallback) {
    var n = Number(v);
    if (!isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, n));
  }

  function isPlainObject(o) {
    return o !== null && typeof o === 'object' && !Array.isArray(o);
  }

  function hasProtoTrick(o) {
    return Object.prototype.hasOwnProperty.call(o, '__proto__') || Object.prototype.hasOwnProperty.call(o, 'constructor') || Object.prototype.hasOwnProperty.call(o, 'prototype');
  }

  function sanitizeProps(type, props) {
    var d = root.RK.DEFS[type];
    var out = {};
    var src = isPlainObject(props) ? props : {};
    Object.keys(src).forEach(function (k) {
      if (k === '__proto__' || k === 'constructor' || k === 'prototype') return;
      var v = src[k];
      if (typeof v === 'number' || typeof v === 'boolean' || typeof v === 'string') out[k] = v;
    });
    Object.keys(d.props).forEach(function (k) {
      if (!(k in out)) out[k] = d.props[k];
    });
    if (type === 'battery') out.v = num(out.v, 0.1, 100, 9);
    if (type === 'resistor' || type === 'lamp') out.r = num(out.r, 0.1, 10000000, d.props.r);
    if (type === 'led') out.vf = num(out.vf, 0.1, 30, 1.8);
    if (type === 'switch') out.closed = out.closed === true;
    return out;
  }

  function bind(comps, wires) {
    var seen = {};
    var ids = {};
    comps.forEach(function (c) {
      if (seen[c.id]) throw new Error('ID komponen ganda');
      seen[c.id] = 1;
      ids[c.id] = c.type;
    });
    wires.forEach(function (w) {
      var da = root.RK.DEFS[ids[w.ca]];
      var db = root.RK.DEFS[ids[w.cb]];
      if (!da || !db) throw new Error('Kabel menunjuk komponen yang tidak ada');
      if (!pinExists(da, w.pa) || !pinExists(db, w.pb)) throw new Error('Kabel menunjuk pin yang tidak ada');
    });
  }

  function pinExists(def, name) {
    return def.pins.some(function (p) { return p.n === name; });
  }

  function validateCircuit(raw, fallbackName) {
    if (!isPlainObject(raw)) throw new Error('Data rangkaian tidak valid');
    if (!Array.isArray(raw.components) || !Array.isArray(raw.wires)) throw new Error('Struktur rangkaian rusak');
    if (raw.components.length > MAX_COMPS) throw new Error('Komponen melebihi batas ' + MAX_COMPS);
    if (raw.wires.length > MAX_WIRES) throw new Error('Kabel melebihi batas ' + MAX_WIRES);

    var comps = [];
    var rawIds = {};
    raw.components.forEach(function (c, i) {
      if (!isPlainObject(c)) throw new Error('Komponen #' + (i + 1) + ' tidak valid');
      if (hasProtoTrick(c) || (isPlainObject(c.props) && hasProtoTrick(c.props))) throw new Error('Kunci properti terlarang');
      var rid = String(c.id == null ? 'idx' + i : c.id).slice(0, 40);
      if (rawIds[rid]) throw new Error('ID komponen ganda: ' + rid);
      rawIds[rid] = 1;
      var type = String(c.type);
      if (TYPES.indexOf(type) < 0) throw new Error('Jenis komponen tidak dikenal: ' + type.slice(0, 20));
      comps.push({
        id: 'c' + (i + 1) + Math.random().toString(36).slice(2, 6),
        type: type,
        x: num(c.x, -20000, 20000, 400),
        y: num(c.y, -20000, 20000, 300),
        rot: ([0, 90, 180, 270].indexOf(Number(c.rot)) >= 0) ? Number(c.rot) : 0,
        props: sanitizeProps(type, c.props)
      });
    });

    var map = {};
    comps.forEach(function (c, i) { map[String(raw.components[i].id)] = c.id; });

    var wires = [];
    raw.wires.forEach(function (w, i) {
      if (!isPlainObject(w)) throw new Error('Kabel #' + (i + 1) + ' tidak valid');
      if (hasProtoTrick(w)) throw new Error('Kunci properti terlarang');
      var ca = map[String(w.ca)], cb = map[String(w.cb)];
      if (!ca || !cb) throw new Error('Kabel #' + (i + 1) + ' menunjuk komponen hilang');
      wires.push({ id: 'w' + (i + 1), ca: ca, pa: String(w.pa).slice(0, 10), cb: cb, pb: String(w.pb).slice(0, 10) });
    });

    bind(comps, wires);

    return {
      id: 'cir' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      name: cleanName(raw.name, fallbackName || 'Rangkaian tanpa nama'),
      components: comps,
      wires: wires,
      schema: SCHEMA,
      createdAt: num(raw.createdAt, 0, 9999999999999, Date.now()),
      updatedAt: Date.now()
    };
  }

  function emptyCircuit() {
    return { id: 'cir' + Date.now().toString(36), name: 'Rangkaian baru', components: [], wires: [], schema: SCHEMA, createdAt: Date.now(), updatedAt: Date.now() };
  }

  function loadCircuits() {
    var data = safeGet(KEY_CIRCUITS, null);
    if (!isPlainObject(data) || !Array.isArray(data.circuits)) return [];
    var out = [];
    data.circuits.slice(0, MAX_CIRCUITS).forEach(function (c) {
      try { out.push(validateCircuit(c, 'Rangkaian tersimpan')); } catch (e) { logError('load-circuits', e.message); }
    });
    return out;
  }

  function saveCircuits(list) {
    return safeSet(KEY_CIRCUITS, { schema: SCHEMA, circuits: list.slice(0, MAX_CIRCUITS) });
  }

  function loadPrefs() {
    var p = safeGet(KEY_PREFS, {});
    return { theme: p.theme === 'gelap' ? 'gelap' : 'terang', textScale: num(p.textScale, 0.8, 1.6, 1) };
  }

  var journal = [];
  function logAction(label, detail) {
    journal.push({ t: Date.now(), build: BUILD, label: String(label).slice(0, 60), detail: String(detail == null ? '' : detail).slice(0, 200) });
    if (journal.length > 40) journal.shift();
  }

  function readBugLog() {
    var b = safeGet(KEY_BUGS, null);
    if (!isPlainObject(b) || !Array.isArray(b.entries)) return [];
    return b.entries.slice(0, 60);
  }

  function logError(kind, message, extra) {
    try {
      var entries = readBugLog();
      entries.unshift({
        id: 'b' + Date.now().toString(36),
        build: BUILD,
        kind: String(kind).slice(0, 40),
        message: String(message == null ? '' : message).slice(0, 300),
        extra: extra ? String(extra).slice(0, 300) : '',
        journal: journal.slice(-12),
        at: Date.now()
      });
      safeSet(KEY_BUGS, { schema: SCHEMA, entries: entries.slice(0, 60) });
    } catch (e) { /* jangan pernah melempar dari pencatat error */ }
  }

  function clearBugs() { try { localStorage.removeItem(KEY_BUGS); } catch (e) { /* abaikan */ } }

  function guard() {
    root.addEventListener('error', function (ev) {
      logError('runtime', ev.message || 'error tidak dikenal', (ev.filename || '') + ':' + (ev.lineno || 0));
    });
    root.addEventListener('unhandledrejection', function (ev) {
      logError('promise', (ev.reason && ev.reason.message) || String(ev.reason));
    });
  }

  root.RK = root.RK || {};
  root.RK.CORE = {
    BUILD: BUILD,
    SCHEMA: SCHEMA,
    MAX_CIRCUITS: MAX_CIRCUITS,
    validateCircuit: validateCircuit,
    emptyCircuit: emptyCircuit,
    cleanName: cleanName,
    loadCircuits: loadCircuits,
    saveCircuits: saveCircuits,
    loadPrefs: loadPrefs,
    readBugLog: readBugLog,
    logError: logError,
    clearBugs: clearBugs,
    logAction: logAction,
    guard: guard
  };
})(typeof window !== 'undefined' ? window : globalThis);
