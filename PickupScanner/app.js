// State Management
let scannerState = {
  config: {
    gasUrl: '',
    sheetUrl: ''
  },
  sellers: ['msotomotif', 'toko_baru', 'sukses_motor', 'sparepart_indonesia'],
  totalScanned: 0,
  history: [] // Last scanned items
};

// Web Audio API Context (for beeps)
let audioCtx = null;

// Initialize App
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

  // Bind Config Inputs
  bindInput('gas-url', 'gasUrl');
  bindInput('sheet-url', 'sheetUrl');

  // Load Sellers Dropdown
  renderSellersDropdown();

  // Add New Seller Button
  document.getElementById('btn-add-seller').addEventListener('click', addNewSeller);

  // Scan input Form Submit
  const scanForm = document.getElementById('scan-form');
  scanForm.addEventListener('submit', handleScanSubmit);

  // Focus on scan input immediately
  const scanInput = document.getElementById('input-scan');
  scanInput.focus();

  // EXPERT-LEVEL: Auto-Refocus Shield
  // If user clicks anywhere on the page, refocus scan input, unless they clicked on config inputs
  document.addEventListener('click', (e) => {
    const isInteractiveElement = e.target.closest('input') || 
                                 e.target.closest('select') || 
                                 e.target.closest('button') || 
                                 e.target.closest('a');
    if (!isInteractiveElement) {
      scanInput.focus();
    }
  });

  // Copy GAS Code button
  document.getElementById('btn-copy-gas').addEventListener('click', copyGasCode);

  // Update generated code
  updateGasCode();
}

// Bind text inputs to state and local storage
function bindInput(elementId, stateKey) {
  const element = document.getElementById(elementId);
  if (!element) return;

  // Set initial value
  element.value = scannerState.config[stateKey] || '';

  // Handle changes
  element.addEventListener('input', (e) => {
    scannerState.config[stateKey] = e.target.value;
    saveConfig();
    updateGasCode();
  });
}

function saveConfig() {
  localStorage.setItem('pickup_scanner_config', JSON.stringify(scannerState.config));
  localStorage.setItem('pickup_scanner_sellers', JSON.stringify(scannerState.sellers));
}

function loadConfig() {
  const savedConfig = localStorage.getItem('pickup_scanner_config');
  if (savedConfig) {
    try {
      scannerState.config = JSON.parse(savedConfig);
    } catch (e) {
      console.error('Error loading config', e);
    }
  }

  const savedSellers = localStorage.getItem('pickup_scanner_sellers');
  if (savedSellers) {
    try {
      scannerState.sellers = JSON.parse(savedSellers);
    } catch (e) {
      console.error('Error loading sellers list', e);
    }
  }
}

// Sellers management
function renderSellersDropdown() {
  const select = document.getElementById('select-seller');
  if (!select) return;

  select.innerHTML = '';
  scannerState.sellers.forEach(seller => {
    const opt = document.createElement('option');
    opt.value = seller;
    opt.textContent = seller;
    select.appendChild(opt);
  });
}

function addNewSeller() {
  const input = document.getElementById('input-new-seller');
  const value = input.value.trim();
  if (!value) return;

  if (scannerState.sellers.indexOf(value) !== -1) {
    alert('Nama seller sudah ada di daftar!');
    return;
  }

  scannerState.sellers.push(value);
  saveConfig();
  renderSellersDropdown();
  
  // Set current selected to the new one
  document.getElementById('select-seller').value = value;
  input.value = '';
  
  // Refocus scan input
  document.getElementById('input-scan').focus();
}

// BEEP AUDIO SYNTHESIZER
function playSound(type) {
  // Check if sound checkbox is enabled
  const soundEnabled = document.getElementById('chk-sound').checked;
  if (!soundEnabled) return;

  try {
    // Initialize audio context on first user interaction
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }

    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }

    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    if (type === 'success') {
      // High pitch, pleasant short double beep or single barcode scanner beep
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1050, audioCtx.currentTime); // High frequency
      gainNode.gain.setValueAtTime(0.08, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.12);
      osc.start(audioCtx.currentTime);
      osc.stop(audioCtx.currentTime + 0.12);
    } else {
      // Low pitch descending "boop" warning sound
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(280, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(120, audioCtx.currentTime + 0.35); // Slur down
      gainNode.gain.setValueAtTime(0.12, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.35);
      osc.start(audioCtx.currentTime);
      osc.stop(audioCtx.currentTime + 0.35);
    }
  } catch (error) {
    console.error('Audio synthesis failed', error);
  }
}

