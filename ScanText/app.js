// State Management
let appState = {
  selectedFile: null,
  isProcessing: false,
  extractedTextsHistory: [] // Array of { time, textSnippet, fullText }
};

// Elements
const uploadZone = document.getElementById('upload-zone');
const fileInput = document.getElementById('file-input');
const uploadPrompt = document.getElementById('upload-prompt');
const previewContainer = document.getElementById('preview-container');
const imagePreview = document.getElementById('image-preview');
const laserScanner = document.getElementById('laser-scanner');

const btnProcess = document.getElementById('btn-process');
const btnReset = document.getElementById('btn-reset');
const btnCopyText = document.getElementById('btn-copy-text');
const btnDownloadExcel = document.getElementById('btn-download-excel');

const progressCard = document.getElementById('progress-card');
const progressStatus = document.getElementById('progress-status');
const progressBarFill = document.getElementById('progress-bar-fill');
const progressPercentage = document.getElementById('progress-percentage');

const resultCard = document.getElementById('result-card');
const resultStatusIndicator = document.getElementById('result-status-indicator');
const resultStatusTitle = document.getElementById('result-status-title');
const resExtractedText = document.getElementById('res-extracted-text');

const historyTbody = document.getElementById('history-tbody');

// Tabs elements
const tabBtns = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
  initEventListeners();
});

function initEventListeners() {
  // Drag and Drop
  ['dragenter', 'dragover'].forEach(eventName => {
    uploadZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      uploadZone.classList.add('dragging');
    }, false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    uploadZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      uploadZone.classList.remove('dragging');
    }, false);
  });

  uploadZone.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    const files = dt.files;
    if (files.length > 0) {
      handleFile(files[0]);
    }
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      handleFile(e.target.files[0]);
    }
  });

  // Process Button
  btnProcess.addEventListener('click', startOcrProcess);

  // Reset Button
  btnReset.addEventListener('click', resetApp);

  // Copy Text Button
  btnCopyText.addEventListener('click', copyExtractedText);

  // Download Excel Button
  btnDownloadExcel.addEventListener('click', downloadExcel);

  // Tab Switcher Click Events
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));
      
      btn.classList.add('active');
      const targetContent = document.getElementById(btn.dataset.tab);
      if (targetContent) {
        targetContent.classList.add('active');
      }
    });
  });
}

// Handle selected file
function handleFile(file) {
  if (!file.type.startsWith('image/')) {
    alert('Harap unggah file gambar yang valid!');
    return;
  }

  appState.selectedFile = file;
  
  // Show image preview
  const reader = new FileReader();
  reader.onload = (e) => {
    imagePreview.src = e.target.result;
    uploadPrompt.classList.add('hidden');
    previewContainer.classList.remove('hidden');
    btnProcess.disabled = false;
  };
  reader.readAsDataURL(file);
}

// Preprocess the image using a hidden Canvas
// 1. Upscale by 2x if the image is low-resolution (to enlarge small text)
// 2. Grayscale conversion using luminance formula
// 3. High contrast booster (to remove noise and make characters extremely sharp)
function preprocessImage(imageElement) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  
  // Upscaling threshold for small images (e.g. mobile screenshots)
  let scale = 1.0;
  if (imageElement.naturalWidth < 1500) {
    scale = 2.0; // Upscale by 200%
  }
  
  canvas.width = imageElement.naturalWidth * scale;
  canvas.height = imageElement.naturalHeight * scale;
  
  // Draw image to scaled canvas
  ctx.drawImage(imageElement, 0, 0, canvas.width, canvas.height);
  
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imgData.data;
  
  // Apply a high contrast formula
  const contrast = 95; // Significant boost
  const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));
  
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    
    // Grayscale
    const gray = 0.299 * r + 0.587 * g + 0.114 * b;
    
    // Contrast Adjustment
    let newGray = factor * (gray - 128) + 128;
    
    // Clamp values between 0 and 255
    newGray = Math.max(0, Math.min(255, newGray));
    
    data[i] = newGray;     // Red
    data[i + 1] = newGray; // Green
    data[i + 2] = newGray; // Blue
  }
  
  ctx.putImageData(imgData, 0, 0);
  
  // Return optimized data URL
  return canvas.toDataURL('image/jpeg', 0.95);
}

