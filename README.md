# ShelfPractice

A collection of self-contained, browser-based shelf practice exams. No server or build step required — everything runs as static files (works locally and on GitHub Pages).

## Structure

```
index.html          Landing page; builds its list from exams/manifest.js
exam.html           The exam page — one shell shared by every exam,
                    selected with ?exam=<slug>
assets/
  theme.css         Design tokens shared by every page
  exam.css          Exam page styles
  exam.js           Shared engine (navigation, grading, highlighting,
                    cross-outs, lab tables, saved progress)
  labvalues.css     Styles for the Lab Values reference panel
  labvalues.js      Lab Values data + panel (searchable, tabbed)
exams/
  manifest.js       The catalog: one entry per exam
  <subject>-form<N>/
    data.js         Questions, answer key, explanations — content only
    images/         Exhibit images, present only where the form has them
  CONVERTING.md     How a form becomes a data.js, and the standard to hold to
  INTAKE.md         The transcription format to ask a reading pass for
  CASES.md          What the damage in past captures turned out to be
tools/
  verify-exam.mjs   Checks one exam before it is committed
  scan-ocr.mjs      Looks for capture damage in the transcribed text
  shotpack/         Capture and stitch screenshots of a form (see its README)
```

One folder per exam, named for the subject and the form. What is on the shelf
now, which `manifest.js` is the authority on:

| Subject | Forms | With exhibits |
| --- | --- | --- |
| Family Medicine | 4, 5 | both 2 |
| Medicine | 3–10 | all 8 |
| Neurology | 4–9 | all 6 |
| Obstetrics & Gynecology | 4–8, 10 | all 6 |
| Pediatrics | 6–9 | all 4 |
| Psychiatry | 3–8 | 1 of 6 (Form 5, the Figure 1 / Figure 2 exhibit on item 48) |
| Surgery | 3–9 | all 7 |

Thirty-nine forms, 1,950 items.

## Design

`assets/theme.css` holds the tokens both pages load first: colour, four corner
radii, six type sizes, and the two or three primitives that appear on every
screen (the navy top bar and its brand, buttons, the keyboard caps). The
landing page and the exam page then describe only what is particular to them.
The scales are short on purpose — when something new needs a value it takes the
nearest step rather than adding one, which is what keeps the screens looking
like one product.

The brand mark is drawn inline in both pages rather than set as an emoji. It
appears at 18px beside the wordmark and at 16px in a browser tab, and at those
sizes a line drawing silts up while an emoji renders in whatever colour and
weight the platform chooses. So the mark is a solid tile — three graduated bars
for a shelf of forms — with the bars knocked out of it in the bar colour: the
weight sits in the tile and the detail comes from the gaps. The tile is what
keeps the bars from reading as a chart. The tab icon is the same shape with the
colours swapped, white bars on a navy tile, so it holds up on a light or a dark
tab strip.

A few conventions ride along with the tokens: panels and grouped lists use the
medium radius and a hairline `--divider` between rows, overlays use the large
one; buttons and headings are sentence case; and colour carries a fixed
meaning — green for correct, red for incorrect, grey for unanswered, violet
for marked. Unanswered is never shown in red, since it is not the same signal
as a missed answer.

**Rendering and exam content are fully separate.** Everything under `assets/`
plus `exam.html` is shared machinery and never changes when you add an exam.
Everything under `exams/` is content. `exam.html` merges an exam's catalog entry
from `manifest.js` with its `data.js` into `window.EXAM`, then hands that to the
engine — so the engine has no knowledge of any particular exam.

A **Pause** button in the toolbar (or the <kbd>Esc</kbd> key) stops the clock and
hides the question behind an overlay until you resume. The elapsed time is banked
rather than derived from a start timestamp, so paused time is excluded, the pause
survives a reload, and the clock stops for good once the block is graded.

The card covers the bar, so it restates where you are — the exam, the form and
the item — and how the block stands on one line: time, how many are answered,
and what that works out to an item. It is a glance, not a report; the figures
worth studying belong to the results screen. Leaving from here is a link rather
than a hunt for the back button, since everything is already saved.

