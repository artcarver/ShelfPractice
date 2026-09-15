/* Moving saved progress between browsers.
 *
 * Everything an exam knows about you lives in this browser's localStorage and
 * nowhere else, which is the point — but it also means a block worked on a
 * laptop is invisible on a phone, and a cleared browser takes the lot. This
 * file is the way across: it writes what is saved into a file you keep, and
 * reads that file back into another browser.
 *
 * Both pages load it. The landing page uses it to export or restore every exam
 * at once; the exam page appends the same block to the results it already
 * downloads, so one file is both the report you read and the progress you can
 * put back. Nothing here knows about any particular exam — it is handed a
 * manifest and a storage reader, the same separation the engine keeps.
 */
(() => {
  const VERSION = 1;
  const OPEN  = '===== ShelfPractice progress data =====';
  const CLOSE = '===== end progress data =====';

  /* The key an exam's state is saved under. The manifest may name its own, so
     this is the one place that decides, and both pages ask rather than guess. */
  function stateKey(entry){ return entry.storageKey || ('exam_state_' + entry.id); }
  function sessionKey(entry){ return 'exam_session_' + entry.id; }

  function readState(entry){
    try{
      const raw = localStorage.getItem(stateKey(entry));
      return raw ? JSON.parse(raw) : null;
    }catch(e){ return null; }
  }

  /* A clock that is still running is stored as "banked time, plus a timestamp
     it has been running since". Carried to another browser on another day that
     timestamp turns the gap between the two into hours on the block, so the
     export banks the running time and closes the clock. The same goes for the
     per-item clock. This is why exporting is not simply copying the record. */
  function settle(saved){
    const s = Object.assign({}, saved);
    const now = Date.now();
    if(typeof s.runningSince === 'number'){
      s.elapsedMs = (s.elapsedMs || 0) + Math.max(0, now - s.runningSince);
      s.runningSince = null;
    }
    if(typeof s.itemSince === 'number' && s.itemSinceN != null){
      const ms = Object.assign({}, s.itemMs || {});
      ms[s.itemSinceN] = (ms[s.itemSinceN] || 0) + Math.max(0, now - s.itemSince);
      s.itemMs = ms;
      s.itemSince = null;
      s.itemSinceN = null;
    }
    return s;
  }

  /* An exam is identified by its slug, which is the folder it lives in and the
     one name that does not change. The id and label ride along so a file can be
     read by a person, and so a restore can name what it restored. */
  function collect(exams){
    return exams.reduce((out, entry) => {
      const saved = readState(entry);
      if(saved) out.push({
        slug: entry.slug, id: entry.id,
        title: entry.title, label: entry.label || null,
        state: settle(saved)
      });
      return out;
    }, []);
  }

  function payload(exams){
    return {
      shelfpractice: VERSION,
      exported: new Date().toISOString(),
      exams: collect(exams)
    };
  }

  /* The block is appended to a file a person may also want to read, so it says
     what it is and what it is for before it says anything a machine needs. */
  function wrap(data){
    return [ '', OPEN,
      'Keep this block to load these answers into another browser:',
      'the exam list has Import at the foot of the page.',
      JSON.stringify(data),
      CLOSE, '' ].join('\n');
  }

  function parsePayload(str){
    let data;
    try{ data = JSON.parse(str); }catch(e){ return null; }
    return (data && typeof data === 'object' && data.shelfpractice) ? data : null;
  }

  /* Finding the payload by slicing between the marker lines looks obvious and
     is wrong: a note is free text, the report prints your notes, and the
     payload carries them too, so a note containing the marker moved the slice
     into the middle of the JSON and the whole file became unreadable. The
     markers are therefore a signpost for a person and nothing more. What the
     parser looks for is a line that is itself a payload, taken from the end so
     a file appended to twice restores the newer one.
  
     The joined fallback is for a file that has been through something that
     wraps long lines. JSON has no raw newlines inside it, so putting the lines
     back together with nothing between them restores the original exactly. */
  function read(text){
    if(typeof text !== 'string' || !text.trim()) throw new Error('That file is empty.');
    const lines = text.split(/\r?\n/);

    for(let i = lines.length - 1; i >= 0; i--){
      const t = lines[i].trim();
      if(t.charAt(0) !== '{' || t.charAt(t.length - 1) !== '}') continue;
      const data = parsePayload(t);
      if(data) return check(data);
    }

    // a bare .json export, pretty-printed or not
    const whole = parsePayload(text.trim());
    if(whole) return check(whole);

    /* A payload whose line was wrapped somewhere in transit. Where the join
       stops is the whole difficulty: cutting at the first run of equals signs
       cuts inside the payload the moment a note happens to contain one, which
       is exactly the trap the marker slicing fell into. So it stops at a line
       that is the closing marker and nothing else, and failing that at the end
       of the file, and each candidate opening line is tried in turn. */
    for(let i = 0; i < lines.length; i++){
      if(lines[i].trim().charAt(0) !== '{') continue;
      let close = lines.length;
      for(let j = i; j < lines.length; j++){
        if(lines[j].trim() === CLOSE){ close = j; break; }
      }
      for(const end of (close === lines.length ? [lines.length] : [close, lines.length])){
        const data = parsePayload(lines.slice(i, end).join('').trim());
        if(data) return check(data);
      }
    }

    throw new Error('No ShelfPractice progress block in that file. Export one from the exam list, or from the results screen of an exam.');
  }

  function check(data){
    if(data.shelfpractice > VERSION)
      throw new Error('That file was written by a newer version of this site.');
    if(!Array.isArray(data.exams) || !data.exams.length)
      throw new Error('That file has no saved exams in it.');
    return data;
  }

  /* Only these, and only at these types. A field of the wrong type is dropped
     rather than carried into storage, where the engine would read it back and
     behave strangely a long way from here. */
  const MAPS = ['answers','marked','struck','highlights','notes','itemMs'];
  const NUMS = ['idx','elapsedMs','runningSince','itemSince','itemSinceN'];
  const BOOLS = ['notesOpen','graded','paused','onResults'];

  function sanitize(raw){
    if(!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const out = {};
    MAPS.forEach(k => {
      const v = raw[k];
      if(v && typeof v === 'object' && !Array.isArray(v)) out[k] = v;
    });
    NUMS.forEach(k => { if(typeof raw[k] === 'number' && isFinite(raw[k])) out[k] = raw[k]; });
    BOOLS.forEach(k => { if(typeof raw[k] === 'boolean') out[k] = raw[k]; });
    if(raw.score && typeof raw.score === 'object') out.score = raw.score;
    if(raw.notesPos && typeof raw.notesPos === 'object') out.notesPos = raw.notesPos;
    return out;
  }

  /* A record that carries nothing is not a restore, it is an erasure wearing
     one: writing it over an exam you had worked would destroy it and then say
     "restored". An export never produces one, so anything that looks like this
     is damage, and damage is refused rather than applied. */
  function carriesNothing(st){
    const empty = k => !st[k] || !Object.keys(st[k]).length;
    return MAPS.every(empty) && !st.graded && !st.elapsedMs;
  }

  /* Writing is deliberate and reversible only by the person doing it, so the
     caller is handed the whole picture first — what will be added, what will be
     written over, what this site has no exam for, and what could not be read —
     and decides. */
  function plan(data, exams){
    const bySlug = new Map(exams.map(e => [e.slug, e]));
    const byId   = new Map(exams.map(e => [e.id, e]));
    const fresh = [], overwrite = [], unknown = [], damaged = [];
    data.exams.forEach(rec => {
      const entry = bySlug.get(rec.slug) || byId.get(rec.id);
      const label = rec && (rec.label ? rec.title + ' ' + rec.label : (rec.title || rec.slug || rec.id));
      if(!entry){ unknown.push(label || 'an unnamed exam'); return; }
      const name = (entry.label ? entry.title + ' ' + entry.label : entry.title);
      const state = sanitize(rec.state);
      if(!state || carriesNothing(state)){ damaged.push(name); return; }
      (readState(entry) ? overwrite : fresh).push({entry, state, name});
    });
    return {fresh, overwrite, unknown, damaged};
  }

  function apply(items){
    const done = [];
    items.forEach(({entry, state, name}) => {
      try{
        localStorage.setItem(stateKey(entry), JSON.stringify(settle(state)));
        /* The per-tab flag that lets a reload skip the start screen belongs to
           the browser it was set in, not to the progress. Clearing it means an
           imported exam opens on its start screen, which is where someone who
           has just restored it wants to be. */
        sessionStorage.removeItem(sessionKey(entry));
        done.push(name);
      }catch(e){}
    });
    return done;
  }

  /* What a saved state amounts to, in the words the exam list already uses, so
     a row in the dialog reads the way the row on the list reads. */
  function describe(st, items){
    if(!st) return 'nothing saved';
    if(st.graded && st.score && st.score.total)
      return 'scored ' + Math.round((st.score.correct / st.score.total) * 100) + '%'
           + ', ' + st.score.correct + ' of ' + st.score.total + ' correct';
    const answered = Object.keys(st.answers || {}).length;
    if(answered) return answered + ' of ' + (items || '?') + ' answered';
    if(st.elapsedMs) return 'started, nothing answered yet';
    return 'nothing answered';
  }

  /* ---------- files ---------- */

  function download(filename, text){
    const url = URL.createObjectURL(new Blob([text], {type:'text/plain'}));
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /* One input, made on demand and thrown away after, so a second import of the
     same filename still fires a change event. */
  function pick(onText){
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.txt,.json,text/plain,application/json';
    input.style.display = 'none';
    input.addEventListener('change', () => {
      const file = input.files && input.files[0];
      if(file){
        const reader = new FileReader();
        reader.onload  = () => { onText(String(reader.result || ''), file.name); cleanup(); };
        reader.onerror = () => { onText(null, file.name); cleanup(); };
        reader.readAsText(file);
      }else cleanup();
    });
    function cleanup(){ if(input.parentNode) input.parentNode.removeChild(input); }
    document.body.appendChild(input);
    input.click();
  }

  /* ---------- the dialog ---------- */

  let overlay = null;

  function el(tag, cls, text){
    const n = document.createElement(tag);
    if(cls) n.className = cls;
    if(text != null) n.textContent = text;
    return n;
  }

  function closeDialog(){
    if(!overlay) return;
    overlay.classList.remove('show');
    document.removeEventListener('keydown', onEsc, true);
    if(overlay.parentNode) overlay.parentNode.removeChild(overlay);
    overlay = null;
  }
  function onEsc(e){ if(e.key === 'Escape'){ e.stopPropagation(); closeDialog(); } }

  /* One shell, filled differently depending on whether there is a choice to
     make, nothing to do, or a result to report. Escape and the backdrop close
     it, and nothing is written until the button in it is pressed. */
  function openDialog(title, from, build){
    closeDialog();
    overlay = el('div', 'tr-overlay');
    const modal = el('div', 'tr-modal');
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-label', title);

    const head = el('div', 'tr-head');
    head.append(el('h2', null, title));
    if(from) head.append(el('p', 'tr-from', 'From ' + from));
    const body = el('div', 'tr-body');
    const foot = el('div', 'tr-foot');
    modal.append(head, body, foot);
    overlay.append(modal);
    overlay.addEventListener('mousedown', e => { if(e.target === overlay) closeDialog(); });
    document.body.appendChild(overlay);
    document.addEventListener('keydown', onEsc, true);
    build(body, foot, modal);
    overlay.classList.add('show');
    const first = modal.querySelector('input, button');
    if(first) first.focus();
    return {body, foot, modal};
  }

  function closeButton(label){
    const b = el('button', 'btn secondary', label || 'Close');
    b.type = 'button';
    b.addEventListener('click', closeDialog);
    return b;
  }

  /* The whole round trip. Neither page spells out the wording, so both of them
     say it the same way, and the choice of what to take is made here rather
     than assumed. */
  function importFrom(text, exams, onDone, from){
    let data;
    try{ data = read(text); }
    catch(e){
      openDialog('Import progress', from, (body, foot) => {
        body.append(el('p', 'tr-say', e.message));
        body.append(el('p', 'tr-say',
          'A file you can import is made by Export progress at the foot of the '
        + 'exam list, or by the download button on an exam\u2019s results screen. '
        + 'Keep the whole file, including the block at the end of it.'));
        foot.append(el('span', 'tr-note', ''), closeButton('Close'));
      });
      return;
    }

    const {fresh, overwrite, unknown, damaged} = plan(data, exams);
    const takeable = fresh.concat(overwrite);

    if(!takeable.length){
      openDialog('Import progress', from, (body, foot) => {
        body.append(el('p', 'tr-say', damaged.length
          ? 'Nothing in that file could be read back, so nothing has been changed.'
          : 'That file holds no exam that is on this site, so nothing has been changed.'));
        if(damaged.length) body.append(el('p', 'tr-say',
          'The saved progress for ' + damaged.join(', ') + ' is missing or damaged in the file.'));
        if(unknown.length) body.append(el('p', 'tr-say',
          'It holds ' + unknown.join(', ') + ', which this site has no exam for. '
        + 'If that exam should be here, it needs adding to the site first.'));
        foot.append(el('span', 'tr-note', ''), closeButton('Close'));
      });
      return;
    }

    openDialog('Import progress', from, (body, foot) => {
      body.append(el('p', 'tr-say',
        'Choose what to take from this file. Nothing is changed until you press Import.'));

      const list = el('ul', 'tr-list');
      takeable.forEach((item, i) => {
        const current = readState(item.entry);
        const row = el('label', 'tr-row' + (current ? ' is-over' : ''));
        const box = document.createElement('input');
        box.type = 'checkbox';
        /* Restoring something this browser does not have is safe and is what
           the file is usually for, so it is ticked. Replacing work already
           here is not, so it is not: it has to be asked for. */
        box.checked = !current;
        box.dataset.i = String(i);
        const txt = el('span');
        txt.append(el('b', 'tr-name', item.name));
        const what = el('span', 'tr-what');
        what.append(document.createTextNode('In the file: ' + describe(item.state, item.entry.items) + '. '));
        if(current){
          const warn = el('b', null, 'Replaces ' + describe(current, item.entry.items) + ' saved here.');
          what.append(warn);
        }else{
          what.append(document.createTextNode('Nothing saved here yet.'));
        }
        txt.append(what);
        row.append(box, txt);
        list.append(row);
      });
      body.append(list);

      if(unknown.length || damaged.length){
        const skip = el('div', 'tr-skip');
        skip.append(el('b', null, 'Not offered'));
        if(unknown.length) skip.append(document.createTextNode(
          'No exam on this site for ' + unknown.join(', ') + '. '));
        if(damaged.length) skip.append(document.createTextNode(
          'Missing or damaged in the file: ' + damaged.join(', ') + '.'));
        body.append(skip);
      }

      const note = el('span', 'tr-note', 'Anything replaced cannot be recovered.');
      const go = el('button', 'btn', 'Import');
      go.type = 'button';
      const cancel = closeButton('Cancel');

      function refresh(){
        const n = body.querySelectorAll('input:checked').length;
        go.textContent = n ? 'Import ' + n + (n === 1 ? ' exam' : ' exams') : 'Import';
        go.disabled = !n;
      }
      body.addEventListener('change', refresh);
      refresh();

      go.addEventListener('click', () => {
        const chosen = Array.from(body.querySelectorAll('input:checked'))
          .map(b => takeable[Number(b.dataset.i)]);
        const done = apply(chosen);
        body.innerHTML = '';
        foot.innerHTML = '';
        body.append(el('p', 'tr-say', done.length
          ? 'Restored ' + done.length + (done.length === 1 ? ' exam' : ' exams') + ': ' + done.join(', ') + '.'
          : 'Nothing could be saved. This browser may be blocking site storage.'));
        const ok = el('button', 'btn', 'Done');
        ok.type = 'button';
        ok.addEventListener('click', () => { closeDialog(); if(done.length && onDone) onDone(done); });
        foot.append(el('span', 'tr-note tr-done', done.length ? 'Saved in this browser.' : ''), ok);
        ok.focus();
      });

      foot.append(note, cancel, go);
    });
  }

  window.SHELF_TRANSFER = {
    VERSION, OPEN, CLOSE,
    stateKey, sessionKey, readState, settle,
    payload, wrap, read, plan, apply, sanitize, describe,
    download, pick, importFrom, closeDialog
  };
})();
