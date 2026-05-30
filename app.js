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

  // Bind Mode Selector Toggles
  const btnModeSingle = document.getElementById('btn-mode-single');
  const btnModeMulti = document.getElementById('btn-mode-multi');
  const multiInputContainer = document.getElementById('multi-input-container');

  btnModeSingle.addEventListener('click', () => {
    btnModeSingle.classList.add('active');
    btnModeMulti.classList.remove('active');
    scanForm.style.display = 'block';
    multiInputContainer.style.display = 'none';
    scanInput.focus();
  });

  btnModeMulti.addEventListener('click', () => {
    btnModeSingle.classList.remove('active');
    btnModeMulti.classList.add('active');
    scanForm.style.display = 'none';
    multiInputContainer.style.display = 'flex';
    stopCameraScanner();
    document.getElementById('textarea-multi-scan').focus();
  });

  // Bind Camera Buttons
  document.getElementById('btn-toggle-camera').addEventListener('click', toggleCamera);
  document.getElementById('btn-close-camera').addEventListener('click', stopCameraScanner);
  document.getElementById('btn-switch-camera').addEventListener('click', switchCamera);

  // Bind Multi Submit
  document.getElementById('btn-submit-multi').addEventListener('click', handleMultiSubmit);

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

  // Bind QR Modal Close & Carousel handlers
  const qrModal = document.getElementById('qr-modal');
  const closeBtn1 = document.getElementById('btn-close-qr-modal');
  const closeBtn2 = document.getElementById('btn-close-qr-modal-btn');
  
  const closeQR = () => {
    stopQrAutoPlay();
    qrModal.style.display = 'none';
  };
  
  closeBtn1.addEventListener('click', closeQR);
  closeBtn2.addEventListener('click', closeQR);
  
  qrModal.addEventListener('click', (e) => {
    if (e.target === qrModal) {
      closeQR();
    }
  });

  document.getElementById('btn-qr-prev').addEventListener('click', () => {
    stopQrAutoPlay();
    qrSlider.currentIndex--;
    updateQrModalView();
  });

  document.getElementById('btn-qr-next').addEventListener('click', () => {
    stopQrAutoPlay();
    qrSlider.currentIndex++;
    updateQrModalView();
  });

  const btnQrPlay = document.getElementById('btn-qr-play');
  btnQrPlay.addEventListener('click', () => {
    if (qrSlider.isPlaying) {
      stopQrAutoPlay();
    } else {
      startQrAutoPlay();
    }
  });

  document.getElementById('select-qr-speed').addEventListener('change', (e) => {
    qrSlider.speed = parseInt(e.target.value);
    if (qrSlider.isPlaying) {
      stopQrAutoPlay();
      startQrAutoPlay();
    }
  });

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

    const qrButton = `<button class="btn-copy" onclick="showQrModal('${escapeHtml(item.resi)}')" style="display:inline-flex; align-items:center; padding: 2px 6px; font-size: 0.75rem; gap: 4px; border-radius: 4px; border:1px solid rgba(255,159,26,0.3); background: rgba(255,159,26,0.05); color: var(--primary); outline:none; transition:var(--transition); margin-left:8px;" title="Tampilkan QR Code">
      <svg style="width:12px; height:12px; fill:currentColor;" viewBox="0 0 24 24"><path d="M4,4H10V10H4V4M20,4H14V10H20V4M14,14H20V20H14V14M4,14H10V20H4V14M6,6V8H8V6H6M16,6V8H18V6H16M16,16V18H18V16H16M6,16V18H8V16H6M7.5,7.5H6.5V6.5H7.5V7.5M17.5,7.5H16.5V6.5H17.5V7.5M17.5,17.5H16.5V16.5H17.5V17.5M6.5,17.5H7.5V16.5H6.5V17.5Z"/></svg>
      QR
    </button>`;

    tr.innerHTML = `
      <td>${item.timestamp}</td>
      <td class="resi-cell" style="display:flex; align-items:center;">
        <span>${escapeHtml(item.resi)}</span>
        ${qrButton}
      </td>
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

// ========================================================
// CAMERA SCANNER STATE & LOGIC
// ========================================================
let html5QrCodeInstance = null;
let camerasList = [];
let activeCameraId = null;
let lastCameraScannedCode = '';
let lastCameraScannedTime = 0;

function toggleCamera() {
  const container = document.getElementById('camera-scanner-container');
  if (container.style.display === 'none' || container.style.display === '') {
    container.style.display = 'flex';
    document.getElementById('btn-toggle-camera').innerHTML = `
      <svg style="width:18px;height:18px;fill:currentColor" viewBox="0 0 24 24"><path d="M12,2A10,10 0 1,0 22,12A10,10 0 0,0 12,2M12,4A8,8 0 1,1 4,12A8,8 0 0,1 12,4M12,6A6,6 0 1,0 18,12A6,6 0 0,0 12,6M12,8A4,4 0 1,1 8,12A4,4 0 0,1 12,8Z"/></svg>
      Matikan Kamera
    `;
    
    if (typeof Html5Qrcode === 'undefined') {
      showStatus("Error: Pustaka scan kamera belum terisi. Coba reload halaman.", "error");
      return;
    }
    
    Html5Qrcode.getCameras().then(devices => {
      if (devices && devices.length > 0) {
        camerasList = devices;
        const backCam = devices.find(d => d.label.toLowerCase().includes('back') || d.label.toLowerCase().includes('rear') || d.label.toLowerCase().includes('environment') || d.label.toLowerCase().includes('belakang'));
        activeCameraId = backCam ? backCam.id : devices[0].id;
        startCameraScanner(activeCameraId);
      } else {
        showStatus("Kamera tidak ditemukan pada perangkat ini.", "error");
        hideCameraContainer();
      }
    }).catch(err => {
      console.error(err);
      showStatus("Izin kamera ditolak atau gagal diakses.", "error");
      hideCameraContainer();
    });
  } else {
    stopCameraScanner();
  }
}

function startCameraScanner(cameraId) {
  if (html5QrCodeInstance) {
    html5QrCodeInstance.stop().then(() => {
      initiateCamera(cameraId);
    }).catch(err => {
      console.error(err);
      initiateCamera(cameraId);
    });
  } else {
    initiateCamera(cameraId);
  }
}

function initiateCamera(cameraId) {
  html5QrCodeInstance = new Html5Qrcode("camera-reader");
  
  const formats = [
    Html5QrcodeSupportedFormats.CODE_128,
    Html5QrcodeSupportedFormats.CODE_39,
    Html5QrcodeSupportedFormats.EAN_8,
    Html5QrcodeSupportedFormats.EAN_13,
    Html5QrcodeSupportedFormats.QR_CODE
  ];

  const config = {
    fps: 15,
    qrbox: (width, height) => {
      const boxWidth = Math.min(width * 0.85, 320);
      const boxHeight = 130;
      return { width: boxWidth, height: boxHeight };
    },
    aspectRatio: 1.0
  };

  html5QrCodeInstance.start(
    cameraId,
    config,
    (decodedText) => {
      const cleanCode = decodedText.trim();
      if (!cleanCode) return;

      const now = Date.now();
      if (cleanCode === lastCameraScannedCode && (now - lastCameraScannedTime) < 2500) {
        return; 
      }

      lastCameraScannedCode = cleanCode;
      lastCameraScannedTime = now;

      handleCameraScanResult(cleanCode);
    },
    (err) => {
      // Silent frame scanning errors
    }
  ).catch(err => {
    console.error("Gagal start html5QrCode:", err);
    showStatus("Kamera gagal diaktifkan. Silakan coba kamera lainnya.", "error");
  });
}

function switchCamera() {
  if (camerasList.length <= 1) {
    showStatus("Hanya terdeteksi 1 kamera di HP Anda.", "error");
    return;
  }
  const curIdx = camerasList.findIndex(d => d.id === activeCameraId);
  const nextIdx = (curIdx + 1) % camerasList.length;
  activeCameraId = camerasList[nextIdx].id;
  startCameraScanner(activeCameraId);
}

function stopCameraScanner() {
  if (html5QrCodeInstance) {
    html5QrCodeInstance.stop().then(() => {
      html5QrCodeInstance = null;
      hideCameraContainer();
    }).catch(err => {
      console.error(err);
      html5QrCodeInstance = null;
      hideCameraContainer();
    });
  } else {
    hideCameraContainer();
  }
}

function hideCameraContainer() {
  document.getElementById('camera-scanner-container').style.display = 'none';
  document.getElementById('btn-toggle-camera').innerHTML = `
    <svg style="width:18px;height:18px;fill:var(--text-dark);" viewBox="0 0 24 24"><path d="M4,4H7L9,2H15L17,4H20A2,2 0 0,1 22,6V18A2,2 0 0,1 20,20H4A2,2 0 0,1 2,18V6A2,2 0 0,1 4,4M12,7A5,5 0 0,0 7,12A5,5 0 0,0 12,17A5,5 0 0,0 17,12A5,5 0 0,0 12,7M12,9A3,3 0 0,1 15,12A3,3 0 0,1 12,15A3,3 0 0,1 9,12A3,3 0 0,1 12,9Z"/></svg>
    Scan Pakai Kamera HP
  `;
}

async function handleCameraScanResult(resi) {
  const scanInput = document.getElementById('input-scan');
  scanInput.value = resi;

  const gasUrl = scannerState.config.gasUrl.trim();
  const seller = document.getElementById('select-seller').value;
  const trip = document.getElementById('select-trip').value;
  const keterangan = document.getElementById('select-keterangan').value;

  if (!gasUrl) {
    playSound('error');
    showStatus('Error: URL Google Apps Script Web App wajib diisi di tab pengaturan!', 'error');
    return;
  }

  if (!resi.toUpperCase().startsWith('SPX')) {
    playSound('error');
    showStatus(`Gagal: Hanya resi dengan awalan SPX yang diperbolehkan! (${resi})`, 'error');
    const container = document.getElementById('scan-box');
    container.classList.remove('flash-success');
    container.classList.add('flash-error');
    return;
  }

  const isAlreadyScanned = scannerState.history.some(h => h.resi.toUpperCase() === resi.toUpperCase() && h.status === 'success');
  if (isAlreadyScanned) {
    playSound('error');
    showStatus(`Gagal: Resi ${resi} sudah di-scan di sesi ini (double)!`, 'error');
    const container = document.getElementById('scan-box');
    container.classList.remove('flash-success');
    container.classList.add('flash-error');
    return;
  }

  const container = document.getElementById('scan-box');
  container.classList.remove('flash-success', 'flash-error');

  const scanId = 'scan_' + Date.now();
  const timestamp = new Date().toLocaleTimeString('id-ID');
  
  scannerState.history.unshift({
    id: scanId,
    timestamp: timestamp,
    resi: resi,
    seller: seller,
    status: 'pending'
  });
  renderHistoryTable();

  try {
    const response = await fetch(gasUrl, {
      method: 'POST',
      mode: 'cors',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      },
      body: JSON.stringify({ resi, seller, trip, keterangan })
    });

    const result = await response.json();
    if (result.status === 'success') {
      playSound('success');
      updateHistoryItemStatus(scanId, 'success');
      container.classList.add('flash-success');
      scannerState.totalScanned++;
      document.getElementById('counter-total').textContent = scannerState.totalScanned;
      showStatus(`Resi ${resi} berhasil disimpan`, 'success');
    } else {
      playSound('error');
      updateHistoryItemStatus(scanId, 'error');
      container.classList.add('flash-error');
      showStatus(`Gagal menyimpan resi: ${result.message}`, 'error');
    }
  } catch (error) {
    playSound('error');
    updateHistoryItemStatus(scanId, 'error');
    container.classList.add('flash-error');
    showStatus('Koneksi Gagal. Pastikan Deployment URL benar.', 'error');
  }
}

// ========================================================
// MULTI INPUT RESI LOGIC
// ========================================================
async function handleMultiSubmit() {
  const textarea = document.getElementById('textarea-multi-scan');
  const val = textarea.value.trim();
  if (!val) return;

  const rawResis = val.split(/[\n, ]+/).map(r => r.trim()).filter(Boolean);
  if (rawResis.length === 0) return;

  const btnSubmit = document.getElementById('btn-submit-multi');
  const originalText = btnSubmit.innerHTML;
  btnSubmit.disabled = true;
  btnSubmit.innerHTML = `<div class="spinner" style="width:16px;height:16px;border-width:2px;color:var(--text-dark);margin:0;display:inline-block;vertical-align:middle;"></div> Memproses...`;

  showStatus(`Memulai pemrosesan ${rawResis.length} resi...`, 'info');
  textarea.value = '';

  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < rawResis.length; i++) {
    const resi = rawResis[i];
    const seller = document.getElementById('select-seller').value;
    const trip = document.getElementById('select-trip').value;
    const keterangan = document.getElementById('select-keterangan').value;
    
    showStatus(`Memproses resi ${i+1}/${rawResis.length}: ${resi}`, 'info');

    if (!resi.toUpperCase().startsWith('SPX')) {
      errorCount++;
      const timestamp = new Date().toLocaleTimeString('id-ID');
      const scanId = 'scan_' + Date.now();
      scannerState.history.unshift({
        id: scanId,
        timestamp: timestamp,
        resi: resi,
        seller: seller,
        status: 'error'
      });
      renderHistoryTable();
      playSound('error');
      continue;
    }

    const isAlreadyScanned = scannerState.history.some(h => h.resi.toUpperCase() === resi.toUpperCase() && h.status === 'success');
    if (isAlreadyScanned) {
      errorCount++;
      const timestamp = new Date().toLocaleTimeString('id-ID');
      const scanId = 'scan_' + Date.now();
      scannerState.history.unshift({
        id: scanId,
        timestamp: timestamp,
        resi: resi,
        seller: seller,
        status: 'error'
      });
      renderHistoryTable();
      playSound('error');
      continue;
    }

    const scanId = 'scan_' + Date.now();
    const timestamp = new Date().toLocaleTimeString('id-ID');
    scannerState.history.unshift({
      id: scanId,
      timestamp: timestamp,
      resi: resi,
      seller: seller,
      status: 'pending'
    });
    renderHistoryTable();

    try {
      const gasUrl = scannerState.config.gasUrl.trim();
      if (!gasUrl) throw new Error("URL GAS Kosong");

      const response = await fetch(gasUrl, {
        method: 'POST',
        mode: 'cors',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8'
        },
        body: JSON.stringify({ resi, seller, trip, keterangan })
      });

      const result = await response.json();
      if (result.status === 'success') {
        successCount++;
        playSound('success');
        updateHistoryItemStatus(scanId, 'success');
        scannerState.totalScanned++;
        document.getElementById('counter-total').textContent = scannerState.totalScanned;
      } else {
        errorCount++;
        playSound('error');
        updateHistoryItemStatus(scanId, 'error');
      }
    } catch (err) {
      errorCount++;
      playSound('error');
      updateHistoryItemStatus(scanId, 'error');
    }

    await new Promise(resolve => setTimeout(resolve, 150));
  }

  btnSubmit.disabled = false;
  btnSubmit.innerHTML = originalText;
  
  if (errorCount === 0) {
    showStatus(`Sukses menyimpan semua resi (${successCount} paket)!`, 'success');
  } else {
    showStatus(`Pemrosesan selesai. Sukses: ${successCount}, Gagal/Double/Bukan SPX: ${errorCount}`, 'error');
  }
}

// ========================================================
// QR CODE SLIDER STATE & LOGIC
// ========================================================
let qrSlider = {
  intervalId: null,
  currentIndex: 0,
  speed: 3000,
  isPlaying: false
};

window.showQrModal = function(resi) {
  const modal = document.getElementById('qr-modal');
  stopQrAutoPlay();
  
  // Ambil data riwayat yang berhasil atau gagal (kecuali pending)
  const history = scannerState.history.filter(h => h.status !== 'pending');
  const index = history.findIndex(h => h.resi === resi);
  qrSlider.currentIndex = index !== -1 ? index : 0;
  
  updateQrModalView();
  modal.style.display = 'flex';
};

function updateQrModalView() {
  const history = scannerState.history.filter(h => h.status !== 'pending');
  if (history.length === 0) {
    document.getElementById('qr-modal-resi').textContent = "Tidak ada resi";
    document.getElementById('qr-modal-img').src = "";
    document.getElementById('qr-modal-counter').textContent = "Resi 0 dari 0";
    return;
  }
  
  // Pastikan indeks dalam batas riwayat
  if (qrSlider.currentIndex >= history.length) {
    qrSlider.currentIndex = 0;
  }
  if (qrSlider.currentIndex < 0) {
    qrSlider.currentIndex = history.length - 1;
  }
  
  const item = history[qrSlider.currentIndex];
  document.getElementById('qr-modal-resi').textContent = item.resi;
  document.getElementById('qr-modal-img').src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(item.resi)}`;
  document.getElementById('qr-modal-counter').textContent = `Resi ${qrSlider.currentIndex + 1} dari ${history.length}`;
}

function startQrAutoPlay() {
  qrSlider.isPlaying = true;
  const btnPlay = document.getElementById('btn-qr-play');
  btnPlay.innerHTML = `
    <svg style="width:14px; height:14px; fill:#fff;" viewBox="0 0 24 24"><path d="M14,19H18V5H14M6,19H10V5H6V19Z"/></svg>
    Pause Auto
  `;
  btnPlay.style.background = 'var(--danger)';
  btnPlay.style.color = '#fff';

  qrSlider.intervalId = setInterval(() => {
    qrSlider.currentIndex++;
    updateQrModalView();
  }, qrSlider.speed);
}

function stopQrAutoPlay() {
  qrSlider.isPlaying = false;
  if (qrSlider.intervalId) {
    clearInterval(qrSlider.intervalId);
    qrSlider.intervalId = null;
  }
  const btnPlay = document.getElementById('btn-qr-play');
  btnPlay.innerHTML = `
    <svg style="width:14px; height:14px; fill:var(--text-dark);" viewBox="0 0 24 24"><path d="M8,5.14V19.14L19,12.14L8,5.14Z"/></svg>
    Auto Play
  `;
  btnPlay.style.background = '';
  btnPlay.style.color = '';
}

