# Changelog

## 1.0.0

First public release.

### Localization
* Arabic (`ar`) registered in the DSH locale registry, selectable in
  **Settings → General → Language** and persisted as `preference: ar`.
* 58 locale namespaces, 2615 keys, translated to Modern Standard Arabic.
* Locale-valued keys retargeted per language by inspecting the consuming code:
  `schedule.*.time.locale` → `ar-u-nu-latn`, while
  `settings.account.onboardingArtworkLocale` and `sidebarExcel.language` stay
  `en` on purpose.
* 165 values carrying technical placeholders (versions, times, zones, exit
  codes, paths, model ids) fenced with Unicode isolates so they stop reordering
  inside Arabic sentences.

### Direction and bidirectional text
* The plugin writes `document.documentElement.dir` itself and watches the locale
  snapshot; the shipped runtime writes only `<html lang>`.
* `unicode-bidi: plaintext` for transcript prose, message bodies, and text inputs.
* Code, commands, identifiers, and keyboard shortcuts pinned to LTR.
* Markdown tables forced right-aligned with `!important`, because the renderer
  emits an inline `text-align` for `:---` delimiter columns.

### Layout
* 50+ overrides, each derived from the shipped rule that motivates it: composer
  action row, settings rows and navigation, switches, account card, model and
  permission pickers, plugin manager, agent preset cards, sidebar, menus.

### Tooling
* `tools/build-client.mjs` — bundle generator, no bundler and no network.
* `tools/selftest.mjs` — 20 assertions on the bundle's runtime behaviour.
* `tools/validate-ar.mjs` — key/placeholder/newline parity.
* `tools/refresh-selectors.mjs` — re-derives the hashed CSS class names from a
  newly installed `app.asar` after a DSH update, with an ambiguity guard.
* `install.ps1` with `-Update` and `-Uninstall`, plus `install.bat`,
  `update.bat`, `uninstall.bat`.
* `bootstrap.ps1` — the `irm … | iex` one-liner.

### Known limitations
* Four experimental plugin names and descriptions stay English: they come from
  package metadata inside `app.asar`, and `ctx.locale.resolveText` does not
  consult namespace dictionaries.
* Arabic plural categories cannot be expressed through single-string
  dictionaries.
* Visual overrides target build-hashed class names, hence `update.bat`.
