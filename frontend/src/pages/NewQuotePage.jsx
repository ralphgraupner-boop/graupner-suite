import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Plus, Mic, MicOff, Trash2 } from "lucide-react";
import { toast } from "sonner";
import axios from "axios";
import { Button, Input, Textarea, Card } from "@/components/common";
import { api, API } from "@/lib/api";

const NewQuotePage = () => {
  const [customers, setCustomers] = useState([]);
  const [articles, setArticles] = useState([]);
  const [services, setServices] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [positions, setPositions] = useState([]);
  const [notes, setNotes] = useState("");
  const [vatRate, setVatRate] = useState(19);
  const [loading, setLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const mediaRecorderRef = { current: null };
  const chunksRef = { current: [] };

  useEffect(() => {
    loadData();
    const params = new URLSearchParams(location.search);
    const customerId = params.get("customer");
    if (customerId) setSelectedCustomer(customerId);
  }, [location.search]);

  const loadData = async () => {
    try {
      const [customersRes, articlesRes, servicesRes] = await Promise.all([
        api.get("/customers"),
        api.get("/articles"),
        api.get("/services")
      ]);
      setCustomers(customersRes.data);
      setArticles(articlesRes.data);
      setServices(servicesRes.data);
    } catch (err) {
      toast.error("Fehler beim Laden der Daten");
    }
  };

  const addPosition = () => {
    setPositions([
      ...positions,
      { pos_nr: positions.length + 1, description: "", quantity: 1, unit: "Stück", price_net: 0 }
    ]);
  };

  const updatePosition = (index, field, value) => {
    const updated = [...positions];
    updated[index][field] = value;
    setPositions(updated);
  };

  const removePosition = (index) => {
    const updated = positions.filter((_, i) => i !== index);
    updated.forEach((p, i) => (p.pos_nr = i + 1));
    setPositions(updated);
  };

  const addArticle = (article) => {
    setPositions([
      ...positions,
      {
        pos_nr: positions.length + 1,
        description: article.name + (article.description ? ` - ${article.description}` : ""),
        quantity: 1,
        unit: article.unit,
        price_net: article.price_net
      }
    ]);
  };

  const addService = (service) => {
    setPositions([
      ...positions,
      {
        pos_nr: positions.length + 1,
        description: service.name + (service.description ? ` - ${service.description}` : ""),
        quantity: 1,
        unit: service.unit,
        price_net: service.price_net
      }
    ]);
  };

  const calculateTotals = () => {
    const subtotal = positions.reduce((sum, p) => sum + p.quantity * p.price_net, 0);
    const vat = subtotal * (vatRate / 100);
    const total = subtotal + vat;
    return { subtotal, vat, total };
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: "audio/webm" });
        stream.getTracks().forEach((track) => track.stop());
        await processAudio(audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);
      toast.info("Aufnahme gestartet - Sprechen Sie jetzt...");
    } catch (err) {
      toast.error("Mikrofon-Zugriff verweigert");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const processAudio = async (audioBlob) => {
    setAiLoading(true);
    try {
      const formData = new FormData();
      formData.append("audio", audioBlob, "recording.webm");

      const sttRes = await axios.post(`${API}/speech-to-text`, formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });

      const text = sttRes.data.text;
      setTranscript(text);

      if (!selectedCustomer) {
        toast.error("Bitte wählen Sie zuerst einen Kunden aus");
        setAiLoading(false);
        return;
      }

      const aiRes = await api.post("/ai/generate-quote", {
        customer_id: selectedCustomer,
        transcribed_text: text,
        vat_rate: vatRate
      });

      if (aiRes.data.positions && aiRes.data.positions.length > 0) {
        setPositions(aiRes.data.positions);
        if (aiRes.data.notes) setNotes(aiRes.data.notes);
        toast.success("Angebot wurde von KI erstellt!");
      }
    } catch (err) {
      console.error(err);
      toast.error("Fehler bei der Sprachverarbeitung");
    } finally {
      setAiLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedCustomer) {
      toast.error("Bitte wählen Sie einen Kunden aus");
      return;
    }
    if (positions.length === 0) {
      toast.error("Bitte fügen Sie mindestens eine Position hinzu");
      return;
    }

    setLoading(true);
    try {
      await api.post("/quotes", {
        customer_id: selectedCustomer,
        positions,
        notes,
        vat_rate: vatRate,
        valid_days: 30
      });
      toast.success("Angebot erstellt!");
      navigate("/quotes");
    } catch (err) {
      toast.error("Fehler beim Erstellen des Angebots");
    } finally {
      setLoading(false);
    }
  };

  const { subtotal, vat, total } = calculateTotals();

  return (
    <div data-testid="new-quote-page">
      <div className="mb-8">
        <h1 className="text-4xl font-bold">Neues Angebot</h1>
        <p className="text-muted-foreground mt-2">Erstellen Sie ein Angebot für Ihren Kunden</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Customer Selection */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Kunde</h3>
            <select
              data-testid="select-customer"
              value={selectedCustomer}
              onChange={(e) => setSelectedCustomer(e.target.value)}
              className="w-full h-10 rounded-sm border border-input bg-background px-3"
            >
              <option value="">Kunde auswählen...</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Card>

          {/* Voice Input */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Spracheingabe</h3>
            <div className="flex items-center gap-4">
              <Button
                data-testid="btn-voice-record"
                variant={isRecording ? "destructive" : "secondary"}
                onClick={isRecording ? stopRecording : startRecording}
                disabled={aiLoading}
                className="flex items-center gap-2"
              >
                {isRecording ? (
                  <>
                    <MicOff className="w-5 h-5" />
                    Aufnahme stoppen
                  </>
                ) : (
                  <>
                    <Mic className="w-5 h-5" />
                    Aufnahme starten
                  </>
                )}
              </Button>
              {isRecording && (
                <span className="flex items-center gap-2 text-destructive">
                  <span className="w-3 h-3 bg-destructive rounded-full recording-pulse"></span>
                  Aufnahme läuft...
                </span>
              )}
              {aiLoading && (
                <span className="flex items-center gap-2 text-muted-foreground">
                  <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></span>
                  KI verarbeitet...
                </span>
              )}
            </div>
            {transcript && (
              <div className="mt-4 p-4 bg-muted rounded-sm">
                <p className="text-sm font-medium text-muted-foreground mb-1">Transkript:</p>
                <p className="text-sm">{transcript}</p>
              </div>
            )}
          </Card>

          {/* Positions */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Positionen</h3>
              <div className="flex gap-2 flex-wrap">
                {services.length > 0 && (
                  <select
                    data-testid="select-service"
                    onChange={(e) => {
                      const service = services.find((s) => s.id === e.target.value);
                      if (service) addService(service);
                      e.target.value = "";
                    }}
                    className="h-10 rounded-sm border border-input bg-background px-3 text-sm"
                  >
                    <option value="">Leistung hinzufügen...</option>
                    {services.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} - {s.price_net.toFixed(2)}€/{s.unit}
                      </option>
                    ))}
                  </select>
                )}
                {articles.length > 0 && (
                  <select
                    data-testid="select-article"
                    onChange={(e) => {
                      const article = articles.find((a) => a.id === e.target.value);
                      if (article) addArticle(article);
                      e.target.value = "";
                    }}
                    className="h-10 rounded-sm border border-input bg-background px-3 text-sm"
                  >
                    <option value="">Artikel hinzufügen...</option>
                    {articles.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} - {a.price_net.toFixed(2)}€
                      </option>
                    ))}
                  </select>
                )}
                <Button variant="outline" onClick={addPosition} data-testid="btn-add-position">
                  <Plus className="w-4 h-4" />
                  Position
                </Button>
              </div>
            </div>

            {positions.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Keine Positionen. Fügen Sie Positionen hinzu oder nutzen Sie die Spracheingabe.
              </p>
            ) : (
              <div className="space-y-4">
                {positions.map((pos, index) => (
                  <div key={index} className="grid grid-cols-12 gap-4 items-start p-4 bg-muted/50 rounded-sm">
                    <div className="col-span-1">
                      <label className="text-xs text-muted-foreground">Pos</label>
                      <Input value={pos.pos_nr} disabled className="bg-background" />
                    </div>
                    <div className="col-span-4">
                      <label className="text-xs text-muted-foreground">Beschreibung</label>
                      <Textarea
                        data-testid={`input-pos-desc-${index}`}
                        value={pos.description}
                        onChange={(e) => updatePosition(index, "description", e.target.value)}
                        rows={2}
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="text-xs text-muted-foreground">Menge</label>
                      <Input
                        data-testid={`input-pos-qty-${index}`}
                        type="number"
                        step="0.01"
                        value={pos.quantity}
                        onChange={(e) => updatePosition(index, "quantity", parseFloat(e.target.value) || 0)}
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="text-xs text-muted-foreground">Einheit</label>
                      <Input
                        data-testid={`input-pos-unit-${index}`}
                        value={pos.unit}
                        onChange={(e) => updatePosition(index, "unit", e.target.value)}
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="text-xs text-muted-foreground">Preis (€)</label>
                      <Input
                        data-testid={`input-pos-price-${index}`}
                        type="number"
                        step="0.01"
                        value={pos.price_net}
                        onChange={(e) => updatePosition(index, "price_net", parseFloat(e.target.value) || 0)}
                      />
                    </div>
                    <div className="col-span-1 flex items-end">
                      <button
                        onClick={() => removePosition(index)}
                        className="p-2 hover:bg-destructive/10 hover:text-destructive rounded-sm"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Notes */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Anmerkungen</h3>
            <Textarea
              data-testid="input-quote-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Zusätzliche Anmerkungen zum Angebot..."
              rows={4}
            />
          </Card>
        </div>

        {/* Summary Sidebar */}
        <div className="space-y-6">
          <Card className="p-6 sticky top-6">
            <h3 className="text-lg font-semibold mb-4">Zusammenfassung</h3>
            
            <div className="mb-4">
              <label className="text-sm font-medium mb-2 block">MwSt-Satz</label>
              <select
                data-testid="select-vat-rate"
                value={vatRate}
                onChange={(e) => setVatRate(parseFloat(e.target.value))}
                className="w-full h-10 rounded-sm border border-input bg-background px-3"
              >
                <option value={19}>19% MwSt</option>
                <option value={7}>7% MwSt</option>
                <option value={0}>0% (Kleinunternehmer)</option>
              </select>
            </div>

            <div className="space-y-3 py-4 border-t">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Netto</span>
                <span className="font-mono">{subtotal.toFixed(2)} €</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">MwSt ({vatRate}%)</span>
                <span className="font-mono">{vat.toFixed(2)} €</span>
              </div>
              <div className="flex justify-between text-lg font-bold pt-3 border-t">
                <span>Gesamt</span>
                <span className="font-mono">{total.toFixed(2)} €</span>
              </div>
            </div>

            <Button
              data-testid="btn-save-quote"
              className="w-full mt-4"
              onClick={handleSubmit}
              disabled={loading || positions.length === 0}
            >
              {loading ? "Speichern..." : "Angebot erstellen"}
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
};


export { NewQuotePage };
