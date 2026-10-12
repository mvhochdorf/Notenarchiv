# Firebase einrichten - Schritt für Schritt

Diese Anleitung richtet die gemeinsame Datenbank für das Notenarchiv ein.
Danach sehen alle Musikerinnen und Musiker dieselben Bewertungen, Likes,
Kommentare und Video-Links, und die Auswertung zeigt die Daten aller.

Dauer: etwa 15 Minuten. Kosten: keine (kostenloser Spark-Tarif).

Was man braucht:

- ein Google-Konto - am besten eines des Vereins, nicht ein privates oder ein
  Firmenkonto, damit das Projekt beim Verein bleibt
- Zugriff auf dieses Repository (`mvhochdorf/Notenarchiv`)

Bis die Schritte erledigt sind, läuft die App im **lokalen Modus**: Alles
wird nur im jeweiligen Browser gespeichert. Oben in der App steht dann
"Lokaler Modus - Bewertungen nur auf diesem Gerät".

---

## Schritt 1 - Projekt anlegen

1. <https://console.firebase.google.com> öffnen und mit dem Vereinskonto
   anmelden.
2. **Projekt erstellen** (bzw. **Projekt hinzufügen**) anklicken.
3. Projektname: `notenarchiv-mvhochdorf` eingeben.
   Firebase hängt eventuell eine Zeichenfolge an die Projekt-ID an
   (z. B. `notenarchiv-mvhochdorf-1a2b3`) - das ist in Ordnung.
4. Nutzungsbedingungen bestätigen, **Weiter**.
5. **Google Analytics** ausschalten (wird nicht gebraucht), dann
   **Projekt erstellen**.
6. Warten, bis "Ihr neues Projekt ist bereit" erscheint, dann **Weiter**.

## Schritt 2 - Anonyme Anmeldung einschalten

Die App meldet jedes Gerät unsichtbar an, ohne Passwort. Das muss erlaubt
werden.

1. Links im Menü **Sicherheit** -> **Authentication** (in älteren Ansichten
   unter **Build**).
2. **Los geht's** (bzw. **Jetzt starten**) anklicken.
3. Reiter **Anmeldemethode** (Sign-in method).
4. In der Liste der Anbieter **Anonym** (Anonymous) anklicken.
5. Schalter auf **Aktivieren**, dann **Speichern**.

In der Liste steht jetzt bei "Anonym" der Status **Aktiviert**.

## Schritt 3 - Datenbank anlegen

1. Links im Menü **Datenbanken und Speicher** -> **Realtime Database** (in
   älteren Ansichten unter **Build**).
   Achtung: nicht "Firestore Database" - das ist eine andere Datenbank.
2. **Datenbank erstellen** anklicken.
3. Standort: **Belgien (europe-west1)** wählen, **Weiter**.
4. **Im gesperrten Modus starten** wählen, **Aktivieren**.

Oben auf der Datenbankseite steht jetzt die Adresse der Datenbank, etwa
`https://notenarchiv-mvhochdorf-default-rtdb.europe-west1.firebasedatabase.app/`.

## Schritt 4 - Sicherheitsregeln eintragen

Die Regeln legen fest, wer was schreiben darf - zum Beispiel, dass jeder nur
seine eigenen Kommentare löschen kann.

1. Auf der Seite **Realtime Database** den Reiter **Regeln** öffnen.
2. Den kompletten Text im Editor löschen.
3. Die Datei `website/database.rules.json` aus diesem Repository öffnen,
   den **gesamten** Inhalt kopieren (von der ersten `{` bis zur letzten `}`)
   und in den Editor einfügen.
4. **Veröffentlichen** anklicken.

Erscheint ein Fehler, wurde meist nicht alles kopiert - noch einmal den
ganzen Dateiinhalt einfügen.

## Schritt 5 - Web-App anlegen und Zugangsdaten holen

1. Links oben neben "Projektübersicht" auf das **Zahnrad** ->
   **Projekteinstellungen**.
2. Reiter **Allgemein**, ganz nach unten zu **Meine Apps**.
3. Auf das Symbol **`</>`** (Web) klicken.
4. App-Spitzname: `notenarchiv-web`.
   **"Firebase Hosting einrichten" NICHT anhaken** (die Seite läuft über
   GitHub Pages).
5. **App registrieren**.
6. Es erscheint ein Codeblock mit `const firebaseConfig = { ... }`. Diesen
   Block kopieren - er sieht so aus (mit anderen Werten):

   ```js
   const firebaseConfig = {
     apiKey: "AIza...",
     authDomain: "notenarchiv-mvhochdorf.firebaseapp.com",
     databaseURL:
       "https://notenarchiv-mvhochdorf-default-rtdb.europe-west1.firebasedatabase.app",
     projectId: "notenarchiv-mvhochdorf",
     storageBucket: "notenarchiv-mvhochdorf.firebasestorage.app",
     messagingSenderId: "123456789012",
     appId: "1:123456789012:web:abc123...",
   };
   ```

7. **Weiter zur Konsole**.

