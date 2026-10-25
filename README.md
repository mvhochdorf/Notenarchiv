# Notenarchiv Musikverein Hochdorf

Dieses Repository enthält nur, was zum Musikverein Hochdorf gehört:

| Datei | Inhalt |
| --- | --- |
| `verein/config.json` | Name, Firebase-Zugang, Verwaltungskonto, Einstellungen |
| `verein/logo.png` | Vereinslogo (daraus entstehen auch die App-Symbole) |
| `.github/workflows/notenarchiv.yml` | Baut und veröffentlicht die App - **hier steht die Version** |
| `.github/workflows/notenarchiv-videos.yml` | Trägt nachts die Höhepunkte neuer Videos ein |

Die App selbst kommt aus
[timounger/notenarchiv-app](https://github.com/timounger/notenarchiv-app),
in der Version, die in den beiden Workflow-Dateien steht (aktuell
`v1.0.0`). Dort stehen auch Bedienung, Verwaltung, Firebase-Einrichtung und
Wartungsmodus.

Die Stücke liegen in Firebase (`notenarchiv-mvhochdorf`) unter
`notenarchiv/catalog` und werden in der App gepflegt (**Profil ->
Verwaltung**). Ab und zu in der Firebase-Konsole **JSON exportieren** als
Sicherung.

## Lokal testen

Im Repository `notenarchiv-app` die verwendete Version auschecken,
`verein/config.json` und `verein/logo.png` von hier nach `website/verein/`
kopieren (dort nicht committen), dann `install.bat` und `start.bat`.

## Update auf eine neue Version

1. In `CHANGELOG.md` von notenarchiv-app nachsehen, was neu ist - und ob neue
   **Datenbankregeln** veröffentlicht werden müssen.
2. Falls ja: `website/database.rules.json` dieser Version in der
   Firebase-Konsole unter Realtime Database -> Regeln einfügen und
   veröffentlichen.
3. In beiden Workflow-Dateien jeweils **beide** Stellen `v1.0.0` auf die
   neue Version ändern, committen, pushen. GitHub baut die Seite neu
   (Reiter **Actions**).

Zurück auf eine ältere Version geht genauso.

## Wartungsmodus

**Actions -> Notenarchiv -> Run workflow** mit Haken "Wartungsmodus"
veröffentlicht nur die Wartungsseite. Wieder aufmachen: denselben Workflow
ohne Haken starten (oder pushen).
