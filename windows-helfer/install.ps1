# Graupner Suite - bbcompose Installer
# Richtet den Betterbird-Helfer pro Benutzer ein (KEINE Admin-Rechte noetig).
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Windows.Forms

function Show-Msg($msg, $icon = "Information") {
    [System.Windows.Forms.MessageBox]::Show($msg, "Graupner bbcompose", 'OK', $icon) | Out-Null
}

try {
    $src = Join-Path $PSScriptRoot "bbcompose.ps1"
    if (-not (Test-Path $src)) { throw "bbcompose.ps1 wurde nicht im selben Ordner gefunden." }

    # 1) Betterbird-Pfad automatisch suchen
    $candidates = @(
        (Join-Path $env:ProgramFiles "Betterbird\betterbird.exe"),
        (Join-Path ${env:ProgramFiles(x86)} "Betterbird\betterbird.exe"),
        (Join-Path $env:LOCALAPPDATA "Betterbird\betterbird.exe")
    )
    $bb = $null
    foreach ($c in $candidates) { if ($c -and (Test-Path $c)) { $bb = $c; break } }
    if (-not $bb) {
        foreach ($root in @("HKLM:", "HKCU:")) {
            $key = "$root\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\betterbird.exe"
            if (Test-Path $key) {
                $p = (Get-ItemProperty -Path $key).'(default)'
                if ($p -and (Test-Path $p)) { $bb = $p; break }
            }
        }
    }
    if (-not $bb) {
        $cmd = Get-Command betterbird.exe -ErrorAction SilentlyContinue
        if ($cmd) { $bb = $cmd.Source }
    }

    # 2) Zielordner anlegen und Skript kopieren (gefundenen Pfad fest eintragen)
    $dir = "C:\Graupner"
    if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
    $dest = Join-Path $dir "bbcompose.ps1"
    $content = Get-Content -Path $src -Raw
    if ($bb) {
        $escaped = $bb.Replace('\', '\\')
        $content = $content -replace '(?m)^\$Betterbird\s*=.*$', ('$Betterbird = "' + $escaped + '"')
    }
    Set-Content -Path $dest -Value $content -Encoding UTF8

    # 3) Protokoll bbcompose:// pro Benutzer registrieren (kein Admin noetig)
    $base = "HKCU:\Software\Classes\bbcompose"
    New-Item -Path $base -Force | Out-Null
    Set-ItemProperty -Path $base -Name "(default)" -Value "URL:Graupner Betterbird Compose"
    Set-ItemProperty -Path $base -Name "URL Protocol" -Value ""
    $cmdKey = "$base\shell\open\command"
    New-Item -Path $cmdKey -Force | Out-Null
    $cmdVal = 'powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "C:\Graupner\bbcompose.ps1" "%1"'
    Set-ItemProperty -Path $cmdKey -Name "(default)" -Value $cmdVal

    # 4) Erfolgsmeldung
    if ($bb) {
        $bbInfo = "Betterbird gefunden:`n$bb"
    } else {
        $bbInfo = "Betterbird wurde NICHT automatisch gefunden.`nBitte C:\Graupner\bbcompose.ps1 oeffnen und den Pfad bei `$Betterbird eintragen."
    }
    Show-Msg ("Einrichtung erfolgreich!`n`n" +
              "Skript:    C:\Graupner\bbcompose.ps1`n" +
              "Protokoll: bbcompose:// registriert (fuer diesen Benutzer)`n`n" +
              "$bbInfo`n`n" +
              "Du kannst jetzt in der Graupner Suite 'Betterbird direkt' nutzen.")
}
catch {
    Show-Msg ("Fehler bei der Einrichtung:`n$($_.Exception.Message)") "Error"
}