A **Notes** button in the toolbar (or the <kbd>N</kbd> key) opens a small notes
window for the item you are on — somewhere to write out your reasoning while you
work the question. It floats over the question rather than sitting in the
column, so it never reflows what you are reading: drag it anywhere by its title
bar, resize it from the corner, and it stays where you put it as you move
between items and across reloads. On a phone it docks to the bottom of the
screen instead, since there is nowhere useful to drag to.

Notes are per item and are saved with the rest of your progress, so they survive
a reload and are still there during review; the toolbar button carries a dot
when the current item has one, the item grid marks noted items with a corner
fold, and **Download My Results** appends your notes to the file. Keystrokes
typed into the notepad never reach the exam — <kbd>A</kbd>–<kbd>E</kbd>,
<kbd>M</kbd> and <kbd>Esc</kbd> all stay ordinary text while you are writing.
The window stands down for the two screens it cannot belong to: the pause
overlay and the results screen.

The top bar names the exam you are in: the subject, and beside it the form as a
small tag — "Medicine · FORM 6". Past a dozen forms in a subject the title alone
stops telling you where you are, and the form is the half you cannot infer from
the questions in front of you, so it is the half that survives when the bar
runs out of room: below a laptop width the subject drops out and the tag stays.
The bar has room for one short line, so the title sheds its "Practice Exam"
suffix there; the start screen, the browser tab and the results screen all
still say it in full.

A **Text size** button in the toolbar sets how large the question text is
drawn — four steps from Small to Larger, or <kbd>−</kbd> and <kbd>+</kbd> to
step through them. It applies to what you read and not to the chrome: the stem
and its lab tables, the answer choices, the explanation, your notes and the Lab
Values table all take the setting, while the bar, the counters and the buttons
keep their own sizes, so the top bar cannot come apart at the largest step. The
size is a reading preference rather than progress through a block, so it is
saved on its own, outside any exam's state: it holds for every exam in the
browser and survives Start Over.

Some items come in **matched sets**: two questions that share one list of
choices and one instruction, the way the paper form prints them. Those items
carry a `setNote` and a `lead` — the notice sits in a box above the item and
the shared instruction directly above the choices it governs, which is where
the form puts it. A set can instead share a patient, one vignette printed above
two items that each keep their own choices; there is no instruction to draw
above those choices, so such a set carries only the notice, and the vignette is
repeated at the head of both stems, which is what each of the two screens
prints. Either way the notice names both items rather than saying "the next 2
items", since here you can arrive at either one from the grid.

Some items ask not for a phrase but for a set of values — a form prints those
choices as a small table, a heading over each column and a row to each choice.
`data.js` keeps such a choice as one string with `·` between its values, so the
letter, the key and the results file need no special case, and an item adds
`choiceHead` when the form heads those columns. The engine splits the string
back into cells and draws them as a table: the values in columns of equal
width, the headings in a head row above them. It only does so when every choice
yields the same number of cells, since a set that does not line up is prose
that happens to contain the separator. Two or three columns keep their shape on
a phone; four or more do not fit, so each value takes its own line named by the
heading that stood over it, or runs on with its separator where the form gives
no headings.

Previous and Next sit under the answer choices rather than at the far edges of
a wide window. After clicking a choice your hand is at the options column, and
the button that moves you on should be a short reach from there, not in the
opposite corner of the screen — so the bar spans the width but the row inside
it takes the column's measure, and Next lines up with the right edge of the
choices above it.

Lab Values, Notes and Text size each answer to their own toolbar button: the
button that opened a panel closes it again, and carries a lit background while
its panel is up. The item review overlay is the one exception — it covers the
bar, so it closes from its own **×** or <kbd>Esc</kbd>.

