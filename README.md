# Notenarchiv

Das Notenarchiv als Web-App im TikTok-Stil: durch die Stücke swipen,
Ausschnitte anhören und mit 1-5 Sternen bewerten. Dazu eine Archiv-Liste mit
Suche, Filter nach Sparte und Anlass und Sortierung nach Beliebtheit.

## Starten

1. `install.bat` (einmalig)
2. `start.bat` - öffnet <http://localhost:3010>

## Aufbau

Architektur wie bei Drecksau: Next.js als statischer Export (GitHub Pages),
Tailwind, Firebase Realtime Database mit anonymem Login. Coding-Regeln:
[docs/coding-rules.md](docs/coding-rules.md).

| Pfad                                   | Inhalt                                             |
| -------------------------------------- | -------------------------------------------------- |
| `website/verein/`                      | Alles Vereinsspezifische (siehe unten)             |
| `website/scripts/`                     | Ersteinrichtung: Excel + YouTube -> Firebase       |
| `website/src/components/feed.tsx`      | Swipe-Feed (Startseite)                            |
| `website/src/components/song-list.tsx` | Archiv-Liste (`/liste/`)                           |
| `website/src/lib/archive-store.ts`     | Stücke, Bewertungen, Videos (Firebase / lokal)     |
| `website/src/components/admin-view.tsx`| Verwaltung (`/verwaltung/`)                        |
| `website/database.rules.json`          | Sicherheitsregeln der Firebase-Datenbank           |

## Vereinsordner

Alles, was zum Musikverein Hochdorf gehört, liegt in `website/verein/`:
`config.json` (App-Name, Vereinsname, Firebase-Zugang, Verwaltungskonto,
ausgeblendete Sparten, Standard-Einstellungen, Excel-Spalten, Such-Hinweise),
und das Logo (daraus entstehen auch die Symbole). Die Stücke selbst liegen
in Firebase.

Ein anderer Verein kopiert das Repository, tauscht diesen Ordner aus und
füllt seine eigene Datenbank: [docs/neuer-verein.md](docs/neuer-verein.md).

## Verwaltung

Stücke und Videos werden in der App gepflegt: **Profil -> Verwaltung**
(`/verwaltung/`, gemeinsames Passwort). Dort auch die Meldungen der Musiker
mit "Erledigt". Die Stücke liegen nur in Firebase unter
`notenarchiv/catalog`, daher ab und zu in der Firebase-Konsole **JSON
exportieren** als Sicherung. Einrichtung und Details:
[docs/verwaltung.md](docs/verwaltung.md).

## Vereinslogo

`website/verein/logo.png` - zum Austauschen einfach ersetzen, Details in
[docs/logo.md](docs/logo.md).

## Stück-IDs

Jedes Stück bekommt beim Anlegen eine feste ID aus Nummer und Titel, z. B.
`1553a-aber-dich-gibt-s-nur-einmal`. Bewertungen, Likes und Kommentare hängen
an dieser ID. Sie bleibt auch, wenn Titel oder Nummer in der Verwaltung
korrigiert werden.

## Bewertungen und Beliebtheit

Jeder Browser bekommt per anonymem Firebase-Login eine feste ID und hat damit
eine Stimme pro Stück (änderbar, nochmal auf denselben Stern tippen nimmt sie
zurück). "Beliebteste" sortiert nach einem gewichteten Durchschnitt: ein
Stück mit einer einzigen 5-Sterne-Stimme landet nicht vor einem mit dreißig
Stimmen im Schnitt 4,8.

## Bereiche

Unten in der Leiste, wie bei TikTok:

- **Play** - durch die Stücke swipen (siehe unten)
- **Archiv** - Liste mit Suche, Filtern und Sortierung (`/liste/`)
- **＋** - ein neues Stück eintragen (`/neu/`). Das darf jeder mit Namen,
  auch mit Video. Ändern und Löschen bleibt der Verwaltung. Beim Tippen des
  Titels zeigt das Formular ähnliche Stücke, damit nichts doppelt kommt.
- **Posteingang** - was die anderen tun: Likes, Bewertungen, Kommentare und
  neue Stücke, die neuesten zuerst (`/posteingang/`). Die rote Zahl zählt,
  was seit dem letzten Öffnen dazukam (gemerkt pro Gerät). Ein Tipp öffnet
  das Stück in Play.
- **Profil** - Name, Anzeige-Einstellungen, Auswertung und Verwaltung
  (`/profil/`)

## Bedienung in Play

Oben drei Feeds. Alle durchlaufen dieselben drei Stufen, eine Stufe beginnt
erst, wenn die vorige leer ist:

1. **noch nie gesehene** Stücke
2. gesehene, aber **ohne Sterne und ohne Herz**
3. der Rest - überwiegend die, die man selbst am besten bewertet oder gelikt
   hat

Der Feed bestimmt nur die Reihenfolge innerhalb einer Stufe:

- **Neu** - zuletzt hinzugekommene Stücke zuerst (Datum beim Anlegen in der
  Verwaltung; bei gleichem Datum die höhere Archiv-Nummer)
- **Für dich** - nach dem eigenen Geschmack (Sparte, Komponist, Bearbeiter,
  Anlass, Verlag der gelikten, gemerkten und gut bewerteten Stücke) und nach
  dem, was Leute mit ähnlichem Geschmack mögen und anschauen
- **Trend** - was allen am besten gefällt (Likes, Gemerkt, Sterne,
  Kommentare, Aufrufe)

Ein Stück gilt als gesehen, wenn es 3 Sekunden im Bild war. Die nächsten zwei
Videos laufen unsichtbar und stumm mit Viertel-Geschwindigkeit vor, damit sie
beim Swipen sofort und ohne YouTube-Einblendung starten.

Oben rechts:

- **Sparten** (Regler-Symbol) - Häkchen für jede Sparte, mehrere gleichzeitig,
  mit "Alle" und "Keine". Die Wahl bleibt im Browser gespeichert. Ist nicht
  alles an, hat der Knopf einen gelben Rand und zeigt, wie viele Sparten an
  sind.
- **Suche** (Lupe) - nach Titel, Komponist, Bearbeiter oder Nummer. Die
  Treffer erscheinen als Raster von Vorschaubildern wie bei TikTok: auf dem
  Handy 2 Spalten (etwa 4 Videos auf einmal), am PC bis zu 6. Ein Tipp spielt
  das Video, Wischen geht durch die übrigen Treffer.

- **Tippen** aufs Video: Pause / weiter (beim ersten Mal: Ton einschalten)
- **Doppeltippen**: Gefällt mir
- **Gedrückt halten**: doppelte Geschwindigkeit
- Rechts: Gefällt mir, Kommentare, Gespeichert (Filter im Archiv), Teilen,
  Melden (Freitext an die Verwaltung; im Archiv Filter "Anmerkungen", in der
  Verwaltung Reiter "Meldungen" mit "Erledigt")

Im Archiv sortiert **Beliebteste** nach Sternen und Herzen zusammen: jedes
Herz +1, jede Bewertung Sterne minus 3 (5★ = +2, 1★ = −2, 0★ = −3).

## Musik / Videos

Jedes Stück kann zwei Video-Links haben:

- **Fester Link** - in der Verwaltung beim Stück eingetragen. Bei der
  Ersteinrichtung findet `npm run youtube` die meisten automatisch
  (YouTube-Suche, bewertet nach Titel, Komponist/Bearbeiter, Verlagskanal
  und Dauer), siehe [docs/neuer-verein.md](docs/neuer-verein.md).
- **Eigener Link** über "Video verknüpfen" im Feed - gilt für alle (Firebase)
  und hat Vorrang vor dem festen Link.

Beim Swipen spielt ein 45-Sekunden-Ausschnitt ab (`youtube-nocookie.com`).

Im **Profil** (`/profil/`) lässt sich wählen, welche Stücke
Feed und Archiv zeigen: nur mit Musik (Standard), alle, oder nur ohne Musik
(zum Nachtragen von Links), und wo der Ausschnitt startet: am **Höhepunkt**
(Standard), in der Mitte, an einer zufälligen Stelle oder am Anfang. Die Wahl
wird im Browser gespeichert.

