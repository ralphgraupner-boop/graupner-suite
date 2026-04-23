import { useState, useMemo } from "react";
import { Smartphone, Copy, Check, Share2, Home, QrCode } from "lucide-react";
import { toast } from "sonner";

/**
 * Handy-Zugang Modul – eigenständig, keine Backend-Abhaengigkeit.
 * Zeigt QR-Code + Anleitung + Login-Daten, damit der User die Suite
 * schnell aufs Handy bekommt.
 */
export function HandyZugangPage() {
  const [target, setTarget] = useState("suite"); // suite | portal-v3
  const [copied, setCopied] = useState(false);

  const urls = {
    suite: "https://code-import-flow-1.emergent.host",
    "portal-v3": "https://code-import-flow-1.emergent.host/portal-v3",
  };

  const url = urls[target];

  const qrSrc = useMemo(
    () => `https://api.qrserver.com/v1/create-qr-code/?size=320x320&margin=10&data=${encodeURIComponent(url)}`,
    [url]
  );

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Link kopiert");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Kopieren fehlgeschlagen");
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6" data-testid="handy-zugang-page">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10 text-primary">
          <Smartphone className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Handy-Zugang</h1>
          <p className="text-sm text-muted-foreground">
            QR-Code scannen, als App aufs Handy installieren, schnell einsteigen.
          </p>
        </div>
      </div>

      {/* Ziel-Auswahl */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setTarget("suite")}
          className={`px-4 py-2 rounded-lg text-sm border ${target === "suite" ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted"}`}
          data-testid="handy-target-suite"
        >
          Graupner Suite (Admin)
        </button>
        <button
          onClick={() => setTarget("portal-v3")}
          className={`px-4 py-2 rounded-lg text-sm border ${target === "portal-v3" ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted"}`}
          data-testid="handy-target-portal"
        >
          Kundenportal v3
        </button>
      </div>

      {/* QR + URL */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="border rounded-xl bg-card p-6 flex flex-col items-center" data-testid="handy-qr-card">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
            <QrCode className="w-4 h-4" />
            Scan mich mit dem Handy
          </div>
          <img
            src={qrSrc}
            alt="QR-Code"
            className="w-64 h-64 rounded-lg bg-white p-2 border"
            data-testid="handy-qr-image"
          />
          <div className="mt-4 w-full flex items-center gap-2">
            <code className="flex-1 text-xs px-3 py-2 bg-muted rounded-lg truncate" data-testid="handy-url">
              {url}
            </code>
            <button
              onClick={copyUrl}
              className="p-2 rounded-lg border hover:bg-muted"
              title="Link kopieren"
              data-testid="handy-copy-btn"
            >
              {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Anleitung */}
        <div className="border rounded-xl bg-card p-6 space-y-4" data-testid="handy-instructions">
          <div className="flex items-center gap-2 font-semibold">
            <Home className="w-4 h-4" />
            Als App am Home-Bildschirm speichern
          </div>

          <div>
            <div className="text-sm font-medium mb-2 flex items-center gap-1">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs"></span>
              iPhone (Safari)
            </div>
            <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
              <li>Diese Seite in Safari öffnen (QR-Code scannen)</li>
              <li>Auf das <Share2 className="w-3 h-3 inline" /> Teilen-Symbol tippen (unten)</li>
              <li>Runterscrollen → <strong>„Zum Home-Bildschirm"</strong></li>
              <li>Namen bestätigen → <strong>„Hinzufügen"</strong></li>
            </ol>
          </div>

          <div>
            <div className="text-sm font-medium mb-2 flex items-center gap-1">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs"></span>
              Android (Chrome)
            </div>
            <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
              <li>Diese Seite in Chrome öffnen (QR-Code scannen)</li>
              <li>Oben rechts <strong>⋮</strong> (3-Punkte-Menü) antippen</li>
              <li><strong>„Zum Startbildschirm hinzufügen"</strong></li>
              <li><strong>„Installieren"</strong> / <strong>„Hinzufügen"</strong></li>
            </ol>
          </div>

          <div className="text-xs text-muted-foreground pt-2 border-t">
            Danach startet die Suite beim Antippen direkt im Vollbild — wie eine App.
          </div>
        </div>
      </div>

      {/* Login-Daten (nur Suite) */}
      {target === "suite" && (
        <div className="border rounded-xl bg-gradient-to-br from-[#14532D]/5 to-transparent p-6" data-testid="handy-creds">
          <div className="font-semibold mb-2">Deine Login-Daten</div>
          <div className="text-sm space-y-1">
            <div><span className="text-muted-foreground">Benutzer:</span> <code className="bg-muted px-2 py-0.5 rounded">admin</code></div>
            <div><span className="text-muted-foreground">Passwort:</span> <code className="bg-muted px-2 py-0.5 rounded">Graupner!Suite2026</code></div>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Tipp: Nach dem ersten Login merkt sich Safari / Chrome das Passwort auf Wunsch.
          </p>
        </div>
      )}

      {/* Hinweis Portal */}
      {target === "portal-v3" && (
        <div className="border rounded-xl bg-gradient-to-br from-[#14532D]/5 to-transparent p-6" data-testid="handy-portal-info">
          <div className="font-semibold mb-2">Hinweis Kundenportal</div>
          <p className="text-sm text-muted-foreground">
            Der QR-Code führt nur zur Portal-Startseite. Deine Kunden bekommen ihren eigenen
            Login-Link per Einladungs-Mail (mit persönlichem Token). Diesen Link kannst du
            beim Admin-Eintrag unter „Senden" kopieren.
          </p>
        </div>
      )}

      {/* Was am Handy praktikabel ist */}
      <div className="border rounded-xl bg-card p-6" data-testid="handy-tips">
        <div className="font-semibold mb-3">Am Handy gut nutzbar</div>
        <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
          <li>Dashboard &amp; Anfragen prüfen</li>
          <li>Kunden-Modul durchsuchen, Kontakte anzeigen</li>
          <li>Kundenportal v3 — Nachrichten an Kunden, Foto-Uploads</li>
          <li>Einsätze / Termine einsehen</li>
        </ul>
        <div className="font-semibold mt-4 mb-3">Lieber am PC machen</div>
        <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
          <li>Angebote / Aufträge / Rechnungen schreiben</li>
          <li>Positions-Tabellen bearbeiten</li>
          <li>PDF-Vorschau &amp; -Generierung</li>
        </ul>
      </div>
    </div>
  );
}

export default HandyZugangPage;
