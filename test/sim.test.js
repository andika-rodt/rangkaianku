const RK = require('../sim.js');

const c = (id, type, props) => ({ id, type, x: 0, y: 0, rot: 0, props: props || {} });
const w = (ca, pa, cb, pb) => ({ id: ca + pb + cb + pa, ca, pa, cb, pb });
const near = (a, b, tol) => Math.abs(a - b) <= tol;

const tests = [
  {
    name: 'Pembagi tegangan 9V, 1k/2k',
    run() {
      const comps = [c('B', 'battery', { v: 9 }), c('R1', 'resistor', { r: 1000 }), c('R2', 'resistor', { r: 2000 }), c('G', 'ground')];
      const wires = [w('B', 'p', 'R1', 'a'), w('R1', 'b', 'R2', 'a'), w('R2', 'b', 'B', 'n'), w('B', 'n', 'G', 'g')];
      const r = RK.simulate(comps, wires);
      if (!r.ok) return r.error;
      const r2 = r.elements.find((e) => e.id === 'R2');
      if (!near(r2.v, 6, 0.01)) return 'V(R2)=' + r2.v + ', harus 6V';
      const r1 = r.elements.find((e) => e.id === 'R1');
      if (!near(r1.v, 3, 0.01)) return 'V(R1)=' + r1.v + ', harus 3V';
      if (!near(r1.i, 0.003, 1e-5)) return 'I=' + r1.i + ', harus 3mA';
      return null;
    }
  },
  {
    name: 'Dua resistor 100 ohm paralel pada 9V',
    run() {
      const comps = [c('B', 'battery', { v: 9 }), c('R1', 'resistor', { r: 100 }), c('R2', 'resistor', { r: 100 }), c('G', 'ground')];
      const wires = [w('B', 'p', 'R1', 'a'), w('B', 'p', 'R2', 'a'), w('R1', 'b', 'B', 'n'), w('R2', 'b', 'B', 'n'), w('B', 'n', 'G', 'g')];
      const r = RK.simulate(comps, wires);
      if (!r.ok) return r.error;
      const b = r.elements.find((e) => e.source);
      if (!near(Math.abs(b.i), 0.18, 0.001)) return 'I total=' + b.i + ', harus 180mA';
      return null;
    }
  },
  {
    name: 'LED + resistor 330 ohm pada 9V',
    run() {
      const comps = [c('B', 'battery', { v: 9 }), c('R1', 'resistor', { r: 330 }), c('D1', 'led', { vf: 1.8 }), c('G', 'ground')];
      const wires = [w('B', 'p', 'R1', 'a'), w('R1', 'b', 'D1', 'a'), w('D1', 'b', 'B', 'n'), w('B', 'n', 'G', 'g')];
      const r = RK.simulate(comps, wires);
      if (!r.ok) return r.error;
      const led = r.elements.find((e) => e.id === 'D1');
      if (!led.on) return 'LED harus menyala';
      const exp = (9 - 1.8) / 340;
      if (!near(Math.abs(led.i), exp, 2e-4)) return 'I(LED)=' + led.i + ', harus ' + exp.toFixed(4);
      return null;
    }
  },
  {
    name: 'LED terbalik harus mati',
    run() {
      const comps = [c('B', 'battery', { v: 9 }), c('R1', 'resistor', { r: 330 }), c('D1', 'led', { vf: 1.8 }), c('G', 'ground')];
      const wires = [w('B', 'p', 'R1', 'a'), w('R1', 'b', 'D1', 'b'), w('D1', 'a', 'B', 'n'), w('B', 'n', 'G', 'g')];
      const r = RK.simulate(comps, wires);
      if (!r.ok) return r.error;
      const led = r.elements.find((e) => e.id === 'D1');
      if (led.on) return 'LED seharusnya mati';
      if (Math.abs(led.i) > 1e-6) return 'Arus LED harus 0';
      return null;
    }
  },
  {
    name: 'Saklar terbuka memutus arus',
    run() {
      const comps = [c('B', 'battery', { v: 9 }), c('S1', 'switch', { closed: false }), c('R1', 'resistor', { r: 100 }), c('G', 'ground')];
      const wires = [w('B', 'p', 'S1', 'a'), w('S1', 'b', 'R1', 'a'), w('R1', 'b', 'B', 'n'), w('B', 'n', 'G', 'g')];
      const r = RK.simulate(comps, wires);
      if (!r.ok) return r.error;
      const b = r.elements.find((e) => e.source);
      if (Math.abs(b.i) > 1e-6) return 'Arus harus 0, dapat ' + b.i;
      return null;
    }
  },
  {
    name: 'Saklar tertutup mengalirkan arus',
    run() {
      const comps = [c('B', 'battery', { v: 9 }), c('S1', 'switch', { closed: true }), c('R1', 'resistor', { r: 100 }), c('G', 'ground')];
      const wires = [w('B', 'p', 'S1', 'a'), w('S1', 'b', 'R1', 'a'), w('R1', 'b', 'B', 'n'), w('B', 'n', 'G', 'g')];
      const r = RK.simulate(comps, wires);
      if (!r.ok) return r.error;
      const b = r.elements.find((e) => e.source);
      if (!near(Math.abs(b.i), 0.09, 0.002)) return 'I=' + b.i + ', harus 90mA';
      return null;
    }
  },
  {
    name: 'Tolak rangkaian tanpa sumber',
    run() {
      const comps = [c('R1', 'resistor'), c('G', 'ground')];
      const r = RK.simulate(comps, []);
      if (r.ok) return 'Harus gagal tanpa baterai';
      return null;
    }
  },
  {
    name: 'Tolak kanvas kosong',
    run() {
      const r = RK.simulate([], []);
      if (r.ok) return 'Harus gagal saat kosong';
      return null;
    }
  }
];

let fail = 0;
for (const t of tests) {
  let err;
  try { err = t.run(); } catch (e) { err = 'ERROR: ' + e.message; }
  if (err) { fail++; console.log('FAIL  ' + t.name + ' -> ' + err); }
  else console.log('ok    ' + t.name);
}
console.log(fail ? fail + ' gagal' : 'semua lulus');
process.exit(fail ? 1 : 0);
