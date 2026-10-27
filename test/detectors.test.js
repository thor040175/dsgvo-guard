'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

// Ohne Obsidian fehlt das 'obsidian'-Modul; main.js muss trotzdem ladbar sein (Git-Hook).
const { scanText, redactText, ibanValid, steuerIdValid, isIgnoredPath, buildHookScript, HOOK_MARKER } =
  require('../main.js').detectors;
const MAIN_JS = path.join(__dirname, '..', 'main.js');

const types = (text, opts) => scanText(text, opts).map((f) => f.type);

test('gültige deutsche IBAN wird erkannt, ungültige nicht', () => {
  assert.ok(ibanValid('DE89 3704 0044 0532 0130 00'));
  assert.ok(!ibanValid('DE89 3704 0044 0532 0130 01'));
  assert.deepStrictEqual(types('Konto: DE89 3704 0044 0532 0130 00 bitte'), ['iban']);
  assert.deepStrictEqual(types('Konto: DE89 3704 0044 0532 0130 01 bitte'), []);
});

test('Steuer-ID mit gültiger Prüfziffer', () => {
  assert.ok(steuerIdValid('65929970489'));
  assert.ok(!steuerIdValid('65929970488'));
  assert.deepStrictEqual(types('ID 65 929 970 489'), ['steuerid']);
});

test('Kreditkarte nach Luhn', () => {
  assert.deepStrictEqual(types('Karte 4111 1111 1111 1111'), ['creditcard']);
  assert.deepStrictEqual(types('Karte 4111 1111 1111 1112'), []);
});

test('IBAN wird nicht zusätzlich als Kreditkarte gemeldet', () => {
  assert.deepStrictEqual(types('DE89370400440532013000'), ['iban']);
});

test('API-Schlüssel', () => {
  const key = 'ghp_' + 'a1B2c3D4e5'.repeat(4);
  assert.deepStrictEqual(types('token=' + key), ['apikey']);
});

test('Rentenversicherungsnummer', () => {
  assert.deepStrictEqual(types('SVNR 15070649C103'), ['svnr']);
  assert.deepStrictEqual(types('SVNR 15990649C103'), []);
});

test('E-Mail und Telefon nur bei niedriger Schwelle', () => {
  const text = 'max@example.de und 0171 2345678';
  assert.deepStrictEqual(types(text, { minConfidence: 'medium' }), []);
  assert.deepStrictEqual(types(text, { minConfidence: 'low' }), ['email', 'phone']);
});

test('Zeilennummern stimmen', () => {
  const f = scanText('eins\nzwei\nIBAN DE89 3704 0044 0532 0130 00');
  assert.strictEqual(f[0].line, 3);
});

test('Schwärzen ersetzt Treffer und lässt den Rest unberührt', () => {
  const text = 'a DE89370400440532013000 b 4111111111111111 c';
  const out = redactText(text, scanText(text));
  assert.strictEqual(out, 'a [GESCHWÄRZT:iban] b [GESCHWÄRZT:creditcard] c');
});

test('Vorschau gibt keine vollständigen Daten preis', () => {
  const [f] = scanText('DE89 3704 0044 0532 0130 00');
  assert.strictEqual(f.preview, '…3000');
});

test('Ignorierte Pfade nach Präfix', () => {
  assert.ok(isIgnoredPath('Vorlagen/a.md', 'Vorlagen/\nArchiv/'));
  assert.ok(!isIgnoredPath('Notizen/a.md', 'Vorlagen/\nArchiv/'));
  assert.ok(!isIgnoredPath('Notizen/a.md', ''));
});

test('Hook-Skript enthält Marker und Vorwärts-Schrägstriche', () => {
  const script = buildHookScript('C:\\Vault\\.obsidian\\plugins\\dsgvo-guard\\main.js');
  assert.ok(script.startsWith('#!/bin/sh'));
  assert.ok(script.includes(HOOK_MARKER));
  assert.ok(script.includes('node "C:/Vault/.obsidian/plugins/dsgvo-guard/main.js" --check-staged'));
});

const gitAvailable = spawnSync('git', ['--version']).status === 0;

test('--check-staged bricht bei Treffern ab und lässt saubere Notizen durch', { skip: !gitAvailable }, () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'dsgvo-guard-'));
  const run = (cmd, args) => spawnSync(cmd, args, { cwd: repo, encoding: 'utf8' });
  try {
    run('git', ['init']);

    fs.writeFileSync(path.join(repo, 'sauber.md'), 'Nur harmloser Text.\n');
    run('git', ['add', 'sauber.md']);
    assert.strictEqual(run('node', [MAIN_JS, '--check-staged']).status, 0);

    fs.writeFileSync(path.join(repo, 'konto.md'), 'x\nIBAN DE89 3704 0044 0532 0130 00\n');
    run('git', ['add', 'konto.md']);
    const res = run('node', [MAIN_JS, '--check-staged']);
    assert.strictEqual(res.status, 1);
    assert.ok(res.stderr.includes('konto.md:2'));
    assert.ok(!res.stderr.includes('3704'), 'Vorschau darf keine vollständige IBAN ausgeben');
  } finally {
    fs.rmSync(repo, { recursive: true, force: true });
  }
});
