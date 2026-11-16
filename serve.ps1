$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$port = 8123
$server = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $port)
$server.Start()
Write-Host "Serving $root on http://localhost:$port"

while ($true) {
  $client = $server.AcceptTcpClient()
  try {
    $stream = $client.GetStream()
    $reader = New-Object System.IO.StreamReader($stream, [System.Text.Encoding]::ASCII, $false, 4096, $true)
    $requestLine = $reader.ReadLine()
    while ($true) {
      $line = $reader.ReadLine()
      if ($null -eq $line -or $line -eq "") { break }
    }

    $path = "/index.html"
    if ($requestLine -match '^GET (\S+)') { $path = $Matches[1] }
    $path = ($path -split '\?')[0]
    $path = [Uri]::UnescapeDataString($path)
    if ($path -eq "/") { $path = "/index.html" }

    $file = Join-Path $root $path.TrimStart("/")
    $status = "200 OK"
    if (-not (Test-Path $file -PathType Leaf)) {
      $status = "404 Not Found"
      $bytes = [System.Text.Encoding]::UTF8.GetBytes("Not found")
      $mime = "text/plain; charset=utf-8"
    } else {
      $bytes = [System.IO.File]::ReadAllBytes($file)
      switch ([System.IO.Path]::GetExtension($file).ToLower()) {
        ".html" { $mime = "text/html; charset=utf-8" }
        ".js"   { $mime = "text/javascript; charset=utf-8" }
        ".css"  { $mime = "text/css; charset=utf-8" }
        ".png"  { $mime = "image/png" }
        ".jpg"  { $mime = "image/jpeg" }
        ".svg"  { $mime = "image/svg+xml" }
        default { $mime = "application/octet-stream" }
      }
    }

    $header = "HTTP/1.1 $status`r`nContent-Type: $mime`r`nContent-Length: $($bytes.Length)`r`nCache-Control: no-store`r`nConnection: close`r`n`r`n"
    $hb = [System.Text.Encoding]::ASCII.GetBytes($header)
    $stream.Write($hb, 0, $hb.Length)
    $stream.Write($bytes, 0, $bytes.Length)
    $stream.Flush()
  } catch {
    Write-Host "Request failed: $_"
  } finally {
    $client.Close()
  }
}
