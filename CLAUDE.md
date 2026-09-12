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
The same goes in the commit message.

## Building a new exam from a text transcription

The other shape the source arrives in: a questions-and-choices file, an
answers-and-explanations file, and often a validation audit of the capture.
Text is the better source, but it has lost the layout, so where the form prints
a table — of choices, or of laboratory values — ask for the screenshot or the
PDF page as well. Pediatrics Form 8 cost two extra commits for want of them:
item 7's column headings were guessed, and item 26's "Hemoglobulin" was
"corrected" to a word the form does not print.

The order that is quickest and still holds the standard in `exams/CONVERTING.md`:

1. **Parse, do not retype.** Split the answer file on `Question N`, unwrap its
   hard-wrapped lines into paragraphs, and do the same for the question file.
   Writing 50 stems out by hand is the slowest part of the job and introduces
   errors of its own.
2. **Read every explanation once, in four or five passes, before building.**
   Page seams are what a parser cannot see: a sentence that stops mid-phrase, a
   paragraph repeated from the page above, a stray `z` or `S` where the app's
   chrome was captured, two paragraphs interleaved. Note them; fix nothing yet.
3. **Keep the fixes as a table of find-and-replace pairs per item**, applied to
   the parsed text. That table is the record of everything in the file that is
   not the form's own, and the commit message is written from it.
4. **Cross-check the key in code, not by eye:** the printed key list, each
   item's own `Correct Answer` header, and the letters its Incorrect Answers
   line rules out, which with the key should account for every choice. Where
   they disagree, CONVERTING.md §7 says which wins.
5. **Verify once at the end** — `node tools/verify-exam.mjs <slug>`, then
   `node tools/scan-ocr.mjs <slug>` — and diff your text against the source
   word by word. Every difference should be one you meant.

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
