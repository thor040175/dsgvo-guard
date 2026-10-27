'use strict';

// Außerhalb von Obsidian (Git-Hook per Node) gibt es kein 'obsidian'-Modul.
const obsidian = (() => {
  try {
    return require('obsidian');
  } catch (e) {
    return null;
  }
})();
const Plugin = obsidian ? obsidian.Plugin : class {};
const Modal = obsidian ? obsidian.Modal : class {};
const Notice = obsidian ? obsidian.Notice : class {};
const PluginSettingTab = obsidian ? obsidian.PluginSettingTab : class {};
const Setting = obsidian ? obsidian.Setting : class {};

/* ------------------------------------------------------------------ *
 * Detektoren: reine Logik ohne Obsidian-Abhängigkeit (testbar)
 * ------------------------------------------------------------------ */

const CONFIDENCE_RANK = { low: 1, medium: 2, high: 3 };

function luhnValid(num) {
  let sum = 0;
  let alt = false;
  for (let i = num.length - 1; i >= 0; i--) {
    let d = num.charCodeAt(i) - 48;
    if (alt) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    alt = !alt;
  }
  return sum % 10 === 0;
}

// ISO 13616 (Mod 97). Deutsche IBAN müssen genau 22 Zeichen haben.
function ibanValid(raw) {
  const iban = raw.replace(/\s/g, '').toUpperCase();
  if (iban.length < 15 || iban.length > 34) return false;
  if (iban.startsWith('DE') && iban.length !== 22) return false;
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  let rem = 0;
  for (const ch of rearranged) {
    const v = ch >= 'A' ? String(ch.charCodeAt(0) - 55) : ch;
    for (const c of v) rem = (rem * 10 + (c.charCodeAt(0) - 48)) % 97;
  }
  return rem === 1;
}

// Steuerliche Identifikationsnummer: 11 Ziffern, Prüfziffer nach ISO 7064 Mod 11,10.
function steuerIdValid(raw) {
  const s = raw.replace(/\s/g, '');
  if (!/^[1-9]\d{10}$/.test(s)) return false;
  const counts = {};
  for (const c of s.slice(0, 10)) counts[c] = (counts[c] || 0) + 1;
  const max = Math.max(...Object.values(counts));
  if (max < 2 || max > 3) return false;
  let product = 10;
  for (let i = 0; i < 10; i++) {
    let sum = (s.charCodeAt(i) - 48 + product) % 10;
    if (sum === 0) sum = 10;
    product = (sum * 2) % 11;
  }
  let check = 11 - product;
  if (check === 10) check = 0;
  return check === s.charCodeAt(10) - 48;
}

// Rentenversicherungsnummer: 2 Bereichsziffern, Geburtsdatum TTMMJJ, Buchstabe, 3 Ziffern.
// Die Prüfziffer wird bewusst nicht geprüft, daher nur mittlere Sicherheit.
function svnrPlausible(raw) {
  const s = raw.replace(/\s/g, '');
  const day = Number(s.slice(2, 4));
  const month = Number(s.slice(4, 6));
  return day >= 1 && day <= 31 && month >= 1 && month <= 12;
}

// Reihenfolge = Priorität bei überlappenden Treffern.
const DETECTORS = [
  {
    type: 'apikey',
    label: 'API-Schlüssel / Token',
    confidence: 'high',
    regex: /(?<![\w-])(?:sk-[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,}|AKIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{10,}|AIza[0-9A-Za-z_-]{35})/g,
  },
  {
    type: 'iban',
    label: 'IBAN',
    confidence: 'high',
    regex: /(?<![A-Za-z0-9])[A-Z]{2}\d{2}(?: ?[A-Z0-9]{4}){3,7}(?: ?[A-Z0-9]{1,3})?(?![A-Za-z0-9])/g,
    validate: ibanValid,
  },
  {
    type: 'creditcard',
    label: 'Kreditkartennummer',
    confidence: 'high',
    regex: /(?<!\d)(?:\d[ -]?){12,18}\d(?!\d)/g,
    validate: (m) => {
      const d = m.replace(/\D/g, '');
      return d.length >= 13 && d.length <= 19 && /^[2-6]/.test(d) && luhnValid(d);
    },
  },
  {
    type: 'steuerid',
    label: 'Steuer-ID',
    confidence: 'medium',
    regex: /(?<!\d)\d{2} ?\d{3} ?\d{3} ?\d{3}(?!\d)/g,
    validate: steuerIdValid,
  },
  {
    type: 'svnr',
    label: 'Rentenversicherungsnummer',
    confidence: 'medium',
    regex: /(?<![A-Za-z0-9])\d{2} ?\d{6} ?[A-Z] ?\d{3}(?![A-Za-z0-9])/g,
    validate: svnrPlausible,
  },
  {
    type: 'email',
    label: 'E-Mail-Adresse',
    confidence: 'low',
    regex: /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g,
  },
  {
    type: 'phone',
    label: 'Telefonnummer (DE)',
    confidence: 'low',
    regex: /(?<![\w+])(?:\+49|0049|0)[ \t\-/()]*[1-9][\d \t\-/()]{6,14}\d/g,
    validate: (m) => m.replace(/\D/g, '').length >= 9,
  },
];