Keyboard shortcuts on the exam page: <kbd>←</kbd>/<kbd>→</kbd> change items,
<kbd>A</kbd>–<kbd>E</kbd> select an answer, <kbd>M</kbd> toggles "mark for
review", <kbd>N</kbd> opens or closes the notepad, <kbd>−</kbd>/<kbd>+</kbd>
step the text size, <kbd>Enter</kbd> begins or
resumes from the start screen, and
<kbd>Esc</kbd> closes the topmost layer (the text-size panel, then an enlarged
exhibit, then the review overlay) before pausing. Keystrokes aimed at a text field — like the Lab
Values search box — are left alone. Right-clicking an answer choice crosses
it out (same as the <b>ab</b> tab), and clicking an exhibit image enlarges
it. Once a block is graded the toolbar's Pause slot becomes
**Results**, which returns to the score screen from anywhere, and the item
review overlay gains "Back to Results" and "Go to first incorrect". A
**Next incorrect** button in the bottom bar steps through just the items
you missed (blanks included), wrapping at the end.

The results table gives each item a row: the number, the opening of its stem,
your answer against the key, the result, and how long you spent on it. Marking
is a violet flag on the row rather than a column of its own — the same signal
the item grid uses. It is shown and not offered as a control: the mark records
how the item felt while you were answering it, and marking it here, with the
key in front of you, would overwrite that with hindsight. A row with a note
carries the item grid's corner fold and expands in place to show what you
wrote.

Above the table, two kinds of filter. The state chips — All, Correct,
Incorrect, Unanswered — replace one another; **Marked** and **Has a note**
stack on top of whichever is showing, which is how you ask for the items you
missed that you had already marked. The table sorts by item, by result
(what needs attention first) or by time, and remembers the filter and the sort
you left it on. Its header stays put as the rows scroll under it, and its rows
are keyboard-operable.

Time is kept per item as well as per block, banked the same way, so it excludes
paused time and stops at the results screen. An item that ran well past the
block's own median is called out — the median rather than a fixed target, since
what counts as slow depends on how the block actually went. **Download My
Results** carries the per-item times and marks alongside your answers and notes.
Chrome that describes the current question — the item counter, Previous /
Next, the subbar and Lab Values — is hidden on the results screen, where
there is no question for it to refer to. Saved progress records which of
the two views was showing, so reloading mid-review returns to the item you
were reading rather than jumping to the score.

The start screen only appears when you arrive fresh. Reloading a tab you
are already working in goes straight back into the exam — the per-tab flag
lives in `sessionStorage`, so a reload keeps it while a new tab or a later
visit does not, and those still get the resume / start-over choice. Start
Over is a quiet text link rather than a button beside Resume, and it asks
for confirmation, since it throws away every answer.

The landing page groups the forms by subject, and each subject is a panel you
open rather than a heading you scroll past — past a dozen or so forms the list
had become a scroll rather than a choice, so the page opens as one row per
subject.
The panel's head carries the subject, how many forms are inside, and, only when
there is something to say, how many of them you have started or scored. Which
panels are open is remembered per browser, so you come back to the list you
left; nothing is open on a first visit.

Inside a panel each form gets a row: the form label, its question count, and —
only once you have touched it — where it stands, either "3 of 50 answered" or
the score. The row's action reads Start, Resume or Review to match. An
untouched exam says nothing rather than repeating "Not started" down the whole
list. It is all read from the same saved progress the engine writes, so no
exam's `data.js` is loaded to draw the page.

A row you have touched also carries a quiet **Clear**, which forgets that exam
entirely — answers, score, highlights and notes — and returns the row to Start.
It is the difference between Start Over inside an exam, which empties the
answers but leaves the exam started and still showing Resume, and wanting the
list to look as though you had never opened it. It asks before it does
anything, there is no undo, and an exam you have never opened has no button
since it has nothing to clear.

The exam page also loads `assets/labvalues.js` / `assets/labvalues.css`, which add a **Lab Values** button to the toolbar. It opens a searchable, tabbed reference panel (Serum / Cerebrospinal / Blood / Urine and BMI) that splits the screen beside the question. The lab-value data is shared across all exams — edit it once in `assets/labvalues.js`.

## Adding a new exam

Two steps: drop in a folder, add a line to the manifest.

