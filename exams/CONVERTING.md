# Converting a form into an exam

The file format is documented in the repo README under "Adding a new exam".
This is the procedure and the standard the existing forms were built to. Read
it before starting a new one.

The work is transcription, not authorship. Everything in `data.js` should be
what the form says, and anything that is not — a filled gap, a repaired typo, a
key you had to derive — gets reported to whoever asked for the exam.

## 1. Intake

Best sources first: a text transcription, then a PDF, then screenshots. If the
source is a PDF, read it directly at high zoom rather than screenshotting it.

For screenshots, use `tools/shotpack` (see its README). Shots named
`iNNN-pNN.png` group themselves. If they are not named that way, work out the
grouping first: every NBME screen prints its item number, so read the number
off each shot, rename them to the convention, and only then pack. Guessing the
grouping from file order gets items silently interleaved.

Read the packer's report before going further. `MISSING items` and
`no overlap found` both mean part of the form was never captured — recapture
those items instead of building around the gap.

## 2. Transcribe verbatim

Copy the stem, the choices and the explanation exactly. No paraphrasing, no
shortening, no tidying of clinical phrasing, no reordering of choices.

**Keep the form's own numbers, even wrong ones.** Psychiatry Form 3 item 44
prints an erythrocyte count of 3500/mm³, three orders of magnitude below
anything plausible. It is in `data.js` as 3500/mm³ because that is what the
candidate sees on the real form; a corrected value would be a different
question. Flag it in your report instead.

Normalize typography only, never meaning:

| fix | to |
| --- | --- |
| `mg/dl`, `mEq/l` | `mg/dL`, `mEq/L` |
| `/mm3`, `um3`, `µm3` | `/mm³`, `µm³` |
| `u/mL`, `uU/mL` | `µU/mL` |
| `(N=S-50)`, `(N:$0.44)` | `(N=5–50)`, `(N≤0.44)` |
| `36. 7°C`, `39.4 °C` | `36.7°C`, `39.4°C` |
| `S 1 and S 2` | `S1 and S2` |
| `y-Glutamyltransferase` | `γ-Glutamyltransferase` |
| `MAOls`, `SSRls`, `lmipramine` | `MAOIs`, `SSRIs`, `Imipramine` |
| `hypothyroid ism`, `a 2month history` | `hypothyroidism`, `a 2-month history` |

Two OCR traps worth naming: a lowercase `l` standing in for a capital `I` at
the start of drug names, and the digit `7` dropping out of a PDF text layer
entirely (it came through as `?` in Psychiatry Form 3, in ages, durations and
lab values alike). When a character is unreadable, go back to the image at high
zoom. Do not infer it from context.

## 3. Stems that carry a table

An item whose stem contains a lab or vital-sign table splits in three: `stem`
ends with the lead-in ("Laboratory studies show:"), `labs` holds the table, and
`stemTail` carries the prose after it — usually the actual question sentence.

- A group with a heading in the source ("Serum", "Urine", "Arterial blood gas")
  becomes a `name`; a table with columns ("On admission" / "Now") gets a `head`.
- Two tables printed side by side merge into one `labs` array as named groups.
- Every row in a group needs the same number of cells.
- A row the form indents under the row above it — a leukocyte differential
  beneath its leukocyte count, a CSF differential beneath its WBC — carries two
  leading spaces per level on its label: `["  Bands", "5%"]`. The spaces are
  layout, not content; the page renders the label without them. Indent only
  what the form indents, and only under a row that is really its parent.
- A sentence is not a group name. Medicine Form 7 item 30 lost its question
  sentence that way, parsed as a heading with no rows beneath it. If a "group"
  has no rows, it is prose — put it in `stemTail`.

Where the choices themselves are a small table (a row of values per choice),
join each row into one string per choice so the letters still line up.

## 4. Matched sets

Two items sharing one list of choices both carry `lead` (the shared
instruction, drawn above the choices) and `setNote` (the notice above the
item). Word the notice by item number, not "the next 2 items", since either
one can be reached first from the grid:

    "Items 33 and 34 share these response options. Select one answer for each."

