# Personal Dashboard — Node.js

Dashboard sederhana untuk mengelola tugas dan jadwal pribadi.

## Cara Menjalankan

### 1. Install dependencies
```bash
cd personal-dashboard
npm install
```

### 2. Jalankan server
```bash
npm start
```
Atau gunakan nodemon untuk auto-reload saat development:
```bash
npm run dev
```

### 3. Buka di browser
```
http://localhost:3000
```

---

## Struktur Project

```
personal-dashboard/
├── server.js              # Entry point — Express server + data + routes
├── package.json
├── public/
│   ├── css/style.css      # Semua styling
│   └── js/main.js         # Client-side JS (animasi)
└── views/
    ├── dashboard.ejs      # Halaman utama
    ├── tasks.ejs          # Halaman daftar tugas
    ├── schedule.ejs       # Halaman jadwal mingguan
    └── partials/
        ├── header.ejs     # Header HTML + sidebar
        └── footer.ejs     # Footer HTML + script
```

## Fitur

| Fitur | Keterangan |
|-------|-----------|
| 📊 Dashboard | Summary card: total/selesai/in-progress/prioritas tinggi |
| 📌 Tugas Mendesak | 5 tugas terdekat deadline (belum selesai) |
| 📅 Jadwal Hari Ini | Timeline jadwal hari ini otomatis |
| 📊 Donut Chart | Visualisasi distribusi status tugas (SVG) |
| ✅ Halaman Tugas | Tabel lengkap dengan filter & update status AJAX |
| 📅 Jadwal Mingguan | Grid 7 hari dengan color-coding per tipe |
| 🔔 Notifikasi | Badge jumlah tugas prioritas tinggi + terlambat |

## Teknologi

- **Backend**: Node.js + Express.js
- **Template**: EJS (Embedded JavaScript)
- **Frontend**: Plain HTML + CSS + Vanilla JS
- **Data**: In-memory dummy data (siap diganti database)
