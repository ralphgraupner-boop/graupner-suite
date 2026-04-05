import { X, Calculator } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";

const DocumentHeader = ({
  settings, customer, customers, selectedCustomerId,
  handleCustomerChange, type, docNumber, createdAt,
  setPositions, positions,
}) => {
  return (
    <div className="p-4 lg:p-10 border-b">
      <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
        {/* Left: Briefkopf + Brieffenster */}
        <div>
          <div className="flex items-baseline gap-0.5 mb-0.5">
            <span className="text-2xl lg:text-4xl font-bold tracking-tight" style={{ color: "#1a1a1a" }}>Tischlerei</span>
            <span className="text-2xl lg:text-4xl font-bold tracking-tight" style={{ color: "#003399" }}>Graupner</span>
            <span className="text-xs lg:text-sm font-semibold ml-1.5" style={{ color: "#cc0000" }}>seit 1960</span>
          </div>
          <p className="text-xs lg:text-sm font-medium tracking-wide mb-3" style={{ color: "#003399" }}>Mitglied der Handwerkskammer Hamburg</p>
          {/* Abstand für Brieffenster-Höhe */}
          <div className="h-6 lg:h-8"></div>
          {/* DIN 5008 Brieffenster */}
          <div className="max-w-sm">
            <p className="text-[9px] lg:text-[10px] text-muted-foreground border-b border-muted-foreground/30 pb-0.5 mb-2 tracking-wide">
              Tischlerei Graupner · Erlengrund 129 · 22453 Hamburg
            </p>
            {!customer ? (
              <select
                value={selectedCustomerId}
                onChange={(e) => handleCustomerChange(e.target.value)}
                className="w-full h-10 rounded-sm border border-input bg-white px-3 text-sm"
                data-testid="wysiwyg-customer-select"
              >
                <option value="">Kunde auswählen...</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.customer_type !== "Privat" ? `(${c.customer_type})` : ""}
                  </option>
                ))}
              </select>
            ) : (
              <div className="min-h-[70px]">
                <div className="flex items-start justify-between">
                  <div className="text-sm leading-relaxed">
                    <p className="font-semibold">{customer.name}</p>
                    {customer.address && (
                      <p className="whitespace-pre-line text-foreground">{customer.address.split(/,\s*/).join("\n")}</p>
                    )}
                  </div>
                  <button
                    onClick={() => { handleCustomerChange(""); }}
                    className="text-xs text-muted-foreground hover:text-foreground ml-2 mt-0.5"
                    title="Anderen Kunden wählen"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                {customer.address && (
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const res = await api.post("/calculate-distance", { to_address: customer.address });
                        const d = res.data;
                        if (window.confirm(
                          `Entfernung: ${d.distance_km} km (ca. ${d.duration_minutes} Min.)\n` +
                          `km-Kosten: ${d.km_cost.toFixed(2)} €\n` +
                          `Fahrzeit-Kosten: ${d.time_cost.toFixed(2)} €\n` +
                          `Gesamt: ${d.total_cost.toFixed(2)} € netto\n\n` +
                          `Als Position "Fahrtkostenanteil" hinzufügen?`
                        )) {
                          setPositions(prev => [...prev, {
                            type: "position",
                            pos_nr: prev.length + 1,
                            description: `Fahrtkostenanteil (${d.distance_km} km, ca. ${d.duration_minutes} Min.)`,
                            quantity: 1,
                            unit: "pauschal",
                            price_net: d.total_cost
                          }]);
                        }
                      } catch (err) {
                        toast.error(err?.response?.data?.detail || "Entfernung konnte nicht berechnet werden.");
                      }
                    }}
                    className="mt-2 inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
                    data-testid="btn-calc-travel"
                  >
                    <Calculator className="w-3.5 h-3.5" />
                    Fahrtkosten berechnen
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
        {/* Right: Adresse in Blau */}
        <div className="sm:text-right text-xs lg:text-sm font-medium" style={{ color: "#003399" }}>
          <p className="font-bold">Tischlerei Graupner</p>
          <p>Erlengrund 129</p>
          <p>22453 Hamburg</p>
          <p>Tel.: 040 55567744</p>
          <p>Service24@tischlerei-graupner.de</p>
          <p>www.tischlerei-graupner.de</p>
          <p>Steuernummer: 45/076/04744</p>
          {/* Dokument-Metadaten */}
          <div className="mt-3 pt-3 border-t border-blue-200 space-y-0.5 text-xs lg:text-sm">
            <p>Kd.-Nr.: {selectedCustomerId ? selectedCustomerId.substring(0, 8).toUpperCase() : "-"}</p>
            {type !== "quote" && <p>Auft.-Nummer: {type === "order" ? (docNumber || "-") : "-"}</p>}
            <p>Datum: {new Date(createdAt).toLocaleDateString("de-DE")}</p>
            <p>{type === "quote" ? "Angebots-Nr." : type === "order" ? "Auftrags-Nr." : "Rechnungs-Nr."}: {docNumber || "-"}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export { DocumentHeader };
