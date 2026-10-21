/**
 * Post-update dictionary refresh.
 *
 * Why this exists: every DSH build re-emits the client locale namespaces inside
 * the shipped bundles. Key sets grow, shrink, and occasionally change their
 * placeholders, so the Arabic dictionaries drift out of date silently -- a new
 * English key simply falls back to English in the UI.
 *
 * This tool re-derives the current English dictionaries straight from the
 * installed app.asar. It anchors on the shipped locale.register(...) calls (not
 * on line numbers, which move with every build), resolves the dictionary
 * constants those calls reference, and compares the result with:
 *
 *   inventory/<ns>.en.json   the previous snapshot of the English dictionaries
 *   ar/<ns>.json             the Arabic dictionaries shipped by this plugin
 *
 * It reports new namespaces, added and removed keys, and placeholder
 * mismatches. With --write it refreshes the local inventory snapshot; the
 * tracked key-name-only file is regenerated separately:
 *
 *   node --max-old-space-size=4096 tools/extract-current-en.mjs --write
 *   node tools/export-keys.mjs
 *
 * Usage:
 *   node --max-old-space-size=4096 tools/extract-current-en.mjs [--asar <path>] [--write] [--report <path>]
 *
 * Exit codes: 0 = the Arabic dictionaries are current; 1 = something needs a
 * human (untranslated keys, placeholder drift, or a namespace that could not be
 * read). Reasons are printed.
 */
import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');

const args = process.argv.slice(2);
const valueOf = (flagName, fallback) => {
  const index = args.indexOf(flagName);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};
const write = args.includes('--write');

const defaultAsarCandidates = [
  process.env.DSH_ASAR,
  join(process.env.LOCALAPPDATA ?? '', 'Programs', 'DeepSeek Harness', 'resources', 'app.asar'),
  join(process.env.ProgramFiles ?? '', 'DeepSeek Harness', 'resources', 'app.asar'),
  join(process.env['ProgramFiles(x86)'] ?? '', 'DeepSeek Harness', 'resources', 'app.asar'),
  join(process.env.ProgramW6432 ?? '', 'DeepSeek Harness', 'resources', 'app.asar'),
].filter(Boolean);

const asarPath = valueOf('--asar', defaultAsarCandidates.find((candidate) => existsSync(candidate)));
if (!asarPath || !existsSync(asarPath)) {
  process.stderr.write('Could not find app.asar. Pass --asar <path>.\nTried:\n- ' + defaultAsarCandidates.join('\n- ') + '\n');
  process.exit(2);
}
const arDir = join(root, 'ar');
const invDir = join(root, 'inventory');
const reportPath = resolve(valueOf('--report', join(invDir, 'refresh-report.json')));

const TEXT = readFileSync(asarPath, 'utf8');

