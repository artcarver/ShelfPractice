/* Shared exam engine.
   Expects the page to define window.EXAM before this script loads:
   { id, title, subtitle?, storageKey?, questions, images, answerKey } */

const EXAM = window.EXAM;
const QUESTIONS = EXAM.questions;
const IMAGES = EXAM.images || {};
const ANSWER_KEY = EXAM.answerKey;

document.title = EXAM.title;
document.getElementById('loadingText').textContent = 'Loading ' + EXAM.title + '…';
document.getElementById('examName').textContent = EXAM.title;
document.getElementById('examSub').textContent = EXAM.subtitle || (QUESTIONS.length + ' items · untimed');
document.getElementById('examTitleBar').textContent = EXAM.title;

const state = {
  idx: 0,
  answers: {},   // n -> letter
  marked: {},    // n -> bool
  struck: {},    // "n_letter" -> bool
  highlights: {}, // n -> [[start,end], ...] character offsets into stem text
  startTime: Date.now(),
  graded: false
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
      state.startTime = saved.startTime || Date.now();
      state.graded = !!saved.graded;
    }
  }catch(e){}
}
function saveState(){
  try{
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      idx: state.idx, answers: state.answers, marked: state.marked, struck: state.struck,
      highlights: state.highlights, startTime: state.startTime, graded: state.graded
    }));
  }catch(e){}
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

  document.getElementById('qstem').innerHTML = renderStemHTML(q.stem, state.highlights[q.n] || []);

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

  document.getElementById('markChk').checked = !!state.marked[q.n];

  document.getElementById('prevBtn').disabled = state.idx === 0;
  document.getElementById('prevBtn2').disabled = state.idx === 0;
  const isLast = state.idx === QUESTIONS.length - 1;
  const nb = document.getElementById('nextBtn');
  nb.innerHTML = '<span class="nav-circle">&#8594;</span>' + (isLast ? 'Review' : 'Next');
  document.getElementById('nextBtn2').textContent = isLast ? 'Review / Finish' : 'Next';

  window.scrollTo(0,0);
}

function escapeHtml(s){
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

/* ---------- text highlighting ---------- */

function renderStemHTML(text, ranges){
  if(!ranges || !ranges.length) return escapeHtml(text);
  const sorted = ranges.slice().sort((a,b) => a[0]-b[0]);
  let html = '';
  let pos = 0;
  sorted.forEach((r, i) => {
    const start = Math.max(pos, r[0]);
    const end = Math.max(start, r[1]);
    if(start > pos) html += escapeHtml(text.slice(pos, start));
    html += `<mark class="hl" data-idx="${i}">${escapeHtml(text.slice(start, end))}</mark>`;
    pos = end;
  });
  html += escapeHtml(text.slice(pos));
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
  if(state.idx > 0){ state.idx--; saveState(); render(); }
}
function goNext(){
  if(state.idx < QUESTIONS.length - 1){ state.idx++; saveState(); render(); }
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
    state.idx = 0; state.answers = {}; state.marked = {}; state.struck = {}; state.highlights = {}; state.startTime = Date.now(); state.graded = false;
    saveState();
    document.getElementById('resultsScreen').style.display = 'none';
    document.getElementById('quizMain').style.display = '';
    document.querySelector('footer.botbar').style.display = '';
    render();
  }
});

function openReview(){
  const grid = document.getElementById('gridNav');
  grid.innerHTML = '';
  let answeredCount = 0, markedCount = 0, correctCount = 0, incorrectCount = 0;
  QUESTIONS.forEach((q, i) => {
    const cell = document.createElement('div');
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
    cell.className = cls;
    cell.textContent = q.n;
    cell.addEventListener('click', () => {
      state.idx = i;
      saveState();
      closeReview();
      render();
    });
    grid.appendChild(cell);
  });

  const legend = document.getElementById('reviewLegend');
  if(state.graded){
    legend.innerHTML = `<span><span class="dot c"></span> Correct</span>
      <span><span class="dot x"></span> Incorrect</span>
      <span><span class="dot u"></span> Unanswered</span>
      <span><span class="dot m" style="border-radius:50%"></span> Marked for review</span>`;
  }else{
    legend.innerHTML = `<span><span class="dot a"></span> Answered</span>
      <span><span class="dot u"></span> Unanswered</span>
      <span><span class="dot m" style="border-radius:50%"></span> Marked for review</span>`;
  }

  let summary = `<span><b>${answeredCount}</b> of ${QUESTIONS.length} answered</span>
     <span><b>${QUESTIONS.length - answeredCount}</b> unanswered</span>
     <span><b>${markedCount}</b> marked for review</span>`;
  if(state.graded){
    summary += `<span><b>${correctCount}</b> correct</span><span><b>${incorrectCount}</b> incorrect</span>`;
  }
  document.getElementById('summaryRow').innerHTML = summary;
  document.getElementById('finishBtn').style.display = state.graded ? 'none' : '';
  document.getElementById('reviewOverlay').classList.add('show');
}
function closeReview(){
  document.getElementById('reviewOverlay').classList.remove('show');
}
document.getElementById('reviewBtn').addEventListener('click', openReview);
document.getElementById('reviewOpenBtn').addEventListener('click', openReview);
document.getElementById('closeReview').addEventListener('click', closeReview);

