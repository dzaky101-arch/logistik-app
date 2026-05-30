// State
let botState = {
  config: {
    telegramToken: '',
    gasUrl: '',
    sheetUrl: ''
  }
};

// Initial Load
document.addEventListener('DOMContentLoaded', () => {
  loadConfig();
  initApp();
});

function initApp() {
  // Tab Switcher
  const tabBtns = document.querySelectorAll('.tab-btn');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(btn.dataset.tab).classList.add('active');
    });
  });

  // Bind inputs to state and local storage
  bindInput('tg-token', 'telegramToken');
  bindInput('gas-url', 'gasUrl');
  bindInput('sheet-url', 'sheetUrl');

  // Webhook action buttons
  document.getElementById('btn-set-webhook').addEventListener('click', setWebhook);
  document.getElementById('btn-check-webhook').addEventListener('click', checkWebhookInfo);
  document.getElementById('btn-delete-webhook').addEventListener('click', deleteWebhook);

  // Copy GAS Code button
  document.getElementById('btn-copy-gas').addEventListener('click', copyGasCode);

  // Initial updates
  updateGasCode();
}

function bindInput(elementId, stateKey) {
  const element = document.getElementById(elementId);
  if (!element) return;

  // Set initial value
  element.value = botState.config[stateKey] || '';

  // Handle changes
  element.addEventListener('input', (e) => {
    botState.config[stateKey] = e.target.value;
    saveConfig();
    updateGasCode();
  });
}

function saveConfig() {
  localStorage.setItem('sheet_bot_config', JSON.stringify(botState.config));
}

function loadConfig() {
  const saved = localStorage.getItem('sheet_bot_config');
  if (saved) {
    try {
      botState.config = JSON.parse(saved);
    } catch (e) {
      console.error('Error loading config', e);
    }
  }
}

