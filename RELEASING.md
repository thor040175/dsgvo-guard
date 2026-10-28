# Release für den Obsidian-Katalog (Anleitung, Stand der Recherche)

Quelle: offizielle Obsidian-Dokumentation zur Einreichung (docs.obsidian.md). Die Einreichung läuft aktuell über das Portal community.obsidian.md, nicht mehr über einen Pull Request. Vor dem Einreichen die Seite nochmal ansehen, die Regeln können sich ändern.

## Was im Repo schon passt
- `README.md`, `LICENSE` (MIT) und `manifest.json` liegen im Hauptordner.
- `manifest.json`: `id` ohne "obsidian", Version `0.1.0` im Format x.y.z, englische Beschreibung ohne Plugin-Namen, `isDesktopOnly: true`.
- `versions.json` ordnet Plugin-Version und Mindest-Obsidian-Version zu.
- `main.js` liegt fertig im Hauptordner, es gibt keinen Build-Schritt.

## Vor dem Einreichen zu klären (Entscheidungen von dir)
1. **Repo öffentlich machen.** Nutzer laden das Plugin aus dem GitHub-Release herunter, das geht nur bei einem öffentlichen Repo.
2. **Autorenangabe:** `author` steht auf "Armin". Optional kann `authorUrl` (z. B. dein GitHub-Profil) ergänzt werden.
3. **minAppVersion `1.7.2`** ist ein Schätzwert, nicht geprüft. Vor dem Release auf der ältesten Obsidian-Version testen, die du unterstützen willst, und den Wert gegebenenfalls anpassen (auch in `versions.json`).
4. **Mobil:** Das Plugin ist bewusst nur für den Desktop (`isDesktopOnly: true`), weil der Git-Hook Node-Funktionen nutzt.

## Schritte
1. Änderungen committen und pushen, die Datei `manifest.json` im Standard-Branch muss stimmen (das Portal liest sie dort).
2. Auf GitHub ein Release anlegen:
   - Tag genau wie die Version in `manifest.json`: `0.1.0` (ohne `v`).
   - Als Dateien anhängen: `main.js` und `manifest.json`.
3. Auf community.obsidian.md mit dem Obsidian-Konto anmelden, das GitHub-Konto verknüpfen und das Plugin über "Set up and claim" hinzufügen.
4. Die Prüfung läuft automatisch. Fehler zeigt das Portal an, sie blockieren die Installation, bis ein neues Release mit höherer Version sie behebt.

## Offene Risiken
- Ob das Plugin die automatische Prüfung besteht, ist nicht getestet.
- Der Katalog zeigt den Anfang der README. Sie ist deshalb auf Englisch, die deutsche Anleitung steht in `ANLEITUNG.md`.

## Ab 0.1.1: Release über den Workflow
Die Datei `.github/workflows/release.yml` legt das Release selbst an, sobald ein Versions-Tag gepusht wird (z. B. `0.1.1`, ohne `v`). Sie prüft, dass der Tag zur Version in `manifest.json` passt, führt die Tests aus, erzeugt Attestierungen für `main.js` und `manifest.json` und hängt beide Dateien ans Release.

Ablauf: Version in `manifest.json`, `versions.json` und `package.json` erhöhen, committen, pushen, dann `git tag 0.1.1` und `git push origin 0.1.1`. Danach im Portal "Check for new releases" klicken. Das Release nicht zusätzlich von Hand anlegen, sonst scheitert der Workflow, weil es schon existiert.