## 5. Exhibits

Save each as `exams/<slug>/images/qNN.png`, add it to `IMAGES` under the key
`qNN`, and point the item's `image` field at that key. Files, not base64.

## 6. Explanations

Only `<p>` and `<b>` are allowed, and `<`, `>` and `&` must be escaped —
`&lt;7%`, `&gt;40 mg/dL`, `&amp;`. An unescaped `<` swallows everything up to
the next `>` when the page renders.

Two house styles, and the source decides which:

- **Objective first** — `<p class="exp-obj">Educational Objective: …</p>`
  followed by the discussion. Use it when the source prints an Educational
  Objective line, wherever on the page it appears; it moves to the front.
  Twenty of the current forms are this style.
- **Plain paragraphs** — no objective line in the source (Medicine Forms 3–6,
  Surgery Forms 3–6).

Do not mix the two inside one form.

If the source has no explanation for an item, write one in that form's own
style and voice, and **say which items you wrote** in your report. Medicine
Form 9 item 36 and Medicine Form 6 item 30 are single items filled that way.

Written text is also marked on the page, so a reader knows which part of an
explanation is not the form's. The last paragraph of such an item carries the
provenance line, which `assets/exam.css` draws quietly under a rule:

    <p class="exp-note">Part of this explanation written by AI, not transcribed from the form.</p>

Two wordings, and the item decides: "Part of this explanation" where the form
printed some of it, "Explanation" where the item had none at all. The line goes
last, after the incorrect-answer paragraphs, and only on items that actually
carry written text — an item transcribed whole never gets one. Neurology Form 7
names the piece instead ("Educational objective written by AI"), which is what
was missing there.

Neurology Form 7 is the large case, and worth reading before doing the same
again. Seventeen of its 50 answer screenshots stop at the source app's
navigation bar partway down the page, so those items reached the repo with no
Educational Objective, and item 34 with no paragraph defending its answer at
all. Written rather than transcribed there: the objectives for items 3, 6, 7,
13, 14, 19, 22, 23, 26, 30, 31, 34, 38, 39, 40, 48 and 49; item 34's
discussion; and the ends of four sentences the screenshot cut mid-phrase, in
items 23, 39, 49 and item 33's objective, the last of which is the form's own
wording recovered from the identical sentence in its discussion. Each written
objective summarises the discussion that item already carries, so the gap was
filled from the item's own reasoning wherever the item still had any; item 34
is the exception and is written from the stem, the exhibit and the paragraph
ruling out the other choices. That is roughly 5% of the form's explanation
text. None of it is recoverable by re-reading the file we have (the material
is absent from the source PDF), so only a fresh capture of the form can
replace it with what the form actually prints.

Obstetrics and Gynecology Form 10 is the larger case, and a different shape of
loss: its capture stops partway down every answer page, so the discussion of
the correct answer survives but the incorrect-answer paragraphs mostly do not.
Forty-nine of its 50 items carry written text — 111 choice paragraphs, the
whole of item 21, the end of a cut sentence in twelve others, and the rest of
the discussion in items 30 and 44 — and each of those items carries the note
line. Only item 37 came through complete. The
keys are unaffected: 46 items still print an intact "Incorrect Answers" line
that agrees with the discussion, and the other four are argued for in the
discussion itself.

## 7. The answer key

Derive the key from what each explanation actually argues, then compare it
against any printed key. Where they disagree, the reasoning wins and the
disagreement goes in your report.

The strongest check is the "Incorrect Answers" section: the letters it rules
out plus the one it defends should account for every choice. If a letter is
both defended and ruled out, or none is defended, the header is wrong.

This is not hypothetical. In Medicine Form 9 the printed `Correct Answer`
headers for items 8, 27 and 32 were rotated onto the wrong items and item 4's
was simply wrong; the other 45 agreed. The key in the repo came from the
explanation bodies.

## 8. Verify before committing

    node tools/verify-exam.mjs <slug>