// Generate Google Apps Script Code template with token auto-injected!
function updateGasCode() {
  const el = document.getElementById('gas-code-display');
  if (!el) return;

  const currentToken = botState.config.telegramToken ? botState.config.telegramToken.trim() : "TOKEN_BOT_ANDA";
  
  // Ekstrak spreadsheet ID dari sheet URL
  let sheetId = "ID_SPREADSHEET_ANDA";
  const rawSheetUrl = botState.config.sheetUrl ? botState.config.sheetUrl.trim() : "";
  if (rawSheetUrl) {
    const match = rawSheetUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (match && match[1]) {
      sheetId = match[1];
    } else {
      sheetId = rawSheetUrl;
    }
  }

  const code = `// ========================================================
// SHEETBOT - GOOGLE APPS SCRIPT BACKEND TELEGRAM BOT
// ========================================================

// Token Bot Telegram (Sudah tersisip otomatis dari input dashboard)
var BOT_TOKEN = "${currentToken}";

// ID Spreadsheet Google Anda (Sudah tersisip otomatis dari input dashboard)
var SPREADSHEET_ID = "${sheetId}";

// Keamanan: Masukkan Chat ID Telegram Anda sendiri di dalam tanda []
// Contoh: var AUTHORIZED_CHATS = [12345678, -100123456789];
// Kosongkan [] jika ingin memperbolehkan siapa saja menggunakan bot ini
var AUTHORIZED_CHATS = [];

function doPost(e) {
  try {
    var update = JSON.parse(e.postData.contents);
    
    // Pastikan update berisi pesan teks
    if (!update.message || !update.message.text) {
      return HtmlService.createHtmlOutput("OK");
    }
    
    var chatId = update.message.chat.id;
    var username = update.message.from.username || update.message.from.first_name || "User";
    var text = update.message.text.trim();
    
    // Validasi Pengguna Terdaftar
    if (AUTHORIZED_CHATS.length > 0 && AUTHORIZED_CHATS.indexOf(chatId) === -1) {
      sendTelegramText(chatId, "❌ <b>Akses Ditolak!</b>\\nAnda tidak memiliki akses menulis ke Google Sheet ini.\\n\\nChat ID Anda: <code>" + chatId + "</code>");
      return HtmlService.createHtmlOutput("OK");
    }
    
    // Handle command /start
    if (text.startsWith("/start")) {
      var welcome = "👋 <b>Halo " + username + "!</b>\\n\\n" +
                    "Saya adalah bot integrasi Google Sheets Anda.\\n" +
                    "Kirimkan data hasil <b>scan barcode resi</b> atau ketik detail resi di sini. Data Anda akan langsung masuk ke Google Sheets.\\n\\n" +
                    "📌 <b>Format Input Multi-Resi:</b>\\n" +
                    "<code>Return msotomotif\\n" +
                    "29 Mei 2026\\n" +
                    "Trip 1\\n" +
                    "1. SPXID063846639495\\n" +
                    "2. SPXID062327764495\\n" +
                    "Keterangan: Paket sudah dikembalikan.</code>\\n\\n" +
                    "📌 <b>Atau Kirim Resi Saja:</b>\\n" +
                    "<code>SPXID063846639495</code>";
      sendTelegramText(chatId, welcome);
      return HtmlService.createHtmlOutput("OK");
    }
    
    // Parsing Data Resi secara pintar (Mendukung Multi-Resi)
    var parsed = parseResi(text);
    
    // Buka Google Sheet secara aman menggunakan ID Spreadsheet
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheets()[0]; // Ambil sheet/tab pertama
    
    // Setup Header Kolom jika sheet masih kosong
    var headers = sheet.getRange(1, 1, 1, Math.max(1, sheet.getLastColumn())).getValues()[0];
    if (sheet.getLastColumn() == 0 || headers[0] == "") {
      headers = ["Tanggal", "No Urut", "Nomor Resi", "Nama Seller", "Trip", "Keterangan", "Timestamp Input", "Pengirim Telegram"];
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    }
    
    // Dapatkan daftar resi yang sudah ada untuk cek duplikasi (kolom Nomor Resi ada di kolom 3 / Index 2)
    var existingResis = {};
    var lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      var resiValues = sheet.getRange(1, 3, lastRow, 1).getValues();
      for (var k = 0; k < resiValues.length; k++) {
        var rVal = resiValues[k][0].toString().trim().toUpperCase();
        if (rVal) {
          existingResis[rVal] = true;
        }
      }
    }

    var savedCount = 0;
    var ignoredList = [];
    
    // Tulis Setiap Resi ke Google Sheet jika valid (awalan SPX & tidak duplikat)
    for (var i = 0; i < parsed.resiList.length; i++) {
      var item = parsed.resiList[i];
      var resiClean = item.resi.trim().toUpperCase();
      
      // 1. Validasi Awalan SPX
      if (!resiClean.startsWith("SPX")) {
        item.isIgnored = true;
        item.ignoreReason = "Bukan awalan SPX";
        ignoredList.push(item.resi + " (Bukan awalan SPX)");
        continue;
      }
      
      // 2. Validasi Duplikasi
      if (existingResis[resiClean]) {
        item.isIgnored = true;
        item.ignoreReason = "Double/Sudah ada";
        ignoredList.push(item.resi + " (Double/Sudah ada)");
        continue;
      }
      
      existingResis[resiClean] = true;
      item.isIgnored = false;
      
      var newRow = [
        parsed.tanggalText,
        item.noUrut,
        item.resi,
        parsed.seller,
        parsed.trip,
        parsed.keterangan,
        new Date(),
        username + " (" + chatId + ")"
      ];
      sheet.appendRow(newRow);
      savedCount++;
    }
    
    // Kirim Balasan ke Telegram
    var reply = "";
    if (savedCount > 0) {
      reply += "✅ <b>" + savedCount + " Data Resi Berhasil Disimpan!</b>\\n\\n" +
               "• <b>Tanggal:</b> " + parsed.tanggalText + "\\n" +
               "• <b>Seller:</b> " + parsed.seller + "\\n" +
               "• <b>Trip:</b> " + parsed.trip + "\\n" +
               "• <b>Keterangan:</b> " + parsed.keterangan + "\\n\\n" +
               "📦 <b>Resi Tersimpan:</b>\\n";
      
      var savedIdx = 1;
      for (var i = 0; i < parsed.resiList.length; i++) {
        var item = parsed.resiList[i];
        if (!item.isIgnored) {
          reply += savedIdx + ". <code>" + item.resi + "</code>\\n";
          savedIdx++;
        }
      }
      reply += "\\n";
    } else {
      reply += "⚠️ <b>Tidak ada resi baru yang disimpan.</b>\\n\\n";
    }
    
    if (ignoredList.length > 0) {
      reply += "⚠️ <b>Resi Diabaikan / Dilewati (" + ignoredList.length + "):</b>\\n";
      for (var i = 0; i < ignoredList.length; i++) {
        reply += "- <code>" + ignoredList[i] + "</code>\\n";
      }
      reply += "\\n";
    }
    
    reply += "📊 <i>Tersimpan di Google Sheets Anda.</i>";
                 
    sendTelegramText(chatId, reply);
    return HtmlService.createHtmlOutput("OK");
     
  } catch (error) {
    if (update && update.message) {
      sendTelegramText(update.message.chat.id, "❌ <b>Gagal Menyimpan Data!</b>\\nError: " + error.toString());
    }
    return HtmlService.createHtmlOutput("Error: " + error.toString());
  }
}
 
// Parser pintar mengekstrak field resi (Mendukung Multi-Resi & Format Terstruktur)
function parseResi(text) {
  var lines = text.split("\\n");
  var seller = "-";
  var tanggalText = "";
  var trip = "-";
  var keterangan = "-";
  var resiList = [];
  
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i].trim();
    if (line.length === 0) continue;
    
    var lowerLine = line.toLowerCase();
    
    // 1. Ekstrak Nama Seller dari "Return [Nama Seller]"
    if (lowerLine.indexOf("return ") === 0) {
      seller = line.substring(7).trim();
    }
    // 2. Ekstrak Trip
    else if (lowerLine.indexOf("trip ") === 0) {
      trip = line.trim();
    }
    // 3. Ekstrak Keterangan
    else if (lowerLine.indexOf("keterangan:") === 0 || lowerLine.indexOf("ket:") === 0) {
      keterangan = line.substring(line.indexOf(":") + 1).trim();
    }
    // 4. Ekstrak Baris Ber-angka (No Urut & Resi)
    else if (/^\\d+[\\.\\)]\\s*/.test(line)) {
      var match = line.match(/^(\\d+)[\\.\\)]\\s*(.*)$/);
      if (match) {
        var noUrut = parseInt(match[1]);
        var resi = match[2].trim();
        resiList.push({ noUrut: noUrut, resi: resi });
      }
    }
    // 5. Ekstrak Tanggal (Pola tanggal Indonesia, misal "29 Mei 2026")
    else if (/(januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember|jan|feb|mar|apr|mei|jun|jul|agt|sep|okt|nov|des)/i.test(lowerLine)) {
      tanggalText = line.trim();
    }
  }
  
  // Fallback jika tidak ditemukan baris berangka (Single Resi)
  if (resiList.length === 0) {
    var singleResi = "";
    if (lines.length === 1) {
      singleResi = text.trim();
    } else {
      singleResi = lines[0].trim();
    }
    resiList.push({ noUrut: 1, resi: singleResi });
  }
  
  return {
    seller: seller,
    tanggalText: tanggalText || new Date().toLocaleDateString('id-ID'),
    trip: trip,
    keterangan: keterangan,
    resiList: resiList
  };
}

function sendTelegramText(chatId, text) {
  var url = "https://api.telegram.org/bot" + BOT_TOKEN + "/sendMessage";
  var payload = {
    "chat_id": chatId,
    "text": text,
    "parse_mode": "HTML"
  };
  var options = {
    "method": "post",
    "contentType": "application/json",
    "payload": JSON.stringify(payload),
    "muteHttpExceptions": true
  };
  UrlFetchApp.fetch(url, options);
}`;

  el.textContent = code;
}

