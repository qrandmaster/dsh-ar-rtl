/**
 * Post-update selector refresh.
 *
 * Why this exists: DSH ships CSS-module class names as `<prefix>_<suffix>` where
 * the prefix is a build-time hash. It changes on every DSH build, so the RTL
 * overrides that target hashed classes silently stop matching after an update —
 * while everything that targets literal hooks (data attributes, `md-*` classes)
 * keeps working.
 *
 * This tool re-derives the current prefixes from the installed `app.asar` by
 * matching the *rule body* of each originally-fixed rule, then rewrites
 * `src/rtl.css`. Run it, rebuild, redeploy: `update.bat` does all three.
 *
 * Usage:
 *   node tools/refresh-selectors.mjs [--asar <path>] [--dry-run] [--css <path>]
 *
 * Exit codes: 0 = every signature resolved; 1 = at least one rule could not be
 * found, meaning the component changed shape and needs a human look.
 */
import { createReadStream, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const valueOf = (flag, fallback) => {
  const index = args.indexOf(flag);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};

/** Candidate locations of the installed archive, first hit wins. */
const defaultAsarCandidates = [
  process.env.DSH_ASAR,
  join(process.env.LOCALAPPDATA ?? '', 'Programs', 'DeepSeek Harness', 'resources', 'app.asar'),
  join(process.env.ProgramFiles ?? '', 'DeepSeek Harness', 'resources', 'app.asar'),
  join(process.env['ProgramFiles(x86)'] ?? '', 'DeepSeek Harness', 'resources', 'app.asar'),
  join(process.env.ProgramW6432 ?? '', 'DeepSeek Harness', 'resources', 'app.asar'),
].filter(Boolean);

const asarPath = valueOf('--asar', defaultAsarCandidates.find((candidate) => existsSync(candidate)));
const cssPath = resolve(valueOf('--css', join(root, 'src', 'rtl.css')));

if (!asarPath || !existsSync(asarPath)) {
  process.stderr.write(`Could not find app.asar. Pass --asar <path>.\nTried:\n- ${defaultAsarCandidates.join('\n- ')}\n`);
  process.exit(1);
}

/**
 * One entry per component whose hashed prefix appears in `src/rtl.css`.
 * `signature` must capture the CURRENT prefix in group 1 and match the body of
 * the rule that motivated the override, never the prefix itself.
 */
const tokens = [
  { token: 'RlGAzG', what: 'composer action row', signature: /\.([A-Za-z0-9_-]{4,12})_trailing\{[^}]*margin-left:auto\}/u },
  { token: 'wq12jW', what: 'model picker', source: 'model list', signature: /\.([A-Za-z0-9_-]{4,12})_cellValue\{[^}]*text-align:right[^}]*\}/u },
  { token: 'dlU_AG', what: 'permission picker', signature: /\.([A-Za-z0-9_-]{4,12})_trigger\{[^}]*max-width:220px/u },
  { token: '_8RVnMG', what: 'account section', signature: /\.([A-Za-z0-9_-]{4,12})_accountInfo\{[^}]*display:inline-flex\}/u },
  { token: 'fO69Vq', what: 'plugin manager page', signature: /\.([A-Za-z0-9_-]{4,12})_crumbIcon\{[^}]*rotate\(90deg\)\}/u },
  { token: 'KZf9OG', what: 'agent preset cards', signature: /\.([A-Za-z0-9_-]{4,12})_cardHelp\{[^}]*margin-right:auto/u },
  { token: '_2H3hWW', what: 'sidebar root', signature: /\.([A-Za-z0-9_-]{4,12})_panelRow\{[^}]*text-align:left[^}]*\}/u },
  { token: 'wCInkW', what: 'settings navigation', signature: /\.([A-Za-z0-9_-]{4,12})_navCell\{[^}]*text-align:left[^}]*\}/u },
  { token: '_3nPmjq', what: 'models section', signature: /\.([A-Za-z0-9_-]{4,12})_rowActions\{[^}]*margin-left:auto[^}]*\}/u },
  { token: '_3Y3Nma', what: 'shortcuts reference', signature: /\.([A-Za-z0-9_-]{4,12})_settingText\{[^}]*padding-right:48px[^}]*\}/u },
  { token: 'Dc7zOa', what: 'conversation root', signature: /\.([A-Za-z0-9_-]{4,12})_headerUtilities\{[^}]*margin-left:20px[^}]*\}/u },
  { token: '1ik0f', what: 'switch primitive', signature: /_switch_([A-Za-z0-9]+)_\d+\[aria-checked=true\]\s*\._thumb_\1_\d+\{transform:translate\(16px\)\}/u },
  { token: '4ub78', what: 'menu primitive', signature: /\._item_([A-Za-z0-9]+)_\d+\{[^}]*text-align:left[^}]*\}/u },
];

