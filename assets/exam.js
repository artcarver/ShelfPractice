/* Shared exam engine.
   exam.html defines window.EXAM before this script loads, merging the exam's
   catalog entry from exams/manifest.js with its own data.js:
   { id, title, label?, items?, storageKey?, basePath?,
     questions, images, answerKey, explanations? } */

const EXAM = window.EXAM;
const QUESTIONS = EXAM.questions;
const ANSWER_KEY = EXAM.answerKey;

/* An image is either an inline data: URI or a path relative to the exam's own
   folder, which is not the folder this page is served from. */
const IMAGES = (() => {
  const base = EXAM.basePath || '';
  const out = {};
  Object.entries(EXAM.images || {}).forEach(([key, src]) => {
    out[key] = /^(data:|https?:|\/)/.test(src) ? src : base + src;
  });
  return out;
})();

document.title = EXAM.title;
/* The subject is what tells one exam from another, so it is the start
   screen's heading, with "Practice Exam" under it; every surgery form shares
   the full title, and the chip above says which form this is. */
const SUBJECT = EXAM.title.replace(/\s+Practice Exams?$/i, '') || EXAM.title;
document.getElementById('examName').textContent = SUBJECT;
(() => {
  const sub = document.getElementById('examSub');
  sub.textContent = EXAM.title.slice(SUBJECT.length).trim();
  sub.hidden = !sub.textContent;
})();
/* The bar names the subject and, beside it, the form. It has room for one
   short line, so the title drops its "Practice Exam" suffix there — the
   browser tab and the results screen still say it in full. */
const titleBar = document.getElementById('examTitleBar');
titleBar.textContent = SUBJECT;
titleBar.title = EXAM.title;   // the long subjects have to ellipsize
if(EXAM.label){
  const chip = document.getElementById('examLabel');
  chip.textContent = EXAM.label;
  chip.hidden = false;
  /* The bar has the subject beside it, so the tag carries only the part the
     subject does not: "CMS Form 6" becomes "Form 6". The start screen still
     shows the label in full. */
  const tag = document.getElementById('examFormTag');
  tag.textContent = EXAM.label.replace(/^CMS\s+/i, '');
  tag.title = EXAM.label;
  tag.style.display = '';
}

if(EXAM.items && EXAM.items !== QUESTIONS.length){
  console.warn(`manifest lists ${EXAM.items} items for "${EXAM.slug}", data.js has ${QUESTIONS.length}`);
}

const state = {
  idx: 0,
  answers: {},   // n -> letter
  marked: {},    // n -> bool
  struck: {},    // "n_letter" -> bool
  highlights: {}, // n -> [[start,end], ...] character offsets into stem text
  notes: {},        // n -> the note you typed while working that item
  notesOpen: false, // whether the notes window is showing; kept across items
  notesPos: null,   // {x,y,w,h} of the notes window, so it stays where you put it
  /* Timekeeping: `elapsedMs` banks completed running time and `runningSince`
     timestamps the current running stretch (null whenever the clock is stopped),
     so pausing is just stopping the clock. */
  elapsedMs: 0,
  runningSince: null,
  /* The same two-field scheme per item: `itemMs` banks completed time against
     an item number, `itemSince` timestamps the stretch running now and
     `itemSinceN` says which item it belongs to, so a stretch can be banked
     correctly even after a reload moved the cursor. The item clock runs only
     while the block clock runs AND a question is on screen — the results
     screen and the pause screen both stop it. */
  itemMs: {},
  itemSince: null,
  itemSinceN: null,
  paused: false,
  graded: false,
  score: null,   // {correct, incorrect, unanswered, total}; saved at grading so
                 // the landing page can show the result without the answer key
  onResults: false, // which view was showing, so a reload comes back to it
  /* How the block shows its answers, chosen on the start screen and fixed for
     the attempt. "exam" reveals nothing until the block ends; "tutor" reveals
     each item as it is checked, and `checked` records which have been. A
     record saved before tutor mode existed has no mode, and reads as "exam",
     which is what it was. */
  mode: 'exam',
  checked: {},      // n -> true once that item's answer has been checked
  /* Whether the block runs against the real form's clock, chosen beside the
     mode and fixed with it. A timed block counts down from timeLimitMs() and
     ends itself at zero, which sets `timeUp`. `gradedAt` dates the score for
     the start screen. Records from before either existed are untimed.
     A timed block can drop its countdown partway (and only that way round);
     `timerOffAt` keeps the block time at which it did, for the results line,
     and is null for a block that was never timed or still is. At zero the
     block asks whether to end there or keep going untimed; keeping going
     saves the score as it stood in `scoreAtTimeUp`, so the results can give
     both. `timeUp` is set only when the block ended at zero. */
  timed: false,
  timeUp: false,
  timerOffAt: null,
  scoreAtTimeUp: null,
  gradedAt: null
};

const STORAGE_KEY = EXAM.storageKey || ('exam_state_' + EXAM.id);

function loadState(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(raw){
      const saved = JSON.parse(raw);
      state.idx = saved.idx || 0;
      state.answers = saved.answers || {};
      state.marked = saved.marked || {};
      state.struck = saved.struck || {};
      state.highlights = saved.highlights || {};
      state.notes = saved.notes || {};
      state.notesOpen = !!saved.notesOpen;
      state.notesPos = saved.notesPos || null;
      state.graded = !!saved.graded;
      state.paused = !!saved.paused;
      state.score = saved.score || null;
      state.onResults = !!saved.onResults;
      state.mode = saved.mode === 'tutor' ? 'tutor' : 'exam';
      state.checked = saved.checked || {};
      state.timed = saved.timed === true;
      state.timeUp = saved.timeUp === true;
      state.timerOffAt = typeof saved.timerOffAt === 'number' ? saved.timerOffAt : null;
      state.scoreAtTimeUp = saved.scoreAtTimeUp && saved.scoreAtTimeUp.total
        ? saved.scoreAtTimeUp : null;
      state.gradedAt = saved.gradedAt || null;
      state.itemMs = saved.itemMs || {};
      state.itemSince = saved.itemSince || null;
      state.itemSinceN = saved.itemSinceN || null;
      state.savedAt = saved.savedAt || null;
      if(typeof saved.elapsedMs === 'number'){
        state.elapsedMs = saved.elapsedMs;
        state.runningSince = saved.runningSince || null;
      }else if(saved.startTime){
        // progress saved before the clock could be paused: carry the time over
        state.elapsedMs = Math.max(0, Date.now() - saved.startTime);
        state.runningSince = null;
      }
    }
  }catch(e){}
}
/* A running clock is saved as "running since", so a tab that closes without
   stopping it leaves it running: come back a day later and the day is on the
   block, and on whichever item was showing. Leaving the page stops it (see
   pagehide below), but a phone that kills the tab never says so. For that
   case the stretch is closed at the last moment anything was saved, which is
   the last moment we know someone was working. */
function bankAbandonedClock(){
  const upTo = Math.min(Date.now(), state.savedAt || Date.now());
  if(state.runningSince){
    state.elapsedMs += Math.max(0, upTo - state.runningSince);
    state.runningSince = null;
  }
  if(state.itemSince){
    const n = state.itemSinceN;
    if(n != null) state.itemMs[n] = (state.itemMs[n] || 0) + Math.max(0, upTo - state.itemSince);
    state.itemSince = null;
    state.itemSinceN = null;
  }
}
function saveState(){
  try{
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      idx: state.idx, answers: state.answers, marked: state.marked, struck: state.struck,
      highlights: state.highlights, notes: state.notes,
      notesOpen: state.notesOpen, notesPos: state.notesPos,
      graded: state.graded, paused: state.paused,
      score: state.score, onResults: state.onResults,
      mode: state.mode, checked: state.checked,
      timed: state.timed, timeUp: state.timeUp, timerOffAt: state.timerOffAt,
      scoreAtTimeUp: state.scoreAtTimeUp,
      gradedAt: state.gradedAt,
      elapsedMs: state.elapsedMs, runningSince: state.runningSince,
      itemMs: state.itemMs, itemSince: state.itemSince, itemSinceN: state.itemSinceN,
      savedAt: Date.now()
    }));
  }catch(e){}
}

/* ---------- the clock ---------- */

function elapsedMs(){
  return state.elapsedMs + (state.runningSince ? Date.now() - state.runningSince : 0);
}
function startClock(){
  if(timeUpOpen) return;   // stopped at the limit until a choice is made
  if(!state.runningSince && !state.paused && !state.graded && !reviewing())
    state.runningSince = Date.now();
  startItemClock();   // guards itself; a no-op unless a question is on screen
}

/* Tutor mode: reading. Once an item is checked, what is on screen is its
   answer and explanation, which is study, not work on the block. So the
   block clock (and a timed block's countdown) stops the moment an item is
   checked, stays stopped on any checked item you come back to, and starts
   again on the first item you move to that you have not checked. The clock
   then holds only the time spent answering, and reading never costs time on
   a timed block. */
function reviewing(){
  if(!tutor() || state.graded || state.onResults) return false;
  const q = QUESTIONS[state.idx];
  return !!q && !!state.checked[q.n];
}
/* After every move, and on checking: stop the block clock on a checked item,
   start it on one being worked. Only the block clock: a checked item's own
   clock has already stopped for good. */
function syncReviewClock(){
  if(!enteredExam || state.paused || state.graded || timeUpOpen) return;
  if(reviewing()){
    if(state.runningSince){
      state.elapsedMs += Date.now() - state.runningSince;
      state.runningSince = null;
    }
  }else{
    startClock();
  }
}
function stopClock(){
  if(state.runningSince){
    state.elapsedMs += Date.now() - state.runningSince;
    state.runningSince = null;
  }
  stopItemClock();   // the item clock never outlives the block clock
}

/* The item clock. startItemClock is a no-op unless a question is actually on
   screen, so every caller can fire it without first checking the view. */
function startItemClock(){
  if(state.itemSince || state.paused || state.graded || state.onResults || timeUpOpen) return;
  const q = QUESTIONS[state.idx];
  if(!q) return;
  /* A checked item's time is the time it took to answer. What follows is
     reading the explanation, which neither clock keeps (see reviewing), so
     going back to it later adds nothing. */
  if(state.checked[q.n]) return;
  state.itemSince = Date.now();
  state.itemSinceN = q.n;
}
/* Always call this BEFORE state.idx moves, or the time lands on the wrong
   item. goToItem is the only place that moves it, and it does. */
function stopItemClock(){
  if(!state.itemSince) return;
  const n = state.itemSinceN;
  if(n != null) state.itemMs[n] = (state.itemMs[n] || 0) + (Date.now() - state.itemSince);
  state.itemSince = null;
  state.itemSinceN = null;
}
function itemMsFor(n){
  let ms = state.itemMs[n] || 0;
  if(state.itemSince && state.itemSinceN === n) ms += Date.now() - state.itemSince;
  return ms;
}

/* "Slow" is relative to how this block actually went, not to a fixed target:
   a form worked in half the allotted time would flag nothing against a clock,
   and every item against a strict average. The median is the block's own
   pace, and the floor keeps a fast block from flagging a 30-second item as a
   struggle. */
function slowThresholdMs(){
  const times = QUESTIONS.map(q => itemMsFor(q.n)).filter(ms => ms > 0).sort((a,b) => a-b);
  if(times.length < 5) return Infinity;
  const mid = Math.floor(times.length / 2);
  const median = times.length % 2 ? times[mid] : (times[mid-1] + times[mid]) / 2;
  return Math.max(median * 1.75, 90000);
}

function currentQ(){ return QUESTIONS[state.idx]; }

function isCorrect(n){
  return state.answers[n] && ANSWER_KEY[n] && state.answers[n] === ANSWER_KEY[n];
}

/* ---------- tutor mode ---------- */

function tutor(){ return state.mode === 'tutor'; }

/* Whether an item shows its answer: every item once the block is graded, and
   in tutor mode each item as soon as it is checked. Everything that draws a
   single item asks this; what belongs to the block as a whole (the clock, the
   Results button, Next incorrect) still asks state.graded. */
function revealed(n){ return state.graded || !!state.checked[n]; }

/* Items in a set are checked together. The explanation of the first item in a
   set argues through every shared choice, the second item's answer included,
   and on most of the sets on the shelf it names it outright: checking one
   alone would hand over the other. A set is the run of neighbouring items that
   print the same notice, which is how data.js marks one. */
const UNIT = (() => {
  const out = {};
  let run = [];
  QUESTIONS.forEach((q, i) => {
    run.push(q.n);
    const next = QUESTIONS[i + 1];
    if(!(q.setNote && next && next.setNote === q.setNote)){
      run.forEach(n => { out[n] = run; });
      run = [];
    }
  });
  return out;
})();
function unitOf(n){ return UNIT[n] || [n]; }

function listItems(ns){
  return ns.length < 2 ? String(ns[0] || '')
       : ns.slice(0, -1).join(', ') + ' and ' + ns[ns.length - 1];
}

function checkedTally(){
  let checked = 0, correct = 0;
  QUESTIONS.forEach(q => {
    if(!state.checked[q.n]) return;
    checked++;
    if(isCorrect(q.n)) correct++;
  });
  return {checked, correct};
}

/* Time to answer, summed over the items that have one. In tutor mode this,
   not the block clock, is what a per-item pace is made of. The block clock
   now stops on a checked item too, so the two nearly agree, but a tutor
   block saved before it did holds its reading time on the block clock. */
function answerMs(){
  return QUESTIONS.reduce((t, q) => t + itemMsFor(q.n), 0);
}
function paceMs(answered){
  if(!answered) return 0;
  return (tutor() ? answerMs() : elapsedMs()) / answered;
}

/* ---------- timed mode ---------- */

/* The pace the real forms are written to: a self-assessment gives 50 items
   1 h 15 min, which is 90 seconds an item, the same pace the shelf itself
   keeps. The limit scales with the block, so a form of any length gets the
   same pace rather than the same total. */
const SHELF_PACE_MS = 90000;
function timeLimitMs(){ return QUESTIONS.length * SHELF_PACE_MS; }
function remainingMs(){ return Math.max(0, timeLimitMs() - elapsedMs()); }