function copyGasCode() {
  const code = document.getElementById('gas-code-display').textContent;
  navigator.clipboard.writeText(code).then(() => {
    const copyBtn = document.getElementById('btn-copy-gas');
    const originalText = copyBtn.innerHTML;
    copyBtn.innerHTML = `
      <svg style="width:16px;height:16px;fill:currentColor" viewBox="0 0 24 24"><path d="M21,7L9,19L3.5,13.5L4.91,12.09L9,16.17L19.59,5.59L21,7Z"/></svg>
      Tersalin!
    `;
    setTimeout(() => {
      copyBtn.innerHTML = originalText;
    }, 2000);
  }).catch(err => {
    console.error('Gagal menyalin text', err);
  });
}

// ----------------------------------------------------
// Telegram Webhook API Callers
// ----------------------------------------------------

async function setWebhook() {
  const token = botState.config.telegramToken.trim();
  const gasUrl = botState.config.gasUrl.trim();
  const statusEl = document.getElementById('webhook-status-container');

  if (!token || !gasUrl) {
    showStatus('Error: Token Bot Telegram dan URL Google Apps Script wajib diisi!', 'error');
    return;
  }

  showStatus('Menghubungkan Webhook...', 'info');
  const apiUrl = `https://api.telegram.org/bot${token}/setWebhook?url=${encodeURIComponent(gasUrl)}&drop_pending_updates=true`;

  try {
    const response = await fetch(apiUrl, { method: 'POST' });
    const data = await response.json();

    if (data.ok) {
      showStatus('🎉 Webhook Sukses Terdaftar! Bot Telegram Anda sekarang terhubung ke Google Sheets.', 'success');
      checkWebhookInfo(); // Auto-update info card
    } else {
      showStatus(`Gagal mendaftarkan webhook: ${data.description}`, 'error');
    }
  } catch (error) {
    showStatus(`Error koneksi ke API Telegram: ${error.toString()}`, 'error');
  }
}

