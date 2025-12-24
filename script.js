/* Final script.js — Sequential + Monthly backup (Option 3A), local device time
   - Pages expected in pages.json as array under "pages"
   - Page indices: 0..N-1 (we have 0..6)
   - Master pass: 'daniela' (case-insensitive)
   - Passwords required to open page i (i>=2) are in PASSWORD_FLOW[i]
   - Time backup:
       - page 2 (index 2) auto-unlocks when now >= firstOfCurrentMonth
       - page i>2 auto-unlocks when now >= firstOfMonthAfter(prevPageUnlockTimestamp)
   - Unlock timestamps stored in LS_UNLOCK_TS
   - Hints show after 3 failed attempts
   - Typewriter runs first view, skipped on revisit
   - Token support via ?v=ALL or ?v=2,3
*/

const MASTER_PASS = 'daniela';

const PASSWORD_FLOW = {
  2:'bloomrise',
  3:'paulanka',
  4:'amberlite',
  5:'softfracture',
  6:'violetluck' // STEP 1 ONLY
const PASSWORD_FLOW = { 2:'bloomrise', 3:'paulanka', 4:'amberlite', 5:'softfracture', 6:'violetluck' };
const HINTS = {
  2: "I open without sound when someone walks near; not a door, not a bloom — name the thing that wakes on the face like sunrise.",
  3: "A vintage voice that serenades young hearts; two names, one famous for a small-heart song — say him aloud.",
  4: "A gemstone warmed by daylight, then paired with the spark that sets it aglow — speak the fused glow.",
  5: "Part hush, part break — a gentle word for what’s broken but beloved; join the soft with the shard.",
  6: "Take the royal shade that stands its ground and pair it with a tiny omen that lands like a whisper — combine them into one quiet promise."
};

const FINAL_PAGE_INDEX = 6;
const FINAL_ANSWER = 'daniela';

const FINAL_HINT =
  "Every time I see that smile, I feel at ease. It’s one of those things that makes me trust you without even trying.";

const LS_UNLOCK = 'story_unlocked_v2';
const LS_UNLOCK_TS = 'story_unlocked_ts_v2';
// localStorage keys
const LS_UNLOCK = 'story_unlocked_v2';    // { "2": true }
const LS_UNLOCK_TS = 'story_unlocked_ts_v2'; // { "2":"2025-12-01T00:00:00.000Z" }
const LS_VISITED = 'story_visited_v2';
const LS_ATTEMPTS = 'story_attempts_v2';
const LS_PAGE7_LOCK = 'page7_lock_until';

let pages = [];
let unlocked = {};
@@ -37,226 +35,286 @@ let visited = {};
let attempts = {};
let currentIdx = 0;

/* ---------------- STATE ---------------- */

function loadState(){
  unlocked = JSON.parse(localStorage.getItem(LS_UNLOCK) || '{}');
  unlockTimestamps = JSON.parse(localStorage.getItem(LS_UNLOCK_TS) || '{}');
  visited = JSON.parse(localStorage.getItem(LS_VISITED) || '{}');
  attempts = JSON.parse(localStorage.getItem(LS_ATTEMPTS) || '{}');
  try{ unlocked = JSON.parse(localStorage.getItem(LS_UNLOCK)) || {}; }catch(e){ unlocked = {}; }
  try{ unlockTimestamps = JSON.parse(localStorage.getItem(LS_UNLOCK_TS)) || {}; }catch(e){ unlockTimestamps = {}; }
  try{ visited = JSON.parse(localStorage.getItem(LS_VISITED)) || {}; }catch(e){ visited = {}; }
  try{ attempts = JSON.parse(localStorage.getItem(LS_ATTEMPTS)) || {}; }catch(e){ attempts = {}; }
}
function saveState(){
  localStorage.setItem(LS_UNLOCK, JSON.stringify(unlocked));
  localStorage.setItem(LS_UNLOCK_TS, JSON.stringify(unlockTimestamps));
  localStorage.setItem(LS_VISITED, JSON.stringify(visited));
  localStorage.setItem(LS_ATTEMPTS, JSON.stringify(attempts));
function saveState(){ localStorage.setItem(LS_UNLOCK, JSON.stringify(unlocked)); localStorage.setItem(LS_UNLOCK_TS, JSON.stringify(unlockTimestamps)); localStorage.setItem(LS_VISITED, JSON.stringify(visited)); localStorage.setItem(LS_ATTEMPTS, JSON.stringify(attempts)); }

// token helpers
function applyTokenString(v){
  if (!v) return false;
  if (v.toUpperCase() === 'ALL'){
    for (let i=0;i<pages.length;i++){ unlocked[i]=true; visited[i]=true; unlockTimestamps[i] = new Date().toISOString(); }
    saveState(); return true;
  }
  if (/^[0-9,]+$/.test(v)){
    v.split(',').map(s=>parseInt(s,10)).filter(n=>!isNaN(n)).forEach(n=>{ unlocked[n]=true; visited[n]=true; unlockTimestamps[n] = unlockTimestamps[n] || new Date().toISOString(); });
    saveState(); return true;
  }
  try{ const dec = atob(v); const arr = JSON.parse(dec); if (Array.isArray(arr)) { arr.forEach(n=>{ unlocked[n]=true; visited[n]=true; unlockTimestamps[n] = unlockTimestamps[n] || new Date().toISOString(); }); saveState(); return true; } } catch(e){}
  return false;
}

/* ---------------- TIME BACKUP ---------------- */

function firstOfCurrentMonth(){
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
function getVParam(){ return new URLSearchParams(window.location.search).get('v'); }
function buildTokenFromUnlocked(){ const ks = Object.keys(unlocked).filter(k=>unlocked[k]).map(k=>parseInt(k)).sort((a,b)=>a-b); if(!ks.length) return ''; return ks.join(','); }
function tokenURLFor(v){ const url = new URL(window.location.href); url.searchParams.set('v', v); return url.toString(); }

// time helpers (local device time)
function firstOfCurrentMonthLocal(){
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1, 0,0,0,0);
}
function firstOfNextMonthFrom(ts){
  const d = new Date(ts);
  return new Date(d.getFullYear(), d.getMonth()+1, 1);
function firstOfMonthAfterDateLocal(dateIso){
  const d = new Date(dateIso);
  // next month first
  return new Date(d.getFullYear(), d.getMonth() + 1, 1, 0,0,0,0);
}
function nowIsOnOrAfter(dateObj){
  return new Date() >= dateObj;
}

// Apply monthly backup unlocks (Option 3A)
function applyMonthlyBackups(){
  if (!unlocked[2] && new Date() >= firstOfCurrentMonth()){
    unlocked[2] = true;
    unlockTimestamps[2] = new Date().toISOString();
  // Page 3 (index 2): unlock if now >= first of current month
  if (pages.length > 2){
    const idx = 2;
    if (!unlocked[idx]){
      const firstThisMonth = firstOfCurrentMonthLocal();
      if (nowIsOnOrAfter(firstThisMonth)){
        unlocked[idx] = true;
        unlockTimestamps[idx] = unlockTimestamps[idx] || new Date().toISOString();
      }
    }
  }
  for (let i=3;i<pages.length;i++){
  // For pages >2: if previous page has unlock timestamp, compute first-of-month after that ts
  for (let i = 3; i < pages.length; i++){
    if (unlocked[i]) continue;
    const prevTs = unlockTimestamps[i-1];
    if (prevTs && new Date() >= firstOfNextMonthFrom(prevTs)){
    const prev = i - 1;
    const prevTs = unlockTimestamps[prev];
    if (!prevTs) continue; // can't compute until prev unlocked
    const unlockDate = firstOfMonthAfterDateLocal(prevTs);
    if (nowIsOnOrAfter(unlockDate)){
      unlocked[i] = true;
      unlockTimestamps[i] = new Date().toISOString();
      unlockTimestamps[i] = unlockTimestamps[i] || new Date().toISOString();
    }
  }
  saveState();
}

/* ---------------- INIT ---------------- */

window.clues_initPromise = (async ()=>{
// fetch pages.json
window.clues_initPromise = (async function init(){
  loadState();
  const r = await fetch('pages.json');
  const j = await r.json();
  pages = j.pages || [];
  applyMonthlyBackups();
  try {
    const r = await fetch('pages.json');
    const json = await r.json();
    pages = json.pages || [];
    window.clues_pages = pages;
    // apply token if present in URL
    const v = getVParam();
    if (v) applyTokenString(v);
    // run monthly backup logic immediately
    applyMonthlyBackups();
    return true;
  } catch (e) {
    console.error('Failed to load pages.json', e);
    pages = [];
    window.clues_pages = pages;
    return false;
  }
})();

/* ---------------- HELPERS ---------------- */

// helpers
const $ = id => document.getElementById(id);
function escapeHtml(s){
  return String(s).replace(/[&<>"']/g,c=>({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}

/* ---------------- TYPEWRITER ---------------- */
function escapeHtml(s){ return String(s).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])); }

let skip=false;
async function typewriter(el,text){
  if (visited[currentIdx]){
    el.innerHTML = escapeHtml(text).replace(/\n/g,'<br>');
// typewriter (skip when visited)
let skipFlag = false;
async function typewriterTo(container, text, speed=22){
  if (visited[currentIdx]) {
    container.innerHTML = escapeHtml(text).replace(/\n/g,'<br>');
    return;
  }
  el.innerHTML='';
  let i=0;
  skip=false;
  return new Promise(res=>{
  container.innerHTML = '';
  skipFlag = false;
  return new Promise(resolve=>{
    let i=0;
    function step(){
      if (skip || i>=text.length){
        el.innerHTML = escapeHtml(text).replace(/\n/g,'<br>');
        visited[currentIdx]=true;
        saveState();
        res();
      if (skipFlag) {
        container.innerHTML = escapeHtml(text).replace(/\n/g,'<br>');
        visited[currentIdx]=true; saveState(); resolve();
        return;
      }
      el.innerHTML+=escapeHtml(text[i++]).replace(/\n/g,'<br>');
      setTimeout(step,22);
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
window.onclick=window.onkeydown=()=>skip=true;

/* ---------------- PASSWORD MODAL ---------------- */

function openPasswordModalFor(idx){
  const modal=$('modal');
  const pw=$('pwInput');
  const finalPw=$('finalPwInput');
  const msg=$('pwMessage');
  const hint=$('modalHint');

  modal.style.display='flex';
  pw.value='';
  msg.innerText='';
  hint.style.display='none';
  finalPw.style.display='none';

  attempts[idx]=attempts[idx]||0;

  $('submitPw').onclick=()=>{
    const now=Date.now();
    const lockUntil=localStorage.getItem(LS_PAGE7_LOCK);

    if (idx===FINAL_PAGE_INDEX && lockUntil && now<lockUntil){
      msg.innerText='Try again later.';
      return;
    }

    const val=pw.value.trim().toLowerCase();
    const finalVal=finalPw.value.trim().toLowerCase();

    // MASTER (disabled for page 7)
    if (val===MASTER_PASS && idx!==FINAL_PAGE_INDEX){
      pages.forEach((_,i)=>{
        unlocked[i]=true;
        visited[i]=true;
        unlockTimestamps[i]=new Date().toISOString();
      });
      saveState();
      modal.style.display='none';
      renderPageIndex(idx);
      return;
    }
window.addEventListener('click', ()=> skipFlag = true);
window.addEventListener('keydown', ()=> skipFlag = true);

// render index
function renderIndexList(){
  const container = $('pagesList'); if (!container) return;
  container.innerHTML = '';
  pages.forEach((p,i)=>{
    const row = document.createElement('div'); row.className='page-row';
    const link = document.createElement('a'); link.className='page-link';
    const v = getVParam();
    link.href = 'page.html?p=' + i + (v ? '&v=' + encodeURIComponent(v) : '');
    link.innerText = `Page ${i+1}${p.title ? ' — ' + p.title : ''}`;
    const meta = document.createElement('div'); meta.className='page-meta';
    meta.innerText = (i<=1) ? 'Open' : 'Locked (sequential)';
    row.appendChild(link); row.appendChild(meta); container.appendChild(row);
  });
  const st = $('status'); if (st) st.innerText = `Loaded ${pages.length} page${pages.length!==1?'s':''}`;
}

    // PAGE 7 STEP 1
    if (idx===FINAL_PAGE_INDEX && !unlocked['p7step1']){
      if (val==='violetluck'){
        unlocked['p7step1']=true;
        saveState();
        finalPw.style.display='block';
        msg.innerText='Put final guess on who.';
        return;
      }
      return fail();
    }
// check if user can attempt open of target page (sequential rule)
function canAttemptOpen(targetIdx){
  if (targetIdx <= 1) return true;
  // sequential: previous page must be unlocked (or visited)
  const prev = targetIdx - 1;
  if (unlocked[prev] || visited[prev]) return true;
  // also allow time-based unlocks (call applyMonthlyBackups to ensure up-to-date)
  applyMonthlyBackups();
  return !!unlocked[prev] || !!visited[prev];
}

    // PAGE 7 STEP 2
    if (idx===FINAL_PAGE_INDEX && unlocked['p7step1']){
      if (finalVal===FINAL_ANSWER){
        unlocked[idx]=true;
        visited[idx]=true;
        unlockTimestamps[idx]=new Date().toISOString();
        saveState();
        modal.style.display='none';
        renderPageIndex(idx);
        return;
      }
      return fail();
// open password modal for target
function openPasswordModalFor(targetIdx){
  const modal = $('modal');
  const pwInput = $('pwInput'); const msg = $('pwMessage'); const modalHint = $('modalHint');
  const tokenField = $('tokenField'); const shareRow = $('shareRow');
  modal.style.display = 'flex'; modal.setAttribute('aria-hidden','false');
  pwInput.value=''; msg.innerText=''; modalHint.style.display='none';
  $('modalTitle').innerText = `Unlock Page ${targetIdx+1}`;
  $('modalNote').innerText = HINTS[targetIdx] ? 'Solve the riddle to unlock.' : 'Enter the password to unlock this page.';
  attempts[targetIdx] = attempts[targetIdx] || 0;
  shareRow.style.display = buildTokenFromUnlocked() ? 'flex' : 'none';
  tokenField.value = buildTokenFromUnlocked() ? tokenURLFor(buildTokenFromUnlocked()) : '';

  function submit(){
    const val = (pwInput.value||'').trim().toLowerCase();
    if (!val){ msg.innerText='Please enter a password.'; return; }
    // master bypass
    if (val === MASTER_PASS.toLowerCase()){
      for (let i=0;i<pages.length;i++){ unlocked[i]=true; visited[i]=true; unlockTimestamps[i] = unlockTimestamps[i] || new Date().toISOString(); }
      saveState(); modal.style.display='none'; renderPageIndex(targetIdx); return;
    }

    // NORMAL PAGE
    if (val===PASSWORD_FLOW[idx]){
      unlocked[idx]=true;
      visited[idx]=true;
      unlockTimestamps[idx]=new Date().toISOString();
    const correct = (PASSWORD_FLOW[targetIdx] || '').toLowerCase();
    if (correct && val === correct){
      unlocked[targetIdx] = true;
      unlockTimestamps[targetIdx] = unlockTimestamps[targetIdx] || new Date().toISOString();
      visited[targetIdx] = true;
      saveState();
      modal.style.display='none';
      renderPageIndex(idx);
      renderPageIndex(targetIdx);
      return;
    }

    fail();
  };

  function fail(){
    attempts[idx]++;
    saveState();
    msg.innerText='Incorrect.';

    if (idx===FINAL_PAGE_INDEX && attempts[idx]===1){
      localStorage.setItem(LS_PAGE7_LOCK, Date.now()+2*60*60*1000);
    }
    if (idx===FINAL_PAGE_INDEX && attempts[idx]>=3){
      hint.style.display='block';
      hint.innerText=FINAL_HINT;
    attempts[targetIdx] = (attempts[targetIdx]||0) + 1; saveState(); msg.innerText='Incorrect password.';
    if (attempts[targetIdx] >= 3){
      modalHint.style.display = 'block';
      modalHint.innerText = HINTS[targetIdx] || 'No hint available.';
    }
  }

  $('cancelPw').onclick=()=>modal.style.display='none';
  $('submitPw').onclick = submit;
  $('cancelPw').onclick = ()=> { modal.style.display='none'; msg.innerText=''; };
  $('copyBtn').onclick = async ()=> { const txt = tokenField.value; if(!txt) return; try{ await navigator.clipboard.writeText(txt); $('copyBtn').innerText='Copied'; setTimeout(()=>$('copyBtn').innerText='Copy',1200);}catch(e){ alert('Copy failed'); } };
  pwInput.onkeydown = (e)=>{ if (e.key === 'Enter') submit(); if (e.key === 'Escape') modal.style.display='none'; };
}

/* ---------------- PAGE RENDER ---------------- */
// helpers for tokens
function tokenURLFor(v){ const u = new URL(window.location.href); u.searchParams.set('v', v); return u.toString(); }

// render a page (page.html)
function renderPageIndex(idx){
  currentIdx=idx;
  applyMonthlyBackups();
  currentIdx = idx;
  const contentEl = $('content'); const status = $('status');
  if (!contentEl || !status) return;
  status.innerText = `Page ${idx+1} / ${pages.length}`;
  const page = pages[idx] || { title:'', content:'' };

  const page=pages[idx];
  $('status').innerText=`Page ${idx+1} / ${pages.length}`;
  // run monthly backups each render
  applyMonthlyBackups();

  // If the page is subject to password flow and not unlocked
  if (PASSWORD_FLOW[idx] && !unlocked[idx]){
    $('content').innerHTML='<p class="small">(Locked)</p>';
    // ensure sequential precondition
    if (!canAttemptOpen(idx)){
      status.innerText = `Page ${idx+1} is locked until the previous page is completed.`;
      contentEl.innerHTML = '<p class="small">(Complete previous page first.)</p>';
      setupNavButtons(idx);
      return;
    }
    // show blurred preview and open modal for unlocking
    const firstPara = (page.content||'').split(/\n{2,}/).find(s=>s.trim()) || '(This page is empty)';
    contentEl.innerHTML = `<div style="filter:blur(3px);opacity:0.95">${escapeHtml(firstPara)}</div>`;
    contentEl.style.pointerEvents='none';
    openPasswordModalFor(idx);
    setupNavButtons(idx);
    return;
  }

  if (visited[idx]){
    $('content').innerHTML=escapeHtml(page.content).replace(/\n/g,'<br>');
  } else {
    typewriter($('content'),page.content);
  }
  contentEl.style.pointerEvents='auto';
  if (visited[idx]) contentEl.innerHTML = escapeHtml(page.content).replace(/\n/g,'<br>');
  else typewriterTo(contentEl, page.content, 22);

  $('prevBtn').disabled=idx===0;
  $('nextBtn').disabled=idx===pages.length-1;
  setupNavButtons(idx);
}

  $('prevBtn').onclick=()=>location.href=`page.html?p=${idx-1}`;
  $('nextBtn').onclick=()=>location.href=`page.html?p=${idx+1}`;
function setupNavButtons(idx){
  const prev = $('prevBtn'), next = $('nextBtn'), home = $('homeLink'), shareBtn = $('shareBtn');
  if (prev){ prev.disabled = idx <= 0; prev.onclick = ()=> { if (idx>0) location.href = 'page.html?p=' + (idx-1) + (getVParam()? '&v='+encodeURIComponent(getVParam()): ''); }; }
  if (next){ next.disabled = idx >= pages.length-1; next.onclick = ()=> {
    const target = idx + 1;
    // if target requires password and not unlocked, ensure sequential and open modal
    if (PASSWORD_FLOW[target] && !unlocked[target]) {
      if (!canAttemptOpen(target)) { alert('You must complete the current page first.'); return; }
      openPasswordModalFor(target);
      return;
    }
    location.href = 'page.html?p=' + target + (getVParam()? '&v='+encodeURIComponent(getVParam()): '');
  }; }
  if (home) home.href = 'index.html' + (getVParam()? '?v='+encodeURIComponent(getVParam()): '');
  if (shareBtn){
    shareBtn.onclick = ()=> {
      const tok = buildTokenFromUnlocked();
      if (!tok) { alert('No unlocked pages to share yet. Unlock some pages or use the master bypass.'); return; }
      const url = tokenURLFor(tok);
      navigator.clipboard.writeText(url).then(()=>alert('Link copied to clipboard'), ()=>prompt('Copy link:', url));
    };
  }
}

/* ---------------- BOOT ---------------- */
// apply v param helper wrapper (exposed)
function applyVFromURL(){
  const v = getVParam();
  if (!v) return false;
  return applyTokenString(v);
}

// expose helpers
window.clues_applyTokenFromURL = applyTokenString;
window.clues_navigateTo = renderPageIndex;
window.clues_pages = pages;

(async ()=>{
// boot logic for index/page
(async function boot(){
  await window.clues_initPromise;
  const p=parseInt(new URLSearchParams(location.search).get('p')||0,10);
  renderPageIndex(p);
  const path = window.location.pathname.split('/').pop();
  if (path === '' || path === 'index.html') renderIndexList();
  if (path === 'page.html') {
    const params = new URLSearchParams(window.location.search);
    const p = Math.max(0, parseInt(params.get('p')||'0',10));
    const v = params.get('v'); if (v) applyTokenString(v);
    renderPageIndex(p);
  }
})();
