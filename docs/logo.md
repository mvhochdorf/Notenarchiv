# Vereinslogo austauschen

Das Logo erscheint in der App an vier Stellen: in **Play** oben links, im
**Archiv** oben links, bei der **Namensabfrage** beim ersten Öffnen und in den
**Profil** beim Namen.

Aktuell: `website/verein/logo.png` (grünes Wappen, 1912).

Es gibt nur diese eine Datei. Die Symbole für Browser-Tab und
Handy-Startbildschirm (`icon.png`, 192 x 192, und `apple-icon.png`, 180 x 180
auf Schwarz) erzeugt `npm run verein` daraus automatisch, beim Start
(`npm run dev`) und beim Bauen. Ebenso legt es eine Kopie nach
`public/logo.png`. Diese erzeugten Dateien sind nicht im Git.

## So geht's

1. Das Logo als **PNG mit transparentem Hintergrund** besorgen, am besten
   512 x 512 Pixel oder größer, möglichst quadratisch. Kleinere Logos gehen
   auch, die Symbole werden dann etwas weicher.
2. Die Datei `website/verein/logo.png` durch das neue Logo ersetzen (gleicher
   Name).
3. Seite neu starten (`start.bat`). Nach dem nächsten Push ist das Logo
   auch auf <https://mvhochdorf.github.io/Notenarchiv/>.

## Tipps

- Die App hat einen dunklen Hintergrund. Ein Logo mit dunkler Schrift auf
  transparentem Grund ist dann schlecht zu sehen - besser eine helle Variante
  oder ein Logo mit eigenem farbigem Hintergrund verwenden.
- Das Logo wird quadratisch angezeigt und eingepasst; breite Logos werden
  entsprechend kleiner.