document.getElementById('finishBtn').addEventListener('click', () => {
  const unanswered = QUESTIONS.length - Object.keys(state.answers).length;
  if(unanswered > 0){
    if(!confirm(`You have ${unanswered} unanswered item(s). End the block and see your score anyway?`)) return;
  }
  state.graded = true;
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

function showResults(){
  document.getElementById('quizMain').style.display = 'none';
  document.querySelector('footer.botbar').style.display = 'none';
  document.getElementById('resultsScreen').style.display = 'block';

  const {correct, incorrect, unanswered, total} = computeScore();
  const pct = Math.round((correct/total)*100);

  document.getElementById('scorePercent').textContent = pct + '%';
  document.getElementById('scoreFrac').textContent = `${correct} of ${total} correct`;
  document.getElementById('bCorrect').textContent = correct;
  document.getElementById('bIncorrect').textContent = incorrect;
  document.getElementById('bUnanswered').textContent = unanswered;

  const body = document.getElementById('resultsBody');
  body.innerHTML = '';
  QUESTIONS.forEach(q => {
    const tr = document.createElement('tr');
    const ans = state.answers[q.n] || '—';
    const correctLetter = ANSWER_KEY[q.n] || '—';
    let rowCls, badge;
    if(!state.answers[q.n]){ rowCls = 'row-unanswered'; badge = 'Unanswered'; }
    else if(state.answers[q.n] === ANSWER_KEY[q.n]){ rowCls = 'row-correct'; badge = 'Correct'; }
    else { rowCls = 'row-incorrect'; badge = 'Incorrect'; }
    tr.className = rowCls;
    tr.innerHTML = `<td>${q.n}</td><td>${ans}</td><td>${correctLetter}</td><td class="result-badge">${badge}</td><td>${state.marked[q.n] ? 'Yes' : ''}</td>`;
    tr.style.cursor = 'pointer';
    tr.addEventListener('click', () => {
      state.idx = QUESTIONS.findIndex(x => x.n === q.n);
      saveState();
      document.getElementById('resultsScreen').style.display = 'none';
      document.getElementById('quizMain').style.display = '';
      document.querySelector('footer.botbar').style.display = '';
      render();
    });
    body.appendChild(tr);
  });
}

document.getElementById('backToExamBtn').addEventListener('click', () => {
  document.getElementById('resultsScreen').style.display = 'none';
  document.getElementById('quizMain').style.display = '';
  document.querySelector('footer.botbar').style.display = '';
  render();
});

document.getElementById('downloadBtn').addEventListener('click', () => {
  const {correct, incorrect, unanswered, total} = computeScore();
  const pct = Math.round((correct/total)*100);
  let lines = [EXAM.title + ' - Results', `Score: ${correct} of ${total} correct (${pct}%)`,
    `Incorrect: ${incorrect}    Unanswered: ${unanswered}`, ''];
  QUESTIONS.forEach(q => {
    const ans = state.answers[q.n] || '(unanswered)';
    const correctLetter = ANSWER_KEY[q.n] || '?';
    const result = !state.answers[q.n] ? 'UNANSWERED' : (state.answers[q.n] === correctLetter ? 'CORRECT' : 'INCORRECT');
    lines.push(`Item ${q.n}: your answer = ${ans}, correct = ${correctLetter}  [${result}]`);
  });
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
function tickTimer(){
  const secs = Math.floor((Date.now() - state.startTime)/1000);
  const h = Math.floor(secs/3600), m = Math.floor((secs%3600)/60), s = secs%60;
  document.getElementById('timer').textContent = `Elapsed: ${pad(h)}:${pad(m)}:${pad(s)}`;
}
setInterval(tickTimer, 1000);

// keyboard shortcuts: left/right arrows navigate, letter keys select option
document.addEventListener('keydown', (e) => {
  if(document.getElementById('resultsScreen').style.display === 'block') return;
  if(e.key === 'ArrowRight'){ goNext(); }
  else if(e.key === 'ArrowLeft'){ goPrev(); }
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

function enterExam(){
  document.getElementById('startScreen').style.display = 'none';
  document.getElementById('app').style.display = 'block';
  if(state.graded){
    showResults();
  }else{
    render();
  }
}

document.getElementById('beginBtn').addEventListener('click', enterExam);
document.getElementById('resumeBtn').addEventListener('click', enterExam);
document.getElementById('startOverBtn').addEventListener('click', () => {
  state.idx = 0; state.answers = {}; state.marked = {}; state.struck = {}; state.highlights = {};
  state.startTime = Date.now(); state.graded = false;
  saveState();
  enterExam();
});

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
    showPopOut: true,
    onPopOut: () => {
      const w = window.open(window.LAB_VALUES_URL, 'labvalues',
        'width=680,height=820,menubar=no,toolbar=no,location=no,scrollbars=yes');
      if(w){ w.focus(); closeLabValues(); }
      else { alert('Please allow pop-ups to open Lab Values in a separate window.'); }
    },
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
tickTimer();

setTimeout(() => {
  document.getElementById('loadingScreen').style.display = 'none';
  document.getElementById('startScreen').style.display = 'flex';
  const hasProgress = Object.keys(state.answers).length > 0 || state.graded;
  if(hasProgress){
    document.getElementById('resumeRow').style.display = 'flex';
    document.getElementById('resumeItem').textContent = state.graded ? 'Results' : (state.idx + 1);
  }else{
    document.getElementById('beginRow').style.display = 'flex';
  }
}, 900);