// Translate Tesseract.js status to Indonesian
function getStatusMessage(status) {
  switch (status) {
    case 'loading tesseract ocr engine':
      return 'Memuat Mesin OCR (Tesseract)...';
    case 'loading language traineddata':
      return 'Mengunduh/Memuat Model Bahasa...';
    case 'initializing api':
      return 'Menginisialisasi API OCR...';
    case 'recognizing text':
      return 'Membaca dan Mengekstrak Teks Gambar...';
    default:
      return 'Sedang memproses...';
  }
}

// Start OCR Process (entirely local and client-side with preprocessing)
async function startOcrProcess() {
  if (appState.isProcessing || !appState.selectedFile) return;

  appState.isProcessing = true;
  btnProcess.disabled = true;
  
  // Trigger scanning laser effect
  previewContainer.classList.add('scanning');
  
  // Reset and show progress card
  progressCard.classList.remove('hidden');
  resultCard.classList.add('hidden');
  updateProgress('Mengoptimalkan kualitas gambar...', 2);

  const lang = document.getElementById('ocr-language').value;
  const layoutMode = parseInt(document.getElementById('ocr-layout-mode').value);

  let worker = null;

  try {
    // 1. PREPROCESS IMAGE (Upscale & Grayscale High-Contrast)
    const optimizedDataUrl = preprocessImage(imagePreview);
    updateProgress('Menyiapkan modul mesin OCR...', 8);

    // 2. INITIALIZE WORKER FOR DETAILED CONTROL
    worker = await Tesseract.createWorker(lang, 1, {
      logger: m => {
        const message = getStatusMessage(m.status);
        const percent = Math.round(m.progress * 100);
        // Map 0-100% Tesseract progress to 10-90% UI progress bar
        const adjustedPercent = 10 + Math.round(percent * 0.8);
        updateProgress(message, adjustedPercent);
      }
    });

    // 3. SET LAYOUT PARAMETERS (PSM)
    updateProgress('Mengatur format tata letak pembacaan...', 92);
    await worker.setParameters({
      tessedit_pageseg_mode: layoutMode
    });

    // 4. PERFORM RECOGNITION
    updateProgress('Memindai seluruh teks...', 95);
    const result = await worker.recognize(optimizedDataUrl);
    const extractedText = result.data.text;

    // Show Success Result
    showSuccessResult(extractedText);
    
    // Add to Session History
    addToHistory(extractedText);

  } catch (error) {
    console.error("OCR Error:", error);
    showErrorResult(error.message);
  } finally {
    if (worker) {
      await worker.terminate();
    }
    appState.isProcessing = false;
    previewContainer.classList.remove('scanning');
    progressCard.classList.add('hidden');
  }
}

// Update progress bar
function updateProgress(message, percent) {
  progressStatus.textContent = message;
  progressBarFill.style.width = `${percent}%`;
  progressPercentage.textContent = `${percent}%`;
}

// Display success UI
function showSuccessResult(rawText) {
  resultCard.classList.remove('hidden');
  
  // Switch to Raw Text tab on success
  switchTab('tab-raw');

  // Status Header
  resultStatusIndicator.className = 'status-indicator success';
  resultStatusTitle.textContent = 'Teks Berhasil Diekstrak!';
  
  // Set value in text box
  const cleanedText = rawText.trim();
  resExtractedText.value = cleanedText ? cleanedText : "(Gambar tidak berisi teks yang terbaca)";
  
  // Render table grid preview
  renderTablePreview(cleanedText);
}

// Display error UI
function showErrorResult(errorMessage) {
  resultCard.classList.remove('hidden');
  switchTab('tab-raw');
  
  // Status Header
  resultStatusIndicator.className = 'status-indicator error';
  resultStatusTitle.textContent = 'Gagal Mengekstrak Teks';
  
  // Values
  resExtractedText.value = `Gagal memproses gambar.\nError: ${errorMessage}`;
  document.getElementById('preview-grid-table').innerHTML = '';
}

