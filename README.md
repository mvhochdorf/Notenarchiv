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

| Pfad                                   | Inhalt                                           |
| -------------------------------------- | ------------------------------------------------ |
| `Notenliste.xlsx`                      | Die Notenliste - Quelle, wird nur gelesen        |
| `website/scripts/import-notes.mts`     | Excel -> `website/src/data/songs.json`           |
| `website/scripts/find-youtube.mts`     | YouTube-Links -> `website/src/data/youtube.json` |
| `website/src/components/feed.tsx`      | Swipe-Feed (Startseite)                          |
| `website/src/components/song-list.tsx` | Archiv-Liste (`/liste/`)                         |
| `website/src/lib/archive-store.ts`     | Bewertungen und Videos (Firebase / lokal)        |
| `website/database.rules.json`          | Sicherheitsregeln der Firebase-Datenbank         |

## Vereinslogo

`website/public/logo.png` - zum Austauschen einfach ersetzen, Details in
[docs/logo.md](docs/logo.md).

## Notenliste aktualisieren

Nach Änderungen an `Notenliste.xlsx` im Ordner `website`:

```bash
npm run import
```

Die Stück-ID entsteht aus Nummer und Titel. Bewertungen hängen an dieser ID -
wird ein Titel oder eine Nummer in der Excel geändert, beginnt das Stück
wieder ohne Bewertungen.

## Bewertungen und Beliebtheit

Jeder Browser bekommt per anonymem Firebase-Login eine feste ID und hat damit
eine Stimme pro Stück (änderbar, nochmal auf denselben Stern tippen nimmt sie
zurück). "Beliebteste" sortiert nach einem gewichteten Durchschnitt: ein
Stück mit einer einzigen 5-Sterne-Stimme landet nicht vor einem mit dreißig
Stimmen im Schnitt 4,8.

## Bedienung in Play

Oben drei Feeds. Alle durchlaufen dieselben drei Stufen, eine Stufe beginnt
erst, wenn die vorige leer ist:

1. **noch nie gesehene** Stücke
2. gesehene, aber **ohne Sterne und ohne Herz**
3. der Rest - überwiegend die, die man selbst am besten bewertet oder gelikt
   hat

Der Feed bestimmt nur die Reihenfolge innerhalb einer Stufe:

- **Neu** - zuletzt hinzugekommene Stücke zuerst (`website/src/data/added.json`,
  vom Import gepflegt; bei gleichem Datum die höhere Archiv-Nummer)
- **Für dich** - nach dem eigenen Geschmack (Sparte, Komponist, Bearbeiter,
  Anlass, Verlag der gelikten, gemerkten und gut bewerteten Stücke) und nach
  dem, was Leute mit ähnlichem Geschmack mögen und anschauen
- **Trend** - was allen am besten gefällt (Likes, Gemerkt, Sterne,
  Kommentare, Aufrufe)

Ein Stück gilt als gesehen, wenn es 3 Sekunden im Bild war. Die nächsten zwei
Videos laufen unsichtbar und stumm mit Viertel-Geschwindigkeit vor, damit sie
beim Swipen sofort und ohne YouTube-Einblendung starten.

- **Tippen** aufs Video: Pause / weiter (beim ersten Mal: Ton einschalten)
- **Doppeltippen**: Gefällt mir
- **Gedrückt halten**: doppelte Geschwindigkeit
- Rechts: Gefällt mir, Kommentare, Gespeichert (Filter im Archiv), Teilen,
  Melden (Freitext an den Verwalter; im Archiv Filter "Anmerkungen", in der
  Auswertung Reiter "Meldungen" mit CSV inkl. Stück-ID)

Im Archiv sortiert **Beliebteste** nach Sternen und Herzen zusammen: jedes
Herz +1, jede Bewertung Sterne minus 3 (5★ = +2, 1★ = −2, 0★ = −3).

## Musik / Videos

Die Notenliste enthält keine Aufnahmen. Jedes Stück kann zwei Links haben:

- **Fester Link** in `website/src/data/youtube.json` - wird mit der Seite
  ausgeliefert. Gefunden per `npm run youtube` (YouTube-Suche, bewertet nach
  Titel, Komponist/Bearbeiter, Verlagskanal und Dauer). Bereits eingetragene
  Stücke überspringt das Skript, also kann man Links in der Datei von Hand
  korrigieren. `npm run youtube -- --retry` sucht die "nicht gefunden"-Stücke
  erneut. Das Feld `label` (Videotitel und Kanal) dient nur zur Kontrolle,
  `start` ist die Startsekunde des Ausschnitts.
- **Eigener Link** über "Video verknüpfen" im Feed - gilt für alle (Firebase)
  und hat Vorrang vor dem festen Link.

Beim Swipen spielt ein 45-Sekunden-Ausschnitt ab (`youtube-nocookie.com`).

Unter **Einstellungen** (`/einstellungen/`) lässt sich wählen, welche Stücke
Feed und Archiv zeigen: nur mit Musik (Standard), alle, oder nur ohne Musik
(zum Nachtragen von Links), und wo der Ausschnitt startet: am **Höhepunkt**
(Standard), in der Mitte, an einer zufälligen Stelle oder am Anfang. Die Wahl
wird im Browser gespeichert.

Der Höhepunkt ist die meistgesehene Stelle laut YouTube ("Am häufigsten
wiederholt") - meist der schönste Teil, nach Ansage und Applaus. Eine echte
Erkennung, wo die Musik einsetzt, ist nicht möglich: Dafür müsste man die
Tonspur herunterladen, was YouTube nicht erlaubt. Länge und Höhepunkt jedes
festen Links ermittelt einmalig `npm run youtube:details` (nach
`npm run youtube` ausführen). Videos ohne Heatmap (wenige Aufrufe) starten in
der Mitte, selbst verknüpfte Videos immer an der eingetragenen Startsekunde. Der Ton startet aus (Autoplay-Regeln der Browser) und
wird mit "Ton an" eingeschaltet.

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
   angezeigte `firebaseConfig` in `website/src/lib/firebase-config.ts` als
   Standardwerte eintragen (wie bei Drecksau - die Werte sind nicht geheim,
   geschützt wird über die Regeln).
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

- `notenarchiv/users/{uid}` - `{ firstName, lastName, personId, at }`
- `notenarchiv/ratings/{songId}/{personId}` - Sterne 1-5
- `notenarchiv/likes`, `saved`, `views` - jeweils `/{songId}/{personId}`:
  `true`
- `notenarchiv/comments/{songId}/{commentId}` -
  `{ person, name, text, at }`, löschen nur die eigenen
- `notenarchiv/reports/{songId}/{reportId}` - Meldungen ("Melden"-Button):
  `{ person, name, text, at }`, wie Kommentare
- `notenarchiv/media/{songId}` - `{ videoId, start }` (in der App
  verknüpfte Videos, haben Vorrang vor `youtube.json`)

### Auswerten

**Einstellungen -> Auswertung** (`/auswertung/`) zeigt Tabellen zu Stücken
(Ø Sterne, Stimmen, Likes, Gemerkt, Kommentare, Gesehen - sortierbar),
Personen und Kommentaren, jeweils als CSV für Excel herunterladbar. Die
Rohdaten lassen sich zusätzlich in der Firebase-Konsole unter Realtime
Database -> ⋮ -> **JSON exportieren** sichern.

## Veröffentlichen

`.github/workflows/github-ci.yml` baut bei jedem Push auf `main` und
veröffentlicht auf GitHub Pages (in den Repo-Einstellungen unter Pages die
Quelle "GitHub Actions" wählen).