/* ------------------------------------------------------------------ lexing -- */
function scanBalanced(text, startIdx, openCh, closeCh) {
  let depth = 0;
  let inStr = null;
  let esc = false;
  let inLine = false;
  let inBlock = false;
  for (let i = startIdx; i < text.length; i++) {
    const c = text[i];
    const n = text[i + 1];
    if (inLine) { if (c === '\n') inLine = false; continue; }
    if (inBlock) { if (c === '*' && n === '/') { inBlock = false; i++; } continue; }
    if (esc) { esc = false; continue; }
    if (inStr) {
      if (c === '\\') { esc = true; continue; }
      if (c === inStr) inStr = null;
      continue;
    }
    if (c === '/' && n === '/') { inLine = true; continue; }
    if (c === '/' && n === '*') { inBlock = true; i++; continue; }
    if (c === '"' || c === "'" || c === '\u0060') { inStr = c; continue; }
    if (c === openCh) depth++;
    else if (c === closeCh) { depth--; if (depth === 0) return i; }
  }
  return -1;
}
function readStringLit(text, qIdx) {
  const quote = text[qIdx];
  let esc = false;
  for (let i = qIdx + 1; i < text.length; i++) {
    const c = text[i];
    if (esc) { esc = false; continue; }
    if (c === '\\') { esc = true; continue; }
    if (c === quote) return text.slice(qIdx, i + 1);
  }
  return null;
}
function stripKeepStrings(src) {
  let out = '';
  let inStr = null;
  let esc = false;
  let inLine = false;
  let inBlock = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    const n = src[i + 1];
    if (inLine) { if (c === '\n') { inLine = false; out += c; } continue; }
    if (inBlock) { if (c === '*' && n === '/') { inBlock = false; i++; out += ' '; continue; } continue; }
    if (esc) { out += c; esc = false; continue; }
    if (inStr) { out += c; if (c === '\\') { esc = true; continue; } if (c === inStr) inStr = null; continue; }
    if (c === '/' && n === '/') { inLine = true; continue; }
    if (c === '/' && n === '*') { inBlock = true; i++; continue; }
    out += c;
  }
  return out;
}
function stripStringsAndComments(src) {
  let out = '';
  let inStr = null;
  let esc = false;
  let inLine = false;
  let inBlock = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    const n = src[i + 1];
    if (inLine) { if (c === '\n') { inLine = false; out += ' '; } continue; }
    if (inBlock) { if (c === '*' && n === '/') { inBlock = false; i++; } continue; }
    if (esc) { out += ' '; esc = false; continue; }
    if (inStr) { if (c === '\\') { esc = true; continue; } if (c === inStr) inStr = null; continue; }
    if (c === '/' && n === '/') { inLine = true; continue; }
    if (c === '/' && n === '*') { inBlock = true; i++; continue; }
    if (c === '"' || c === "'" || c === '\u0060') { inStr = c; out += ' '; continue; }
    out += c;
  }
  return out;
}
const KEYWORDS = new Set('const let var function return if else for while do break continue new typeof instanceof in of class extends super this null true false undefined void delete yield async await static get set case default switch try catch finally throw'.split(' '));
function freeIds(src) {
  const bare = stripStringsAndComments(src);
  const ids = new Set();
  const re = /[A-Za-z_$][\w$]*/g;
  let m;
  while ((m = re.exec(bare)) !== null) {
    if (KEYWORDS.has(m[0])) continue;
    if (bare[m.index - 1] === '.' && bare.slice(Math.max(0, m.index - 3), m.index) !== '...') continue;
    let k = m.index + m[0].length;
    while (k < bare.length && /\s/.test(bare[k])) k++;
    if (bare[k] === ':') continue;
    ids.add(m[0]);
  }
  return ids;
}

/* ------------------------------------------------------- constant resolution -- */
function findNearestConst(name, beforePos, kind) {
  let best = null;
  let from = 0;
  const needle = 'const ' + name;
  for (;;) {
    const i = TEXT.indexOf(needle, from);
    if (i < 0 || i >= beforePos) break;
    from = i + 1;
    const afterName = i + needle.length;
    if (/[A-Za-z0-9_$]/.test(TEXT[afterName])) continue;
    let k = afterName;
    while (k < TEXT.length && /\s/.test(TEXT[k])) k++;
    if (TEXT[k] !== '=') continue;
    let v = k + 1;
    while (v < TEXT.length && /\s/.test(TEXT[v])) v++;
    const c = TEXT[v];
    if (kind === 'object') {
      if (c !== '{') continue;
      const end = scanBalanced(TEXT, v, '{', '}');
      if (end > 0) best = { kind: 'object', body: TEXT.slice(v, end + 1), pos: v };
    } else if (kind === 'string') {
      if (c !== '"' && c !== "'") continue;
      const lit = readStringLit(TEXT, v);
      if (lit) { try { best = { kind: 'string', value: JSON.parse(lit), pos: v }; } catch { /* not a plain literal */ } }
    } else if (c === '{') {
      const end = scanBalanced(TEXT, v, '{', '}');
      if (end > 0) best = { kind: 'object', body: TEXT.slice(v, end + 1), pos: v };
    } else if (c === '"' || c === "'") {
      const lit = readStringLit(TEXT, v);
      if (lit) { try { best = { kind: 'string', value: JSON.parse(lit), pos: v }; } catch { /* not a plain literal */ } }
    }
  }
  return best;
}

