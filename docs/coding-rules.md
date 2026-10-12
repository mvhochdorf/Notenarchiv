# Coding-Regeln

Verbindliche Konventionen für dieses Projekt.

## Code-Stil (TypeScript)

Als Stil-Referenz gilt der **[Google TypeScript Style Guide](https://google.github.io/styleguide/tsguide.html)**.
An diesen Regeln soll man sich halten (Namensgebung, `type` vs `interface`,
Imports, Sichtbarkeit usw.).

Durchgesetzt wird der Stil automatisch durch die Tools - bei Abweichungen gilt das
Tool-Ergebnis:

- **Prettier** für die Formatierung (`prettier.config.mjs`, `npm run format`)
- **ESLint** via `eslint-config-next` für Code-Regeln (`npm run lint`)

Kurz: erst die Tools laufen lassen, inhaltliche Konventionen nach dem Google-Guide.

## Sprache im Code

**Englisch** für alles im Quellcode:

- Bezeichner (Variablen, Funktionen, Typen, Dateinamen)
- Code-Kommentare und JSDoc-Texte

**Ausnahmen** (bewusst in Landessprache):

- nutzersichtbare Texte / UI-Strings und Übersetzungen (z. B. `i18n/translations.ts`)
- diese Markdown-Dokumentation im `docs/`-Ordner darf Deutsch sein

## Namenskonventionen

`camelCase` ist der Standard, `snake_case` wird im Code **nicht** verwendet.

| Was                                                    | Stil               | Beispiel                       |
| ------------------------------------------------------ | ------------------ | ------------------------------ |
| Variablen, Funktionen, Parameter, Methoden, Properties | `camelCase`        | `doorsOf`, `createGame`        |
| Klassen, Typen, Interfaces, Enums, React-Komponenten   | `PascalCase`       | `GameState`, `DrecksauGame`    |
| Echte Konstanten (modul-weit, unveränderlich)          | `UPPER_SNAKE_CASE` | `MAX_STARS`, `CITY_TILES`      |
| Dateinamen                                             | `kebab-case`       | `use-gta-game.ts`              |

**`snake_case`** nur bei **externen Formaten**, deren Schreibweise vorgegeben ist
(z. B. JSON-Keys einer fremden API wie `created_at`). Im Code wird das an der
Grenze auf `camelCase` gemappt (`created_at` -> `createdAt`). Im Projekt selbst
kommt derzeit keiner vor - die eigenen Formate (Online-Räume, Statistiken,
gespeicherte Partien) sind durchgehend `camelCase`.

## Rückgabetypen

**Exportierte** Funktionen bekommen einen **expliziten Rückgabetyp** (klarer
Vertrag, faengt versehentliche Aenderungen ab). Interne Funktionen duerfen den
Typ weglassen - TypeScript leitet ihn ab.

- React-Komponenten: `: ReactElement` (bzw. `: ReactElement | null`)
- sonst der passende Typ, z. B. `: GameState`, `: number`

Durchgesetzt via ESLint-Regel `@typescript-eslint/explicit-module-boundary-types`.

## Dateiaufbau / Reihenfolge

Reihenfolge in einer Datei von oben nach unten:

1. `@module`-Header
2. Imports
3. Modul-Konstanten und Typen
4. **Exportierte / oeffentliche Funktion(en) zuerst**
5. interne Hilfsfunktionen darunter (in Aufruf-Reihenfolge)

So liest man erst die Schnittstelle ("was macht das Modul"), dann die Details
(Stepdown-Prinzip). `function`-Deklarationen werden gehoisted - die oeffentliche
Funktion darf also oben stehen und weiter unten definierte Helfer aufrufen.

Bei React-Komponenten-Dateien steht die Komponente (der Export) vor den
modulweiten Hilfsfunktionen; Typen und Konstanten bleiben oben.

## Verzweigungen: switch / Lookup statt langer if-else-Ketten

Wenn **mehrere Zweige immer dieselbe Variable** gegen feste Werte prüfen (ab ca.
3 Fällen), kein langes `if / else if` verwenden, sondern:

- **`switch / case`** - bei wenigen, festen Fällen.
- **Lookup-Tabelle** (`Record<...>`) - bei vielen/dynamischen Fällen oder reinem
  „Wert -> Aktion/Ergebnis"-Mapping.

```ts
// schlecht: gleiche Bedingung immer wieder
if (kind === "bank") ...;
else if (kind === "guns") ...;
else if (kind === "mint") ...;

// gut: switch
switch (kind) {
  case "bank": ...; break;
  case "guns": ...; break;
  case "mint": ...; break;
}

// gut: Lookup-Tabelle (viele/dynamische Faelle)
const SIGNS: Record<BuildingKind, string> = { bank: "BANK", guns: "WAFFEN" };
const sign = SIGNS[kind];
```

**Ausnahmen (bleiben `if/else`):** kurze 2-Zweig-Entscheidungen und Ketten mit
**unterschiedlichen** Bedingungen (z. B. Bereichsprüfungen wie `x < a` / `x > b`).

## Rückkehrpunkte: max. ein return pro Funktion

Jede Funktion hat **höchstens ein `return`** (Single-Exit). Statt mehrerer
früher `return`s ein Ergebnis in einer Variablen sammeln und am Ende einmal
zurückgeben; bei `switch` das Ergebnis zuweisen und nach dem `switch` einmal
`return`.

```ts
// statt mehrerer returns
function stars(crime: Crime): number {
  let result: number;
  switch (crime) {
    case "theft":
      result = 1;
      break;
    default:
      result = 0;
  }
  return result;
}
```

Hinweis: Dafür gibt es keine ESLint-Regel - die Konvention wird im Review
geprüft.

## Magic Numbers

Bedeutungstragende Zahlen als **benannte Konstante** statt nackter Literale
(`stars > MAX_STARS` statt `stars > 6`). Triviale Werte (`0`, `1`, `2`,
Indizes, `* 100` fuer Prozent) bleiben direkt. Durchgesetzt via ESLint-Regel
`@typescript-eslint/no-magic-numbers`.

## Code dokumentieren (JSDoc / TSDoc)

Öffentliche Funktionen, Typen und Module mit einem JSDoc-Block `/** ... */`
dokumentieren. VS Code zeigt diese Kommentare beim Hovern als Tooltip an.

**Wichtig:** Keine Typ-Angaben in den Kommentaren - die Typen stehen bereits im
Code. Nur die _Bedeutung_ beschreiben.

Gängige Tags: `@param`, `@returns`, `@remarks`, `@example`, `@throws`,
`@see`, `@deprecated`, `@typeParam` (für Generics).

```ts
/**
 * Which quarter of town a point lies in.
 *
 * @param x - the point, in city pixels
 * @param y - the point, in city pixels
 * @returns the district it belongs to
 */
function districtAt(x: number, y: number): District { ... }
```

Eine durchsuchbare HTML-Doku wird mit **TypeDoc** erzeugt: `npm run docs`
(Ausgabe in `docs/api/`).

### Datei-Header

**Jede** Code-Datei beginnt mit einem kurzen `@module`-Doku-Block (Ein-Zeilen-Brief,
was die Datei verantwortet). Konsequent in allen Dateien, nicht nur in manchen -
so ist sofort klar, ob Doku fehlt oder bewusst knapp ist.

```ts
/**
 * Laying out Los Santos: streets, blocks, the beach and the four districts.
 *
 * @module
 */
```

Bei Next-Client-Komponenten steht der Block **über** `"use client"` (Kommentare
sind vor der Direktive erlaubt):

```ts
/**
 * The board, the hand and the log: one screen of Drecksau.
 * @module
 */
"use client";
```

### Doku-Kommentare vs. Inline-Notizen

- **Doku** (Bedeutung von Funktion/Typ/Property) -> `/** ... */` **über** der
  Deklaration. Nur so erscheint sie im Hover-Tooltip und in TypeDoc. Ein
  nachgestelltes `///<` wie in Doxygen gibt es nicht.
- **Inline-Notiz** zu einer konkreten Codezeile -> normaler `// ...`-Kommentar
  dahinter ist ok.

## Schreibweise: Striche

In allen Texten - UI-Texte, Code-Strings, Kommentare, Commit-Messages und
Markdown/Doku - immer den **einfachen Bindestrich `-`** (Tastaturzeichen, U+002D)
verwenden.

**Keine typografischen Sonderstriche:**

- kein Halbgeviertstrich `–` (en-dash, U+2013)
- kein Geviertstrich `—` (em-dash, U+2014)

Das gilt für **alle** Verwendungen - sowohl als Gedankenstrich (`Wort - Wort`)
als auch für Zahlenbereiche (`1200-1600`) und in zusammengesetzten Wörtern
(`react-dom`).
