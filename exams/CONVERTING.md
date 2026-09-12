# Converting a form into an exam

The file format is documented in the repo README under "Adding a new exam".
This is the procedure and the standard the existing forms were built to. Read
it before starting a new one.

The work is mostly transcription, and the line runs between the question and
the explanation:

- **The question and its key are the form's, always.** The stem, the choices,
  the lab values and the answer letter are what the exam actually asks, so they
  come from the capture or they do not go in. There is no filling these.
- **The explanation is teaching material, and a gap in it is yours to close.**
  Captures lose the bottom of pages, cut sentences mid-phrase, and occasionally
  drop an answer screen entirely. Write what is missing in the form's own voice
  rather than shipping a hole.

Filling an explanation gap is ordinary work here, not a decision to escalate.
Do not stop to ask whether to write one — write it, mark it, and say so in the
commit message. What does need asking is anything that would change what the
exam asks: a key you cannot source, a stem or a choice the capture lost, an
item you could not read at all.

Marking is one line under the explanation, and §6 covers it. Everything else
that is not the form's — a repaired typo, a contested key, a value that looks
wrong but is printed — goes in the commit message and in the report to whoever
asked for the exam.

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
- A stem that prints a table, then a paragraph, then a second table keeps both
  in `labs` and hands the paragraph to the second group as its `intro`, which
  is drawn above that group and splits the table in two. Use it rather than
  moving the sentence: the point is that the stem reads in the order the form
  prints. Family Medicine Form 4 item 45 is the case in the repo — a
  blood-pressure table, the patient's medications and vital signs, then the
  serum studies. An `intro` ending in a lead-in ("Serum studies show:") does
  the work a `name` would, so the group needs no heading as well.
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

The other shape is two items sharing a *patient* rather than a list of choices:
one vignette printed above both, and each item keeping its own choices. There
is no shared instruction to draw above those choices, so such a set carries
`setNote` alone — a `lead` without a notice is still an error, since nothing
would say which items the instruction spans. The vignette itself goes at the
head of both stems, which is what each of the two screens prints. Family
Medicine Form 4 items 25 and 26 are the case in the repo:

    "Items 25 and 26 share this patient. Select one answer for each."

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

The key is the part that has to be the form's. Everything else in an
explanation is teaching material, and where the capture lost some of it — a
screenshot that stops partway down the page, a sentence cut mid-phrase, an item
whose answer screen never arrived — write the missing piece in that form's own
style and voice rather than leaving a hole. Match the register of the
paragraphs around it: the same vocabulary, the same length, the same habit of
naming a choice and then saying why it is wrong. Nobody needs to approve this;
it is the job.

Then mark the item, so a reader knows which part of an explanation is not the
form's. The item goes in the exam's `WRITTEN` map with the key that says how
much of it was written:

| key | drawn as |
| --- | --- |
| `all` | Explanation written by AI, not transcribed from the form. |
| `part` | Part of this explanation written by AI, not transcribed from the form. |
| `objective` | Educational objective written by AI, not transcribed from the form. |
| `objective+discussion` | Educational objective and discussion written by AI, not transcribed from the form. |

    const WRITTEN = {"11": "all", "47": "part"};

The wordings are in `assets/exam.js`, not in any exam, so every form says it
the same way and a new form gets the line by naming the item. `exam.css` draws
it quietly under a rule, last, after the incorrect-answer paragraphs. Mark only
items that actually carry written text — an item transcribed whole never gets
one — and let `verify-exam.mjs` catch a key the engine does not know, since an
unknown one draws nothing at all.

The commit message carries the detail the line cannot: which items you filled,
which sentences you completed, and what you worked from — the item's own
discussion, the stem, the exhibit.

Two forms in the repo are largely written this way, and both are worth reading
before doing the same again:

- **Neurology Form 7.** Seventeen of its 50 answer screenshots stop at the
  source app's navigation bar partway down the page, so those items arrived
  with no Educational Objective, and item 34 with no paragraph defending its
  answer at all. Written there: the objectives for items 3, 6, 7, 13, 14, 19,
  22, 23, 26, 30, 31, 34, 38, 39, 40, 48 and 49; item 34's discussion; and the
  ends of four cut sentences, in items 23, 39, 49 and item 33's objective — the
  last of which is the form's own wording, recovered from the identical
  sentence in its discussion. Each written objective summarises the discussion
  that item already carries, so the gap was filled from the item's own
  reasoning wherever the item still had any; item 34 is the exception, written
  from the stem, the exhibit and the paragraph ruling out the other choices.
  Roughly 5% of the form's explanation text.
