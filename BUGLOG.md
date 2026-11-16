# Catatan bug

Di aplikasi, catatan dibuat otomatis di tab **Sistem** (localStorage `rk.buglog.v1`) setiap ada error runtime, kegagalan uji mandiri, data rusak, atau regresi antar build. Setiap entri menyimpan build ID dan 12 aksi terakhir.

File ini untuk catatan manual yang perlu dibawa lintas perangkat.

## Format
```
## YYYY-MM-DD - build <id>
- gejala:
- penyebab:
- perbaikan:
- uji yang ditambahkan: (nama kasus di selfcheck.js)
```

## Riwayat
Belum ada bug yang dilaporkan.
