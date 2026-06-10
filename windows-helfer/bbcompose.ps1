param([string]$Url)
Add-Type -AssemblyName System.Web
Add-Type -AssemblyName System.Windows.Forms

# ===== Einmalige Konfiguration (bei Bedarf Pfad anpassen) =====
$Betterbird = "C:\Program Files\Betterbird\betterbird.exe"
if (-not (Test-Path $Betterbird)) {
    $Betterbird = "C:\Program Files (x86)\Betterbird\betterbird.exe"
}
# =============================================================

try {
    # Aufruf: bbcompose://compose?base=...&type=quote&id=...&token=...&text=1
    $uri   = [System.Uri]$Url
    $q     = [System.Web.HttpUtility]::ParseQueryString($uri.Query)
    $base  = $q["base"]
    $type  = $q["type"]
    $id    = $q["id"]
    $token = $q["token"]
    $text  = $q["text"]
    if (-not $text) { $text = "1" }

    if (-not $base -or -not $type -or -not $id) { throw "Ungueltiger Aufruf (base/type/id fehlt)." }
    if (-not (Test-Path $Betterbird)) { throw "Betterbird nicht gefunden. Pfad im Skript pruefen: $Betterbird" }

    $headers = @{ Authorization = "Bearer $token" }

    # 1) PDF herunterladen (Auth via Bearer-Header)
    $pdf = Join-Path $env:TEMP ("graupner_" + $type + "_" + $id + ".pdf")
    Invoke-WebRequest -Uri "$base/api/pdf/$type/$id" -Headers $headers -OutFile $pdf -UseBasicParsing

    # 2) Empfaenger / Betreff / Text holen
    $meta = Invoke-RestMethod -Uri "$base/api/eml-meta/$type/$id?text=$text" -Headers $headers -UseBasicParsing

    # 3) Betterbird mit Anhang oeffnen
    $arg = "to='$($meta.to)',subject='$($meta.subject)',body='$($meta.body)',attachment='$pdf'"
    & $Betterbird -compose $arg
}
catch {
    [System.Windows.Forms.MessageBox]::Show("Fehler: $($_.Exception.Message)", "Graupner bbcompose") | Out-Null
}
