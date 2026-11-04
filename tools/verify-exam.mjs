// Check one exam before it is committed.
//
//   node tools/verify-exam.mjs psychiatry-form3
//
// Structural checks always run. If Playwright is installed it also serves the
// site, answers every item from the answer key in Chromium, and expects a
// perfect score with a clean console — which catches broken HTML in an
// explanation, a missing exhibit and a manifest that disagrees with the data.
// It does that twice: once in exam mode, and once in tutor mode, checking each
// item (each set as one) and expecting its answer and explanation to show.

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
  // Choices that are a row of values carry one heading per column, and the
  // engine draws the head row only when the counts agree — so a miscount is
  // silent on the page. Catch it here.
  if (q.choiceHead) {
    const widths = new Set((q.options || []).map(([, t]) => t.split(' · ').length));
    if (!Array.isArray(q.choiceHead) || q.choiceHead.length < 2)
      fail(`${at}: choiceHead is not a list of column headings`);
    else if (widths.size > 1)
      fail(`${at}: choiceHead, but the choices split into ${[...widths].join('/')} values`);
    else if (![...widths][0] || [...widths][0] !== q.choiceHead.length)
      fail(`${at}: ${q.choiceHead.length} column headings for ${[...widths][0]} value(s) per choice`);
  }
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

// Tutor mode checks a set as one unit, and the engine finds a set as the run
// of neighbouring items that print the same notice. A notice on one item
// alone, or on items with others between them, would leave a set that tutor
// mode checks one item at a time — and the first item's explanation would
// hand over the second item's answer. The notice also names its items, so it
// has to name the ones it actually sits on.
const units = [];
questions.forEach((q, i) => {
  const prev = questions[i - 1];
  if (q.setNote && prev && prev.setNote === q.setNote) units[units.length - 1].push(q.n);
  else units.push([q.n]);
});
const runsByNote = new Map();
for (const u of units) {
  const note = questions.find((q) => q.n === u[0]).setNote;
  if (!note) continue;
  if (u.length < 2) fail(`item ${u[0]}: setNote, but no neighbouring item prints the same notice`);
  const named = (note.match(/\d+/g) || []).map(Number);
  if (named.join(',') !== u.join(','))
    fail(`items ${u.join(', ')}: the set's notice names item(s) ${named.join(', ') || 'none'}`);
  runsByNote.set(note, (runsByNote.get(note) || 0) + 1);
}
for (const [note, runs] of runsByNote)
  if (runs > 1) fail(`the notice "${note.slice(0, 40)}…" is on items that are not neighbours`);
const unitOf = (n) => units.find((u) => u.includes(n));

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
    // A CommonJS build imports with its exports on `default`, and one that
    // loads but carries no browser is no reason to stop looking.
    const mod = await import(target);
    chromium = mod.chromium || (mod.default && mod.default.chromium) || null;
    if (chromium) break;
  } catch { /* try the next one */ }
}
if (!chromium) console.log('note: Playwright not installed, skipping the browser run');

if (chromium) {
  const port = 8000 + Math.floor(Math.random() * 900);
  const server = spawn('python3', ['-m', 'http.server', String(port)], { cwd: root, stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 900));
  const browser = await chromium.launch();

  /* One block, worked from the key in the mode named. Each run has a context
     of its own, which is its own storage: the start screen offers whichever
     mode was chosen last, and one run's choice must not become the other's. */
  async function workBlock(mode) {
    const context = await browser.newContext();
    const page = await context.newPage();
    const noise = [];
    page.on('console', (m) => m.type() === 'error' && noise.push(m.text()));
    page.on('pageerror', (e) => noise.push('pageerror: ' + e.message));
    // Ending the block always asks first; the run means to end it.
    page.on('dialog', (d) => d.accept());
    try {
      await page.goto(`http://localhost:${port}/exam.html?exam=${slug}`);
      await page.check(`input[name="mode"][value="${mode}"]`);
      await page.click('#beginBtn');
      await page.waitForSelector('#qstem', { state: 'visible' });

      // A checked item shows its answer as a graded one does: the banner, and
      // the explanation where there is one. The check button has gone.
      const expectRevealed = async (n) => {
        const at = `tutor run, item ${n}`;
        if ((await page.textContent('#curItem')).trim() !== String(n))
          return fail(`${at}: expected to be on this item`);
        const cls = (await page.getAttribute('#gradedBanner', 'class')) || '';
        if (!/\bcorrect-banner\b/.test(cls)) fail(`${at}: checking it did not show a correct banner`);
        if (explanations[String(n)] && !(await page.isVisible('#explanation')))
          fail(`${at}: checked, but its explanation is not showing`);
        if (await page.isVisible('#checkRow')) fail(`${at}: the check button is still showing`);
      };

      for (let i = 1; i <= questions.length; i++) {
        const q = questions[i - 1];
        const idx = q.options.findIndex(([l]) => l === answerKey[String(i)]);
        await page.locator('#qoptions .opt').nth(idx).click();
        if (mode === 'tutor') {
          // a set waits for its last item, then reveals every item in it
          const unit = unitOf(q.n);
          if (unit[unit.length - 1] !== q.n) {
            if (!(await page.isDisabled('#checkBtn')))
              fail(`tutor run, item ${q.n}: Check is on before the rest of its set is answered`);
          } else {
            await page.click('#checkBtn');
            await expectRevealed(q.n);
            for (let k = unit.length - 2; k >= 0; k--) {
              await page.click('#prevBtn2');
              await expectRevealed(unit[k]);
            }
            for (let k = 1; k < unit.length; k++) await page.click('#nextBtn2');
          }
        }
        if (i < questions.length) await page.click('#nextBtn2');
      }
      await page.click('#reviewOpenBtn');
      // tutor mode keeps its running score on the review grid, not the subbar
      if (mode === 'tutor') {
        const tally = (await page.textContent('#summaryRow')).trim();
        const want = `${questions.length} of ${questions.length} correct so far`;
        if (tally !== want) fail(`tutor run: the running score reads "${tally}", not "${want}"`);
      }
      await page.click('#finishBtn');
      await page.waitForSelector('#resultsScreen', { state: 'visible' });
      await page.waitForTimeout(400);

      const pct = (await page.textContent('#scorePercent')).trim();
      console.log(`browser run, ${mode} mode: ${pct}`);
      if (pct !== '100%') fail(`${mode} run scored ${pct}, so the key and the choices disagree`);
      if (mode === 'tutor' && !/^Tutor mode/.test((await page.textContent('#scoreTime')).trim()))
        fail('tutor run: the results line does not name the mode');
      for (const n of noise) fail(`console (${mode} run): ${n}`);
    } finally {
      await context.close();
    }
  }

  try {
    await workBlock('exam');
    await workBlock('tutor');
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
