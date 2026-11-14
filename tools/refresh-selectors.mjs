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
  { token: 'cJsG2q', what: 'user message row', signature: /\.([A-Za-z0-9_-]{4,12})_userRow\{[^}]*align-items:flex-end/u },
  { token: '-ja1rG', what: 'user message row (variant)', signature: /\.([A-Za-z0-9_-]{4,12})_bubble\{overflow-wrap:anywhere/u },
  { token: 'ZG377q', what: 'question card', signature: /\.([A-Za-z0-9_-]{4,12})_questionList\{[^}]*padding-left:20px/u },
  { token: 'wnLwla', what: 'question options', signature: /\.([A-Za-z0-9_-]{4,12})_option\{[^}]*text-align:left[^}]*padding:8px 12px 8px 8px/u },
  { token: 'Nksazq', what: 'plan review actions', signature: /\.([A-Za-z0-9_-]{4,12})_previewActions\{[^}]*margin-left:auto/u },
  { token: '_7qxJPq', what: 'stepper arrows', signature: /\.([A-Za-z0-9_-]{4,12})_arrows\{[^}]*position:absolute;right:8px/u },
  { token: '15hvo', what: 'terminal code block', signature: /\._block_([A-Za-z0-9_-]{4,12})_\d+\{[^{}]*--dsl-terminal-radius/u },
  { token: '74wpx', what: 'search results block', signature: /\._block_([A-Za-z0-9_-]{4,12})_\d+\{[^{}]*--dsl-search-radius/u },
  { token: '1cyuy', what: 'diff block', signature: /\._del_([A-Za-z0-9_-]{4,12})_\d+\{[^{}]*box-shadow:inset 3px 0 0/u },
  { token: 'cf6qc', what: 'read-mode line gutter', signature: /\._gutter_([A-Za-z0-9_-]{4,12})_\d+\{[^{}]*--dsl-read-gutter/u },
  { token: '16cyo', what: 'status indicator', signature: /\._indicator_([A-Za-z0-9_-]{4,12})_\d+\{[^{}]*grid-template-columns:14px max-content/u },
  { token: 'at713', what: 'quote chip', signature: /\._quote_([A-Za-z0-9_-]{4,12})_\d+\{[^{}]*max-width:min\(80%,300px\)/u },
  { token: '3oazc', what: 'dockkit menu', signature: /\._menuItem_([A-Za-z0-9_-]{4,12})_\d+\{[^{}]*text-align:left/u },
  { token: 'Luqt-a', what: 'automation catalog menu', signature: /\.([A-Za-z0-9_-]{4,12})_menu\{[^{}]*--dsh-schedule-catalog-wide-below/u },
  { token: 'Z17U9a', what: 'automation picker panel', signature: /\.([A-Za-z0-9_-]{4,12})_panel\{[^{}]*--dsh-schedule-picker-above/u },
  { token: 'js5r2G', what: 'automation task portal', signature: /\.([A-Za-z0-9_-]{4,12})_portal\{[^{}]*--dsh-schedule-task-above/u },
  { token: 'Zf6DNq', what: 'approval warning popover', signature: /\.([A-Za-z0-9_-]{4,12})_warningPopover\{[^{}]*--dsh-warning-below/u },
  { token: '-vOKNW', what: 'session inspector type filter', signature: /\.([A-Za-z0-9_-]{4,12})_typeFilterPanel\{[^{}]*--dsh-types-window/u },
  { token: '1ik0f', what: 'switch primitive', signature: /_switch_([A-Za-z0-9]+)_\d+\[aria-checked=true\]\s*\._thumb_\1_\d+\{transform:translate\(16px\)\}/u },
  { token: '1p5el', what: 'menu primitive', signature: /\._item_([A-Za-z0-9]+)_\d+\{[^}]*text-align:left[^}]*\}/u },
  { token: 'd99neW', what: 'plugin market', signature: /\.([A-Za-z0-9_-]{4,12})_marketButton\{[^}]*margin-left:-8px[^}]*\}/u },
  { token: 'jmg6Sq', what: 'deliverables summary', signature: /\.([A-Za-z0-9_-]{4,12})_summary\{[^}]*margin-left:8px[^}]*\}/u },
  { token: 'LFNH1G', what: 'deliverables tools row', signature: /\.([A-Za-z0-9_-]{4,12})_tools\{[^}]*margin-left:auto[^}]*\}/u },
  { token: 'kuvljq', what: 'changes panel', signature: /\.([A-Za-z0-9_-]{4,12})_toggle\{[^}]*padding:10px 18px 10px 14px[^}]*\}/u },
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
