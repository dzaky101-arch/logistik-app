# Script Launcher untuk SheetBot
# Menjalankan server HTTP lokal ringan tanpa Node.js / Python

$port = 8080
$url = "http://localhost:$port/"
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($url)

Clear-Host
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "             SHEETBOT LOCAL SERVER           " -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "Membuka dashboard di browser..." -ForegroundColor Yellow

try {
    $listener.Start()
    Write-Host "Server berhasil berjalan di: $url" -ForegroundColor Green
    Write-Host "Tekan [Ctrl + C] di jendela terminal ini untuk menghentikan server.`n" -ForegroundColor Gray
    
    # Buka browser otomatis
    Start-Process $url
} catch {
    Write-Host "Gagal menjalankan server: $_" -ForegroundColor Red
    Write-Host "Pastikan port $port tidak sedang digunakan oleh aplikasi lain." -ForegroundColor Red
    Exit
}

# Loop untuk menghandle request masuk
$currentDir = Get-Location
try {
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response
        
        $path = $request.Url.LocalPath
        if ($path -eq "/") {
            $path = "/index.html"
        }
        
        $filePath = Join-Path $currentDir $path
        
        # Validasi keamanan path untuk mencegah directory traversal
        if (-not $filePath.StartsWith($currentDir.Path)) {
            $response.StatusCode = 403
            $response.Close()
            continue
        }

        if (Test-Path $filePath -PathType Leaf) {
            $bytes = [System.IO.File]::ReadAllBytes($filePath)
            $response.ContentLength64 = $bytes.Length
            
            # Tentukan Content-Type
            if ($path.EndsWith(".html")) {
                $response.ContentType = "text/html; charset=utf-8"
            } elseif ($path.EndsWith(".css")) {
                $response.ContentType = "text/css"
            } elseif ($path.EndsWith(".js")) {
                $response.ContentType = "application/javascript"
            } elseif ($path.EndsWith(".json")) {
                $response.ContentType = "application/json"
            } else {
                $response.ContentType = "application/octet-stream"
            }
            
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
            Write-Host "[200] Serving: $path" -ForegroundColor Gray
        } else {
            $response.StatusCode = 404
            $utf8 = [System.Text.Encoding]::UTF8
            $errorMsg = $utf8.GetBytes("404 - File Not Found")
            $response.ContentType = "text/plain"
            $response.ContentLength64 = $errorMsg.Length
            $response.OutputStream.Write($errorMsg, 0, $errorMsg.Length)
            Write-Host "[404] Not Found: $path" -ForegroundColor Red
        }
        $response.Close()
    }
} catch [System.Management.Automation.PipelineStoppedException] {
    # Handled Ctrl+C gracefully
} catch {
    Write-Host "Error runtime server: $_" -ForegroundColor Red
} finally {
    $listener.Stop()
    Write-Host "`nServer dihentikan." -ForegroundColor Yellow
}
