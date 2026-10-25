# Verwaltung

Im **Profil** im Reiter **Verwaltung** (oder unter `/verwaltung/`) pflegt der Verein seine
Stücke direkt in der App:

- **Stücke** anlegen, ändern und löschen (Nummer, Titel, Sparte, Anlass, Solo,
  Komponist, Bearbeitung, Verlag, Nr. im Ordner, Sammlung)
- **Video** verknüpfen: YouTube-Link einfügen. Das Video erscheint groß zum
  Abspielen. Mit **"⏱ Aktuelle Stelle als Start"** wird die Stelle, an der das
  Video gerade ist, zum Startpunkt des Ausschnitts in Play (oder die Sekunde
  eintippen; ein Tipp auf **"↺ Start …"** springt hin). Ohne gewählten Start nimmt Play
  den Höhepunkt von YouTube, den der nächtliche Job einträgt.
  Den YouTube-Höhepunkt merkt sich der Katalog getrennt (`youtubePeak`), ein
  gewählter Start überschreibt ihn nicht. Oder ankreuzen
  "Es gibt kein passendes Video".
- In der Liste spielt **▶** im Vorschaubild das Video ab dem Startpunkt ab.
- **Meldungen** der Musiker lesen, das Stück direkt korrigieren und die
  Meldung als **erledigt** löschen

Änderungen sind sofort für alle sichtbar, ohne Push und ohne neuen Build.

Die Stücke liegen nur in Firebase unter `notenarchiv/catalog`, nicht im
Repository. Ein neuer Verein füllt sie einmal aus seiner Excel, siehe
[neuer-verein.md](neuer-verein.md).

## Einmalig einrichten

### 1. Anmeldung mit Passwort aktivieren

