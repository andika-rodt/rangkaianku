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
    name: 'Dioda silikon seri 1k pada 9V',
    run() {
      const comps = [c('B', 'battery', { v: 9 }), c('R1', 'resistor', { r: 1000 }), c('D1', 'diode', { vf: 0.7 }), c('G', 'ground')];
      const wires = [w('B', 'p', 'R1', 'a'), w('R1', 'b', 'D1', 'a'), w('D1', 'b', 'B', 'n'), w('B', 'n', 'G', 'g')];
      const r = RK.simulate(comps, wires);
      if (!r.ok) return r.error;
      const d = r.elements.find((e) => e.id === 'D1');
      if (!d.on) return 'dioda harus konduksi';
      const exp = (9 - 0.7) / 1010;
      if (!near(Math.abs(d.i), exp, 1e-4)) return 'I=' + d.i + ' harus ' + exp.toFixed(5);
      return null;
    }
  },
  {
    name: 'Dioda terbalik memblokir arus',
    run() {
      const comps = [c('B', 'battery', { v: 9 }), c('R1', 'resistor', { r: 1000 }), c('D1', 'diode', { vf: 0.7 }), c('G', 'ground')];
      const wires = [w('B', 'p', 'R1', 'a'), w('R1', 'b', 'D1', 'b'), w('D1', 'a', 'B', 'n'), w('B', 'n', 'G', 'g')];
      const r = RK.simulate(comps, wires);
      if (!r.ok) return r.error;
      const d = r.elements.find((e) => e.id === 'D1');
      if (d.on) return 'dioda harus mati';
      if (Math.abs(d.i) > 1e-6) return 'arus harus 0';
      return null;
    }
  },
  {
    name: 'Zener 5V1 menahan 12V',
    run() {
      const comps = [c('B', 'battery', { v: 12 }), c('R1', 'resistor', { r: 1000 }), c('D1', 'zener', { vz: 5.1 }), c('G', 'ground')];
      const wires = [w('B', 'p', 'R1', 'a'), w('R1', 'b', 'D1', 'b'), w('D1', 'a', 'B', 'n'), w('B', 'n', 'G', 'g')];
      const r = RK.simulate(comps, wires);
      if (!r.ok) return r.error;
      const d = r.elements.find((e) => e.id === 'D1');
      if (!d.on) return 'zener harus breakdown';
      const vd = d.v;
      if (!near(Math.abs(vd), 5.1 + 10 * Math.abs(d.i), 0.2)) return 'V(zener)=' + vd.toFixed(2) + ' I=' + d.i.toFixed(4);
      const exp = (12 - 5.1) / 1010;
      if (!near(Math.abs(d.i), exp, 2e-4)) return 'I=' + d.i + ' harus ' + exp.toFixed(5);
      return null;
    }
  },
  {
    name: 'Sekring putus saat arus berlebih',
    run() {
      const comps = [c('B', 'battery', { v: 9 }), c('F1', 'fuse', { rating: 0.5 }), c('R1', 'resistor', { r: 1 }), c('G', 'ground')];
      const wires = [w('B', 'p', 'F1', 'a'), w('F1', 'b', 'R1', 'a'), w('R1', 'b', 'B', 'n'), w('B', 'n', 'G', 'g')];
      const r = RK.simulate(comps, wires);
      if (!r.ok) return r.error;
      const f = r.elements.find((e) => e.id === 'F1');
      if (!f.note || f.note.indexOf('putus') < 0) return 'sekring harus putus';
      if (Math.abs(f.i) > 1e-9) return 'arus harus 0 setelah putus';
      if (!r.warnings.length) return 'harus ada peringatan';
      return null;
    }
  },
  {
    name: 'Sekring bertahan saat arus aman',
    run() {
      const comps = [c('B', 'battery', { v: 9 }), c('F1', 'fuse', { rating: 0.5 }), c('R1', 'resistor', { r: 100 }), c('G', 'ground')];
      const wires = [w('B', 'p', 'F1', 'a'), w('F1', 'b', 'R1', 'a'), w('R1', 'b', 'B', 'n'), w('B', 'n', 'G', 'g')];
      const r = RK.simulate(comps, wires);
      if (!r.ok) return r.error;
      const b = r.elements.find((e) => e.source);
      if (!near(Math.abs(b.i), 9 / 100.02, 0.002)) return 'I=' + b.i;
      return null;
    }
  },
  {
    name: 'Amperemeter seri membaca arus',
    run() {
      const comps = [c('B', 'battery', { v: 9 }), c('R1', 'resistor', { r: 100 }), c('A1', 'ammeter'), c('G', 'ground')];
      const wires = [w('B', 'p', 'A1', 'a'), w('A1', 'b', 'R1', 'a'), w('R1', 'b', 'B', 'n'), w('B', 'n', 'G', 'g')];
      const r = RK.simulate(comps, wires);
      if (!r.ok) return r.error;
      const a = r.elements.find((e) => e.id === 'A1');
      if (!near(Math.abs(a.i), 9 / 100.001, 0.002)) return 'I=' + a.i;
      return null;
    }
  },
  {
    name: 'Voltmeter membaca 9V tanpa mengganggu',
    run() {
      const comps = [c('B', 'battery', { v: 9 }), c('R1', 'resistor', { r: 100 }), c('V1', 'voltmeter'), c('G', 'ground')];
      const wires = [w('B', 'p', 'R1', 'a'), w('R1', 'b', 'B', 'n'), w('B', 'p', 'V1', 'a'), w('V1', 'b', 'B', 'n'), w('B', 'n', 'G', 'g')];
      const r = RK.simulate(comps, wires);
      if (!r.ok) return r.error;
      const v = r.elements.find((e) => e.id === 'V1');
      if (!near(v.v, 9, 0.01)) return 'V=' + v.v;
      if (Math.abs(v.i) > 1e-9) return 'voltmeter tidak boleh menyerap arus';
      return null;
    }
  },
  {
    name: 'Sumber arus 10mA pada 1k = 10V',
    run() {
      const comps = [c('I1', 'csource', { i: 0.01 }), c('R1', 'resistor', { r: 1000 }), c('G', 'ground')];
      const wires = [w('I1', 'a', 'R1', 'a'), w('I1', 'b', 'R1', 'b'), w('R1', 'b', 'G', 'g')];
      const r = RK.simulate(comps, wires);
      if (!r.ok) return r.error;
      const res = r.elements.find((e) => e.id === 'R1');
      if (!near(res.v, 10, 0.01)) return 'V=' + res.v + ' harus 10V';
      return null;
    }
  },
  {
    name: 'Potensiometer 10k sebagai pembagi',
    run() {
      const comps = [c('B', 'battery', { v: 9 }), c('P1', 'pot', { r: 10000 }), c('R1', 'resistor', { r: 10000 }), c('G', 'ground')];
      const wires = [w('B', 'p', 'P1', 'a'), w('P1', 'b', 'R1', 'a'), w('R1', 'b', 'B', 'n'), w('B', 'n', 'G', 'g')];
      const r = RK.simulate(comps, wires);
      if (!r.ok) return r.error;
      const p = r.elements.find((e) => e.id === 'P1');
      if (!near(p.v, 4.5, 0.01)) return 'V=' + p.v + ' harus 4.5V';
      return null;
    }
  },
  {
    name: 'Induktor = kabel untuk DC',
    run() {
      const comps = [c('B', 'battery', { v: 9 }), c('R1', 'resistor', { r: 100 }), c('L1', 'inductor'), c('G', 'ground')];
      const wires = [w('B', 'p', 'R1', 'a'), w('R1', 'b', 'L1', 'a'), w('L1', 'b', 'B', 'n'), w('B', 'n', 'G', 'g')];
      const r = RK.simulate(comps, wires);
      if (!r.ok) return r.error;
      const b = r.elements.find((e) => e.source);
      if (!near(Math.abs(b.i), 9 / 100.05, 0.002)) return 'I=' + b.i;
      return null;
    }
  },
  {
    name: 'Transistor NPN menjenuhkan LED (sensor LDR style)',
    run() {
      const comps = [
        c('B', 'battery', { v: 12 }), c('R2', 'resistor', { r: 470 }), c('D1', 'led', { vf: 1.8 }),
        c('Q1', 'npn', { beta: 200 }), c('R1', 'resistor', { r: 10000 }), c('G', 'ground')
      ];
      const wires = [
        w('B', 'p', 'R1', 'a'), w('R1', 'b', 'Q1', 'b'),
        w('B', 'p', 'R2', 'a'), w('R2', 'b', 'D1', 'a'), w('D1', 'b', 'Q1', 'c'),
        w('Q1', 'e', 'B', 'n'), w('B', 'n', 'G', 'g')
      ];
      const r = RK.simulate(comps, wires);
      if (!r.ok) return r.error;
      const q = r.elements.find((e) => e.id === 'Q1');
      if (!q.on) return 'transistor harus aktif';
      if (!q.note || q.note !== 'jenuh') return 'harus jenuh, dapat: ' + q.note;
      const led = r.elements.find((e) => e.id === 'D1');
      if (!led.on) return 'LED harus menyala';
      if (!near(Math.abs(led.i), 0.0204, 0.003)) return 'I(LED)=' + led.i;
      return null;
    }
  },
  {
    name: 'Transistor cut-off saat basis tidak diberi arus',
    run() {
      const comps = [
        c('B', 'battery', { v: 12 }), c('R2', 'resistor', { r: 470 }), c('D1', 'led', { vf: 1.8 }),
        c('Q1', 'npn', { beta: 200 }), c('G', 'ground')
      ];
      const wires = [
        w('B', 'p', 'R2', 'a'), w('R2', 'b', 'D1', 'a'), w('D1', 'b', 'Q1', 'c'),
        w('Q1', 'e', 'B', 'n'), w('Q1', 'b', 'B', 'n'), w('B', 'n', 'G', 'g')
      ];
      const r = RK.simulate(comps, wires);
      if (!r.ok) return r.error;
      const led = r.elements.find((e) => e.id === 'D1');
      if (led.on && Math.abs(led.i) > 0.001) return 'LED harus mati, I=' + led.i;
      return null;
    }
  },
  {
    name: 'LDR terang vs gelap mengubah tegangan',
    run() {
      function run(lux) {
        const comps = [c('B', 'battery', { v: 12 }), c('R3', 'resistor', { r: 330 }), c('L1', 'ldr', { lux }), c('G', 'ground')];
        const wires = [w('B', 'p', 'R3', 'a'), w('R3', 'b', 'L1', 'a'), w('L1', 'b', 'B', 'n'), w('B', 'n', 'G', 'g')];
        const r = RK.simulate(comps, wires);
        if (!r.ok) throw new Error(r.error);
        return r.elements.find((e) => e.id === 'L1').v;
      }
      const terang = run(1000), gelap = run(0);
      if (!(terang < 10)) return 'saat terang tegangan LDR harus lebih kecil, dapat ' + terang.toFixed(2);
      if (!(gelap > 11.5)) return 'saat gelap tegangan LDR harus besar, dapat ' + gelap.toFixed(2);
      if (!(gelap > terang + 1)) return 'perbedaan terlalu kecil: ' + terang.toFixed(2) + ' vs ' + gelap.toFixed(2);
      return null;
    }
  },
  {
    name: 'Buzzer menarik arus',
    run() {
      const comps = [c('B', 'battery', { v: 12 }), c('Z1', 'buzzer', { r: 100 }), c('G', 'ground')];
      const wires = [w('B', 'p', 'Z1', 'a'), w('Z1', 'b', 'B', 'n'), w('B', 'n', 'G', 'g')];
      const r = RK.simulate(comps, wires);
      if (!r.ok) return r.error;
      const z = r.elements.find((e) => e.id === 'Z1');
      if (!near(Math.abs(z.i), 0.12, 0.005)) return 'I=' + z.i;
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
