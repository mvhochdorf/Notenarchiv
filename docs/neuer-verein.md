# Notenarchiv für einen anderen Verein einrichten

Das Notenarchiv ist so gebaut, dass jeder Verein es nutzen kann - wie ein
Paket mit Versionsnummer. Jeder Verein bekommt ein **eigenes, kleines
GitHub-Repository**, in dem nur steht, was zu ihm gehört, und **welche
Version** der App er verwendet. Den App-Code selbst holt GitHub beim
Veröffentlichen aus dem Notenarchiv-Repository.

```
verein-repository/
├─ verein/
│  ├─ config.json        Name, Firebase-Zugang, Einstellungen
│  └─ logo.png           Vereinslogo
├─ .github/workflows/
│  ├─ notenarchiv.yml           baut die Seite - hier steht die Version
│  └─ notenarchiv-videos.yml    nachts: Höhepunkte neuer Videos
└─ README.md
```

Eine fertige Vorlage dafür liegt im Notenarchiv im Ordner
[`vorlage-verein/`](../vorlage-verein/).

## Was im Vereinsordner liegt

| Datei | Inhalt |
| --- | --- |
| `config.json` | Name der App, Vereinsname, Firebase-Zugang, Verwaltungskonto, ausgeblendete Sparten, Standard-Einstellungen, Excel-Spalten, Such-Hinweise |
| `logo.png` | das Vereinslogo - daraus entstehen auch die Symbole für Browser-Tab und Handy-Startbildschirm |

Die **Stücke** liegen nicht im Repository, sondern in der Firebase-Datenbank
des Vereins, und werden in der [Verwaltung](verwaltung.md) gepflegt. Hat der
Verein eine Notenliste als Excel, füllt er die Datenbank einmal daraus
(Schritt 6). Danach braucht er die Excel nicht mehr.

## Schritt für Schritt

1. **Vereins-Repository anlegen:** Auf GitHub ein neues Repository, z. B.
   `notenarchiv-musterverein`. Den **Inhalt von `vorlage-verein/`**
   hineinkopieren (auch den versteckten Ordner `.github`).
2. **Workflow-Dateien anpassen:** In `.github/workflows/notenarchiv.yml` und
   `notenarchiv-videos.yml`
   - `KONTO/notenarchiv-app` durch das Repository des Notenarchivs ersetzen
     (jeweils zweimal),
   - bei `v1.0.0` die gewünschte Version eintragen (jeweils zweimal; die
     neueste steht in [CHANGELOG.md](../CHANGELOG.md)).
3. **Eigenes Firebase-Projekt anlegen** - genau wie in
   [firebase-einrichten.md](firebase-einrichten.md) beschrieben (Projekt,
   anonyme Anmeldung, Realtime Database, Regeln, Web-App, autorisierte
   Domain). Jeder Verein braucht sein **eigenes** Projekt.
   Die **Regeln** (`website/database.rules.json`) aus der Version nehmen,
   die der Verein verwendet.
4. **`verein/config.json` anpassen:**
   - `admin.email` - Adresse des gemeinsamen Verwaltungskontos (siehe
     [verwaltung.md](verwaltung.md))
   - `appName` - Name der App, z. B. `"Notenarchiv"` (erscheint im
     Browser-Tab, bei der Begrüßung "Willkommen im …" und im Archiv)
   - `clubName` - Name des Vereins
   - `description` - ein Satz für Suchmaschinen und Link-Vorschauen
   - `firebase` - die Werte der `firebaseConfig` aus Schritt 2
   - `hiddenGenres` - Sparten, die in der App nicht erscheinen sollen, z. B.
     `["Choral"]`, oder `[]`
   - `defaults` - womit neue Besucher starten:
     - `show`: `"withMusic"` (nur Stücke mit Video), `"all"` oder
       `"withoutMusic"`
     - `snippetStart`: `"peak"` (Höhepunkt), `"middle"`, `"random"` oder
       `"start"`
     - `atEnd`: `"repeat"` (wiederholen) oder `"next"` (nächstes Stück)
   - `spreadsheet.file` - Pfad zur Excel ab dem Hauptordner
   - `spreadsheet.columns` - die **Spaltenüberschriften** der eigenen Excel
     für Nummer, Titel, Sparte, Anlass, Solo, Komponist, Bearbeitung, Verlag,
     Nr. im Ordner und Sammlung (die Excel muss die Überschriften in Zeile 1
     des ersten Tabellenblatts haben)
   - `search` - Hinweise für die YouTube-Suche:
     - `bandQuery`: Suchwort für Aufnahmen der eigenen Besetzung, z. B.
       `"Blasorchester"`, `"Posaunenchor"`, `"Brass Band"`
     - `bandQueryByGenre`: dasselbe je Sparte, z. B.
       `{ "Choral": "Posaunenchor" }`
     - `internalArrangers`: Nachnamen eigener Bearbeiter, die es auf
       YouTube nicht gibt
     - `spellings`: Titel, die auf YouTube anders geschrieben werden
