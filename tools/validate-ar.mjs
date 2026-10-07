/**
 * Validator for the Arabic dictionaries.
 *
 * Two working modes:
 *
 * 1. Full mode — when the research artifact `inventory/` is present (it holds the
 *    English dictionaries extracted from the installed build). Every namespace is
 *    checked for:
 *      - identical key set, in the same order as the English source
 *      - every value a non-empty string
 *      - identical set of `{placeholder}` tokens per key (ICU-free, `{name}` style)
 *      - identical newline count per key (paragraph structure preserved)
 *      - no leftover pure-ASCII English sentence where Arabic is expected
 *        (a warning, not a failure: brand-only strings are legitimate)
 *
 * 2. Keys-only mode — a fresh clone ships `tools/namespace-keys.json` instead of
 *    the extracted English strings, which are not redistributed. Key parity is
 *    still enforced; placeholder and newline parity need the English values and
 *    are reported as skipped.
 *
 * Usage: node tools/validate-ar.mjs [--strict]
 * Exit code 1 if any hard check fails, or if --strict and coverage is incomplete.
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const strict = process.argv.includes('--strict');

const indexFile = join(root, 'inventory', '_index.json');
const keysFile = join(root, 'tools', 'namespace-keys.json');
const hasInventory = existsSync(indexFile);
const hasKeys = existsSync(keysFile);

if (!hasInventory && !hasKeys) {
  process.stdout.write('no inventory/ and no tools/namespace-keys.json — nothing to validate against; skipping\n');
  process.exit(0);
}

let namespaces;
if (hasInventory) {
  const index = JSON.parse(readFileSync(indexFile, 'utf8'));
  namespaces = Object.entries(index)
    .filter(([ns]) => ns !== '_meta')
    .map(([ns, meta]) => ({ ns, fileName: meta.fileName, keys: null }));
} else {
  const keys = JSON.parse(readFileSync(keysFile, 'utf8'));
  namespaces = Object.entries(keys).map(([ns, list]) => ({ ns, fileName: null, keys: list }));
}

const placeholderPattern = /\{(\w+)\}/gu;
const failures = [];
const warnings = [];
let translatedNamespaces = 0;
let translatedKeys = 0;
let totalKeys = 0;
const missing = [];

for (const { ns, fileName, keys } of namespaces) {
  const targetFile = join(root, 'ar', `${ns}.json`);
  let source = null;
  if (fileName) {
    const sourceFile = join(root, 'inventory', fileName);
    if (!existsSync(sourceFile)) {
      failures.push(`${ns}: inventory file missing (${fileName})`);
      continue;
    }
    source = JSON.parse(readFileSync(sourceFile, 'utf8'));
  }
  const sourceKeys = source ? Object.keys(source) : keys;
  totalKeys += sourceKeys.length;

  if (!existsSync(targetFile)) {
    missing.push(`${ns} (${sourceKeys.length} keys)`);
    continue;
  }
  translatedNamespaces += 1;

  let target;
  try {
    target = JSON.parse(readFileSync(targetFile, 'utf8'));
  } catch (error) {
    failures.push(`${ns}: invalid JSON — ${error.message}`);
    continue;
  }

  const targetKeys = Object.keys(target);
  if (targetKeys.length !== sourceKeys.length) {
    failures.push(`${ns}: key count ${targetKeys.length} != ${sourceKeys.length}`);
  }
  const missingKeys = sourceKeys.filter((key) => !(key in target));
  const extraKeys = targetKeys.filter((key) => (source ? !(key in source) : !sourceKeys.includes(key)));
  if (missingKeys.length > 0) failures.push(`${ns}: missing keys — ${missingKeys.slice(0, 5).join(', ')}${missingKeys.length > 5 ? ` (+${missingKeys.length - 5})` : ''}`);
  if (extraKeys.length > 0) failures.push(`${ns}: unexpected keys — ${extraKeys.slice(0, 5).join(', ')}${extraKeys.length > 5 ? ` (+${extraKeys.length - 5})` : ''}`);

  const orderMismatch = sourceKeys.findIndex((key, index2) => targetKeys[index2] !== key);
  if (missingKeys.length === 0 && extraKeys.length === 0 && orderMismatch !== -1) {
    warnings.push(`${ns}: key order differs from source starting at index ${orderMismatch}`);
  }

  for (const key of sourceKeys) {
    const english = source ? source[key] : undefined;
    const arabic = target[key];
    if (typeof arabic !== 'string') {
      failures.push(`${ns}.${key}: value is not a string`);
      continue;
    }
    // Without the English values we cannot tell a deliberate separator from a
    // forgotten string, so blank values are only rejected in full mode.
    const sourceIsBlank = source === null ? true : (typeof english !== 'string' || english.trim() === '');
    if (arabic.trim() === '' && !sourceIsBlank) {
      failures.push(`${ns}.${key}: empty translation (source is not empty)`);
      continue;
    }
    if (typeof english === 'string') {
      const sourceTokens = [...english.matchAll(placeholderPattern)].map((match) => match[1]).sort();
      const targetTokens = [...arabic.matchAll(placeholderPattern)].map((match) => match[1]).sort();
      if (sourceTokens.join(',') !== targetTokens.join(',')) {
        failures.push(`${ns}.${key}: placeholders [${targetTokens.join(', ')}] != source [${sourceTokens.join(', ')}]`);
      }
      const sourceNewlines = (english.match(/\n/gu) ?? []).length;
      const targetNewlines = (arabic.match(/\n/gu) ?? []).length;
      if (sourceNewlines !== targetNewlines) {
        failures.push(`${ns}.${key}: newline count ${targetNewlines} != source ${sourceNewlines}`);
      }
      const hasArabic = /[\u0600-\u06FF]/u.test(arabic);
      if (!hasArabic) warnings.push(`${ns}.${key}: no Arabic characters — "${arabic.slice(0, 40)}"`);
    }
    translatedKeys += 1;
  }
}

const coverage = totalKeys === 0 ? 0 : (translatedKeys / totalKeys) * 100;
if (!hasInventory) {
  process.stdout.write('mode: keys-only (English values are not shipped; placeholder and newline parity skipped)\n');
}
process.stdout.write(`namespaces translated: ${translatedNamespaces}/${namespaces.length}\n`);
process.stdout.write(`keys translated: ${translatedKeys}/${totalKeys} (${coverage.toFixed(1)}%)\n`);

if (missing.length > 0) {
  process.stdout.write(`\nnot translated yet (${missing.length}):\n- ${missing.join('\n- ')}\n`);
}
if (warnings.length > 0) {
  process.stdout.write(`\nWARNINGS (${warnings.length}):\n- ${warnings.slice(0, 40).join('\n- ')}${warnings.length > 40 ? `\n- … ${warnings.length - 40} more` : ''}\n`);
}
if (failures.length > 0) {
  process.stdout.write(`\nFAILURES (${failures.length}):\n- ${failures.slice(0, 60).join('\n- ')}${failures.length > 60 ? `\n- … ${failures.length - 60} more` : ''}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write('\nall hard checks passed\n');
  if (strict && missing.length > 0) process.exitCode = 1;
}