/* The one way a block ends: from End block, or from a timed block's clock
   reaching zero. */
function gradeBlock(){
  state.graded = true;
  state.score = computeScore();
  state.gradedAt = Date.now();
  stopClock();            // the block is over; the clock stops with it
  saveState();
  closeReview();
  showResults();
}

/* Time is up. On test day the block would end here, and for some people
   that is the point of a timed block; for others it is the moment to finish
   the last few items without a clock. So the clock stops and the block asks.
   Whatever is open over the question closes first, the question is hidden
   while the card is up (the clock is stopped, so reading on would be free
   time), and the banked time is held at the limit: the tick that noticed can
   land a second past it. A reload with the card up comes back to it, since
   the block is still timed with nothing left. */
let timeUpOpen = false;
function holdAtLimit(){
  // the overshoot was spent on whichever item was on screen, so it comes
  // off that item's time too, or the item times would sum past the limit
  const n = state.itemSinceN;
  stopClock();
  const over = state.elapsedMs - timeLimitMs();
  if(over <= 0) return;
  state.elapsedMs = timeLimitMs();
  if(n != null && state.itemMs[n]) state.itemMs[n] = Math.max(0, state.itemMs[n] - over);
}
function timeUp(){
  if(state.graded || !state.timed || timeUpOpen) return;
  holdAtLimit();
  saveState();
  closeLightbox();
  showSizePop(false);
  closeReview();
  timeUpOpen = true;
  renderTimeUp();
}
/* The card: which block, how it stands, and the two ways on. Focus goes to
   its heading rather than a button, so an Enter already on its way (tutor
   mode's Check) cannot pick one by accident. */
function renderTimeUp(){
  const screen = document.getElementById('timeUpScreen');
  screen.style.display = timeUpOpen ? 'flex' : 'none';
  document.getElementById('app').inert = timeUpOpen;
  renderPause();   // hides the question and the notes while the card is up
  if(!timeUpOpen) return;
  const answered = Object.keys(state.answers).length;
  const marked = markedIndexes().length;
  document.getElementById('timeUpLimit').textContent = humanDuration(timeLimitMs());
  document.getElementById('timeUpAnswered').textContent = answered + ' / ' + QUESTIONS.length;
  document.getElementById('timeUpMarked').textContent = marked;
  document.getElementById('timeUpHead').focus();
}
/* End there: graded as it stands, exactly as End block grades it. The card
   comes down only once the block can no longer count, or the tick that
   draws it would see a timed block at zero and put it straight back up. */
function endAtTimeUp(){
  if(state.graded) return;
  holdAtLimit();
  state.timeUp = true;
  timeUpOpen = false;
  gradeBlock();
  renderTimeUp();
}
/* Keep going: the score as it stood is kept, and the block carries on
   untimed from the limit, the same as turning the timer off. */
function keepGoingUntimed(){
  if(state.graded) return;
  holdAtLimit();
  state.scoreAtTimeUp = computeScore();
  state.timerOffAt = timeLimitMs();
  state.timed = false;
  timeUpOpen = false;
  renderTimeUp();
  startClock();
  saveState();
  renderPause();
  render();
}
/* A block that ran out of time and carried on: how it stood at the limit. */
function ranOver(){ return !!state.scoreAtTimeUp; }
function pctOf(s){ return Math.round((s.correct / s.total) * 100); }

/* Turning the timer off. A countdown that is doing more harm than good can
   go for the rest of the block: the clock carries on counting up from the
   time already spent, and the block is untimed from then on. It goes one way
   only. A timer that could come back on would let a block stop its limit for
   a while and still be called timed. So it asks first, and Start over is the
   way back to a timed attempt. */
function turnOffTimer(){
  if(!counting()) return;
  if(!confirm('Turn off the timer for the rest of this block?\n\nThe clock will count up '
            + 'from the time already spent, with no limit. The timer cannot be turned '
            + 'back on for this attempt.')) return;
  /* the confirmation stops the page but not the wall clock, as at End block;
     a timer that ran out while it was open has run out, and asked to go,
     it carries on untimed with the score at the limit kept */
  if(enteredExam && remainingMs() <= 0){ keepGoingUntimed(); return; }
  state.timerOffAt = Math.min(elapsedMs(), timeLimitMs());
  state.timed = false;
  saveState();
  renderPause();   // the toolbar clock, and the pause card's figures
  if(!enteredExam) renderStart();
  /* the button that was pressed has gone, so focus goes where the next
     move is: Resume on the pause card or the start screen */
  if(state.paused && enteredExam) document.getElementById('resumeExamBtn').focus();
  else if(!enteredExam) document.getElementById('resumeBtn').focus();
}

/* The check button, and what it says when it cannot act yet. */
function renderCheck(q){
  const row = document.getElementById('checkRow');
  const open = tutor() && !revealed(q.n);
  row.hidden = !open;
  if(!open) return;
  const unit = unitOf(q.n);
  const waiting = unit.filter(n => !state.answers[n]);
  const btn = document.getElementById('checkBtn');
  btn.disabled = waiting.length > 0;
  btn.title = waiting.length
    ? (state.answers[q.n] ? 'Answer the rest of the set first' : 'Pick an answer first')
    : 'Show the answer and its explanation (Enter)';
  document.getElementById('checkLabel').textContent =
    unit.length === 1 ? 'Check answer'
      : (unit.length === 2 ? 'Check both answers' : 'Check all ' + unit.length + ' answers');
  const hint = document.getElementById('checkHint');
  if(unit.length === 1){
    hint.textContent = '';
  }else{
    const others = waiting.filter(n => n !== q.n);
    hint.textContent = (state.answers[q.n] && others.length)
      ? 'Answer item ' + listItems(others) + ' too: items ' + listItems(unit) + ' are checked together.'
      : 'Items ' + listItems(unit) + ' are checked together.';
  }
}

function checkAnswer(){
  if(!tutor() || state.graded || state.paused) return;
  const q = currentQ();
  if(revealed(q.n)) return;
  const unit = unitOf(q.n);
  if(unit.some(n => !state.answers[n])) return;
  stopItemClock();          // the item's time ends with its answer
  unit.forEach(n => { state.checked[n] = true; });
  syncReviewClock();        // and the block clock stops while it is read
  saveState();
  render();
  nudgeToExplanation();
}

/* The explanation opens where the check button was, so after a click it is
   already in view. Pressed from the keyboard with the button below the fold,
   its opening lines can land out of sight; scroll just far enough to show
   them, and never so far that the choices go up under the pinned bars. */
function nudgeToExplanation(){
  const exp = document.getElementById('explanation');
  if(exp.style.display === 'none') return;
  const main = document.getElementById('examMain');
  const split = document.getElementById('app').classList.contains('lab-open') &&
                getComputedStyle(main).overflowY === 'auto';
  const foot = document.querySelector('footer.botbar');
  const floor = foot ? foot.getBoundingClientRect().top : window.innerHeight;
  const want = exp.getBoundingClientRect().top + 96 - floor;
  if(want <= 0) return;
  const track = document.querySelector('.progress-track');
  const ceiling = track ? track.getBoundingClientRect().bottom : 0;
  const room = document.getElementById('qoptions').getBoundingClientRect().top - ceiling - 12;
  const by = Math.min(want, Math.max(0, room));
  if(by <= 0) return;
  const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  (split ? main : window).scrollBy({top: by, behavior: smooth ? 'smooth' : 'auto'});
}

function render(){
  const q = currentQ();
  document.getElementById('curItem').textContent = q.n;
  document.getElementById('curItem2').textContent = q.n;
  document.getElementById('totalItems').textContent = QUESTIONS.length;
  document.getElementById('totalItems2').textContent = QUESTIONS.length;

  const imgWrap = document.getElementById('qimgWrap');
  const img = document.getElementById('qimg');
  if(q.image && IMAGES[q.image]){
    img.src = IMAGES[q.image];
    imgWrap.style.display = '';
  }else{
    img.src = '';
    imgWrap.style.display = 'none';
  }

  document.getElementById('qstem').innerHTML = renderStemHTML(q, state.highlights[q.n] || []);
  /* A matched set states itself: the notice above the item, and the shared
     instruction directly above the choices it governs. */
  const setNote = document.getElementById('setNote');
  setNote.textContent = q.setNote || '';
  setNote.style.display = q.setNote ? '' : 'none';
  const setLead = document.getElementById('setLead');
  setLead.textContent = q.lead || '';
  setLead.style.display = q.lead ? '' : 'none';

  const selected = state.answers[q.n];
  const correctLetter = ANSWER_KEY[q.n];
  // the block is graded, or in tutor mode this item has been checked
  const shown = revealed(q.n);

  // graded banner
  const banner = document.getElementById('gradedBanner');
  if(shown){
    let kind, say;
    if(!selected){
      kind = 'unanswered-banner';
      say = `Not answered. Correct answer: ${correctLetter}.`;
    }else if(selected === correctLetter){
      kind = 'correct-banner';
      say = `Correct. You selected ${selected}.`;
    }else{
      kind = 'incorrect-banner';
      say = `Incorrect. You selected ${selected}, and the correct answer is ${correctLetter}.`;
    }
    banner.className = 'graded-banner show ' + kind;
    banner.textContent = say;
    /* How long the item took is the other half of reviewing it: a right
       answer that took four minutes is not the same as one that took forty
       seconds. The results table has the number; the item says it too. */
    const ms = itemMsFor(q.n);
    if(ms > 0){
      const t = document.createElement('span');
      t.className = 'banner-time';
      t.textContent = formatItemTime(ms) + ' on this item';
      banner.appendChild(t);
    }
  }else{
    banner.className = 'graded-banner';
    banner.textContent = '';
  }

  const optsDiv = document.getElementById('qoptions');
  optsDiv.innerHTML = '';
  /* An item whose choices are a small table gets drawn as one: the values in
     aligned columns, under the headings the form prints above them. */
  const table = choiceTable(q);
  optsDiv.className = 'options' + (table ? ' opt-table' : '')
                    + (table && table.head ? ' has-head' : '')
                    + (table && shown ? ' graded' : '');
  optsDiv.style.setProperty('--opt-cols', table ? table.width : 1);
  if(table && table.head){
    // Not a choice, and it must not answer to a choice's selector: the head
    // row carries its own class and never `opt`.
    const head = document.createElement('div');
    head.className = 'opt-head';
    head.innerHTML = '<span class="opt-radio-space" aria-hidden="true"></span>'
      + '<div class="opt-body"><span class="letter"></span>'
      + table.head.map(h => `<span class="opt-cell">${escapeHtml(h)}</span>`).join('')
      + '</div>';
    optsDiv.appendChild(head);
  }
  q.options.forEach(([letter, text], idx) => {
    const row = document.createElement('div');
    const strikeKey = q.n + '_' + letter;
    const isStruck = !!state.struck[strikeKey];
    let cls = 'opt' + (selected === letter ? ' selected' : '') + (isStruck ? ' struck' : '');
    let tag = '';
    if(shown){
      cls += ' graded';
      if(letter === correctLetter){
        cls += ' correct-answer';
        tag = '<span class="tag">Correct answer</span>';
      }else if(letter === selected){
        cls += ' wrong-selected';
        tag = '<span class="tag">Your answer</span>';
      }
    }
    row.className = cls;
    const strikeBtn = shown ? '' : `<span class="strike-toggle${isStruck ? ' active' : ''}" title="Cross out this choice">ab</span>`;
    const body = table
      ? '<span class="opt-body">' + `<span class="letter">${letter}.</span>`
        + table.cells[idx].map((c, j) =>
            `<span class="opt-cell"${table.head ? ` data-head="${escapeHtml(table.head[j])}"` : ''}>${escapeHtml(c)}</span>`
          ).join('') + '</span>'
      : `<span class="letter">${letter}.</span> ${escapeHtml(text)}`;
    row.innerHTML = `<input type="radio" name="opt" id="opt_${letter}" ${selected===letter?'checked':''} ${shown?'disabled':''}>
      <label for="opt_${letter}">${body}</label>${tag}${strikeBtn}`;
    if(!shown){
      row.addEventListener('click', (e) => {
        if(e.target.closest('.strike-toggle')) return;
        state.answers[q.n] = letter;
        saveState();
        render();
      });
      // right-click anywhere on the choice also toggles the cross-out
      row.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        state.struck[strikeKey] = !state.struck[strikeKey];
        saveState();
        render();
      });
      const st = row.querySelector('.strike-toggle');
      if(st){
        st.addEventListener('click', (e) => {
          e.stopPropagation();
          state.struck[strikeKey] = !state.struck[strikeKey];
          saveState();
          render();
        });
      }
    }
    optsDiv.appendChild(row);
  });

  renderCheck(q);

  // explanation: once the block is graded, or once a tutor-mode item is checked
  const expEl = document.getElementById('explanation');
  const expHtml = shown && EXAM.explanations ? EXAM.explanations[q.n] : null;
  if(expHtml){
    expEl.innerHTML = '<div class="exp-h">Explanation</div>' + expHtml
                    + writtenNote(EXAM.written && EXAM.written[q.n]);
    expEl.style.display = '';
  }else{
    expEl.innerHTML = '';
    expEl.style.display = 'none';
  }

  renderNotes();

  document.getElementById('markChk').checked = !!state.marked[q.n];

  const note = document.getElementById('answeredNote');
  if(note){
    /* While the block is open the subbar holds the clock alone: the Item box
       already says where you are, the progress line under the bar how far
       along, and tutor mode's running score is on the review grid. Once the
       block is graded, items reopened from the results carry the score. */
    if(state.graded){
      const s = state.score || computeScore();
      note.textContent = `Score: ${s.correct} of ${s.total} correct`;
    }else{
      note.textContent = '';
    }
  }
  updateProgress();

  document.getElementById('prevBtn').disabled = state.idx === 0;
  document.getElementById('prevBtn2').disabled = state.idx === 0;
  const isLast = state.idx === QUESTIONS.length - 1;
  document.getElementById('nextBtnLabel').textContent = isLast ? 'Review' : 'Next';
  document.getElementById('nextBtn2').textContent =
    isLast ? (state.graded ? 'Item List' : 'Review / Finish') : 'Next';

  // stepping through only the items you got wrong, once the block is graded
  const ni = document.getElementById('nextIncorrectBtn');
  if(ni){
    const wrong = state.graded ? incorrectIndexes() : [];
    ni.style.display = wrong.length ? '' : 'none';
  }

  renderPause();
  closeLightbox();
}

