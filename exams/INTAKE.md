# Asking for a transcription

A form usually arrives as two PDFs that are too large to hand to the session
that builds the exam, so the reading is done somewhere else and its text is what
arrives here. That pass is where most of the cost of a build is decided: text
that keeps the shape of the page turns into `data.js` almost mechanically, and
text that has thrown the shape away has to be guessed at and corrected later.
Pediatrics Form 8 cost two extra commits that way — `CASES.md` tells it.

So ask for the format below. It maps onto `data.js` one field at a time: `TABLE`
becomes a lab group, `> ` becomes the indent under a leukocyte count, `COLUMNS`
becomes the headings over a choice table, `CUT` becomes the one thing worth
writing rather than a hole nobody noticed.

## The prompt

Paste this into whichever tool is reading the PDFs, with the files attached.

```
Transcribe this NBME form to text for a downstream build. Work item by item
from 1 to the last. Output exactly the blocks below and nothing else — no
commentary, no summary, no markdown headings of your own.

=== ITEM 12
STEM: the vignette, as one unwrapped paragraph, ending at the lead-in
      ("Laboratory studies show:") when a table follows
TABLE                      omit when the item prints no table
  GROUP: Serum             a heading the form prints over a run of rows
  HEAD: | Child | Mother   only when the table has columns
  ROW: Na+ | 132 mEq/L
  ROW: > Segmented neutrophils | 4%    "> " for each level the form indents
TAIL: the prose after the table, unwrapped, usually the question sentence
COLUMNS: Gross Motor Development | Fine Motor Development | Language Development
         only when the choices themselves are a table, one heading per column;
         then write each choice as its values separated by " | "
A) first choice
B) second choice
EXHIBIT: one line saying what the image is, or: none
UNREADABLE: anything you could not read, or: none

=== ANSWER 12
KEY: B — Karyotype analysis
the explanation, one unwrapped paragraph per line, a blank line between
paragraphs
INCORRECT: A, C, D, and E.      the Incorrect Answers line exactly as printed
OBJECTIVE: the Educational Objective sentence(s) as printed, or: none
CUT: where the page cut a sentence off, quoting the last words that survived,
     or: none

Rules, in order of importance:

1. Never invent. If you cannot read something, write [?] and say so on the
   UNREADABLE line. Do not fill a gap from your own knowledge of medicine.
2. Never correct the form. Wrong units, an implausible lab value, a drug
   described as the wrong class, a heading that makes no sense over the rows
   beneath it: transcribe it as printed. The exam has to ask what the form asks.
3. Never repeat yourself. Consecutive screenshots of one page overlap; write
   each passage once. If a page break cut a sentence, transcribe what survived
   and name it on the CUT line rather than stitching two halves together.
4. Do not include the app's own chrome — "Lab Values", "Calculator", "Review",
   "Help", "Previous", "Next", item counters, or a URL in a status bar.
5. Do not hard-wrap. A paragraph is one line, however long.
6. Keep the choice letters the form uses, and give every choice, including ones
   that continue past a page break.
7. Say the page's shape, not just its words: which rows are indented under
   which, which headings sit over which rows, whether the choices are a table.

If the output would be very long, stop at item 25, and I will ask for the rest.
```

## When the file comes back

Four checks, before any building:

- The item numbers run 1 to N with none missing and none twice.
- Every item has a `KEY` whose letter is among its own choices.
- No `UNREADABLE` line says anything but "none", and every `CUT` line is a place
  where you are willing to write the missing words in the form's voice.
- Nothing is transcribed twice. A repeated paragraph is a page overlap the pass
  was asked not to write, and it means the rest of that item wants reading.

Then `CONVERTING.md` from step 2, and the item's key gets the three-way check in
its §7 whatever this file says: the key list, each `KEY` line, and the letters
the `INCORRECT` line rules out have to account for every choice between them.