/* ------------------------------------------------------------- dictionary IO -- */
function evalObject(objSrc, anchor) {
  const defs = [];
  const done = new Set();
  const queue = [...freeIds(objSrc)];
  let guard = 0;
  while (queue.length && guard++ < 300) {
    const id = queue.shift();
    if (done.has(id)) continue;
    done.add(id);
    const def = findNearestConst(id, anchor, null);
    if (!def) continue;
    defs.push({ name: id, body: def.kind === 'object' ? def.body : JSON.stringify(def.value) });
    for (const dep of freeIds(def.body)) if (!done.has(dep)) queue.push(dep);
  }
  const code = defs.map((d) => 'const ' + d.name + ' = ' + d.body + ';').join('\n') + '\nreturn (' + objSrc + ');';
  return JSON.parse(JSON.stringify(new Function(code)()));
}
function parseDictText(objSrc, anchor) {
  let src = stripKeepStrings(objSrc);
  src = src.replace(/,(\s*[}\]])/g, '\$1');
  for (let it = 0; it < 6 && /\.\.\.[A-Za-z_$][\w$]*/.test(src); it++) {
    src = src.replace(/\.\.\.([A-Za-z_$][\w$]*)/g, (whole, id) => {
      const def = findNearestConst(id, anchor, 'object');
      return def ? def.body.slice(1, -1) : whole;
    });
    src = stripKeepStrings(src).replace(/,(\s*[}\]])/g, '\$1');
  }
  src = src.replace(/([{,]\s*)([A-Za-z_$][\w$]*)(\s*:)/g, '\$1"\$2"\$3');
  src = src.replace(/:\s*([A-Za-z_$][\w$]*)\s*(?=[,}\n\r])/g, (whole, ident) => {
    if (['true', 'false', 'null', 'undefined'].includes(ident)) return whole;
    const def = findNearestConst(ident, anchor, 'string');
    return def ? ': ' + JSON.stringify(def.value) : whole;
  });
  return JSON.parse(src);
}

const dicts = {};
const failures = [];

function splitArgs(src) {
  const parts = [];
  let depth = 0;
  let inStr = null;
  let esc = false;
  let cur = '';
  for (const c of src) {
    if (esc) { cur += c; esc = false; continue; }
    if (inStr) { cur += c; if (c === '\\') { esc = true; continue; } if (c === inStr) inStr = null; continue; }
    if (c === '"' || c === "'" || c === '\u0060') { inStr = c; cur += c; continue; }
    if (c === '(' || c === '{' || c === '[') depth++;
    if (c === ')' || c === '}' || c === ']') depth--;
    if (c === ',' && depth === 0) { parts.push(cur); cur = ''; continue; }
    cur += c;
  }
  parts.push(cur);
  return parts;
}

