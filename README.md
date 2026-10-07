# DeepSeek Harness â€” Arabic (RTL) locale

Unofficial Arabic localization **and** real right-to-left support for the
DeepSeek Harness Web GUI â€” the interface ships English and Chinese only, with no
direction support whatsoever.

* **One command install**, no Node needed, no network during install
* **58 locale namespaces آ· 2615 keys** translated to Modern Standard Arabic
* **True RTL**: the plugin owns `dir="rtl"`, since no shipped code ever sets it
* **Correct bidirectional text**: mixed Arabic/English lines stop reordering
* **Code stays LTR**: fenced blocks, inline code, commands, keyboard shortcuts
* **Survives DSH updates**, with a one-click maintenance script for the parts that cannot

```powershell
irm https://raw.githubusercontent.com/qrandmaster/dsh-ar-rtl/main/bootstrap.ps1 | iex
```

Then reload the GUI and pick **Settings â†’ General â†’ Language â†’ ط§ظ„ط¹ط±ط¨ظٹط©**.

---

## ط§ظ„ط¹ط±ط¨ظٹط©

ط¥ط¶ط§ظپط© ط؛ظٹط± ط±ط³ظ…ظٹط© طھط¶ظٹظپ **طھط¹ط±ظٹط¨ط§ظ‹ ظƒط§ظ…ظ„ط§ظ‹ ظˆط¯ط¹ظ…ط§ظ‹ ط­ظ‚ظٹظ‚ظٹط§ظ‹ ظ„ظ„ط§طھط¬ط§ظ‡ ظ…ظ† ط§ظ„ظٹظ…ظٹظ† ط¥ظ„ظ‰ ط§ظ„ظٹط³ط§ط±** ظ„ظˆط§ط¬ظ‡ط©
DeepSeek HarnessطŒ ط§ظ„طھظٹ طھظڈط´ط­ظ† ط¨ط§ظ„ط¥ظ†ط¬ظ„ظٹط²ظٹط© ظˆط§ظ„طµظٹظ†ظٹط© ظپظ‚ط· ظˆط¨ظ„ط§ ط£ظٹ ط¯ط¹ظ… ط§طھط¬ط§ظ‡.

### ظ…ط§ طھط¶ظٹظپظ‡

| ط§ظ„ظ…ظƒظˆظ‘ظ† | ط§ظ„طھظپطµظٹظ„ |
|---|---|
| ظ„ط؛ط© آ«ط§ظ„ط¹ط±ط¨ظٹط©آ» | ظ…ط³ط¬ظ‘ظ„ط© ظپظٹ ط³ط¬ظ„ ط§ظ„ظ„ط؛ط§طھطŒ ظˆطھظڈط­ظپط¸ ظƒطھظپط¶ظٹظ„ (`preference: ar`) |
| ط§ظ„ط§طھط¬ط§ظ‡ RTL | ظ„ط§ ظƒظˆط¯ ظپظٹ DSH ظٹظƒطھط¨ `dir` ط¥ط·ظ„ط§ظ‚ط§ظ‹ط› ط§ظ„ط¥ط¶ط§ظپط© طھظƒطھط¨ظ‡ ظˆطھط±ط§ظ‚ط¨ طھط؛ظٹظ‘ط± ط§ظ„ظ„ط؛ط© |
| ط§ظ„ظ†طµظˆطµ | 58 ظ†ط·ط§ظ‚ط§ظ‹ ظˆ2615 ظ…ظپطھط§ط­ط§ظ‹ ط¨ط§ظ„ط¹ط±ط¨ظٹط© ط§ظ„ظپطµط­ظ‰ |
| ط§ظ„ظ†طµ ط§ظ„ظ…ط®طھظ„ط· | `unicode-bidi: plaintext` ظ„ظ„ظپظ‚ط±ط§طھطŒ ظˆط¹ط²ظ„ ط§طھط¬ط§ظ‡ظٹ ظ„ظ€165 ظ‚ظٹظ…ط© طھظ‚ظ†ظٹط© |
| ط§ظ„ط£ظƒظˆط§ط¯ | طھط¨ظ‚ظ‰ LTR: ط§ظ„ظƒطھظ„ ظˆط§ظ„ط£ظˆط§ظ…ط± ظˆط§ظ„ط§ط®طھطµط§ط±ط§طھ ظˆط§ظ„ظ…ط³ط§ط±ط§طھ |
| ط§ظ„طھط®ط·ظٹط· | ط£ظƒط«ط± ظ…ظ† 50 طھط¬ط§ظˆط²ط§ظ‹ ظ…ط¨ظ†ظٹط§ظ‹ ط¹ظ„ظ‰ ظ†طµظˆطµ ظ‚ظˆط§ط¹ط¯ DSH ط§ظ„ظ…ط´ط­ظˆظ†ط©طŒ ظ„ط§ ط¹ظ„ظ‰ طھط®ظ…ظٹظ† |

