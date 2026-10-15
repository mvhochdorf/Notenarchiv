# Wartungsmodus

Wenn du in Ruhe Daten in der Datenbank ändern willst, kann die App für alle
geschlossen werden. Die Seite bleibt erreichbar, zeigt aber nur
**"Wartungsarbeiten"** mit Vereinslogo.

Es gibt zwei Wege.

## Weg 1 - Schalter in Firebase (empfohlen)

Wirkt **innerhalb von Sekunden** auf allen geöffneten Seiten, ohne neues
Veröffentlichen. Solange er an ist, lehnt die Datenbank außerdem **jedes
Schreiben aus der App ab** - auch wer die Seite noch offen hat, kann nichts
ändern. Du selbst arbeitest in der Firebase-Konsole; die ist davon nicht
betroffen.

**Einschalten**

1. [Firebase-Konsole](https://console.firebase.google.com) -> Projekt
   **notenarchiv-mvhochdorf** -> **Realtime Database** -> Reiter **Daten**.
2. Mit der Maus auf **notenarchiv** zeigen -> **+** (Kind hinzufügen).
3. Schlüssel `maintenance` eintragen und darunter mit **+** zwei Einträge:
   - Schlüssel `on`, Wert `true`
   - optional Schlüssel `message`, Wert z. B.
     `"Wir räumen auf - ab 20 Uhr geht es weiter."` (in Anführungszeichen)
4. **Hinzufügen**. Alle offenen Seiten zeigen jetzt die Wartungsseite.

Ohne `message` erscheint: "Das Notenarchiv wird gerade gewartet. Bitte schau
in einer Weile wieder vorbei."

**Ausschalten**

`notenarchiv/maintenance/on` auf `false` setzen (Wert anklicken und ändern)
oder den Eintrag `maintenance` löschen. Die App erscheint sofort wieder.

## Weg 2 - GitHub Action

Veröffentlicht eine Version, die **nur** die Wartungsseite enthält und gar
nicht mit der Datenbank verbindet - gut für längere Arbeiten. Dauert zum
Ein- und Ausschalten jeweils ein paar Minuten (wie ein normaler Build).

**Einschalten**

1. Auf GitHub im Repository **Actions** -> links **Deploy Website**.
2. Rechts **Run workflow** -> Häkchen bei **Wartungsmodus** setzen ->
   **Run workflow**.
3. Nach ein paar Minuten zeigt `https://mvhochdorf.github.io/Notenarchiv/` die
   Wartungsseite.

**Ausschalten**

**Run workflow** erneut, diesmal **ohne** Häkchen - oder einfach den nächsten
Push auf `main` machen; jeder Push baut wieder die normale App.

Hinweis: Wer die Seite während des Umschaltens noch offen hat, sieht die
Wartungsseite erst nach dem Neuladen. Wer sicher gehen will, dass niemand
mehr schreibt, nimmt zusätzlich Weg 1.

## Voraussetzung

Die Sicherheitsregeln aus `website/database.rules.json` müssen in der
Firebase-Konsole veröffentlicht sein (Realtime Database -> Regeln), sonst
lässt sich der Schalter nicht lesen und Schreiben wird während der Wartung
nicht gesperrt.
