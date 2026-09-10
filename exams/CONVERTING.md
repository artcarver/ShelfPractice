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
  Seventeen of the current forms are this style.
- **Plain paragraphs** — no objective line in the source (Medicine Forms 3–6,
  Surgery Forms 3–6).

Do not mix the two inside one form.

If the source has no explanation for an item, write one in that form's own
style and voice, and **say which items you wrote** in your report. Medicine
Form 9 item 36 and Medicine Form 6 item 30 are the two that exist.

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
