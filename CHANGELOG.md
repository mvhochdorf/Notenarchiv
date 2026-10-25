# Änderungen

Jede Version des Notenarchivs mit dem, was neu ist. Vereine tragen die
Version in ihren Workflow-Dateien ein (siehe
[docs/neuer-verein.md](docs/neuer-verein.md)).

**Datenbankregeln:** Steht bei einer Version "Regeln neu veröffentlichen",
muss jeder Verein beim Wechsel auf diese Version `website/database.rules.json`
dieser Version in seiner Firebase-Konsole (Realtime Database -> Regeln)
einfügen und veröffentlichen - am besten **vor** dem Update der Seite.

Versionsnummern: `Haupt.Neben.Fehler` - `1.2.3`

- **Haupt** (2.0.0): Der Verein muss beim Wechsel etwas tun, das über
  "Regeln neu veröffentlichen" hinausgeht (z. B. `config.json` ergänzen).
- **Neben** (1.1.0): neue Funktionen.
- **Fehler** (1.0.1): nur Korrekturen.

## 1.0.0

Erste Version als eigenständige App für beliebige Vereine.

**Regeln neu veröffentlichen.**

- Play: Swipen durch die Stücke mit YouTube-Ausschnitten, Feeds Neu / Für
  dich / Trend, Sterne, Likes, Kommentare, Gemerkt, Teilen, Melden
- Play: Suche mit Vorschaubildern, Auswahl mehrerer Sparten (gespeichert)
- Archiv: Liste mit Suche, Filtern und Sortierung
- **＋** Neues Stück: jeder Musiker kann Stücke anlegen
- Posteingang: News-Chat der Verwaltung, Likes, Bewertungen, Kommentare und
  neue Stücke der anderen; roter Punkt am Logo bei Neuem
- Profil: Name, Profilbild (nur auf dem Gerät), eigene Zahlen, Anzeige- und
  Wiedergabe-Einstellungen, Auswertung
- Verwaltung (Passwort im Profil): Stücke ändern und löschen, Video mit
  Startpunkt wählen, Meldungen erledigen, News schreiben
- Nächtlicher Job für Länge und Höhepunkt neuer Videos
- Wartungsmodus
- Vereinsordner `verein/` mit `config.json` und `logo.png`; Symbole entstehen
  aus dem Logo