/* Moving to a different item starts you at the top of the question; updating
   the item in place (answering, crossing out, highlighting) must leave the
   page where it is. Only the callers that change item call this.
   With the Lab Values panel open the question column scrolls, not the window. */
function scrollQuestionTop(){
  const main = document.getElementById('examMain');
  if(main) main.scrollTop = 0;
  window.scrollTo(0,0);
}

/* ---------- the Back button ---------- */

/* The exam page is one URL wearing two faces: the question view and the
   results screen. Without a history entry between them the browser has
   nothing to go back to but the page before this one, so opening an item from
   the results table and pressing Back dumps you on the exam list instead of
   returning to your results.

   One entry per face, not per item. Stepping through items with Next and
   Previous stays on the same entry — fifty entries in the back stack would
   mean fifty presses to leave the exam — so Back returns you to whichever
   screen you came from, which is the question it is actually being asked. */
let restoringView = false;

function pushView(view){
  if(restoringView) return;                       // replaying history, not making it
  if(history.state && history.state.view === view) return;   // already this face
  try{
    if(history.state) history.pushState({view}, '');
    else history.replaceState({view}, '');        // first entry: claim it, do not add one
  }catch(e){}                                     // file:// and similar: leave Back alone
}

window.addEventListener('popstate', e => {
  if(!enteredExam) return;                        // still on the start screen
  const view = e.state && e.state.view;
  restoringView = true;
  try{
    if(view === 'results' && state.graded){
      showResults();
    }else if(view === 'question'){
      showQuestionView();
      render();
      scrollQuestionTop();
    }
  }finally{
    restoringView = false;
  }
});

/* Swap the results screen out for the question view. Item navigation can be
   triggered from the review overlay while Exam complete is on screen, and
   rendering the question underneath it would otherwise change nothing the
   user can see. */
function showQuestionView(){
  document.getElementById('resultsScreen').style.display = 'none';
  document.getElementById('quizMain').style.display = '';
  document.querySelector('footer.botbar').style.display = '';
  state.onResults = false;
  startItemClock();   // an item is on screen again, so its clock resumes
  renderNotes();
  saveState();
  pushView('question');
}

/* The one way to move to an item: it always ends with that item on screen. */
function goToItem(i){
  if(i < 0 || i >= QUESTIONS.length) return;
  stopItemClock();    // bank against the item being left, before idx moves
  state.idx = i;
  syncReviewClock();  // a checked item stops the clock; an unchecked one starts it
  saveState();
  showQuestionView();
  render();
  scrollQuestionTop();
}

function escapeHtml(s){
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

/* Thin bar under the subbar: answered fraction while testing, then the
   correct fraction (in green) once the block is graded. */
function updateProgress(){
  const fill = document.getElementById('progressFill');
  if(!fill) return;
  if(state.graded){
    const s = state.score || computeScore();
    fill.style.width = (s.correct / s.total) * 100 + '%';
    fill.classList.add('graded');
  }else{
    fill.style.width = (Object.keys(state.answers).length / QUESTIONS.length) * 100 + '%';
    fill.classList.remove('graded');
  }
}

/* ---------- text highlighting ---------- */

/* Highlights are stored as character offsets into the question's plain text.
   A question may render as several text runs (prose, then a lab table, then
   more prose); `markUp` renders one run that begins at absolute offset `base`,
   clipping the ranges that fall inside it. Concatenating the runs in DOM order
   reproduces the offset string exactly, which is what getTextOffset walks. */
function markUp(text, ranges, base){
  let html = '';
  let pos = 0;
  ranges.forEach(({r, i}) => {
    const start = Math.max(pos, r[0] - base);
    const end = Math.min(text.length, r[1] - base);
    if(end <= start || start >= text.length) return;
    if(start > pos) html += escapeHtml(text.slice(pos, start));
    html += `<mark class="hl" data-idx="${i}">${escapeHtml(text.slice(start, end))}</mark>`;
    pos = end;
  });
  html += escapeHtml(text.slice(pos));
  return html;
}

/* Some items do not ask for a phrase but for a set of values — one per column
   of a small table the form prints above the choices, a row to each choice.
   data.js keeps such a choice as one string with " · " between its values, so
   the letter, the key and the results file need no special case; the item adds
   `choiceHead` when the form heads those columns. Here the string is split back
   into cells, and only when every choice yields the same number of them: a set
   that does not line up is prose that happens to contain the separator, and is
   drawn as prose. Headings that do not match the columns are ignored. */
const CHOICE_SEP = ' · ';
function choiceTable(q){
  const cells = (q.options || []).map(([, text]) => text.split(CHOICE_SEP));
  const width = cells.length ? cells[0].length : 0;
  if(width < 2 || !cells.every(c => c.length === width)) return null;
  const head = Array.isArray(q.choiceHead) && q.choiceHead.length === width ? q.choiceHead : null;
  return {cells, width, head};
}

/* Where a capture lost part of an explanation, the missing text is written in
   the form's voice and the item says so under a rule. The wordings live here
   rather than in any exam's data.js, so every form says it the same way and a
   new form gets the line by naming the item: an exam's WRITTEN maps an item
   number to one of these keys. Anything else is ignored rather than drawn,
   since a line nobody can read is worse than no line. */
const WRITTEN_NOTE = {
  all: 'This explanation was written by AI to fill a gap in the original.',
  part: 'Part of this explanation was written by AI to fill a gap in the original.',
  objective: 'The educational objective was written by AI to fill a gap in the original.',
  'objective+discussion':
    'The educational objective and discussion were written by AI to fill a gap in the original.'
};
function writtenNote(kind){
  const text = WRITTEN_NOTE[kind];
  return text ? '<p class="exp-note">' + escapeHtml(text) + '</p>' : '';
}

/* A lab row whose label is indented sits under the row above it, the way a
   form prints a leukocyte differential beneath its leukocyte count. Two
   leading spaces mark one level. The spaces are layout, not text: they never
   reach the page or the offset string, so a highlight still lands where the
   reader put it. */
function labLabel(cell){
  const lead = /^ +/.exec(cell);
  if(!lead) return {depth: 0, text: cell};
  return {depth: Math.round(lead[0].length / 2), text: cell.slice(lead[0].length)};
}

/* Plain text of a question, in the same order the DOM renders it. */
function renderStemHTML(q, ranges){
  const indexed = (ranges || []).slice().sort((a,b) => a[0]-b[0]).map((r,i) => ({r, i}));
  if(!q.labs || !q.labs.length) return markUp(q.stem, indexed, 0);

  let off = 0;
  let html = '<div class="stem-p">' + markUp(q.stem, indexed, off) + '</div>';
  off += q.stem.length;

  /* Most stems run prose, then one table. A few print a table, a paragraph,
     and then a second table — so a group can carry the prose that introduces
     it, which closes the table above and opens a new one after it. */
  let open = false;
  const openTable = () => { if(!open){ html += '<table class="lab-table">'; open = true; } };
  const closeTable = () => { if(open){ html += '</table>'; open = false; } };

  q.labs.forEach(group => {
    if(group.intro){
      closeTable();
      html += '<div class="stem-p">' + markUp(group.intro, indexed, off) + '</div>';
      off += group.intro.length;
    }
    openTable();
    const width = Math.max(...group.rows.map(r => r.length));
    if(group.name){
      html += `<tr class="lab-group"><td colspan="${width}">`
            + markUp(group.name, indexed, off) + '</td></tr>';
      off += group.name.length;
    }
    if(group.head){
      html += '<tr class="lab-head">';
      group.head.forEach(c => {
        html += '<td>' + markUp(c, indexed, off) + '</td>';
        off += c.length;
      });
      html += '</tr>';
    }
    group.rows.forEach(row => {
      html += '<tr>';
      row.forEach((cell, ci) => {
        const {depth, text} = ci === 0 ? labLabel(cell) : {depth: 0, text: cell};
        const cls = ci === 0
          ? 'lab-name' + (depth ? ` lab-sub lab-sub-${Math.min(depth, 3)}` : '')
          : 'lab-val';
        html += `<td class="${cls}">` + markUp(text, indexed, off) + '</td>';
        off += text.length;
      });
      html += '</tr>';
    });
  });
  closeTable();

  if(q.stemTail){
    html += '<div class="stem-p">' + markUp(q.stemTail, indexed, off) + '</div>';
  }
  return html;
}

function getTextOffset(container, node, offset){
  let total = 0;
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null);
  let n;
  while((n = walker.nextNode())){
    if(n === node) return total + offset;
    total += n.textContent.length;
  }
  return total;
}

function getSelectionOffsets(container){
  const sel = window.getSelection();
  if(!sel || !sel.rangeCount) return null;
  const range = sel.getRangeAt(0);
  if(range.collapsed) return null;
  if(!container.contains(range.commonAncestorContainer)) return null;
  const start = getTextOffset(container, range.startContainer, range.startOffset);
  const end = getTextOffset(container, range.endContainer, range.endOffset);
  return start < end ? [start, end] : [end, start];
}

function addHighlight(qn, start, end){
  if(start === end) return;
  const ranges = (state.highlights[qn] || []).slice();
  ranges.push([start, end]);
  ranges.sort((a, b) => a[0] - b[0]);
  const merged = [];
  ranges.forEach(r => {
    if(merged.length && r[0] <= merged[merged.length - 1][1]){
      merged[merged.length - 1][1] = Math.max(merged[merged.length - 1][1], r[1]);
    }else{
      merged.push(r.slice());
    }
  });
  state.highlights[qn] = merged;
  saveState();
}

function removeHighlightAt(qn, idx){
  const ranges = (state.highlights[qn] || []).slice();
  ranges.splice(idx, 1);
  state.highlights[qn] = ranges;
  saveState();
}

let stemMouseDown = null;
const stemEl = document.getElementById('qstem');
stemEl.addEventListener('mousedown', (e) => {
  stemMouseDown = {x: e.clientX, y: e.clientY};
});
stemEl.addEventListener('mouseup', (e) => {
  const q = currentQ();
  const dx = stemMouseDown ? Math.abs(e.clientX - stemMouseDown.x) : 999;
  const dy = stemMouseDown ? Math.abs(e.clientY - stemMouseDown.y) : 999;
  const wasClick = dx < 4 && dy < 4;
  stemMouseDown = null;

  if(wasClick && e.target.closest && e.target.closest('mark.hl')){
    const mark = e.target.closest('mark.hl');
    const idx = parseInt(mark.getAttribute('data-idx'), 10);
    removeHighlightAt(q.n, idx);
    window.getSelection().removeAllRanges();
    render();
    return;
  }

  const offsets = getSelectionOffsets(stemEl);
  if(offsets){
    addHighlight(q.n, offsets[0], offsets[1]);
    window.getSelection().removeAllRanges();
    render();
  }
});

/* Both go through goToItem, which really is the one way to move to an item:
   it is where the item clock is banked against the item being left, and
   stepping the cursor here instead would quietly bank the whole block
   against whichever item happened to be on screen when the clock started. */
function goPrev(){
  if(state.idx > 0) goToItem(state.idx - 1);
}
function goNext(){
  if(state.idx < QUESTIONS.length - 1) goToItem(state.idx + 1);
  else openReview();
}

document.getElementById('prevBtn').addEventListener('click', goPrev);
document.getElementById('prevBtn2').addEventListener('click', goPrev);
document.getElementById('nextBtn').addEventListener('click', goNext);
document.getElementById('nextBtn2').addEventListener('click', goNext);

document.getElementById('markChk').addEventListener('change', (e) => {
  state.marked[currentQ().n] = e.target.checked;
  saveState();
});

function markedIndexes(){
  const out = [];
  QUESTIONS.forEach((q, i) => { if(state.marked[q.n]) out.push(i); });
  return out;
}


/* Back to a blank block: the same erasure whether it is asked for from inside
   the exam (Restart) or from the start screen (Start over). `running` is the
   only difference between them — Restart hands you the first item with the
   clock already going, where Start over leaves it stopped until you begin.
   The mode and the clock are left as they were: Restart carries on in them
   (a timed block starts its full time again), and Start over hands the choice
   back to the start screen, which offers both again. */
function clearProgress(running){
  state.idx = 0;
  state.answers = {}; state.marked = {}; state.struck = {}; state.highlights = {};
  state.notes = {}; state.checked = {};
  state.graded = false; state.score = null; state.onResults = false;
  state.timeUp = false; state.timerOffAt = null; state.scoreAtTimeUp = null;
  state.gradedAt = null;
  resultsFilter = 'all'; resultsAttrs.clear(); resultsSort = {key:'item', dir:'asc'};
  expandedNotes.clear();
  state.paused = false;
  state.elapsedMs = 0; state.runningSince = running ? Date.now() : null;
  state.itemMs = {};
  state.itemSince = running ? Date.now() : null;
  state.itemSinceN = running ? QUESTIONS[0].n : null;
  saveState();
}

document.getElementById('restartBtn').addEventListener('click', () => {
  if(confirm('Restart the exam? This will clear all your selected answers and your score.')){
    clearProgress(true);
    showQuestionView();
    renderPause();
    render();
    scrollQuestionTop();
  }
});

let reviewReturnFocus = null;

