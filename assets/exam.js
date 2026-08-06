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
document.getElementById('loadingText').textContent = 'Loading ' + EXAM.title + '…';
document.getElementById('examName').textContent = EXAM.title;
document.getElementById('examSub').textContent = QUESTIONS.length + ' items · untimed';
document.getElementById('examTitleBar').textContent = EXAM.title;
if(EXAM.label){
  const chip = document.getElementById('examLabel');
  chip.textContent = EXAM.label;
  chip.style.display = '';
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
  paused: false,
  graded: false,
  score: null,   // {correct, incorrect, unanswered, total}; saved at grading so
                 // the landing page can show the result without the answer key
  onResults: false  // which view was showing, so a reload comes back to it
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
function saveState(){
  try{
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      idx: state.idx, answers: state.answers, marked: state.marked, struck: state.struck,
      highlights: state.highlights, notes: state.notes,
      notesOpen: state.notesOpen, notesPos: state.notesPos,
      graded: state.graded, paused: state.paused,
      score: state.score, onResults: state.onResults,
      elapsedMs: state.elapsedMs, runningSince: state.runningSince
    }));
  }catch(e){}
}

/* ---------- the clock ---------- */

function elapsedMs(){
  return state.elapsedMs + (state.runningSince ? Date.now() - state.runningSince : 0);
}
function startClock(){
  if(!state.runningSince && !state.paused && !state.graded) state.runningSince = Date.now();
}
function stopClock(){
  if(state.runningSince){
    state.elapsedMs += Date.now() - state.runningSince;
    state.runningSince = null;
  }
}

function currentQ(){ return QUESTIONS[state.idx]; }

