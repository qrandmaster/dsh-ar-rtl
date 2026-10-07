/**
 * Build-time generator for the served client bundle.
 *
 * The Host serves `exports["./client"]` (see package.json) as-is, so the artifact
 * must be a single plain-ESM file that registers a lazy factory through
 * `window.__ModuleLoader__.load({ id, factory })`. This script assembles that file
 * from the authored sources:
 *
 *   src/rtl.css          -> the stylesheet text the plugin injects
 *   ar/<namespace>.json  -> Arabic dictionaries, one file per locale namespace
 *
 * The namespace list comes from `inventory/_index.json` when that research
 * artifact is present, and otherwise from the `ar/*.json` file names — which is
 * what a fresh clone of the published repository looks like.
 *
 * Usage: node tools/build-client.mjs
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');

const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const PLUGIN_ID = pkg.name;

const css = readFileSync(join(root, 'src', 'rtl.css'), 'utf8');

/**
 * بصمة الورقة الاتجاهية: تُطبع في تشخيص الإضافة كي يُعرف بنظرة واحدة أي نسخة من
 * الورقة تعمل فعلاً في المتصفح. وهذا مهم لأن التطبيق قد يخدم حزمة قديمة من ذاكرة
 * جلسة سابقة، فيبدو الإصلاح «لم يحدث» بينما السبب أن الورقة الجديدة لم تُحمَّل.
 */
const CSS_REVISION = createHash('sha256').update(css).digest('hex').slice(0, 8);

const dictDir = join(root, 'ar');
const indexFile = join(root, 'inventory', '_index.json');
const namespaces = [];
if (existsSync(indexFile)) {
  const index = JSON.parse(readFileSync(indexFile, 'utf8'));
  for (const [ns, meta] of Object.entries(index)) {
    if (ns === '_meta') continue;
    namespaces.push({ ns, fileName: meta && typeof meta.fileName === 'string' ? meta.fileName : `${ns}.en.json` });
  }
} else if (existsSync(dictDir)) {
  for (const file of readdirSync(dictDir).filter((name) => name.endsWith('.json')).sort()) {
    namespaces.push({ ns: file.replace(/\.json$/u, ''), fileName: file });
  }
}
// Sort once so the generated artifact is byte-identical whether the namespace
// list came from the research inventory or from the dictionary file names.
namespaces.sort((a, b) => a.ns.localeCompare(b.ns));

const dictionaries = {};
for (const { ns, fileName } of namespaces) {
  const candidates = [join(dictDir, `${ns}.json`), join(dictDir, fileName)];
  const found = candidates.find((candidate) => existsSync(candidate));
  if (found) dictionaries[ns] = JSON.parse(readFileSync(found, 'utf8'));
}

const banner = `/**
 * GENERATED FILE — do not edit directly.
 * Sources: src/rtl.css, ar/*.json. Regenerate with: node tools/build-client.mjs
 */`;

const artifact = `${banner}
window.__ModuleLoader__.load({
  id: ${JSON.stringify(PLUGIN_ID)},
  factory(require) {
    const CSS = ${JSON.stringify(css)};
    const CSS_TAG_ID = ${JSON.stringify(`${PLUGIN_ID}/rtl.css`)};
    const DICTIONARIES = ${JSON.stringify(dictionaries, null, 2)};
    const ARABIC_ID = "ar";

    function injectStyles() {
      if (typeof document === "undefined") return;
      if (document.querySelector("style[data-plugin-css=" + JSON.stringify(CSS_TAG_ID) + "]") !== null) return;
      const tag = document.createElement("style");
      tag.dataset.plugin = ${JSON.stringify(PLUGIN_ID)};
      tag.dataset.pluginCss = CSS_TAG_ID;
      tag.textContent = CSS;
      document.head.appendChild(tag);
    }

    function isArabic(id) {
      return typeof id === "string" && id.toLowerCase().split("-")[0] === ARABIC_ID;
    }

    /* Diagnostics surface: inspect from the browser console as
     *   __DSH_AR_RTL__
     * to confirm the plugin activated, which namespaces it contributed, and
     * whether the stylesheet and document direction are in place. */
    function reportDiagnostics(extra) {
      const state = globalThis.__DSH_AR_RTL__ ?? {
        plugin: ${JSON.stringify(PLUGIN_ID)},
        language: ARABIC_ID,
        namespaces: Object.keys(DICTIONARIES),
        keys: Object.values(DICTIONARIES).reduce((total, dict) => total + Object.keys(dict).length, 0),
      };
      state.dir = typeof document === "undefined" ? null : document.documentElement.dir;
      state.lang = typeof document === "undefined" ? null : document.documentElement.lang;
      state.stylesInjected = typeof document === "undefined"
        ? null
        : document.querySelector("style[data-plugin-css=" + JSON.stringify(CSS_TAG_ID) + "]") !== null;
      state.cssBytes = CSS.length;
      state.cssRevision = ${JSON.stringify(CSS_REVISION)};
      globalThis.__DSH_AR_RTL__ = Object.assign(state, extra);
      return state;
    }

    function syncDirection(snapshot) {
      if (typeof document === "undefined" || !snapshot) return;
      const active = isArabic(snapshot.active);
      const next = active ? "rtl" : "ltr";
      if (document.documentElement.dir !== next) document.documentElement.dir = next;
      reportDiagnostics({ active: snapshot.active, revision: snapshot.revision });
    }

    return {
      inject: ["locale"],
      apply(ctx) {
        ctx.effect(() => {
          injectStyles();
          return () => {
            const tag = document.querySelector("style[data-plugin-css=" + JSON.stringify(CSS_TAG_ID) + "]");
            if (tag) tag.remove();
          };
        }, ${JSON.stringify(`${PLUGIN_ID}: styles`)},);

        ctx.effect(
          () => ctx.locale.addLanguage({ id: ARABIC_ID, label: "العربية", fallback: "en" }),
          ${JSON.stringify(`${PLUGIN_ID}: language`)},
        );

        for (const [namespace, dict] of Object.entries(DICTIONARIES)) {
          ctx.effect(
            () => ctx.locale.register(namespace, ARABIC_ID, dict),
            ${JSON.stringify(`${PLUGIN_ID}: dictionary `)} + namespace,
          );
        }

        ctx.effect(() => {
          syncDirection(ctx.locale.getSnapshot());
          return ctx.locale.subscribe(syncDirection);
        }, ${JSON.stringify(`${PLUGIN_ID}: direction`)});
      },
    };
  },
});
`;

writeFileSync(join(root, 'client.js'), artifact, 'utf8');
const keyCount = Object.values(dictionaries).reduce((total, dict) => total + Object.keys(dict).length, 0);
process.stdout.write(
  `built client.js: ${Object.keys(dictionaries).length} namespaces, ${keyCount} Arabic keys, ${css.length} bytes of CSS\n`,
);
