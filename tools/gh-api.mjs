/**
 * Minimal GitHub API client over Node's own TLS stack.
 *
 * The sandbox denies the Windows security package, so every schannel-based path
 * (PowerShell, curl.exe, .NET) fails with SEC_E_NO_CREDENTIALS. Node bundles
 * OpenSSL and is unaffected, which is what makes this script the only route to
 * api.github.com from here.
 *
 * The token is read from a file and never printed.
 *
 * Usage:
 *   node tools/gh-api.mjs whoami  <tokenFile>
 *   node tools/gh-api.mjs create  <tokenFile> <name> [--private] [--description "..."]
 */
import { readFileSync } from 'node:fs';
import { request } from 'node:https';

const [, , action, tokenFile, ...rest] = process.argv;

if (!action || !tokenFile) {
  process.stderr.write('usage: node tools/gh-api.mjs whoami|create <tokenFile> [name] [--private]\n');
  process.exit(2);
}

// The file may be a bare token or the raw `git credential` output
// (protocol=/host=/username=/password= lines), so parse the password field when
// it is present and fall back to the whole file otherwise.
const raw = readFileSync(tokenFile, 'utf8');
const passwordLine = /^password=(.*)$/mu.exec(raw);
const token = (passwordLine ? passwordLine[1] : raw).trim();
if (token.length === 0) {
  process.stderr.write('no token found in the credential file\n');
  process.exit(2);
}

