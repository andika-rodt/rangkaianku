# Changelog RangkaianKu

Setiap build punya ID di tab Sistem. Rename `BUILD` di `core.js` tiap rilis supaya catatan bug bisa dipetakan ke versi.

## 2026.11.16-r1
- Rilis pertama: kanvas rangkaian (grid, geser, putar, zoom, undo/redo), 7 komponen, kabel antar pin.
- Mesin simulasi DC (MNA): baterai, resistor, lampu, LED (iteratif), saklar; kapasitor terbuka untuk DC.
- Label hasil simulasi per komponen (V dan mA) + peringatan arus besar.
- Pustaka komponen, daftar rangkaian tersimpan, draf otomatis.
- Keamanan: CSP ketat, tanpa koneksi keluar, validasi impor (jenis, rentang, duplikat ID, kunci proto), batas ukuran, teks selalu lewat textContent.
- Pencatat bug: uji mandiri 4 kasus saat aplikasi dibuka, jurnal 12 aksi terakhir, build ID, deteksi regresi antar build.