Der Höhepunkt ist die meistgesehene Stelle laut YouTube ("Am häufigsten
wiederholt") - meist der schönste Teil, nach Ansage und Applaus. Eine echte
Erkennung, wo die Musik einsetzt, ist nicht möglich: Dafür müsste man die
Tonspur herunterladen, was YouTube nicht erlaubt. Länge und Höhepunkt der
bei der Ersteinrichtung gefundenen Videos hat `npm run youtube:details`
ermittelt. Für Videos aus der Verwaltung trägt ein nächtlicher GitHub-Job
beides nach (`npm run catalog:details`, siehe
[docs/verwaltung.md](docs/verwaltung.md)); bis dahin fragt die App die Länge
beim Abspielen ab und startet in der Mitte, frühestens bei der eingetragenen
Sekunde. Von Musikern verknüpfte Videos starten immer an
der eingetragenen Startsekunde. Blockiert der Browser den Ton, startet das
Video stumm, bis man die Seite zum ersten Mal berührt.

## Firebase einrichten

Schritt-für-Schritt-Anleitung mit allen Klicks:
[docs/firebase-einrichten.md](docs/firebase-einrichten.md)

Ohne Firebase läuft die App im **lokalen Modus**: alles nur im eigenen
Browser. Für gemeinsame Bewertungen, Likes, Kommentare und Video-Links (am
besten mit dem Google-Konto des Vereins):

1. [Firebase-Konsole](https://console.firebase.google.com) -> **Projekt
   hinzufügen** (z. B. `notenarchiv-mvhochdorf`), Google Analytics nicht nötig.
2. **Build -> Authentication -> Jetzt starten -> Anmeldemethode -> Anonym**
   aktivieren.
3. **Build -> Realtime Database -> Datenbank erstellen**, Standort
   **Belgien (europe-west1)**, im **gesperrten Modus** starten.
4. Dort unter **Regeln** den kompletten Inhalt von
   `website/database.rules.json` einfügen und **Veröffentlichen**.
5. **Projekteinstellungen (Zahnrad) -> Allgemein -> Meine Apps -> Web-App
   hinzufügen (`</>`)**, Name z. B. `notenarchiv-web`, kein Hosting. Die
   angezeigte `firebaseConfig` in `website/verein/config.json` unter
   `firebase` eintragen (die Werte sind nicht geheim, geschützt wird über die
   Regeln).
6. **Authentication -> Einstellungen -> Autorisierte Domains**: `localhost`
   ist schon da, `mvhochdorf.github.io` hinzufügen.

Regeln später ändern: Datei anpassen und wieder in der Konsole einfügen,
oder per CLI `npx firebase-tools login` und
`npx firebase-tools deploy --only database --project <projekt-id>` im Ordner
`website`.

### Wer ist wer

Firebase meldet jedes Gerät anonym an. Damit Handy und PC einer Person
zusammengehören, fragt die App beim ersten Öffnen nach **Vor- und Nachname**.
Daraus entsteht die Personen-ID (z. B. `juergen-gross`), unter der alles
gespeichert wird. Jedes Gerät trägt sich unter `notenarchiv/users/{uid}` mit
seiner Person ein; die Regeln erlauben Schreiben nur unter dieser Person. Das
ist keine echte Anmeldung - wer einen fremden Namen eintippt, kann als diese
Person bewerten.

### Datenmodell

- `notenarchiv/catalog/{songId}` - die Stücke: `{ number, title, genre, ...,
  added, addedBy, video: { videoId, start, duration, peak, label }, noVideo }`.
  Neue Stücke darf jeder anlegen (mit `addedBy` = eigene Personen-ID),
  ändern und löschen nur die Verwaltung
- `notenarchiv/admins/{uid}` - `true` für das Verwaltungskonto
- `notenarchiv/users/{uid}` - `{ firstName, lastName, personId, at }`
- `notenarchiv/ratings/{songId}/{personId}` - Sterne 1-5
- `notenarchiv/likes`, `saved`, `views` - jeweils `/{songId}/{personId}`:
  `true`
- `notenarchiv/news/{songId}/{personId}` - `{ like, rating, added }`:
  wann die Person geliked, bewertet oder hinzugefügt hat (für den
  Posteingang; zurückgenommen = gelöscht)
- `notenarchiv/comments/{songId}/{commentId}` -
  `{ person, name, text, at }`, löschen nur die eigenen
- `notenarchiv/reports/{songId}/{reportId}` - Meldungen ("Melden"-Button):
  `{ person, name, text, at }`, wie Kommentare
- `notenarchiv/media/{songId}` - `{ videoId, start }` (in der App
  verknüpfte Videos, haben Vorrang vor dem Link im Katalog)

### Auswerten

**Profil -> Auswertung** (`/auswertung/`) zeigt Tabellen zu Stücken
(Ø Sterne, Stimmen, Likes, Gemerkt, Kommentare, Gesehen - sortierbar),
Personen und Kommentaren, jeweils als CSV für Excel herunterladbar. Die
Rohdaten lassen sich zusätzlich in der Firebase-Konsole unter Realtime
Database -> ⋮ -> **JSON exportieren** sichern.

## Wartungsmodus

Die App lässt sich für alle schließen (Wartungsseite statt App, Schreiben
gesperrt) - per Schalter in Firebase oder per GitHub Action, siehe
[docs/wartungsmodus.md](docs/wartungsmodus.md).

## Veröffentlichen

`.github/workflows/github-ci.yml` baut bei jedem Push auf `main` und
veröffentlicht auf GitHub Pages (in den Repo-Einstellungen unter Pages die
Quelle "GitHub Actions" wählen).