function openReview(){
  const grid = document.getElementById('gridNav');
  grid.innerHTML = '';
  let answeredCount = 0, markedCount = 0, correctCount = 0, incorrectCount = 0;
  let pendingCount = 0;
  /* Tutor mode mid-block shows both kinds of item at once: checked ones in
     their result colours, and ones answered but not yet checked. The usual
     "answered" cell is the correct green, so beside real results it would
     read as right; those cells take a neutral state of their own instead. */
  const mixed = tutor() && !state.graded;
  QUESTIONS.forEach((q, i) => {
    const cell = document.createElement('button');
    cell.type = 'button';
    let cls = 'grid-cell';
    const answered = !!state.answers[q.n];
    const shown = revealed(q.n);
    if(answered) answeredCount++;
    if(state.marked[q.n]){ cls += ' marked'; markedCount++; }
    if(i === state.idx){ cls += ' current'; }
    if(shown && answered){
      if(isCorrect(q.n)){ cls += ' correct'; correctCount++; }
      else{ cls += ' incorrect'; incorrectCount++; }
    }else if(answered){
      cls += mixed ? ' pending' : ' answered';
      if(mixed) pendingCount++;
    }
    if(hasNote(q.n)) cls += ' has-note';
    cell.className = cls;
    cell.textContent = q.n;
    const bits = [answered ? 'answered' : 'unanswered'];
    if(shown && answered) bits.push(isCorrect(q.n) ? 'correct' : 'incorrect');
    else if(mixed && answered) bits.push('not checked');
    if(state.marked[q.n]) bits.push('marked for review');
    if(hasNote(q.n)) bits.push('has a note');
    cell.setAttribute('aria-label', 'Item ' + q.n + ' — ' + bits.join(', '));
    cell.title = bits.join(', ');
    cell.addEventListener('click', () => {
      closeReview();
      goToItem(i);
    });
    grid.appendChild(cell);
  });

  /* The key and the counts are one line: each colour says what it means and
     how many there are. Listing the key and then the same four words again
     as counts said everything twice. */
  const blank = QUESTIONS.length - answeredCount;
  const notedCount = QUESTIONS.filter(q => hasNote(q.n)).length;
  const key = (dot, n, word) =>
    `<span><span class="dot ${dot}"></span> <b>${n}</b> ${word}</span>`;
  const legend = document.getElementById('reviewLegend');
  legend.innerHTML = (state.graded
      ? key('c', correctCount, 'correct') + key('x', incorrectCount, 'incorrect')
      : mixed
        ? key('c', correctCount, 'correct') + key('x', incorrectCount, 'incorrect')
          + key('p', pendingCount, 'not checked')
        : key('a', answeredCount, 'answered'))
    + key('u', blank, 'unanswered')
    + key('m', markedCount, 'marked for review')
    + key('n', notedCount, notedCount === 1 ? 'note' : 'notes');
  /* Tutor mode's running score, said once in words above the grid. */
  const tally = mixed ? checkedTally() : null;
  document.getElementById('summaryRow').innerHTML = (tally && tally.checked)
    ? '<span><b>' + tally.correct + ' of ' + tally.checked + '</b> correct so far</span>' : '';
  document.getElementById('finishBtn').style.display = state.graded ? 'none' : '';
  // in tutor mode the item still open is the one not yet checked, answered or not
  const first = document.getElementById('firstUnansweredBtn');
  first.textContent = mixed ? 'Go to first unchecked' : 'Go to first unanswered';
  first.style.display = (!state.graded && firstOpenIndex() >= 0) ? '' : 'none';
  document.getElementById('firstMarkedBtn').style.display =
    (!state.graded && markedCount) ? '' : 'none';
  // graded: the overlay is a review tool, so it offers the way back to the
  // score and a jump straight to the first item you got wrong
  document.getElementById('backToResultsBtn').style.display = state.graded ? '' : 'none';
  document.getElementById('reviewIncorrectBtn').style.display =
    (state.graded && incorrectIndexes().length) ? '' : 'none';
  reviewReturnFocus = document.activeElement;
  document.getElementById('reviewOverlay').classList.add('show');
  document.getElementById('closeReview').focus();
}
function closeReview(){
  const overlay = document.getElementById('reviewOverlay');
  if(!overlay.classList.contains('show')) return;
  overlay.classList.remove('show');
  if(reviewReturnFocus && document.contains(reviewReturnFocus)){
    try{ reviewReturnFocus.focus(); }catch(e){}
  }
  reviewReturnFocus = null;
}
function firstOpenIndex(){
  return QUESTIONS.findIndex(q => tutor() ? !state.checked[q.n] : !state.answers[q.n]);
}
document.getElementById('firstUnansweredBtn').addEventListener('click', () => {
  const i = firstOpenIndex();
  if(i >= 0){
    closeReview();
    goToItem(i);
  }
});
document.getElementById('firstMarkedBtn').addEventListener('click', () => {
  const list = markedIndexes();
  if(!list.length) return;
  closeReview();
  goToItem(list[0]);
});
document.getElementById('reviewIncorrectBtn').addEventListener('click', () => {
  const list = incorrectIndexes();
  if(!list.length) return;
  closeReview();
  goToItem(list[0]);
});
document.getElementById('backToResultsBtn').addEventListener('click', () => {
  closeReview();
  showResults();
  scrollQuestionTop();
});
document.getElementById('resultsBtn').addEventListener('click', () => {
  showResults();
  scrollQuestionTop();
});
document.getElementById('nextIncorrectBtn').addEventListener('click', goToNextIncorrect);
document.getElementById('reviewOpenBtn').addEventListener('click', openReview);
document.getElementById('closeReview').addEventListener('click', closeReview);
document.getElementById('reviewOverlay').addEventListener('click', (e) => {
  if(e.target === e.currentTarget) closeReview();
});

document.getElementById('finishBtn').addEventListener('click', () => {
  /* Ending the block cannot be undone, so it always asks, and says what is
     still open: blanks, and items you meant to come back to. */
  const unanswered = QUESTIONS.length - Object.keys(state.answers).length;
  const marked = markedIndexes().length;
  // tutor mode: picked but never checked, which grading takes as they stand
  const unchecked = tutor()
    ? QUESTIONS.filter(q => state.answers[q.n] && !state.checked[q.n]).length : 0;
  const items = n => n + (n === 1 ? ' item is' : ' items are');
  const open = [];
  if(unanswered) open.push(items(unanswered) + ' unanswered');
  if(unchecked) open.push(items(unchecked) + ' answered but not checked');
  if(marked) open.push(items(marked) + ' marked for review');
  const said = open.length < 3 ? open.join(' and ')
             : open.slice(0, -1).join(', ') + ' and ' + open[open.length - 1];
  const lead = open.length ? said + '.\n\n' : '';
  if(!confirm(lead.charAt(0).toUpperCase() + lead.slice(1)
            + 'End the block and see your score? Answers cannot be changed after this.')) return;
  /* The confirmation stops the page, the clock's tick included, while the
     block clock still reads the wall clock. A timed block whose time ran out
     while it was open has run out, and ends that way, held at the limit. */
  if(state.timed && remainingMs() <= 0){ endAtTimeUp(); return; }
  gradeBlock();
});

function computeScore(){
  let correct = 0, incorrect = 0, unanswered = 0;
  QUESTIONS.forEach(q => {
    const a = state.answers[q.n];
    if(!a) unanswered++;
    else if(a === ANSWER_KEY[q.n]) correct++;
    else incorrect++;
  });
  return {correct, incorrect, unanswered, total: QUESTIONS.length};
}

/* The results table.
 *
 * Two filters, not one. `resultsFilter` is the item's state and the chips for
 * it replace one another; `resultsAttrs` holds attributes the item either
 * carries or does not, and those stack. That is the only way to ask for the
 * cohort a second pass is built from — the items missed that you had already
 * marked as shaky — which a single exclusive row of chips cannot express.
 *
 * Both, and the sort, persist across a trip out to an item and back, so the
 * list you built is still there when you return to it.
 */
let resultsFilter = 'all';
const resultsAttrs = new Set();
let resultsSort = {key:'item', dir:'asc'};
const expandedNotes = new Set();   // item numbers whose note is expanded in place

/* The first click on a header sorts the way that column is useful: items in
   form order, results with what needs attention on top, times slowest first. */
const SORT_DEFAULT_DIR = {item:'asc', result:'asc', time:'desc'};

function resultOf(n){
  if(!state.answers[n]) return 'unanswered';
  return state.answers[n] === ANSWER_KEY[n] ? 'correct' : 'incorrect';
}

/* The leading article carries nothing and costs the first characters of every
   row, where the width is scarcest. Everything after it is the form's own
   wording, untouched — the cell is clipped by CSS, not truncated here, so
   the row shows as much of the stem as its width allows. */
function stemSnippet(q){
  return (q.stem || '').replace(/\s+/g, ' ').trim().replace(/^(an?|the)\s+/i, '');
}

function formatItemTime(ms){
  const secs = Math.round(ms / 1000);
  return Math.floor(secs / 60) + ':' + pad(secs % 60);
}

function applyResultsFilter(key){
  if(key) resultsFilter = key;
  let shown = 0;
  document.querySelectorAll('#resultsBody tr.item-row').forEach(tr => {
    const show = (resultsFilter === 'all' || tr.dataset.result === resultsFilter) &&
      (!resultsAttrs.has('marked') || tr.dataset.marked === '1') &&
      (!resultsAttrs.has('noted')  || tr.dataset.noted  === '1');
    tr.style.display = show ? '' : 'none';
    // an expanded note belongs to its row and hides with it
    const note = tr.nextElementSibling;
    if(note && note.classList.contains('note-row')){
      note.style.display = show && expandedNotes.has(Number(tr.dataset.n)) ? '' : 'none';
    }
    if(show) shown++;
  });
  // an empty table under a filter reads as a glitch without a word of explanation
  document.getElementById('resultsEmpty').style.display = shown ? 'none' : '';
}

function buildResultFilters(score){
  const wrap = document.getElementById('resultsFilters');
  wrap.innerHTML = '';
  const markedCount = QUESTIONS.filter(q => state.marked[q.n]).length;
  const notedCount  = QUESTIONS.filter(q => hasNote(q.n)).length;

  const addChip = (key, label, attr, count) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'filter-chip' + (attr ? ' attr' : '');
    chip.dataset.key = key;
    chip.textContent = label;
    const on = attr ? resultsAttrs.has(key) : resultsFilter === key;
    chip.classList.toggle('active', on);
    chip.setAttribute('aria-pressed', String(on));
    // a chip that can only ever produce an empty table is not worth a click
    if(attr && !count && !on) chip.disabled = true;
    chip.addEventListener('click', () => {
      if(attr){
        if(resultsAttrs.has(key)) resultsAttrs.delete(key); else resultsAttrs.add(key);
      }else{
        resultsFilter = key;
      }
      buildResultFilters(score);
      applyResultsFilter();
    });
    wrap.appendChild(chip);
  };

  addChip('all',        `All (${score.total})`);
  addChip('correct',    `Correct (${score.correct})`);
  addChip('incorrect',  `Incorrect (${score.incorrect})`);
  addChip('unanswered', `Unanswered (${score.unanswered})`);

  const sep = document.createElement('div');
  sep.className = 'filter-sep';
  wrap.appendChild(sep);

  addChip('marked', `Marked (${markedCount})`, true, markedCount);
  addChip('noted',  `Has a note (${notedCount})`, true, notedCount);
}

function sortResultRows(){
  const rank = {incorrect:0, unanswered:1, correct:2};
  const dir = resultsSort.dir === 'desc' ? -1 : 1;
  const rows = QUESTIONS.slice();
  rows.sort((a, b) => {
    let d = 0;
    if(resultsSort.key === 'result')    d = rank[resultOf(a.n)] - rank[resultOf(b.n)];
    else if(resultsSort.key === 'time') d = itemMsFor(a.n) - itemMsFor(b.n);
    else                                d = a.n - b.n;
    return (d || a.n - b.n) * dir;
  });
  return rows;
}

function renderSortHeaders(){
  document.querySelectorAll('#resultsScreen .sort-btn').forEach(btn => {
    const on = btn.dataset.sort === resultsSort.key;
    if(on) btn.dataset.dir = resultsSort.dir; else delete btn.dataset.dir;
    btn.closest('th').setAttribute('aria-sort',
      on ? (resultsSort.dir === 'asc' ? 'ascending' : 'descending') : 'none');
  });
}

function toggleNoteRow(tr, btn){
  const n = Number(tr.dataset.n);
  const open = !expandedNotes.has(n);
  if(open) expandedNotes.add(n); else expandedNotes.delete(n);
  btn.setAttribute('aria-expanded', String(open));
  const existing = tr.nextElementSibling;
  if(existing && existing.classList.contains('note-row')) existing.remove();
  if(!open) return;
  const row = document.createElement('tr');
  row.className = 'note-row';
  const td = document.createElement('td');
  td.colSpan = 7;
  td.innerHTML = `<span class="note-label">My note on item ${n}</span>` +
                 `<div class="note-body">${escapeHtml(noteFor(n))}</div>`;
  row.appendChild(td);
  tr.after(row);
}

