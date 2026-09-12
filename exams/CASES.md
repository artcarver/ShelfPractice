# Cases

The precedents behind the rules in `CONVERTING.md`: what the damage looked like,
what it turned out to be, and how it was settled. Read a case when the form in
front of you looks like it — not before.

## Explanations written rather than transcribed

Two forms lost so much explanation text that most of what a reader sees was
written rather than transcribed, in the way CONVERTING.md §6 describes. Read
them before doing the same again:

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

Pediatrics Form 8 is the text-transcription version of the same loss. Five items
carry written text, all of it a sentence the page seam cut: item 13's objective
(rebuilt from its own discussion) plus two phrases in its discussion, and one
closing word each in items 15, 20, 29 and 33. Two other objectives — items 20 and
31 — also run off the page, but their missing tails survive verbatim in the
overlap the second screenshot duplicated, so they were recovered rather than
written, and those items carry no mark.

## The answer key, where the three sources disagreed

The three sources CONVERTING.md §7 ranks do come apart. In Medicine Form 9 the
printed headers for items
8, 27 and 32 were rotated onto the wrong items and item 4's was simply wrong;
the other 45 agreed, and the key in the repo came from the explanation bodies.
Family Medicine Form 5 item 11 is the sharper case: the form served item 10's
answer screen a second time in its place, so the header reads `Correct Answer:
C` and the body is item 10's explanation word for word — but the highlight on
the review screen sits on A, and A is the key.

Pediatrics Form 8 is the opposite case and worth knowing as the baseline: the
printed key list, all 50 `Correct Answer` headers, the choice text beside each
letter and every "Incorrect Answers" line agreed, so nothing was contested.

## Degraded text, splices and second passes

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

## Text transcriptions lose the page, not just the letters

Pediatrics Form 8 arrived as text from a separate transcription pass, and the
losses were of a different kind: not degraded glyphs but page seams. Duplicated
overlap in eight items, sentences that stop mid-phrase where the seam fell, two
choice paragraphs interleaved in item 33, the source app's own chrome captured
into three stems ("Lab Values Calculator Review Help"), and stray single glyphs
where a mark on the page was read as a letter.

Two mistakes came from the layout the text had thrown away, and both had to be
corrected afterwards from a screenshot:

- **Item 7.** Its choices are a table, and the form heads the columns "Gross
  Motor Development", "Fine Motor Development" and "Language Development". The
  transcription flattened the headings into the choice rows, and the build put
  the repo's other idiom in the stem instead — "(Values are listed in the order:
  ...)" — which that form does not print.
- **Item 26.** The lab table prints "Serum quantitative" and, indented under it,
  "Hemoglobulin", above rows of IgA, IgG and IgM. Read as text alone the word is
  meaningless there, and the build "corrected" it to immunoglobulin. The form
  prints Hemoglobulin, and the form's mistakes stay in.

The lesson is in `INTAKE.md`: ask the transcription for the shape of a table,
not only its words.
