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


SAMMEL_PROJEKT_TITEL = "Allgemein / Büro"


async def _hole_oder_lege_sammelprojekt_an(kunde_id: str, user: dict) -> str:
    """Findet das 'Allgemein / Büro'-Sammelprojekt eines Kunden — oder legt es an.

    Wird von KI-Tools genutzt, wenn der User nur 'kunde_id' uebergibt, aber kein
    konkretes Projekt nennt. Damit landet die Aufgabe/Termin trotzdem unter einem
    Projekt (Regel: kunde_id IMPLIZIERT projekt_id).
    """
    if not kunde_id:
        return ""
    existing = await db.module_projekte.find_one(
        {"kunde_id": kunde_id, "titel": SAMMEL_PROJEKT_TITEL},
        {"_id": 0, "id": 1},
    )
    if existing:
        return existing["id"]
    pid = str(uuid4())
    now = datetime.now(timezone.utc).isoformat()
    await db.module_projekte.insert_one({
        "id": pid,
        "kunde_id": kunde_id,
        "titel": SAMMEL_PROJEKT_TITEL,
        "beschreibung": "Sammelprojekt fuer Aufgaben/Termine ohne spezifischen Projektbezug (von KI angelegt).",
        "kategorie": "",
        "status": "Aktiv",
        "created_at": now,
        "updated_at": now,
        "created_by": (user or {}).get("username", "ki-assistent"),
        "sort_order": 9999,
    })
    logger.info(f"KI: Sammelprojekt '{SAMMEL_PROJEKT_TITEL}' fuer Kunde {kunde_id} angelegt ({pid})")
    return pid


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
        "WICHTIG fuer 'termin_anlegen' — IMMER ANWENDEN:\n"
        "Sobald der Eingabetext irgendeinen Namen, Vornamen, Nachnamen oder Kosenamen "
        "eines Mitarbeiters aus der obigen Liste enthaelt (Gross-/Kleinschreibung, Komma, "
        "'fuer X', 'X soll', 'X macht', 'X faehrt hin', 'X kuemmert sich' — egal wie), "
        "MUSST du 'monteur_username' auf den passenden Login aus der Liste setzen. "
        "Wenn der Name uneindeutig ist (mehrere Treffer): nimm den mit Rolle 'admin' oder "
        "'monteur', sonst den ersten. Ohne dieses Feld wird KEINE Mail versendet — "
        "und der Mitarbeiter sieht den Termin nie auf seinem Handy.\n\n"
        "Beispiele:\n"
        'Eingabe: "Leg eine Aufgabe an: morgen Schmidt anrufen"\n'
        '{"tool":"aufgabe_anlegen","args":{"titel":"Schmidt anrufen","faellig_am":"2026-06-02"},'
        '"antwort":"Hab ich dir eingetragen, Ralph: morgen Schmidt anrufen."}\n\n'
        'Eingabe: "Termin Donnerstag 10 Uhr mit Mueller, Besichtigung, Thorsten macht das"\n'
        '{"tool":"termin_anlegen","args":{"titel":"Besichtigung Mueller","start":"2026-06-04T10:00","typ":"besichtigung","monteur_username":"thorsten.graupner"},'
        '"antwort":"Termin Donnerstag 10:00 mit Mueller — Thorsten kriegt die Mail."}\n\n'
        'Eingabe: "Termin morgen 11 Uhr fuer Thorsten"\n'
        '{"tool":"termin_anlegen","args":{"titel":"Termin","start":"2026-06-03T11:00","monteur_username":"thorsten.graupner"},'
        '"antwort":"Hab ich angelegt, Thorsten kriegt die Mail."}\n\n'
        'Eingabe: "Termin 5. Juni 10 Uhr bei Schmidt anlegen, Thorsten faehrt hin"\n'
        '{"tool":"termin_anlegen","args":{"titel":"Termin Schmidt","start":"2026-06-05T10:00","ort":"bei Schmidt","monteur_username":"thorsten.graupner"},'
        '"antwort":"Termin am 5. Juni 10:00 fuer Thorsten — er kriegt die Mail."}'
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
    kunde_id = (args.get("kunde_id") or "").strip()
    projekt_id = (args.get("projekt_id") or "").strip()
    # Wenn Kunde ohne Projekt -> automatisch ins Sammelprojekt
    if kunde_id and not projekt_id:
        projekt_id = await _hole_oder_lege_sammelprojekt_an(kunde_id, user)
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
        "kunde_id": kunde_id,
        "projekt_id": projekt_id,
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

    kunde_id = (args.get("kunde_id") or "").strip()
    projekt_id = (args.get("projekt_id") or "").strip()
    # Wenn Kunde ohne Projekt -> automatisch ins Sammelprojekt
    if kunde_id and not projekt_id:
        projekt_id = await _hole_oder_lege_sammelprojekt_an(kunde_id, user)

    now = datetime.now(timezone.utc).isoformat()
    item = {
        "id": str(uuid4()),
        "titel": titel,
        "typ": typ,
        "start": start,
        "ende": (args.get("ende") or "").strip(),
        "ort": (args.get("ort") or "").strip(),
        "beschreibung": (args.get("beschreibung") or "").strip(),
        "kunde_id": kunde_id,
        "projekt_id": projekt_id,
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

    # Einladungs-Mail an den im Termin zugeordneten Monteur ueber den gemeinsamen
    # Service. Beide Wege (KI und manuell) nutzen baue_termin_mail+sende_termin_einladung.
    # Schema.org/Event JSON-LD in der Mail → Gmail zeigt 1-Tap "Termin hinzufuegen"-Knopf.
    from module_kalender_export.invite_service import sende_termin_einladung
    monteur_username = item.get("monteur_username", "").strip()
    organisator = await db.users.find_one(
        {"username": (user or {}).get("username", "")},
        {"_id": 0, "username": 1, "vorname": 1, "nachname": 1, "email": 1},
    ) or {"username": (user or {}).get("username", "")}
    mail_result = await sende_termin_einladung(
        termin=item,
        monteur_username=monteur_username,
        organisator=organisator,
    )
    # Kompakter Status-String fuer das audit-log (rueckwaertskompatibel mit alten Eintraegen)
    if mail_result.get("ok"):
        ics_status = f"versendet:{mail_result.get('empfaenger_email','')}"
    else:
        ics_status = mail_result.get("status", "fehler")

    return {
        "ok": True,
        "termin": item,
        "ics_mail": ics_status,
        "ics_mail_detail": mail_result,
        "direkt_link": f"/module/termine?highlight={item['id']}",
    }


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
