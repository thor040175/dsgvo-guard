# DSGVO Guard: Beschreibung und Anleitung

## Was es ist
DSGVO Guard ist ein Obsidian-Plugin, das den Vault nach personenbezogenen Daten durchsucht, bevor sie dort landen, wo sie nicht hingehören. Es arbeitet komplett offline und sendet nichts an einen Server.

## Was es erkennt
Es prüft nach festen Mustern und, wo möglich, mit echten Prüfziffern. Eine zufällige Zahl löst deshalb meist keinen Alarm aus.

| Sicherheit | Was |
|---|---|
| Hoch | API-Schlüssel und Tokens, IBAN, Kreditkartennummer |
| Mittel | Steuer-ID, Rentenversicherungsnummer, Personalausweisnummer (ab 2010), Steuernummer mit Schrägstrichen |
| Niedrig | Adressen, E-Mail, Telefonnummer |
| Optional (Hinweise) | Stichworte zu besonderen Kategorien nach Art. 9 DSGVO (Gesundheit, Religion, politische Meinung, Gewerkschaft, ethnische Herkunft, Sexualleben, Genetik/Biometrie) |

Standard ist "Mittel". Namen werden nie erkannt.

## Wie es arbeitet
- **Statusleiste:** "DSGVO: n Notiz(en) mit Treffern" oder "sauber", aktualisiert ein bis zwei Sekunden nach jeder Änderung. Ein Klick öffnet die Trefferliste.
- **Trefferliste:** Pro Notiz Zeile, Typ und Sicherheit, mit maskierter Vorschau (z. B. `…3000`). Ein Klick springt an die Stelle.
- **Schwärzen:** Ersetzt Treffer in der aktuellen Notiz durch `[GESCHWÄRZT:iban]` und Ähnliches. Strg+Z macht alles in einem Schritt rückgängig, solange der Editor offen ist.
- **Git-Hook:** Prüft beim Commit die gestagten Notizen und bricht bei echten Treffern ab. Braucht Git im Vault und Node auf dem Rechner.
- **Art.-9-Hinweise:** Nur Hinweise, nie geschwärzt, blockieren keine Commits.

## Benutzung
1. `main.js` und `manifest.json` nach `<Vault>/.obsidian/plugins/dsgvo-guard/` kopieren, unter Community-Plugins aktivieren.
2. Prüfen: Statusleiste ansehen, oder Strg+P und "Gesamten Vault prüfen" bzw. "Aktuelle Notiz prüfen".
3. Schwärzen: Strg+P, "Treffer in aktueller Notiz schwärzen".
4. Bewusst behaltene Daten freigeben: `<!-- dsgvo-ignore -->` oder `%% dsgvo-ignore %%` in die Zeile schreiben.
5. Git-Hook: Strg+P, "Git-Hook installieren" bzw. "Git-Hook entfernen". Im Ausnahmefall: `git commit --no-verify`.
6. Einstellungen: Mindest-Sicherheit, Art.-9-Hinweise, ignorierte Pfade (z. B. `Kontakte/`).

## Typischer Fall: Kontakte mit Klardaten im Vault
Das Plugin findet E-Mail, Telefon, Adresse, IBAN usw. und zeigt sie an. Was du dann tust, hängt vom Ziel ab:
- **Die Daten gehören nicht in den Vault:** schwärzen. Achtung, das Schwärzen ist endgültig: Nach dem Schließen der Notiz gibt es kein Strg+Z mehr, die Originaldaten sind nur noch in einer Sicherung oder in Git zu finden.
- **Die Daten gehören bewusst in den Vault** (ein Kontakt braucht seine Telefonnummer): nicht schwärzen. Gib die Zeilen mit `dsgvo-ignore` frei oder trage den Ordner (z. B. `Kontakte/`) in die ignorierten Pfade ein. Dann bleiben Statusleiste und Git-Hook ruhig.
- **Die Daten dürfen nicht nach außen** (Git-Push, Weitergabe): Hook installieren und den Ordner mit den Kontakten nicht ins Repository aufnehmen, oder gezielt freigeben.

Das Plugin ist also ein Wächter. Es zeigt, wo personenbezogene Daten liegen. Ob sie bleiben dürfen, entscheidest du.

## Unterstützen
DSGVO Guard ist kostenlos und Open Source. Wenn es dir hilft, freue ich mich über einen Kaffee: https://buymeacoffee.com/thor040175

## Grenzen
- Obsidian erlaubt Plugins keinen Eingriff in Obsidian Sync oder Publish, dort kann nur gewarnt werden. Blockieren kann nur der Git-Hook.
- Es ist reine Mustersuche und kein Rechtsgutachten. Nicht erkannt werden u. a. Namen, 13-stellige Steuernummern und Ausweise vor 2010. Fehlalarme gibt es vor allem bei "Niedrig" und bei den Art.-9-Stichworten.
- Der Stand ist ein Prototyp: 28 automatische Tests und ein Test im Test-Vault, noch nicht an einem großen, echten Vault.
