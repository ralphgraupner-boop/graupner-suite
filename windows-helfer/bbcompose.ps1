param([string]$Url)
Add-Type -AssemblyName System.Web
Add-Type -AssemblyName System.Windows.Forms

# ===== Einmalige Konfiguration (bei Bedarf Pfad anpassen) =====
$Betterbird = "C:\Program Files\Betterbird\betterbird.exe"
if (-not (Test-Path $Betterbird)) {
    $Betterbird = "C:\Program Files (x86)\Betterbird\betterbird.exe"
}
# =============================================================

$ShowDiagnose = $true   # zeigt einmalig die aufgerufene URL an (auf $false setzen, wenn nicht mehr noetig)

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
    # Aufruf: bbcompose://compose?base=...&type=quote&id=...&token=...&text=1
    # Parameter per Regex auslesen (robust auch fuer das eigene Schema bbcompose://;
    # [System.Uri].Query liefert bei eigenen Schemata teils leer -> deshalb Regex).
    $p     = Get-Params $Url
    $base  = $p["base"]
    $type  = $p["type"]
    $id    = $p["id"]
    $token = $p["token"]
    $text  = $p["text"]
    if (-not $text) { $text = "1" }

    if (-not $base -or -not $type -or -not $id) { throw "Ungueltiger Aufruf (base/type/id fehlt).`nURL: $Url" }
    if (-not (Test-Path $Betterbird)) { throw "Betterbird nicht gefunden. Pfad im Skript pruefen: $Betterbird" }

    $pdfUrl  = "${base}/api/pdf/${type}/${id}"
    $metaUrl = "${base}/api/eml-meta/${type}/${id}?text=${text}"

    if ($ShowDiagnose) {
        [System.Windows.Forms.MessageBox]::Show(
            "Aufgerufene URLs:`n`nPDF:  $pdfUrl`nMeta: $metaUrl",
            "Graupner bbcompose - Diagnose") | Out-Null
    }

    $headers = @{ Authorization = "Bearer $token" }

    # 1) PDF herunterladen (Auth via Bearer-Header)
    $pdf = Join-Path $env:TEMP ("graupner_" + $type + "_" + $id + ".pdf")
    Invoke-WebRequest -Uri $pdfUrl -Headers $headers -OutFile $pdf -UseBasicParsing

    # 2) Empfaenger / Betreff / Text holen
    $meta = Invoke-RestMethod -Uri $metaUrl -Headers $headers -UseBasicParsing

    # 3) Betterbird mit Anhang oeffnen
    $arg = "to='$($meta.to)',subject='$($meta.subject)',body='$($meta.body)',attachment='$pdf'"
    & $Betterbird -compose $arg
}
catch {
    [System.Windows.Forms.MessageBox]::Show("Fehler: $($_.Exception.Message)", "Graupner bbcompose") | Out-Null
}