[Firebase-Konsole](https://console.firebase.google.com) -> Projekt öffnen ->
**Build -> Authentication -> Anmeldemethode -> Neuen Anbieter hinzufügen ->
E-Mail/Passwort** -> den ersten Schalter (E-Mail/Passwort) **aktivieren** ->
Speichern. "Link per E-Mail" bleibt aus.

### 2. Das Verwaltungskonto anlegen

**Authentication -> Nutzer -> Nutzer hinzufügen**:

- **E-Mail:** genau die Adresse aus `website/verein/config.json` unter
  `admin.email`. Aktuell ist das
  `verwaltung@<projekt-id>.firebaseapp.com`. Es muss keine echte
  Adresse sein, es wird nie eine Mail verschickt. Mit einer echten Adresse
  des Vereins kann man aber später "Passwort vergessen" nutzen. Dann die
  Adresse auch in `config.json` eintragen.
- **Passwort:** mindestens 6 Zeichen, besser länger. Das ist das Passwort,
  das sich die Verwalter teilen.

Danach steht das Konto in der Liste. Die **Nutzer-UID** (lange Zeichenfolge)
kopieren.

### 3. Das Konto als Verwaltung eintragen

**Build -> Realtime Database -> Daten**. Mit der Maus auf `notenarchiv` und
auf **+** klicken:

- Name: `admins` -> wieder **+** -> Name: die kopierte **UID**, Wert: `true`

Es entsteht `notenarchiv/admins/<UID>: true`.

> Wer die UID nicht findet: In der App erst anmelden (Schritt 5). Die
> Verwaltung zeigt dann die UID zum Kopieren an.

### 4. Neue Regeln veröffentlichen

**Realtime Database -> Regeln**: den kompletten Inhalt von
`website/database.rules.json` einfügen -> **Veröffentlichen**. Die Regeln
erlauben das Ändern der Stücke und das Löschen von Meldungen nur Konten, die
unter `admins` stehen.

### 5. Anmelden

App öffnen -> **Profil** -> beim Namen auf den **Stift** tippen -> unten das
**Verwaltungs-Passwort** eingeben -> **Speichern**. Neben dem Namen steht dann
"🔧 Verwaltung", und unten erscheint der Reiter **Verwaltung** mit
**Stücke** und **Meldungen**. Abmelden geht ebenfalls über den Stift.

### 6. Höhepunkt der Videos automatisch ermitteln

Beim Eintragen eines Videos kennt die App nur Link und Startsekunde. Den
Höhepunkt ("Am häufigsten wiederholt" bei YouTube) darf der Browser nicht
auslesen. Das übernimmt jede Nacht ein GitHub-Job im Repository des
Vereins (`.github/workflows/notenarchiv-videos.yml`, siehe
[neuer-verein.md](neuer-verein.md)). Er braucht dafür das
Verwaltungs-Passwort:

1. Auf GitHub im **Repository des Vereins** **Settings -> Secrets and variables ->
   Actions -> New repository secret**.
2. Name: `ADMIN_PASSWORD`, Secret: das Verwaltungs-Passwort -> **Add
   secret**.

Ab dann trägt der Job jede Nacht Länge und Höhepunkt aller neuen Videos ein.
Bis dahin startet der Ausschnitt in der Mitte. Wer nicht warten will: Reiter
**Actions -> Video-Details -> Run workflow**. Am PC geht dasselbe mit
`npm run catalog:details` im Ordner `website`; das Skript fragt nach dem
Passwort.

Wird das Passwort geändert, auch das Secret ändern. Zeigt der Job rot, kam
er bei YouTube nicht durch (oder das Passwort stimmt nicht). Dann am PC
`npm run catalog:details` ausführen. GitHub schaltet nächtliche Jobs ab,
wenn im Repository 60 Tage lang nichts gepusht wurde. Dann unter **Actions
-> Video-Details** wieder einschalten.

## Gut zu wissen

- **News-Chat:** Oben im Posteingang steht "📣 News vom Archiv". Angemeldete
  Verwalter sehen dort ein Feld zum Schreiben und bei jeder Nachricht
  "Löschen". Alle anderen lesen nur. Neue Nachrichten lassen das Vereinslogo
  in Play mit einem roten Punkt aufleuchten.

- **Neue Stücke von Musikern:** Über das **＋** unten kann jeder ein Stück
  eintragen. Ändern oder löschen kann es danach nur die Verwaltung. Wer so ein
  Stück angelegt hat, steht in der Datenbank unter `addedBy`.

- **Wer darf rein?** Jeder, der das Passwort kennt. Bei einem Wechsel im
  Vorstand das Passwort in der Firebase-Konsole ändern (**Authentication ->
  Nutzer -> ⋮ -> Passwort zurücksetzen** bzw. neues setzen).
- **Bewertungen bleiben:** Jedes Stück behält seine ID, auch wenn Titel oder
  Nummer korrigiert werden. Bewertungen, Likes und Kommentare bleiben also
  erhalten. Beim **Löschen** bleiben sie in der Datenbank, sind aber nicht
  mehr zu sehen.
- **"Neu"** in Play: Neue Stücke bekommen das heutige Datum und erscheinen
  dort zuerst.
- **Ausgeblendete Sparten** (z. B. Choral, siehe `hiddenGenres` in
  `config.json`) sieht nur die Verwaltung (Auswahl "Ausgeblendete Sparten").
- **Videos von Musikern:** Wer in Play bei einem Stück ohne Video selbst
  eines verknüpft, sieht das sofort. In der Verwaltung erscheint es beim
  Stück mit dem Hinweis "Ein Musiker hat dieses Video verknüpft". Mit
  Speichern wird es fest übernommen.
- **Wartungsmodus:** Die Verwaltung bleibt erreichbar, so kann man in Ruhe
  aufräumen, während die App geschlossen ist.
- **Sicherung:** Die Stücke gibt es nur in Firebase. Deshalb ab und zu
  Realtime Database -> ⋮ -> **JSON exportieren** und die Datei aufheben. Sie
  enthält auch Bewertungen, Likes und Kommentare.