function isCorrect(n){
  return state.answers[n] && ANSWER_KEY[n] && state.answers[n] === ANSWER_KEY[n];
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

  const selected = state.answers[q.n];
  const correctLetter = ANSWER_KEY[q.n];

  // graded banner
  const banner = document.getElementById('gradedBanner');
  if(state.graded){
    banner.classList.add('show');
    if(!selected){
      banner.className = 'graded-banner show unanswered-banner';
      banner.textContent = `Not answered. Correct answer: ${correctLetter}.`;
    }else if(selected === correctLetter){
      banner.className = 'graded-banner show correct-banner';
      banner.textContent = `Correct — you selected ${selected}.`;
    }else{
      banner.className = 'graded-banner show incorrect-banner';
      banner.textContent = `Incorrect — you selected ${selected}. Correct answer: ${correctLetter}.`;
    }
  }else{
    banner.className = 'graded-banner';
    banner.textContent = '';
  }

  const optsDiv = document.getElementById('qoptions');
  optsDiv.innerHTML = '';
  q.options.forEach(([letter, text]) => {
    const row = document.createElement('div');
    const strikeKey = q.n + '_' + letter;
    const isStruck = !!state.struck[strikeKey];
    let cls = 'opt' + (selected === letter ? ' selected' : '') + (isStruck ? ' struck' : '');
    let tag = '';
    if(state.graded){
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
    const strikeBtn = state.graded ? '' : `<span class="strike-toggle${isStruck ? ' active' : ''}" title="Cross out this choice">ab</span>`;
    row.innerHTML = `<input type="radio" name="opt" id="opt_${letter}" ${selected===letter?'checked':''} ${state.graded?'disabled':''}>
      <label for="opt_${letter}"><span class="letter">${letter}.</span> ${escapeHtml(text)}</label>${tag}${strikeBtn}`;
    if(!state.graded){
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

  // explanation (shown only after the exam is graded / during review)
  const expEl = document.getElementById('explanation');
  const expHtml = state.graded && EXAM.explanations ? EXAM.explanations[q.n] : null;
  if(expHtml){
    expEl.innerHTML = '<div class="exp-h">Explanation</div>' + expHtml;
    expEl.style.display = '';
  }else{
    expEl.innerHTML = '';
    expEl.style.display = 'none';
  }

  renderNotes();

  document.getElementById('markChk').checked = !!state.marked[q.n];

  const note = document.getElementById('answeredNote');
  if(note){
    if(state.graded){
      const s = state.score || computeScore();
      note.textContent = `Score: ${s.correct} of ${s.total} correct`;
    }else{
      note.textContent = `${Object.keys(state.answers).length} of ${QUESTIONS.length} answered`;
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

/* Swap the results screen out for the question view. Item navigation can be
   triggered from the review overlay while Exam Complete is on screen, and
   rendering the question underneath it would otherwise change nothing the
   user can see. */
function showQuestionView(){
  document.getElementById('resultsScreen').style.display = 'none';
  document.getElementById('quizMain').style.display = '';
  document.querySelector('footer.botbar').style.display = '';
  state.onResults = false;
  renderNotes();
  saveState();
}

/* The one way to move to an item: it always ends with that item on screen. */
function goToItem(i){
  if(i < 0 || i >= QUESTIONS.length) return;
  state.idx = i;
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

/* Plain text of a question, in the same order the DOM renders it. */
function stemText(q){
  let text = q.stem;
  (q.labs || []).forEach(group => {
    if(group.name) text += group.name;
    (group.head || []).forEach(c => { text += c; });
    group.rows.forEach(row => row.forEach(c => { text += c; }));
  });
  return text + (q.stemTail || '');
}

function renderStemHTML(q, ranges){
  const indexed = (ranges || []).slice().sort((a,b) => a[0]-b[0]).map((r,i) => ({r, i}));
  if(!q.labs || !q.labs.length) return markUp(q.stem, indexed, 0);

  let off = 0;
  let html = '<div class="stem-p">' + markUp(q.stem, indexed, off) + '</div>';
  off += q.stem.length;

  html += '<table class="lab-table">';
  q.labs.forEach(group => {
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
        html += `<td class="${ci === 0 ? 'lab-name' : 'lab-val'}">`
              + markUp(cell, indexed, off) + '</td>';
        off += cell.length;
      });
      html += '</tr>';
    });
  });
  html += '</table>';

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

function goPrev(){
  if(state.idx > 0){ state.idx--; saveState(); render(); scrollQuestionTop(); }
}
function goNext(){
  if(state.idx < QUESTIONS.length - 1){ state.idx++; saveState(); render(); scrollQuestionTop(); }
  else { openReview(); }
}

document.getElementById('prevBtn').addEventListener('click', goPrev);
document.getElementById('prevBtn2').addEventListener('click', goPrev);
document.getElementById('nextBtn').addEventListener('click', goNext);
document.getElementById('nextBtn2').addEventListener('click', goNext);

document.getElementById('markChk').addEventListener('change', (e) => {
  state.marked[currentQ().n] = e.target.checked;
  saveState();
});

document.getElementById('restartBtn').addEventListener('click', () => {
  if(confirm('Restart the exam? This will clear all your selected answers and your score.')){
    state.idx = 0; state.answers = {}; state.marked = {}; state.struck = {}; state.highlights = {}; state.graded = false;
    state.notes = {};
    state.score = null; state.onResults = false;
    resultsFilter = 'all';
    state.elapsedMs = 0; state.runningSince = Date.now(); state.paused = false;
    saveState();
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
  QUESTIONS.forEach((q, i) => {
    const cell = document.createElement('button');
    cell.type = 'button';
    let cls = 'grid-cell';
    const answered = !!state.answers[q.n];
    if(answered) answeredCount++;
    if(state.marked[q.n]){ cls += ' marked'; markedCount++; }
    if(i === state.idx){ cls += ' current'; }
    if(state.graded){
      if(answered && isCorrect(q.n)){ cls += ' correct'; correctCount++; }
      else if(answered && !isCorrect(q.n)){ cls += ' incorrect'; incorrectCount++; }
    }else if(answered){
      cls += ' answered';
    }
    if(hasNote(q.n)) cls += ' has-note';
    cell.className = cls;
    cell.textContent = q.n;
    const bits = [answered ? 'answered' : 'unanswered'];
    if(state.graded && answered) bits.push(isCorrect(q.n) ? 'correct' : 'incorrect');
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

  const legend = document.getElementById('reviewLegend');
  if(state.graded){
    legend.innerHTML = `<span><span class="dot c"></span> Correct</span>
      <span><span class="dot x"></span> Incorrect</span>
      <span><span class="dot u"></span> Unanswered</span>
      <span><span class="dot m" style="border-radius:50%"></span> Marked for review</span>
      <span><span class="dot n"></span> Has a note</span>`;
  }else{
    legend.innerHTML = `<span><span class="dot a"></span> Answered</span>
      <span><span class="dot u"></span> Unanswered</span>
      <span><span class="dot m" style="border-radius:50%"></span> Marked for review</span>
      <span><span class="dot n"></span> Has a note</span>`;
  }

  let summary = `<span><b>${answeredCount}</b> of ${QUESTIONS.length} answered</span>
     <span><b>${QUESTIONS.length - answeredCount}</b> unanswered</span>
     <span><b>${markedCount}</b> marked for review</span>`;
  if(state.graded){
    summary += `<span><b>${correctCount}</b> correct</span><span><b>${incorrectCount}</b> incorrect</span>`;
  }
  document.getElementById('summaryRow').innerHTML = summary;
  document.getElementById('finishBtn').style.display = state.graded ? 'none' : '';
  document.getElementById('firstUnansweredBtn').style.display =
    (!state.graded && answeredCount < QUESTIONS.length) ? '' : 'none';
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
document.getElementById('firstUnansweredBtn').addEventListener('click', () => {
  const i = QUESTIONS.findIndex(q => !state.answers[q.n]);
  if(i >= 0){
    closeReview();
    goToItem(i);
  }
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
  const unanswered = QUESTIONS.length - Object.keys(state.answers).length;
  if(unanswered > 0){
    if(!confirm(`You have ${unanswered} unanswered item(s). End the block and see your score anyway?`)) return;
  }
  state.graded = true;
  state.score = computeScore();
  stopClock();            // the block is over; the clock stops with it
  saveState();
  closeReview();
  showResults();
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

/* Filter chips above the results table: All / Incorrect / Unanswered / Marked.
   The choice sticks, so stepping out to an item and back does not drop you
   from "Incorrect" back to the full list every time. */
let resultsFilter = 'all';

function applyResultsFilter(key){
  resultsFilter = key;
  document.querySelectorAll('#resultsFilters .filter-chip').forEach(c => {
    c.classList.toggle('active', c.dataset.key === key);
  });
  let shown = 0;
  document.querySelectorAll('#resultsBody tr').forEach(tr => {
    const show = key === 'all' ||
      (key === 'marked' ? tr.dataset.marked === '1' : tr.dataset.result === key);
    tr.style.display = show ? '' : 'none';
    if(show) shown++;
  });
  // an empty table under a filter reads as a glitch without a word of explanation
  document.getElementById('resultsEmpty').style.display = shown ? 'none' : '';
}

function buildResultFilters(score){
  const wrap = document.getElementById('resultsFilters');
  wrap.innerHTML = '';
  const markedCount = QUESTIONS.filter(q => state.marked[q.n]).length;
  const defs = [
    ['all',        `All (${score.total})`],
    ['incorrect',  `Incorrect (${score.incorrect})`],
    ['unanswered', `Unanswered (${score.unanswered})`],
    ['marked',     `Marked (${markedCount})`]
  ];
  defs.forEach(([key, label]) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'filter-chip';
    chip.dataset.key = key;
    chip.textContent = label;
    chip.addEventListener('click', () => applyResultsFilter(key));
    wrap.appendChild(chip);
  });
}

function showResults(){
  renderPause();
  closeLabValues();   // the split layout has no question to sit beside now
  document.getElementById('quizMain').style.display = 'none';
  document.querySelector('footer.botbar').style.display = 'none';
  document.getElementById('resultsScreen').style.display = 'block';
  renderToolbar();    // after the switch, so it sees the results screen
  renderNotes();      // no item on screen, so the notes window goes too
  state.onResults = true;
  saveState();

  const score = computeScore();
  const {correct, incorrect, unanswered, total} = score;
  const pct = Math.round((correct/total)*100);

  document.getElementById('scorePercent').textContent = pct + '%';
  document.getElementById('scoreFrac').textContent = `${correct} of ${total} correct`;
  document.getElementById('scoreTime').textContent = 'Time on block: ' + formatDuration(elapsedMs());
  document.getElementById('bCorrect').textContent = correct;
  document.getElementById('bIncorrect').textContent = incorrect;
  document.getElementById('bUnanswered').textContent = unanswered;
  buildResultFilters(score);
  updateProgress();

  const body = document.getElementById('resultsBody');
  body.innerHTML = '';
  QUESTIONS.forEach(q => {
    const tr = document.createElement('tr');
    const ans = state.answers[q.n] || '—';
    const correctLetter = ANSWER_KEY[q.n] || '—';
    let rowCls, badge, result;
    if(!state.answers[q.n]){ rowCls = 'row-unanswered'; badge = 'Unanswered'; result = 'unanswered'; }
    else if(state.answers[q.n] === ANSWER_KEY[q.n]){ rowCls = 'row-correct'; badge = 'Correct'; result = 'correct'; }
    else { rowCls = 'row-incorrect'; badge = 'Incorrect'; result = 'incorrect'; }
    tr.className = rowCls;
    tr.dataset.result = result;
    tr.dataset.marked = state.marked[q.n] ? '1' : '';
    tr.innerHTML = `<td>${q.n}</td><td>${ans}</td><td>${correctLetter}</td><td class="result-badge">${badge}</td><td>${state.marked[q.n] ? 'Yes' : ''}</td>`;
    // the row is a control: reachable and operable from the keyboard too
    tr.style.cursor = 'pointer';
    tr.tabIndex = 0;
    tr.setAttribute('role', 'button');
    tr.setAttribute('aria-label', `Item ${q.n}, ${badge}. Go to this item.`);
    const open = () => goToItem(QUESTIONS.findIndex(x => x.n === q.n));
    tr.addEventListener('click', open);
    tr.addEventListener('keydown', e => {
      if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); open(); }
    });
    body.appendChild(tr);
  });

  applyResultsFilter(resultsFilter);   // rows exist now, so the filter can bite
}

document.getElementById('backToExamBtn').addEventListener('click', () => {
  showQuestionView();
  render();
  scrollQuestionTop();
});

document.getElementById('downloadBtn').addEventListener('click', () => {
  const {correct, incorrect, unanswered, total} = computeScore();
  const pct = Math.round((correct/total)*100);
  let lines = [EXAM.title + ' - Results',
    EXAM.label ? EXAM.label : null,
    `Score: ${correct} of ${total} correct (${pct}%)`,
    `Incorrect: ${incorrect}    Unanswered: ${unanswered}`,
    `Time on block: ${formatDuration(elapsedMs())}`, ''].filter(l => l !== null);
  QUESTIONS.forEach(q => {
    const ans = state.answers[q.n] || '(unanswered)';
    const correctLetter = ANSWER_KEY[q.n] || '?';
    const result = !state.answers[q.n] ? 'UNANSWERED' : (state.answers[q.n] === correctLetter ? 'CORRECT' : 'INCORRECT');
    lines.push(`Item ${q.n}: your answer = ${ans}, correct = ${correctLetter}  [${result}]`);
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
  const blob = new Blob([lines.join('\n')], {type:'text/plain'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = EXAM.id + '_results.txt';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
});

// timer
function pad(n){ return String(n).padStart(2,'0'); }
function formatDuration(ms){
  const secs = Math.floor(ms/1000);
  const h = Math.floor(secs/3600), m = Math.floor((secs%3600)/60), s = secs%60;
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}
function tickTimer(){
  const label = formatDuration(elapsedMs());
  document.getElementById('timer').textContent =
    (state.paused ? 'Paused: ' : 'Elapsed: ') + label;
  document.getElementById('timer').classList.toggle('is-paused', state.paused);
  if(state.paused){
    const el = document.getElementById('pausedElapsed');
    if(el) el.textContent = label;
  }
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

function renderPause(){
  renderToolbar();
  const screen = document.getElementById('pauseScreen');
  if(!screen) return;
  screen.style.display = (state.paused && enteredExam) ? 'flex' : 'none';
  // the question must not be readable while the clock is stopped
  document.getElementById('examBody').style.visibility = state.paused ? 'hidden' : '';
  if(typeof renderNotes === 'function') renderNotes();   // it floats outside examBody
  tickTimer();
}

function pauseExam(){
  if(state.paused || state.graded) return;
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

// keyboard shortcuts: left/right arrows navigate, letter keys select option,
// M toggles "mark for review", Esc closes the review overlay or pauses
document.addEventListener('keydown', (e) => {
  // keystrokes aimed at a text field (e.g. the lab-values search box) must
  // never drive the exam
  const t = e.target;
  if(t && t.matches &&
     t.matches('input:not([type=checkbox]):not([type=radio]), textarea, select')) return;

  if(!enteredExam){
    // on the start screen only Enter does anything: begin, or resume
    if(e.key === 'Enter' && !(t && t.closest && t.closest('button')) &&
       document.getElementById('startScreen').style.display !== 'none'){
      const resuming = document.getElementById('resumeRow').style.display !== 'none';
      document.getElementById(resuming ? 'resumeBtn' : 'beginBtn').click();
    }
    return;
  }

  if(state.paused){
    // nothing but resuming while the exam is paused
    if(e.key === 'Escape' || e.key === 'Enter'){ resumeExam(); }
    return;
  }
  if(e.key === 'Escape' && lightboxOpen()){
    closeLightbox();
    return;
  }
  if(e.key === 'Escape' &&
     document.getElementById('reviewOverlay').classList.contains('show')){
    closeReview();
    return;
  }
  if(document.getElementById('resultsScreen').style.display === 'block') return;
  if(e.key === 'Escape'){ pauseExam(); return; }
  if(e.ctrlKey || e.metaKey || e.altKey) return;   // browser shortcuts stay browser shortcuts
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
  else if(!state.graded){
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

document.getElementById('beginBtn').addEventListener('click', enterExam);
document.getElementById('resumeBtn').addEventListener('click', enterExam);
document.getElementById('startOverBtn').addEventListener('click', () => {
  // this throws away everything, so it asks first — the same guard Restart has
  if(!confirm('Start this exam over? This clears your answers, highlights and score.')) return;
  state.idx = 0; state.answers = {}; state.marked = {}; state.struck = {}; state.highlights = {};
  state.notes = {};
  state.score = null; state.onResults = false;
  resultsFilter = 'all';
  state.elapsedMs = 0; state.runningSince = null; state.paused = false; state.graded = false;
  saveState();
  enterExam();
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
  return state.notesOpen && !state.paused &&
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
  if(notesBtn) notesBtn.classList.toggle('has-note', hasNote(q.n));
}

/* ---------- where the window sits ---------- */

/* Geometry is remembered so the window stays where you put it, across items
   and across reloads. Below the phone breakpoint the stylesheet docks it to
   the bottom of the screen and the inline geometry is dropped, because there
   is nowhere useful to drag to on a small screen. */

const NOTES_MIN_W = 240, NOTES_MIN_H = 170;

function notesDocked(){ return window.innerWidth <= 640; }

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
  return {x: Math.max(4, window.innerWidth - w - 24), y: top + 18, w, h};
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
  if(state.notesOpen && document.activeElement !== notesText){ notesText.focus(); return; }
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
}

function closeLabValues(){
  if(!lvSide) return;
  document.getElementById('examBody').classList.remove('with-lab');
  document.getElementById('app').classList.remove('lab-open');
  lvSide.remove();
  lvSide = null;
}

const labBtn = document.getElementById('labValuesBtn');
if(labBtn) labBtn.addEventListener('click', openLabValues);

loadState();
renderPause();

/* The splash covers the real work — the manifest, this exam's data.js and the
   lab values all have to load before we get here. There is nothing left to
   wait for at this point, so show the start screen straight away rather than
   holding it behind a timer. */
document.getElementById('loadingScreen').style.display = 'none';

if(enteredThisSession()){
  // same tab, already working here: a reload should not interrupt
  enterExam();
}else{
  document.getElementById('startScreen').style.display = 'flex';
  const hasProgress = Object.keys(state.answers).length > 0 || state.graded ||
                      state.paused || elapsedMs() > 0;
  if(hasProgress){
    document.getElementById('resumeRow').style.display = 'flex';
    document.getElementById('startOverRow').style.display = 'block';
    document.getElementById('resumeItem').textContent =
      (state.graded && state.onResults) ? 'Results' : ('Item ' + (state.idx + 1));
  }else{
    document.getElementById('beginRow').style.display = 'flex';
  }
}
