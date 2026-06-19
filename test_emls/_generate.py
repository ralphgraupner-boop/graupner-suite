"""Erzeugt 10 Test-EML-Dateien, die echten weitergeleiteten Jimdo-Anfragen
ähneln (Betreff mit 'FW:' + Jimdo-Signatur). Nur für Preview-Tests."""
import uuid
from email.message import EmailMessage
from email.utils import formatdate
from datetime import datetime, timedelta, timezone
from pathlib import Path

OUT = Path(__file__).parent
SUBJECT = "FW: Nachricht über https://www.tischlerei-graupner.de/schiebetür-reparatur-in-hamburg-schnelle-hilfe/"
JIMDO_URL = "https://www.tischlerei-graupner.de/schiebetür-reparatur-in-hamburg-schnelle-hilfe/"

PERSONEN = [
    ("Herr", "Thomas", "Bergmann", "t.bergmann@email.de", "040 1234561", "Eichenweg 12", "22305", "Hamburg",
     "Unsere Hebeschiebetür zur Terrasse klemmt und lässt sich kaum noch bewegen."),
    ("Frau", "Sabine", "Krüger", "sabine.krueger@web.de", "040 9876542", "Lindenallee 5", "22399", "Hamburg",
     "Das Schloss unserer Terrassentür ist defekt, bitte um schnelle Reparatur."),
    ("Herr", "Michael", "Hoffmann", "m.hoffmann@gmx.de", "0151 12345678", "Rosenstraße 8", "21029", "Hamburg",
     "Fenster im Wohnzimmer schließt nicht mehr dicht, es zieht stark."),
    ("Frau", "Andrea", "Schulz", "a.schulz@gmail.com", "040 2233443", "Birkenweg 22", "22587", "Hamburg",
     "Holztür quietscht und hängt schief, vermutlich ist das Scharnier defekt."),
    ("Herr", "Stefan", "Wagner", "stefan.wagner@t-online.de", "040 5566774", "Ahornstraße 3", "22459", "Hamburg",
     "Hebeschiebetür zur Terrasse lässt sich nur mit großer Mühe öffnen."),
    ("Frau", "Petra", "Becker", "petra.becker@freenet.de", "0176 1234565", "Tannenweg 17", "22041", "Hamburg",
     "Reparatur einer alten Kassettentür gewünscht, das Furnier löst sich ab."),
    ("Herr", "Jürgen", "Fischer", "j.fischer@email.de", "040 7788996", "Buchenkamp 9", "22359", "Hamburg",
     "Balkontür schließt nicht mehr richtig, der Griff dreht durch."),
    ("Frau", "Claudia", "Meyer", "claudia.meyer@web.de", "0152 2345677", "Erlenweg 14", "22523", "Hamburg",
     "Unsere Parallelschiebekipptür hakt beim Öffnen und Kippen."),
    ("Herr", "Andreas", "Köhler", "a.koehler@gmx.net", "040 3344558", "Ulmenstraße 6", "22307", "Hamburg",
     "Wohnungstür aus Holz hat sich verzogen und schließt nur noch schwer."),
    ("Frau", "Monika", "Schäfer", "monika.schaefer@gmail.com", "0176 9876549", "Kastanienallee 2", "22769", "Hamburg",
     "Schiebetür im Schlafzimmer ist aus den Schienen gesprungen."),
]

BODY_TPL = (
    "Hallo, du hast eine Nachricht über deine Creator-Seite {url} erhalten:\n\n"
    "----------------------------------------\n\n"
    "Anrede: {anrede}\n\n"
    "Vorname: {vorname}\n\n"
    "Nachname: {nachname}\n\n"
    "E-Mail: {email}\n\n"
    "Telefon: {telefon}\n\n"
    "Straße: {strasse}\n\n"
    "PLZ: {plz}\n\n"
    "Ort: {ort}\n\n"
    "Nachricht: {nachricht}\n\n"
    "Nutzer hat die Datenschutzerklärung akzeptiert. Datum/Uhrzeit: {dt} CEST\n"
)

created = []
for i, (anrede, vor, nach, mail, tel, strasse, plz, ort, nachricht) in enumerate(PERSONEN, start=1):
    dt = datetime.now(timezone.utc) - timedelta(days=i, hours=i)
    body = BODY_TPL.format(url=JIMDO_URL, anrede=anrede, vorname=vor, nachname=nach,
                           email=mail, telefon=tel, strasse=strasse, plz=plz, ort=ort,
                           nachricht=nachricht, dt=dt.strftime("%Y-%m-%d %H:%M:%S"))
    msg = EmailMessage()
    msg["From"] = "Ralph Graupner <service24@tischlerei-graupner.de>"
    msg["To"] = "lohn2025@tischlerei-graupner.de"
    msg["Subject"] = SUBJECT
    msg["Date"] = formatdate(dt.timestamp(), localtime=False)
    msg["Message-ID"] = f"<{uuid.uuid4()}@tischlerei-graupner.de>"
    msg.set_content(body)
    fname = f"{i:02d}_FW_Anfrage_{vor}_{nach}.eml"
    (OUT / fname).write_bytes(bytes(msg))
    created.append(fname)

print("Erstellt:", len(created))
for c in created:
    print(" -", c)