### ط§ظ„طھط«ط¨ظٹطھ ط§ظ„ط³ط±ظٹط¹

ط´ط؛ظ‘ظ„ ظپظٹ PowerShell:

```powershell
irm https://raw.githubusercontent.com/qrandmaster/dsh-ar-rtl/main/bootstrap.ps1 | iex
```

ط«ظ… ط£ط¹ط¯ طھط­ظ…ظٹظ„ `http://127.0.0.1:19387`طŒ ظˆط¥ظ† ظ„ظ… طھط¸ظ‡ط± آ«ط§ظ„ط¹ط±ط¨ظٹط©آ» ظپظٹ ظ‚ط§ط¦ظ…ط© ط§ظ„ظ„ط؛ط© ظپط£ط¹ط¯ طھط´ط؛ظٹظ„ طھط·ط¨ظٹظ‚ DSH.

### ط§ظ„طھط«ط¨ظٹطھ ط§ظ„ظٹط¯ظˆظٹ

1. ظ†ط²ظ‘ظ„ ظ‡ط°ط§ ط§ظ„ظ…ط³طھظˆط¯ط¹ (ط²ط± Code ط«ظ… Download ZIP) ظˆظپظƒظ‘ ط§ظ„ط¶ط؛ط·.
2. ط§ظ†ظ‚ط± `install.bat` ظ†ظ‚ط±ط§ظ‹ ظ…ط²ط¯ظˆط¬ط§ظ‹.
3. ط£ط¹ط¯ طھط­ظ…ظٹظ„ ط§ظ„ظˆط§ط¬ظ‡ط©طŒ ط«ظ… **Settings â†’ General â†’ Language â†’ ط§ظ„ط¹ط±ط¨ظٹط©**.

### ط§ظ„طµظٹط§ظ†ط© ظˆط§ظ„ط¥ط²ط§ظ„ط©

| ط§ظ„ط£ظ…ط± | ط§ظ„ط¯ظˆط± |
|---|---|
| `update.bat` | ط¨ط¹ط¯ ظƒظ„ طھط­ط¯ظٹط« ظ„ظ€ DSH: ظٹط¹ظٹط¯ ط§ظƒطھط´ط§ظپ ط£ط³ظ…ط§ط، ط§ظ„ط£طµظ†ط§ظپ ط§ظ„ظ…ظڈظ‡ط´ظژظ‘ط±ط©طŒ ظˆظٹط¹ظٹط¯ ط§ظ„ط¨ظ†ط§ط،طŒ ظˆظٹظ†ط´ط± |
| `uninstall.bat` | ط¥ط²ط§ظ„ط© ظƒط§ظ…ظ„ط© (ط§ظ„طµظپ + ط§ظ„ط­ط²ظ…ط©) |
| `install.bat` | طھط«ط¨ظٹطھ ط£ظˆ ط¥ط¹ط§ط¯ط© طھط«ط¨ظٹطھ |

### ظ…ط§ط°ط§ ظٹط­ط¯ط« ط¹ظ†ط¯ طھط­ط¯ظٹط« DSHطں

ط§ظ„ط¥ط¶ط§ظپط© طھط³ظƒظ† ظپظٹ ظ…ظ„ظپ ط§ظ„ظ…ط³طھط®ط¯ظ… ظ„ط§ ظپظٹ ط§ظ„طھط·ط¨ظٹظ‚:

```
%USERPROFILE%\.dsh\profiles\desktop\plugins\dsh-ar-rtl\
%USERPROFILE%\.dsh\profiles\desktop\cordis.patch.yml
```

