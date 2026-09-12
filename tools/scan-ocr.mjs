// Look for capture damage across the exams.
//
//   node tools/scan-ocr.mjs              every exam
//   node tools/scan-ocr.mjs obgyn-form4  one exam
//
// verify-exam.mjs checks that an exam is well formed; this checks whether its
// text still reads like English. It finds the artifacts that survive a
// clean-looking transcription: a word split by a stray space, two words run
// together, a Greek letter flattened to "~" or "y", a word-final "l" read as
// "!", a digit read as a letter.
//
// Findings are advisory, not failures — "~" really does mean "approximately"
// in a few places, and some flagged words are simply rare. Read each one
// against the form before changing it, and never rewrite a passage you cannot
// read: exams/CONVERTING.md says to flag it instead.

import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const only = process.argv[2];

const allSlugs = readdirSync(path.join(root, 'exams'), { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .sort();
const slugs = allSlugs.filter((s) => !only || s === only);
if (!slugs.length) {
  console.error(only ? `no exam "${only}"` : 'no exams found');
  process.exit(2);
}

// ---- read every exam, and build a vocabulary from all of them --------------
// A word split in one form is still spelled correctly in the others, so the
// whole repo vouches for what a word should look like. Damage that appears in
// two forms is usually one source of damage copied twice.

const WORD = /[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ'-]*/g;
const texts = new Map();
const vocab = new Map();
const bump = (w) => vocab.set(w, (vocab.get(w) || 0) + 1);

for (const slug of allSlugs) {
  let src;
  try { src = readFileSync(path.join(root, 'exams', slug, 'data.js'), 'utf8'); }
  catch { continue; }
  const text = src.replace(/<[^>]+>/g, ' ').replace(/\\"/g, '"').replace(/\\n/g, ' ');
  texts.set(slug, text);
  for (const m of text.matchAll(WORD)) bump(m[0].toLowerCase());
}
const seen = (w) => vocab.get(w.toLowerCase()) || 0;

const findings = [];
const note = (slug, kind, detail, at) => findings.push({ slug, kind, detail, at });
const around = (text, i, j) => '…' + text.slice(Math.max(0, i - 55), j + 55).replace(/\s+/g, ' ') + '…';

// ---- patterns that are damage wherever they appear -------------------------

const PATTERNS = [
  ['greek',  /~-(globin|hCG|human|lactam|adrenergic|mimetic)|\by-(amino|glutam)|\bB-(adrenergic|lactam)\b|\ba ?[12]?-adrenergic\b/gi],
  ['bang',   /[a-z]![ ,.)]/g],
  ['unit',   /\b(m?g)\/dl\b|\bmEq\/l\b|\/mm ?3\b|\bkg\/m ?2\b|\b(copies|ng|U|µU)\/ml\b|\bmlU\/mL\b/g],
  ['sub',    /(?<![''])\b(vitamin B|[DHST]) [0-9]\b/gi],
  ['roman',  /\bIl\b|\btype Il\b/g],
  ['comma',  /[a-z],[a-z]/g],
  ['digit',  /\b[A-Za-z]{2,}[0-9][A-Za-z]+\b/g],
];

for (const slug of slugs) {
  const text = texts.get(slug);
  if (!text) continue;

  for (const [kind, re] of PATTERNS) {
    for (const m of text.matchAll(new RegExp(re.source, re.flags))) {
      if (kind === 'digit' && seen(m[0].replace(/[0-9]/g, '')) === 0) continue;
      note(slug, kind, m[0], around(text, m.index, m.index + m[0].length));
    }
  }

  // a word cut in two by a stray space: the join is a word the repo knows well,
  // and at least one half is a fragment it barely knows on its own
  const words = [...text.matchAll(WORD)];
  for (let i = 0; i < words.length - 1; i++) {
    const a = words[i][0], b = words[i + 1][0];
    if (words[i].index + a.length + 1 !== words[i + 1].index) continue;
    if (seen(a + b) >= 8 && Math.min(seen(a), seen(b)) <= 2) {
      note(slug, 'split', `${a} ${b} -> ${a}${b}`, around(text, words[i].index, words[i + 1].index + b.length));
    }
  }

  // two words run together
  for (const m of text.matchAll(/\bwith(?!in\b|out\b|draw|held|hold)([a-z]{4,})\b/g)) {
    if (seen(m[0]) <= 3 && seen(m[1]) >= 20) {
      note(slug, 'merged', `${m[0]} -> with ${m[1]}`, around(text, m.index, m.index + m[0].length));
    }
  }

  // three or more words in a row that no exam has ever used: prose does not do
  // this, so the page was captured badly and needs reading against the form
  let run = [];
  for (const m of words) {
    if (seen(m[0]) <= 1 && m[0].length >= 3) { run.push(m); continue; }
    if (run.length >= 3) note(slug, 'unreadable', `${run.length} words`,
      around(text, run[0].index, run.at(-1).index + run.at(-1)[0].length));
    run = [];
  }
  if (run.length >= 3) note(slug, 'unreadable', `${run.length} words`,
    around(text, run[0].index, run.at(-1).index + run.at(-1)[0].length));
}

// ---- report ----------------------------------------------------------------

if (!findings.length) {
  console.log(`${slugs.length} exam(s): nothing to look at.`);
  process.exit(0);
}

let last = null;
for (const f of findings) {
  if (f.slug !== last) { console.log(`\n## ${f.slug}`); last = f.slug; }
  console.log(`  ${f.kind.padEnd(11)} ${f.detail}`);
  console.log(`  ${' '.repeat(11)} ${f.at}`);
}

const counts = {};
for (const f of findings) counts[f.kind] = (counts[f.kind] || 0) + 1;
console.log('\n' + Object.entries(counts).map(([k, n]) => `${k} ${n}`).join(', '));
console.log('Advisory. Check each against the form; flag what you cannot read rather than rewriting it.');
