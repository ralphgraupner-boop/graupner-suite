"""KI-Tools fuer den Assistent.

Jedes Tool hat:
- schema: was GPT-5.2 sehen darf (Name, Beschreibung, Pflichtfelder)
- executor: async Funktion, die das Tool tatsaechlich ausfuehrt

Die Tools schreiben direkt in die existierenden Collections und verwenden
dieselbe Struktur wie die normalen Create-Endpoints. Auth wurde bereits am
/ask-Endpoint geprueft.
"""
from __future__ import annotations
from uuid import uuid4
from datetime import datetime, timezone
from typing import Optional, Dict, Any

from database import db, logger
from routes.mitarbeiter import check_berechtigung


# Mapping: KI-Tool -> bestehender Berechtigungsbereich (Regel 4: keine Doppelung)
TOOL_BERECHTIGUNG = {
    "aufgabe_anlegen": "modul_aufgaben",
    "termin_anlegen": "modul_termine",
    "kunde_suchen": "modul_kunden",
    "notiz_schreiben": "modul_aufgaben",
}


# ==================== TOOL-SCHEMA ====================
# Wird in den GPT-System-Prompt eingebettet, damit das Modell die richtige
# Tool-ID + Felder zurueckgibt.
TOOLS_SCHEMA = [
    {
        "name": "aufgabe_anlegen",
        "beschreibung": "Lege eine neue Aufgabe / To-do an.",
        "felder": {
            "titel": "Pflicht. Kurzer Titel der Aufgabe.",
            "beschreibung": "Optional. Lange Beschreibung.",
            "faellig_am": "Optional. ISO-Datum YYYY-MM-DD (z.B. '2026-06-05').",
            "prioritaet": "Optional. Eine von: niedrig, normal, hoch, dringend.",
            "kunde_id": "Optional. ID des verknuepften Kunden (falls bekannt).",
            "projekt_id": "Optional. ID des verknuepften Projekts (falls bekannt).",
        },
    },
    {
        "name": "termin_anlegen",
        "beschreibung": "Lege einen Termin in den Kalender. Wenn monteur_username gesetzt ist, wird automatisch eine ICS-Mail an diesen User versendet.",
        "felder": {
            "titel": "Pflicht. Titel des Termins.",
            "start": "Pflicht. ISO-Datetime, z.B. '2026-06-05T10:00'.",
            "ende": "Optional. ISO-Datetime des Endes.",
            "ort": "Optional. Adresse oder Ortsangabe.",
            "beschreibung": "Optional.",
            "typ": "Optional. Eine von: besichtigung, ausfuehrung, abnahme, intern, sonstiges.",
            "kunde_id": "Optional. Kunden-ID.",
            "projekt_id": "Optional. Projekt-ID.",
            "monteur_username": "Optional. Login-Username des zustaendigen Mitarbeiters (z.B. 'thorsten.graupner'). Wenn gesetzt: ICS-Mail wird automatisch versendet.",
        },
    },
    {
        "name": "kunde_suchen",
        "beschreibung": "Suche Kunden nach Name, Firma, Ort oder E-Mail. Gibt Top 5 zurueck.",
        "felder": {
            "query": "Pflicht. Suchbegriff.",
        },
    },
    {
        "name": "notiz_schreiben",
        "beschreibung": "Speichere eine kurze Notiz (als Aufgabe mit Kategorie 'notiz').",
        "felder": {
            "text": "Pflicht. Der Notiz-Inhalt.",
            "kunde_id": "Optional. Kunden-ID falls zugeordnet.",
            "projekt_id": "Optional. Projekt-ID falls zugeordnet.",
        },
    },
]