5. **Logo** `verein/logo.png` ersetzen (am besten quadratisch,
   transparenter Hintergrund, 512 x 512 Pixel oder größer). Die Symbole
   entstehen daraus von selbst, siehe [logo.md](logo.md).
6. **Stücke aus der Excel einlesen** (nur einmal, ohne Excel überspringen).
   Dafür braucht man das Notenarchiv einmal am PC:
   - Notenarchiv-Repository klonen und die verwendete Version auschecken
     (`git checkout v1.0.0`), `install.bat` ausführen.
   - `config.json` und `logo.png` des Vereins nach `website/verein/`
     kopieren (nicht committen), die Excel in den Hauptordner legen (Name
     wie in `spreadsheet.file`).
   - Im Ordner `website`:
     - `npm run import` - liest die Excel nach `verein/songs.json`
     - `npm run youtube` - sucht passende Videos nach `verein/youtube.json`
       (dauert eine Weile, darf auch weggelassen werden)
     - `npm run youtube:details` - Länge und Höhepunkt der Videos
     - `npm run catalog:export` - fasst alles in
       `verein/catalog-import.json` zusammen
   - Firebase-Konsole -> **Realtime Database -> Daten** -> bei `notenarchiv`
     auf **+**, Name `catalog`, Wert `0` -> Hinzufügen -> auf `catalog`
     klicken, sodass oben `notenarchiv/catalog` steht -> **⋮ -> JSON
     importieren** -> `catalog-import.json` wählen.

   > **Achtung:** Der Import ersetzt alles an der Stelle, an der man steht.
   > Nie ganz oben oder bei `notenarchiv` importieren.

   Diese Dateien kommen nicht ins Repository (`.gitignore`) und können
   danach gelöscht werden.
7. **Veröffentlichen:** Im Vereins-Repository unter **Settings -> Pages**
   die Quelle **"GitHub Actions"** wählen, dann pushen. Unter **Actions**
   läuft "Notenarchiv"; danach liegt die Seite unter
   `https://<konto>.github.io/<repository>/`. Diese Adresse in Firebase als
   autorisierte Domain eintragen (siehe firebase-einrichten.md).
8. **Verwaltung einrichten**, siehe [verwaltung.md](verwaltung.md) - dort
   auch das Secret `ADMIN_PASSWORD` für den nächtlichen Job, diesmal im
   **Vereins-Repository**. Ohne Excel legt man die Stücke in der App
   einzeln an.

## Auf eine neue Version wechseln

1. In [CHANGELOG.md](../CHANGELOG.md) nachsehen, was neu ist und ob
   **"Regeln neu veröffentlichen"** dabeisteht.
2. Falls ja: `website/database.rules.json` **dieser** Version in der
   Firebase-Konsole des Vereins einfügen und veröffentlichen.
3. Im Vereins-Repository in beiden Workflow-Dateien die Version ändern
   (jeweils beide Stellen), pushen. Fertig.

Zurück auf eine frühere Version geht genauso. Die Version, die gerade läuft,
steht in der App unter **Profil -> Mehr**.

## Was gleich bleibt

Play mit Neu / Für dich / Trend, die Empfehlungen, Archiv, Bewertungen, Likes,
Kommentare, Meldungen, Auswertung, Wartungsmodus und die Sicherheitsregeln
(`website/database.rules.json`) sind für alle Vereine gleich und brauchen
keine Anpassung. Sparten und Anlässe ergeben sich aus den Stücken.
