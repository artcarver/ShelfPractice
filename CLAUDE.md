# Working in this repo

A static site of NBME shelf practice exams, served from GitHub Pages. No build
step, no dependencies: `index.html` lists the exams, `exam.html` runs any one
of them, `assets/` holds the engine, and each exam is a folder under `exams/`
containing only content. `README.md` explains the structure.

## Building a new exam

The job that comes up most, and "build neurology form 9" means the whole of it.
Read `exams/CONVERTING.md` first: it is the standard the existing exams were
built to, and it names the traps that have actually bitten. `exams/CASES.md`
holds the precedents, to read when the form in front of you looks like one.

The source arrives one of two ways:

- **Screenshots**, in `tools/shotpack/shots/<slug>/` with the answer key beside
  them. Pack them with `tools/shotpack/pack.py`, and report what the packer
  flags — `MISSING items`, `no overlap found` — before building anything. Both
  mean part of the form was never captured, and the fix is a recapture.
- **A transcription**, questions in one file and answers in another.
  `exams/INTAKE.md` is the format to ask for and the prompt that produces it.
  Where the form prints a table and the intake did not describe its shape, ask
  for that page rather than guessing at it.

Either way: parse the source rather than retyping it; read every explanation
once before building anything; keep the repairs as a table of find-and-replace
pairs, since that table is what the commit message is written from; check the
key three ways in code, never by eye; build `exams/<slug>/data.js` and register
it in `exams/manifest.js`; verify with `node tools/verify-exam.mjs <slug>` and
`node tools/scan-ocr.mjs <slug>`; commit on a branch, never the screenshots.

Then report, every time: where each contested key came from, any explanation or
sentence you had to write and what you worked from, any value that looks
clinically wrong but is what the form prints, and anything you could not read.
The same goes in the commit message.

## House style

The question is the form's; the explanation is the site's to finish. Stems,
choices, lab values and answer letters come from the capture or they do not go
in, and the form's own mistakes stay in. Where the capture lost explanation
text, write the missing piece in that form's voice and name the item in the
exam's `WRITTEN` map — that is standing work, not something to stop and ask
about. The provenance wording lives in `assets/exam.js`, so every form says it
the same way and no `data.js` spells it out. Engine changes belong in
`assets/`, never in an exam's `data.js`, which carries content and nothing else
— no title, no id, no configuration. Keep explanations to `<p>` and `<b>` with
their angle brackets escaped, since they are injected as HTML.