async def system_prompt_de() -> str:
    """System-Prompt fuer GPT-5.2 — persoenliche Ansprache an Ralph.

    Laedt die aktuelle Mitarbeiter-Liste dynamisch aus db.users (kein Hardcode).
    """
    tool_text = "\n".join(
        f"- {t['name']}: {t['beschreibung']}\n  Felder: " +
        ", ".join(f"{k} ({v})" for k, v in t["felder"].items())
        for t in TOOLS_SCHEMA
    )

    # Mitarbeiter-Liste dynamisch aus db.users laden (Regel 4: kein Hardcode)
    mitarbeiter_zeilen = []
    try:
        users_cursor = db.users.find(
            {}, {"_id": 0, "username": 1, "vorname": 1, "nachname": 1, "role": 1}
        )
        users = await users_cursor.to_list(50)
        for u in users:
            anzeige = f"{u.get('vorname','')} {u.get('nachname','')}".strip() or u.get("username", "")
            mitarbeiter_zeilen.append(f"  - {anzeige} -> username: '{u.get('username','')}' ({u.get('role','')})")
    except Exception:
        pass
    mitarbeiter_block = (
        "Bekannte Mitarbeiter / Logins (fuer Feld 'monteur_username'):\n"
        + ("\n".join(mitarbeiter_zeilen) if mitarbeiter_zeilen else "  (keine geladen)")
    )

    return (
        "Du bist Ralphs persoenlicher Assistent fuer die Graupner Suite "
        "(Tischlerei-CRM). Sprich ihn locker und direkt an ('Hab ich dir "
        "eingetragen, Ralph'). Antworte AUSSCHLIESSLICH mit JSON in genau "
        "diesem Format und KEINE Erklaerung drumherum:\n"
        '{\n  "tool": "<name>" oder null,\n'
        '  "args": { ... },\n'
        '  "antwort": "<kurzer freundlicher Bestaetigungstext fuer Ralph>"\n}\n\n'
        "Wenn die Eingabe nicht zu einem Tool passt (Smalltalk, unklare Anfrage), "
        "setze 'tool': null und antworte hilfreich. Heutiges Datum: "
        f"{datetime.now(timezone.utc).strftime('%Y-%m-%d')} (UTC). "
        "Hamburger Zeit liegt 1-2 Stunden voraus, achte bei Termin-Zeiten darauf.\n\n"
        "Verfuegbare Tools:\n" + tool_text + "\n\n"
        + mitarbeiter_block + "\n\n"
        "WICHTIG fuer 'termin_anlegen': Wenn der Eingabetext einen Mitarbeiter-Namen aus der "
        "obigen Liste enthaelt (Vorname oder Nachname reicht), setze IMMER 'monteur_username' "
        "auf den passenden Login aus der Liste. Ohne dieses Feld wird KEINE ICS-Mail versendet.\n\n"
        "Beispiele:\n"
        'Eingabe: "Leg eine Aufgabe an: morgen Schmidt anrufen"\n'
        '{"tool":"aufgabe_anlegen","args":{"titel":"Schmidt anrufen","faellig_am":"2026-06-02"},'
        '"antwort":"Hab ich dir eingetragen, Ralph: morgen Schmidt anrufen."}\n\n'
        'Eingabe: "Termin Donnerstag 10 Uhr mit Mueller, Besichtigung, Thorsten macht das"\n'
        '{"tool":"termin_anlegen","args":{"titel":"Besichtigung Mueller","start":"2026-06-04T10:00","typ":"besichtigung","monteur_username":"thorsten.graupner"},'
        '"antwort":"Termin Donnerstag 10:00 mit Mueller — Thorsten kriegt die Mail."}'
    )


# ==================== TOOL-EXEKUTIONEN ====================

async def _resolve_kunde(query: str) -> list:
    """Hilfsfunktion: top 5 Kunden zur Query."""
    if not query or not query.strip():
        return []
    q = query.strip()
    # Suche in Vorname, Nachname, name, firma, email, ort
    rx = {"$regex": q, "$options": "i"}
    cursor = db.module_kunden.find(
        {"$or": [
            {"vorname": rx}, {"nachname": rx}, {"name": rx},
            {"firma": rx}, {"email": rx}, {"ort": rx},
        ]},
        {"_id": 0, "id": 1, "vorname": 1, "nachname": 1, "name": 1, "firma": 1,
         "email": 1, "phone": 1, "plz": 1, "ort": 1},
    ).limit(5)
    return await cursor.to_list(5)