function buildResultsBody(){
  const body = document.getElementById('resultsBody');
  body.innerHTML = '';

  /* A block worked before per-item timing existed has nothing to put in the
     Time column, and fifty dashes read as a broken column rather than as an
     empty one. Nothing recorded, no column — the same rule that retired
     "Marked for Review".
     "Nothing recorded" is not "no item has a time": grading banks the seconds
     spent on whichever item was on screen, so a legacy block arrives with one
     stray fragment on it. The question worth asking is whether the per-item
     numbers account for the block's own clock. A block worked on this build
     answers for nearly all of it; a legacy block answers for a rounding
     error. A block half-worked before the update answers for about half,
     and there the column is worth keeping. */
  const timedMs = answerMs();
  const blockMs = elapsedMs();
  /* A tutor block cannot predate per-item timing, and one saved before the
     block clock stopped on checked items carried on through the
     explanations, so the proportion is no test of anything there: a block
     read carefully would lose its Time column for it. */
  const anyTime = tutor() ? timedMs > 0
                : (blockMs > 0 ? timedMs >= blockMs * 0.2 : timedMs > 0);
  const table = document.querySelector('.results-table');
  if(table) table.classList.toggle('no-times', !anyTime);
  if(!anyTime && resultsSort.key === 'time') resultsSort = {key:'item', dir:'asc'};
  renderSortHeaders();

  const slowMs = slowThresholdMs();

  sortResultRows().forEach(q => {
    const result = resultOf(q.n);
    const ans = state.answers[q.n];
    const key = ANSWER_KEY[q.n] || '—';
    const marked = !!state.marked[q.n];
    const noted = hasNote(q.n);
    const ms = itemMsFor(q.n);

    const tr = document.createElement('tr');
    tr.className = 'item-row row-' + result + (marked ? ' is-marked' : '');
    tr.dataset.n = q.n;
    tr.dataset.result = result;
    tr.dataset.marked = marked ? '1' : '';
    tr.dataset.noted = noted ? '1' : '';

    // two plainly labelled cells: what you picked, and what the form says.
    // Nothing to decode, which a compact "B -> C" notation asked you to do.
    const yourCell = result === 'unanswered'
      ? '<span class="blank">&mdash;</span>'
      : escapeHtml(ans);

    const pill = {
      correct:    '<span class="result-pill c"><span class="g" aria-hidden="true">&#10003;</span>Correct</span>',
      incorrect:  '<span class="result-pill x"><span class="g" aria-hidden="true">&#10007;</span>Incorrect</span>',
      unanswered: '<span class="result-pill u"><span class="g" aria-hidden="true">&ndash;</span>Unanswered</span>'
    }[result];

    const slow = ms > 0 && ms >= slowMs;
    const timeCell = ms > 0
      ? `<span class="${slow ? 'slow' : ''}"${slow ? ' title="Well over this block’s median time per item"' : ''}>${formatItemTime(ms)}</span>`
      : '<span class="no-time">&mdash;</span>';

    tr.innerHTML =
      `<td class="cell-item">${q.n}` +
        /* The mark is a record of how the item felt while you were answering
           it, so the results screen shows it and does not offer to change it.
           Marking after the fact, with the key in front of you, would overwrite
           that with hindsight. The row's aria-label carries it for a reader. */
        (marked ? '<span class="flag-ico" aria-hidden="true"></span>' : '') +
        (noted ? `<button type="button" class="note-btn" aria-expanded="false" title="Read my note">` +
                 `<span class="note-ico"></span><span class="sr-only">Show my note on item ${q.n}</span></button>` : '') +
      `</td>` +
      `<td class="cell-stem"><span class="stem-text">${escapeHtml(stemSnippet(q))}</span></td>` +
      `<td class="cell-ans">${yourCell}</td>` +
      `<td class="cell-key">${escapeHtml(key)}</td>` +
      `<td class="cell-res">${pill}</td>` +
      `<td class="cell-time">${timeCell}</td>` +
      `<td class="cell-go"><span class="chev" aria-hidden="true">&rsaquo;</span></td>`;

    // the row is a control: reachable and operable from the keyboard too
    tr.tabIndex = 0;
    tr.setAttribute('role', 'button');
    const bits = [result === 'unanswered' ? 'unanswered' : result];
    if(result === 'incorrect') bits.push(`you answered ${ans}, correct answer ${key}`);
    if(marked) bits.push('marked for review');
    if(noted) bits.push('has a note');
    if(ms > 0) bits.push(formatItemTime(ms) + ' on this item');
    tr.setAttribute('aria-label', `Item ${q.n}, ${bits.join(', ')}. Open this item.`);

    const open = () => goToItem(QUESTIONS.findIndex(x => x.n === q.n));
    tr.addEventListener('click', e => {
      // the note button acts on the row without opening the item
      const note = e.target.closest('.note-btn');
      if(note){ e.stopPropagation(); toggleNoteRow(tr, note); return; }
      open();
    });
    tr.addEventListener('keydown', e => {
      if(e.target !== tr) return;   // let the buttons inside handle their own keys
      if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); open(); }
    });
    body.appendChild(tr);
  });

  applyResultsFilter();   // rows exist now, so the filter can bite
}

document.querySelectorAll('#resultsScreen .sort-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const key = btn.dataset.sort;
    if(resultsSort.key === key){
      resultsSort.dir = resultsSort.dir === 'asc' ? 'desc' : 'asc';
    }else{
      resultsSort = {key, dir: SORT_DEFAULT_DIR[key] || 'asc'};
    }
    expandedNotes.clear();      // the rows are about to be rebuilt underneath them
    buildResultsBody();
  });
});

function showResults(){
  stopItemClock();    // no item on screen, so no item is accruing time
  renderPause();
  closeLabValues();   // the split layout has no question to sit beside now
  document.getElementById('quizMain').style.display = 'none';
  document.querySelector('footer.botbar').style.display = 'none';
  document.getElementById('resultsScreen').style.display = 'block';
  renderToolbar();    // after the switch, so it sees the results screen
  renderNotes();      // no item on screen, so the notes window goes too
  state.onResults = true;
  saveState();
  pushView('results');

  const score = computeScore();
  const {correct, incorrect, unanswered, total} = score;
  const pct = Math.round((correct/total)*100);

  document.getElementById('scorePercent').textContent = pct + '%';
  // the breakdown beside it already says "30 Correct"
  document.getElementById('scoreFrac').textContent = '';
  const answeredN = total - unanswered;
  /* A tutor-mode score was worked with the answers coming in as it went, so
     the line says so; and its pace is time to answer, made from the item
     times (see answerMs). */
  /* A timed block says so, and says its time against the limit it had. */
  document.getElementById('scoreTime').textContent = (tutor() ? 'Tutor mode · ' : '')
    + (state.timed ? (state.timeUp ? 'Time ran out · ' : 'Timed · ')
       : (ranOver() ? 'Untimed after time ran out · '
          : (timerWentOff() ? 'Timer off at ' + formatDuration(state.timerOffAt) + ' · ' : '')))
    + formatDuration(elapsedMs())
    + (state.timed ? ' of ' + formatDuration(timeLimitMs()) : ' elapsed')
    + (answeredN ? ' · ' + formatItemTime(paceMs(answeredN))
                 + (tutor() ? ' per item to answer' : ' per item') : '');
  /* A block that ended at zero says so. One that ran out and kept going says
     how it stood at the limit, which is its timed score. */
  const upNote = document.getElementById('timeUpNote');
  upNote.hidden = !(state.timeUp || ranOver());
  if(state.timeUp){
    upNote.textContent = 'Time ran out, and the block ended there. Anything left blank counts as unanswered.';
  }else if(ranOver()){
    const a = state.scoreAtTimeUp;
    upNote.textContent = 'Time ran out at ' + humanDuration(state.timerOffAt)
      + ' and you kept going untimed. When it ran out you had ' + a.correct + ' of ' + a.total
      + ' correct (' + pctOf(a) + '%), with ' + a.unanswered + ' unanswered.';
  }
  /* What most people do next is work through what they missed, so that is
     the first button; going back to wherever the block ended is second, and
     says which item that is. */
  const missed = incorrect + unanswered;
  const rm = document.getElementById('reviewMissedBtn');
  rm.style.display = missed ? '' : 'none';
  rm.textContent = 'Review missed items (' + missed + ')';
  const back = document.getElementById('backToExamBtn');
  back.textContent = 'Back to item ' + currentQ().n;
  back.classList.toggle('secondary', !!missed);
  document.getElementById('bCorrect').textContent = correct;
  document.getElementById('bIncorrect').textContent = incorrect;
  document.getElementById('bUnanswered').textContent = unanswered;
  buildResultFilters(score);
  updateProgress();
  buildResultsBody();
}

document.getElementById('reviewMissedBtn').addEventListener('click', () => {
  const list = incorrectIndexes();
  if(list.length) goToItem(list[0]);
});
document.getElementById('backToExamBtn').addEventListener('click', () => {
  showQuestionView();
  render();
  scrollQuestionTop();
});

/* The results screen and the start screen of a scored block both offer this. */
function downloadResults(){
  const {correct, incorrect, unanswered, total} = computeScore();
  const pct = Math.round((correct/total)*100);
  let lines = [EXAM.title + ' - Results',
    EXAM.label ? EXAM.label : null,
    tutor() ? 'Tutor mode: each answer was checked as it was given' : null,
    state.timed ? 'Timed: ' + formatDuration(timeLimitMs()) + ' limit'
                  + (state.timeUp ? ', and time ran out' : '')
      : (ranOver() ? 'Timed: ' + formatDuration(timeLimitMs()) + ' limit. Time ran out and the '
                     + 'block carried on untimed. Score when time ran out: '
                     + state.scoreAtTimeUp.correct + ' of ' + state.scoreAtTimeUp.total
                     + ' correct (' + pctOf(state.scoreAtTimeUp) + '%)'
        : (timerWentOff() ? 'Timed until ' + formatDuration(state.timerOffAt)
                            + ', then the timer was turned off' : null)),
    `Score: ${correct} of ${total} correct (${pct}%)`,
    `Incorrect: ${incorrect}    Unanswered: ${unanswered}`,
    `Time elapsed: ${formatDuration(elapsedMs())}`,
    '',
    // the file is restorable, and the only place that said so was buried at the
    // foot of it, inside the block a reader is least likely to reach
    'This file can be read back: Import progress at the foot of the exam list',
    'puts these answers, notes and highlights into another browser.',
    ''].filter(l => l !== null);
  QUESTIONS.forEach(q => {
    const ans = state.answers[q.n] || '(unanswered)';
    const correctLetter = ANSWER_KEY[q.n] || '?';
    const result = !state.answers[q.n] ? 'UNANSWERED' : (state.answers[q.n] === correctLetter ? 'CORRECT' : 'INCORRECT');
    const ms = itemMsFor(q.n);
    // the same two facts the screen now shows beside the letters
    const extra = [ms > 0 ? formatItemTime(ms) : null, state.marked[q.n] ? 'marked' : null]
      .filter(Boolean).join(', ');
    lines.push(`Item ${q.n}: your answer = ${ans}, correct = ${correctLetter}  [${result}]` +
               (extra ? `  (${extra})` : ''));
  });
  // your own notes are the part of a block worth keeping, so they come along
  const noted = QUESTIONS.filter(q => hasNote(q.n));
  if(noted.length){
    lines.push('', 'My notes', '--------');
    noted.forEach(q => {
      lines.push(`Item ${q.n}:`);
      noteFor(q.n).split('\n').forEach(l => lines.push('  ' + l));
      lines.push('');
    });
  }
  /* The report is for reading; the block underneath it is the same block the
     exam list exports, so this one file is both the record of the attempt and
     the thing that puts the attempt back in another browser. saveState first,
     since the block is read out of storage rather than out of `state`. */
  saveState();
  const text = lines.join('\n')
             + SHELF_TRANSFER.wrap(SHELF_TRANSFER.payload([EXAM]));
  /* Named so it sits beside the exam list's own export in a downloads folder,
     and so the name says which form it is rather than repeating the title. */
  SHELF_TRANSFER.download(
    'shelfpractice-' + EXAM.slug + '-' + new Date().toISOString().slice(0, 10) + '.txt',
    text);
}
document.getElementById('downloadBtn').addEventListener('click', downloadResults);
document.getElementById('startDownloadBtn').addEventListener('click', downloadResults);

/* Import lives on the start screen, before an exam is under way: it writes
   over saved progress, which is a thing to do on the way in and not in the
   middle. It restores every exam the file holds, not only this one, and the
   reload is what makes the engine pick up what was written. */
document.getElementById('startImportBtn').addEventListener('click', () => {
  SHELF_TRANSFER.pick((text, name) => {
    SHELF_TRANSFER.importFrom(text == null ? '' : text, window.EXAMS || [],
      () => location.reload(), name);
  });
});

/* Another tab writing this exam's record — importing into it, or simply being
   the same exam open twice — leaves this tab holding a copy that is no longer
   what is saved, and the next thing it saves would overwrite the other. There
   is nothing here to merge with, so the notice says what is true and leaves the
   choice alone. The storage event does not fire in the tab that did the
   writing, so this only ever speaks about somebody else's change. */
window.addEventListener('storage', (e) => {
  if(e.key !== STORAGE_KEY) return;
  document.getElementById('staleNote').hidden = false;
});
document.getElementById('staleReload').addEventListener('click', () => location.reload());
document.getElementById('staleDismiss').addEventListener('click', () => {
  document.getElementById('staleNote').hidden = true;
});

// timer
function pad(n){ return String(n).padStart(2,'0'); }
function formatDuration(ms){
  const secs = Math.floor(ms/1000);
  const h = Math.floor(secs/3600), m = Math.floor((secs%3600)/60), s = secs%60;
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}
// "1 h 12 min", for the start screen, where seconds are noise
function humanDuration(ms){
  const mins = Math.floor(ms / 60000), h = Math.floor(mins / 60);
  return h ? h + ' h ' + (mins % 60) + ' min' : (mins ? mins + ' min' : 'under a minute');
}
/* A timed block shows what is left, an untimed one what has gone. The
   countdown rounds up, so it reads 00:00:00 only at the moment it ends. */
function counting(){ return state.timed && !state.graded; }
// a block that began timed and had its timer turned off partway
function timerWentOff(){ return !state.timed && state.timerOffAt != null; }
function clockText(){
  return counting()
    ? formatDuration(Math.ceil(remainingMs() / 1000) * 1000)
    : formatDuration(elapsedMs());
}
function tickTimer(){
  const label = clockText();
  /* A tutor block's clock stopped on a checked item says nothing about it:
     the figure simply stands still, the way question banks do it. */
  const word = counting()
    ? (state.paused ? 'Paused, remaining: ' : 'Remaining: ')
    : (state.paused ? 'Paused: ' : 'Elapsed: ');
  const timer = document.getElementById('timer');
  timer.innerHTML = '<span class="timer-label">' + word + '</span>' + label;
  timer.classList.toggle('is-paused', state.paused);
  timer.classList.toggle('is-low', counting() && !state.paused && remainingMs() <= 5 * 60000);
  document.getElementById('timerOffBtn').hidden = !counting();
  if(state.paused){
    const el = document.getElementById('pausedElapsed');
    if(el) el.textContent = label;
  }
  // only a block someone is in can run out; the start screen just reports it
  if(counting() && enteredExam && !state.paused && !timeUpOpen && remainingMs() <= 0) timeUp();
}
setInterval(tickTimer, 1000);

/* ---------- pause ---------- */

