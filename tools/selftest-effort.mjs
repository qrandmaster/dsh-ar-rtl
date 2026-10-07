/**
 * Self-test for the page-level Arabic of catalog-owned labels (src/effort-ar.js).
 *
 * The generated bundle inlines that file inside the module factory, so the file
 * itself is the testable unit: it declares one function and nothing else.
 *
 * Usage: node tools/selftest-effort.mjs
 */
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');

const failures = [];
function check(label, condition, detail = '') {
  const ok = Boolean(condition);
  process.stdout.write(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok || !detail ? '' : ` — ${detail}`}\n`);
  if (!ok) failures.push(label);
}

/* --- mini DOM ------------------------------------------------------------- */
class TextNode {
  constructor(value) {
    this.nodeType = 3;
    this.nodeValue = value;
  }
  get textContent() {
    return this.nodeValue;
  }
}
class El {
  constructor(tag, attrs = {}) {
    this.nodeType = 1;
    this.tagName = tag.toUpperCase();
    this.attrs = attrs;
    this.childNodes = [];
  }
  append(...nodes) {
    this.childNodes.push(...nodes);
    return this;
  }
  get textContent() {
    return this.childNodes.map((child) => child.textContent).join('');
  }
  querySelectorAll(selector) {
    return descendants(this).filter((el) => matches(el, selector));
  }
}
function descendants(el) {
  const out = [];
  for (const child of el.childNodes) {
    if (child.nodeType !== 1) continue;
    out.push(child, ...descendants(child));
  }
  return out;
}
function matches(el, selector) {
  const attr = /\[([a-zA-Z-]+)(?:="([^"]*)")?\]/u.exec(selector);
  const tag = /^[a-zA-Z]+/u.exec(selector);
  if (tag && el.tagName !== tag[0].toUpperCase()) return false;
  if (attr) {
    const value = el.attrs[attr[1]];
    if (value === undefined) return false;
    if (attr[2] !== undefined && value !== attr[2]) return false;
  }
  return true;
}

const body = new El('body', { id: 'body' });
globalThis.document = {
  body,
  documentElement: new El('html', {}),
  querySelectorAll: (selector) => body.querySelectorAll(selector),
};
const observed = [];
globalThis.MutationObserver = class {
  constructor(callback) {
    this.callback = callback;
  }
  observe(target, options) {
    observed.push({ target, options, fire: () => this.callback([]) });
  }
  disconnect() {
    this.disconnected = true;
  }
};
/** يعيد العنصر المُضاف (لا الحاوي) كما يفعل DOM الحقيقي في هذا الاختبار. */
const add = (parent, child) => {
  parent.append(child);
  return child;
};

/* --- load the authored unit ---------------------------------------------- */
const source = readFileSync(join(root, 'src', 'effort-ar.js'), 'utf8');
const installEffortArabic = new Function(`${source}\nreturn installEffortArabic;`)();
check('الوحدة تُصرّح بدالة واحدة قابلة للتحميل', typeof installEffortArabic === 'function');

/* --- build a stand-in of the model menu ---------------------------------- */
const menu = add(body, new El('div', { role: 'menu' }));
const option = (name) => {
  const button = add(menu, new El('button', { 'aria-checked': 'false' }));
  add(button, new TextNode(name));
  return button;
};
const off = option('Off');
const low = option('Low');
const high = option('High');
const max = option('Max');

const trigger = add(body, new El('button', { 'aria-haspopup': 'menu' }));
const triggerSpan = add(trigger, new El('span', {}));
add(triggerSpan, new TextNode('High'));

/* نصّ المحادثة: لا يجوز أن يُمَسّ */
const paragraph = add(body, new El('p', {}));
add(paragraph, new TextNode('Max'));

const wait = (ms) => new Promise((done) => setTimeout(done, ms));

const dispose = installEffortArabic();
check('يرصد تغيّرات الصفحة', observed.length === 1);
await wait(400);

check(
  'تُعرَّب خيارات الجهد كلها',
  [off, low, high, max].every((b) => /[\u0600-\u06FF]/u.test(b.textContent)),
  [off.textContent, low.textContent, high.textContent, max.textContent].join('|'),
);
check('تُعرَّب الشريحة المعروضة في الزرّ', triggerSpan.textContent === 'عالي', triggerSpan.textContent);
check('ولا تُمَسّ نصوص المحادثة', paragraph.textContent === 'Max', paragraph.textContent);

/* حارس المجموعة: اسم نموذج اسمه «Max» وحده — بلا مجموعة جهد معروضة — لا يُمَسّ */
menu.childNodes.length = 0;
const loneModel = add(body, new El('button', { 'aria-checked': 'false' }));
add(loneModel, new TextNode('Max'));
observed[0].fire();
await wait(400);
check('ولا يُمَسّ اسم نموذج منفرد', loneModel.textContent === 'Max', loneModel.textContent);

/* إعادة الرسم من الواجهة تُعاد معالجتها (والمعالجة متكرّرة بلا حلقة) */
triggerSpan.childNodes[0].nodeValue = 'Max';
observed[0].fire();
await wait(400);
check('وتُلتقط إعادة الرسم من الواجهة', triggerSpan.textContent === 'أقصى', triggerSpan.textContent);

/* الواجهة كتبت قيمة ليست من أسماء الجهد بعدنا: يجب ألا نُعيد فوقها شيئاً */
triggerSpan.childNodes[0].nodeValue = 'Auto';
dispose();
check('يُفصل الرصد عند الإزالة', observed[0].target === body);
check(
  'وتُعاد النصوص الأصلية لما كتبناه نحن',
  high.textContent === 'High' && low.textContent === 'Low',
  `${high.textContent}|${low.textContent}`,
);
check('ولا نُعيد الأصل فوق ما كتبته الواجهة بعده', triggerSpan.textContent === 'Auto', triggerSpan.textContent);

process.stdout.write(`\n${failures.length === 0 ? 'كل الفحوص نجحت' : `فشل ${failures.length}`}\n`);
if (failures.length > 0) process.exitCode = 1;
