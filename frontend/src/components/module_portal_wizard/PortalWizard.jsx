import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { Pencil, Camera, CheckCircle2, Loader2, MessageSquare, ImagePlus, X, Phone } from "lucide-react";
import { api } from "@/lib/api";
import { GraupnerBriefkopf } from "@/components/common/GraupnerBriefkopf";

/**
 * PortalWizard — Öffentlicher Schritt-für-Schritt-Wizard für das Kundenportal.
 *
 * 5 Karten (Akkordeon): aktive Karte grün umrandet + offen, übrige zugeklappt.
 * Mobil-optimiert, groß & gut lesbar, Hell-/Dunkel-Modus. Grüner Akzent: #1a6e3c.
 * Kein Login (öffentlich). Fotos werden clientseitig komprimiert.
 */

const GREEN = "#1a6e3c";
const PHONE_HINT = "Sie erreichen uns auch telefonisch — wir helfen Ihnen gerne.";

const CARD_TITLES = {
  1: "Begrüßung & Start",
  2: "Nachricht schreiben?",
  3: "Fotos schicken?",
  4: "Ihre Eingaben",
  5: "Kontrolle & Absenden",
};

// ── Module-level Komponenten (NICHT im Render neu erzeugen → kein Fokusverlust) ──
const Hint = ({ ok, children, testid }) => (
  <div
    className={`rounded-lg px-3 py-2 text-sm font-medium ${ok ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-amber-50 text-amber-900 border border-amber-200"}`}
    data-testid={testid || (ok ? "hint-ok" : "hint-pending")}
  >
    {children}
  </div>
);

const ChoiceButton = ({ active, onClick, icon: Icon, children, testid }) => (
  <button
    type="button"
    onClick={onClick}
    data-testid={testid}
    className={`w-full flex items-center gap-3 rounded-xl border-2 px-4 py-4 text-left text-base font-medium transition-colors ${
      active ? "text-white" : "bg-background hover:bg-muted border-input"
    }`}
    style={active ? { backgroundColor: GREEN, borderColor: GREEN } : {}}
  >
    {Icon && <Icon className="w-5 h-5 flex-shrink-0" />}
    <span>{children}</span>
  </button>
);

const WeiterButton = ({ enabled, onClick, label = "Weiter →", testid }) => (
  <button
    type="button"
    disabled={!enabled}
    onClick={onClick}
    data-testid={testid}
    className="w-full rounded-xl px-4 py-4 text-base font-bold text-white transition-opacity disabled:cursor-not-allowed"
    style={{ backgroundColor: enabled ? GREEN : "#9ca3af", opacity: enabled ? 1 : 0.7 }}
  >
    {label}
  </button>
);

