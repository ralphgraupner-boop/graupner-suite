import { useState, useEffect, useRef } from "react";
import { ArrowLeft, Wrench, Mic, MicOff, Mail, Printer, Download, Save, X, Bookmark, Eye, ExternalLink, Package, Calculator, ChevronDown, FileCheck2, FileSearch } from "lucide-react";
import { Button, Badge } from "@/components/common";
import { HelpTip } from "@/components/HelpTip";

const EditorToolbar = ({
  type, isNew, titles, listPaths, docNumber, status, selectedCustomerId,
  isRecording, aiLoading, saving,
  navigate, setShowSettings, startRecording, stopRecording, handleBack,
  handleSave, handleExit, handleDownloadPDF, handlePrint,
  onOpenMailClient, onToggleVorlagen, onTogglePreview,
  onOpenDocTemplates, onToggleLohnkosten, onToggleLeistungen, onOpenDocCheck, onOpenPdfPreview,
  zoomLevel, setZoomLevel,
}) => {
  // Werkzeuge-Dropdown (Einstellungen, Vorlage, Bausteine, Vorschau)
  const [werkzeugeOffen, setWerkzeugeOffen] = useState(false);
  const werkzeugeRef = useRef(null);
  useEffect(() => {
    if (!werkzeugeOffen) return undefined;
    const onDown = (e) => {
      if (werkzeugeRef.current && !werkzeugeRef.current.contains(e.target)) setWerkzeugeOffen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [werkzeugeOffen]);

  return (
    <div className="fixed top-0 left-0 right-0 bg-card text-card-foreground border-b z-40 shadow-sm">
      <div className="lg:max-w-[900px] lg:mx-auto flex items-center justify-between px-3 lg:px-4 py-2 lg:py-3">
        <div className="flex items-center gap-2 lg:gap-4 min-w-0">
          <Button variant="ghost" size="sm" onClick={handleBack} className="text-foreground">
            <ArrowLeft className="w-4 h-4 lg:w-5 lg:h-5" />
            <span className="hidden sm:inline">Zurück</span>
          </Button>
          <div className="h-6 w-px bg-border hidden sm:block" />
          <h1 className="text-sm lg:text-xl font-bold text-primary truncate">
            {isNew ? `${titles[type]}` : `${titles[type]} ${docNumber}`}
          </h1>
        </div>
        <div className="flex items-center gap-1.5 lg:gap-2 shrink-0 [&_span]:text-xs">
          {/* Werkzeuge-Dropdown: Einstellungen, Vorlage oeffnen, Bausteine, Vorschau */}
          <div className="relative" ref={werkzeugeRef}>
            <Button variant="outline" size="sm" onClick={() => setWerkzeugeOffen(v => !v)} data-testid="btn-werkzeuge-topbar" className="bg-background text-foreground border-border">
              <Wrench className="w-4 h-4" />
              <span className="hidden sm:inline">Werkzeuge</span>
              <ChevronDown className={`w-3 h-3 ml-0.5 transition-transform ${werkzeugeOffen ? "rotate-180" : ""}`} />
            </Button>
            {werkzeugeOffen && (
              <div className="absolute right-0 top-full mt-1 z-50 bg-card border rounded-sm shadow-lg min-w-[200px]" data-testid="werkzeuge-dropdown">
                <button onClick={() => { setShowSettings(true); setWerkzeugeOffen(false); }} className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-muted flex items-center gap-2" data-testid="btn-werkzeuge-settings">
                  <Wrench className="w-4 h-4" /> Einstellungen
                </button>
                <button onClick={() => { onOpenDocTemplates(); setWerkzeugeOffen(false); }} className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-muted flex items-center gap-2" data-testid="btn-werkzeuge-templates">
                  <Package className="w-4 h-4" /> Vorlage öffnen
                </button>
                <button onClick={() => { onToggleVorlagen(); setWerkzeugeOffen(false); }} className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-muted flex items-center gap-2" data-testid="btn-werkzeuge-bausteine">
                  <Bookmark className="w-4 h-4" /> Bausteine
                </button>
                <button onClick={() => { onOpenDocCheck(); setWerkzeugeOffen(false); }} className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-muted flex items-center gap-2" data-testid="btn-werkzeuge-pruefen">
                  <FileCheck2 className="w-4 h-4" /> Prüfen
                </button>
                {!isNew && (
                  <button onClick={() => { onTogglePreview(); setWerkzeugeOffen(false); }} className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-muted flex items-center gap-2" data-testid="btn-werkzeuge-preview">
                    <Eye className="w-4 h-4" /> Vorschau
                  </button>
                )}
                {setZoomLevel && (
                  <>
                    <div className="border-t my-1" />
                    <div className="px-3 py-1.5">
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Zoom</div>
                      <div className="flex items-center border rounded-sm overflow-hidden" data-testid="werkzeuge-zoom-group">
                        {[75, 100, 125, 150].map(z => (
                          <button
                            key={z}
                            onClick={() => setZoomLevel(z)}
                            className={`flex-1 px-2 py-1 text-xs font-medium border-l first:border-l-0 ${zoomLevel === z ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-muted'}`}
                            data-testid={`btn-zoom-${z}`}
                            title={`Ansicht ${z}%`}
                          >
                            {z}%
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
          <Button variant="outline" size="sm" onClick={onToggleLeistungen} data-testid="btn-leistungen-topbar" title="Leistungen & Artikel ein-/ausblenden" className="bg-background text-foreground border-border">
            <Wrench className="w-4 h-4" />
            <span className="hidden sm:inline">Leistungen</span>
          </Button>
          <Button variant="outline" size="sm" onClick={onToggleLohnkosten} data-testid="btn-lohnkosten-topbar" title="Lohnkosten ein-/ausblenden" className="bg-background text-foreground border-border">
            <Calculator className="w-4 h-4" />
            <span className="hidden sm:inline">Lohnkosten</span>
          </Button>
          <Button variant="outline" size="sm" onClick={onOpenPdfPreview} data-testid="btn-pdfpreview-topbar" title="PDF-Vorschau (so wird gedruckt)" className="bg-background text-foreground border-border">
            <FileSearch className="w-4 h-4" />
            <span className="hidden sm:inline">Vorschau</span>
          </Button>
          <Button
            variant={isRecording ? "destructive" : "outline"}
            size="sm"
            onClick={isRecording ? stopRecording : startRecording}
            disabled={aiLoading}
            data-testid="btn-voice-input"
            className={isRecording ? "" : "bg-background text-foreground border-border"}
          >
            {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            <span className="hidden sm:inline">{isRecording ? "Stop" : "Spracheingabe"}</span>
          </Button>
          {aiLoading && (
            <span className="text-xs text-muted-foreground hidden sm:inline">KI verarbeitet...</span>
          )}
          {false && !isNew && (
            <HelpTip id="doc.btn-pdf" placement="bottom" text="Drucken: Speichert den aktuellen Stand und öffnet den Druck-Dialog mit frischem PDF.">
            <Button variant="outline" size="sm" onClick={handlePrint} data-testid="btn-print-document" className="bg-background text-foreground border-border">
              <Printer className="w-4 h-4" />
              <span className="hidden sm:inline">Drucken</span>
            </Button>
            </HelpTip>
          )}
          {/* Drucken-Knopf stillgelegt am 13.07.2026: zeigte UUID statt sprechendem
              Dateinamen beim Speichern (Blob + window.open-Einschraenkung von Chrome).
              Nutze stattdessen "Vorschau" -> Drucken/Download von dort. Code bleibt
              erhalten falls spaeter doch wieder gebraucht. */}
          {false && !isNew && (
            <HelpTip id="doc.btn-pdf" placement="bottom">
            <Button variant="outline" size="sm" onClick={handleDownloadPDF} data-testid="btn-pdf-document" className="bg-background text-foreground border-border">
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">PDF</span>
            </Button>
            </HelpTip>
          )}
          {/* PDF-Knopf stillgelegt am 13.07.2026: gleicher Grund wie Drucken-Knopf
              oben, siehe Kommentar dort. */}
        </div>
      </div>
    </div>
  );
};

export { EditorToolbar };
