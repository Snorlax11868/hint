/* script.js
   Sequential unlocking version
   - Page 0 & 1 open
   - To open page i (i>=2), user must enter password produced on page i-1
   - Master pass 'daniela' unlocks all (hidden)
   - Hints shown after 3 failed attempts
   - Typewriter on first view; skips on revisit (localStorage)
   - token support: ?v=ALL or ?v=2,3,5
*/

const MASTER_PASS = 'daniela'; // hidden master pass (case-insensitive)
const PASSWORD_FLOW = {
  2: 'bloomrise',   // to open page index 2 (page 3) user must input bloomrise
  3: 'paulanka',
  4: 'amberlite',
  5: 'softfracture',
  6: 'violetluck'
};
// Hints corresponding to the above (page numbers)
const HINTS = {
  2: "I open without sound when someone walks near; not a door, not a bloom — name the thing that wakes on the face like sunrise.",
  3: "A vintage voice that serenades young hearts; two names, one famous for a small-heart song — say him aloud.",
  4: "A gemstone warmed by daylight, then paired with the spark that sets it aglow — speak the fused glow.",
  5: "Part hush, part break — a gentle word for what’s broken but beloved; join the soft with the shard.",
  6: "Take the royal shade that stands its ground and pair it with a tiny omen that lands like a whisper — combine them into one quiet promise."
};

// localStorage keys
const LS_UNLOCK = 'story_unlocked_v1'; // object { "2": true }
const LS_VISITED = 'story_visited_v1'; // object { "2": true }
const LS_ATTEMPTS = 'story_attempts_v1'; // object { "2": 1 }

let pages = [];
let unlocked = {}; // pageIndex -> true
let visited = {};
let attempts = {};
let currentIdx = 0;

function loadState(){
  try{ unlocked = JSON.parse(localStorage.getItem(LS_UNLOCK)) || {}; }catch(e){ unlocked = {}; }
  try{ visited = JSON.parse(localStorage.getItem(LS_VISITED)) || {}; }catch(e){ visited = {}; }
  try{ attempts = JSON.parse(localStorage.getItem(LS_ATTEMPTS)) || {}; }catch(e){ attempts = {}; }
}
function saveState(){ localStorage.setItem(LS_UNLOCK, JSON.stringify(unlocked)); localStorage.setItem(LS_VISITED, JSON.stringify(visited)); localStorage.setItem(LS_ATTEMPTS, JSON.stringify(attempts)); }

// token helpers
function applyTokenString(v){
  if (!v) return false;
  if (v.toUpperCase() === 'ALL'){
    for (let i=0;i<pages.length;i++){ unlocked[i]=true; visited[i]=true; }
    saveState(); return true;
  }
  if (/^[0-9,]+$/.test(v)){
    v.split(',').map(s=>parseInt(s,10)).filter(n=>!isNaN(n)).forEach(n=>{ unlocked[n]=true; visited[n]=true; });
    saveState(); return true;
  }
  try { const dec = atob(v); const arr = JSON.parse(dec); if (Array.isArray(arr)){ arr.forEach(n=>{ unlocked[n]=true; visited[n]=true; }); saveState(); return true; } } catch(e){}
  return false;
}
function getVParam(){ return new URLSearchParams(window.location.search).get('v'); }

// fetch pages.json
window.clues_initPromise = (async function init(){
  loadState();
  try {
    const r = await fetch('pages.json');
    const json = await r.json();
    pages = json.pages || [];
    window.clues_pages = pages;
    // apply token if present
    const v = getVParam();
    if (v) applyTokenString(v);
    return true;
  } catch (e) {
    console.error('Failed to load pages.json', e);
    pages = [];
    window.clues_pages = pages;
    return false;
  }
})();

// helpers: DOM
const $ = id => document.getElementById(id);
function escapeHtml(s){ return String(s).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])); }

