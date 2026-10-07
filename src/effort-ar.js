/**
 * تعريب أسماء جهد الاستدلال في قائمة النموذج.
 *
 * لماذا طبقة في الصفحة ولا قاموس ترجمة؟ لأن هذه الأسماء ليست مفاتيح ترجمة في
 * التطبيق أصلاً، بل نصوص مكتوبة في حزمة مزوّد DeepSeek نفسه:
 *
 *   dsh/node_modules/@deepseek-ai/dsh-llm-deepseek/lib/index.js
 *     const REASONING_EFFORTS = [
 *       { id: "off",  name: "Off",  description: "…" },
 *       { id: "low",  name: "Low",  description: "…" },
 *       { id: "high", name: "High", description: "…" },
 *       { id: "max",  name: "Max",  description: "…" },
 *     ];
 *
 * فتصل إلى الواجهة كـ**بيانات** (`reasoning.efforts[].name`) لا كمعرّف ترجمة،
 * و`ctx.locale.register` لا يمسّها. ولا حقل لها في تهيئة المزوّد، فلا سبيل إلى
 * تعريبها من ملف الإعداد أيضاً.
 *
 * فنتعرّف عليها في الصفحة ونستبدل نصّها، ونُعيد الأصل عند إيقاف الإضافة أو عند
 * تغيير اللغة. ولا نلمس التطبيق المثبَّت ولا حزمة المزوّد، فلا شيء يُكسر بعد تحديث.
 *
 * وحدود الأمان التي التزمناها:
 *   - لا نستبدل إلا عقدة نصّية **يساوي نصّها الاسم وحده** (خيار القائمة أو شريحة
 *     الزرّ)، ولا نستبدل داخل نصّ أطول.
 *   - ولا نبحث إلا في أزرار القوائم المنسدلة وعناصر القائمة (`aria-checked`
 *     و`aria-haspopup` و`role=menuitem`) — لا في متن المحادثة.
 *   - ولا نُعيد تسمية عناصر `aria-checked` إلا إذا ظهرت **مجموعة** الجهد (اثنان
 *     فأكثر) في اللحظة نفسها، كي لا نُعيد تسمية نموذج اسمه «Max» مثلاً.
 *   - وعند الإزالة لا نُعيد الأصل إلا إذا كنا نحن آخر من كتب النصّ (وإلا تركناه
 *     لما كتبته الواجهة بعده).
 */
function installEffortArabic() {
  if (typeof document === "undefined" || typeof MutationObserver === "undefined") return () => {};
  const root = document.body || document.documentElement;
  if (!root || typeof root.querySelectorAll !== 'function') return () => {};

  const ARABIC = { Off: 'إيقاف', Low: 'منخفض', High: 'عالي', Max: 'أقصى' };
  const NAMES = new Set(Object.keys(ARABIC));
  const ARABIC_VALUES = new Set(Object.values(ARABIC));
  /** عقدة نصّية -> قيمتها قبل أول استبدال. */
  const touched = new Map();
  let timer = null;

  const textOf = (element) => (element.textContent || '').trim();

  function replace(node, value) {
    if (!touched.has(node)) touched.set(node, node.nodeValue);
    if (node.nodeValue !== value) node.nodeValue = value;
  }

  function patchWithin(element) {
    for (const child of element.childNodes) {
      if (child.nodeType !== 3) continue;
      const trimmed = (child.nodeValue || '').trim();
      if (NAMES.has(trimmed)) replace(child, ARABIC[trimmed]);
    }
  }

  function patch() {
    if (typeof document.querySelectorAll !== 'function') return;

    // (1) خيارات القائمة المنسدلة للجهد: مجموعة كاملة في وقت واحد.
    const options = [];
    for (const button of document.querySelectorAll('button[aria-checked]')) {
      if (NAMES.has(textOf(button))) options.push(button);
    }
    if (options.length >= 2) for (const button of options) patchWithin(button);

    // (2) الزرّ الذي يعرض «النموذج · الجهد»، وصفّ الجهد في القائمة.
    for (const host of document.querySelectorAll('[aria-haspopup], [role="menuitem"], [role="menu"]')) {
      patchWithin(host);
      for (const child of host.querySelectorAll('span')) patchWithin(child);
    }
  }

  function schedule() {
    if (timer !== null) return;
    timer = setTimeout(() => {
      timer = null;
      try {
        patch();
      } catch {
        /* لا نُسقط الواجهة بسبب طبقة تجميلية */
      }
    }, 250);
  }

  const observer = new MutationObserver(schedule);
  try {
    observer.observe(root, { childList: true, subtree: true, characterData: true });
  } catch {
    return () => {};
  }
  schedule();

  return () => {
    observer.disconnect();
    if (timer !== null) clearTimeout(timer);
    for (const [node, original] of touched) {
      const current = (node.nodeValue || '').trim();
      // لا نُعيد الأصل إلا إذا كان آخر ما في العقدة هو نصّنا العربي.
      if (ARABIC_VALUES.has(current)) node.nodeValue = original;
    }
    touched.clear();
  };
}
