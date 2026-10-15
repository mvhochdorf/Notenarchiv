# Notenarchiv für einen anderen Verein einrichten

Das Notenarchiv ist so gebaut, dass jeder Verein es nutzen kann. Alles, was zu
einem Verein gehört, liegt im Ordner **`website/verein/`** - der Rest ist für
alle gleich.

## Was im Vereinsordner liegt

| Datei | Inhalt |
| --- | --- |
| `config.json` | Name der App, Vereinsname, Firebase-Zugang, Verwaltungskonto, ausgeblendete Sparten, Standard-Einstellungen, Excel-Spalten, Such-Hinweise |
| `logo.png` | das Vereinslogo - daraus entstehen auch die Symbole für Browser-Tab und Handy-Startbildschirm |

Die **Stücke** liegen nicht im Repository, sondern in der Firebase-Datenbank
des Vereins, und werden in der [Verwaltung](verwaltung.md) gepflegt. Hat der
Verein eine Notenliste als Excel, füllt er die Datenbank einmal daraus
(Schritt 5). Danach braucht er die Excel nicht mehr.

## Schritt für Schritt

1. **Repository kopieren** - auf GitHub "Use this template" bzw. forken, oder
   den Inhalt in ein neues Repository des Vereins übernehmen.
2. **Eigenes Firebase-Projekt anlegen** - genau wie in
   [firebase-einrichten.md](firebase-einrichten.md) beschrieben (Projekt,
   anonyme Anmeldung, Realtime Database, Regeln, Web-App, autorisierte
   Domain). Jeder Verein braucht sein **eigenes** Projekt.
3. **`website/verein/config.json` anpassen:**
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
4. **Logo** `website/verein/logo.png` ersetzen (am besten quadratisch,
   transparenter Hintergrund, 512 x 512 Pixel oder größer). Die Symbole
   entstehen daraus von selbst, siehe [logo.md](logo.md).
5. **Stücke aus der Excel einlesen** (nur einmal, ohne Excel überspringen):
   - Die Excel in den Hauptordner legen (Name wie in `spreadsheet.file`).
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
6. **Verwaltung einrichten**, siehe [verwaltung.md](verwaltung.md). Ohne
   Excel legt man die Stücke dort einzeln an.
7. **Testen** mit `start.bat`.
8. **Veröffentlichen** - pushen und auf GitHub unter Settings -> Pages die
   Quelle "GitHub Actions" wählen. Die Seite liegt dann unter
   `https://<konto>.github.io/<repository>/`.

## Was gleich bleibt

Play mit Neu / Für dich / Trend, die Empfehlungen, Archiv, Bewertungen, Likes,
Kommentare, Meldungen, Auswertung, Wartungsmodus und die Sicherheitsregeln
(`website/database.rules.json`) sind für alle Vereine gleich und brauchen
keine Anpassung. Sparten und Anlässe ergeben sich aus den Stücken.