// Helper to switch tabs programmatically
function switchTab(tabId) {
  tabBtns.forEach(b => b.classList.remove('active'));
  tabContents.forEach(c => c.classList.remove('active'));
  
  const activeBtn = document.querySelector(`.tab-btn[data-tab="${tabId}"]`);
  if (activeBtn) activeBtn.classList.add('active');
  
  const activeContent = document.getElementById(tabId);
  if (activeContent) activeContent.classList.add('active');
}

// Parse text lines into columns for grid representation
// Splits by table separators | or tabs or 2+ spaces
function parseTextToGrid(text) {
  if (!text || text === "(Gambar tidak berisi teks yang terbaca)") return [];

  const lines = text.split('\n');
  const grid = [];

  lines.forEach(line => {
    const trimmed = line.trim();
    if (!trimmed) return;

    // Split columns by vertical dividers (with optional space), tabs, or multiple spaces
    let columns = trimmed.split(/\s*\|\s*|\t| {2,}/);

    // Clean columns and remove trailing/leading spaces
    columns = columns.map(col => col.trim()).filter(col => col !== "");

    if (columns.length > 0) {
      grid.push(columns);
    }
  });

  return grid;
}

// Render dynamic table preview in html
function renderTablePreview(text) {
  const grid = parseTextToGrid(text);
  const table = document.getElementById('preview-grid-table');
  table.innerHTML = '';

  if (grid.length === 0) {
    table.innerHTML = `<tr><td style="text-align: center; color: var(--text-muted); padding: 20px;">Tidak ada data terstruktur untuk pratinjau tabel.</td></tr>`;
    return;
  }

  grid.forEach(row => {
    const tr = document.createElement('tr');
    row.forEach(col => {
      const td = document.createElement('td');
      td.textContent = col;
      tr.appendChild(td);
    });
    table.appendChild(tr);
  });
}

