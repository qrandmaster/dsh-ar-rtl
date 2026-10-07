/**
 * Self-test for the generated client bundle.
 *
 * The bundle is not a module: it calls `window.__ModuleLoader__.load({ id, factory })`.
 * This harness reproduces that contract, stubs the DOM and the `locale` service,
 * then asserts the observable behaviour of `apply(ctx)`:
 *
 *   1. the factory id equals package.json.name
 *   2. a stylesheet tagged data-plugin / data-plugin-css is injected once
 *   3. the `ar` language is registered with an `en` fallback
 *   4. Arabic dictionaries are registered for the expected namespaces
 *   5. documentElement.dir follows the active locale and switches back
 *   6. effect cleanups remove the stylesheet
 *
 * Usage: node tools/selftest.mjs
 */
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const source = readFileSync(join(root, 'client.js'), 'utf8');

const failures = [];
const checks = [];
function check(label, condition, detail = '') {
  checks.push({ label, ok: Boolean(condition), detail });
  if (!condition) failures.push(`${label}${detail ? ` — ${detail}` : ''}`);
}

/* --- fake DOM ------------------------------------------------------------ */
const styles = [];
function styleTagMatches(selector, el) {
  const match = /data-plugin-css=\s*"((?:[^"\\]|\\.)*)"/u.exec(selector);
  if (!match) return false;
  const wanted = JSON.parse(`"${match[1]}"`);
  return el.dataset.pluginCss === wanted;
}
const documentStub = {
  documentElement: { dir: '', lang: 'en' },
  head: {
    appendChild(el) {
      styles.push(el);
      return el;
    },
  },
  createElement(tagName) {
    return {
      tagName,
      dataset: {},
      textContent: '',
      remove() {
        const index = styles.indexOf(this);
        if (index >= 0) styles.splice(index, 1);
      },
    };
  },
  querySelector(selector) {
    return styles.find((el) => styleTagMatches(selector, el)) ?? null;
  },
};

/* --- fake window / module loader ---------------------------------------- */
const loaded = [];
const windowStub = { __ModuleLoader__: { load: (entry) => loaded.push(entry) } };

const previousDocument = globalThis.document;
globalThis.document = documentStub;
new Function('window', source)(windowStub);

/* --- assertions on registration ----------------------------------------- */
check('exactly one factory registered', loaded.length === 1, `got ${loaded.length}`);
const entry = loaded[0];
check('factory id equals package name', entry?.id === pkg.name, `id=${entry?.id} name=${pkg.name}`);

const moduleExports = entry.factory(() => {
  throw new Error('the plugin must not require any module');
});
check('module exposes apply', typeof moduleExports.apply === 'function');
check('module injects the locale service', Array.isArray(moduleExports.inject) && moduleExports.inject.includes('locale'));

/* --- fake locale service + ctx ------------------------------------------ */
const effects = [];
const languages = [];
const dictionaries = new Map();
let snapshot = { active: 'ar', locales: [{ id: 'ar', label: 'العربية' }], revision: 1 };
const listeners = new Set();

const locale = {
  addLanguage(input) {
    languages.push(input);
    return () => {
      const index = languages.indexOf(input);
      if (index >= 0) languages.splice(index, 1);
    };
  },
  register(namespace, id, dict) {
    const key = `${namespace}|${id}`;
    if (dictionaries.has(key)) throw new Error(`locale namespace "${namespace}" already has locale "${id}"`);
    dictionaries.set(key, dict);
    return () => dictionaries.delete(key);
  },
  getSnapshot: () => snapshot,
  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};
const ctx = {
  effect(fn, label) {
    const cleanup = fn();
    effects.push({ label, cleanup });
    return () => cleanup?.();
  },
  locale,
};

documentStub.documentElement.dir = '';
moduleExports.apply(ctx);

check('registers the ar language', languages.length === 1 && languages[0].id === 'ar', JSON.stringify(languages));
check('ar falls back to en', languages[0]?.fallback === 'en');
check('ar language has a label', typeof languages[0]?.label === 'string' && languages[0].label.length > 0);
check('injects exactly one stylesheet', styles.length === 1, `got ${styles.length}`);
check('stylesheet is tagged for the plugin', styles[0]?.dataset.plugin === pkg.name);
check('stylesheet carries CSS text', typeof styles[0]?.textContent === 'string' && styles[0].textContent.includes('html[dir="rtl"]'));
check('active ar sets dir=rtl', documentStub.documentElement.dir === 'rtl', `dir=${documentStub.documentElement.dir}`);
check('subscribed to locale changes', listeners.size === 1, `listeners=${listeners.size}`);

const dictionaryNamespaces = [...dictionaries.keys()].map((key) => key.split('|')[0]);
check('registers dictionaries for the ar locale only', [...dictionaries.keys()].every((key) => key.endsWith('|ar')));
check('every dictionary is a flat string map', [...dictionaries.values()].every((dict) =>
  dict && typeof dict === 'object' && Object.values(dict).every((value) => typeof value === 'string')));

/* --- switching language back to English --------------------------------- */
snapshot = { active: 'en', locales: [], revision: 2 };
for (const listener of listeners) listener(snapshot);
check('switching to en sets dir=ltr', documentStub.documentElement.dir === 'ltr', `dir=${documentStub.documentElement.dir}`);

snapshot = { active: 'ar', locales: [], revision: 3 };
for (const listener of listeners) listener(snapshot);
check('switching back to ar sets dir=rtl', documentStub.documentElement.dir === 'rtl');

/* --- teardown ----------------------------------------------------------- */
for (const { cleanup } of effects) cleanup?.();
check('cleanup removes the stylesheet', styles.length === 0, `styles=${styles.length}`);
check('cleanup unregisters the language', languages.length === 0, `languages=${languages.length}`);
check('cleanup unregisters dictionaries', dictionaries.size === 0, `dicts=${dictionaries.size}`);
check('cleanup unsubscribes', listeners.size === 0, `listeners=${listeners.size}`);

/* --- report ------------------------------------------------------------- */
if (previousDocument === undefined) delete globalThis.document;
else globalThis.document = previousDocument;

for (const { label, ok, detail } of checks) {
  process.stdout.write(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok || !detail ? '' : `  (${detail})`}\n`);
}
const dictKeys = [...dictionaries.keys()];
process.stdout.write(`\n${checks.length - failures.length}/${checks.length} checks passed; dictionary namespaces at build time: ${dictionaryNamespaces.length}\n`);
if (failures.length > 0) {
  process.stdout.write(`\nFAILURES:\n- ${failures.join('\n- ')}\n`);
  process.exitCode = 1;
}
