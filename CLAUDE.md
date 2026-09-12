# Working in this repo

A static site of NBME shelf practice exams, served from GitHub Pages. No build
step, no dependencies: `index.html` lists the exams, `exam.html` runs any one
of them, `assets/` holds the engine, and each exam is a folder under `exams/`
containing only content. `README.md` explains the structure.

## Building a new exam from screenshots

This is the job that comes up most. Screenshots of a form arrive in
`tools/shotpack/shots/<slug>/`, with the answer key beside them as
`answer-key.txt`. A request as short as "build neurology form 9" means the run
in `tools/shotpack/shots/neurology-form9/` and the whole procedure below.

1. **Read `exams/CONVERTING.md` first.** It is the standard the existing exams
   were built to, and it names the traps that have actually bitten: OCR
   look-alikes, tables parsed as prose, printed answer keys that were wrong.
2. **Pack the shots** with `tools/shotpack/pack.py` (its README covers the
   options). Captures made by hand are not named `iNNN-pNN.png` — read the item
   number printed on each screenshot and rename them to that convention first
   rather than guessing the grouping from file order. Tune `--crop` on two
   items before doing the rest.
3. **Report what the packer flags** — `MISSING items`, `no overlap found` —
   before building anything. Both mean part of the form was never captured, and
   the fix is a recapture, not a workaround.
4. **Build `exams/<slug>/data.js`** from the packed tiles, transcribing
   verbatim, then register the exam in `exams/manifest.js`.
5. **Verify** with `node tools/verify-exam.mjs <slug>` and fix what it reports.
6. **Commit on a branch.** Never commit the screenshots; `shots/` and `packed/`
   are gitignored.

Then report, every time: where each contested key came from, any explanation or
sentence you had to write and what you worked from, any value that looks
clinically wrong but is what the form prints, and anything you could not read.
The same goes in the commit message, since the page carries no provenance line.

## House style

The question is the form's; the explanation is the site's to finish. Stems,
choices, lab values and answer letters come from the capture or they do not go
in, and the form's own mistakes stay in. Where the capture lost explanation
text, write the missing piece in that form's voice and leave no seam or
disclaimer on the page — a candidate should be able to work the exam the way
they would work the form. Engine changes belong in `assets/`, never in an
exam's `data.js`, which carries content and nothing else — no title, no id, no
configuration. Keep explanations to `<p>` and `<b>` with their angle brackets
escaped, since they are injected as HTML.