async def tool_aufgabe_anlegen(args: Dict[str, Any], user: dict) -> Dict[str, Any]:
    titel = (args.get("titel") or "").strip()
    if not titel:
        return {"ok": False, "error": "Titel fehlt."}
    now = datetime.now(timezone.utc).isoformat()
    item = {
        "id": str(uuid4()),
        "titel": titel,
        "beschreibung": (args.get("beschreibung") or "").strip(),
        "kategorie": "sonstige",
        "prioritaet": (args.get("prioritaet") or "normal").strip() or "normal",
        "zugewiesen_an": "",
        "faellig_am": (args.get("faellig_am") or "").strip(),
        "wiederholung": "einmalig",
        "kunde_id": (args.get("kunde_id") or "").strip(),
        "projekt_id": (args.get("projekt_id") or "").strip(),
        "status": "offen",
        "erstellt_am": now,
        "erledigt_am": None,
        "created_by": (user or {}).get("username", "ki"),
        "created_via": "ki-assistent",
    }
    await db.module_aufgaben.insert_one(item)
    item.pop("_id", None)
    logger.info(f"KI-Tool aufgabe_anlegen: {titel}")
    return {"ok": True, "aufgabe": item, "direkt_link": f"/module/aufgaben?highlight={item['id']}"}


async def tool_termin_anlegen(args: Dict[str, Any], user: dict) -> Dict[str, Any]:
    titel = (args.get("titel") or "").strip()
    start = (args.get("start") or "").strip()
    if not titel:
        return {"ok": False, "error": "Titel fehlt."}
    if not start:
        return {"ok": False, "error": "Startzeit fehlt."}
    typ = (args.get("typ") or "ausfuehrung").strip()
    valid_typ = ["besichtigung", "ausfuehrung", "abnahme", "intern", "sonstiges"]
    if typ not in valid_typ:
        typ = "ausfuehrung"

    now = datetime.now(timezone.utc).isoformat()
    item = {
        "id": str(uuid4()),
        "titel": titel,
        "typ": typ,
        "start": start,
        "ende": (args.get("ende") or "").strip(),
        "ort": (args.get("ort") or "").strip(),
        "beschreibung": (args.get("beschreibung") or "").strip(),
        "kunde_id": (args.get("kunde_id") or "").strip(),
        "projekt_id": (args.get("projekt_id") or "").strip(),
        "aufgabe_id": "",
        "monteur_username": (args.get("monteur_username") or "").strip(),
        "status": "wartet_auf_go",
        "go_at": None,
        "go_by": None,
        "im_kalender_at": None,
        "google_event_id": None,
        "abgesagt_at": None,
        "abgesagt_grund": "",
        "sort_order": 0,
        "created_at": now,
        "updated_at": now,
        "created_by": (user or {}).get("username", "ki"),
        "created_via": "ki-assistent",
    }
    await db.module_termine.insert_one(item)
    item.pop("_id", None)
    logger.info(f"KI-Tool termin_anlegen: {titel} @ {start}")

    # ICS-Mail an den im Termin zugeordneten Monteur (kein Hardcode)
    # Empfaenger kommt aus db.users via monteur_username (vorhandene Datenmaske).
    ics_status = "kein_monteur"
    monteur_username = item.get("monteur_username", "").strip()
    if monteur_username:
        try:
            from module_kalender_export.ics_generator import build_ics_event
            from utils import send_email

            empfaenger = await db.users.find_one(
                {"username": monteur_username},
                {"_id": 0, "email": 1, "vorname": 1, "nachname": 1},
            )
            empf_email = (empfaenger or {}).get("email", "").strip()
            if empf_email:
                ics_text = build_ics_event(item, kunde=None)
                empf_name = (
                    f"{(empfaenger or {}).get('vorname','')} {(empfaenger or {}).get('nachname','')}".strip()
                    or monteur_username
                )
                send_email(
                    to_email=empf_email,
                    subject=f"Neuer Termin: {titel}",
                    body_html=(
                        f"<p>Hallo {empf_name},</p>"
                        f"<p>Ralph hat per KI-Assistent einen Termin angelegt:</p>"
                        f"<ul><li><b>{titel}</b></li><li>Start: {start}</li>"
                        f"<li>Ort: {item['ort'] or '—'}</li></ul>"
                        f"<p>Die ICS-Datei im Anhang antippen — Termin landet im Kalender.</p>"
                        f"<p>Gruß,<br/>Graupner Suite</p>"
                    ),
                    attachments=[{"filename": "termin.ics", "data": ics_text.encode("utf-8")}],
                )
                ics_status = f"versendet:{empf_email}"
            else:
                ics_status = f"monteur_ohne_email:{monteur_username}"
        except Exception as exc:
            logger.warning(f"ICS-Mail fehlgeschlagen: {exc}")
            ics_status = f"fehler:{exc.__class__.__name__}"

    return {"ok": True, "termin": item, "ics_mail": ics_status, "direkt_link": f"/module/termine?highlight={item['id']}"}


