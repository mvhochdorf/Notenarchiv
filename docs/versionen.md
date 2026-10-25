# Eine neue Version veröffentlichen

Die Vereine verwenden das Notenarchiv in einer festen Version - einem
**Git-Tag** wie `v1.2.0` in diesem Repository. Eine neue Version entsteht so:

1. **Änderungen fertig** auf `main` (die Prüfung unter **Actions** ist
   grün).
2. **Versionsnummer** in `website/package.json` erhöhen (`"version":
   "1.2.0"`), nach den Regeln oben in [CHANGELOG.md](../CHANGELOG.md):
   - nur Fehler behoben -> letzte Stelle (`1.1.0` -> `1.1.1`)
   - neue Funktionen -> mittlere Stelle (`1.1.1` -> `1.2.0`)
   - Vereine müssen mehr tun als Regeln veröffentlichen -> erste Stelle
     (`1.2.0` -> `2.0.0`)
3. **CHANGELOG.md** ergänzen: neuer Abschnitt `## 1.2.0` oben, was neu ist.
   Hat sich `website/database.rules.json` seit der letzten Version geändert,
   **"Regeln neu veröffentlichen."** dazuschreiben.
4. Committen und pushen.
5. **Tag setzen** - das ist die eigentliche Veröffentlichung:

   ```bash
   git tag v1.2.0
   git push origin v1.2.0
   ```

   Optional auf GitHub unter **Releases -> Draft a new release** den Tag
   wählen und den Text aus dem CHANGELOG einfügen - dann sehen die Vereine
   die Version auch dort.

Ab jetzt kann jeder Verein `v1.2.0` in seinen Workflow-Dateien eintragen.

## Gut zu wissen

- **Tags nicht verschieben.** Eine veröffentlichte Version bleibt, wie sie
  ist; für eine Korrektur gibt es eine neue (`v1.2.1`). So baut ein Verein
  heute und in einem Jahr dieselbe App.
- **Das Repository muss öffentlich sein**, damit die Vereins-Repositorys
  die Workflows und den Code holen können. (Bei einer GitHub-Organisation
  geht auch privat: Settings -> Actions -> General -> Access, "Accessible
  from repositories in the organization".) Geheimes steht hier ohnehin
  nichts - die Zugänge liegen in den Vereins-Repositorys.
- **Workflows ändern:** `verein-seite.yml` und `verein-videos.yml` werden
  von den Vereinen in der Version ihres Tags verwendet. Ändern sich deren
  Eingaben, ist das eine Haupt-Version.
- **Ausprobieren vor dem Tag:** Ein Vereins-Repository darf statt eines Tags
  auch einen Branch eintragen (z. B. `main`) - nur zum Testen, danach wieder
  eine Version.