It checks the manifest against the data, every item's choices, key and
exhibit, the shape of the lab tables, and the HTML rules above — then, if
Playwright is installed, serves the site and answers all 50 items from the key
in Chromium, expecting 100% and a clean console.

Then look for capture damage, which a well-formed file hides:

    node tools/scan-ocr.mjs <slug>

It reads the exam against the vocabulary of every other exam, so a word split
in this form is still vouched for by the forms that spell it correctly. What it
catches, all of it found in exams already in the repo:

| looked like | was |
| --- | --- |
| `mi ldly`, `chi ld's`, `fe atures` | a word cut in two by a stray space |
| `withincreased`, `firstline` | two words run together |
| `corre,cting`, `block,ers` | a stray comma inside a word |
| `syndrom1e` | a digit dropped inside a word |
| `~-globin`, `y-aminobutyric`, `B-adrenergic` | β, γ, β |
| `brachia!`, `Fallo!`, `(MAO!)` | a word-final l, t, I |
| `CS and C6`, `CB to T1` | C5, C8 |
| `lmipramine`, `lgA`, `type Il` | Imipramine, IgA, type II |

The findings are advisory — `~` really does mean "approximately" in a few
places, dialogue really does end in "!", and some flagged words are simply
rare. Read each one against the form.

It also reports runs of three or more consecutive words no exam has ever used.
Prose does not do that, so a run means the page was captured badly. Those are
the ones to flag rather than repair, where a degraded font turned g into a, y
into v, p into n and u into ii — "Meaciirament of seriim nralactin
cancentratian" for "Measurement of serum prolactin concentration". Two exams
still carry such passages:

- psychiatry Form 7, explanations 21 and 22
- obgyn Form 7, explanation 44 ("preanancy")

Leave them alone. The substitution is regular enough to guess at, and a guess
is invented content: only a fresh capture of those pages can fix them.

obgyn Form 8 carried nine of these and no longer does: a second capture of the
same form arrived and its clean text replaced them. That is the way out of a
degraded page — another capture, not a guess. Merging the two was worth doing
carefully, because each capture had lost different lines: the explanations were
rebuilt section by section, taking whichever capture had fewer words the other
exams' vocabulary did not recognise, and preferring the one that still
addressed every ruled-out choice. Both captures lost the same clause in item
41, which is still missing, and both agreed on the answer key for all 50 items,
which is the strongest confirmation of a key the repo has.
Psychiatry Form 4 has one of its own — "propranolol's 6. antagonism", where
the 6 is a β and the form has to say whether a subscript follows.

Do the reading checks by hand as well:

- Diff your text against the source word by word, not by eye. Unescape the
  HTML first, or the diff will hide exactly the characters most likely wrong.
- Open two or three items in the browser and read them against the source
  image, including one with a lab table and one exhibit.

If Playwright is not available, run the structural half and say the browser
check was skipped.

## 9. Register and commit

Add the manifest entry (`slug`, `id`, `title`, `label`, `items`), keeping `id`
unique so saved progress does not collide. Follow the existing conventions
exactly — the landing page groups the list by subject, and it takes the subject
from the title:

    slug:  "neurology-form9"                  folder name, and the ?exam= value
    id:    "neurology_practice_exam_form9"    subject_practice_exam_formN
    title: "Neurology Practice Exam"          the subject panel is named from this
    label: "CMS Form 9"
    items: 50

A subject that is not in the list yet needs no code: the first exam titled
"Neurology Practice Exam" grows its own panel on the landing page.

Commit the exam on its own. Say in the message what the form is and anything a
reader would want to know without opening the file: keys you derived rather
than copied, explanations you wrote, values that look wrong but are the form's.

Never commit raw screenshots — `tools/shotpack/shots/` and `packed/` are
gitignored for that reason.

## 10. Never

- Never invent a clinical value, a choice, or an explanation presented as the
  form's.
- Never "correct" a number the form prints. Report it.
- Never drop an item you could not read. Say which one and why.
- Never guess a key letter to make the count come out at 50.
