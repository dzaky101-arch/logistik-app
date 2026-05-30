# SheetLog - Terminal Pickup Barcode Scanner 📊📦

**SheetLog Pickup Scanner** adalah aplikasi web lokal berupa **Terminal Barcode Scanner** yang terhubung langsung dengan **Google Sheets**. Aplikasi ini dirancang bagi Anda yang ingin memindai nomor resi (menggunakan barcode scanner gun / HP / ketik manual) secara cepat berturut-turut untuk mencatat operasional pickup paket di gudang.

---

## ⚡ Fitur Utama Terminal Scanner

1. **Auto-Submit**: Cukup tembak barcode pada resi fisik, input akan otomatis terkirim dan disimpan ke Google Sheet tanpa harus menekan tombol kirim di layar.
2. **Instant Refocus & Clear Input**: Setelah data dikirim, kolom input otomatis dikosongkan dan difokuskan kembali. Anda siap melakukan pemindaian berikutnya dalam waktu kurang dari 1 detik.
3. **Auto-Refocus Shield (Proteksi Fokus)**: Sistem otomatis memfokuskan kembali kursor ke kolom scan jika Anda tidak sengaja mengklik area kosong lain pada halaman web. Ini mencegah hilangnya input saat memindai banyak paket.
4. **Beep Audio Feedback**: Browser akan mengeluarkan bunyi *beep* bernada tinggi sebagai indikator sukses simpan, dan bunyi *boop* bernada rendah sebagai alarm jika koneksi gagal atau ada error.
5. **Session History & Counters**: Menampilkan jumlah total paket yang berhasil dipindai dan riwayat status 5 paket terakhir (Mengirim, Sukses, Gagal).
6. **Memori Seller Lokal**: Anda dapat menambahkan nama-nama seller baru langsung dari dashboard, dan daftar ini otomatis tersimpan di memori browser Anda.

---

## 🚀 Cara Menjalankan Terminal Scanner

1. Buka folder proyek ini di Windows Explorer (`d:\Anti Grafity\PickupScanner`).
2. Klik kanan pada file `run.ps1` dan pilih **Run with PowerShell** (Jalankan dengan PowerShell).
3. Browser default Anda akan otomatis membuka halaman terminal di alamat `http://localhost:8082/`.
4. Untuk menghentikan server, tutup jendela PowerShell atau tekan `Ctrl + C` di jendela tersebut.

---

## 🛠️ Panduan Integrasi Google Sheets

### Langkah 1: Buat Google Sheet
1. Buat Google Spreadsheet baru di akun Google Drive Anda.
2. Secara default, biarkan lembar kerja kosong. Sistem akan otomatis menulis header kolom berikut pada baris pertama saat scan pertama dilakukan: `Tanggal`, `Nama Seller`, `Trip`, `Nomor Resi`, `Keterangan`, dan `Timestamp Input`.
3. Salin link spreadsheet tersebut dari address bar browser Anda.

### Langkah 2: Pasang Google Apps Script
1. Di Spreadsheet Anda, buka menu **Extensions (Ekstensi)** > **Apps Script**.
2. Buka dashboard SheetLog di browser Anda, lalu buka tab **Panduan Setup Google**.
3. Masukkan **Link Google Sheet** Anda di panel konfigurasi sebelah kiri. Kodenya akan otomatis memperbarui ID Spreadsheet Anda.
4. Klik tombol **Salin Kode** di bagian bawah panduan.
5. Hapus semua kode bawaan di editor Apps Script Anda, lalu tempelkan (paste) kode yang telah disalin.
6. Klik tombol **Save** (ikon disket).

### Langkah 3: Deploy & Otorisasi Hak Akses
1. Di editor Apps Script, klik tombol **Deploy (Terapkan)** di kanan atas > **New deployment (Penerapan baru)**.
2. Pilih jenis (ikon roda gigi) > **Web app (Aplikasi web)**.
3. Atur opsi konfigurasi berikut:
   - **Execute as**: `Me (Email Anda)`
   - **Who has access**: `Anyone (Siapa saja)` ⚠️ *Ini wajib agar Terminal Scanner dapat mengirimkan data.*
4. Klik **Deploy** dan salin **Web app URL** yang muncul di layar (berakhiran `/exec`).
5. Tempelkan URL tersebut ke input **Google Web App URL (Deployment URL)** di panel kiri dashboard SheetLog.

⚠️ **OTORISASI PENTING**: 
* Di editor Apps Script, ubah dropdown pilihan fungsi di atas menjadi **`doGet`**, lalu klik tombol **Run (Jalankan)**.
* Google akan meminta otorisasi akun. Klik *Review Permissions* -> Pilih akun Anda -> Klik *Advanced/Lanjutan* -> Klik *Go to project (unsafe)* -> Klik *Allow*.
* Langkah ini wajib dilakukan sekali agar Google Drive mengizinkan penulisan data ke dalam Sheet.

---

## 📲 Cara Pemindaian Paket

1. Buka dashboard di browser Anda.
2. Pastikan lampu indikator di pojok kanan atas bertuliskan **● Scanner Siap**.
3. Atur **Nama Seller**, **Trip**, dan **Keterangan** sekali di bagian atas (data ini akan tetap tersimpan untuk semua paket yang akan dipindai).
4. Klik sekali pada kolom input pindaian besar di tengah layar (kursor harus berkedip di dalam kolom tersebut).
5. Mulailah memindai barcode resi paket menggunakan scanner gun Anda.
6. Scanner gun akan otomatis menembak barcode, mengirim tombol Enter, dan data Anda langsung masuk ke Google Sheets!