| ط§ظ„ظ…ظƒظˆظ‘ظ† | ط¨ط¹ط¯ ط§ظ„طھط­ط¯ظٹط« | ط§ظ„ط³ط¨ط¨ |
|---|---|---|
| ط§ظ„ظ„ط؛ط© ظˆط§ظ„ط§طھط¬ط§ظ‡ ظˆط§ظ„ظ†طµظˆطµ ظˆط§ظ„ط¹ط²ظ„ | **ظٹط¨ظ‚ظ‰** | ظ„ط§ ظٹط¹طھظ…ط¯ ط¹ظ„ظ‰ ط£ظٹ ط§ط³ظ… طµظ†ظپ |
| ظ…ظپط§طھظٹط­ ط¬ط¯ظٹط¯ط© ظٹط¶ظٹظپظ‡ط§ ط§ظ„طھط­ط¯ظٹط« | طھط¸ظ‡ط± ط¥ظ†ط¬ظ„ظٹط²ظٹط© ط­طھظ‰ طھظڈطھط±ط¬ظ… | ظ„ط§ طھط±ط¬ظ…ط© ظ„ظ‡ط§ ط¨ط¹ط¯ |
| طھطµط­ظٹط­ط§طھ ط§ظ„ط£ظٹظ‚ظˆظ†ط§طھ ظˆط§ظ„ظ…ط­ط§ط°ط§ط© | **ظ‚ط¯ طھظ†ظƒط³ط± ط¨طµظ…طھ** | ط£ط³ظ…ط§ط، ط§ظ„ط£طµظ†ط§ظپ ظپظٹ DSH ظ…ظڈظ‡ط´ظژظ‘ط±ط© ظˆطھطھط؛ظٹظ‘ط± ظ…ط¹ ظƒظ„ ط¨ظ†ط§ط، |

ظ„ط°ظ„ظƒ ظˆظڈط¬ط¯ `update.bat`: ظٹظ…ط³ط­ `app.asar` ط§ظ„ط¬ط¯ظٹط¯طŒ ظˆظٹط¹ظٹط¯ ط§ظƒطھط´ط§ظپ ط§ظ„ط£طµظ†ط§ظپ ط¨ط§ظ„ظ…ط·ط§ط¨ظ‚ط© ط¹ظ„ظ‰ **ظ…طھظ†
ط§ظ„ظ‚ط§ط¹ط¯ط©** ظ„ط§ ط¹ظ„ظ‰ ط§ظ„ط§ط³ظ…طŒ ط«ظ… ظٹط¹ظٹط¯ ط§ظ„ط¨ظ†ط§ط، ظˆط§ظ„ظ†ط´ط±. ظˆط¥ظ† طھط؛ظٹظ‘ط± ط´ظƒظ„ ظ…ظƒظˆظ‘ظ†طŒ ظٹطµط±ظ‘ط­ ط¨ط°ظ„ظƒ
(`COULD NOT RESOLVE`) ط¨ط¯ظ„ ط£ظ† ظٹط®طھظپظٹ ط§ظ„طھط¬ط§ظˆط² طµط§ظ…طھط§ظ‹.

### طھط­ظ‚ظ‘ظ‚ ظ…ظ† ط£ظ† ط§ظ„ط¥ط¶ط§ظپط© طھط¹ظ…ظ„

ط§ظپطھط­ ظˆط­ط¯ط© طھط­ظƒظ… ط§ظ„ظ…طھطµظپط­ ظˆط§ظƒطھط¨:

```js
__DSH_AR_RTL__   // ط§ظ„ظ„ط؛ط© ط§ظ„ظ†ط´ط·ط©طŒ ط§ظ„ط§طھط¬ط§ظ‡طŒ ط¹ط¯ط¯ ط§ظ„ظ†ط·ط§ظ‚ط§طھ ظˆط§ظ„ظ…ظپط§طھظٹط­طŒ ظˆظ‡ظ„ ط­ظڈظ‚ظ†طھ ط§ظ„ظˆط±ظ‚ط©
```

### ظ‚ظٹظˆط¯ ظ…ط¹ط±ظˆظپط©