- **Obstetrics and Gynecology Form 10.** A different shape of loss: the capture
  stops partway down every answer page, so the discussion of the correct answer
  survives but the incorrect-answer paragraphs mostly do not. Forty-nine of its
  50 items carry written text — 111 choice paragraphs, the whole of item 21,
  the end of a cut sentence in twelve others, and the rest of the discussion in
  items 30 and 44. Only item 37 came through complete. The keys are unaffected:
  46 items still print an intact "Incorrect Answers" line that agrees with the
  discussion, and the other four are argued for in the discussion itself.

Medicine Form 9 item 36, Medicine Form 6 item 30 and Family Medicine Form 5
item 11 are single items filled the same way.

## 7. The answer key

This is the one thing that cannot be written. Explanation prose can be
completed from the item's own reasoning; a key cannot, because the candidate is
graded against what the form answers and not against the literature. Every
letter in `ANSWER_KEY` has to come from the capture.

The capture says it in three places, and they do not always agree:

1. **The highlight on the review screen.** The source app draws the correct
   choice on a yellow band, whatever the text below it says. This is the
   strongest evidence there is, because it is the app's own record of the
   answer rather than prose about it.
2. **What the explanation argues.** Read the discussion and take the letter it
   defends.
3. **The printed `Correct Answer` header.** The weakest of the three — it is
   the one that has been wrong.

The check that ties them together is the "Incorrect Answers" section: the
letters it rules out plus the one it defends should account for every choice.
If a letter is both defended and ruled out, or none is defended, the header is
wrong.

None of this is hypothetical. In Medicine Form 9 the printed headers for items
8, 27 and 32 were rotated onto the wrong items and item 4's was simply wrong;
the other 45 agreed, and the key in the repo came from the explanation bodies.
Family Medicine Form 5 item 11 is the sharper case: the form served item 10's
answer screen a second time in its place, so the header reads `Correct Answer:
C` and the body is item 10's explanation word for word — but the highlight on
the review screen sits on A, and A is the key. Where the three disagree, take
them in the order above and say so in the commit message.

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
| `ill- defined`, `Guillain- Barre` | a hyphen broken at a line wrap |

The findings are advisory — `~` really does mean "approximately" in a few
places, dialogue really does end in "!", and some flagged words are simply
rare. Read each one against the form.

**A subscript usually comes through as a comma, and the scanner cannot see it**
because `T,` and `B,` are punctuation rather than words. Grep for them yourself:

| looked like | was |
| --- | --- |
| `vitamin B ,,`, `Vitamin B, (thiamine)` | B12, B1 |
| `FEV ,:FVC`, `decreased FT,` | FEV1:FVC, FT4 |
| `hemoglobin A,,`, `Hemoglobin Ay,` | hemoglobin A1c |
| `serum T, and T,`, `a pronounced S,,` | T3 and T4, S2 |
| `Determination oft:,. OD 450` | ΔOD 450 |

The sentence names which subscript it wants, and that is the only thing that
should decide it: "vitamin B, (thiamine)" is B1 because the form says thiamine,
"conversion of T, to T," runs T4 to T3 because that is the direction the
paragraph describes, and the pronounced `S,,` is S2 because the sentence is
about the pulmonic valve closing. Where the sentence does not name it, leave it.
Set the digits plain — `T4`, `B12`, `FEV1` — since that is how the repo already
spells them, 102 times against 11.

It also reports runs of three or more consecutive words no exam has ever used.
Prose does not do that, so a run means the page was captured badly, where a
degraded font turned g into a, y into v, p into n and u into ii —
"Meaciirament of seriim nralactin cancentratian" for "Measurement of serum
prolactin concentration".

