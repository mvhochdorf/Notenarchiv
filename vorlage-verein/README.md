# Notenarchiv unseres Vereins

Dieses Repository enthält nur, was zu unserem Verein gehört:

| Datei | Inhalt |
| --- | --- |
| `verein/config.json` | Name, Firebase-Zugang, Verwaltungskonto, Einstellungen |
| `verein/logo.png` | Vereinslogo (daraus entstehen auch die App-Symbole) |
| `.github/workflows/notenarchiv.yml` | Baut und veröffentlicht die App - **hier steht die Version** |
| `.github/workflows/notenarchiv-videos.yml` | Trägt nachts die Höhepunkte neuer Videos ein |

Die App selbst kommt aus dem Notenarchiv-Repository, in der Version, die in
den beiden Workflow-Dateien steht.

## Update auf eine neue Version

1. Im Notenarchiv in `CHANGELOG.md` nachsehen, was neu ist - und ob neue
   **Datenbankregeln** veröffentlicht werden müssen.
2. Falls ja: `website/database.rules.json` dieser Version in der
   Firebase-Konsole unter Realtime Database -> Regeln einfügen und
   veröffentlichen.
3. In beiden Workflow-Dateien jeweils **beide** Stellen `v1.0.0` auf die
   neue Version ändern, committen, pushen. GitHub baut die Seite neu
   (Reiter **Actions**).

Zurück auf eine ältere Version geht genauso.