// typewriter (skip when visited)
let skipFlag = false;
async function typewriterTo(container, text, speed=20){
  if (visited[currentIdx]) {
    container.innerHTML = escapeHtml(text).replace(/\n/g,'<br>');
    return;
  }
  container.innerHTML = '';
  skipFlag = false;
  return new Promise(resolve=>{
    let i=0;
    function step(){
      if (skipFlag) {
        container.innerHTML = escapeHtml(text).replace(/\n/g,'<br>');
        visited[currentIdx]=true; saveState(); resolve();
        return;
      }
      if (i < text.length){
        container.innerHTML += escapeHtml(text.charAt(i)).replace(/\n/g,'<br>');
        i++; setTimeout(step, speed);
      } else {
        visited[currentIdx]=true; saveState(); resolve();
      }
    }
    step();
  });
}
window.addEventListener('click', ()=> skipFlag = true);
window.addEventListener('keydown', ()=> skipFlag = true);

// navigation & rendering
function renderIndexList(){
  const container = $('pagesList');
  if (!container) return;
  container.innerHTML = '';
  pages.forEach((p,i)=>{
    const row = document.createElement('div');
    row.className = 'page-row';
    const link = document.createElement('a');
    link.className = 'page-link';
    link.href = `page.html?p=${i}${getVParam()?`&v=${encodeURIComponent(getVParam())}`:''}`;
    link.innerText = `Page ${i+1}${p.title ? ' — ' + p.title : ''}`;
    const meta = document.createElement('div');
    meta.className = 'page-meta';
    meta.innerText = (i<=1) ? 'Open' : 'Sequential';
    row.appendChild(link); row.appendChild(meta);
    container.appendChild(row);
  });
  const st = $('status'); if (st) st.innerText = `Loaded ${pages.length} page${pages.length!==1?'s':''}`;
}

function canAttemptOpen(targetIdx){
  // Page0 & Page1 open
  if (targetIdx <= 1) return true;
  // To open page i you must have unlocked previous page (i-1)
  const prev = targetIdx - 1;
  return !!unlocked[prev] || !!visited[prev];
}

function openPasswordModalFor(targetIdx){
  const modal = $('modal');
  const pwInput = $('pwInput'); const msg = $('pwMessage'); const modalHint = $('modalHint'); const tokenField = $('tokenField'); const shareRow = $('shareRow');
  modal.style.display='flex'; modal.setAttribute('aria-hidden','false');
  pwInput.value=''; msg.innerText=''; modalHint.style.display='none';
  $('modalTitle').innerText = `Unlock Page ${targetIdx+1}`; $('modalNote').innerText = HINTS[targetIdx] ? 'Solve the riddle to unlock.' : 'Enter the password to unlock this page.';
  attempts[targetIdx] = attempts[targetIdx] || 0;
  shareRow.style.display = buildTokenFromUnlocked() ? 'flex' : 'none';
  tokenField.value = buildTokenFromUnlocked() ? tokenURLFor(buildTokenFromUnlocked()) : '';

  function submit(){
    const val = (pwInput.value||'').trim().toLowerCase();
    if (!val){ msg.innerText='Please enter a password.'; return; }
    if (val === MASTER_PASS.toLowerCase()){
      // master: unlock all and navigate to target
      for (let i=0;i<pages.length;i++){ unlocked[i]=true; visited[i]=true; }
      saveState(); modal.style.display='none';
      renderPageIndex(targetIdx); return;
    }
    const correct = (PASSWORD_FLOW[targetIdx]||'').toLowerCase();
    if (correct && val === correct){
      unlocked[targetIdx]=true; visited[targetIdx]=true; saveState(); modal.style.display='none'; renderPageIndex(targetIdx); return;
    }
    attempts[targetIdx] = (attempts[targetIdx]||0) + 1; saveState(); msg.innerText='Incorrect password.';
    if (attempts[targetIdx] >= 3){
      modalHint.style.display = 'block'; modalHint.innerText = HINTS[targetIdx] || 'No hint available.';
    }
  }

  $('submitPw').onclick = submit;
  $('cancelPw').onclick = ()=> { modal.style.display='none'; msg.innerText=''; };
  $('copyBtn').onclick = async ()=>{ const txt = tokenField.value; if (!txt) return; try { await navigator.clipboard.writeText(txt); $('copyBtn').innerText='Copied'; setTimeout(()=>$('copyBtn').innerText='Copy',1200);}catch(e){ alert('Copy failed'); } };
  pwInput.onkeydown = (e)=>{ if (e.key==='Enter') submit(); if (e.key==='Escape') modal.style.display='none'; };
}