const Card = ({ n, step, onJump, children }) => {
  const active = step === n;
  const completed = step > n;
  if (active) {
    return (
      <div className="rounded-2xl border-2 bg-background p-5 shadow-sm" style={{ borderColor: GREEN }} data-testid={`portal-card-${n}`}>
        <div className="flex items-center gap-2 mb-3">
          <span className="flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold text-white" style={{ backgroundColor: GREEN }}>{n}</span>
          <h2 className="text-lg font-bold">{CARD_TITLES[n]}</h2>
        </div>
        {children}
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={() => completed && onJump(n)}
      disabled={!completed}
      className={`w-full flex items-center gap-2 rounded-2xl border bg-muted/40 px-4 py-3 text-left ${completed ? "hover:bg-muted cursor-pointer" : "opacity-60 cursor-default"}`}
      data-testid={`portal-card-${n}-collapsed`}
    >
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-sm font-bold text-muted-foreground">{n}</span>
      <span className="text-base font-medium text-muted-foreground">{CARD_TITLES[n]}</span>
      {completed && <span className="ml-auto text-xs font-semibold" style={{ color: GREEN }}>✓ erledigt · ändern</span>}
    </button>
  );
};

// Bild clientseitig verkleinern + als JPEG-Base64 zurückgeben (klein halten)
const compressImage = (file) =>
  new Promise((resolve) => {
    if (!file || !file.type?.startsWith("image/")) return resolve(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const max = 1280;
        let { width, height } = img;
        if (width > max || height > max) {
          const r = Math.min(max / width, max / height);
          width = Math.round(width * r);
          height = Math.round(height * r);
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);
        try {
          const dataUrl = canvas.toDataURL("image/jpeg", 0.6);
          resolve({ name: file.name || `foto_${Date.now()}.jpg`, url: dataUrl, dataUrl });
        } catch {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = e.target.result;
    };
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });

const PortalWizard = ({ token: tokenProp }) => {
  const params = useParams();
  const token = tokenProp || params.token;

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [portal, setPortal] = useState(null);

  const [step, setStep] = useState(1);
  const [msgChoice, setMsgChoice] = useState(null);
  const [fotoChoice, setFotoChoice] = useState(null);
  const [message, setMessage] = useState("");
  const [files, setFiles] = useState([]); // [{ name, url, dataUrl }]
  const [fotoBusy, setFotoBusy] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [friendlyError, setFriendlyError] = useState("");

  const textareaRef = useRef(null);
  const [pendingFocusMsg, setPendingFocusMsg] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const r = await api.get(`/kundenportal/portal/${token}`);
        if (mounted) setPortal(r.data);
      } catch (e) {
        if (mounted) setLoadError(e?.response?.data?.detail || "Portal-Link ungültig oder abgelaufen.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [token]);

  // Fokus in die Textarea setzen, wenn man über "Ändern" zu Karte 4 springt
  useEffect(() => {
    if (step === 4 && pendingFocusMsg && msgChoice === "ja") {
      const t = setTimeout(() => textareaRef.current?.focus(), 50);
      setPendingFocusMsg(false);
      return () => clearTimeout(t);
    }
  }, [step, pendingFocusMsg, msgChoice]);

  const kundenName = portal?.kunde?.name || "";
  const auftragText = portal?.auftrag_text || "";

  const goto = (n) => { setFriendlyError(""); setStep(n); };

  const onPickFiles = async (e) => {
    const picked = Array.from(e.target.files || []);
    e.target.value = "";
    if (!picked.length) return;
    setFriendlyError("");
    setFotoBusy(true);
    try {
      const results = [];
      for (const f of picked) {
        const c = await compressImage(f);
        if (c) results.push(c);
      }
      if (results.length === 0) {
        setFriendlyError(`Die Fotos konnten leider nicht verarbeitet werden. Bitte versuchen Sie es nochmal — oder schicken Sie uns die Fotos per E-Mail. ${PHONE_HINT}`);
      } else {
        setFiles((prev) => [...prev, ...results]);
      }
    } catch {
      setFriendlyError(`Das hat leider nicht geklappt. Bitte versuchen Sie es nochmal — oder schicken Sie uns die Fotos per E-Mail. ${PHONE_HINT}`);
    } finally {
      setFotoBusy(false);
    }
  };

  const removeFile = (idx) => setFiles((prev) => prev.filter((_, i) => i !== idx));

  // "Ändern" springt direkt zur passenden Eingabe — Eingaben bleiben erhalten
  const editMessage = () => { if (msgChoice === "ja") { setPendingFocusMsg(true); goto(4); } else goto(2); };
  const editFotos = () => { if (fotoChoice === "ja") goto(4); else goto(3); };

  const weiterToReview = () => {
    setFriendlyError("");
    if (msgChoice === "ja" && !message.trim() && !(fotoChoice === "ja" && files.length)) {
      setFriendlyError("Bitte tragen Sie zuerst Ihre Nachricht ein — dann geht es weiter.");
      return;
    }
    setStep(5);
  };

  const submit = async () => {
    setFriendlyError("");
    if (msgChoice === "ja" && !message.trim() && !(fotoChoice === "ja" && files.length)) {
      setFriendlyError("Bitte tragen Sie zuerst Ihre Nachricht ein — dann geht es weiter.");
      return;
    }
    if (fotoChoice === "ja" && files.length === 0 && !(msgChoice === "ja" && message.trim())) {
      setFriendlyError("Bitte wählen Sie zuerst mindestens ein Foto aus — oder gehen Sie zurück und wählen 'keine Fotos'.");
      return;
    }
    setSubmitting(true);
    try {
      await api.post(`/kundenportal/eingang/${token}`, {
        nachricht: msgChoice === "ja" ? message : null,
        fotos: fotoChoice === "ja" ? files.map((f) => f.name) : [],
        fotos_data: fotoChoice === "ja" ? files.map((f) => f.dataUrl) : [],
      });
      setSubmitted(true);
    } catch (e) {
      const status = e?.response?.status;
      if (!e?.response) {
        setFriendlyError(`Bitte prüfen Sie Ihre Internetverbindung und versuchen Sie es nochmal. ${PHONE_HINT}`);
      } else if (status === 413) {
        setFriendlyError(`Die Fotos sind leider zu groß. Bitte senden Sie weniger oder kleinere Fotos — oder schicken Sie uns die Fotos per E-Mail. ${PHONE_HINT}`);
      } else {
        setFriendlyError(`Das hat leider nicht geklappt. Bitte versuchen Sie es nochmal — oder schicken Sie uns die Fotos per E-Mail. ${PHONE_HINT}`);
      }
    } finally {
      setSubmitting(false);
    }
  };

  // ---- Lade-/Fehlerzustände ----
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-6" data-testid="portal-wizard-loading">
        <Loader2 className="w-6 h-6 animate-spin mr-2" /> Portal wird geladen …
      </div>
    );
  }
  if (loadError && !portal) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-6" data-testid="portal-wizard-error">
        <div className="max-w-md text-center space-y-2">
          <X className="w-10 h-10 mx-auto text-amber-500" />
          <p className="text-lg font-semibold">Hoppla</p>
          <p className="text-muted-foreground">{loadError}</p>
          <p className="text-sm text-muted-foreground">{PHONE_HINT}</p>
        </div>
      </div>
    );
  }
  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-6" data-testid="portal-wizard-success">
        <div className="max-w-md text-center space-y-4">
          <CheckCircle2 className="w-16 h-16 mx-auto" style={{ color: GREEN }} />
          <h1 className="text-2xl font-bold">Vielen Dank{kundenName ? `, ${kundenName}` : ""}!</h1>
          <p className="text-base text-muted-foreground">Ihre Nachricht ist bei uns angekommen.</p>
          <p className="text-sm text-muted-foreground">Wir melden uns zeitnah bei Ihnen. Sie können dieses Fenster jetzt schließen.</p>
        </div>
      </div>
    );
  }

  const ErrorHint = () =>
    friendlyError ? (
      <Hint testid="portal-friendly-error">
        <span className="flex items-start gap-2"><Phone className="w-4 h-4 mt-0.5 flex-shrink-0" /><span>{friendlyError}</span></span>
      </Hint>
    ) : null;

  return (
    <div className="min-h-screen bg-background text-foreground" data-testid="portal-wizard">
      <GraupnerBriefkopf />
      <div className="px-4 pt-3 pb-4">
        <div className="mx-auto max-w-xl">
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: GREEN }}>Ihr persönliches Kundenportal</p>
          <h1 className="mt-1 text-2xl font-bold" data-testid="portal-greeting">Guten Tag{kundenName ? `, ${kundenName}` : ""}!</h1>
        </div>
      </div>

      <div className="mx-auto max-w-xl px-4 py-5 space-y-3">
        <Card n={1} step={step} onJump={goto}>
          <div className="space-y-3 text-base">
            <p>Sie hatten uns eine Anfrage gesendet — vielen Dank dafür. Um Ihnen schnell und gezielt helfen zu können, bitten wir Sie herzlich:</p>
            {auftragText && (
              <div className="rounded-xl border-l-4 bg-emerald-50 px-4 py-3 text-emerald-900" style={{ borderColor: GREEN }} data-testid="portal-auftrag-text">{auftragText}</div>
            )}
            <p className="text-muted-foreground">Wir führen Sie jetzt Schritt für Schritt — das dauert nur wenige Minuten.</p>
            <p className="font-medium">Wir stellen Ihnen gleich zwei kurze Fragen — dann sind Sie fertig. Versprochen.</p>
            <WeiterButton enabled onClick={() => goto(2)} label="Weiter — Los geht's →" testid="portal-card1-weiter" />
          </div>
        </Card>

        <Card n={2} step={step} onJump={goto}>
          <div className="space-y-3">
            <p className="text-lg font-semibold">Möchten Sie uns eine Nachricht schreiben?</p>
            <p className="text-muted-foreground">Haben Sie eine Frage, einen Hinweis oder eine Ergänzung für uns?</p>
            <ChoiceButton active={msgChoice === "ja"} onClick={() => setMsgChoice("ja")} icon={Pencil} testid="portal-msg-ja">Ja, ich schreibe eine Nachricht</ChoiceButton>
            <ChoiceButton active={msgChoice === "nein"} onClick={() => setMsgChoice("nein")} testid="portal-msg-nein">Nein, keine Nachricht — ich möchte direkt zu den Fotos</ChoiceButton>
            {msgChoice ? <Hint ok>✅ Auswahl gespeichert. 👇 Bitte drücken Sie jetzt auf Weiter.</Hint> : <Hint>☝️ Bitte wählen Sie eine Option — dann wird der Weiter-Button grün.</Hint>}
            <WeiterButton enabled={!!msgChoice} onClick={() => goto(3)} testid="portal-card2-weiter" />
          </div>
        </Card>

        <Card n={3} step={step} onJump={goto}>
          <div className="space-y-3">
            <p className="text-lg font-semibold">Möchten Sie uns Fotos schicken?</p>
            <p className="text-muted-foreground">{msgChoice === "ja" ? "Super! Möchten Sie zusätzlich Fotos schicken?" : "Kein Problem! Möchten Sie uns stattdessen Fotos schicken?"}</p>
            <ChoiceButton active={fotoChoice === "ja"} onClick={() => setFotoChoice("ja")} icon={Camera} testid="portal-foto-ja">Ja, ich schicke Fotos</ChoiceButton>
            <ChoiceButton active={fotoChoice === "nein"} onClick={() => setFotoChoice("nein")} testid="portal-foto-nein">Nein, keine Fotos — meine Nachricht reicht aus</ChoiceButton>
            {fotoChoice ? <Hint ok>✅ Auswahl gespeichert. 👇 Bitte drücken Sie jetzt auf Weiter.</Hint> : <Hint>☝️ Bitte wählen Sie eine Option — dann wird der Weiter-Button grün.</Hint>}
            <WeiterButton enabled={!!fotoChoice} onClick={() => goto(4)} testid="portal-card3-weiter" />
          </div>
        </Card>

        <Card n={4} step={step} onJump={goto}>
          <div className="space-y-4">
            {msgChoice === "ja" && (
              <div>
                <label className="mb-1 block text-base font-semibold">Ihre Nachricht an uns</label>
                <textarea
                  ref={textareaRef}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={5}
                  className="w-full rounded-xl border border-input bg-background p-3 text-base"
                  placeholder="Schreiben Sie uns hier …"
                  data-testid="portal-message-input"
                />
              </div>
            )}
            {fotoChoice === "ja" && (
              <div>
                <label className="mb-1 block text-base font-semibold">Fotos auswählen — Kamera oder Galerie</label>
                <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-input px-4 py-6 text-base font-medium hover:bg-muted" data-testid="portal-foto-upload-label">
                  {fotoBusy ? <Loader2 className="w-5 h-5 animate-spin" /> : <ImagePlus className="w-5 h-5" />}
                  {fotoBusy ? "Fotos werden vorbereitet …" : "Fotos hinzufügen"}
                  <input type="file" accept="image/*" multiple className="hidden" onChange={onPickFiles} data-testid="portal-foto-input" />
                </label>
                {files.length > 0 && (
                  <div className="mt-3 grid grid-cols-3 gap-2" data-testid="portal-foto-preview">
                    {files.map((f, i) => (
                      <div key={i} className="relative">
                        <img src={f.url} alt={f.name} className="h-20 w-full rounded-lg object-cover" />
                        <button type="button" onClick={() => removeFile(i)} className="absolute -right-1 -top-1 rounded-full bg-red-500 p-0.5 text-white" data-testid={`portal-foto-remove-${i}`}>
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            {msgChoice === "nein" && fotoChoice === "nein" && (
              <p className="text-muted-foreground">Sie haben keine Eingabe gewählt — Sie können trotzdem absenden, um uns zu bestätigen, dass alles in Ordnung ist.</p>
            )}
            <Hint ok>👇 Wenn Sie fertig sind, drücken Sie bitte auf Weiter zur Kontrolle.</Hint>
            <ErrorHint />
            <WeiterButton enabled={!fotoBusy} onClick={weiterToReview} label="Weiter zur Kontrolle →" testid="portal-card4-weiter" />
          </div>
        </Card>

        <Card n={5} step={step} onJump={goto}>
          <div className="space-y-3">
            <p className="text-lg font-semibold">Bitte prüfen Sie Ihre Angaben</p>

            <div className="rounded-xl border border-input p-3" data-testid="portal-review-message">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 font-medium"><MessageSquare className="w-4 h-4" /> Nachricht</span>
                <button type="button" onClick={editMessage} className="text-sm font-semibold" style={{ color: GREEN }} data-testid="portal-edit-message">✏️ Ändern</button>
              </div>
              <p className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap">{msgChoice === "ja" ? (message.trim() || "(noch keine Nachricht eingegeben)") : "Keine Nachricht"}</p>
            </div>

            <div className="rounded-xl border border-input p-3" data-testid="portal-review-fotos">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 font-medium"><Camera className="w-4 h-4" /> Fotos</span>
                <button type="button" onClick={editFotos} className="text-sm font-semibold" style={{ color: GREEN }} data-testid="portal-edit-fotos">✏️ Ändern</button>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{fotoChoice === "ja" ? `${files.length} Foto(s) ausgewählt` : "Keine Fotos"}</p>
            </div>

            <Hint ok>✅ Alles in Ordnung? Dann drücken Sie jetzt auf Absenden.</Hint>
            <ErrorHint />
            <button
              type="button"
              disabled={submitting}
              onClick={submit}
              data-testid="portal-submit"
              className="w-full rounded-xl px-4 py-5 text-lg font-bold text-white disabled:opacity-60"
              style={{ backgroundColor: GREEN }}
            >
              {submitting ? <span className="inline-flex items-center gap-2"><Loader2 className="w-5 h-5 animate-spin" /> Wird gesendet …</span> : "✅ Jetzt absenden"}
            </button>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default PortalWizard;
export { PortalWizard };