let enteredExam = false;   // the overlay belongs to the exam, not the start screen

/* The toolbar tracks what is on screen: no clock control once the block is
   graded, and no Lab Values on the results screen, where there is no question
   to read them against. */
function renderToolbar(){
  const onResults = document.getElementById('resultsScreen').style.display === 'block';
  const pause = document.getElementById('pauseBtn');
  if(pause) pause.style.display = state.graded ? 'none' : '';
  const lab = document.getElementById('labValuesBtn');
  if(lab) lab.style.display = onResults ? 'none' : '';
  // notes belong to an item, so they go away with the question view
  const notes = document.getElementById('notesBtn');
  if(notes) notes.style.display = onResults ? 'none' : '';
  // once graded, the Pause slot becomes the way back to the score
  const results = document.getElementById('resultsBtn');
  if(results) results.style.display = (state.graded && !onResults) ? '' : 'none';
  /* The item counter, Previous/Next and the subbar all describe the current
     question. On the results screen there is none, so they are at best inert
     and at worst misleading: the subbar's "Mark for review" box would flag a
     question the user cannot see, and its answered count goes stale the
     moment the block is graded. */
  document.querySelector('.topbar-center').style.display = onResults ? 'none' : '';
  document.querySelector('.item-box').style.display = onResults ? 'none' : '';
  document.querySelector('.subbar').style.display = onResults ? 'none' : '';
  measureBars();
}

/* Items that were not answered correctly — wrong answers and blanks alike,
   which together are what "review my incorrects" means. */
function incorrectIndexes(){
  const out = [];
  QUESTIONS.forEach((q, i) => { if(!isCorrect(q.n)) out.push(i); });
  return out;
}

function goToNextIncorrect(){
  const list = incorrectIndexes();
  if(!list.length) return;
  const next = list.find(i => i > state.idx);
  goToItem(next === undefined ? list[0] : next);   // wrap around
}

/* Paused covers the top bar, so the card restates where you are: which exam,
   which item, and how the block stands. It is a glance, not a report — the
   numbers that reward study belong to the results screen. */
function renderPauseFigures(){
  const answered = Object.keys(state.answers).length;

  const where = document.getElementById('pauseWhere');
  if(where){
    // which exam; how far through it is the "answered" figure below, and
    // "item 40 of 50" beside "39 / 50" read as two counts of one thing
    where.textContent = [SUBJECT,
                         (EXAM.label || '').replace(/^CMS\s+/i, ''),
                         tutor() ? 'Tutor mode' : '',
                         state.timed ? 'Timed' : '']
                        .filter(Boolean).join(' · ');
  }
  /* The same bar the start screen draws, so the two say it the same way. */
  const fill = document.getElementById('pauseFill');
  if(fill){
    fill.style.width = (answered / QUESTIONS.length) * 100 + '%';
    document.getElementById('pauseBar').setAttribute('aria-label',
      answered + ' of ' + QUESTIONS.length + ' items answered');
  }
  /* Three figures, each with its own label, rather than one sentence strung
     together with dots that read as a run-on. A timed block's clock figure
     is the time left, since that is the one it is racing. */
  const ans = document.getElementById('pausedAnswered');
  if(ans) ans.textContent = answered + ' / ' + QUESTIONS.length;
  const clockLabel = document.getElementById('pausedElapsedLabel');
  if(clockLabel) clockLabel.textContent = counting() ? 'left' : 'elapsed';
  document.getElementById('pauseTimerOffBtn').hidden = !counting();
  const pace = document.getElementById('pausedPace');
  if(pace){
    document.getElementById('pausedPaceWrap').style.display = answered ? '' : 'none';
    if(answered) pace.textContent = formatItemTime(paceMs(answered));
    // the same figure the results screen gives, under the same name
    document.getElementById('pausedPaceLabel').textContent =
      tutor() ? 'per item to answer' : 'per item';
  }
}

function renderPause(){
  renderToolbar();
  const screen = document.getElementById('pauseScreen');
  if(!screen) return;
  screen.style.display = (state.paused && enteredExam) ? 'flex' : 'none';
  // the question must not be readable while the clock is stopped
  document.getElementById('examBody').style.visibility =
    (state.paused || timeUpOpen) ? 'hidden' : '';
  renderNotes();   // it floats outside examBody, so it is not hidden for free
  if(state.paused) renderPauseFigures();
  tickTimer();
}

function pauseExam(){
  if(state.paused || state.graded || timeUpOpen) return;
  stopClock();
  state.paused = true;
  closeReview();
  closeLightbox();   // no part of the question may stay readable while paused
  saveState();
  renderPause();
}

function resumeExam(){
  if(!state.paused) return;
  state.paused = false;
  startClock();
  saveState();
  renderPause();
  render();
}

document.getElementById('pauseBtn').addEventListener('click', pauseExam);
document.getElementById('resumeExamBtn').addEventListener('click', resumeExam);

/* ---------- enlarged exhibit ---------- */

function openLightbox(){
  const src = document.getElementById('qimg').src;
  if(!src) return;
  document.getElementById('imgZoom').src = src;
  document.getElementById('imgOverlay').classList.add('show');
}
function closeLightbox(){
  document.getElementById('imgOverlay').classList.remove('show');
  document.getElementById('imgZoom').src = '';
}
function lightboxOpen(){
  return document.getElementById('imgOverlay').classList.contains('show');
}
document.getElementById('qimg').addEventListener('click', openLightbox);
document.getElementById('imgOverlay').addEventListener('click', closeLightbox);

/* ---------- text size ---------- */

/* How large the question text is set is a reading preference, not progress
   through a block: it lives under its own key, outside any exam's saved state,
   so it holds for every exam in this browser and survives Start Over. */
const TEXT_SIZE_KEY = 'shelfpractice_text_size';
const TEXT_SIZES = ['s', 'm', 'l', 'xl'];

function currentTextSize(){
  try{
    const saved = localStorage.getItem(TEXT_SIZE_KEY);
    if(TEXT_SIZES.indexOf(saved) !== -1) return saved;
  }catch(e){}
  return 'm';
}
function applyTextSize(size){
  // "m" is the stylesheet's own scale, so it carries no attribute at all
  if(size === 'm') document.documentElement.removeAttribute('data-text-size');
  else document.documentElement.setAttribute('data-text-size', size);
  document.querySelectorAll('.size-opt').forEach(b => {
    const on = b.dataset.size === size;
    b.classList.toggle('active', on);
    b.setAttribute('aria-checked', on ? 'true' : 'false');
  });
}
function setTextSize(size){
  applyTextSize(size);
  try{ localStorage.setItem(TEXT_SIZE_KEY, size); }catch(e){}
}
function stepTextSize(dir){
  const i = TEXT_SIZES.indexOf(currentTextSize());
  const next = TEXT_SIZES[Math.min(TEXT_SIZES.length - 1, Math.max(0, i + dir))];
  if(next !== currentTextSize()) setTextSize(next);
  showSizePop(true);
}
function sizePopOpen(){
  return !document.getElementById('sizePop').hidden;
}
function showSizePop(show){
  const pop = document.getElementById('sizePop');
  pop.hidden = !show;
  document.getElementById('textSizeBtn')
          .setAttribute('aria-expanded', show ? 'true' : 'false');
}

applyTextSize(currentTextSize());
document.getElementById('textSizeBtn').addEventListener('click', (e) => {
  e.stopPropagation();
  showSizePop(!sizePopOpen());
});
document.querySelectorAll('.size-opt').forEach(b => {
  b.addEventListener('click', () => {
    setTextSize(b.dataset.size);
    showSizePop(false);
  });
});
// a click anywhere else puts the panel away
document.addEventListener('click', (e) => {
  if(sizePopOpen() && !(e.target.closest && e.target.closest('.tb-wrap'))){
    showSizePop(false);
  }
});

// keyboard shortcuts: left/right arrows navigate, letter keys select option,
// M toggles "mark for review", Enter checks the answer in tutor mode, Esc
// closes the review overlay or pauses
document.addEventListener('keydown', (e) => {
  // keystrokes aimed at a text field (e.g. the lab-values search box) must
  // never drive the exam
  const t = e.target;
  if(t && t.matches &&
     t.matches('input:not([type=checkbox]):not([type=radio]), textarea, select')) return;
  // the import dialog is modal and handles its own keys
  if(document.querySelector('.tr-overlay')) return;
  // so is the time-up card: a choice there is a click, or Enter on its button
  if(timeUpOpen) return;

  if(!enteredExam){
    // on the start screen only Enter does anything: begin, or resume
    if(e.key === 'Enter' && !(t && t.closest && t.closest('button, summary, a')) &&
       document.getElementById('startScreen').style.display !== 'none'){
      const resuming = !document.getElementById('resumeRow').hidden;
      document.getElementById(resuming ? 'resumeBtn' : 'beginBtn').click();
    }
    return;
  }

  if(state.paused){
    // nothing but resuming while the exam is paused
    if(e.key === 'Escape' || e.key === 'Enter'){ resumeExam(); }
    return;
  }
  if(e.key === 'Escape' && sizePopOpen()){
    showSizePop(false);
    return;
  }
  // the text-size keys work wherever there is text to read, results included
  if(e.key === '-' || e.key === '_'){ e.preventDefault(); stepTextSize(-1); return; }
  if(e.key === '+' || e.key === '='){ e.preventDefault(); stepTextSize(1); return; }
  if(e.key === 'Escape' && lightboxOpen()){
    closeLightbox();
    return;
  }
  /* The review grid and the enlarged exhibit are modal: a letter or an arrow
     pressed over them must not answer or move the item hidden underneath. */
  if(document.getElementById('reviewOverlay').classList.contains('show')){
    if(e.key === 'Escape') closeReview();
    return;
  }
  if(lightboxOpen()) return;
  if(document.getElementById('resultsScreen').style.display === 'block') return;
  if(e.key === 'Escape'){ pauseExam(); return; }
  if(e.ctrlKey || e.metaKey || e.altKey) return;   // browser shortcuts stay browser shortcuts
  /* Enter checks the answer in tutor mode. Not when a button or link has the
     focus: Enter is already that control's own key, and checking as well
     would make Enter on a focused Next both check the item and leave it. */
  if(e.key === 'Enter'){
    if(t && t.closest && t.closest('button, a, summary')) return;
    if(tutor()){ e.preventDefault(); checkAnswer(); }
    return;
  }
  if(e.key === 'ArrowRight'){ e.preventDefault(); goNext(); }
  else if(e.key === 'ArrowLeft'){ e.preventDefault(); goPrev(); }
  else if(e.key === 'm' || e.key === 'M'){
    const q = currentQ();
    state.marked[q.n] = !state.marked[q.n];
    saveState();
    document.getElementById('markChk').checked = !!state.marked[q.n];
  }
  // N opens/closes the notes panel — no exam here has an option N to shadow,
  // but the guard keeps that true if one ever does
  else if((e.key === 'n' || e.key === 'N') &&
          !currentQ().options.some(o => o[0] === 'N')){
    e.preventDefault();
    toggleNotes();
  }
  else if(!revealed(currentQ().n)){
    const letter = e.key.toUpperCase();
    const q = currentQ();
    if(q.options.some(o => o[0] === letter)){
      state.answers[q.n] = letter;
      saveState();
      render();
    }
  }
});

/* ---------- loading / start screen ---------- */

/* Reloading a tab you are already working in should drop you straight back
   into the exam: the start screen's resume / start-over choice only means
   anything when you arrive fresh. sessionStorage is per-tab and dies with the
   tab, which is exactly that distinction — a reload keeps it, a new tab or a
   later visit does not. */
const SESSION_KEY = 'exam_session_' + EXAM.id;
function markSessionEntered(){
  try{ sessionStorage.setItem(SESSION_KEY, '1'); }catch(e){}
}
function enteredThisSession(){
  try{ return sessionStorage.getItem(SESSION_KEY) === '1'; }catch(e){ return false; }
}

function enterExam(){
  document.getElementById('startScreen').style.display = 'none';
  document.getElementById('app').style.display = 'block';
  /* The bars had no height to measure while the start screen covered them. */
  measureBars();
  enteredExam = true;
  markSessionEntered();
  startClock();          // no-op if the exam is paused or already graded
  saveState();
  renderPause();
  // come back to whichever view was showing, not always the score
  if(state.graded && state.onResults){
    showResults();
  }else{
    showQuestionView();
    render();
  }
}

/* Which mode and which clock the start screen offers first: the ones last
   chosen in this browser. Like the text size they are preferences rather than
   progress, so they live under their own keys and outlive any one exam's
   saved state. */
const MODE_KEY = 'shelfpractice_mode';
const CLOCK_KEY = 'shelfpractice_clock';
function preferredMode(){
  try{ return localStorage.getItem(MODE_KEY) === 'tutor' ? 'tutor' : 'exam'; }
  catch(e){ return 'exam'; }
}
function preferredClock(){
  try{ return localStorage.getItem(CLOCK_KEY) === 'timed' ? 'timed' : 'untimed'; }
  catch(e){ return 'untimed'; }
}
function pickedMode(){
  const r = document.querySelector('input[name="mode"]:checked');
  return r && r.value === 'tutor' ? 'tutor' : 'exam';
}
function pickedClock(){
  const r = document.querySelector('input[name="clock"]:checked');
  return r && r.value === 'timed' ? 'timed' : 'untimed';
}
function showModePick(mode){
  document.querySelectorAll('input[name="mode"]').forEach(r => { r.checked = r.value === mode; });
}
function showClockPick(clock){
  document.querySelectorAll('input[name="clock"]').forEach(r => { r.checked = r.value === clock; });
  renderClockNote();
}
/* The line under the clock says what the choice will do, and the button says
   which one it is about to start. */
function renderClockNote(){
  const timed = pickedClock() === 'timed';
  document.getElementById('clockNote').textContent = timed
    ? 'The clock counts down from ' + formatDuration(timeLimitMs()) + '. At zero you can end '
      + 'the block, as the real form does, or keep going untimed. Pause stops it, and you can '
      + 'turn the timer off at any point.'
    : 'No limit. The clock counts up, and Pause stops it whenever you step away.';
  document.getElementById('beginLabel').textContent = timed ? 'Begin timed exam' : 'Begin exam';
}
document.querySelectorAll('input[name="clock"]').forEach(r =>
  r.addEventListener('change', renderClockNote));

