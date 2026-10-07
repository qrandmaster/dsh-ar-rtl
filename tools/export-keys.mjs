/**
 * Exports the namespace/key inventory WITHOUT the English values.
 *
 * The published repository does not redistribute the English UI strings
 * extracted from the installed DSH build. Key parity is the invariant that
 * matters for correctness, though, so this script writes just the key lists to
 * `tools/namespace-keys.json`, which `validate-ar.mjs` uses in keys-only mode.
 *
 * Run it locally whenever a DSH update adds or removes keys:
 *   node tools/export-keys.mjs
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const inventoryDir = join(root, 'inventory');
const outFile = join(here, 'namespace-keys.json');

if (!existsSync(inventoryDir)) {
  process.stderr.write('inventory/ is not present — nothing to export.\n');
  process.exit(1);
}

const result = {};
for (const file of readdirSync(inventoryDir).filter((name) => name.endsWith('.en.json')).sort()) {
  const namespace = file.replace(/\.en\.json$/u, '');
  const dict = JSON.parse(readFileSync(join(inventoryDir, file), 'utf8'));
  result[namespace] = Object.keys(dict);
}

const ordered = Object.fromEntries(Object.entries(result).sort(([a], [b]) => a.localeCompare(b)));
writeFileSync(outFile, `${JSON.stringify(ordered, null, 2)}\n`, 'utf8');

const namespaces = Object.keys(ordered).length;
const keys = Object.values(ordered).reduce((total, list) => total + list.length, 0);
process.stdout.write(`wrote ${outFile}: ${namespaces} namespaces, ${keys} keys (values omitted)\n`);
