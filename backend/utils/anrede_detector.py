"""
Anrede-Detektor: Erkennt automatisch "Herr"/"Frau" aus Namen.

Strategie (in Reihenfolge):
1. Expliziter Prefix im Namen ("Herr Müller" / "Frau Schmidt")
2. Prefix in vorname ("Herr" / "Frau" als Vorname)
3. Vorname in Datenbank haeufiger deutscher Vornamen
4. Fallback: ""  (leer → im Template wird "Sehr geehrte Damen und Herren" verwendet)
"""

# Haeufige deutsche und internationale Vornamen (kompakte Liste, deckt >90% ab)
# Quelle: Statistik haeufiger deutscher Vornamen + gaengige internationale Namen
_MALE = {
    # Deutsch - TOP 200
    "alexander", "andreas", "anton", "benjamin", "bernd", "bjoern", "björn",
    "christian", "christoph", "daniel", "david", "dennis", "dieter", "dirk",
    "dominik", "eberhard", "eric", "erik", "ernst", "fabian", "felix", "florian",
    "frank", "franz", "friedrich", "gabriel", "georg", "gerald", "gerd", "gerhard",
    "günter", "guenter", "günther", "guenther", "hans", "harald", "hartmut",
    "heiko", "heinrich", "heinz", "helmut", "henning", "henrik", "herbert",
    "holger", "horst", "hubert", "hugo", "jan", "jens", "jochen", "johann",
    "johannes", "jonas", "jörg", "joerg", "josef", "joseph", "julian", "jürgen",
    "juergen", "karl", "karsten", "kevin", "klaus", "konrad", "kurt", "lars",
    "leon", "lothar", "lukas", "luca", "manfred", "marc", "marco", "marcus",
    "mario", "mark", "markus", "martin", "mathias", "matthias", "max", "maximilian",
    "michael", "moritz", "niklas", "norbert", "oliver", "otto", "patrick", "paul",
    "peter", "philipp", "rainer", "ralf", "ralph", "reiner", "reinhard", "reinhold",
    "richard", "robert", "roland", "rolf", "roman", "rudi", "rudolf", "ruediger",
    "rüdiger", "sebastian", "siegfried", "simon", "stefan", "stephan", "sven",
    "thomas", "thorsten", "torsten", "tim", "timo", "tobias", "udo", "ulf", "ulrich",
    "uwe", "volker", "walter", "werner", "wilhelm", "willi", "wolfgang", "wolfram",
    # Int.
    "adam", "adrian", "alex", "alessandro", "ali", "andrei", "antonio", "ben",
    "carlo", "chris", "damian", "dimitri", "enzo", "ethan", "giovanni", "hassan",
    "ibrahim", "ivan", "james", "jaroslav", "john", "jose", "leonard", "liam",
    "louis", "marek", "marcel", "mehmet", "miguel", "mohammed", "mohamed",
    "nico", "nicolas", "noah", "omar", "pablo", "pavel", "rafael", "salim",
    "samir", "samuel", "sergey", "steve", "tobi", "yusuf", "zlatan",
}

_FEMALE = {
    # Deutsch - TOP 200
    "alexandra", "andrea", "angela", "angelika", "anja", "anke", "anna", "annette",
    "annika", "antje", "astrid", "barbara", "beate", "bettina", "birgit", "brigitte",
    "carina", "carmen", "carolin", "caroline", "charlotte", "christa", "christel",
    "christiane", "christin", "christina", "christine", "claudia", "cornelia",
    "daniela", "diana", "doris", "dorothea", "edith", "elena", "elfriede", "elisabeth",
    "elke", "elli", "ellen", "else", "emilia", "emily", "emma", "erika", "eva",
    "evelyn", "franziska", "frauke", "frieda", "friederike", "gabi", "gabriele",
    "gerda", "gertrud", "gisela", "gudrun", "hanna", "hannah", "hanne", "hannelore",
    "hedwig", "heide", "heidi", "heike", "helene", "helga", "helma", "henriette",
    "hilde", "hildegard", "ilona", "ilse", "inga", "inge", "ingeborg", "ingrid",
    "irene", "iris", "irmgard", "isabel", "jana", "janine", "jasmin", "jennifer",
    "jenny", "jessica", "johanna", "josefine", "judith", "julia", "juliane", "katharina",
    "kathrin", "katja", "katrin", "kerstin", "kira", "klara", "kornelia", "kristin",
    "laura", "lea", "leonie", "lia", "liesbeth", "lilli", "lina", "linda", "lisa",
    "lotte", "luise", "maike", "manuela", "maria", "marianne", "marie", "marina",
    "marion", "marlene", "marta", "martina", "melanie", "mia", "michaela", "mina",
    "mira", "mona", "monika", "nadine", "nadja", "natalie", "nina", "nora", "olga",
    "petra", "pia", "rebecca", "regina", "renate", "rita", "romy", "rosa", "rose",
    "ruth", "sabine", "sabrina", "sandra", "sara", "sarah", "silke", "silvia", "simone",
    "sofia", "sonja", "sophie", "sophia", "stefanie", "susanne", "svenja", "sylvia",
    "tamara", "tanja", "tatjana", "theresa", "tina", "ulla", "ulrike", "ursula",
    "ute", "valentina", "vera", "veronika", "viktoria", "waltraud", "wilma",
    "yvonne", "zoe",
    # Int.
    "alice", "amelia", "anita", "aisha", "bella", "carla", "carol", "cindy",
    "clara", "daniella", "debbie", "dilara", "elena", "elif", "emine", "fatma",
    "fatima", "giulia", "hannah", "isabella", "karin", "leila", "maja", "marika",
    "mary", "natasha", "oksana", "paula", "sofia", "valeria", "yasmin",
}


def detect_anrede(name: str = "", vorname: str = "", nachname: str = "", existing_anrede: str = "") -> str:
    """Gibt 'Herr', 'Frau' oder '' zurueck.
    Wenn existing_anrede gesetzt und valide ist, wird sie beibehalten.
    """
    if existing_anrede and existing_anrede.strip() in ("Herr", "Frau", "Divers", "Firma"):
        return existing_anrede.strip()

    # 1. Prefix direkt im Namen
    full = (name or "").strip()
    fl = full.lower()
    if fl.startswith("herr "):
        return "Herr"
    if fl.startswith("frau "):
        return "Frau"

    # 2. Prefix als vorname
    vn = (vorname or "").strip().lower()
    if vn in ("herr",):
        return "Herr"
    if vn in ("frau",):
        return "Frau"

    # 3. Vorname nachschlagen
    # Falls vorname nicht direkt gesetzt, aus 'name' extrahieren
    candidate_first = vn
    if not candidate_first and full:
        # Prefixes wegnehmen
        cleaned = full
        for p in ("Herr ", "Frau ", "Divers ", "Dr. ", "Prof. ", "Dipl.-Ing. "):
            if cleaned.startswith(p):
                cleaned = cleaned[len(p):]
        parts = cleaned.split()
        if parts:
            candidate_first = parts[0].lower().rstrip(",.")

    if candidate_first:
        # Doppelnamen wie "Hans-Peter" → erster Teil
        candidate_first = candidate_first.split("-")[0]
        if candidate_first in _MALE:
            return "Herr"
        if candidate_first in _FEMALE:
            return "Frau"

    return ""