1. **Create the folder** `exams/<slug>/` containing `data.js`, plus an
   `images/` folder if the exam has exhibits.

   ```js
   (() => {
   const QUESTIONS = [
     // {"n": 1, "image": null | "q04", "stem": "...",
     //  "options": [["A", "..."], ["B", "..."], ...]}
     //
     // An item whose stem contains a lab or vital-sign table splits in three:
     // "stem" ends with the lead-in ("Laboratory studies show:"), "labs" holds
     // the table, and "stemTail" is the prose that follows it.
     //
     // Two items that share one list of choices are a matched set. Both carry
     // "lead" (the shared instruction, drawn above the choices) and "setNote"
     // (the notice, drawn in a box above the item). Two items that share only a
     // patient carry "setNote" alone — there is no instruction above the
     // choices, since each item keeps its own — and repeat the vignette at the
     // head of both stems.
     //   "labs": [{"name": "Serum",                       // optional group heading
     //             "head": ["", "On admission", "Now"],   // optional header row
     //             "intro": "Serum studies show:",        // optional prose above
     //             "rows": [["Na+", "118 mEq/L"], ...]}]  // 2+ cells per row
     //
     // A group's "intro" is the paragraph the form prints above it, for a stem
     // that runs table, prose, table. It closes the table above and opens a new
     // one, so the stem keeps the order the form prints.
     //
     // Two leading spaces on a row's label nest it under the row above, the
     // way a form prints a differential under its leukocyte count:
     //   ["Leukocyte count", "19,200/mm³"], ["  Bands", "5%"]
     // The spaces are layout only; they never reach the page as text.
   ];
   const IMAGES = {
     // "q04": "images/q04.png"  — a path relative to this exam's folder, or an
     // inline "data:image/png;base64,..." URI. Keys are referenced by a
     // question's "image" field.
   };
   const ANSWER_KEY = {
     // "1": "C", "2": "A", ...
   };
   const EXPLANATIONS = {
     // "1": "<p class=\"exp-obj\">Educational Objective: …</p><p>…</p>"
     // Optional. Rendered as HTML below the choices once the block is graded.
   };
   const WRITTEN = {
     // "21": "all"  — items whose explanation carries text the capture did not
     // print, written in the form's voice instead. The value names how much:
     // "all", "part", "objective" or "objective+discussion". Optional; the
     // engine draws the provenance line from it, so the wording lives in
     // assets/exam.js and every form says it the same way.
   };
   window.EXAM_DATA = {
     questions: QUESTIONS,
     images: IMAGES,
     answerKey: ANSWER_KEY,
     explanations: EXPLANATIONS,
     written: WRITTEN
   };
   })();
   ```

   Note that `data.js` carries no title, subtitle or id — that all lives in the
   manifest, so an exam's content file is purely content.

2. **Register it** in `exams/manifest.js`:

   ```js
   {
     slug: "medicine-form1",   // must match the folder name
     id: "medicine_form1",     // unique; saved progress + results filename
     title: "Medicine Practice Exam",
     label: "CMS Form 1",      // shown next to the item count
     items: 50
   }
   ```

The landing page picks it up automatically, and it is reachable at
`exam.html?exam=medicine-form1`. Keep `id` unique so saved progress doesn't
collide between exams; the engine logs a console warning if `items` disagrees
with the number of questions actually in `data.js`.

Check the result before committing it:

```
node tools/verify-exam.mjs medicine-form1
```

That validates the manifest against the data, every item's choices, key,
exhibit and lab tables, and the HTML rules for explanations — and, where
Playwright is installed, answers the whole form from the key in Chromium and
expects a perfect score with a clean console.

`exams/CONVERTING.md` covers the other half: how a form gets turned into that
file in the first place, and the standard the existing exams were built to.
`tools/shotpack/` is for forms that only exist inside an app you cannot export
from, and turns a run of screenshots into per-item images to read back.

Every exam with exhibits keeps them as image files under its own `images/`
folder, referenced by relative path. The engine also accepts inline `data:`
URIs, but files are preferred: they keep `data.js` small enough to read and
diff, avoid the ~33% base64 overhead, and let git store each image once instead
of rewriting it into every revision of the data file.
