// Check one exam before it is committed.
//
//   node tools/verify-exam.mjs psychiatry-form3
//
// Structural checks always run. If Playwright is installed it also serves the
// site, answers every item from the answer key in Chromium, and expects a
// perfect score with a clean console — which catches broken HTML in an
// explanation, a missing exhibit and a manifest that disagrees with the data.

import { readFileSync } from 'node:fs';
import { spawn, execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';

const slug = process.argv[2];
if (!slug) {
  console.error('usage: node tools/verify-exam.mjs <slug>');
  process.exit(2);
}
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const problems = [];
const fail = (m) => problems.push(m);
function report() {
  if (!problems.length) return;
  console.log(`\n${problems.length} problem(s):`);
  for (const p of problems) console.log('  - ' + p);
  process.exit(1);
}

// ---- structural ------------------------------------------------------------

const evalFile = (file, globals) => {
  const src = readFileSync(path.join(root, file), 'utf8');
  const names = Object.keys(globals);
  // eslint-disable-next-line no-new-func
  new Function(...names, src)(...names.map((n) => globals[n]));
};

const win = {};
evalFile('exams/manifest.js', { window: win });
const entry = win.EXAMS.find((e) => e.slug === slug);
if (!entry) fail(`no manifest entry with slug "${slug}"`);

const data = {};
evalFile(`exams/${slug}/data.js`, { window: data });
const { questions, images, answerKey, explanations, written } = data.EXAM_DATA;

if (entry && entry.items !== questions.length)
  fail(`manifest says ${entry.items} items, data.js has ${questions.length}`);

const seen = new Set();
for (const q of questions) {
  const at = `item ${q.n}`;
  if (seen.has(q.n)) fail(`${at}: duplicate item number`);
  seen.add(q.n);
  if (!q.stem || q.stem.length < 20) fail(`${at}: stem missing or too short`);
  if (!Array.isArray(q.options) || q.options.length < 2) fail(`${at}: needs options`);
  const letters = (q.options || []).map(([l]) => l);
  const expected = letters.map((_, i) => String.fromCharCode(65 + i));
  if (letters.join('') !== expected.join('')) fail(`${at}: choices are ${letters.join('')}`);
  if (q.image && !images[q.image]) fail(`${at}: image "${q.image}" is not in IMAGES`);
  const key = answerKey[String(q.n)];
  if (!key) fail(`${at}: no answer key`);
  else if (!letters.includes(key)) fail(`${at}: key "${key}" is not one of ${letters.join('')}`);
  if (q.stemTail && !q.labs) fail(`${at}: stemTail without labs`);
  for (const g of q.labs || []) {
    if (!g.rows || !g.rows.length) fail(`${at}: a lab group has no rows`);
    const widths = new Set((g.rows || []).map((r) => r.length));
    if (widths.size > 1) fail(`${at}: lab rows are ragged (${[...widths].join('/')} cells)`);
    // Leading spaces on a row's label nest it under the row above: two per
    // level, and nothing to nest under on the first row of a group.
    let depth = 0;
    (g.rows || []).forEach((r, i) => {
      const lead = /^ +/.exec(String(r[0] ?? ''));
      const d = lead ? lead[0].length / 2 : 0;
      if (!Number.isInteger(d))
        fail(`${at}: lab row "${String(r[0]).trim()}" is indented ${lead[0].length} spaces, not a multiple of 2`);
      if (d > depth + 1)
        fail(`${at}: lab row "${String(r[0]).trim()}" skips an indent level`);
      if (d && i === 0) fail(`${at}: the first lab row of a group is indented, so it nests under nothing`);
      depth = d;
    });
    for (const r of g.rows || [])
      for (const c of r)
        if (/\s$/.test(String(c))) fail(`${at}: lab cell "${String(c).trim()}" has trailing whitespace`);
  }
  // A set that shares response options carries both: the notice, and the
  // instruction above the choices it governs. A set that shares only a patient
  // has no such instruction, so setNote stands on its own — but a lead with no
  // notice is an instruction with nothing to say which items it spans.
  if (q.lead && !q.setNote) fail(`${at}: lead without setNote`);
}

for (const n of Object.keys(answerKey))
  if (!seen.has(Number(n))) fail(`answer key has item ${n}, which has no question`);

const missingExp = questions.filter((q) => !explanations[String(q.n)]).map((q) => q.n);
if (missingExp.length) console.log(`note: no explanation for item(s) ${missingExp.join(', ')}`);

// The provenance note is drawn by the engine from this map, so a key it does
// not know draws nothing at all — silently, on a page that should be saying
// the text was written. Catch it here instead.
const WRITTEN_KINDS = ['all', 'part', 'objective', 'objective+discussion'];
for (const [n, kind] of Object.entries(written || {})) {
  if (!seen.has(Number(n))) fail(`written names item ${n}, which has no question`);
  else if (!explanations[n]) fail(`written names item ${n}, which has no explanation to mark`);
  if (!WRITTEN_KINDS.includes(kind))
    fail(`written item ${n}: "${kind}" is not one of ${WRITTEN_KINDS.join(', ')}`);
}

// Explanations may use only <p> and <b>, and must escape their own angle brackets.
for (const [n, html] of Object.entries(explanations || {})) {
  const tags = [...html.matchAll(/<\/?([a-zA-Z][\w-]*)/g)].map((m) => m[1].toLowerCase());
  const bad = [...new Set(tags)].filter((t) => t !== 'p' && t !== 'b');
  if (bad.length) fail(`explanation ${n}: uses <${bad.join('>, <')}>`);
  const stripped = html.replace(/<\/?[pb](\s[^>]*)?>/g, '');
  if (/[<>]/.test(stripped)) fail(`explanation ${n}: unescaped < or > (use &lt; / &gt;)`);
  if (/&(?!amp;|lt;|gt;|quot;|#\d+;|[a-z]+;)/.test(html)) fail(`explanation ${n}: bare &`);
}

console.log(`${slug}: ${questions.length} items, ${Object.keys(explanations || {}).length} explanations, ${Object.keys(images || {}).length} exhibits, ${Object.keys(written || {}).length} marked as written`);

// A key or a choice list that is already wrong makes the browser run
// meaningless, so stop here and let it be fixed first.
if (problems.length) report();

// ---- in a browser ----------------------------------------------------------

let chromium = null;
const candidates = ['playwright', process.env.PLAYWRIGHT_PATH];
try {
  candidates.push(execSync('npm root -g', { encoding: 'utf8' }).trim() + '/playwright/index.mjs');
} catch { /* npm not on PATH */ }
for (const spec of candidates.filter(Boolean)) {
  try {
    const require = createRequire(import.meta.url);
    let target = spec;
    try { target = require.resolve(spec); } catch { /* an absolute path is fine as-is */ }
    ({ chromium } = await import(target));
    break;
  } catch { /* try the next one */ }
}
if (!chromium) console.log('note: Playwright not installed, skipping the browser run');

if (chromium) {
  const port = 8000 + Math.floor(Math.random() * 900);
  const server = spawn('python3', ['-m', 'http.server', String(port)], { cwd: root, stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 900));
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const noise = [];
    page.on('console', (m) => m.type() === 'error' && noise.push(m.text()));
    page.on('pageerror', (e) => noise.push('pageerror: ' + e.message));
    await page.goto(`http://localhost:${port}/exam.html?exam=${slug}`);
    await page.click('#beginBtn');
    await page.waitForSelector('#qstem', { state: 'visible' });

    for (let i = 1; i <= questions.length; i++) {
      const letter = answerKey[String(i)];
      const idx = questions[i - 1].options.findIndex(([l]) => l === letter);
      await page.locator('#qoptions .opt').nth(idx).click();
      if (i < questions.length) await page.click('#nextBtn2');
    }
    await page.click('#reviewOpenBtn');
    await page.click('#finishBtn');
    await page.waitForSelector('#resultsScreen', { state: 'visible' });
    await page.waitForTimeout(400);

    const pct = (await page.textContent('#scorePercent')).trim();
    const frac = (await page.textContent('#scoreFrac')).trim();
    console.log(`browser run: ${pct} (${frac})`);
    if (pct !== '100%') fail(`browser run scored ${pct}, so the key and the choices disagree`);
    for (const n of noise) fail(`console: ${n}`);
  } catch (err) {
    fail(`browser run did not finish: ${err.message.split('\n')[0]}`);
  } finally {
    await browser.close();
    server.kill();
  }
}

// ---- verdict ---------------------------------------------------------------

report();
console.log('\nAll checks passed.');
