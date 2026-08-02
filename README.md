# ShelfPractice

A collection of self-contained, browser-based shelf practice exams. No server or build step required — everything runs as static files (works locally and on GitHub Pages).

## Structure

```
index.html                          Landing page listing all exams
assets/
  exam.css                          Shared styles for every exam
  exam.js                           Shared exam engine (navigation, grading,
                                    highlighting, cross-outs, saved progress)
  labvalues.css                     Styles for the Lab Values reference panel
  labvalues.js                      Lab Values data + panel (searchable,
                                    tabbed, with pop-out-to-window support)
  labvalues.html                    Standalone Lab Values page (pop-out target)
exams/
  surgery-practice-exam-v4/
    index.html                      Exam shell page (identical for every exam)
    data.js                         This exam's questions, images, answer key
```

Each exam page loads `data.js` (which sets `window.EXAM`) followed by the shared engine. All titles, item counts, and the localStorage key come from `window.EXAM`, so the shell page and engine never need editing per exam.

The shell page also loads `assets/labvalues.js` / `assets/labvalues.css`, which add a **Lab Values** button to the toolbar. It opens a searchable, tabbed reference panel (Serum / Cerebrospinal / Blood / Urine and BMI) that can be popped out into its own window. The lab-value data is shared across all exams — edit it once in `assets/labvalues.js`.

## Adding a new exam

1. **Create a folder** under `exams/`, e.g. `exams/medicine-practice-exam-v1/`.
2. **Copy the shell page** from an existing exam — no edits needed:
   ```
   cp exams/surgery-practice-exam-v4/index.html exams/medicine-practice-exam-v1/index.html
   ```
3. **Create `data.js`** in the new folder defining `window.EXAM`:
   ```js
   (() => {
   const QUESTIONS = [
     // {"n": 1, "image": null | "q04", "stem": "...", "options": [["A", "..."], ["B", "..."], ...]}
   ];
   const IMAGES = {
     // "q04": "data:image/png;base64,...", keys referenced by a question's "image" field
   };
   const ANSWER_KEY = {
     // "1": "C", "2": "A", ...
   };
   window.EXAM = {
     id: "medicine_practice_exam_v1",   // unique; used for saved progress + results filename
     title: "Medicine Practice Exam",
     subtitle: QUESTIONS.length + " items · untimed",
     questions: QUESTIONS,
     images: IMAGES,
     answerKey: ANSWER_KEY
   };
   })();
   ```
4. **Add a link** to the new exam in the root `index.html` exam list.

That's it — the `id` must be unique per exam so saved progress doesn't collide between exams.
