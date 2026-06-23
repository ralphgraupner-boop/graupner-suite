@echo off
powershell -NoProfile -ExecutionPolicy Bypass -Command "iex ((Get-Content -LiteralPath '%~f0' -Encoding UTF8 | Select-Object -Skip 3) -join [char]10)"
exit /b
# ======================================================================
# Graupner Suite - Betterbird-Helfer (alles in EINER Datei)
# Richtet pro Benutzer ein (KEINE Admin-Rechte noetig).
# Schreibt C:\Graupner\bbcompose.ps1 und registriert das Protokoll bbcompose://
# ======================================================================
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Windows.Forms

# ----- Eingebettetes bbcompose-Skript (wird nach C:\Graupner geschrieben) -----
$bbScript = @'
param([string]$Url)
Add-Type -AssemblyName System.Web
Add-Type -AssemblyName System.Windows.Forms

$Betterbird = "C:\Program Files\Betterbird\betterbird.exe"
if (-not (Test-Path $Betterbird)) {
    $Betterbird = "C:\Program Files (x86)\Betterbird\betterbird.exe"
}

$ShowDiagnose = $false

function Get-Params([string]$url) {
    $h = @{}
    $i = $url.IndexOf("?")
    if ($i -lt 0) { return $h }
    foreach ($pair in $url.Substring($i + 1).Split("&")) {
        $kv = $pair.Split("=", 2)
        if ($kv.Length -eq 2 -and $kv[0]) { $h[$kv[0]] = [System.Uri]::UnescapeDataString($kv[1]) }
    }
    return $h
}

try {
    $p     = Get-Params $Url
    $base  = $p["base"]
    $type  = $p["type"]
    $id    = $p["id"]
    $token = $p["token"]
    $text  = $p["text"]
    if (-not $text) { $text = "1" }
    if (-not $base -or -not $type -or -not $id) { throw "Ungueltiger Aufruf (base/type/id fehlt)." }
    if (-not (Test-Path $Betterbird)) { throw "Betterbird nicht gefunden. Pfad pruefen: $Betterbird" }

    $pdfUrl  = "${base}/api/pdf/${type}/${id}"
    $metaUrl = "${base}/api/eml-meta/${type}/${id}?text=${text}"

    if ($ShowDiagnose) {
        [System.Windows.Forms.MessageBox]::Show("PDF: $pdfUrl`nMeta: $metaUrl", "Graupner bbcompose - Diagnose") | Out-Null
    }

    $headers = @{ Authorization = "Bearer $token" }
    $pdf = Join-Path $env:TEMP ("graupner_" + $type + "_" + $id + ".pdf")
    Invoke-WebRequest -Uri $pdfUrl -Headers $headers -OutFile $pdf -UseBasicParsing
    $metaResp = Invoke-WebRequest -Uri $metaUrl -Headers $headers -UseBasicParsing
    $metaJson = [System.Text.Encoding]::UTF8.GetString($metaResp.RawContentStream.ToArray())
    $meta = $metaJson | ConvertFrom-Json
    $arg = "to='$($meta.to)',subject='$($meta.subject)',body='$($meta.body)',attachment='$pdf'"
    & $Betterbird -compose $arg
}
catch {
    [System.Windows.Forms.MessageBox]::Show("Fehler: $($_.Exception.Message)", "Graupner bbcompose") | Out-Null
}
'@

function Show-Msg($msg, $icon = "Information") {
    [System.Windows.Forms.MessageBox]::Show($msg, "Graupner bbcompose", 'OK', $icon) | Out-Null
}

try {
    # 1) Betterbird-Pfad automatisch suchen
    $candidates = @(
        (Join-Path $env:ProgramFiles "Betterbird\betterbird.exe"),
        (Join-Path ${env:ProgramFiles(x86)} "Betterbird\betterbird.exe"),
        (Join-Path $env:LOCALAPPDATA "Betterbird\betterbird.exe")
    )
    $bb = $null
    foreach ($c in $candidates) { if ($c -and (Test-Path $c)) { $bb = $c; break } }
    if (-not $bb) {
        $cmd = Get-Command betterbird.exe -ErrorAction SilentlyContinue
        if ($cmd) { $bb = $cmd.Source }
    }

    # 2) Zielordner anlegen und Skript schreiben (gefundenen Pfad eintragen)
    $dir = "C:\Graupner"
    if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
    $dest = Join-Path $dir "bbcompose.ps1"
    $content = $bbScript
    if ($bb) {
        $escaped = $bb.Replace('\', '\\')
        $content = $content -replace '(?m)^\$Betterbird\s*=.*$', ('$Betterbird = "' + $escaped + '"')
    }
    Set-Content -Path $dest -Value $content -Encoding UTF8

    # 3) Protokoll bbcompose:// pro Benutzer registrieren (kein Admin noetig)
    $regbase = "HKCU:\Software\Classes\bbcompose"
    New-Item -Path $regbase -Force | Out-Null
    Set-ItemProperty -Path $regbase -Name "(default)" -Value "URL:Graupner Betterbird Compose"
    Set-ItemProperty -Path $regbase -Name "URL Protocol" -Value ""
    $cmdKey = "$regbase\shell\open\command"
    New-Item -Path $cmdKey -Force | Out-Null
    $cmdVal = 'powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "C:\Graupner\bbcompose.ps1" "%1"'
    Set-ItemProperty -Path $cmdKey -Name "(default)" -Value $cmdVal

    # 4) Erfolgsmeldung
    if ($bb) { $bbInfo = "Betterbird gefunden: $bb" }
    else { $bbInfo = "Betterbird wurde NICHT automatisch gefunden. Bitte C:\Graupner\bbcompose.ps1 oeffnen und den Pfad eintragen." }
    Show-Msg ("Einrichtung erfolgreich. Skript: C:\Graupner\bbcompose.ps1 . Protokoll bbcompose registriert. " + $bbInfo + " Sie koennen jetzt in der Graupner Suite Betterbird direkt nutzen.")
}
catch {
    Show-Msg ("Fehler bei der Einrichtung: " + $_.Exception.Message) "Error"
}
