# DSGVO Guard

Finds personal data in your Obsidian vault before it ends up where it should not: IBANs, tax IDs, credit cards, API keys and more. Built with German and EU data protection (GDPR, "DSGVO") in mind. Everything runs locally and offline; nothing is sent anywhere.

<a href="https://buymeacoffee.com/thor040175"><img src="docs/buy-me-a-coffee.svg" alt="Buy me a coffee" width="200"></a>

> Prototype (0.1.1). Pattern matching, not legal advice. Deutsche Anleitung: [ANLEITUNG.md](ANLEITUNG.md).

## What it detects

| Type | Check | Confidence |
|---|---|---|
| API keys (OpenAI, GitHub, AWS, Slack, Google) | prefix and length | high |
| IBAN | mod 97, German IBANs must have 22 characters | high |
| Credit card | Luhn, prefix 2-6 | high |
| German tax ID (Steuer-ID) | ISO 7064 mod 11,10 | medium |
| German pension insurance number | format, plausible birth date | medium |
| German ID card number (since 2010) | ICAO 9303 check digit, letter/digit mix | medium |
| German tax number (written with slashes) | format 2/3/5, 3/3/5 or 3/4/4, no check digit | medium |
| Address (street, house number, optional postcode and city) | pattern only | low |
| E-mail, German phone number | pattern only | low |

By default findings of medium confidence and higher are shown. Names are never detected.

### Special categories (GDPR Art. 9), optional

Off by default. A keyword search for health, religion, political opinion, trade union, ethnic origin, sex life and genetic/biometric data. These are **hints only**: a keyword does not tell whether a person is affected, so expect false alarms. Hints are never redacted, never block a commit (the hook only prints them) and appear at most once per category and line. The keyword list is `ART9_CATEGORIES` in `main.js`.

## How it works

- **Status bar:** "DSGVO: n note(s) with findings" or "clean", refreshed shortly after each edit. Click it to open the list of findings.
- **Findings list:** per note the line, type and confidence, with a masked preview (for example `…3000` for an IBAN). Click a finding to jump to it.
- **Redact:** replaces findings in the current note with `[GESCHWÄRZT:iban]` and similar. One undo (Ctrl/Cmd+Z) restores everything, as long as the editor is open. Redacting is permanent afterwards, so keep a backup or use Git.
- **Git hook:** checks the staged notes on commit and aborts when real findings are in them. Needs a Git repository in the vault root and Node.js on the machine. Skip once with `git commit --no-verify`.

## Commands

- Check the whole vault for personal data (also via the ribbon icon)
- Check the current note
- Redact findings in the current note
- Install Git hook / Remove Git hook

## Exceptions

A line containing `dsgvo-ignore` is skipped, for example `Hotline: 0800 1234567 <!-- dsgvo-ignore -->`. This applies to the status bar, redaction and the Git hook alike. Folders can be excluded in the settings (one path prefix per line, for example `Contacts/`).

## Settings

- Minimum confidence (high, medium, low)
- Show special categories (Art. 9) as hints
- Ignored paths

## What the plugin accesses

- It reads the notes of your vault to scan them. Nothing leaves your computer; there are no network requests and no telemetry.
- "Install Git hook" writes `.git/hooks/pre-commit` in your vault folder. The hook runs `node` on the plugin's own `main.js`. "Remove Git hook" deletes it again; an existing hook of another tool is never overwritten.
- Because it uses Node.js APIs for the Git hook, the plugin is desktop only.

## Limits

- Obsidian does not let plugins hook into Obsidian Sync or Publish, so there is no way to stop an upload there. Only the Git hook can block, and only in a Git vault. Without Git the status bar is a warning only.
- Not detected: names, 13-digit national tax numbers, ID cards issued before 2010.
- Pattern matching produces false positives, mostly at low confidence and for the Art. 9 keywords.

## Installation (manual)

Copy `main.js` and `manifest.json` into `<vault>/.obsidian/plugins/dsgvo-guard/` and enable the plugin under Settings, Community plugins. Try it in a test vault first.

## Development

`npm test` runs the tests (Node.js required). The plugin is a single `main.js` without a build step.

## Support

DSGVO Guard is free and open source. If it keeps personal data out of places it does not belong, a coffee helps me keep improving it: [Buy me a coffee](https://buymeacoffee.com/thor040175). Built together with an AI assistant.

## License

MIT
