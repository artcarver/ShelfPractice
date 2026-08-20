# ShelfPractice

A collection of self-contained, browser-based shelf practice exams. No server or build step required — everything runs as static files (works locally and on GitHub Pages).

## Structure

```
index.html          Landing page; builds its list from exams/manifest.js
exam.html           The exam page — one shell shared by every exam,
                    selected with ?exam=<slug>
assets/
  exam.css          Shared styles
  exam.js           Shared engine (navigation, grading, highlighting,
                    cross-outs, lab tables, saved progress)
  labvalues.css     Styles for the Lab Values reference panel
  labvalues.js      Lab Values data + panel (searchable, tabbed)
exams/
  manifest.js       The catalog: one entry per exam
  psychiatry-form8/
    data.js         Questions, answer key, explanations (no exhibits)
  psychiatry-form7/
    data.js
  surgery-form9/
    data.js         Questions, images, answer key, explanations
    images/         Exhibit images, referenced by relative path
  surgery-form8/
    data.js
    images/
  surgery-form7/
    data.js
    images/
  surgery-form6/
    data.js
    images/
```

**Rendering and exam content are fully separate.** Everything under `assets/`
plus `exam.html` is shared machinery and never changes when you add an exam.
Everything under `exams/` is content. `exam.html` merges an exam's catalog entry
from `manifest.js` with its `data.js` into `window.EXAM`, then hands that to the
engine — so the engine has no knowledge of any particular exam.

A **Pause** button in the toolbar (or the <kbd>Esc</kbd> key) stops the clock and
hides the question behind an overlay until you resume. The elapsed time is banked
rather than derived from a start timestamp, so paused time is excluded, the pause
survives a reload, and the clock stops for good once the block is graded.

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

Keyboard shortcuts on the exam page: <kbd>←</kbd>/<kbd>→</kbd> change items,
<kbd>A</kbd>–<kbd>E</kbd> select an answer, <kbd>M</kbd> toggles "mark for
review", <kbd>N</kbd> opens or closes the notepad, <kbd>Enter</kbd> begins or
resumes from the start screen, and
<kbd>Esc</kbd> closes the topmost layer (enlarged exhibit, then the review
overlay) before pausing. Keystrokes aimed at a text field — like the Lab
Values search box — are left alone. Right-clicking an answer choice crosses
it out (same as the <b>ab</b> tab), and clicking an exhibit image enlarges
it. The results screen can filter its table to incorrect, unanswered or
marked items. Once a block is graded the toolbar's Pause slot becomes
**Results**, which returns to the score screen from anywhere, and the item
review overlay gains "Back to Results" and "Go to first incorrect". A
**Next incorrect** button in the bottom bar steps through just the items
you missed (blanks included), wrapping at the end. The results table
remembers which filter you left it on, and its rows are keyboard-operable.
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

The landing page groups the forms by subject and gives each one a row: the
form label, its question count, and — only once you have touched it — where it
stands, either "3 of 50 answered" or the score. The row's action reads Start,
Resume or Review to match. An untouched exam says nothing rather than
repeating "Not started" down the whole list. It is all read from the same
saved progress the engine writes, so no exam's `data.js` is loaded to draw
the page.

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
     //   "labs": [{"name": "Serum",                       // optional group heading
     //             "head": ["", "On admission", "Now"],   // optional header row
     //             "rows": [["Na+", "118 mEq/L"], ...]}]  // 2+ cells per row
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
   window.EXAM_DATA = {
     questions: QUESTIONS,
     images: IMAGES,
     answerKey: ANSWER_KEY,
     explanations: EXPLANATIONS
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

The surgery exams keep their exhibits as image files under their own `images/` folder,
referenced by relative path. The engine also accepts inline `data:` URIs, but
files are preferred: they keep `data.js` small enough to read and diff, avoid
the ~33% base64 overhead, and let git store each image once instead of rewriting
it into every revision of the data file.
