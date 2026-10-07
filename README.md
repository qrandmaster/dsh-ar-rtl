# DeepSeek Harness — Arabic (RTL) locale

Unofficial Arabic localization **and** real right-to-left support for the
DeepSeek Harness Web GUI — the interface ships English and Chinese only, with no
direction support whatsoever.

* **One command install**, no Node needed, no network during install
* **58 locale namespaces · 2615 keys** translated to Modern Standard Arabic
* **True RTL**: the plugin owns `dir="rtl"`, since no shipped code ever sets it
* **Correct bidirectional text**: mixed Arabic/English lines stop reordering
* **Code stays LTR**: fenced blocks, inline code, commands, keyboard shortcuts
* **Survives DSH updates**, with a one-click maintenance script for the parts that cannot

```powershell
irm https://raw.githubusercontent.com/qrandmaster/dsh-ar-rtl/main/bootstrap.ps1 | iex
```

Then reload the GUI and pick **Settings → General → Language → العربية**.

---

## العربية

إضافة غير رسمية تضيف **تعريباً كاملاً ودعماً حقيقياً للاتجاه من اليمين إلى اليسار** لواجهة
DeepSeek Harness، التي تُشحن بالإنجليزية والصينية فقط وبلا أي دعم اتجاه.

### ما تضيفه

| المكوّن | التفصيل |
|---|---|
| لغة «العربية» | مسجّلة في سجل اللغات، وتُحفظ كتفضيل (`preference: ar`) |
| الاتجاه RTL | لا كود في DSH يكتب `dir` إطلاقاً؛ الإضافة تكتبه وتراقب تغيّر اللغة |
| النصوص | 58 نطاقاً و2615 مفتاحاً بالعربية الفصحى |
| النص المختلط | `unicode-bidi: plaintext` للفقرات، وعزل اتجاهي لـ165 قيمة تقنية |
| الأكواد | تبقى LTR: الكتل والأوامر والاختصارات والمسارات |
| التخطيط | أكثر من 50 تجاوزاً مبنياً على نصوص قواعد DSH المشحونة، لا على تخمين |

### التثبيت السريع

شغّل في PowerShell:

```powershell
irm https://raw.githubusercontent.com/qrandmaster/dsh-ar-rtl/main/bootstrap.ps1 | iex
```

ثم أعد تحميل `http://127.0.0.1:19387`، وإن لم تظهر «العربية» في قائمة اللغة فأعد تشغيل تطبيق DSH.

### التثبيت اليدوي

1. نزّل هذا المستودع (زر Code ثم Download ZIP) وفكّ الضغط.
2. انقر `install.bat` نقراً مزدوجاً.
3. أعد تحميل الواجهة، ثم **Settings → General → Language → العربية**.

### الصيانة والإزالة

| الأمر | الدور |
|---|---|
| `update.bat` | بعد كل تحديث لـ DSH: يعيد اكتشاف أسماء الأصناف المُهشَّرة، ويعيد البناء، وينشر |
| `uninstall.bat` | إزالة كاملة (الصف + الحزمة) |
| `install.bat` | تثبيت أو إعادة تثبيت |

### ماذا يحدث عند تحديث DSH؟

الإضافة تسكن في ملف المستخدم لا في التطبيق:

```
%USERPROFILE%\.dsh\profiles\desktop\plugins\dsh-ar-rtl\
%USERPROFILE%\.dsh\profiles\desktop\cordis.patch.yml
```

| المكوّن | بعد التحديث | السبب |
|---|---|---|
| اللغة والاتجاه والنصوص والعزل | **يبقى** | لا يعتمد على أي اسم صنف |
| مفاتيح جديدة يضيفها التحديث | تظهر إنجليزية حتى تُترجم | لا ترجمة لها بعد |
| تصحيحات الأيقونات والمحاذاة | **قد تنكسر بصمت** | أسماء الأصناف في DSH مُهشَّرة وتتغيّر مع كل بناء |

لذلك وُجد `update.bat`: يمسح `app.asar` الجديد، ويعيد اكتشاف الأصناف بالمطابقة على **متن
القاعدة** لا على الاسم، ثم يعيد البناء والنشر. وإن تغيّر شكل مكوّن، يصرّح بذلك
(`COULD NOT RESOLVE`) بدل أن يختفي التجاوز صامتاً.

### تحقّق من أن الإضافة تعمل

افتح وحدة تحكم المتصفح واكتب:

```js
__DSH_AR_RTL__   // اللغة النشطة، الاتجاه، عدد النطاقات والمفاتيح، وهل حُقنت الورقة
```

### قيود معروفة

* **أربعة أسماء إضافات تجريبية تبقى إنجليزية** (Agent Teams · Auto Authorization Review ·
  Automation tasks · Voice input): عناوينها من بيانات الحزمة داخل `app.asar`، ودالة
  `resolveText` في DSH لا تستشير القواميس بحكم توثيقها وتنفيذها.
* **الجمع العربي**: صيغة القاموس الواحدة لا تعبّر عن الفئات الست، فيُستعمل المفرد مع 1
  والجمع مع ما فوق.
* **التصحيحات البصرية** تستهدف أسماء أصناف مُهشَّرة بطبيعتها؛ ولهذا وُجد `update.bat`.

---

## Repository layout

```
├─ bootstrap.ps1        one-line installer entry point (irm ... | iex)
├─ install.ps1          install / -Update / -Uninstall logic
├─ install.bat          double-click wrappers
├─ uninstall.bat
├─ update.bat
├─ client.js            generated served bundle (committed for Node-less installs)
├─ src/rtl.css          authored stylesheet: direction, bidi, LTR code, layout fixes
├─ ar/*.json            58 Arabic dictionaries
├─ tools/
│  ├─ build-client.mjs       inlines src/rtl.css + ar/*.json into client.js
│  ├─ selftest.mjs           20 assertions on the bundle's runtime behaviour
│  ├─ validate-ar.mjs        key/placeholder parity against the English source
│  ├─ namespace-keys.json    key lists only (English values are not redistributed)
│  ├─ export-keys.mjs        regenerates namespace-keys.json from a local inventory
│  ├─ refresh-selectors.mjs  re-derives hashed CSS class names after a DSH update
│  └─ gh-api.mjs             small GitHub API client used to publish this repository
├─ docs/HOW-IT-WORKS.md
├─ scripts/publish.ps1
└─ .github/workflows/ci.yml
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
  motivates it, quoted in a comment — see `docs/HOW-IT-WORKS.md` for why.
* Run `build-client.mjs` before committing; CI rebuilds from source and compares.

## License

MIT — see [LICENSE](LICENSE). This project is not affiliated with, endorsed by, or shipped by
DeepSeek. It contains no DSH code and redistributes no extracted English UI strings: only the
translation dictionaries, the stylesheet, and the plugin wrapper.