function api(method, path, body) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const req = request(
      {
        host: 'api.github.com',
        path,
        method,
        headers: {
          'User-Agent': 'dsh-ar-rtl-publisher',
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${token}`,
          'X-GitHub-Api-Version': '2022-11-28',
          ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {}),
        },
      },
      (res) => {
        let data = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          let parsed = null;
          try {
            parsed = data ? JSON.parse(data) : null;
          } catch {
            parsed = data;
          }
          resolve({ status: res.statusCode, headers: res.headers, body: parsed });
        });
      },
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

const flag = (name) => rest.includes(name);
const valueOf = (name) => {
  const index = rest.indexOf(name);
  return index >= 0 ? rest[index + 1] : undefined;
};

if (action === 'whoami') {
  const res = await api('GET', '/user');
  if (res.status !== 200) {
    process.stdout.write(`GET /user -> ${res.status}: ${JSON.stringify(res.body)}\n`);
    process.exit(1);
  }
  process.stdout.write(`login:        ${res.body.login}\n`);
  process.stdout.write(`name:         ${res.body.name ?? '(none)'}\n`);
  process.stdout.write(`public repos: ${res.body.public_repos}\n`);
  process.stdout.write(`scopes:       ${res.headers['x-oauth-scopes'] ?? '(none reported)'}\n`);
  process.stdout.write(`token type:   ${token.slice(0, 4)}… (length ${token.length})\n`);
} else if (action === 'create') {
  const name = rest.find((item) => !item.startsWith('--') && item !== valueOf('--description'));
  if (!name) {
    process.stderr.write('create needs a repository name\n');
    process.exit(2);
  }
  const res = await api('POST', '/user/repos', {
    name,
    description: valueOf('--description') ?? 'Arabic (RTL) locale and layout support for the DeepSeek Harness Web GUI',
    private: flag('--private'),
    has_issues: true,
    has_wiki: false,
    has_projects: false,
    auto_init: false,
  });
  if (res.status === 201) {
    process.stdout.write(`created: ${res.body.full_name}\n`);
    process.stdout.write(`url:     ${res.body.html_url}\n`);
    process.stdout.write(`clone:   ${res.body.clone_url}\n`);
    process.stdout.write(`private: ${res.body.private}\n`);
  } else {
    process.stdout.write(`POST /user/repos -> ${res.status}: ${JSON.stringify(res.body)}\n`);
    process.exit(1);
  }
} else if (action === 'ensure') {
  const name = rest.find((item) => !item.startsWith('--') && item !== valueOf('--description'));
  if (!name) {
    process.stderr.write('ensure needs a repository name\n');
    process.exit(2);
  }
  const owner = rest.includes('--owner') ? valueOf('--owner') : null;
  const me = owner ?? (await api('GET', '/user')).body.login;
  const existing = await api('GET', `/repos/${me}/${name}`);
  if (existing.status === 200) {
    process.stdout.write(`exists:  ${existing.body.full_name}\n`);
    process.stdout.write(`url:     ${existing.body.html_url}\n`);
    process.stdout.write(`clone:   ${existing.body.clone_url}\n`);
    process.stdout.write(`private: ${existing.body.private}\n`);
    process.exit(0);
  }
  if (existing.status !== 404) {
    process.stdout.write(`GET /repos/${me}/${name} -> ${existing.status}: ${JSON.stringify(existing.body)}\n`);
    process.exit(1);
  }
  const created = await api('POST', '/user/repos', {
    name,
    description: valueOf('--description') ?? 'Arabic (RTL) locale and layout support for the DeepSeek Harness Web GUI',
    private: flag('--private'),
    has_issues: true,
    has_wiki: false,
    has_projects: false,
    auto_init: false,
  });
  if (created.status !== 201) {
    process.stdout.write(`POST /user/repos -> ${created.status}: ${JSON.stringify(created.body)}\n`);
    process.exit(1);
  }
  process.stdout.write(`created: ${created.body.full_name}\n`);
  process.stdout.write(`url:     ${created.body.html_url}\n`);
  process.stdout.write(`clone:   ${created.body.clone_url}\n`);
  process.stdout.write(`private: ${created.body.private}\n`);
} else if (action === 'repo') {
  const slug = rest[0];
  if (!slug) {
    process.stderr.write('repo needs owner/name\n');
    process.exit(2);
  }
  const res = await api('GET', `/repos/${slug}`);
  if (res.status !== 200) {
    process.stdout.write(`GET /repos/${slug} -> ${res.status}\n`);
    process.exit(1);
  }
  process.stdout.write(`full_name:      ${res.body.full_name}\n`);
  process.stdout.write(`default_branch: ${res.body.default_branch}\n`);
  process.stdout.write(`size:           ${res.body.size} KB\n`);
  process.stdout.write(`pushed_at:      ${res.body.pushed_at}\n`);
  process.stdout.write(`visibility:     ${res.body.visibility}\n`);
} else if (action === 'runs') {
  const slug = rest[0];
  const res = await api('GET', `/repos/${slug}/actions/runs?per_page=3`);
  if (res.status !== 200) {
    process.stdout.write(`GET runs -> ${res.status}: ${JSON.stringify(res.body)}\n`);
    process.exit(1);
  }
  if (res.body.total_count === 0) {
    process.stdout.write('no workflow runs yet\n');
  }
  for (const run of res.body.workflow_runs ?? []) {
    process.stdout.write(`${run.name} #${run.run_number}: ${run.status}${run.conclusion ? ` / ${run.conclusion}` : ''}  ${run.html_url}\n`);
  }
} else if (action === 'release') {
  const slug = rest[0];
  const tag = rest[1];
  if (!slug || !tag) {
    process.stderr.write('release needs owner/name and a tag\n');
    process.exit(2);
  }
  const zipPath = valueOf('--zip');
  const created = await api('POST', `/repos/${slug}/releases`, {
    tag_name: tag,
    name: valueOf('--name') ?? tag,
    body: valueOf('--notes') ?? '',
    draft: false,
    prerelease: false,
  });
  if (created.status === 422 && /already_exists/u.test(JSON.stringify(created.body))) {
    process.stdout.write(`release ${tag} already exists\n`);
    process.exit(0);
  }
  if (created.status !== 201) {
    process.stdout.write(`POST /releases -> ${created.status}: ${JSON.stringify(created.body)}\n`);
    process.exit(1);
  }
  process.stdout.write(`release created: ${created.body.html_url}\n`);

  if (zipPath) {
    const fileName = zipPath.split(/[\\/]/u).pop();
    const file = readFileSync(zipPath);
    const boundary = `----dshArRtl${Date.now().toString(16)}`;
    const head = Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${fileName}"\r\n` +
        `Content-Type: application/zip\r\n\r\n`,
      'utf8',
    );
    const tail = Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8');
    const payload = Buffer.concat([head, file, tail]);

    const uploaded = await new Promise((resolve, reject) => {
      const req = request(
        {
          host: 'uploads.github.com',
          path: `/repos/${slug}/releases/${created.body.id}/assets?name=${encodeURIComponent(fileName)}`,
          method: 'POST',
          headers: {
            'User-Agent': 'dsh-ar-rtl-publisher',
            Accept: 'application/vnd.github+json',
            Authorization: `Bearer ${token}`,
            'Content-Type': `multipart/form-data; boundary=${boundary}`,
            'Content-Length': payload.length,
          },
        },
        (res) => {
          let data = '';
          res.setEncoding('utf8');
          res.on('data', (chunk) => {
            data += chunk;
          });
          res.on('end', () => {
            let parsed = null;
            try {
              parsed = data ? JSON.parse(data) : null;
            } catch {
              parsed = data;
            }
            resolve({ status: res.statusCode, body: parsed });
          });
        },
      );
      req.on('error', reject);
      req.write(payload);
      req.end();
    });

    if (uploaded.status === 201) {
      process.stdout.write(`asset uploaded: ${uploaded.body.name} (${uploaded.body.size} bytes)\n`);
      process.stdout.write(`download:       ${uploaded.body.browser_download_url}\n`);
    } else {
      process.stdout.write(`asset upload -> ${uploaded.status}: ${JSON.stringify(uploaded.body)}\n`);
      process.exit(1);
    }
  }
} else {
  process.stderr.write(`unknown action: ${action}\n`);
  process.exit(2);
}
