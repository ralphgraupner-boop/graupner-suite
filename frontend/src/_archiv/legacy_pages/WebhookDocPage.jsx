import { useState } from "react";
import { Mail, CheckCircle, X, Copy, Code, Globe, Send } from "lucide-react";
import { toast } from "sonner";
import axios from "axios";
import { Button, Input, Textarea, Card } from "@/components/common";
import { api, API } from "@/lib/api";

const WebhookDocPage = () => {
  const webhookUrl = `${BACKEND_URL}/api/webhook/contact`;
  const [testName, setTestName] = useState("");
  const [testVorname, setTestVorname] = useState("");
  const [testEmail, setTestEmail] = useState("");
  const [testPhone, setTestPhone] = useState("");
  const [testMessage, setTestMessage] = useState("");
  const [testRolle, setTestRolle] = useState("");
  const [testAnrede, setTestAnrede] = useState("");
  const [testStrasse, setTestStrasse] = useState("");
  const [testPlz, setTestPlz] = useState("");
  const [testStadt, setTestStadt] = useState("");
  const [testTopics, setTestTopics] = useState([]);
  const [testResult, setTestResult] = useState(null);
  const [testing, setTesting] = useState(false);
  const [copied, setCopied] = useState("");

  const copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    toast.success("In Zwischenablage kopiert!");
    setTimeout(() => setCopied(""), 2000);
  };

  const sendTestWebhook = async () => {
    if (!testName) { toast.error("Bitte Nachname eingeben"); return; }
    setTesting(true);
    setTestResult(null);
    try {
      const res = await axios.post(`${API}/webhook/contact`, {
        rolle: testRolle,
        anrede: testAnrede,
        vorname: testVorname,
        nachname: testName,
        email: testEmail,
        telefon: testPhone,
        strasse: testStrasse,
        plz: testPlz,
        stadt: testStadt,
        topics: testTopics,
        nachricht: testMessage
      });
      setTestResult({ success: true, data: res.data });
      toast.success("Test-Anfrage erfolgreich gesendet!");
    } catch (err) {
      setTestResult({ success: false, error: err.response?.data?.detail || err.message });
      toast.error("Fehler beim Senden");
    } finally {
      setTesting(false);
    }
  };

  const htmlSnippet = `<!-- Graupner Suite Kontaktformular -->
<form id="kontaktformular" onsubmit="sendToGraupner(event)">
  <input type="text" name="name" placeholder="Ihr Name" required />
  <input type="email" name="email" placeholder="E-Mail" />
  <input type="tel" name="phone" placeholder="Telefon" />
  <textarea name="message" placeholder="Ihre Nachricht"></textarea>
  <button type="submit">Anfrage senden</button>
</form>

<script>
async function sendToGraupner(e) {
  e.preventDefault();
  const form = e.target;
  const data = {
    name: form.name.value,
    email: form.email.value,
    phone: form.phone.value,
    message: form.message.value
  };
  try {
    const res = await fetch("${webhookUrl}", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });
    if (res.ok) {
      alert("Anfrage erfolgreich gesendet!");
      form.reset();
    } else {
      alert("Fehler beim Senden. Bitte versuchen Sie es erneut.");
    }
  } catch (err) {
    alert("Verbindungsfehler. Bitte versuchen Sie es später erneut.");
  }
}
</script>`;

  const phpSnippet = `<?php
// === Graupner Suite Webhook ===
// Diesen Code in Ihre response.php einfügen
// (oder am Anfang Ihrer bestehenden response.php hinzufügen)

// Formulardaten sammeln
$topics = isset($_POST["topic"]) ? $_POST["topic"] : [];
$data = [
    "rolle"      => isset($_POST["rolle"]) ? $_POST["rolle"] : "",
    "anrede"     => isset($_POST["anrede"]) ? $_POST["anrede"] : "",
    "vorname"    => isset($_POST["vorname"]) ? $_POST["vorname"] : "",
    "nachname"   => isset($_POST["nachname"]) ? $_POST["nachname"] : "",
    "firma"      => isset($_POST["firma"]) ? $_POST["firma"] : "",
    "email"      => isset($_POST["email"]) ? $_POST["email"] : "",
    "telefon"    => isset($_POST["telefon"]) ? $_POST["telefon"] : "",
    "website"    => isset($_POST["website"]) ? $_POST["website"] : "",
    "strasse"    => isset($_POST["strasse"]) ? $_POST["strasse"] : "",
    "plz"        => isset($_POST["plz"]) ? $_POST["plz"] : "",
    "stadt"      => isset($_POST["stadt"]) ? $_POST["stadt"] : "",
    "topics"     => is_array($topics) ? $topics : [$topics],
    "nachricht"  => isset($_POST["nachricht"]) ? $_POST["nachricht"] : "",
    // Objektadresse (falls vorhanden)
    "objanrede"    => isset($_POST["objanrede"]) ? $_POST["objanrede"] : "",
    "objvorname"   => isset($_POST["objvorname"]) ? $_POST["objvorname"] : "",
    "objnachname"  => isset($_POST["objnachname"]) ? $_POST["objnachname"] : "",
    "objtelefon"   => isset($_POST["objtelefon"]) ? $_POST["objtelefon"] : "",
    "objemail"     => isset($_POST["objemail"]) ? $_POST["objemail"] : "",
    "objstrasse"   => isset($_POST["objstrasse"]) ? $_POST["objstrasse"] : "",
    "objplz"       => isset($_POST["objplz"]) ? $_POST["objplz"] : "",
    "objstadt"     => isset($_POST["objstadt"]) ? $_POST["objstadt"] : "",
    "objprojektnr" => isset($_POST["objprojektnr"]) ? $_POST["objprojektnr"] : ""
];

// An Graupner Suite senden
$ch = curl_init("${webhookUrl}");
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    "Content-Type: application/json"
]);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_TIMEOUT, 10);
$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

// Optional: Ergebnis loggen
// error_log("Graupner Suite Webhook: " . $httpCode . " - " . $response);

// Ihre bestehende response.php Logik hier weiter...
?>`;

  const phpSnippetSimple = `<?php
// Einfache Version - nur die wichtigsten Felder
$data = [
    "name"    => $_POST["vorname"] . " " . $_POST["nachname"],
    "email"   => $_POST["email"],
    "phone"   => $_POST["telefon"],
    "address" => $_POST["strasse"] . ", " . $_POST["plz"] . " " . $_POST["stadt"],
    "message" => $_POST["nachricht"]
];

$ch = curl_init("${webhookUrl}");
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
curl_setopt($ch, CURLOPT_HTTPHEADER, ["Content-Type: application/json"]);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_exec($ch);
curl_close($ch);
?>`;

  const beaconUrl = `${BACKEND_URL}/api/webhook/contact-beacon`;

  const ionosSnippet = `<script>
// === Graupner Suite: IONOS Website-Builder Integration ===
// Dieses Script in IONOS unter "Website > Einstellungen > Head-HTML" einfuegen
(function() {
  document.addEventListener('DOMContentLoaded', function() {
    var form = document.querySelector('form.form-form');
    if (!form) return;
    var sent = false;

    function sendToGraupner() {
      if (sent) return;
      var inputs = form.querySelectorAll('input.form-input');
      var textareas = form.querySelectorAll('textarea.form-input');
      var name = inputs[0] ? inputs[0].value : '';
      var nachricht = textareas[0] ? textareas[0].value : '';
      if (!name) return;
      sent = true;
      setTimeout(function() { sent = false; }, 5000);

      // Bild-Beacon: funktioniert OHNE CORS, wird nie blockiert
      var img = new Image();
      img.src = "${beaconUrl}"
        + "?name=" + encodeURIComponent(name)
        + "&nachricht=" + encodeURIComponent(nachricht);
    }

    form.addEventListener('submit', sendToGraupner);
    var btn = form.querySelector('button[type="submit"]');
    if (btn) btn.addEventListener('click', sendToGraupner);
  });
})();
</script>`;

  return (
    <div data-testid="webhook-doc-page">
      <div className="mb-4 lg:mb-8">
        <h1 className="text-2xl lg:text-4xl font-bold">Website-Integration</h1>
        <p className="text-muted-foreground mt-1 text-sm lg:text-base">Verbinden Sie Ihr Kontaktformular mit der Graupner Suite</p>
      </div>

      {/* Webhook URL */}
      <Card className="p-4 lg:p-6 mb-4 lg:mb-6 border-primary/30">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-primary/10 rounded-sm shrink-0">
            <Globe className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-base lg:text-lg">Ihre Webhook-URL</h3>
            <p className="text-sm text-muted-foreground mt-1 mb-3">
              Diese URL empfängt Anfragen von Ihrem Website-Kontaktformular und erstellt automatisch einen neuen Kunden.
            </p>
            <div className="flex items-center gap-2 bg-slate-100 rounded-sm p-3 overflow-x-auto">
              <code className="text-sm font-mono text-primary break-all flex-1" data-testid="webhook-url">{webhookUrl}</code>
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(webhookUrl, "url")}
                className="shrink-0"
                data-testid="btn-copy-url"
              >
                <Copy className="w-4 h-4" />
                {copied === "url" ? "Kopiert!" : "Kopieren"}
              </Button>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
        {/* Left: Code Snippets */}
        <div className="space-y-4 lg:space-y-6">
          {/* JSON Format */}
          <Card className="p-4 lg:p-6">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Code className="w-5 h-5 text-primary" />
              Datenformat (JSON)
            </h3>
            <p className="text-sm text-muted-foreground mb-3">
              Ihr Kontaktformular muss die Daten als JSON im folgenden Format senden:
            </p>
            <div className="relative">
              <pre className="bg-slate-900 text-slate-100 rounded-sm p-4 text-xs lg:text-sm overflow-x-auto">
{`POST ${webhookUrl}
Content-Type: application/json

{
  "name": "Max Mustermann",     // Pflichtfeld
  "email": "max@example.de",    // Optional
  "phone": "0171 1234567",      // Optional
  "address": "Musterstr. 1",    // Optional
  "message": "Ich brauche..."   // Optional
}`}
              </pre>
              <button
                onClick={() => copyToClipboard(`{\n  "name": "Max Mustermann",\n  "email": "max@example.de",\n  "phone": "0171 1234567",\n  "message": "Anfrage..."\n}`, "json")}
                className="absolute top-2 right-2 p-1.5 bg-slate-700 hover:bg-slate-600 rounded text-slate-300"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
            </div>
          </Card>

          {/* HTML Snippet */}
          <Card className="p-4 lg:p-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold flex items-center gap-2">
                <Code className="w-5 h-5 text-orange-500" />
                HTML / JavaScript
              </h3>
              <Button variant="outline" size="sm" onClick={() => copyToClipboard(htmlSnippet, "html")}>
                <Copy className="w-4 h-4" />
                {copied === "html" ? "Kopiert!" : "Kopieren"}
              </Button>
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              Kopieren Sie diesen Code in Ihre Website. Das Formular sendet Anfragen direkt an die Graupner Suite.
            </p>
            <pre className="bg-slate-900 text-slate-100 rounded-sm p-4 text-xs overflow-x-auto max-h-64 overflow-y-auto">
              {htmlSnippet}
            </pre>
          </Card>

          {/* PHP Snippet */}
          <Card className="p-4 lg:p-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold flex items-center gap-2">
                <Code className="w-5 h-5 text-indigo-500" />
                Ihre response.php anpassen
              </h3>
              <Button variant="outline" size="sm" onClick={() => copyToClipboard(phpSnippet, "php")}>
                <Copy className="w-4 h-4" />
                {copied === "php" ? "Kopiert!" : "Kopieren"}
              </Button>
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              Fügen Sie diesen Code <strong>am Anfang</strong> Ihrer bestehenden <code className="bg-slate-100 px-1 rounded">response.php</code> ein. 
              Er leitet alle Formularfelder (Rolle, Name, Adresse, Themen, Nachricht, Objektdaten) an die Graupner Suite weiter.
            </p>
            <pre className="bg-slate-900 text-slate-100 rounded-sm p-4 text-xs overflow-x-auto max-h-64 overflow-y-auto">
              {phpSnippet}
            </pre>
          </Card>

          {/* IONOS Go-X Snippet */}
          <Card className="p-4 lg:p-6 border-orange-300/50 bg-orange-50/30" data-testid="ionos-integration-card">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold flex items-center gap-2">
                <Globe className="w-5 h-5 text-orange-600" />
                IONOS Website-Builder (Go-X)
              </h3>
              <Button variant="outline" size="sm" onClick={() => copyToClipboard(ionosSnippet, "ionos")} data-testid="btn-copy-ionos">
                <Copy className="w-4 h-4" />
                {copied === "ionos" ? "Kopiert!" : "Kopieren"}
              </Button>
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              Speziell f&uuml;r <strong>IONOS Go-X</strong> Websites (z.B. schiebetuer-reparatur-hamburg.de). 
              Dieses Script liest automatisch <strong>Name</strong> und <strong>Nachricht</strong> aus dem eingebauten Formular aus.
            </p>
            <div className="bg-amber-100/60 border border-amber-200 rounded-sm p-3 mb-3">
              <p className="text-xs font-medium text-amber-800 mb-2">So binden Sie es ein:</p>
              <ol className="text-xs text-amber-700 space-y-1 list-decimal list-inside">
                <li>IONOS Konto einloggen &rarr; <strong>Website bearbeiten</strong></li>
                <li>Klicken Sie auf das <strong>Zahnrad-Symbol</strong> (Website-Einstellungen)</li>
                <li>W&auml;hlen Sie <strong>"Head-HTML"</strong> oder <strong>"Eigener Code"</strong></li>
                <li>F&uuml;gen Sie den Code unten ein und <strong>speichern</strong> Sie</li>
              </ol>
            </div>
            <pre className="bg-slate-900 text-slate-100 rounded-sm p-4 text-xs overflow-x-auto max-h-64 overflow-y-auto">
              {ionosSnippet}
            </pre>
          </Card>
        </div>

        {/* Right: Test Form */}
        <div className="space-y-4 lg:space-y-6">
          <Card className="p-4 lg:p-6">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Send className="w-5 h-5 text-primary" />
              Test-Formular
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Testen Sie hier, ob der Webhook funktioniert. Die Felder entsprechen Ihrem Kontaktformular auf kontakt-graupner.de.
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Rolle *</label>
                <select data-testid="input-test-rolle" value={testRolle} onChange={(e) => setTestRolle(e.target.value)}
                  className="w-full h-10 rounded-sm border border-input bg-background px-3 text-sm">
                  <option value="">Bitte wählen...</option>
                  <option value="Eigentümer/Vermieter">Eigentümer/Vermieter</option>
                  <option value="Hausverwaltung">Hausverwaltung</option>
                  <option value="Mieter">Mieter</option>
                  <option value="Interessent Tischlerarbeiten">Interessent Tischlerarbeiten</option>
                </select>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-sm font-medium mb-1">Anrede</label>
                  <select data-testid="input-test-anrede" value={testAnrede} onChange={(e) => setTestAnrede(e.target.value)}
                    className="w-full h-10 rounded-sm border border-input bg-background px-3 text-sm">
                    <option value="">--</option>
                    <option value="Herr">Herr</option>
                    <option value="Frau">Frau</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Vorname</label>
                  <Input data-testid="input-test-vorname" value={testVorname} onChange={(e) => setTestVorname(e.target.value)} placeholder="Max" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Nachname *</label>
                  <Input data-testid="input-test-nachname" value={testName} onChange={(e) => setTestName(e.target.value)} placeholder="Mustermann" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-sm font-medium mb-1">Telefon *</label>
                  <Input data-testid="input-test-phone" value={testPhone} onChange={(e) => setTestPhone(e.target.value)} placeholder="040 12345678" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">E-Mail *</label>
                  <Input data-testid="input-test-email" type="email" value={testEmail} onChange={(e) => setTestEmail(e.target.value)} placeholder="max@example.de" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Straße *</label>
                <Input value={testStrasse} onChange={(e) => setTestStrasse(e.target.value)} placeholder="Eppendorfer Weg 123" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-sm font-medium mb-1">PLZ *</label>
                  <Input value={testPlz} onChange={(e) => setTestPlz(e.target.value)} placeholder="20253" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Stadt *</label>
                  <Input value={testStadt} onChange={(e) => setTestStadt(e.target.value)} placeholder="Hamburg" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Themen</label>
                <div className="grid grid-cols-2 gap-1.5 text-sm">
                  {["Fenster","Balkontür","Terrassentür","Zimmertür","Wohnungstür","Schiebetür","Schrank","Boden","Sonstiges"].map(t => (
                    <label key={t} className="flex items-center gap-1.5 cursor-pointer">
                      <input type="checkbox" checked={testTopics.includes(t)}
                        onChange={(e) => setTestTopics(prev => e.target.checked ? [...prev, t] : prev.filter(x => x !== t))}
                        className="rounded border-input" />
                      {t}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Nachricht</label>
                <Textarea data-testid="input-test-message" value={testMessage} onChange={(e) => setTestMessage(e.target.value)}
                  placeholder="Bitte nennen Sie uns 3 Besichtigungstermine..." rows={3} />
              </div>
              <Button data-testid="btn-send-test-webhook" onClick={sendTestWebhook} disabled={testing} className="w-full">
                <Send className="w-4 h-4" />
                {testing ? "Sende..." : "Test-Anfrage senden"}
              </Button>
            </div>

            {testResult && (
              <div className={`mt-4 p-3 rounded-sm text-sm ${testResult.success ? "bg-green-50 text-green-800 border border-green-200" : "bg-red-50 text-red-800 border border-red-200"}`}>
                {testResult.success ? (
                  <>
                    <p className="font-medium flex items-center gap-1"><CheckCircle className="w-4 h-4" /> Erfolgreich!</p>
                    <p className="mt-1">Neuer Kunde wurde angelegt. Prüfen Sie Ihre Kundenliste.</p>
                  </>
                ) : (
                  <>
                    <p className="font-medium">Fehler</p>
                    <p className="mt-1">{testResult.error}</p>
                  </>
                )}
              </div>
            )}
          </Card>

          {/* How it works */}
          <Card className="p-4 lg:p-6">
            <h3 className="font-semibold mb-3">So funktioniert es</h3>
            <div className="space-y-4">
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-primary font-bold text-sm">1</div>
                <div>
                  <p className="font-medium text-sm">Besucher füllt Kontaktformular aus</p>
                  <p className="text-xs text-muted-foreground">Auf Ihrer Website (z.B. graupner-tischlerei.de)</p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-primary font-bold text-sm">2</div>
                <div>
                  <p className="font-medium text-sm">Daten werden an Webhook gesendet</p>
                  <p className="text-xs text-muted-foreground">Automatisch per JavaScript oder PHP</p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-primary font-bold text-sm">3</div>
                <div>
                  <p className="font-medium text-sm">Neuer Kunde wird angelegt</p>
                  <p className="text-xs text-muted-foreground">Automatisch in der Graupner Suite gespeichert</p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-primary font-bold text-sm">4</div>
                <div>
                  <p className="font-medium text-sm">Push-Benachrichtigung</p>
                  <p className="text-xs text-muted-foreground">Sie werden sofort auf Ihrem Handy/PC benachrichtigt</p>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};


export { WebhookDocPage };