/* The block's own figures, which do not change with its state. */
document.getElementById('factItems').textContent = QUESTIONS.length;
document.getElementById('factPace').textContent =
  'per item, ' + humanDuration(timeLimitMs()) + ' in all';
document.getElementById('timedName').textContent = 'Timed, ' + humanDuration(timeLimitMs());

/* ---------- this subject's other forms ---------- */

/* Every form of the subject, newest first, in the order the exam list uses,
   so the side column and the list agree on what "next" means. Their saved
   progress is read the way the list reads it, without loading their data. */
const SHORT_SUBJECT = {'Obstetrics and Gynecology': 'OB/GYN'};
const subjectName = SHORT_SUBJECT[SUBJECT] || SUBJECT;
const formCollator = new Intl.Collator(undefined, {numeric: true, sensitivity: 'base'});
const SIBLINGS = (window.EXAMS || [])
  .filter(e => (e.title.replace(/\s+Practice Exams?$/i, '') || e.title) === SUBJECT)
  .sort((a, b) => formCollator.compare(b.label || b.title, a.label || a.title));
function formName(e){ return (e.label || e.title).replace(/^CMS\s+/i, ''); }

function hasProgress(){
  return Object.keys(state.answers).length > 0 || state.graded ||
         state.paused || elapsedMs() > 0;
}
/* Where a form stands: this one from the live state, the others from what
   their own pages saved. */
function standingOf(e){
  let s;
  if(e.slug === EXAM.slug){
    if(!hasProgress()) return {kind: 'new'};
    s = state;
  }else{
    s = window.SHELF_TRANSFER ? SHELF_TRANSFER.readState(e) : null;
    if(!s) return {kind: 'new'};
  }
  if(s.graded && s.score && s.score.total){
    return {kind: 'done', correct: s.score.correct, total: s.score.total,
            pct: Math.round((s.score.correct / s.score.total) * 100)};
  }
  const answered = Object.keys(s.answers || {}).length;
  if(answered || s.elapsedMs || s.runningSince){
    const total = e.slug === EXAM.slug ? QUESTIONS.length : (e.items || 0);
    return {kind: 'going', answered, total};
  }
  return {kind: 'new'};
}

function renderForms(){
  const card = document.getElementById('formsCard');
  card.hidden = SIBLINGS.length < 2;
  if(card.hidden) return;
  document.getElementById('formsHead').textContent = 'Your ' + subjectName + ' forms';
  const list = document.getElementById('formList');
  list.innerHTML = '';
  SIBLINGS.forEach(e => {
    const here = e.slug === EXAM.slug;
    const p = standingOf(e);
    const row = document.createElement(here ? 'div' : 'a');
    row.className = 'form-row' + (here ? ' is-here' : '');
    if(!here) row.href = 'exam.html?exam=' + encodeURIComponent(e.slug);
    let said, stateHTML;
    if(p.kind === 'done'){
      said = p.pct + '%, ' + p.correct + ' of ' + p.total + ' correct';
      stateHTML = '<span><b>' + p.pct + '%</b> · ' + p.correct + ' of ' + p.total + '</span>';
    }else if(p.kind === 'going'){
      said = p.answered + ' of ' + p.total + ' answered';
      const w = p.total ? Math.min(100, (p.answered / p.total) * 100) : 0;
      stateHTML = '<span class="mini-track" aria-hidden="true"><span class="mini-fill" style="width:'
                + w + '%"></span></span>' + p.answered + ' of ' + p.total;
    }else{
      said = 'not started';
      stateHTML = 'Not started';
    }
    row.innerHTML = '<span class="form-name">' + escapeHtml(formName(e))
      + (here ? '<span class="here-tag">This form</span>' : '') + '</span>'
      + '<span class="form-state">' + stateHTML + '</span>';
    if(!here) row.setAttribute('aria-label', formName(e) + ', ' + said);
    const li = document.createElement('li');
    li.append(row);
    list.append(li);
  });
}

/* Once a form is scored, the useful question is which one to take next: the
   newest of the subject not yet started, or failing that the newest one left
   half done. With every form scored there is nothing to suggest. */
function renderNextUp(){
  const card = document.getElementById('nextCard');
  card.hidden = true;
  if(!state.graded) return;
  const others = SIBLINGS.filter(e => e.slug !== EXAM.slug)
                         .map(e => ({e, p: standingOf(e)}));
  const fresh = others.find(x => x.p.kind === 'new');
  const going = others.find(x => x.p.kind === 'going');
  const pick = fresh || going;
  if(!pick) return;
  const name = formName(pick.e);
  document.getElementById('nextSay').textContent = fresh
    ? name + ' is the newest ' + subjectName + ' form you have not started.'
    : name + ' is still under way: ' + pick.p.answered + ' of ' + pick.p.total + ' answered.';
  document.getElementById('nextGoLabel').textContent = (fresh ? 'Start ' : 'Resume ') + name;
  document.getElementById('nextGo').href = 'exam.html?exam=' + encodeURIComponent(pick.e.slug);
  card.hidden = false;
}

/* "today", "yesterday", or the date, the way the exam list says it. */
function whenSaid(ms){
  if(!ms) return '';
  const d = new Date(ms), now = new Date();
  const day = x => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(now) - day(d)) / 86400000);
  if(diff <= 0) return 'today';
  if(diff === 1) return 'yesterday';
  return d.toLocaleDateString(undefined, {month: 'short', day: 'numeric'});
}

function itemCount(n){ return n + (n === 1 ? ' item' : ' items'); }

/* ---------- the start screen ---------- */

/* One of three states. A block with nothing in it says what it is and offers
   the mode, the clock and Begin. A block under way says where it stands and
   how its pace is going, and offers Resume. A scored block gives the score
   and the way into what was missed. The choices stay out of reach once a
   block has begun: they are fixed for the attempt, and Start over is how they
   are chosen again. The one exception is a timed block's timer, which can be
   turned off partway (see turnOffTimer), though never back on. */
function renderStart(){
  const going = hasProgress();
  const graded = going && state.graded;
  document.getElementById('freshBlock').hidden = going;
  document.getElementById('progressBlock').hidden = !going || graded;
  document.getElementById('scoreBlock').hidden = !graded;
  document.getElementById('resumeRow').hidden = !going;
  document.getElementById('startImportBtn').hidden = graded;
  document.getElementById('startDownloadBtn').hidden = !graded;
  renderForms();
  renderNextUp();

  const note = document.getElementById('examNote');
  const foot = document.getElementById('startFootText');
  if(!going){
    note.textContent = (SIBLINGS.length > 1 && SIBLINGS[0].slug === EXAM.slug)
      ? 'Newest of ' + SIBLINGS.length + ' ' + subjectName + ' forms' : '';
    foot.textContent = 'Progress saves in this browser only.';
    showModePick(preferredMode());
    showClockPick(preferredClock());
    return;
  }

  const answered = Object.keys(state.answers).length;
  const total = QUESTIONS.length;
  const marked = markedIndexes();
  const resume = document.getElementById('resumeLabel');
  const markedBtn = document.getElementById('startMarkedBtn');
  const missedBtn = document.getElementById('startMissedBtn');

  if(graded){
    note.textContent = state.gradedAt ? 'Finished ' + whenSaid(state.gradedAt) : 'Scored';
    foot.textContent = 'Starting over clears this score. Download it first to keep a copy.';
    const s = state.score || computeScore();
    const pct = Math.round((s.correct / s.total) * 100);
    document.getElementById('startPct').textContent = pct + '%';
    document.getElementById('startFrac').innerHTML = '<b>' + s.correct + '</b> of ' + s.total + ' correct';
    const answeredN = s.total - s.unanswered;
    document.getElementById('scoreMeta').textContent = [
      tutor() ? 'Tutor mode' : 'Exam mode',
      state.timed ? (state.timeUp ? 'time ran out' : 'timed')
                  : (ranOver() ? pctOf(state.scoreAtTimeUp) + '% when time ran out'
                    : (timerWentOff() ? 'timer turned off' : '')),
      humanDuration(elapsedMs()),
      answeredN ? formatItemTime(paceMs(answeredN)) + ' per item' : ''
    ].filter(Boolean).join(' · ');
    [['segC', 'keyC', s.correct], ['segX', 'keyX', s.incorrect], ['segU', 'keyU', s.unanswered]]
      .forEach(([seg, key, n]) => {
        const el = document.getElementById(seg);
        el.style.flex = n + ' 1 0';
        el.hidden = !n;
        document.getElementById(key).textContent = n;
      });
    document.getElementById('splitBar').setAttribute('aria-label',
      s.correct + ' correct, ' + s.incorrect + ' incorrect, ' + s.unanswered + ' unanswered');
    resume.textContent = state.onResults ? 'Back to your results' : 'Continue reviewing';
    const missed = incorrectIndexes().length;
    missedBtn.hidden = !missed;
    missedBtn.textContent = 'Review missed items (' + missed + ')';
    markedBtn.hidden = true;
    document.getElementById('startTimerOffBtn').hidden = true;
    return;
  }

  /* Under way: the button says exactly where it goes, the figures say how
     far along the block is, and the controls fold away under their heading. */
  const last = whenSaid(state.savedAt);
  note.textContent = last ? 'Last worked on ' + last : '';
  foot.textContent = state.timed
    ? 'The mode is fixed for this attempt. The timer can be turned off, but not back on.'
    : 'The mode and clock are fixed for this attempt. Start over to change them.';
  document.getElementById('resumeCount').textContent = answered + ' of ' + total + ' answered';
  document.getElementById('resumeMode').textContent =
    (tutor() ? 'Tutor mode' : 'Exam mode') + ', '
    + (state.timed ? 'timed'
       : (ranOver() ? 'untimed after time ran out' : (timerWentOff() ? 'timer turned off' : 'untimed')))
    + (state.paused ? ', paused' : '');
  document.getElementById('startTimerOffBtn').hidden = !state.timed;
  document.getElementById('resumeFill').style.width = (answered / total) * 100 + '%';
  document.getElementById('resumeTrack').setAttribute('aria-label',
    answered + ' of ' + total + ' items answered');
  document.getElementById('figNext').textContent = 'Item ' + currentQ().n;
  const figMarked = document.getElementById('figMarked');
  figMarked.textContent = marked.length ? itemCount(marked.length) : 'None';
  figMarked.classList.toggle('is-marked', marked.length > 0);
  document.getElementById('figTimeLabel').textContent = state.timed ? 'Left' : 'Elapsed';
  document.getElementById('figTime').textContent =
    humanDuration(state.timed ? remainingMs() : elapsedMs());

  /* Pace is time per answered item, measured the way the results screen
     measures it, and set beside the 90 seconds the real form allows. */
  const pace = answered ? paceMs(answered) : 0;
  // a record with no item times (one saved before they were kept) has no pace
  const paced = pace >= 1000;
  document.getElementById('figPaceWrap').hidden = !paced;
  document.getElementById('figPace').textContent = formatItemTime(pace);
  document.getElementById('figPaceUnit').textContent = tutor() ? 'per item to answer' : 'per item';
  const left = total - answered;
  const bits = [];
  if(tutor()){
    const t = checkedTally();
    if(t.checked) bits.push(t.correct + ' of ' + t.checked + ' checked so far are right.');
  }
  if(state.timed){
    bits.push(left
      ? humanDuration(remainingMs()) + ' left for ' + itemCount(left) + ': '
        + formatItemTime(remainingMs() / left) + ' per item from here.'
      : 'Every item answered, with ' + humanDuration(remainingMs()) + ' to spare.');
  }else if(paced){
    const rest = Math.round((left * pace) / 60000) * 60000;
    bits.push((pace <= SHELF_PACE_MS ? 'Under' : 'Over') + ' the '
      + formatItemTime(SHELF_PACE_MS) + ' shelf pace.'
      + (left ? ' At this rate the last ' + itemCount(left) + ' take '
                + (rest ? 'about ' + humanDuration(rest) : 'under a minute') + '.' : ''));
  }
  document.getElementById('paceNote').textContent = bits.join(' ');

  resume.textContent = 'Resume at item ' + currentQ().n;
  markedBtn.hidden = !marked.length;
  document.getElementById('startMarkedLabel').textContent =
    'Go to marked items (' + marked.length + ')';
  missedBtn.hidden = true;
}

document.getElementById('beginBtn').addEventListener('click', () => {
  state.mode = pickedMode();
  state.timed = pickedClock() === 'timed';
  try{
    localStorage.setItem(MODE_KEY, state.mode);
    localStorage.setItem(CLOCK_KEY, state.timed ? 'timed' : 'untimed');
  }catch(e){}
  enterExam();
});
/* Resume on the start screen is already the decision to carry on, so an exam
   left paused does not stop at the pause card to be resumed a second time.
   The two shortcuts beside it are the same decision with a destination: the
   first marked item, or the first one missed, from which Next incorrect and
   the review grid take over. */
function enterAt(i){
  state.paused = false;
  enterExam();
  if(i >= 0) goToItem(i);
}
document.getElementById('resumeBtn').addEventListener('click', () => enterAt(-1));
document.getElementById('startMarkedBtn').addEventListener('click', () => {
  const list = markedIndexes();
  enterAt(list.length ? list[0] : -1);
});
document.getElementById('startMissedBtn').addEventListener('click', () => {
  const list = incorrectIndexes();
  enterAt(list.length ? list[0] : -1);
});
/* Starting over is starting again, and starting is where the mode and the
   clock are chosen, so it lands on the fresh start screen with the ones it
   had still selected rather than going straight in. One more Enter, and the
   choice is real. */
