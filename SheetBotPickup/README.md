# SheetBot Pickup 📊🚚

**SheetBot Pickup** adalah aplikasi web lokal modern untuk menghubungkan **Bot Telegram khusus Pickup** dengan **Google Sheets**. Sistem ini didesain khusus bagi Anda yang ingin menginput data pickup nomor resi dari HP secara cepat (seperti membagikan hasil scan barcode resi pickup) langsung ke baris Google Sheets.

Sistem ini berjalan 24 jam nonstop secara serverless di infrastruktur cloud Google (melalui Google Apps Script).

---

## ⚡ Cara Menjalankan Dashboard

1. Buka folder proyek ini di Windows Explorer (`d:\Anti Grafity\SheetBotPickup`).
2. Klik kanan pada file `run.ps1` dan pilih **Run with PowerShell** (Jalankan dengan PowerShell).
3. Browser default Anda akan otomatis terbuka ke alamat `http://localhost:8081/` (menggunakan port 8081 agar tidak bentrok dengan Bot Return).
4. Untuk mematikan server, Anda cukup menutup jendela PowerShell atau menekan `Ctrl + C` di jendela tersebut.

---

## 🛠️ Panduan Integrasi Langkah Demi Langkah

### Langkah 1: Buat Bot Baru di Telegram
1. Buka Telegram dan cari bot resmi [@BotFather](https://t.me/BotFather).
2. Kirim perintah `/newbot` ke BotFather.
3. Masukkan **Nama Bot** Anda (misalnya: `Bot Pickup Resi`).
4. Masukkan **Username Bot** unik Anda yang diakhiri kata `bot` (misalnya: `toko_saya_pickup_bot`).
5. BotFather akan memberikan **HTTP API Token** (contoh: `8663975087:AAHHEqZt...`). Salin token tersebut.

### Langkah 2: Buat Google Sheet & Apps Script
1. Buat Google Spreadsheet baru di Google Drive Anda (beri nama misalnya: `Data Pickup Resi`).
2. Klik menu **Extensions (Ekstensi)** > **Apps Script** di dalam Spreadsheet Anda.
3. Buka tab **2. Salin Kode Google Apps Script** di dashboard SheetBot Pickup (yang berjalan di browser Anda).
4. Masukkan **Token Bot Telegram Pickup** dan **URL Google Sheet** Anda ke kolom input di kiri terlebih dahulu, maka kredensial Anda akan **otomatis tersemat** di dalam kode Apps Script yang ditampilkan.
5. Klik **Salin Kode**, lalu hapus semua kode bawaan di editor Apps Script dan tempelkan (paste) kode tersebut.
6. Klik tombol **Save** (ikon disket).

### Langkah 3: Deploy Apps Script sebagai Web App
1. Di editor Apps Script, klik tombol **Deploy (Terapkan)** di pojok kanan atas > **New deployment (Penerapan baru)**.
2. Klik tombol roda gigi di samping "Select type" > pilih **Web app (Aplikasi web)**.
3. Atur opsi konfigurasi berikut:
   - **Execute as**: `Me (Email Anda)`
   - **Who has access**: `Anyone (Siapa saja)` ⚠️ *Ini wajib agar Telegram dapat mengirimkan data dari server mereka.*
4. Klik **Deploy**.
5. Klik **Authorize Access**, pilih akun Google Anda, klik **Advanced (Lanjutan)** > **Go to project (unsafe)**, lalu pilih **Allow**.
6. Salin **Web app URL** yang muncul di layar (berakhiran `/exec`).

### Langkah 4: Hubungkan Webhook menggunakan Dashboard
1. Buka kembali dashboard SheetBot Pickup di browser Anda.
2. Paste **Web app URL** yang telah Anda salin ke input **Google Apps Script Web App URL** di panel kiri.
3. Klik tombol **Hubungkan Webhook (Set Webhook)**.
4. Jika berhasil, status indikator di kiri akan berubah menjadi sukses berwarna hijau.
5. Anda dapat memverifikasi status koneksinya dengan menekan tombol **Cek Status Webhook**.

---

## 📲 Cara Penggunaan dari Handphone

1. Cari username bot Telegram Pickup Anda di HP, lalu ketik `/start`.
2. Kirim pesan teks berisi format detail pickup Anda:
   
   ```
   Pickup nama_seller
   29 Mei 2026
   Trip 1
   1. SPXID063846639495
   2. SPXID062327764495
   Keterangan: Paket sudah di-pickup.
   ```

3. Bot akan memproses seluruh resi secara otomatis, memasukkan **2 baris terpisah** ke Google Sheets Anda secara rapi, dan membalas dengan ringkasan konfirmasi sukses!

---

## 🔒 Fitur Keamanan Tambahan
Agar orang asing tidak dapat mengotori Google Sheets Anda, Anda dapat membatasi bot agar hanya merespon akun Telegram Anda sendiri:
1. Di dalam kode Google Apps Script Anda, cari baris:
   `var AUTHORIZED_CHATS = [];`
2. Masukkan Chat ID Telegram Anda ke dalam kurung siku tersebut, misalnya:
   `var AUTHORIZED_CHATS = [123456789];`.
3. Simpan dan deploy ulang sebagai versi baru (Deploy > Manage deployments > Edit > pilih "New version" > Deploy).