function processCall(callAbs, argsSrc) {
  const parts = splitArgs(argsSrc).map((s) => s.trim());
  const litOf = (t) => (t[0] === '"' || t[0] === "'") ? t.slice(1, t.lastIndexOf(t[0])) : null;
  const nsDef = litOf(parts[0]) !== null ? null : findNearestConst(parts[0], callAbs, 'string');
  const ns = litOf(parts[0]) ?? (nsDef ? nsDef.value : null);
  if (!ns || ns === 'ns') return;
  let enSrc = null;
  let enPos = callAbs;
  if (parts.length >= 3) {
    const locDef = litOf(parts[1]) !== null ? null : findNearestConst(parts[1], callAbs, 'string');
    const loc = litOf(parts[1]) ?? (locDef ? locDef.value : null);
    if (loc !== 'en') {
      if (loc === null) {
        const def = findNearestConst('en', callAbs, 'object');
        if (def) {
          let parsed = null;
          try { parsed = parseDictText(def.body, def.pos); } catch { try { parsed = evalObject(def.body, def.pos); } catch { parsed = null; } }
          if (parsed && !dicts[ns]) dicts[ns] = parsed;
        }
      }
      return;
    }
    if (parts[2][0] === '{') enSrc = parts[2];
    else { const def = findNearestConst(parts[2], callAbs, 'object'); if (def) { enSrc = def.body; enPos = def.pos; } }
    if (!enSrc) { failures.push('dictionary not found for ' + ns); return; }
  } else if (parts.length === 2 && parts[1][0] === '{') {
    const objSrc = parts[1];
    const named = objSrc.match(/[{,]\s*en\s*:\s*([A-Za-z_$][\w$]*)/);
    if (named) {
      const def = findNearestConst(named[1], callAbs, 'object');
      if (def) { enSrc = def.body; enPos = def.pos; }
      else { failures.push('English constant ' + named[1] + ' not found for ' + ns); return; }
    } else if (/[{,]\s*en\s*[,}]/.test(objSrc)) {
      const def = findNearestConst('en', callAbs, 'object');
      if (def) { enSrc = def.body; enPos = def.pos; }
      else { failures.push('English dictionary not found for ' + ns); return; }
    } else {
      const inline = objSrc.match(/[{,]\s*en\s*:\s*\{/);
      if (!inline) { failures.push('no English entry in the registration for ' + ns); return; }
      const start = objSrc.indexOf('{', inline.index + inline[0].length - 1);
      const end = scanBalanced(objSrc, start, '{', '}');
      enSrc = objSrc.slice(start, end + 1);
    }
  } else {
    return;
  }
  if (dicts[ns]) return;
  try {
    dicts[ns] = parseDictText(enSrc, enPos);
  } catch {
    try { dicts[ns] = evalObject(enSrc, enPos); }
    catch (error) { failures.push(ns + ': ' + String(error).slice(0, 90)); }
  }
}

/* --------------------------------------------------------------- extraction -- */
const regionRe = /\/\/#region lib\/types\/client\/locales\.js/g;
const marks = [];
let mark;
while ((mark = regionRe.exec(TEXT)) !== null) marks.push(mark.index);

for (let i = 0; i < marks.length; i++) {
  const start = marks[i];
  const end = i + 1 < marks.length ? marks[i + 1] : Math.min(start + 900000, TEXT.length);
  const region = TEXT.slice(start, Math.min(end, start + 3000000));
  const re = /locale\.register\s*\(/g;
  let m;
  while ((m = re.exec(region)) !== null) {
    const openIdx = m.index + m[0].length - 1;
    const closeIdx = scanBalanced(region, openIdx, '(', ')');
    if (closeIdx < 0) continue;
    processCall(start + m.index, region.slice(openIdx + 1, closeIdx));
  }
}
const reAll = /locale\.register\s*\(/g;
let mAll;
while ((mAll = reAll.exec(TEXT)) !== null) {
  const openIdx = mAll.index + mAll[0].length - 1;
  const closeIdx = scanBalanced(TEXT, openIdx, '(', ')');
  if (closeIdx < 0) continue;
  processCall(mAll.index, TEXT.slice(openIdx + 1, closeIdx));
}

/* ---------------------------------------------------------------- comparing -- */
const namespaces = Object.keys(dicts).sort();
const arDicts = {};
for (const file of existsSync(arDir) ? readdirSync(arDir) : []) {
  if (!file.endsWith('.json')) continue;
  arDicts[file.replace(/\.json$/u, '')] = JSON.parse(readFileSync(join(arDir, file), 'utf8'));
}
const previous = {};
for (const file of existsSync(invDir) ? readdirSync(invDir) : []) {
  if (!file.endsWith('.en.json')) continue;
  previous[file.replace(/\.en\.json$/u, '')] = JSON.parse(readFileSync(join(invDir, file), 'utf8'));
}

const placeholders = (value) => [...String(value).matchAll(/\{([A-Za-z0-9_]+)\}/g)].map((x) => x[1]).sort().join(',');
const report = { asar: asarPath, namespaces: namespaces.length, keys: 0, newNamespaces: [], missingFromBuild: [], added: {}, removed: {}, placeholderDrift: [], suspicious: [], failures };
for (const ns of namespaces) report.keys += Object.keys(dicts[ns]).length;

for (const ns of namespaces) {
  const enKeys = Object.keys(dicts[ns]);
  if (!arDicts[ns]) { report.newNamespaces.push(ns + ' (' + enKeys.length + ' keys)'); continue; }
  const added = enKeys.filter((key) => !(key in arDicts[ns]));
  const removed = Object.keys(arDicts[ns]).filter((key) => !enKeys.includes(key));
  if (added.length) report.added[ns] = added;
  if (removed.length) report.removed[ns] = removed;
  for (const key of enKeys) {
    if (!(key in arDicts[ns])) continue;
    if (placeholders(dicts[ns][key]) !== placeholders(arDicts[ns][key])) {
      report.placeholderDrift.push(ns + '.' + key + ': ar [' + placeholders(arDicts[ns][key]) + '] != en [' + placeholders(dicts[ns][key]) + ']');
    }
  }
  if (previous[ns] && enKeys.length < Object.keys(previous[ns]).length * 0.6) {
    report.suspicious.push(ns + ' (' + enKeys.length + ' now vs ' + Object.keys(previous[ns]).length + ' before)');
  }
}
for (const ns of Object.keys(arDicts)) if (!dicts[ns]) report.missingFromBuild.push(ns);

/* ----------------------------------------------------------------- printing -- */
const note = (label, list) => {
  if (list.length) process.stdout.write('\n' + label + ':\n- ' + list.join('\n- ') + '\n');
};
process.stdout.write('scanned ' + asarPath + '\n');
process.stdout.write('namespaces: ' + report.namespaces + ', keys: ' + report.keys + '\n');
process.stdout.write('unreadable: ' + failures.length + '\n');
note('NEW NAMESPACES (no Arabic dictionary yet)', report.newNamespaces);
note('KEYS ADDED (Arabic falls back to English)', Object.entries(report.added).map(([ns, keys]) => ns + ': ' + keys.length));
note('KEYS REMOVED (dead translations in ar/', Object.entries(report.removed).map(([ns, keys]) => ns + ': ' + keys.length));
note('PLACEHOLDER DRIFT (translation must be corrected)', report.placeholderDrift);
note('SUSPICIOUS (far smaller than the previous snapshot)', report.suspicious);
note('IN THE ARABIC SET BUT NOT IN THIS BUILD', report.missingFromBuild);
note('COULD NOT RESOLVE (component changed shape)', failures);

const needsWork = report.newNamespaces.length + report.placeholderDrift.length + failures.length + report.missingFromBuild.length > 0
  || Object.keys(report.added).length > 0;

if (write) {
  mkdirSync(invDir, { recursive: true });
  for (const ns of namespaces) writeFileSync(join(invDir, ns + '.en.json'), JSON.stringify(dicts[ns], null, 2) + '\n', 'utf8');
  const indexPath = join(invDir, '_index.json');
  if (existsSync(indexPath)) {
    const index = JSON.parse(readFileSync(indexPath, 'utf8'));
    for (const ns of namespaces) {
      if (!index[ns]) index[ns] = { ownerPackage: 'unknown', ownerPackageFull: 'unknown', ownerFile: 'unknown', lineStart: 0, lineEnd: 0, keyCount: 0, fileName: ns + '.en.json' };
      index[ns].keyCount = Object.keys(dicts[ns]).length;
    }
    index._meta = { ...(index._meta ?? {}), namespaceCount: namespaces.length, totalKeys: report.keys, refreshedAt: new Date().toISOString() };
    writeFileSync(indexPath, JSON.stringify(index, null, 2) + '\n', 'utf8');
  }
  writeFileSync(reportPath, JSON.stringify(report, null, 1) + '\n', 'utf8');
  process.stdout.write('\ninventory refreshed; report written to ' + reportPath + '\n');
  process.stdout.write('next: node tools/export-keys.mjs && node tools/validate-ar.mjs && node tools/build-client.mjs\n');
} else if (needsWork) {
  process.stdout.write('\nrun with --write to refresh the inventory snapshot and the report file\n');
}

process.exit(needsWork ? 1 : 0);
