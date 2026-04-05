import { useState, useEffect, useCallback } from "react";
import { Share2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/common";
import { api } from "@/lib/api";

/**
 * Prüft ob ein Portal existiert und zeigt den passenden Button:
 * - "Kundenportal erstellen" (erstellt + sendet Einladung automatisch)
 * - "Zum Kundenportal" (Link zum vorhandenen Portal)
 *
 * Props:
 * - email: E-Mail des Kunden (für Lookup)
 * - customerId: Kunden-ID (optional, für Lookup + Erstellung)
 * - anfragId: Anfrage-ID (optional, für from-anfrage Endpoint)
 * - size: "sm" | "default"
 */
export const PortalButtons = ({ email, customerId, anfrageId, size = "sm" }) => {
  const [portal, setPortal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const lookupPortal = useCallback(async () => {
    if (!email && !customerId && !anfrageId) { setLoading(false); return; }
    try {
      const params = new URLSearchParams();
      if (email) params.append("email", email);
      if (customerId) params.append("customer_id", customerId);
      if (anfrageId) params.append("anfrage_id", anfrageId);
      const res = await api.get(`/portals/lookup?${params}`);
      setPortal(res.data);
    } catch {
      setPortal(null);
    } finally { setLoading(false); }
  }, [email, customerId, anfrageId]);

  useEffect(() => { lookupPortal(); }, [lookupPortal]);

  const createPortal = async () => {
    setCreating(true);
    try {
      let res;
      if (anfrageId) {
        res = await api.post(`/portals/from-anfrage/${anfrageId}`, {
          portal_base_url: window.location.origin,
        });
      } else if (customerId) {
        res = await api.post(`/portals/from-customer/${customerId}`, {
          portal_base_url: window.location.origin,
        });
      } else {
        toast.error("Keine Kunden-ID oder Anfrage-ID");
        return;
      }
      const p = res.data;
      setPortal(p);
      const msgs = ["Kundenportal erstellt"];
      if (p.customer_created) msgs.push("Kunde angelegt");
      if (p.email_sent) msgs.push("Einladung + Passwort versendet");
      toast.success(msgs.join(" · "));
    } catch (err) {
      toast.error(err.response?.data?.detail || "Fehler beim Erstellen");
    } finally { setCreating(false); }
  };

  if (loading) return null;

  if (portal && portal.token) {
    return (
      <div className="flex gap-2">
        <Button size={size} variant="outline" asChild data-testid="btn-goto-portal">
          <a href={`/portal/${portal.token}`} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="w-4 h-4" /> Zum Kundenportal
          </a>
        </Button>
      </div>
    );
  }

  return (
    <Button
      size={size}
      onClick={createPortal}
      disabled={creating || !email}
      title={!email ? "Keine E-Mail-Adresse vorhanden" : ""}
      data-testid="btn-create-portal"
    >
      <Share2 className="w-4 h-4" />
      {creating ? "Erstelle..." : "Kundenportal erstellen"}
    </Button>
  );
};
