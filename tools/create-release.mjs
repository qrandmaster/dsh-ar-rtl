/**
 * create-release.mjs — إنشاء إصدار GitHub من وسم موجود، بالعربية السليمة والاتجاه يميناً.
 *
 * المنهاج (مثبَّت بعد إصدار 1.3.0):
 *   1. يقرأ قسم الإصدار من CHANGELOG.md (من "## <رقم>" إلى العنوان التالي).
 *   2. يغلّف المتن بـ<div dir="rtl"> كي يصيّره GitHub يميناً (هكذا كانت الإصدارات السابقة).
 *   3. يبني الحزمة بـgit archive من الوسم نفسه.
 *   4. يأخذ التوكن من مدير بيانات الاعتماد (git credential fill) — لا ملفات توكن.
 *   5. ينشئ الإصدار عبر Node fetch بترميز UTF-8 سليم — لا PowerShell (سبب فساد العربية في 1.3.0).
 *   6. عنوان فيه عربية يُلفّ بعزل U+2067…U+2069 ليُقرأ من اليمين في شريط العنوان اللاتيني.
 *
 * الاستعمال:
 *   node tools/create-release.mjs v1.4.0 [--name "وصف عربي"] [--draft]
 *
 * إن كان الإصدار موجوداً يُحدَّث (اسم/متن) ولا يُنشأ ثانياً، والحزمة تُستبدل إن وُجدت.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');

const [tag] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const nameArg = process.argv.includes('--name') ? process.argv[process.argv.indexOf('--name') + 1] : undefined;
const draft = process.argv.includes('--draft');

if (!tag || !/^v[0-9]+.[0-9]+.[0-9]+$/.test(tag)) {
  process.stderr.write('usage: node tools/create-release.mjs vX.Y.Z [--name "..."] [--draft]\n');
  process.exit(2);
}

function git(args, input) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8', input, maxBuffer: 64 * 1024 * 1024 });
}

// 1) الوسم موجود؟
const tags = git(['tag', '--list', tag]).trim();
if (tags !== tag) {
  process.stderr.write(`الوسم ${tag} غير موجود محلياً — أنشئه وادفعه أولاً.\n`);
  process.exit(1);
}
const version = tag.slice(1);

// 2) قسم الإصدار من CHANGELOG
const changelog = readFileSync(join(root, 'CHANGELOG.md'), 'utf8');
const start = changelog.indexOf(`## ${version}`);
if (start === -1) {
  process.stderr.write(`لا يوجد قسم "## ${version}" في CHANGELOG.md\n`);
  process.exit(1);
}
const next = changelog.indexOf('\n## ', start + 1);
const section = changelog.slice(start, next === -1 ? undefined : next).trim();
const body = `<div dir="rtl">\n\n${section}\n\n</div>`;
const nameArg0 = nameArg ?? tag;
// عنوان فيه عربية يُلفّ بعزل RTL (U+2067…U+2069) كي تُقرأ مقاطعه من اليمين داخل عنوان الصفحة اللاتيني
// (عناوين GitHub بلا dir="auto" — تجربة 1.3.0: RLM وحده لا يكفي، والعزل يُقرأ صحيحاً).
const name = /[\u0590-\u08FF]/.test(nameArg0) ? "\u2067" + nameArg0 + "\u2069" : nameArg0;

// 3) الحزمة من الوسم
const zipPath = join(root, '..', `dsh-ar-rtl-${tag}.zip`);
git(['archive', '--format=zip', `--output=${zipPath}`, tag]);
const zipSize = statSync(zipPath).size;

// 4) التوكن من مدير بيانات الاعتماد
const remoteUrl = git(['remote', 'get-url', 'origin']).trim();
const repoPath = remoteUrl.replace(/^https:\/\/github\.com\//, '').replace(/\.git$/, '');
const cred = git(['credential', 'fill'], 'protocol=https\nhost=github.com\n\n');
const token = (cred.match(/password=(.*)/) || [])[1]?.trim();
if (!token) {
  process.stderr.write('لم أجد توكن GitHub في مدير بيانات الاعتماد\n');
  process.exit(1);
}
const api = `https://api.github.com/repos/${repoPath}`;
const headers = {
  Authorization: `Bearer ${token}`,
  'User-Agent': 'dsh-ar-rtl-release',
  Accept: 'application/vnd.github+json',
  'Content-Type': 'application/json; charset=utf-8',
};

// 5) إنشاء أو تحديث الإصدار
async function main() {
  // هل هو موجود؟
  const found = await fetch(`${api}/releases/tags/${tag}`, { headers });
  let releaseId;
  if (found.status === 200) {
    const existing = await found.json();
    releaseId = existing.id;
    const patched = await fetch(`${api}/releases/${releaseId}`, {
      method: 'PATCH', headers, body: JSON.stringify({ tag_name: tag, name, body, draft }),
    });
    if (!patched.ok) throw new Error(`PATCH ${patched.status}: ${await patched.text()}`);
    process.stdout.write(`حُدِّث الإصدار القائم #${releaseId}\n`);
  } else {
    const created = await fetch(`${api}/releases`, {
      method: 'POST', headers, body: JSON.stringify({ tag_name: tag, name, body, draft, prerelease: false }),
    });
    if (!created.ok) throw new Error(`POST ${created.status}: ${await created.text()}`);
    const rel = await created.json();
    releaseId = rel.id;
    process.stdout.write(`أُنشئ الإصدار #${releaseId}\n`);
  }

  // الأصل: استبدل إن وُجد
  const assetsRes = await fetch(`${api}/releases/${releaseId}/assets`, { headers });
  if (assetsRes.ok) {
    for (const a of await assetsRes.json()) {
      if (a.name === `dsh-ar-rtl-${tag}.zip`) {
        await fetch(`${api}/releases/assets/${a.id}`, { method: 'DELETE', headers });
        process.stdout.write(`حُذف الأصل القديم ${a.name}\n`);
      }
    }
  }
  const assetName = `dsh-ar-rtl-${tag}.zip`;
  const uploaded = await fetch(`https://uploads.github.com/repos/${repoPath}/releases/${releaseId}/assets?name=${assetName}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'User-Agent': 'dsh-ar-rtl-release', 'Content-Type': 'application/zip' },
    body: readFileSync(zipPath),
  });
  if (!uploaded.ok) throw new Error(`رفع الأصل ${uploaded.status}: ${await uploaded.text()}`);
  const asset = await uploaded.json();

  const latest = await fetch(`${api}/releases/latest`, { headers });
  const rel = latest.ok ? await latest.json() : null;
  process.stdout.write(
    `\nتم ✓\n  الإصدار: ${tag} (${name})\n` +
    `  الحزمة: ${asset.name} — ${Math.round(asset.size / 1024)} KB\n` +
    `  releases/latest: ${rel ? rel.tag_name : '?'}\n` +
    `  الرابط: https://github.com/${repoPath}/releases/tag/${tag}\n`,
  );
}

main().catch((e) => { process.stderr.write(String(e.message || e) + '\n'); process.exit(1); });