// Convert extracted text table into CSV and download as Excel file
function downloadExcel() {
  const rawText = resExtractedText.value;
  if (!rawText || rawText.startsWith("Gagal memproses gambar") || rawText === "(Gambar tidak berisi teks yang terbaca)") return;

  const grid = parseTextToGrid(rawText);
  if (grid.length === 0) {
    alert("Tidak ada data terstruktur yang dapat diekspor ke Excel.");
    return;
  }

  // Prepend sep=; so Excel automatically splits columns by semicolon without import wizard
  let csvContent = "sep=;\r\n";

  grid.forEach(row => {
    const rowStr = row.map(col => {
      // Escape double quotes inside cell values
      const escaped = col.replace(/"/g, '""');
      return `"${escaped}"`;
    }).join(';');
    csvContent += rowStr + "\r\n";
  });

  // Create UTF-8 BOM, blob, and trigger download
  const BOM = new Uint8Array([0xEF, 0xBB, 0xBF]); // Ensures Excel opens UTF-8 characters correctly
  const blob = new Blob([BOM, csvContent], { type: 'text/csv;charset=utf-8;' });
  
  const link = document.createElement("a");
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const timeStr = new Date().toTimeString().slice(0, 8).replace(/:/g, "");
  
  link.setAttribute("href", URL.createObjectURL(blob));
  link.setAttribute("download", `ScanTeks_Excel_${dateStr}_${timeStr}.csv`);
  document.body.appendChild(link);
  
  link.click();
  document.body.removeChild(link);
}

// Copy Extracted Text to Clipboard
function copyExtractedText() {
  const textVal = resExtractedText.value;
  if (!textVal || textVal.startsWith("Gagal memproses gambar") || textVal === "(Gambar tidak berisi teks yang terbaca)") return;

  navigator.clipboard.writeText(textVal).then(() => {
    // Show visual feedback on button
    const copySpan = btnCopyText.querySelector('span');
    const originalText = copySpan.textContent;
    copySpan.textContent = 'Teks Tersalin!';
    
    const copySvg = btnCopyText.querySelector('svg');
    const originalSvg = copySvg.innerHTML;
    copySvg.innerHTML = `<path d="M21,7L9,19L3.5,13.5L4.91,12.09L9,16.17L19.59,5.59L21,7Z"/>`;
    
    btnCopyText.style.background = 'var(--success)';
    btnCopyText.style.boxShadow = '0 4px 15px var(--success-glow)';

    setTimeout(() => {
      copySpan.textContent = originalText;
      copySvg.innerHTML = originalSvg;
      btnCopyText.style.background = '';
      btnCopyText.style.boxShadow = '';
    }, 2000);
  }).catch(err => {
    console.error('Gagal menyalin text', err);
  });
}

// Add to Session History Table
function addToHistory(fullText) {
  const trimmed = fullText.trim();
  if (!trimmed || trimmed === "(Gambar tidak berisi teks yang terbaca)") return;

  const now = new Date();
  const timeStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  
  // Create a 60 character snippet for display
  let snippet = trimmed.replace(/\s+/g, ' ');
  if (snippet.length > 60) {
    snippet = snippet.substring(0, 60) + '...';
  }

  // Check if same text is already in history, if so, move to top
  const existingIdx = appState.extractedTextsHistory.findIndex(h => h.fullText === trimmed);
  if (existingIdx !== -1) {
    appState.extractedTextsHistory.splice(existingIdx, 1);
  }
  
  appState.extractedTextsHistory.unshift({
    time: timeStr,
    textSnippet: snippet,
    fullText: trimmed
  });
  
  renderHistoryTable();
}

// Copy a specific text from history list
function copyHistoryText(index) {
  const item = appState.extractedTextsHistory[index];
  if (!item) return;

  navigator.clipboard.writeText(item.fullText).then(() => {
    // Provide a small feedback alert/popup
    const btn = document.getElementById(`btn-hist-copy-${index}`);
    if (btn) {
      const originalHtml = btn.innerHTML;
      btn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M21,7L9,19L3.5,13.5L4.91,12.09L9,16.17L19.59,5.59L21,7Z"/></svg> Tersalin`;
      btn.style.color = 'var(--success)';
      btn.style.borderColor = 'var(--success)';
      
      setTimeout(() => {
        btn.innerHTML = originalHtml;
        btn.style.color = '';
        btn.style.borderColor = '';
      }, 1500);
    }
  }).catch(err => {
    console.error('Gagal menyalin teks dari riwayat', err);
  });
}

// Render history table rows
function renderHistoryTable() {
  if (appState.extractedTextsHistory.length === 0) {
    historyTbody.innerHTML = `<tr><td colspan="3" class="table-empty">Belum ada teks yang diekstrak pada sesi ini.</td></tr>`;
    return;
  }
  
  historyTbody.innerHTML = '';
  appState.extractedTextsHistory.forEach((item, index) => {
    const tr = document.createElement('tr');
    
    tr.innerHTML = `
      <td>${item.time}</td>
      <td style="font-weight: 400; color: #a5b4fc; font-family: var(--font-mono); font-size: 0.82rem; word-break: break-all;">${escapeHtml(item.textSnippet)}</td>
      <td class="history-actions">
        <button class="btn-table" id="btn-hist-copy-${index}" onclick="copyHistoryText(${index})">
          <svg viewBox="0 0 24 24"><path d="M19,21H8V7H19M19,5H8A2,2 0 0,0 6,7V21A2,2 0 0,0 8,23H19A2,2 0 0,0 21,21V7A2,2 0 0,0 19,5M16,1H4A2,2 0 0,0 2,3V17H4V3H16V1Z"/></svg>
          Salin
        </button>
      </td>
    `;
    historyTbody.appendChild(tr);
  });
}

// Reset App State to Scan Another
function resetApp() {
  appState.selectedFile = null;
  fileInput.value = '';
  
  // UI reset
  uploadPrompt.classList.remove('hidden');
  previewContainer.classList.add('hidden');
  imagePreview.src = '';
  
  btnProcess.disabled = true;
  resultCard.classList.add('hidden');
  progressCard.classList.add('hidden');
}

// Helper to escape HTML tags
function escapeHtml(text) {
  if (typeof text !== 'string') return text;
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
