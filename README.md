# DSGVO Guard (Prototyp)

Obsidian-Plugin, das offline personenbezogene Daten im Vault findet. Es sendet nichts irgendwohin.

## Erkennung
| Typ | Prüfung | Sicherheit |
|---|---|---|
| API-Schlüssel (OpenAI, GitHub, AWS, Slack, Google) | Präfix und Länge | hoch |
| IBAN | Mod 97, DE = 22 Zeichen | hoch |
| Kreditkarte | Luhn, Präfix 2–6 | hoch |
| Steuer-ID | ISO 7064 Mod 11,10 | mittel |
| Rentenversicherungsnummer | Format, Geburtsdatum plausibel | mittel |
| Personalausweisnummer (ab 2010) | ICAO-9303-Prüfziffer, Buchstaben- und Ziffernmix | mittel |
| Steuernummer (Schreibweise mit Schrägstrichen) | Format 2/3/5, 3/3/5 oder 3/4/4, ohne Prüfziffer | mittel |
| Adresse (Straße, Hausnummer, optional PLZ und Ort) | nur Muster, bewusst ohne "-ring" | niedrig |
| E-Mail, Telefon (DE) | nur Muster | niedrig |

## Besondere Kategorien (Art. 9 DSGVO)
Optional (Einstellungen, standardmäßig aus): Stichwortsuche nach Gesundheit, Religion, politischer Meinung, Gewerkschaft, ethnischer Herkunft, Sexualleben und Genetik/Biometrie. Das sind **nur Hinweise**: Ein Stichwort sagt nicht, ob eine Person betroffen ist, deshalb gibt es Fehlalarme. Hinweise werden nie geschwärzt, blockieren keine Commits (der Hook zeigt sie nur an) und erscheinen höchstens einmal pro Kategorie und Zeile. Die Stichwortliste steht in `ART9_CATEGORIES` in `main.js`.

## Befehle
- Gesamten Vault prüfen (auch über das Ribbon-Symbol)
- Aktuelle Notiz prüfen
- Treffer in aktueller Notiz schwärzen (Strg+Z macht es rückgängig)

## Ausnahmen
Eine Zeile, die `dsgvo-ignore` enthält, wird übersprungen, z. B. `Hotline: 0800 1234567 <!-- dsgvo-ignore -->`. Das gilt für Statusleiste, Schwärzen und Git-Hook. Der Hook lässt sich im Notfall auch mit `git commit --no-verify` umgehen.

## Installation zum Testen
Ordner `dsgvo-guard` nach `<Vault>/.obsidian/plugins/dsgvo-guard/` kopieren (nötig sind `main.js` und `manifest.json`), dann in Obsidian unter Community-Plugins aktivieren. Am besten zuerst in einem Test-Vault.

## Tests
Mit installiertem Node: `npm test`.

## Grenzen
Obsidian erlaubt Plugins keinen Eingriff in Obsidian Sync oder Publish, es gibt dort keinen Haken vor dem Hochladen. Wirklich blockieren kann nur der Git-Hook (nur mit Git-Vault und Node). Ohne Git bleibt die Statusleiste als Warnung.

## Noch offen
- 13-stellige bundeseinheitliche Steuernummer, alte Personalausweise
- Prüfung geänderter Notizen im Hintergrund





