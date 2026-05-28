import { useState, useMemo } from "react";
import { Clock, CheckCircle2, X } from "lucide-react";
import { toast } from "sonner";

const HOURS = [1, 2, 4, 8];

const LABEL = {
  quote: "Angebots-Wiedervorlage",
  invoice: "Rechnungs-Erinnerung",
  task: "Aufgabe",
  termin: "Termin",
};

export default function SnoozePage() {
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const entityType = params.get("type");
  const entityId = params.get("id");
  const token = params.get("token");
  const [done, setDone] = useState(null); // { hours, until }
  const [sending, setSending] = useState(false);

  const valid = entityType && entityId && token;
  const friendlyType = LABEL[entityType] || "Eintrag";

  const snooze = async (h) => {
    if (sending) return;
    setSending(true);
    try {
      const res = await fetch("/api/push/quick-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          push_token: token,
          entity_type: entityType,
          entity_id: entityId,
          action: "snooze",
          snooze_hours: h,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Fehler");
      setDone({ hours: h, until: data.snooze_until });
      // Fenster nach 2 Sek schließen, falls möglich
      setTimeout(() => { try { window.close(); } catch { /* ignore */ } }, 2200);
    } catch (e) {
      toast.error(e.message || "Konnte nicht verschieben");
    } finally {
      setSending(false);
    }
  };

  if (!valid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <div className="bg-background border rounded-lg p-6 max-w-md w-full text-center">
          <X className="w-10 h-10 text-destructive mx-auto mb-3" />
          <h1 className="text-lg font-bold mb-2">Ungültiger Link</h1>
          <p className="text-sm text-muted-foreground">Es fehlen Parameter. Bitte öffne die Erinnerung erneut aus dem Push-Popup.</p>
        </div>
      </div>
    );
  }

  if (done) {
    const untilFmt = done.until ? new Date(done.until).toLocaleString("de-DE", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" }) : "";
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <div className="bg-background border rounded-lg p-6 max-w-md w-full text-center" data-testid="snooze-success">
          <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto mb-3" />
          <h1 className="text-lg font-bold mb-2">Erinnerung verschoben</h1>
          <p className="text-sm text-muted-foreground mb-3">
            Du bekommst in <strong>{done.hours} Std</strong> eine neue Erinnerung.
          </p>
          {untilFmt && <p className="text-xs text-muted-foreground">Nächste Erinnerung: <strong>{untilFmt}</strong></p>}
          <p className="text-xs text-muted-foreground mt-4">Du kannst dieses Fenster jetzt schließen.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <div className="bg-background border rounded-lg p-6 max-w-md w-full" data-testid="snooze-page">
        <div className="flex items-center gap-3 mb-4">
          <Clock className="w-8 h-8 text-primary" />
          <div>
            <h1 className="text-lg font-bold">Erinnere mich später</h1>
            <p className="text-sm text-muted-foreground">{friendlyType}</p>
          </div>
        </div>
        <p className="text-sm mb-4">In wie vielen Stunden möchtest du erinnert werden?</p>
        <div className="grid grid-cols-2 gap-3">
          {HOURS.map((h) => (
            <button
              key={h}
              onClick={() => snooze(h)}
              disabled={sending}
              className="border-2 border-primary/30 rounded-lg p-4 text-center hover:bg-primary hover:text-primary-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              data-testid={`btn-snooze-${h}h`}
            >
              <div className="text-2xl font-bold">{h}</div>
              <div className="text-xs">Stunde{h > 1 ? "n" : ""}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
