import { useState } from "react";
import { MailOpen, MailCheck } from "lucide-react";
import { EmailInboxPage } from "./EmailInboxPage";
import { EmailLogPage } from "./EmailLogPage";

const EmailPage = () => {
  const [tab, setTab] = useState("posteingang");

  return (
    <div data-testid="email-page">
      <div className="flex items-center gap-1 mb-6 border-b" data-testid="email-tabs">
        <button
          onClick={() => setTab("posteingang")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
            tab === "posteingang"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
          data-testid="tab-posteingang"
        >
          <MailOpen className="w-4 h-4" /> Posteingang
        </button>
        <button
          onClick={() => setTab("protokoll")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
            tab === "protokoll"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
          data-testid="tab-protokoll"
        >
          <MailCheck className="w-4 h-4" /> Versandprotokoll
        </button>
      </div>
      {tab === "posteingang" ? <EmailInboxPage /> : <EmailLogPage />}
    </div>
  );
};

export { EmailPage };
