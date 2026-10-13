# Vereinslogo austauschen

Das Logo erscheint in der App an vier Stellen: in **Play** oben links, im
**Archiv** oben links, bei der **Namensabfrage** beim ersten Öffnen und in den
**Einstellungen** beim Namen.

Aktuell: `website/public/logo.png` (grünes Wappen, 1912).

## So geht's

1. Das Logo als Datei besorgen - am besten:
   - **SVG** (Vektorgrafik, bleibt in jeder Größe scharf), oder
   - **PNG mit transparentem Hintergrund**, mindestens 256 x 256 Pixel,
     möglichst quadratisch.
2. Die Datei `website/public/logo.png` durch das neue Logo ersetzen.
   - Ist es wieder eine **PNG**: einfach unter demselben Namen speichern.
     Fertig.
   - Ist es ein anderes Format (z. B. **SVG**): als `website/public/logo.svg`
     ablegen, `logo.png` löschen und in
     `website/src/components/club-logo.tsx` die Zeile
     `const LOGO_FILE = "logo.png";` entsprechend ändern.
3. Seite neu laden (bzw. `start.bat`). Nach dem nächsten Push ist das Logo
   auch auf <https://mvhochdorf.github.io/Notenarchiv/>.

## Tipps

- Die App hat einen dunklen Hintergrund. Ein Logo mit dunkler Schrift auf
  transparentem Grund ist dann schlecht zu sehen - besser eine helle Variante
  oder ein Logo mit eigenem farbigem Hintergrund verwenden.
- Das Logo wird quadratisch angezeigt und eingepasst; breite Logos werden
  entsprechend kleiner.
