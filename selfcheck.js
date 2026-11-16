/* RangkaianKu - uji mandiri (dijalankan tiap aplikasi dibuka) */
(function (root) {
  'use strict';
  var RK = root.RK;

  function c(id, type, props) { return { id: id, type: type, x: 0, y: 0, rot: 0, props: props || {} }; }
  function w(ca, pa, cb, pb) { return { id: ca + pa + cb + pb, ca: ca, pa: pa, cb: cb, pb: pb }; }
  function near(a, b, tol) { return Math.abs(a - b) <= tol; }

  var CASES = [
    {
      name: 'pembagi-tegangan', run: function () {
        var r = RK.simulate(
          [c('B', 'battery', { v: 9 }), c('R1', 'resistor', { r: 1000 }), c('R2', 'resistor', { r: 2000 }), c('G', 'ground')],
          [w('B', 'p', 'R1', 'a'), w('R1', 'b', 'R2', 'a'), w('R2', 'b', 'B', 'n'), w('B', 'n', 'G', 'g')]
        );
        if (!r.ok) return r.error;
        var r2 = r.elements.filter(function (e) { return e.id === 'R2'; })[0];
        if (!r2) return 'R2 tidak ada di hasil';
        if (!near(r2.v, 6, 0.01)) return 'V(R2)=' + r2.v;
        return null;
      }
    },
    {
      name: 'paralel-100', run: function () {
        var r = RK.simulate(
          [c('B', 'battery', { v: 9 }), c('R1', 'resistor', { r: 100 }), c('R2', 'resistor', { r: 100 }), c('G', 'ground')],
          [w('B', 'p', 'R1', 'a'), w('B', 'p', 'R2', 'a'), w('R1', 'b', 'B', 'n'), w('R2', 'b', 'B', 'n'), w('B', 'n', 'G', 'g')]
        );
        if (!r.ok) return r.error;
        var b = r.elements.filter(function (e) { return e.source; })[0];
        if (!b) return 'arus baterai tidak ada';
        if (!near(Math.abs(b.i), 0.18, 0.001)) return 'I=' + b.i;
        return null;
      }
    },
    {
      name: 'led-330', run: function () {
        var r = RK.simulate(
          [c('B', 'battery', { v: 9 }), c('R1', 'resistor', { r: 330 }), c('D1', 'led', { vf: 1.8 }), c('G', 'ground')],
          [w('B', 'p', 'R1', 'a'), w('R1', 'b', 'D1', 'a'), w('D1', 'b', 'B', 'n'), w('B', 'n', 'G', 'g')]
        );
        if (!r.ok) return r.error;
        var led = r.elements.filter(function (e) { return e.id === 'D1'; })[0];
        if (!led || !led.on) return 'LED tidak menyala';
        var exp = (9 - 1.8) / 340;
        if (!near(Math.abs(led.i), exp, 2e-4)) return 'I(LED)=' + led.i;
        return null;
      }
    },
    {
      name: 'saklar-terbuka', run: function () {
        var r = RK.simulate(
          [c('B', 'battery', { v: 9 }), c('S1', 'switch', { closed: false }), c('R1', 'resistor', { r: 100 }), c('G', 'ground')],
          [w('B', 'p', 'S1', 'a'), w('S1', 'b', 'R1', 'a'), w('R1', 'b', 'B', 'n'), w('B', 'n', 'G', 'g')]
        );
        if (!r.ok) return r.error;
        var b = r.elements.filter(function (e) { return e.source; })[0];
        if (Math.abs(b.i) > 1e-6) return 'arus bocor ' + b.i;
        return null;
      }
    }
  ];

  CASES.push({
    name: 'transistor-npn', run: function () {
      var r = RK.simulate(
        [c('B', 'battery', { v: 12 }), c('R2', 'resistor', { r: 470 }), c('D1', 'led', { vf: 1.8 }),
         c('Q1', 'npn', { beta: 200 }), c('R1', 'resistor', { r: 10000 }), c('G', 'ground')],
        [w('B', 'p', 'R1', 'a'), w('R1', 'b', 'Q1', 'b'), w('B', 'p', 'R2', 'a'), w('R2', 'b', 'D1', 'a'),
         w('D1', 'b', 'Q1', 'c'), w('Q1', 'e', 'B', 'n'), w('B', 'n', 'G', 'g')]
      );
      if (!r.ok) return r.error;
      var q = r.elements.filter(function (e) { return e.id === 'Q1'; })[0];
      if (!q || !q.on) return 'transistor tidak aktif';
      var led = r.elements.filter(function (e) { return e.id === 'D1'; })[0];
      if (!led || !led.on) return 'LED tidak menyala';
      if (Math.abs(led.i) < 0.005 || Math.abs(led.i) > 0.1) return 'arus LED aneh: ' + led.i;
      return null;
    }
  });

  CASES.push({
    name: 'ldr-terang-gelap', run: function () {
      function v(lux) {
        var r = RK.simulate(
          [c('B', 'battery', { v: 12 }), c('R3', 'resistor', { r: 330 }), c('L1', 'ldr', { lux: lux }), c('G', 'ground')],
          [w('B', 'p', 'R3', 'a'), w('R3', 'b', 'L1', 'a'), w('L1', 'b', 'B', 'n'), w('B', 'n', 'G', 'g')]
        );
        if (!r.ok) throw new Error(r.error);
        return r.elements.filter(function (e) { return e.id === 'L1'; })[0].v;
      }
      var terang = v(1000), gelap = v(0);
      if (!(gelap > terang + 1)) return 'gelap ' + gelap.toFixed(2) + ' vs terang ' + terang.toFixed(2);
      return null;
    }
  });

  root.RK.runSelfCheck = function () {
    return CASES.map(function (t) {
      var err;
      try { err = t.run(); } catch (e) { err = 'exception: ' + (e && e.message); }
      return { name: t.name, ok: !err, error: err || '' };
    });
  };
})(typeof window !== 'undefined' ? window : globalThis);