// SCAN HANDLER
async function handleScanSubmit(e) {
  e.preventDefault();

  const scanInput = document.getElementById('input-scan');
  const resi = scanInput.value.trim();

  if (!resi) return;

  const gasUrl = scannerState.config.gasUrl.trim();
  const seller = document.getElementById('select-seller').value;
  const trip = document.getElementById('select-trip').value;
  const keterangan = document.getElementById('select-keterangan').value;

  if (!gasUrl) {
    playSound('error');
    showStatus('Error: URL Google Apps Script Web App wajib diisi di tab pengaturan!', 'error');
    scanInput.value = '';
    scanInput.focus();
    return;
  }

  // 1. Validasi Awalan SPX (case-insensitive)
  if (!resi.toUpperCase().startsWith('SPX')) {
    playSound('error');
    showStatus(`Gagal: Hanya resi dengan awalan SPX yang diperbolehkan! (${resi})`, 'error');
    scanInput.value = '';
    scanInput.focus();
    const container = document.getElementById('scan-box');
    container.classList.remove('flash-success');
    container.classList.add('flash-error');
    return;
  }

  // 2. Validasi Resi Double dalam sesi ini
  const isAlreadyScanned = scannerState.history.some(h => h.resi.toUpperCase() === resi.toUpperCase() && h.status === 'success');
  if (isAlreadyScanned) {
    playSound('error');
    showStatus(`Gagal: Resi ${resi} sudah di-scan di sesi ini (double)!`, 'error');
    scanInput.value = '';
    scanInput.focus();
    const container = document.getElementById('scan-box');
    container.classList.remove('flash-success');
    container.classList.add('flash-error');
    return;
  }

  // Generate unique ID for this scan row in history
  const scanId = 'scan_' + Date.now();
  const timestamp = new Date().toLocaleTimeString('id-ID');

  // Insert PENDING row into history instantly (so the user sees feedback)
  const newHistoryItem = {
    id: scanId,
    timestamp: timestamp,
    resi: resi,
    seller: seller,
    status: 'pending' // pending, success, error
  };
  
  scannerState.history.unshift(newHistoryItem);
  if (scannerState.history.length > 5) {
    scannerState.history.pop();
  }
  renderHistoryTable();

  // INSTANT REFOCUS & CLEAR INPUT
  scanInput.value = '';
  scanInput.focus();

  // Reset visual alert flashes
  const container = document.getElementById('scan-box');
  container.classList.remove('flash-success', 'flash-error');

  // Async request in background (does not block scanning)
  try {
    const payload = {
      resi: resi,
      seller: seller,
      trip: trip,
      keterangan: keterangan
    };

    const response = await fetch(gasUrl, {
      method: 'POST',
      mode: 'cors',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8' // avoids CORS preflight blocks in GAS
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();

    if (result.status === 'success') {
      // Success feedback
      playSound('success');
      updateHistoryItemStatus(scanId, 'success');
      container.classList.add('flash-success');
      
      // Update totals
      scannerState.totalScanned++;
      document.getElementById('counter-total').textContent = scannerState.totalScanned;
      
      showStatus(`Resi ${resi} berhasil disimpan`, 'success');
    } else {
      // Fail feedback
      playSound('error');
      updateHistoryItemStatus(scanId, 'error');
      container.classList.add('flash-error');
      showStatus(`Gagal menyimpan resi: ${result.message}`, 'error');
    }
  } catch (error) {
    // Connection fail feedback
    playSound('error');
    updateHistoryItemStatus(scanId, 'error');
    container.classList.add('flash-error');
    showStatus('Koneksi Gagal. Pastikan Deployment URL benar dan diset ke "Anyone".', 'error');
  }
}

function updateHistoryItemStatus(id, newStatus) {
  const item = scannerState.history.find(h => h.id === id);
  if (item) {
    item.status = newStatus;
    renderHistoryTable();
  }
}

function renderHistoryTable() {
  const tbody = document.getElementById('history-tbody');
  if (!tbody) return;

  if (scannerState.history.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:var(--text-muted);">Belum ada resi yang dipindai.</td></tr>`;
    return;
  }

  tbody.innerHTML = '';
  scannerState.history.forEach(item => {
    const tr = document.createElement('tr');
    
    let statusBadge = '';
    if (item.status === 'pending') {
      statusBadge = `<div class="spinner" style="width:14px;height:14px;border-width:1.5px;color:var(--info)"></div> <span style="color:var(--info)">Mengirim...</span>`;
    } else if (item.status === 'success') {
      statusBadge = `<span style="color:var(--success)">✔️ Sukses</span>`;
    } else {
      statusBadge = `<span style="color:var(--danger)">❌ Gagal</span>`;
    }

    tr.innerHTML = `
      <td>${item.timestamp}</td>
      <td class="resi-cell">${escapeHtml(item.resi)}</td>
      <td>${escapeHtml(item.seller)}</td>
      <td style="display:flex;align-items:center;gap:6px;">${statusBadge}</td>
    `;
    tbody.appendChild(tr);
  });
}

function showStatus(message, type) {
  const target = document.getElementById('status-msg-box');
  if (!target) return;

  target.className = `status-msg ${type}`;
  target.style.display = 'flex';

  let iconSvg = '';
  if (type === 'success') {
    iconSvg = `<svg style="width:18px;height:18px;fill:currentColor;" viewBox="0 0 24 24"><path d="M12 2C6.5 2 2 6.5 2 12S6.5 22 12 22 22 17.5 22 12 17.5 2 12 2M10 17L5 12L6.41 10.59L10 14.17L17.59 6.58L19 8L10 17Z"/></svg>`;
  } else if (type === 'error') {
    iconSvg = `<svg style="width:18px;height:18px;fill:currentColor;" viewBox="0 0 24 24"><path d="M12 2C6.5 2 2 6.5 2 12S6.5 22 12 22 22 17.5 22 12 17.5 2 12 2M13 17H11V15H13V17M13 13H11V7H13V13Z"/></svg>`;
  }

  target.innerHTML = `${iconSvg} <span>${escapeHtml(message)}</span>`;
}

// Generate Apps Script Code
function updateGasCode() {
  const el = document.getElementById('gas-code-display');
  if (!el) return;

  let sheetId = "ID_SPREADSHEET_ANDA";
  const rawSheetUrl = scannerState.config.sheetUrl ? scannerState.config.sheetUrl.trim() : "";
  if (rawSheetUrl) {
    const match = rawSheetUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (match && match[1]) {
      sheetId = match[1];
    } else {
      sheetId = rawSheetUrl;
    }
  }

  const code = `// ========================================================
// SHEETLOG - GOOGLE APPS SCRIPT WEB SCANNER BACKEND (PICKUP)
// ========================================================

// ID Spreadsheet Google Anda (Sudah tersisip otomatis dari input dashboard)
var SPREADSHEET_ID = "${sheetId}";

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheets()[0]; // Mengambil sheet/tab pertama
    
    // Setup Header Kolom jika sheet masih kosong
    var headers = sheet.getRange(1, 1, 1, Math.max(1, sheet.getLastColumn())).getValues()[0];
    if (sheet.getLastColumn() == 0 || headers[0] == "") {
      headers = ["Tanggal", "Nama Seller", "Trip", "Nomor Resi", "Keterangan", "Timestamp Input"];
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    }
    
    // Validasi Awalan SPX (case-insensitive)
    var resi = (data.resi || "").toString().trim().toUpperCase();
    if (!resi.startsWith("SPX")) {
      return ContentService.createTextOutput(JSON.stringify({status: "error", message: "Hanya resi awalan SPX yang diperbolehkan"}))
        .setMimeType(ContentService.MimeType.JSON)
        .setHeader("Access-Control-Allow-Origin", "*");
    }
    
    // Validasi Resi Double (Cek di kolom Nomor Resi / Kolom 4)
    var lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      var resiValues = sheet.getRange(1, 4, lastRow, 1).getValues();
      for (var i = 0; i < resiValues.length; i++) {
        var existingResi = resiValues[i][0].toString().trim().toUpperCase();
        if (existingResi === resi) {
          return ContentService.createTextOutput(JSON.stringify({status: "error", message: "Resi sudah terdaftar (double)!"}))
            .setMimeType(ContentService.MimeType.JSON)
            .setHeader("Access-Control-Allow-Origin", "*");
        }
      }
    }
    
    // Format tanggal Indonesia (Contoh: 30 Mei 2026)
    var formattedDate = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd MMMM yyyy");
    
    // Tambah baris data baru
    var newRow = [
      formattedDate,
      data.seller || "-",
      data.trip || "-",
      data.resi || "",
      data.keterangan || "-",
      new Date()
    ];
    sheet.appendRow(newRow);
    
    return ContentService.createTextOutput(JSON.stringify({status: "success", message: "Data resi " + data.resi + " berhasil disimpan"}))
      .setMimeType(ContentService.MimeType.JSON)
      .setHeader("Access-Control-Allow-Origin", "*");
      
  } catch(error) {
    return ContentService.createTextOutput(JSON.stringify({status: "error", message: error.toString()}))
      .setMimeType(ContentService.MimeType.JSON)
      .setHeader("Access-Control-Allow-Origin", "*");
  }
}

// Tambahkan fungsi doGet agar kita bisa melakukan tes koneksi langsung dari browser
function doGet(e) {
  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheets()[0];
    var lastCol = sheet.getLastColumn();
    return ContentService.createTextOutput("✅ KONEKSI SUKSES! Spreadsheet berhasil dibuka. Jumlah kolom: " + lastCol)
      .setMimeType(ContentService.MimeType.TEXT);
  } catch(err) {
    return ContentService.createTextOutput("❌ KONEKSI GAGAL! Error: " + err.toString())
      .setMimeType(ContentService.MimeType.TEXT);
  }
}`;

  el.textContent = code;
}

function copyGasCode() {
  const code = document.getElementById('gas-code-display').textContent;
  navigator.clipboard.writeText(code).then(() => {
    const copyBtn = document.getElementById('btn-copy-gas');
    const originalText = copyBtn.innerHTML;
    copyBtn.innerHTML = `
      <svg style="width:16px;height:16px;fill:var(--text-dark)" viewBox="0 0 24 24"><path d="M21,7L9,19L3.5,13.5L4.91,12.09L9,16.17L19.59,5.59L21,7Z"/></svg>
      Tersalin!
    `;
    setTimeout(() => {
      copyBtn.innerHTML = originalText;
    }, 2000);
  }).catch(err => {
    console.error('Gagal menyalin text', err);
  });
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
