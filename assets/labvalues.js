/* Shared "Lab Values" reference panel (UWorld-style).
   Exposes:
     window.LAB_VALUES            – the reference data
     window.renderLabValues(root, opts)  – builds the panel UI into `root`
     window.LAB_VALUES_URL        – absolute URL of the standalone popup page
   opts: { showPopOut, onPopOut, showClose, onClose }

   Each category is a flat list of rows: [label, value, level]
     - value === "" marks a group header (no reference range)
     - level (0,1,2) controls indentation / nesting for display + search */

(() => {

const CATEGORIES = [
  {
    id: "serum",
    tab: "Serum",
    heading: "Serum",
    rows: [
      ["Alanine aminotransferase (ALT)", "10-40 U/L", 0],
      ["Aspartate aminotransferase (AST)", "12-38 U/L", 0],
      ["Alkaline phosphatase", "25-100 U/L", 0],
      ["Amylase", "25-125 U/L", 0],
      ["Bilirubin", "", 0],
      ["Total", "0.1-1.0 mg/dL", 1],
      ["Direct", "0.0-0.3 mg/dL", 1],
      ["Calcium", "8.4-10.2 mg/dL", 0],
      ["Cholesterol", "", 0],
      ["Total", "", 1],
      ["Normal", "<200 mg/dL", 2],
      ["High", ">240 mg/dL", 2],
      ["HDL", "40-60 mg/dL", 1],
      ["LDL", "<160 mg/dL", 1],
      ["Triglycerides", "", 0],
      ["Normal", "<150 mg/dL", 1],
      ["Borderline", "151-199 mg/dL", 1],
      ["Cortisol", "", 0],
      ["0800 h", "5-23 μg/dL", 1],
      ["1600 h", "3-15 μg/dL", 1],
      ["2000 h", "<50% of 0800 h", 1],
      ["Creatine kinase", "", 0],
      ["Male", "25-90 U/L", 1],
      ["Female", "10-70 U/L", 1],
      ["Creatinine", "0.6-1.2 mg/dL", 0],
      ["Urea nitrogen", "7-18 mg/dL", 0],
      ["Electrolytes, serum", "", 0],
      ["Sodium (Na+)", "136-146 mEq/L", 1],
      ["Potassium (K+)", "3.5-5.0 mEq/L", 1],
      ["Chloride (Cl-)", "95-105 mEq/L", 1],
      ["Bicarbonate (HCO3-)", "22-28 mEq/L", 1],
      ["Magnesium (Mg2+)", "1.5-2.0 mEq/L", 1],
      ["Ferritin", "", 0],
      ["Male", "20-250 ng/mL", 1],
      ["Female", "10-120 ng/mL", 1],
      ["Follicle-stimulating hormone", "", 0],
      ["Male", "4-25 mIU/mL", 1],
      ["Female", "", 1],
      ["premenopause", "4-30 mIU/mL", 2],
      ["midcycle peak", "10-90 mIU/mL", 2],
      ["postmenopause", "40-250 mIU/mL", 2],
      ["Glucose", "", 0],
      ["Fasting", "70-110 mg/dL", 1],
      ["Random, non-fasting", "<140 mg/dL", 1],
      ["Growth hormone - arginine stimulation", "", 0],
      ["Fasting", "<5 ng/mL", 1],
      ["Provocative stimuli", ">7 ng/mL", 1],
      ["Iron", "", 0],
      ["Male", "65-175 μg/dL", 1],
      ["Female", "50-170 μg/dL", 1],
      ["Total iron-binding capacity", "250-400 μg/dL", 0],
      ["Transferrin", "200-360 mg/dL", 0],
      ["Lactate dehydrogenase", "45-200 U/L", 0],
      ["Luteinizing hormone", "", 0],
      ["Male", "6-23 mIU/mL", 1],
      ["Female", "", 1],
      ["follicular phase", "5-30 mIU/mL", 2],
      ["midcycle", "75-150 mIU/mL", 2],
      ["postmenopause", "30-200 mIU/mL", 2],
      ["Osmolality", "275-295 mOsmol/kg H₂O", 0],
      ["Intact parathyroid hormone (PTH)", "10-60 pg/mL", 0],
      ["Phosphorus (inorganic)", "3.0-4.5 mg/dL", 0],
      ["Prolactin (hPRL)", "", 0],
      ["Male", "<17 ng/mL", 1],
      ["Female", "<25 ng/mL", 1],
      ["Proteins", "", 0],
      ["Total", "6.0-7.8 g/dL", 1],
      ["Albumin", "3.5-5.5 g/dL", 1],
      ["Globulin", "2.3-3.5 g/dL", 1],
      ["Troponin I", "<0.04 ng/dL", 0],
      ["TSH", "0.4-4.0 μU/mL", 0],
      ["Thyroidal iodine (¹²³I) uptake", "8%-30% of administered dose/24 h", 0],
      ["Thyroxine (T4)", "5-12 μg/dL", 0],
      ["Free (T4)", "0.9-1.7 ng/dL", 0],
      ["Triiodothyronine (T3) (RIA)", "100-200 ng/dL", 0],
      ["Triiodothyronine (T3) resin uptake", "25%-35%", 0],
      ["Uric acid", "3.0-8.2 mg/dL", 0],
      ["Immunoglobulins", "", 0],
      ["IgA", "76-390 mg/dL", 1],
      ["IgE", "0-380 IU/mL", 1],
      ["IgG", "650-1500 mg/dL", 1],
      ["IgM", "50-300 mg/dL", 1],
      ["Gases, arterial blood (room air)", "", 0],
      ["pH", "7.35-7.45", 1],
      ["Pco₂", "33-45 mm Hg", 1],
      ["Po₂", "75-105 mm Hg", 1]
    ]
  },
  {
    id: "csf",
    tab: "Cerebrospinal",
    heading: "Cerebrospinal Fluid",
    rows: [
      ["Cell count", "0-5/mm³", 0],
      ["Chloride", "118-132 mEq/L", 0],
      ["Gamma globulin", "3%-12% total proteins", 0],
      ["Glucose", "40-70 mg/dL", 0],
      ["Pressure", "70-180 mm H₂O", 0],
      ["Proteins, total", "<40 mg/dL", 0]
    ]
  },
  {
    id: "blood",
    tab: "Blood",
    heading: "Hematologic",
    rows: [
      ["Erythrocyte count", "", 0],
      ["Male", "4.3-5.9 million/mm³", 1],
      ["Female", "3.5-5.5 million/mm³", 1],
      ["Erythrocyte sedimentation rate (Westergren)", "", 0],
      ["Male", "0-15 mm/h", 1],
      ["Female", "0-20 mm/h", 1],
      ["Hematocrit", "", 0],
      ["Male", "41%-53%", 1],
      ["Female", "36%-46%", 1],
      ["Hemoglobin, blood", "", 0],
      ["Male", "13.5-17.5 g/dL", 1],
      ["Female", "12.0-16.0 g/dL", 1],
      ["Hemoglobin A1c", "≤6%", 0],
      ["Hemoglobin, plasma", "<4 mg/dL", 0],
      ["Leukocyte count (WBC)", "4500-11,000/mm³", 0],
      ["Neutrophils, segmented", "54%-62%", 0],
      ["Neutrophils, bands", "3%-5%", 0],
      ["Eosinophils", "1%-3%", 0],
      ["Basophils", "0%-0.75%", 0],
      ["Lymphocytes", "25%-33%", 0],
      ["Monocytes", "3%-7%", 0],
      ["CD4+ T-lymphocyte count", "≥500/mm³", 0],
      ["Platelet count", "150,000-400,000/mm³", 0],
      ["Reticulocyte count", "0.5%-1.5%", 0],
      ["D-Dimer", "≤250 ng/mL", 0],
      ["Partial thromboplastin time (PTT) (activated)", "25-40 seconds", 0],
      ["Prothrombin time (PT)", "11-15 seconds", 0],
      ["Mean corpuscular hemoglobin (MCH)", "25-35 pg/cell", 0],
      ["Mean corpuscular hemoglobin concentration (MCHC)", "31%-36% Hb/cell", 0],
      ["Mean corpuscular volume (MCV)", "80-100 μm³", 0],
      ["Volume", "", 0],
      ["Plasma", "", 1],
      ["Male", "25-43 mL/kg", 2],
      ["Female", "28-45 mL/kg", 2],
      ["Red cell", "", 1],
      ["Male", "20-36 mL/kg", 2],
      ["Female", "19-31 mL/kg", 2]
    ]
  },
  {
    id: "urine",
    tab: "Urine and BMI",
    heading: "Urine",
    rows: [
      ["Calcium", "100-300 mg/24 h", 0],
      ["Creatinine clearance", "", 0],
      ["Male", "97-137 mL/min", 1],
      ["Female", "88-128 mL/min", 1],
      ["Osmolality", "50-1200 mOsmol/kg H₂O", 0],
      ["Oxalate", "8-40 μg/mL", 0],
      ["Proteins, total", "<150 mg/24 h", 0],
      ["17-Hydroxycorticosteroids", "", 0],
      ["Male", "3.0-10.0 mg/24 h", 1],
      ["Female", "2.0-8.0 mg/24 h", 1],
      ["17-Ketosteroids, total", "", 0],
      ["Male", "8-20 mg/24 h", 1],
      ["Female", "6-15 mg/24 h", 1],
      ["Body Mass Index (BMI)", "Adult: 19-25 kg/m²", 0, {bold: true}]
    ]
  }
];

window.LAB_VALUES = CATEGORIES;

/* Precompute, per category, each row's ancestor indices (the enclosing
   group-header chain). Used so a search match reveals its parent headers
   and a matched header reveals its children. */
function computeAncestors(rows){
  const ancestors = [];
  const stack = []; // entries: {level, idx}
  rows.forEach((r, i) => {
    const level = r[2] || 0;
    while(stack.length && stack[stack.length - 1].level >= level) stack.pop();
    ancestors.push(stack.map(s => s.idx));
    stack.push({level, idx: i});
  });
  return ancestors;
}
CATEGORIES.forEach(c => { c._ancestors = computeAncestors(c.rows); });

function beakerSVG(){
  return `<svg class="lv-beaker" width="22" height="22" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M9 3h6M10 3v6.5L5.5 17.2A2 2 0 0 0 7.2 20h9.6a2 2 0 0 0 1.7-2.8L14 9.5V3"/>
    <path d="M8.2 13.5h7.6"/></svg>`;
}
function popOutSVG(){
  return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M14 4h6v6M20 4l-8.5 8.5"/><path d="M18 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5"/></svg>`;
}

function renderLabValues(root, opts){
  opts = opts || {};
  root.classList.add('lv');
  root.innerHTML = '';

  let activeId = CATEGORIES[0].id;
  let query = '';

  // ----- header -----
  const header = document.createElement('div');
  header.className = 'lv-header';
  const popBtn = opts.showPopOut
    ? `<button class="lv-popout" id="lvPopout" title="Open in a separate window">${popOutSVG()}</button>`
    : '';
  const closeBtn = opts.showClose
    ? `<button class="lv-close" id="lvClose" title="Close" aria-label="Close">&times;</button>`
    : '';
  header.innerHTML = `<div class="lv-title">${beakerSVG()}<span>Lab Values</span></div>
    <div class="lv-header-actions">${popBtn}${closeBtn}</div>`;
  root.appendChild(header);

  // ----- search -----
  const controls = document.createElement('div');
  controls.className = 'lv-controls';
  controls.innerHTML = `<input type="search" class="lv-search" id="lvSearch"
     placeholder="Search" aria-label="Search lab values" autocomplete="off">`;
  root.appendChild(controls);

  // ----- tabs -----
  const tabs = document.createElement('div');
  tabs.className = 'lv-tabs';
  CATEGORIES.forEach(cat => {
    const b = document.createElement('button');
    b.className = 'lv-tab';
    b.textContent = cat.tab;
    b.dataset.id = cat.id;
    b.addEventListener('click', () => { activeId = cat.id; renderTable(); });
    tabs.appendChild(b);
  });
  root.appendChild(tabs);

  // ----- table body -----
  const body = document.createElement('div');
  body.className = 'lv-body';
  root.appendChild(body);

  function rowMatches(label, value, q){
    return (label.toLowerCase().includes(q) || value.toLowerCase().includes(q));
  }

  function visibleSet(cat, q){
    if(!q) return null; // null => show all
    const rows = cat.rows;
    const anc = cat._ancestors;
    const direct = rows.map(r => rowMatches(r[0], r[1] || '', q));
    const show = new Array(rows.length).fill(false);
    rows.forEach((r, i) => {
      if(!direct[i]) return;
      show[i] = true;
      anc[i].forEach(a => { show[a] = true; }); // reveal parent headers of a match
    });
    // reveal all descendants of a directly-matched header
    rows.forEach((r, i) => {
      if(direct[i] && (r[1] || '') === ''){
        for(let j = i + 1; j < rows.length; j++){
          if((rows[j][2] || 0) <= (r[2] || 0)) break;
          show[j] = true;
        }
      }
    });
    return show;
  }

  function renderTable(){
    // tab active states
    tabs.querySelectorAll('.lv-tab').forEach(t => {
      t.classList.toggle('active', t.dataset.id === activeId);
    });

    const cat = CATEGORIES.find(c => c.id === activeId);
    const q = query.trim().toLowerCase();
    const show = visibleSet(cat, q);

    const table = document.createElement('table');
    table.className = 'lv-table';
    table.innerHTML = `<thead><tr><th>${cat.heading}</th><th>Reference Range</th></tr></thead>`;
    const tbody = document.createElement('tbody');

    let shown = 0;
    cat.rows.forEach((r, i) => {
      if(show && !show[i]) return;
      shown++;
      const [label, value, level] = [r[0], r[1] || '', r[2] || 0];
      const meta = r[3] || {};
      const tr = document.createElement('tr');
      const isHeader = value === '';
      tr.className = 'lv-row' + (isHeader ? ' lv-group' : '') + (meta.bold ? ' lv-bold' : '');
      const pad = 4 + level * 22;
      if(isHeader){
        tr.innerHTML = `<td class="lv-label" colspan="2" style="padding-left:${pad}px">${escapeHtml(label)}</td>`;
      }else{
        tr.innerHTML = `<td class="lv-label" style="padding-left:${pad}px">${escapeHtml(label)}</td>` +
          `<td class="lv-val">${escapeHtml(value)}</td>`;
      }
      tbody.appendChild(tr);
    });

    if(shown === 0){
      const tr = document.createElement('tr');
      tr.innerHTML = `<td class="lv-empty" colspan="2">No matching lab values.</td>`;
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    body.innerHTML = '';
    body.appendChild(table);
  }

  function escapeHtml(s){
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  // wire controls
  root.querySelector('#lvSearch').addEventListener('input', (e) => {
    query = e.target.value;
    renderTable();
  });
  if(opts.showPopOut){
    const pb = root.querySelector('#lvPopout');
    if(pb) pb.addEventListener('click', () => opts.onPopOut && opts.onPopOut());
  }
  if(opts.showClose){
    const cb = root.querySelector('#lvClose');
    if(cb) cb.addEventListener('click', () => opts.onClose && opts.onClose());
  }

  renderTable();
}

window.renderLabValues = renderLabValues;

// URL of the standalone popup page, resolved relative to this script.
try{
  const src = (document.currentScript && document.currentScript.src) || '';
  window.LAB_VALUES_URL = src ? new URL('labvalues.html', src).href : 'labvalues.html';
}catch(e){
  window.LAB_VALUES_URL = 'labvalues.html';
}

})();
