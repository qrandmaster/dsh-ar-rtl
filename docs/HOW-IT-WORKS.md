# How it works

Everything below was verified against a shipped build (`0.2.0-rc.2`, web asset
`index-BPHePDI_.css`) by reading `app.asar`. Where a claim is an inference it is
marked as such.

## 1. Why a plugin is needed at all

DSH ships exactly two locales (`LOCALE_IDS = ["zh", "en"]`) and its locale
registry owns selection, persistence, browser matching, key fallback and
`<html lang>` — nothing else. The registry's own README says it "does not add
plural rules or bidirectional layout", and that is literal:

* `LanguageRegistration` is `{ id, label, fallback }` — **no direction field**.
* `normalizeLanguage()` validates and freezes exactly those three keys.
* The only document mutation is `syncDocumentLanguage()`, which writes
  `<html lang>` and nothing else.
* A whole-archive search finds no `direction:` (outside `flex-direction`), no
  `unicode-bidi`, and **no app code that ever reads or writes a `dir`
  attribute**. The RTL hits in the archive belong to `pdf.js`, `LuckySheet`, and
  RFC 5893 bidi handling for hostnames.

So the interface is always LTR, which is what makes mixed Arabic/English lines
reorder.

## 2. Adding a language

`ctx.locale.addLanguage({ id, label, fallback })` registers a BCP 47-style tag.
The fallback chain must terminate at `en`, so `{ id: 'ar', label: 'العربية',
fallback: 'en' }` is accepted and the selector gains an entry.

Dictionaries use `ctx.locale.register(namespace, locale, dict)`. The runtime
only rejects a duplicate **pair**:

```js
for (const [locale] of pairs)
  if (locales.has(localeKey(locale)))
    throw new Error(`locale namespace "${ns}" already has locale "${locale}"`);
```

A shipped namespace therefore has `en` and `zh` occupied but `ar` free — which
is why an external plugin can translate the *shipped* UI without touching the
application. This is the single most important discovery behind the project, and
it contradicts a natural reading of the docs ("a namespace's texts have one
owner" is per locale pair, not per namespace).

## 3. Owning `dir`

Because nothing else writes it, the plugin sets
`document.documentElement.dir = active === 'ar' ? 'rtl' : 'ltr'` and subscribes
to the locale snapshot. The stylesheet is injected with the shipped pattern:

```js
const tag = document.createElement('style');
tag.dataset.plugin = PLUGIN_ID;        // claimed and tracked by dsh-client-modules
tag.dataset.pluginCss = CSS_TAG_ID;
document.head.appendChild(tag);
```

Plugin styles land after the shell's stylesheet links, so an equal-specificity
`html[dir="rtl"] .x` (0,2,1) beats a shipped single-class rule (0,1,0).

## 4. Bidirectional text, two layers

**Layout layer (CSS).** `unicode-bidi: plaintext` on transcript prose applies the
Unicode First-Strong-Character rule per paragraph: Arabic paragraphs run RTL, an
all-Latin line stays LTR. Code, commands, identifiers and shortcuts are pinned
to `direction: ltr; unicode-bidi: isolate`.

**Content layer (dictionary values).** Even with `plaintext`, a value like
`إصابة الذاكرة المؤقتة {percent}%` renders as `%98` in an RTL paragraph, because
`%` is a neutral character that takes the paragraph direction. The fix lives in
the translation itself: 165 values fence their technical placeholders with
`U+2068` (FSI, first-strong isolate) and `U+2069` (PDI). FSI is the correct
choice over LRI because the value's direction is unknown at authoring time — a
version string must read LTR, an interpolated session name may be Arabic.

Markdown tables needed `!important` for a different reason: the renderer emits
an **inline** `text-align` for a `:---` delimiter column, and an inline style
outranks any plain stylesheet rule. Both the CSS override and a convention
("never write alignment markers in Arabic tables") are in place, because the CSS
only travels where the plugin is installed while the marker travels with the
text.

## 5. Layout overrides, and why each one is quoted

Every rule in `src/rtl.css` names the shipped rule that motivates it, because the
obvious guess is often wrong. Examples found this way:

| Symptom | Shipped cause |
|---|---|
| send button floating mid-row with an empty gap | `.RlGAzG_trailing{…;margin-left:auto}` — a physical auto margin |
| settings rows indented 74px | `padding-right:48px` repeated in **six** separate CSS modules |
| switch looked broken only while enabled | `[aria-checked=true] .thumb{transform:translate(16px)}` — physical +X travel |
| settings label stranded from its icon | `.wCInkW_navCell{…;text-align:left}` with `.navLabel{flex:1}` |
| account arrow pointing the wrong way | `IconRightUpOutlineRegular` renders ↗ unconditionally |

Two things were deliberately *not* touched: the right-panel icons already carry
`transform: scaleX(-1)` (un-mirroring them would double the flip), and the
account card's button row already mirrors correctly through
`justify-content: space-between`.

## 6. Surviving updates

CSS-module class names are build-time hashes (`RlGAzG_trailing`,
`_switch_1ik0f_5`), so they change on every DSH build. Everything keyed to them
breaks silently after an update, while everything keyed to literal hooks
(`data-*` attributes, `md-code-block`, `[data-code-block-content]`, `.md-table-wide`)
keeps working.

`tools/refresh-selectors.mjs` closes that gap: for each fixed component it holds
a **rule-body signature** rather than a remembered class name — for example
`_trailing\{[^}]*margin-left:auto\}` — scans the newly installed `app.asar`,
captures the current prefix, and rewrites `src/rtl.css`. It also collects every
prefix carrying `padding-right:48px` as a group, so new settings rows are picked
up automatically. When a signature matches a sibling component's identical rule
body it reports the ambiguity instead of rewriting (this guard was added after
the tool renamed a permission-picker selector to the model picker's prefix).

## 7. Packaging

A client plugin is a package with `dsh.client.platform === 'web'` and an
`exports["./client"]` bundle. The host serves that file as-is, and its only
requirement is that the bundle registers a lazy factory:

```js
window.__ModuleLoader__.load({ id: '<package name>', factory(require) { … } });
```

That is why there is no bundler, no TypeScript, and no build toolchain in this
repository: `client.js` is generated by string assembly in
`tools/build-client.mjs`, and the three DSH files it needs are produced by
`install.ps1`:

* `…/profiles/desktop/plugins/dsh-ar-rtl/` — the package
* one `insert` row in `…/profiles/desktop/cordis.patch.yml`
* nothing else; no `node_modules`, no pnpm, no network