Wichtig: Es muss eine Zeile `databaseURL` dabei sein. Fehlt sie, wurde die
Datenbank (Schritt 3) erst nach der Web-App angelegt - dann den Block unter
Projekteinstellungen -> Allgemein -> Meine Apps -> **Konfiguration** erneut
kopieren, dort ist sie jetzt enthalten.

Diese Werte sind **nicht geheim**. Sie stehen später im Browser jedes
Besuchers; geschützt wird die Datenbank durch die Regeln aus Schritt 4.

## Schritt 6 - GitHub-Seite freigeben

Das passiert in der **Firebase-Konsole**, nicht bei GitHub: Firebase
erlaubt die Anmeldung nur von Webseiten, die hier eingetragen sind.

1. Links **Sicherheit** -> **Authentication** -> oben Reiter
   **Einstellungen** -> links **Autorisierte Domains**.
2. **Domain hinzufügen**: `mvhochdorf.github.io` eintragen (ohne `https://`
   und ohne `/Notenarchiv`), **Hinzufügen**.

`localhost` steht dort schon (für das Testen am eigenen PC).

## Schritt 7 - Zugangsdaten in die App eintragen

Entweder den Block aus Schritt 5 an Claude geben ("hier ist die
firebaseConfig") - oder selbst eintragen:

1. Datei `website/src/lib/firebase-config.ts` öffnen.
2. Bei jedem Wert das leere `""` am Zeilenende durch den passenden Wert aus
   Schritt 5 ersetzen, zum Beispiel:

   ```ts
   apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "AIza...",
   authDomain:
     process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ??
     "notenarchiv-mvhochdorf.firebaseapp.com",
   ```

   Das gilt für alle sieben Werte: `apiKey`, `authDomain`, `databaseURL`,
   `projectId`, `storageBucket`, `messagingSenderId`, `appId`.

3. Speichern.

## Schritt 8 - Testen

1. `start.bat` ausführen (oder den laufenden Server neu laden).
2. Die App öffnet sich unter <http://localhost:3010>.
3. Der Hinweis "Lokaler Modus" darf **nicht** mehr erscheinen.
4. Namen eingeben, ein Stück bewerten und einen Kommentar schreiben.
5. In der Firebase-Konsole unter **Realtime Database** -> Reiter **Daten**
   erscheinen jetzt Einträge unter `notenarchiv` (`users`, `ratings`,
   `comments`, ...).
6. Zum Gegentest auf einem zweiten Gerät (z. B. Handy im selben WLAN) mit
   demselben Namen anmelden: Die eigene Bewertung ist dort schon zu sehen.

Bleibt der Hinweis "Offline - Bewertungen nur auf diesem Gerät" stehen,
stimmt meist etwas an Schritt 2 (Anonym nicht aktiviert), Schritt 4 (Regeln
nicht veröffentlicht) oder Schritt 7 (ein Wert falsch kopiert).

## Schritt 9 - Veröffentlichen

1. Die geänderte `firebase-config.ts` committen und auf `main` pushen.
2. Einmalig auf GitHub im Repository: **Settings** -> **Pages** ->
   **Source: GitHub Actions** wählen.
3. Nach jedem Push baut GitHub die Seite neu (Reiter **Actions**, dauert ein
   paar Minuten). Danach ist sie erreichbar unter
   <https://mvhochdorf.github.io/Notenarchiv/>.

Diesen Link an die Musikerinnen und Musiker verschicken. Beim ersten Öffnen
fragt die App nach Vor- und Nachname - bitte auf allen Geräten gleich
schreiben.

---

## Später: Auswerten und sichern

- **In der App**: Einstellungen -> **Auswertung**. Tabellen zu Stücken,
  Personen und Kommentaren, jeweils mit Download als Excel-Datei (CSV).
- **Rohdaten sichern**: Firebase-Konsole -> Realtime Database -> Reiter
  **Daten** -> Menü **⋮** oben rechts -> **JSON exportieren**. Am besten ab
  und zu machen, etwa vor der Jahreshauptversammlung.

## Später: Regeln ändern

Wenn sich `website/database.rules.json` ändert (z. B. bei neuen Funktionen),
die Datei wie in Schritt 4 erneut einfügen und veröffentlichen. Sonst
lehnt die Datenbank die neuen Daten ab.

## Gut zu wissen

- **Kosten**: Der Spark-Tarif ist kostenlos (1 GB Speicher, 10 GB Download
  pro Monat). Für einen Verein reicht das bei Weitem. Firebase fragt nie
  automatisch nach Geld; ohne Hinterlegen einer Zahlungsart kann nichts
  berechnet werden.
- **Name statt Passwort**: Wer einen fremden Namen eintippt, kann als diese
  Person bewerten. Für den Vereinsgebrauch ist das ein bewusster
  Kompromiss.
- **Datenschutz**: Gespeichert werden Vor- und Nachname, Bewertungen, Likes,
  gemerkte und angesehene Stücke sowie Kommentare. Die Daten liegen bei
  Google in Belgien (EU). Es empfiehlt sich, die Mitglieder kurz darüber zu
  informieren.
- **Mehrere Verwalter**: In der Firebase-Konsole unter Projekteinstellungen
  -> **Nutzer und Berechtigungen** können weitere Personen aus dem Verein
  Zugriff bekommen.
