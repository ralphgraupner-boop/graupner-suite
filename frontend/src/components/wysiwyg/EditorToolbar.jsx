import { ArrowLeft, Wrench, Mic, MicOff, Mail, Printer, Download, Save, X, Bookmark, Eye, ExternalLink, Package } from "lucide-react";
import { Button, Badge } from "@/components/common";
import { HelpTip } from "@/components/HelpTip";

const EditorToolbar = ({
  type, isNew, titles, listPaths, docNumber, status,
  isRecording, aiLoading, saving,
  navigate, setShowSettings, startRecording, stopRecording,
  handleSave, handleExit, handleDownloadPDF, handlePrint,
  onOpenEmailDialog, onOpenMailClient, onToggleVorlagen, onTogglePreview,
  onOpenDocTemplates,
}) => {
  return (
    <div className="fixed top-0 left-0 right-0 bg-card border-b z-40 shadow-sm">
      <div className="flex items-center justify-between px-3 lg:px-6 py-2 lg:py-3">
        <div className="flex items-center gap-2 lg:gap-4 min-w-0">
          <Button variant="ghost" size="sm" onClick={() => navigate(listPaths[type])}>
            <ArrowLeft className="w-4 h-4 lg:w-5 lg:h-5" />
            <span className="hidden sm:inline">Zurück</span>
          </Button>
          <div className="h-6 w-px bg-border hidden sm:block" />
          <h1 className="text-sm lg:text-xl font-bold text-primary truncate">
            {isNew ? `${titles[type]}` : `${titles[type]} ${docNumber}`}
          </h1>
          {!isNew && (
            <Badge variant={status === "Bezahlt" || status === "Beauftragt" ? "success" : "warning"}>
              {status}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1.5 lg:gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={() => setShowSettings(true)} data-testid="btn-settings-topbar">
            <Wrench className="w-4 h-4" />
            <span className="hidden sm:inline">Einstellungen</span>
          </Button>
          <Button variant="outline" size="sm" onClick={onOpenDocTemplates} data-testid="btn-doc-templates-topbar" className="bg-primary/5 border-primary/30 hover:bg-primary/10 text-primary">
            <Package className="w-4 h-4" />
            <span className="hidden sm:inline">Vorlage öffnen</span>
          </Button>
          <Button variant="outline" size="sm" onClick={onToggleVorlagen} data-testid="btn-vorlagen-topbar">
            <Bookmark className="w-4 h-4" />
            <span className="hidden sm:inline">Bausteine</span>
          </Button>
          {!isNew && (
            <Button variant="outline" size="sm" onClick={onTogglePreview} data-testid="btn-preview-topbar">
              <Eye className="w-4 h-4" />
              <span className="hidden sm:inline">Vorschau</span>
            </Button>
          )}
          <Button
            variant={isRecording ? "destructive" : "outline"}
            size="sm"
            onClick={isRecording ? stopRecording : startRecording}
            disabled={aiLoading}
            data-testid="btn-voice-input"
          >
            {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            <span className="hidden sm:inline">{isRecording ? "Stop" : "Spracheingabe"}</span>
          </Button>
          {aiLoading && (
            <span className="text-xs text-muted-foreground animate-pulse hidden sm:inline">KI verarbeitet...</span>
          )}
          <div className="h-6 w-px bg-border hidden sm:block" />
          {!isNew && (
            <Button variant="outline" size="sm" onClick={onOpenEmailDialog} data-testid="btn-email-document">
              <Mail className="w-4 h-4" />
              <span className="hidden sm:inline">E-Mail</span>
            </Button>
          )}
          {!isNew && onOpenMailClient && (
            <HelpTip id="doc.btn-mail" placement="bottom">
            <Button size="sm" onClick={onOpenMailClient} data-testid="btn-mailto-document" title="In Betterbird / Thunderbird oeffnen" className="bg-blue-600 text-white hover:bg-blue-700">
              <ExternalLink className="w-4 h-4" />
              <span className="hidden sm:inline">Mailprogramm</span>
            </Button>
            </HelpTip>
          )}
          {!isNew && (
            <HelpTip id="doc.btn-pdf" placement="bottom" text="Drucken: Speichert den aktuellen Stand und öffnet den Druck-Dialog mit frischem PDF.">
            <Button variant="outline" size="sm" onClick={handlePrint} data-testid="btn-print-document">
              <Printer className="w-4 h-4" />
              <span className="hidden sm:inline">Drucken</span>
            </Button>
            </HelpTip>
          )}
          {!isNew && (
            <HelpTip id="doc.btn-pdf" placement="bottom">
            <Button variant="outline" size="sm" onClick={handleDownloadPDF} data-testid="btn-pdf-document">
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">PDF</span>
            </Button>
            </HelpTip>
          )}
          <div className="h-6 w-px bg-border hidden sm:block" />
          <HelpTip id="doc.btn-save" placement="bottom">
          <Button size="sm" onClick={handleSave} disabled={saving} data-testid="btn-save-document">
            <Save className="w-4 h-4" />
            <span className="hidden sm:inline">{saving ? "..." : "Speichern"}</span>
          </Button>
          </HelpTip>
          <Button variant="destructive" size="sm" onClick={handleExit} disabled={saving} data-testid="btn-exit-document">
            <X className="w-4 h-4" />
            <span className="hidden sm:inline">Beenden</span>
          </Button>
        </div>
      </div>
    </div>
  );
};

export { EditorToolbar };