* **ط£ط±ط¨ط¹ط© ط£ط³ظ…ط§ط، ط¥ط¶ط§ظپط§طھ طھط¬ط±ظٹط¨ظٹط© طھط¨ظ‚ظ‰ ط¥ظ†ط¬ظ„ظٹط²ظٹط©** (Agent Teams آ· Auto Authorization Review آ·
  Automation tasks آ· Voice input): ط¹ظ†ط§ظˆظٹظ†ظ‡ط§ ظ…ظ† ط¨ظٹط§ظ†ط§طھ ط§ظ„ط­ط²ظ…ط© ط¯ط§ط®ظ„ `app.asar`طŒ ظˆط¯ط§ظ„ط©
  `resolveText` ظپظٹ DSH ظ„ط§ طھط³طھط´ظٹط± ط§ظ„ظ‚ظˆط§ظ…ظٹط³ ط¨ط­ظƒظ… طھظˆط«ظٹظ‚ظ‡ط§ ظˆطھظ†ظپظٹط°ظ‡ط§.
* **ط§ظ„ط¬ظ…ط¹ ط§ظ„ط¹ط±ط¨ظٹ**: طµظٹط؛ط© ط§ظ„ظ‚ط§ظ…ظˆط³ ط§ظ„ظˆط§ط­ط¯ط© ظ„ط§ طھط¹ط¨ظ‘ط± ط¹ظ† ط§ظ„ظپط¦ط§طھ ط§ظ„ط³طھطŒ ظپظٹظڈط³طھط¹ظ…ظ„ ط§ظ„ظ…ظپط±ط¯ ظ…ط¹ 1
  ظˆط§ظ„ط¬ظ…ط¹ ظ…ط¹ ظ…ط§ ظپظˆظ‚.
* **ط§ظ„طھطµط­ظٹط­ط§طھ ط§ظ„ط¨طµط±ظٹط©** طھط³طھظ‡ط¯ظپ ط£ط³ظ…ط§ط، ط£طµظ†ط§ظپ ظ…ظڈظ‡ط´ظژظ‘ط±ط© ط¨ط·ط¨ظٹط¹طھظ‡ط§ط› ظˆظ„ظ‡ط°ط§ ظˆظڈط¬ط¯ `update.bat`.

---

## Repository layout

```
â”œâ”€ bootstrap.ps1        one-line installer entry point (irm â€¦ | iex)
â”œâ”€ install.ps1          install / -Update / -Uninstall logic
â”œâ”€ install.bat          double-click wrappers
â”œâ”€ uninstall.bat
â”œâ”€ update.bat
â”œâ”€ client.js            generated served bundle (committed for Node-less installs)
â”œâ”€ src/rtl.css          authored stylesheet: direction, bidi, LTR code, layout fixes
â”œâ”€ ar/*.json            58 Arabic dictionaries
â”œâ”€ tools/
â”‚  â”œâ”€ build-client.mjs       inlines src/rtl.css + ar/*.json into client.js
â”‚  â”œâ”€ selftest.mjs           20 assertions on the bundle's runtime behaviour
â”‚  â”œâ”€ validate-ar.mjs        key/placeholder parity against the English source
â”‚  â”œâ”€ namespace-keys.json    key lists only (English values are not redistributed)
â”‚  â”œâ”€ export-keys.mjs        regenerates namespace-keys.json from a local inventory
â”‚  â””â”€ refresh-selectors.mjs  re-derives hashed CSS class names after a DSH update
â”œâ”€ docs/HOW-IT-WORKS.md
â””â”€ .github/workflows/ci.yml
```

## Development

```bash
node tools/build-client.mjs                  # regenerate client.js
node tools/selftest.mjs                      # 20 runtime assertions
node tools/validate-ar.mjs                   # dictionary parity
node tools/refresh-selectors.mjs --dry-run   # check the stylesheet against the installed build
```

`refresh-selectors.mjs` needs a local DSH install (it reads `app.asar`). `validate-ar.mjs`
runs in keys-only mode in a fresh clone; with a local `inventory/` of the extracted English
dictionaries it additionally checks placeholder and newline parity.

## Contributing

* **Translations**: edit `ar/<namespace>.json`, keep the key set and every `{placeholder}`
  exactly as it is, then run `validate-ar.mjs`.
* **Layout fixes**: add a rule to `src/rtl.css` only together with the shipped rule that
  motivates it, quoted in a comment â€” see `docs/HOW-IT-WORKS.md` for why.
* Run `build-client.mjs` before committing; CI rebuilds from source and compares.

## License

MIT â€” see [LICENSE](LICENSE). This project is not affiliated with, endorsed by, or shipped by
DeepSeek. It contains no DSH code and redistributes no extracted English UI strings: only the
translation dictionaries, the stylesheet, and the plugin wrapper.