/**
 * Settings text blocks share one rule body across several modules, so they are
 * handled as a group: every `prefix_suffix` carrying `padding-right:48px` is
 * collected and the `:is(...)` list in the stylesheet is rewritten to match
 * reality. `_settingText` (the shortcuts row) belongs to the same defect and is
 * collected too, so a rewrite can never drop it from the list.
 */
const groupSignatures = [
  { suffix: '_rowText', pattern: /\.([A-Za-z0-9_-]{4,12})_rowText\{[^}]*padding-right:48px/gu },
  { suffix: '_settingText', pattern: /\.([A-Za-z0-9_-]{4,12})_settingText\{[^}]*padding-right:48px/gu },
];

const found = new Map();
const groupMatches = new Set();
const missing = [];

const stream = createReadStream(asarPath, { encoding: 'utf8' });
const lines = createInterface({ input: stream, crlfDelay: Infinity });
let scanned = 0;

for await (const line of lines) {
  scanned += 1;
  if (!line.includes('{')) continue;
  for (const token of tokens) {
    if (found.has(token.token)) continue;
    const match = token.signature.exec(line);
    if (match) found.set(token.token, match[1]);
  }
  for (const { suffix, pattern } of groupSignatures) {
    if (!line.includes(suffix)) continue;
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(line)) !== null) groupMatches.add(`${match[1]}${suffix}`);
  }
  if (found.size === tokens.length && groupMatches.size >= 6) break;
}

let css = readFileSync(cssPath, 'utf8');
const changes = [];

/* Guard against a signature that matches a sibling component whose rule body is
 * identical (two pickers can share `padding:0 4px 0 8px`, for instance). When a
 * captured prefix is already claimed by a different token, the match is
 * ambiguous and must not rewrite anything. */
const claimed = new Map();
for (const [token, prefix] of found) {
  if (!claimed.has(prefix)) claimed.set(prefix, []);
  claimed.get(prefix).push(token);
}
const ambiguous = new Map();
for (const [prefix, list] of claimed) {
  if (list.length < 2) continue;
  for (const token of list) if (token !== prefix) ambiguous.set(token, prefix);
}

for (const token of tokens) {
  const current = found.get(token.token);
  if (!current) {
    missing.push(`${token.token} (${token.what})`);
    continue;
  }
  if (ambiguous.has(token.token)) {
    missing.push(`${token.token} (${token.what}): signature also matches "${ambiguous.get(token.token)}" — needs a sharper rule body`);
    continue;
  }
  if (current === token.token) continue;
  const before = css;
  css = css.split(token.token).join(current);
  if (css !== before) changes.push(`${token.token} -> ${current}   (${token.what})`);
}

if (groupMatches.size > 0) {
  const list = [...groupMatches].sort().map((entry) => `.${entry}`).join(', ');
  const groupPattern = /:is\((?:[^)]*(?:_rowText|_settingText)[^)]*)\)/u;
  if (groupPattern.test(css)) {
    const before = css;
    css = css.replace(groupPattern, `:is(${list})`);
    if (css !== before) changes.push(`settings text-block group -> ${groupMatches.size} members`);
  } else {
    missing.push('settings text-block group (no :is(..._rowText...) list in the stylesheet)');
  }
}

process.stdout.write(`scanned ${scanned.toLocaleString('en-US')} lines of ${asarPath}\n`);
process.stdout.write(`resolved ${found.size}/${tokens.length} component prefixes, ${groupMatches.size} settings rows\n`);
if (changes.length > 0) {
  process.stdout.write(`\nselector changes:\n- ${changes.join('\n- ')}\n`);
} else {
  process.stdout.write('\nno selector changes needed — the stylesheet already matches this build\n');
}
if (missing.length > 0) {
  process.stdout.write(`\nCOULD NOT RESOLVE (component changed shape):\n- ${missing.join('\n- ')}\n`);
}

if (dryRun) {
  process.stdout.write('\ndry run: the stylesheet was not written\n');
} else if (changes.length > 0) {
  writeFileSync(cssPath, css, 'utf8');
  process.stdout.write(`\nwrote ${cssPath}\n`);
}

process.exit(missing.length > 0 ? 1 : 0);
