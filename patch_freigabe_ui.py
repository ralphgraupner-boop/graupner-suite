#!/usr/bin/env python3
"""
Patch-Skript: 'Wartet auf Freigabe'-Bereich in BenutzerTab.jsx einbauen.
Nutzt zeilenbasierte, whitespace-tolerante Pruefung (strip-Vergleich),
damit kleine Einrueckungs-Unterschiede das Skript nicht scheitern lassen.
Alles-oder-nichts: erst alle Pruefungen, dann Backup, dann Schreiben.
"""

import shutil
import sys
from datetime import datetime

PFAD = "/home/graupner/graupner-suite/frontend/src/pages/settings/BenutzerTab.jsx"


def get_indent(line):
    return line[:len(line) - len(line.lstrip())]


def main():
    with open(PFAD, "r", encoding="utf-8") as f:
        lines = f.readlines()

    # --- Anker 1: "return (" (fuer neue Consts + Handler-Funktionen) ---
    return_idx = None
    for i, line in enumerate(lines):
        if line.strip() == "return (":
            if return_idx is not None:
                print("ABBRUCH: 'return (' kommt mehrfach vor. Es wurde NICHTS geaendert.")
                sys.exit(1)
            return_idx = i
    if return_idx is None:
        print("ABBRUCH: 'return (' nicht gefunden. Es wurde NICHTS geaendert.")
        sys.exit(1)
    print(f"OK: 'return (' gefunden in Zeile {return_idx + 1}")

    # --- Anker 2: "{users.map((u) => (" ---
    users_map_idx = None
    for i, line in enumerate(lines):
        if line.strip() == "{users.map((u) => (":
            if users_map_idx is not None:
                print("ABBRUCH: '{users.map((u) => (' kommt mehrfach vor. Es wurde NICHTS geaendert.")
                sys.exit(1)
            users_map_idx = i
    if users_map_idx is None:
        print("ABBRUCH: '{users.map((u) => (' nicht gefunden. Es wurde NICHTS geaendert.")
        sys.exit(1)
    print(f"OK: '{{users.map((u) => (' gefunden in Zeile {users_map_idx + 1}")

    # --- Anker 3: Zeile mit "users.length === 0 &&" ---
    length_idx = None
    for i, line in enumerate(lines):
        if "users.length === 0 &&" in line and "activeUsers" not in line:
            if length_idx is not None:
                print("ABBRUCH: 'users.length === 0 &&' kommt mehrfach vor. Es wurde NICHTS geaendert.")
                sys.exit(1)
            length_idx = i
    if length_idx is None:
        print("ABBRUCH: 'users.length === 0 &&' nicht gefunden. Es wurde NICHTS geaendert.")
        sys.exit(1)
    print(f"OK: 'users.length === 0 &&' gefunden in Zeile {length_idx + 1}")

    # --- Anker 4: '<div className="space-y-3">' direkt vor users_map_idx ---
    space_y3_idx = None
    for i in range(users_map_idx - 1, max(users_map_idx - 5, -1), -1):
        if lines[i].strip() == '<div className="space-y-3">':
            space_y3_idx = i
            break
    if space_y3_idx is None:
        print("ABBRUCH: umschliessendes '<div className=\"space-y-3\">' nicht gefunden. Es wurde NICHTS geaendert.")
        sys.exit(1)
    print(f"OK: umschliessendes space-y-3-div gefunden in Zeile {space_y3_idx + 1}")

    # --- Backup ---
    zeitstempel = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_pfad = f"{PFAD}.backup_freigabe_ui_{zeitstempel}"
    shutil.copy2(PFAD, backup_pfad)
    print(f"Backup angelegt: {backup_pfad}")

    indent_base = get_indent(lines[space_y3_idx])       # Einrueckung der space-y-3-Zeile
    indent_inner = indent_base + "  "

    # --- Block A: Consts + Handler vor 'return (' einfuegen ---
    block_a = (
        f"{indent_base}const pendingUsers = users.filter(u => u.freigabe_status === \"wartet\");\n"
        f"{indent_base}const activeUsers = users.filter(u => u.freigabe_status !== \"wartet\");\n"
        f"\n"
        f"{indent_base}const handleFreigeben = async (username) => {{\n"
        f"{indent_inner}try {{\n"
        f"{indent_inner}  await api.put(`/users/${{username}}/freigabe`);\n"
        f"{indent_inner}  toast.success(\"Benutzer freigegeben\");\n"
        f"{indent_inner}  loadUsers();\n"
        f"{indent_inner}}} catch (err) {{\n"
        f"{indent_inner}  toast.error(err.response?.data?.detail || \"Freigabe fehlgeschlagen\");\n"
        f"{indent_inner}}}\n"
        f"{indent_base}}};\n"
        f"\n"
        f"{indent_base}const handleAblehnen = async (username) => {{\n"
        f"{indent_inner}try {{\n"
        f"{indent_inner}  await api.delete(`/users/${{username}}/ablehnen`);\n"
        f"{indent_inner}  toast.success(\"Registrierung abgelehnt und geloescht\");\n"
        f"{indent_inner}  loadUsers();\n"
        f"{indent_inner}}} catch (err) {{\n"
        f"{indent_inner}  toast.error(err.response?.data?.detail || \"Ablehnen fehlgeschlagen\");\n"
        f"{indent_inner}}}\n"
        f"{indent_base}}};\n"
        f"\n"
    )

    # --- Block B: Wartet-auf-Freigabe-UI vor dem space-y-3-div einfuegen ---
    block_b = (
        f"{indent_base}{{pendingUsers.length > 0 && (\n"
        f"{indent_inner}<div className=\"mb-4 p-4 rounded-lg border border-amber-300 bg-amber-50\" data-testid=\"pending-users-section\">\n"
        f"{indent_inner}  <h4 className=\"text-sm font-semibold text-amber-800 mb-2\">Wartet auf Freigabe ({{pendingUsers.length}})</h4>\n"
        f"{indent_inner}  <div className=\"space-y-2\">\n"
        f"{indent_inner}    {{pendingUsers.map((u) => (\n"
        f"{indent_inner}      <div key={{u.username}} className=\"flex items-center gap-4 p-3 bg-white rounded-lg border\" data-testid={{`pending-${{u.username}}`}}>\n"
        f"{indent_inner}        <div className=\"flex-1 min-w-0\">\n"
        f"{indent_inner}          <p className=\"text-sm font-semibold\">{{u.username}}</p>\n"
        f"{indent_inner}          <p className=\"text-xs text-muted-foreground\">{{u.email || \"Keine E-Mail\"}}</p>\n"
        f"{indent_inner}        </div>\n"
        f"{indent_inner}        <div className=\"flex gap-2\">\n"
        f"{indent_inner}          <Button size=\"sm\" onClick={{() => handleFreigeben(u.username)}} data-testid={{`btn-freigeben-${{u.username}}`}}>Freigeben</Button>\n"
        f"{indent_inner}          <Button variant=\"outline\" size=\"sm\" onClick={{() => handleAblehnen(u.username)}} data-testid={{`btn-ablehnen-${{u.username}}`}}>Ablehnen</Button>\n"
        f"{indent_inner}        </div>\n"
        f"{indent_inner}      </div>\n"
        f"{indent_inner}    ))}}\n"
        f"{indent_inner}  </div>\n"
        f"{indent_inner}</div>\n"
        f"{indent_base})}}\n"
        f"\n"
    )

    # --- Zeile mit users.map -> activeUsers.map ---
    lines[users_map_idx] = lines[users_map_idx].replace("{users.map((u) => (", "{activeUsers.map((u) => (")

    # --- Zeile mit users.length === 0 -> activeUsers.length === 0 ---
    lines[length_idx] = lines[length_idx].replace("users.length === 0 &&", "activeUsers.length === 0 &&")

    # --- Einfuegen, von hinten nach vorne, damit Indizes stabil bleiben ---
    lines.insert(space_y3_idx, block_b)
    lines.insert(return_idx, block_a)

    with open(PFAD, "w", encoding="utf-8") as f:
        f.writelines(lines)

    print("FERTIG: Alle Aenderungen erfolgreich geschrieben.")


if __name__ == "__main__":
    main()