async function checkWebhookInfo() {
  const token = botState.config.telegramToken.trim();
  const infoEl = document.getElementById('webhook-info-details');
  const cardEl = document.getElementById('webhook-info-card');

  if (!token) {
    showStatus('Error: Masukkan Token Bot Telegram terlebih dahulu untuk mengecek info Webhook!', 'error');
    return;
  }

  const apiUrl = `https://api.telegram.org/bot${token}/getWebhookInfo`;

  try {
    const response = await fetch(apiUrl);
    const data = await response.json();

    if (data.ok) {
      const info = data.result;
      cardEl.style.display = 'block';
      
      infoEl.innerHTML = `
        <div class="webhook-info-row">
          <span class="webhook-info-label">Status Terkoneksi:</span>
          <span class="webhook-info-value" style="color:var(--success)">${info.url ? 'YA (Aktif)' : 'TIDAK'}</span>
        </div>
        <div class="webhook-info-row">
          <span class="webhook-info-label">Webhook URL:</span>
          <span class="webhook-info-value" style="font-size:0.8rem;">${info.url || '-'}</span>
        </div>
        <div class="webhook-info-row">
          <span class="webhook-info-label">Pending Updates (Pesan Antri):</span>
          <span class="webhook-info-value">${info.pending_update_count}</span>
        </div>
        <div class="webhook-info-row">
          <span class="webhook-info-label">Error Terakhir:</span>
          <span class="webhook-info-value" style="color:var(--danger)">${info.last_error_message || '-'}</span>
        </div>
      `;
    } else {
      showStatus(`Gagal mendapatkan info: ${data.description}`, 'error');
    }
  } catch (error) {
    showStatus(`Error koneksi ke API Telegram: ${error.toString()}`, 'error');
  }
}

async function deleteWebhook() {
  const token = botState.config.telegramToken.trim();
  const cardEl = document.getElementById('webhook-info-card');

  if (!token) {
    showStatus('Error: Masukkan Token Bot Telegram terlebih dahulu!', 'error');
    return;
  }

  if (!confirm('Apakah Anda yakin ingin menghapus Webhook? Bot tidak akan mengirimkan data lagi ke Sheets.')) {
    return;
  }

  showStatus('Menghapus Webhook...', 'info');
  const apiUrl = `https://api.telegram.org/bot${token}/deleteWebhook`;

  try {
    const response = await fetch(apiUrl, { method: 'POST' });
    const data = await response.json();

    if (data.ok) {
      showStatus('🧹 Webhook berhasil dinonaktifkan. Bot Telegram tidak lagi terhubung ke Google Sheets.', 'success');
      cardEl.style.display = 'none';
    } else {
      showStatus(`Gagal menonaktifkan webhook: ${data.description}`, 'error');
    }
  } catch (error) {
    showStatus(`Error koneksi ke API Telegram: ${error.toString()}`, 'error');
  }
}

function showStatus(message, type) {
  const target = document.getElementById('status-container');
  if (!target) return;

  target.className = `status-msg ${type}`;
  target.style.display = 'flex';
  
  let iconSvg = '';
  if (type === 'success') {
    iconSvg = `<svg style="width: 20px; height: 20px; fill: currentColor;" viewBox="0 0 24 24"><path d="M12 2C6.5 2 2 6.5 2 12S6.5 22 12 22 22 17.5 22 12 17.5 2 12 2M10 17L5 12L6.41 10.59L10 14.17L17.59 6.58L19 8L10 17Z"/></svg>`;
  } else if (type === 'error') {
    iconSvg = `<svg style="width: 20px; height: 20px; fill: currentColor;" viewBox="0 0 24 24"><path d="M12 2C6.5 2 2 6.5 2 12S6.5 22 12 22 22 17.5 22 12 17.5 2 12 2M13 17H11V15H13V17M13 13H11V7H13V13Z"/></svg>`;
  } else if (type === 'info') {
    iconSvg = `<svg style="width: 20px; height: 20px; fill: currentColor;" viewBox="0 0 24 24"><path d="M11,9H13V7H11M12,20C7.59,20 4,16.41 4,12C4,7.59 7.59,4 12,4C16.41,4 20,7.59 20,12C20,16.41 16.41,20 12,20M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M11,17H13V11H11V17Z"/></svg>`;
  }

  target.innerHTML = `${iconSvg} <span>${escapeHtml(message)}</span>`;
}

function escapeHtml(text) {
  if (typeof text !== 'string') return text;
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