function buildTokenFromUnlocked(){
  const ks = Object.keys(unlocked).filter(k=>unlocked[k]).map(k=>parseInt(k)).sort((a,b)=>a-b);
  if (!ks.length) return '';
  return ks.join(',');
}
function tokenURLFor(v){ const u = new URL(window.location.href); u.searchParams.set('v', v); return u.toString(); }

function renderPageIndex(idx){
  currentIdx = idx;
  const contentEl = $('content'); const status = $('status');
  if (!contentEl) return;
  status.innerText = `Page ${idx+1} / ${pages.length}`;
  const page = pages[idx] || { title: '', content: ''};
  if (PASSWORD_FLOW[idx] && !unlocked[idx]){
    // require previous unlocked
    if (!canAttemptOpen(idx)){
      status.innerText = `Page ${idx+1} is locked until previous page is completed.`;
      contentEl.innerHTML = '<p class="small">(Complete previous page first)</p>';
      setupNavButtons(idx);
      return;
    }
    // Show preview blurred
    const first = (page.content||'').split(/\n{2,}/).find(s=>s.trim()) || '(This page is empty)';
    contentEl.innerHTML = `<div style="filter:blur(3px);opacity:0.95">${escapeHtml(first)}</div>`;
    contentEl.style.pointerEvents='none';
    // open modal to attempt unlock
    openPasswordModalFor(idx);
    setupNavButtons(idx);
    return;
  }

  // show content (typewriter if not visited)
  contentEl.style.pointerEvents='auto';
  if (visited[idx]) {
    contentEl.innerHTML = escapeHtml(page.content).replace(/\n/g,'<br>');
  } else {
    typewriterTo(contentEl, page.content, 22);
  }
  setupNavButtons(idx);
}

function setupNavButtons(idx){
  const prev = $('prevBtn'), next = $('nextBtn'), home = $('homeLink'), shareBtn = $('shareBtn');
  if (prev){ prev.disabled = idx <= 0; prev.onclick = ()=> { if (idx>0) location.href = 'page.html?p='+(idx-1)+(getVParam()? '&v='+encodeURIComponent(getVParam()) : ''); }; }
  if (next){ next.disabled = idx >= pages.length-1; next.onclick = ()=> {
    const target = idx+1;
    if (PASSWORD_FLOW[target] && !unlocked[target]) {
      // require previous unlocked to attempt
      if (!canAttemptOpen(target)){ alert('You must complete the current page first.'); return; }
      openPasswordModalFor(target); return;
    }
    location.href = 'page.html?p='+target+(getVParam()? '&v='+encodeURIComponent(getVParam()) : '');
  }; }
  if (home) home.href = 'index.html' + (getVParam()? '?v='+encodeURIComponent(getVParam()):'');

  if (shareBtn){
    shareBtn.onclick = ()=> {
      const tok = buildTokenFromUnlocked();
      if (!tok) { alert('No unlocked pages to share yet. Unlock some pages or use master bypass.'); return; }
      const url = tokenURLFor(tok);
      navigator.clipboard.writeText(url).then(()=>alert('Link copied to clipboard'), ()=>prompt('Copy link:', url));
    };
  }
}

// apply v param helper
function applyVFromURL(){
  const v = getVParam();
  if (!v) return false;
  return applyTokenString(v);
}

// when index loads
async function onIndexLoad(){
  await window.clues_initPromise;
  renderIndexList();
}

// when page loads
async function onPageLoad(){
  await window.clues_initPromise;
  const params = new URLSearchParams(window.location.search);
  const p = Math.max(0, parseInt(params.get('p')||'0',10));
  const v = params.get('v'); if (v) applyTokenString(v);
  renderPageIndex(p);
}

// expose helpers for page.html
window.clues_applyTokenFromURL = applyTokenString;
window.clues_navigateTo = renderPageIndex;

// auto-run when included in index or page
(function autoRun(){
  // detect path
  const path = window.location.pathname.split('/').pop();
  if (path === '' || path === 'index.html') onIndexLoad();
  if (path === 'page.html') onPageLoad();
})();
