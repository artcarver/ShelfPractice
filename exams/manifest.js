/* The catalog of exams.

   This is the only file to edit when adding an exam. Drop the exam's folder
   under exams/ (a data.js, plus an images/ folder if it has exhibits) and add
   an entry here — the landing page and the exam page both read this list.

     slug        folder name under exams/, and the ?exam= value in the URL
     id          unique key for saved progress and the results filename
     title       shown in the browser tab, the start screen and the toolbar
     label       form/source line shown next to the item count
     items       number of questions, used by the landing page
     storageKey  optional; only needed to keep progress saved under an older key
*/
window.EXAMS = [
  {
    slug: "obgyn-form8",
    id: "obgyn_practice_exam_form8",
    title: "Obstetrics and Gynecology Practice Exam",
    label: "CMS Form 8",
    items: 50
  },
  {
    slug: "obgyn-form7",
    id: "obgyn_practice_exam_form7",
    title: "Obstetrics and Gynecology Practice Exam",
    label: "CMS Form 7",
    items: 50
  },
  {
    slug: "obgyn-form6",
    id: "obgyn_practice_exam_form6",
    title: "Obstetrics and Gynecology Practice Exam",
    label: "CMS Form 6",
    items: 50
  },
  {
    slug: "obgyn-form5",
    id: "obgyn_practice_exam_form5",
    title: "Obstetrics and Gynecology Practice Exam",
    label: "CMS Form 5",
    items: 50
  },
  {
    slug: "obgyn-form4",
    id: "obgyn_practice_exam_form4",
    title: "Obstetrics and Gynecology Practice Exam",
    label: "CMS Form 4",
    items: 50
  },
  {
    slug: "psychiatry-form8",
    id: "psychiatry_practice_exam_form8",
    title: "Psychiatry Practice Exam",
    label: "CMS Form 8",
    items: 50
  },
  {
    slug: "psychiatry-form7",
    id: "psychiatry_practice_exam_form7",
    title: "Psychiatry Practice Exam",
    label: "CMS Form 7",
    items: 50
  },
  {
    slug: "psychiatry-form6",
    id: "psychiatry_practice_exam_form6",
    title: "Psychiatry Practice Exam",
    label: "CMS Form 6",
    items: 50
  },
  {
    slug: "psychiatry-form5",
    id: "psychiatry_practice_exam_form5",
    title: "Psychiatry Practice Exam",
    label: "CMS Form 5",
    items: 50
  },
  {
    slug: "surgery-form9",
    id: "surgery_practice_exam_v4",
    title: "Surgery Practice Exam",
    label: "CMS Form 9",
    items: 50,
    // Predates the per-exam id scheme; kept so saved progress survives.
    storageKey: "surgery_practice_exam_state_v2"
  },
  {
    slug: "surgery-form8",
    id: "surgery_practice_exam_form8",
    title: "Surgery Practice Exam",
    label: "CMS Form 8",
    items: 50
  },
  {
    slug: "surgery-form7",
    id: "surgery_practice_exam_form7",
    title: "Surgery Practice Exam",
    label: "CMS Form 7",
    items: 50
  },
  {
    slug: "surgery-form6",
    id: "surgery_practice_exam_form6",
    title: "Surgery Practice Exam",
    label: "CMS Form 6",
    items: 50
  },
  {
    slug: "surgery-form5",
    id: "surgery_practice_exam_form5",
    title: "Surgery Practice Exam",
    label: "CMS Form 5",
    items: 50
  },
  {
    slug: "surgery-form4",
    id: "surgery_practice_exam_form4",
    title: "Surgery Practice Exam",
    label: "CMS Form 4",
    items: 50
  },
  {
    slug: "surgery-form3",
    id: "surgery_practice_exam_form3",
    title: "Surgery Practice Exam",
    label: "CMS Form 3",
    items: 50
  }
];