async def tool_kunde_suchen(args: Dict[str, Any], user: dict) -> Dict[str, Any]:
    query = args.get("query") or ""
    treffer = await _resolve_kunde(query)
    return {
        "ok": True,
        "treffer": treffer,
        "anzahl": len(treffer),
        "direkt_link": f"/module/kunden?search={query}" if query else "/module/kunden",
    }


async def tool_notiz_schreiben(args: Dict[str, Any], user: dict) -> Dict[str, Any]:
    text = (args.get("text") or "").strip()
    if not text:
        return {"ok": False, "error": "Text fehlt."}
    # Notizen werden als Aufgabe mit Kategorie 'notiz' gespeichert
    now = datetime.now(timezone.utc).isoformat()
    titel_kurz = text[:80] + ("…" if len(text) > 80 else "")
    item = {
        "id": str(uuid4()),
        "titel": titel_kurz,
        "beschreibung": text,
        "kategorie": "notiz",
        "prioritaet": "normal",
        "zugewiesen_an": "",
        "faellig_am": "",
        "wiederholung": "einmalig",
        "kunde_id": (args.get("kunde_id") or "").strip(),
        "projekt_id": (args.get("projekt_id") or "").strip(),
        "status": "offen",
        "erstellt_am": now,
        "erledigt_am": None,
        "created_by": (user or {}).get("username", "ki"),
        "created_via": "ki-assistent-notiz",
    }
    await db.module_aufgaben.insert_one(item)
    item.pop("_id", None)
    return {"ok": True, "notiz": item, "direkt_link": f"/module/aufgaben?highlight={item['id']}"}


TOOLS = {
    "aufgabe_anlegen": tool_aufgabe_anlegen,
    "termin_anlegen": tool_termin_anlegen,
    "kunde_suchen": tool_kunde_suchen,
    "notiz_schreiben": tool_notiz_schreiben,
}


async def execute_tool(name: str, args: Dict[str, Any], user: dict) -> Dict[str, Any]:
    fn = TOOLS.get(name)
    if not fn:
        return {"ok": False, "error": f"Unbekanntes Tool: {name}"}
    # Berechtigungs-Check vor jeder Ausfuehrung (Regel 4: nutzt vorhandene Funktion)
    bereich = TOOL_BERECHTIGUNG.get(name)
    if bereich:
        erlaubt = await check_berechtigung(user or {}, bereich)
        if not erlaubt:
            logger.info(f"KI-Tool '{name}' abgelehnt: keine Berechtigung fuer '{bereich}' (user={user.get('username','?')})")
            return {
                "ok": False,
                "error": "keine_berechtigung",
                "bereich": bereich,
                "hinweis": f"Du hast keine Berechtigung fuer '{bereich}'. Bitte einen Admin fragen.",
            }
    try:
        return await fn(args or {}, user or {})
    except Exception as exc:
        logger.error(f"Tool '{name}' Fehler: {exc}")
        return {"ok": False, "error": f"Ausfuehrung fehlgeschlagen: {exc}"}