document.getElementById('startOverBtn').addEventListener('click', () => {
  // this throws away everything, so it asks first — the same guard Restart has
  if(!confirm('Start this exam over? This clears your answers, highlights, notes and score.')) return;
  const wasMode = state.mode, wasClock = state.timed ? 'timed' : 'untimed';
  clearProgress(false);
  renderStart();
  showModePick(wasMode);
  showClockPick(wasClock);
  document.getElementById('beginBtn').focus();
});
document.getElementById('checkBtn').addEventListener('click', checkAnswer);
['timerOffBtn', 'pauseTimerOffBtn', 'startTimerOffBtn'].forEach(id =>
  document.getElementById(id).addEventListener('click', turnOffTimer));
document.getElementById('timeEndBtn').addEventListener('click', endAtTimeUp);
document.getElementById('timeKeepBtn').addEventListener('click', keepGoingUntimed);

/* Closing, reloading or navigating away stops the clock, so time away from
   the page is never time on the block; entering again restarts it. The one
   exception is a tab that another tab has written over since (the stale
   notice is up): saving here would overwrite that newer work. */
window.addEventListener('pagehide', () => {
  if(!enteredExam || !document.getElementById('staleNote').hidden) return;
  if(!state.runningSince && !state.itemSince) return;
  stopClock();
  saveState();
});
window.addEventListener('pageshow', (e) => {
  // restored from the back-forward cache, where no load runs to restart it
  if(e.persisted && enteredExam){ startClock(); saveState(); }
});

/* ---------- per-item notes ---------- */

/* A note belongs to an item, not to the block, so the panel always shows the
   note for whatever item is on screen. Typing writes straight into state and
   only the localStorage write is debounced, so every other path that saves
   (navigating, answering, grading) already persists what you have typed. */

const notesPanel = document.getElementById('notesPanel');
const notesText = document.getElementById('notesText');
const notesBtn = document.getElementById('notesBtn');

function noteFor(n){ return state.notes[n] || ''; }
function hasNote(n){ return !!noteFor(n).trim(); }

/* The window floats over everything, so unlike the rest of the question view
   it is not hidden for free: it has to stand down for the pause screen and for
   the results screen, neither of which has an item it could belong to. */
function notesShouldShow(){
  return state.notesOpen && !state.paused && !timeUpOpen &&
         document.getElementById('resultsScreen').style.display !== 'block';
}

function renderNotes(){
  if(!notesPanel) return;
  const q = currentQ();
  notesPanel.style.display = notesShouldShow() ? '' : 'none';
  if(notesShouldShow()) placeNotes();
  document.getElementById('notesItem').textContent = q.n;
  // never overwrite what is being typed; this also keeps the caret put
  if(notesText.value !== noteFor(q.n)) notesText.value = noteFor(q.n);
  if(notesBtn){
    notesBtn.classList.toggle('has-note', hasNote(q.n));
    notesBtn.setAttribute('aria-expanded', notesShouldShow() ? 'true' : 'false');
  }
}

/* ---------- where the window sits ---------- */

/* Geometry is remembered so the window stays where you put it, across items
   and across reloads. Below the phone breakpoint the stylesheet docks it to
   the bottom of the screen and the inline geometry is dropped, because there
   is nowhere useful to drag to on a small screen. */

const NOTES_MIN_W = 240, NOTES_MIN_H = 170;

function notesDocked(){ return window.innerWidth <= 640; }

/* ---------- the pinned bars ---------- */

/* The toolbar, the subbar and the progress track stay put while the question
   scrolls. The stylesheet pins them; it cannot know how tall they are, and the
   toolbar reflows with the window — the subject line drops out at 1180px, the
   item box at 760px, and the whole bar wraps to two rows when the tools no
   longer fit. So the heights are measured and published as --topbar-h and
   --subbar-h, which is what the bars below them offset against.
   Rounding up by a hair: a fractional height left a one-pixel line of the
   scrolling question showing between two bars that are meant to touch. */
function measureBars(){
  const root = document.documentElement.style;
  const bar  = document.querySelector('header.topbar');
  const sub  = document.querySelector('.subbar');
  root.setProperty('--topbar-h', (bar ? Math.ceil(bar.getBoundingClientRect().height) : 0) + 'px');
  /* The subbar is hidden on the results screen, where it has no height to
     give; getBoundingClientRect says 0 for it, which is the right answer. */
  root.setProperty('--subbar-h', (sub ? Math.ceil(sub.getBoundingClientRect().height) : 0) + 'px');
}
measureBars();
if(window.ResizeObserver){
  const barWatch = new ResizeObserver(measureBars);
  ['header.topbar', '.subbar'].forEach(sel => {
    const el = document.querySelector(sel);
    if(el) barWatch.observe(el);
  });
}else{
  /* No observer: a resize is the case that actually moves these heights. */
  window.addEventListener('resize', measureBars);
}

function topbarBottom(){
  const bar = document.querySelector('header.topbar');
  return bar ? bar.getBoundingClientRect().bottom : 0;
}

/* Keep the window on screen and clear of the toolbar, whatever the viewport
   has done since it was last positioned (resized, rotated, zoomed). */
function clampNotes(pos){
  const w = Math.min(Math.max(pos.w || 340, NOTES_MIN_W), window.innerWidth - 8);
  const h = Math.min(Math.max(pos.h || 260, NOTES_MIN_H), window.innerHeight - 8);
  const minY = topbarBottom() + 6;
  return {
    x: Math.min(Math.max(pos.x, 4), Math.max(4, window.innerWidth - w - 4)),
    y: Math.min(Math.max(pos.y, minY), Math.max(minY, window.innerHeight - h - 4)),
    w, h
  };
}

/* Opens in the top right of the question area — clear of the toolbar and of
   the subbar's answered count and clock, which you want to keep an eye on. */
function defaultNotesPos(){
  const w = 340, h = 260;
  const track = document.querySelector('.progress-track');
  const top = track ? track.getBoundingClientRect().bottom : topbarBottom();
  /* inside the exam panel, not against the window edge: on a wide screen the
     panel is centred and the window edge is out in the grey margin */
  const app = document.getElementById('app');
  const right = app ? app.getBoundingClientRect().right : window.innerWidth;
  return {x: Math.max(4, right - w - 24), y: top + 18, w, h};
}

function placeNotes(){
  if(notesDocked()){
    // the stylesheet owns the docked layout; inline geometry would fight it
    notesPanel.style.left = notesPanel.style.top = '';
    notesPanel.style.width = notesPanel.style.height = '';
    return;
  }
  const pos = clampNotes(state.notesPos || defaultNotesPos());
  state.notesPos = pos;
  notesPanel.style.left = pos.x + 'px';
  notesPanel.style.top = pos.y + 'px';
  notesPanel.style.width = pos.w + 'px';
  notesPanel.style.height = pos.h + 'px';
}

/* Dragging by the title bar. Pointer capture keeps the drag alive even when
   the pointer outruns the window. */
const notesHead = document.getElementById('notesHead');
if(notesHead){
  let drag = null;
  notesHead.addEventListener('pointerdown', (e) => {
    if(notesDocked() || e.target.closest('button')) return;
    const r = notesPanel.getBoundingClientRect();
    drag = {dx: e.clientX - r.left, dy: e.clientY - r.top, id: e.pointerId};
    notesHead.setPointerCapture(e.pointerId);
    notesHead.classList.add('dragging');
    e.preventDefault();              // no text selection while dragging
  });
  notesHead.addEventListener('pointermove', (e) => {
    if(!drag || e.pointerId !== drag.id) return;
    const r = notesPanel.getBoundingClientRect();
    state.notesPos = clampNotes({x: e.clientX - drag.dx, y: e.clientY - drag.dy,
                                 w: r.width, h: r.height});
    notesPanel.style.left = state.notesPos.x + 'px';
    notesPanel.style.top = state.notesPos.y + 'px';
  });
  const endDrag = (e) => {
    if(!drag || (e && e.pointerId !== drag.id)) return;
    drag = null;
    notesHead.classList.remove('dragging');
    saveState();                     // remember where it was let go
  };
  notesHead.addEventListener('pointerup', endDrag);
  notesHead.addEventListener('pointercancel', endDrag);
}

/* The window is CSS-resizable; record the size the browser gives it. */
if(window.ResizeObserver && notesPanel){
  let sizeTimer = null;
  new ResizeObserver(() => {
    if(!state.notesOpen || notesDocked() || notesPanel.style.display === 'none') return;
    const r = notesPanel.getBoundingClientRect();
    if(!r.width || !r.height) return;
    const pos = state.notesPos || defaultNotesPos();
    if(Math.round(r.width) === pos.w && Math.round(r.height) === pos.h) return;
    state.notesPos = {x: pos.x, y: pos.y, w: Math.round(r.width), h: Math.round(r.height)};
    clearTimeout(sizeTimer);
    sizeTimer = setTimeout(saveState, 400);
  }).observe(notesPanel);
}

window.addEventListener('resize', () => {
  if(state.notesOpen && notesPanel.style.display !== 'none') placeNotes();
});

let notesSaveTimer = null;
let notesStatusTimer = null;

function flashNotesSaved(){
  const el = document.getElementById('notesStatus');
  if(!el) return;
  el.textContent = 'Saved';
  el.classList.add('show');
  clearTimeout(notesStatusTimer);
  notesStatusTimer = setTimeout(() => el.classList.remove('show'), 1400);
}

if(notesText){
  notesText.addEventListener('input', () => {
    const q = currentQ();
    if(notesText.value.trim()) state.notes[q.n] = notesText.value;
    else delete state.notes[q.n];        // an emptied note is no note at all
    if(notesBtn) notesBtn.classList.toggle('has-note', hasNote(q.n));
    clearTimeout(notesSaveTimer);
    notesSaveTimer = setTimeout(() => {
      notesSaveTimer = null;
      saveState();
      flashNotesSaved();
    }, 400);
  });
  /* Leaving the field, the page or the tab must not lose the last keystrokes —
     but only ever write when a keystroke is actually pending. An unconditional
     write here would push this tab's state over whatever another tab has saved
     since, just for navigating away. */
  const flushNotes = () => {
    if(!notesSaveTimer) return;
    clearTimeout(notesSaveTimer);
    notesSaveTimer = null;
    saveState();
  };
  notesText.addEventListener('blur', flushNotes);
  window.addEventListener('pagehide', flushNotes);
  document.addEventListener('visibilitychange', () => {
    if(document.visibilityState === 'hidden') flushNotes();
  });
}

function openNotes(focus){
  state.notesOpen = true;
  saveState();
  renderNotes();
  if(focus !== false){
    notesText.focus();
    // typing continues where you left off rather than at the start
    const end = notesText.value.length;
    notesText.setSelectionRange(end, end);
  }
}
function closeNotes(){
  clearTimeout(notesSaveTimer);
  notesSaveTimer = null;      // the saveState below covers the pending write
  state.notesOpen = false;
  saveState();
  renderNotes();
}
function toggleNotes(){
  /* A plain switch: the control that opened the window closes it. It used to
     re-focus the field instead when the window was open but unfocused, which
     meant the button could never put it away — clicking the button is itself
     what takes focus off the field. */
  state.notesOpen ? closeNotes() : openNotes();
}

if(notesBtn) notesBtn.addEventListener('click', toggleNotes);
const notesCloseBtn = document.getElementById('notesClose');
if(notesCloseBtn) notesCloseBtn.addEventListener('click', closeNotes);
const notesClearBtn = document.getElementById('notesClear');
if(notesClearBtn){
  notesClearBtn.addEventListener('click', () => {
    const q = currentQ();
    if(!hasNote(q.n)){ notesText.focus(); return; }
    if(!confirm('Clear your note on item ' + q.n + '?')) return;
    delete state.notes[q.n];
    notesText.value = '';
    clearTimeout(notesSaveTimer);
    notesSaveTimer = null;
    saveState();
    renderNotes();
    notesText.focus();
  });
}

/* ---------- Lab Values panel (splits the layout, reflowing the question) ---------- */

let lvSide = null;

function labValuesOpen(){
  return !!lvSide;
}
function toggleLabValues(){
  labValuesOpen() ? closeLabValues() : openLabValues();
}
function openLabValues(){
  if(lvSide) return;
  const examBody = document.getElementById('examBody');
  lvSide = document.createElement('div');
  lvSide.className = 'lv-side';
  examBody.appendChild(lvSide);
  examBody.classList.add('with-lab');
  document.getElementById('app').classList.add('lab-open');

  renderLabValues(lvSide, {
    showClose: true,
    onClose: closeLabValues
  });
  const b = document.getElementById('labValuesBtn');
  if(b) b.setAttribute('aria-expanded', 'true');
}

function closeLabValues(){
  if(!lvSide) return;
  document.getElementById('examBody').classList.remove('with-lab');
  document.getElementById('app').classList.remove('lab-open');
  lvSide.remove();
  lvSide = null;
  const b = document.getElementById('labValuesBtn');
  if(b) b.setAttribute('aria-expanded', 'false');
}

const labBtn = document.getElementById('labValuesBtn');
if(labBtn) labBtn.addEventListener('click', toggleLabValues);

loadState();
// a fresh arrival, not a reload of this tab: whatever was running has stopped
if(!enteredThisSession()) bankAbandonedClock();
renderPause();

/* The loading screen covers the real work — the manifest, this exam's
   data.js and the lab values all have to load before we get here. There is
   nothing left to wait for at this point, so show the start screen straight
   away rather than holding it behind a timer. */
document.getElementById('loadingScreen').style.display = 'none';

/* How this page was reached. A reload, or Back and Forward, returns to the
   exam as it was left, paused included. Following a link to it (the exam
   list's Resume, a start screen's Next up) is the decision to carry on, the
   same as the start screen's own Resume, so a paused block resumes there
   rather than stopping at the pause card to be resumed a second time, which
   also flashed the loading page before the navy card. */
function arrivedByLink(){
  try{
    const nav = performance.getEntriesByType('navigation')[0];
    return !!nav && nav.type === 'navigate';
  }catch(e){ return false; }
}

if(enteredThisSession()){
  // same tab, already working here: a reload should not interrupt
  if(arrivedByLink() && state.paused && !state.graded) state.paused = false;
  enterExam();
}else{
  document.getElementById('startScreen').style.display = 'block';
  renderStart();
  // a first visit gets the controls open; a returning one has read them
  document.getElementById('startHelp').open = !hasProgress();
}