**Look for a second pass before reading a single letter.** A degraded run is
usually the overlap between two screenshots of the same page, and the other
screenshot often rendered those same lines cleanly a paragraph later. Psychiatry
Form 7 explanations 21 and 22 both looked like the worst damage in the repo and
were nothing of the kind: each carried the same passage twice, once degraded and
once clean, spliced end to end. Deleting the degraded pass and its duplicate
left two explanations that are the form's own words from start to finish, and
1,292 characters shorter. Nothing had to be read at all. Search the explanation
for a phrase either side of the run before you do anything else.

The same splice arrives without any degraded text to announce it, and then only
the seam shows: a sentence that ends `.:` or `.;` and restarts mid-thought, a
list with no lead-in, a paragraph that repeats the four words it just said, or
the next item's stem pasted onto the end. Obgyn Form 7 carried six of these and
obgyn Form 5 one. Most resolve to a dropped sentence boundary or a duplicate
whose own paragraph survives intact further down — check that the choice is
still addressed somewhere before writing anything, since usually it is.

Failing that, the substitution is regular, so read it. Work out the mapping from
the words you are sure of — g becomes a, y becomes v, p becomes n, u becomes ii
— apply it across the run, and check the result against the item, since the
objective usually restates the discussion. A word the same sentence spells
correctly a clause away settles it outright: obgyn Form 7's "early in preanancy"
sits between two correct "pregnant"s, and its "0.4 ma daily" is a dose.
Family Medicine Form 5 item 47 needed the mapping itself — "frantmant natiante
maw avnarianna itshina far cavaral" is "treatment patients may experience
itching for several" — and the sentence still ran off the page a word short of
the "weeks" its own discussion supplies, so that item is marked as written and
the others are not. Reading a run is transcription; supplying a word the form
never printed is writing.

Where a splice leaves two readings and both scan, **let the item's own
Educational Objective decide**. It is the form compressing that same discussion
into three sentences, so when it names a number, that is the number the
discussion printed. obgyn Form 7 item 44 read "0.4 mg daily, starting at least
1 month prior to 1 to 3 months prior to conception" — two phrasings of the
folic acid timing pasted together, and both are in the literature. Its
objective says "Folic acid supplementation should begin 1 to 3 months prior to
conception", so the other half is the overlap. The item now says 1 to 3 months
in both places, which is the test: a resolution that leaves the item
disagreeing with itself is the wrong one. Choosing between two readings is not
transcription, so the item is marked.

Say in the commit message which runs you read and how. Leave one you cannot
read rather than filling it with something that merely scans, and leave a
splice that nothing in the item decides.

obgyn Form 8 carried nine of these and no longer does: a second capture of the
same form arrived and its clean text replaced them. That is the way out of a
degraded page — another capture, not a guess. Merging the two was worth doing
carefully, because each capture had lost different lines: the explanations were
rebuilt section by section, taking whichever capture had fewer words the other
exams' vocabulary did not recognise, and preferring the one that still
addressed every ruled-out choice. Both captures lost the same clause in item
41, which is still missing, and both agreed on the answer key for all 50 items,
which is the strongest confirmation of a key the repo has.
Psychiatry Form 4 had one of its own — "propranolol's 6. antagonism", where the
6 is a β and the mark after it is a subscript. It now reads β2, which is the
subscript the sentence argues for: it is about asthma, and it ends by saying the
drug "blocks the bronchodilatory effect of albuterol", a β2-agonist. That is as
far as a glyph should be pushed — the sentence had to name the subscript itself
before it could be restored.

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

Commit the exam on its own. The page says *that* an explanation was written;
the message says which part and what from, along with everything else a reader
would want to know without opening the file: where each contested key came
from, runs you read rather than transcribed, values that look wrong but are the
form's, and anything you could not read at all.

Never commit raw screenshots — `tools/shotpack/shots/` and `packed/` are
gitignored for that reason.

## 10. Never

- Never invent a clinical value, a stem, or a choice. These are what the
  candidate is asked about, and a written one asks a different question.
- Never write a key. Explanation prose can be completed; a letter cannot.
- Never guess a key letter to make the count come out at 50.
- Never "correct" a number the form prints. Report it.
- Never drop an item you could not read. Say which one and why.
- Never let written text contradict the form — not its key, not its stem, and
  not the argument the surviving paragraphs make.