function previewOf(type, match) {
  if (type === 'iban' || type === 'creditcard') {
    const compact = match.replace(/[\s-]/g, '');
    return '…' + compact.slice(-4);
  }
  if (type === 'email') {
    const at = match.indexOf('@');
    return match.slice(0, 1) + '***' + match.slice(at);
  }
  return '[' + type + ']';
}

function scanText(text, options) {
  const minRank = CONFIDENCE_RANK[(options && options.minConfidence) || 'medium'];
  const kept = [];

  for (const det of DETECTORS) {
    if (CONFIDENCE_RANK[det.confidence] < minRank) continue;
    for (const m of text.matchAll(det.regex)) {
      if (det.validate && !det.validate(m[0])) continue;
      const start = m.index;
      const end = start + m[0].length;
      if (kept.some((k) => start < k.end && end > k.start)) continue;
      kept.push({
        type: det.type,
        label: det.label,
        confidence: det.confidence,
        start,
        end,
        preview: previewOf(det.type, m[0]),
      });
    }
  }

  kept.sort((a, b) => a.start - b.start);

  let line = 1;
  let pos = 0;
  for (const f of kept) {
    for (; pos < f.start; pos++) if (text.charCodeAt(pos) === 10) line++;
    f.line = line;
  }
  return kept;
}

function redactionFor(finding) {
  return '[GESCHWÄRZT:' + finding.type + ']';
}

function redactText(text, findings) {
  let out = text;
  for (const f of [...findings].sort((a, b) => b.start - a.start)) {
    out = out.slice(0, f.start) + redactionFor(f) + out.slice(f.end);
  }
  return out;
}

const DEFAULT_SETTINGS = {
  minConfidence: 'medium',
  ignoredPaths: '',
};

function isIgnoredPath(path, ignoredPaths) {
  return ignoredPaths
    .split('\n')
    .map((p) => p.trim())
    .filter(Boolean)
    .some((prefix) => path.startsWith(prefix));
}

/* ------------------------------------------------------------------ *
 * Git-Hook: derselbe Code läuft als `node main.js --check-staged`
 * ------------------------------------------------------------------ */

const HOOK_MARKER = '# dsgvo-guard pre-commit hook';

function buildHookScript(mainJsPath) {
  const p = mainJsPath.replace(/\\/g, '/');
  return [
    '#!/bin/sh',
    HOOK_MARKER,
    '# Bricht den Commit ab, wenn gestagte Markdown-Dateien personenbezogene Daten enthalten.',
    '# Umgehen im Ausnahmefall: git commit --no-verify',
    'if ! command -v node >/dev/null 2>&1; then',
    '  echo "DSGVO Guard: Node nicht gefunden, Pruefung uebersprungen." >&2',
    '  exit 0',
    'fi',
    'exec node "' + p + '" --check-staged',
    '',
  ].join('\n');
}

