# SheetBot 📊🤖

**SheetBot** adalah aplikasi web lokal modern untuk menghubungkan **Bot Telegram** dengan **Google Sheets**. Sistem ini didesain khusus bagi Anda yang ingin menginput data nomor resi atau informasi lainnya dari HP secara cepat (seperti membagikan hasil scan barcode resi) langsung ke baris Google Sheets.

Sistem ini berjalan 24 jam nonstop tanpa memerlukan komputer Anda tetap menyala karena backend-nya berjalan secara serverless di infrastruktur cloud Google (melalui Google Apps Script).

---

## ⚡ Cara Menjalankan Dashboard

1. Buka folder proyek ini di Windows Explorer (`d:\Anti Grafity\SheetBot`).
2. Klik kanan pada file `run.ps1` dan pilih **Run with PowerShell** (Jalankan dengan PowerShell).
3. Browser default Anda akan otomatis terbuka ke alamat `http://localhost:8080/`.
4. Untuk mematikan server, Anda cukup menutup jendela PowerShell atau menekan `Ctrl + C` di jendela tersebut.

---

## 🛠️ Panduan Integrasi Langkah Demi Langkah

### Langkah 1: Buat Bot di Telegram
1. Buka Telegram dan cari bot [@BotFather](https://t.me/BotFather).
2. Kirim perintah `/newbot` ke BotFather.
3. Masukkan **Nama Bot** Anda (misalnya: `Bot Input Resi`).
4. Masukkan **Username Bot** unik Anda yang diakhiri kata `bot` (misalnya: `toko_saya_resi_bot`).
5. BotFather akan memberikan **HTTP API Token** (contoh: `123456789:ABCdefGh...`). Salin token tersebut.

### Langkah 2: Buat Google Sheet & Apps Script
1. Buat Google Spreadsheet baru di Google Drive Anda.
2. Secara default, sheet ini bisa dibiarkan kosong karena script akan membuat header kolom secara otomatis pada baris pertama. Header kolom yang dibuat meliputi: `Timestamp`, `Telegram User`, `Nomor Resi`, `Kurir / Ekspedisi`, `Nama Penerima`, `Keterangan`, dan `Pesan Asli`.
3. Klik menu **Extensions (Ekstensi)** > **Apps Script**.
4. Buka tab **2. Salin Kode Google Apps Script** di dashboard SheetBot (yang berjalan di browser Anda).
5. Masukkan Token Bot Telegram Anda ke kolom input di kiri terlebih dahulu, maka Token Anda akan **otomatis tersemat** di dalam kode Apps Script yang ditampilkan.
6. Klik **Salin Kode**, lalu hapus semua kode bawaan di editor Apps Script dan tempelkan (paste) kode tersebut.
7. Klik tombol **Save** (ikon disket).

### Langkah 3: Deploy Apps Script sebagai Web App
1. Di editor Apps Script, klik tombol **Deploy (Terapkan)** di pojok kanan atas > **New deployment (Penerapan baru)**.
2. Klik tombol roda gigi di samping "Select type" > pilih **Web app (Aplikasi web)**.
3. Atur opsi konfigurasi berikut:
   - **Execute as**: `Me (Email Anda)`
   - **Who has access**: `Anyone (Siapa saja)` ⚠️ *Ini wajib agar Telegram dapat mengirimkan data dari server mereka.*
4. Klik **Deploy**.
5. Klik **Authorize Access**, pilih akun Google Anda, klik **Advanced (Lanjutan)** > **Go to Untitled project (Unsafe)**, lalu pilih **Allow**.
6. Salin **Web app URL** yang muncul di layar (berakhiran `/exec`).

### Langkah 4: Hubungkan Webhook menggunakan Dashboard
1. Buka kembali dashboard SheetBot di browser Anda.
2. Paste **Web app URL** yang telah Anda salin ke input **Google Apps Script Web App URL** di panel kiri.
3. Masukkan kembali **Token Bot Telegram** Anda (jika belum terisi).
4. Klik tombol **Hubungkan Webhook (Set Webhook)**.
5. Jika berhasil, status indikator di kiri akan berubah menjadi sukses berwarna hijau.
6. Anda dapat memverifikasi status koneksinya kapan saja dengan menekan tombol **Cek Status Webhook**.

---

## 📲 Cara Penggunaan dari Handphone

1. Cari username bot Telegram Anda di aplikasi Telegram HP Anda, lalu ketik `/start`.
2. Anda kini dapat mulai mengirimkan data resi:
   
   - **Metode 1: Scan Barcode Cepat**
     - Gunakan aplikasi scanner barcode apa saja di HP Anda (yang memiliki fitur share text hasil scan).
     - Pindai barcode pada resi fisik Anda.
     - Klik tombol **Share / Bagikan** hasil scan tersebut dari aplikasi scanner, pilih Telegram, lalu pilih bot Anda dan kirim.
     - Bot akan otomatis menyimpannya ke Google Sheets Anda dan membalas dengan konfirmasi sukses.
   
   - **Metode 2: Ketik Nomor Resi Saja**
     - Cukup kirim pesan teks berisi nomor resi saja (misal: `JP2883910292`) ke chat bot Anda.
   
   - **Metode 3: Detail Format Multi-baris**
     - Jika ingin menginput kurir atau nama penerima, kirim dengan format berikut:
       ```
       Resi: JP2883910292
       Kurir: J&T Express
       Penerima: Pak Joko
       Ket: Paket B
       ```
       *Sistem parsing bot akan otomatis mendeteksi baris-baris tersebut secara pintar.*

---

## 🔒 Fitur Keamanan Tambahan
Agar orang asing yang tidak sengaja menemukan bot Anda tidak dapat mengotori Google Sheets Anda, Anda dapat membatasi bot agar hanya merespon akun Telegram Anda sendiri:
1. Jalankan bot Anda, kirim pesan apa saja. Jika Anda diblokir atau saat pertama kali menguji coba, klik tombol **Cek Status Webhook** di dashboard dan lihat riwayat log jika ada, atau buat bot membalas Chat ID Anda.
2. Di dalam kode Google Apps Script Anda, cari baris:
   `var AUTHORIZED_CHATS = [];`
3. Masukkan Chat ID Telegram Anda ke dalam kurung siku tersebut, misalnya:
   `var AUTHORIZED_CHATS = [123456789];` (di mana `123456789` adalah Chat ID Anda).
4. Simpan dan deploy ulang sebagai versi baru (Deploy > Manage deployments > Edit > pilih "New version" > Deploy).
5. Sekarang, hanya akun Anda yang memiliki akses penuh untuk menulis data ke Sheet tersebut.