function checkStaged() {
  const fs = require('fs');
  const path = require('path');
  const { execFileSync } = require('child_process');

  let settings = DEFAULT_SETTINGS;
  try {
    settings = Object.assign({}, DEFAULT_SETTINGS, JSON.parse(fs.readFileSync(path.join(__dirname, 'data.json'), 'utf8')));
  } catch (e) {
    // keine gespeicherten Einstellungen: Standardwerte
  }

  const git = (args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const names = git(['diff', '--cached', '--name-only', '--diff-filter=ACM', '-z'])
    .split('\0')
    .filter((n) => n.toLowerCase().endsWith('.md') && !isIgnoredPath(n, settings.ignoredPaths));

  let total = 0;
  for (const name of names) {
    const findings = scanText(git(['show', ':' + name]), { minConfidence: settings.minConfidence });
    for (const f of findings) {
      total++;
      console.error('  ' + name + ':' + f.line + '  ' + f.label + ' (' + f.preview + ', ' + f.confidence + ')');
    }
  }

  if (total > 0) {
    console.error('\nDSGVO Guard: ' + total + ' Treffer in gestagten Dateien, Commit abgebrochen.');
    console.error('Notizen schwaerzen oder, wenn gewollt, mit "git commit --no-verify" umgehen.');
    return 1;
  }
  return 0;
}

/* ------------------------------------------------------------------ *
 * Obsidian-Plugin
 * ------------------------------------------------------------------ */

class ResultsModal extends Modal {
  constructor(app, title, results) {
    super(app);
    this.title = title;
    this.results = results;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.createEl('h2', { text: this.title });

    if (this.results.length === 0) {
      contentEl.createEl('p', { text: 'Keine personenbezogenen Daten gefunden.' });
      return;
    }

    const total = this.results.reduce((n, r) => n + r.findings.length, 0);
    contentEl.createEl('p', {
      text: total + ' Treffer in ' + this.results.length + ' Notiz(en). Klick öffnet die Stelle.',
    });

    for (const { file, findings } of this.results) {
      contentEl.createEl('h4', { text: file.path });
      const ul = contentEl.createEl('ul');
      for (const f of findings) {
        const li = ul.createEl('li');
        const a = li.createEl('a', {
          text: 'Zeile ' + f.line + ': ' + f.label + ' (' + f.preview + ', ' + f.confidence + ')',
        });
        a.addEventListener('click', async (e) => {
          e.preventDefault();
          this.close();
          const leaf = this.app.workspace.getLeaf(false);
          await leaf.openFile(file, { eState: { line: f.line - 1 } });
        });
      }
    }
  }

  onClose() {
    this.contentEl.empty();
  }
}

class DsgvoGuardPlugin extends Plugin {
  async onload() {
    await this.loadSettings();

    this.addRibbonIcon('shield-alert', 'DSGVO Guard: Vault prüfen', () => this.scanVault());

    this.addCommand({
      id: 'scan-vault',
      name: 'Gesamten Vault auf personenbezogene Daten prüfen',
      callback: () => this.scanVault(),
    });

    this.addCommand({
      id: 'scan-current',
      name: 'Aktuelle Notiz prüfen',
      editorCallback: (editor, view) => {
        const findings = this.scan(editor.getValue());
        new ResultsModal(
          this.app,
          'DSGVO Guard: ' + view.file.name,
          findings.length ? [{ file: view.file, findings }] : []
        ).open();
      },
    });

    this.addCommand({
      id: 'redact-current',
      name: 'Treffer in aktueller Notiz schwärzen (rückgängig mit Strg+Z)',
      editorCallback: (editor) => {
        const findings = this.scan(editor.getValue());
        if (!findings.length) {
          new Notice('DSGVO Guard: nichts zu schwärzen.');
          return;
        }
        // Von hinten nach vorne ersetzen, damit frühere Offsets gültig bleiben.
        for (const f of [...findings].reverse()) {
          editor.replaceRange(redactionFor(f), editor.offsetToPos(f.start), editor.offsetToPos(f.end));
        }
        new Notice('DSGVO Guard: ' + findings.length + ' Treffer geschwärzt.');
      },
    });

    this.addCommand({
      id: 'install-git-hook',
      name: 'Git-Hook installieren (blockiert Commits mit Treffern)',
      callback: () => this.installGitHook(),
    });

    this.addCommand({
      id: 'remove-git-hook',
      name: 'Git-Hook entfernen',
      callback: () => this.removeGitHook(),
    });

    // Statusleiste: Zähler der Notizen mit Treffern, aktuell gehalten bei Änderungen.
    this.hits = new Map();
    this.timers = new Map();
    this.statusEl = this.addStatusBarItem();
    this.statusEl.addClass('mod-clickable');
    this.statusEl.addEventListener('click', () => this.showHits());
    this.renderStatus();

    this.app.workspace.onLayoutReady(() => {
      this.refreshAll();
      this.registerEvent(this.app.vault.on('modify', (f) => this.queueRefresh(f)));
      this.registerEvent(this.app.vault.on('create', (f) => this.queueRefresh(f)));
      this.registerEvent(
        this.app.vault.on('delete', (f) => {
          this.hits.delete(f.path);
          this.renderStatus();
        })
      );
      this.registerEvent(
        this.app.vault.on('rename', (f, oldPath) => {
          this.hits.delete(oldPath);
          this.queueRefresh(f);
        })
      );
    });

    this.addSettingTab(new DsgvoGuardSettingTab(this.app, this));
  }

  onunload() {
    for (const t of this.timers.values()) clearTimeout(t);
  }

  scan(text) {
    return scanText(text, { minConfidence: this.settings.minConfidence });
  }

  isIgnored(path) {
    return isIgnoredPath(path, this.settings.ignoredPaths);
  }

  async refreshFile(file) {
    if (file.extension !== 'md' || this.isIgnored(file.path)) {
      this.hits.delete(file.path);
      return;
    }
    const findings = this.scan(await this.app.vault.cachedRead(file));
    if (findings.length) this.hits.set(file.path, { file, findings });
    else this.hits.delete(file.path);
  }

  queueRefresh(file) {
    if (!file || file.extension !== 'md') return;
    clearTimeout(this.timers.get(file.path));
    this.timers.set(
      file.path,
      setTimeout(async () => {
        this.timers.delete(file.path);
        await this.refreshFile(file);
        this.renderStatus();
      }, 1500)
    );
  }

  async refreshAll() {
    this.hits.clear();
    for (const file of this.app.vault.getMarkdownFiles()) await this.refreshFile(file);
    this.renderStatus();
  }

  renderStatus() {
    const n = this.hits.size;
    this.statusEl.setText(n ? 'DSGVO: ' + n + ' Notiz(en) mit Treffern' : 'DSGVO: sauber');
  }

  showHits() {
    new ResultsModal(this.app, 'DSGVO Guard: Notizen mit Treffern', [...this.hits.values()]).open();
  }

  async scanVault() {
    const notice = new Notice('DSGVO Guard: prüfe Vault …', 0);
    await this.refreshAll();
    notice.hide();
    this.showHits();
  }

  gitHookPath() {
    const adapter = this.app.vault.adapter;
    if (!adapter.getBasePath) return null;
    const path = require('path');
    return path.join(adapter.getBasePath(), '.git', 'hooks', 'pre-commit');
  }

  installGitHook() {
    const fs = require('fs');
    const path = require('path');
    const hook = this.gitHookPath();
    if (!hook || !fs.existsSync(path.dirname(hook))) {
      new Notice('DSGVO Guard: Kein Git-Repository im Vault-Hauptordner gefunden.');
      return;
    }
    if (fs.existsSync(hook) && !fs.readFileSync(hook, 'utf8').includes(HOOK_MARKER)) {
      new Notice('DSGVO Guard: Es gibt schon einen anderen pre-commit-Hook, nichts geändert.');
      return;
    }
    const mainJs = path.join(this.app.vault.adapter.getBasePath(), this.manifest.dir, 'main.js');
    fs.writeFileSync(hook, buildHookScript(mainJs), { mode: 0o755 });
    new Notice('DSGVO Guard: Git-Hook installiert (benötigt Node auf dem Rechner).');
  }

  removeGitHook() {
    const fs = require('fs');
    const hook = this.gitHookPath();
    if (!hook || !fs.existsSync(hook) || !fs.readFileSync(hook, 'utf8').includes(HOOK_MARKER)) {
      new Notice('DSGVO Guard: Kein eigener Git-Hook gefunden.');
      return;
    }
    fs.unlinkSync(hook);
    new Notice('DSGVO Guard: Git-Hook entfernt.');
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}

class DsgvoGuardSettingTab extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  hide() {
    // Erst beim Schließen neu prüfen, nicht bei jedem Tastendruck.
    this.plugin.refreshAll();
  }

  display() {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl)
      .setName('Mindest-Sicherheit')
      .setDesc('Hoch: nur prüfsummen-validierte Treffer. Niedrig: zusätzlich E-Mail und Telefon (mehr Fehlalarme).')
      .addDropdown((dd) =>
        dd
          .addOption('high', 'Hoch')
          .addOption('medium', 'Mittel')
          .addOption('low', 'Niedrig')
          .setValue(this.plugin.settings.minConfidence)
          .onChange(async (v) => {
            this.plugin.settings.minConfidence = v;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Ignorierte Pfade')
      .setDesc('Ein Pfad-Präfix pro Zeile, z. B. "Vorlagen/".')
      .addTextArea((ta) =>
        ta.setValue(this.plugin.settings.ignoredPaths).onChange(async (v) => {
          this.plugin.settings.ignoredPaths = v;
          await this.plugin.saveSettings();
        })
      );
  }
}

module.exports = DsgvoGuardPlugin;
module.exports.detectors = {
  scanText,
  redactText,
  ibanValid,
  steuerIdValid,
  luhnValid,
  svnrPlausible,
  isIgnoredPath,
  buildHookScript,
  HOOK_MARKER,
};

if (process.argv.includes('--check-staged') && require.main === module) {
  process.exitCode = checkStaged();
}
