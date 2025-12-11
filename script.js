/* Final unified script.js
   - Uses DOC_PUB_URL
   - Splits on ==PAGE==
   - Passwords & hints as requested
   - Daniela master bypass (silent)
   - Token sync ?v=2,3,5  or ?v=ALL
   - Typewriter first-view only (persisted)
   - Hint tooltip after 3 wrong attempts
*/

const DOC_PUB_URL = 'https://docs.google.com/document/d/e/2PACX-1vRIzDF5V10ykJNamnHWrjM1YFlMrE9uZfMMDSuH1uo_Mb4Si0RFOUm6pmxB1padhPD9iICKQxEG0B-Z/pub?output=txt';
const DIVIDER = '==PAGE==';
const TYPE_SPEED = 28;

// passwords and hints (lowercase passwords)
const PAGE_PASSWORDS = { 2:'bloomrise', 3:'paulanka', 4:'amberlit', 5:'softfracture', 6:'violetluck' };
const PAGE_HINTS = {
  2: "I open without sound when someone walks near; not a door, not a bloom — name the thing that wakes on the face like sunrise.",
  3: "A vintage voice that serenades young hearts; two names, one famous for a small-heart song — say him aloud.",
  4: "A gemstone warmed by daylight, then paired with the spark that sets it aglow — speak the fused glow.",
  5: "Part hush, part break — a gentle word for what’s broken but beloved; join the soft with the shard.",
  6: "Take the royal shade that stands its ground and pair it with a tiny omen that lands like a whisper — combine them into one quiet promise."
};
const MASTER = 'daniela';

// localStorage keys
const LS_UNLOCK = 'mp_unlock_v2';
const LS_VISITED = 'mp_visited_v2';
const LS_ATTEMPTS = 'mp_attempts_v2';

let pages = [];
let unlocked = {}; // { "2": true, ... }
let visited = {};  // { "0": true, ... }
let attempts = {}; // { "2": 1, ... }
let currentIdx = 0;
let initResolve; window.clues_initPromise = new Promise(r => initResolve = r);

// storage helpers
function loadState(){
  try{ unlocked = JSON.parse(localStorage.getItem(LS_UNLOCK)) || {}; }catch(e){ unlocked={}; }
  try{ visited = JSON.parse(localStorage.getItem(LS_VISITED)) || {}; }catch(e){ visited={}; }
  try{ attempts = JSON.parse(localStorage.getItem(LS_ATTEMPTS)) || {}; }catch(e){ attempts={}; }
}
function saveState(){ localStorage.setItem(LS_UNLOCK, JSON.stringify(unlocked)); localStorage.setItem(LS_VISITED, JSON.stringify(visited)); localStorage.setItem(LS_ATTEMPTS, JSON.stringify(attempts)); }

// fetch & clean doc
async function fetchDoc(){
  const r = await fetch(DOC_PUB_URL);
  if (!r.ok) throw new Error('Fetch failed: ' + r.status);
  let txt = await r.text();
  // if HTML returned, extract body text
  if (txt.trim().startsWith('<')) {
    const doc = new DOMParser().parseFromString(txt,'text/html');
    doc.querySelectorAll('style,script').forEach(e=>e.remove());
    txt = doc.body ? doc.body.textContent || '' : txt;
  }
  txt = txt.replace(/Published using Google Docs.*(\n|$)/gi,'');
  txt = txt.replace(/Learn more.*(\n|$)/gi,'');
  txt = txt.replace(/Updated automatically.*(\n|$)/gi,'');
  txt = txt.replace(/\r\n/g,'\n').replace(/\t/g,' ').replace(/[ \u00A0]{2,}/g,' ');
  txt = txt.replace(/\n{3,}/g,'\n\n').trim();
  return txt;
}

// split pages
function splitPages(txt){
  if (!txt) return [];
  return txt.split(DIVIDER).map(s=>s.trim());
}

// token helpers (v param supports: ALL, comma list like 2,3,5, or base64 JSON [2,3])
function applyTokenString(v){
  if (!v) return false;
  if (v.toUpperCase()==='ALL'){
    pages.forEach((_,i)=>{ unlocked[i]=true; visited[i]=true; });
    saveState(); return true;
  }
  if (/^[0-9,]+$/.test(v)){
    v.split(',').map(s=>parseInt(s,10)).filter(n=>!isNaN(n)).forEach(n=>{ unlocked[n]=true; visited[n]=true; });
    saveState(); return true;
  }
  // try base64 JSON
  try {
    const dec = atob(v);
    const arr = JSON.parse(dec);
    if (Array.isArray(arr)) { arr.forEach(n=>{ if (typeof n==='number') { unlocked[n]=true; visited[n]=true; } }); saveState(); return true; }
  } catch(e){}
  return false;
}
function buildTokenFromUnlocked(){
  const keys = Object.keys(unlocked).filter(k=>unlocked[k]).map(k=>parseInt(k)).sort((a,b)=>a-b);
  if (!keys.length) return '';
  return keys.join(',');
}
function tokenURLFor(v){
  const url = new URL(window.location.href);
  url.searchParams.set('v', v);
  return url.toString();
}
function getVParam(){ return new URLSearchParams(window.location.search).get('v'); }

// rendering helpers
function escapeHtml(s){ return String(s).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])); }
function paragraphsFrom(text){ return text.split(/\n{2,}/).map(s=>s.trim()).filter(Boolean); }

function instantShow(pars, container){
  container.innerHTML = '';
  pars.forEach(p=>{
    const el = document.createElement('p');
    el.innerHTML = escapeHtml(p).replace(/\n/g,'<br>');
    container.appendChild(el);
  });
}
function typeShow(pars, container, done){
  container.innerHTML = '';
  let pi = 0;
  function nextPara(){
    if (pi>=pars.length){ if (done) done(); return; }
    const text = pars[pi];
    const pEl = document.createElement('p');
    container.appendChild(pEl);
    let i=0;
    function step(){
      if (i < text.length){
        pEl.innerHTML += escapeHtml(text.charAt(i)).replace(/\n/g,'<br>');
        i++; setTimeout(step, TYPE_SPEED);
      } else { pi++; setTimeout(nextPara, TYPE_SPEED*6); }
    }
    step();
  }
  nextPara();
}

// unlock schedule (1st-of-month series)
function firstOfMonthAfterMonthsFromNow(monthsAhead=0){
  const now=new Date(); const base=new Date(now.getFullYear(), now.getMonth(), 1);
  if (now.getDate()>1 || now.getHours()>0 || now.getMinutes()>0 || now.getSeconds()>0) base.setMonth(base.getMonth()+1);
  base.setMonth(base.getMonth()+monthsAhead); base.setHours(0,0,0,0); return base;
}
function getUnlockDateForPage(pageIdx){
  if (pageIdx < 2) return new Date(0);
  return firstOfMonthAfterMonthsFromNow(pageIdx-2);
}
function daysUntil(date){ const ms=date - new Date(); return ms<=0?0:Math.ceil(ms/(1000*60*60*24)); }

// render page index (called by page.html)
function renderPageIndex(idx){
  const content = document.getElementById('content');
  const status = document.getElementById('status');
  if (!content || !status) return;
  currentIdx = idx;
  status.innerText = `Page ${idx+1} / ${pages.length}`;
  const raw = pages[idx] || '';
  const pars = paragraphsFrom(raw);
  const pw = PAGE_PASSWORDS[idx];
  const isUnlocked = !!unlocked[idx];

  if (pw && !isUnlocked){
    const unlockDate = getUnlockDateForPage(idx);
    const days = daysUntil(unlockDate);
    status.innerText = `Page ${idx+1} / ${pages.length} — This page will become accessible in ${days} day${days!==1?'s':''}.`;
    // blurred preview
    content.innerHTML = '';
    const first = (raw.split(/\n{2,}/).map(s=>s.trim()).filter(Boolean)[0]) || '(This page is empty)';
    const preview = document.createElement('div');
    preview.innerHTML = '<p>' + escapeHtml(first).replace(/\n/g,'<br>') + '</p>';
    preview.style.filter = 'blur(3px)'; preview.style.opacity = '0.95';
    content.appendChild(preview); content.style.pointerEvents = 'none';
    openPasswordModal(idx);
    setupNavButtons(idx);
    return;
  }

  content.style.pointerEvents = '';
  if (visited[idx]) instantShow(pars, content);
  else typeShow(pars, content, ()=>{ visited[idx]=true; saveState(); });

  setupNavButtons(idx);
}

// modal + password flow
function openPasswordModal(pageIndex){
  const modal=document.getElementById('modal');
  const pwInput=document.getElementById('pwInput');
  const msg=document.getElementById('pwMessage');
  const hintTooltip=document.getElementById('hintTooltip');
  const modalHint=document.getElementById('modalHint');
  const shareRow=document.getElementById('shareRow');
  const tokenField=document.getElementById('tokenField');

  if(!modal) return;
  modal.style.display='flex'; modal.setAttribute('aria-hidden','false');
  msg.innerText=''; pwInput.value=''; document.getElementById('modalTitle').innerText=`Unlock Page ${pageIndex+1}`;
  document.getElementById('modalNote').innerText='Enter the password to unlock this page.';
  hintTooltip.classList.remove('show'); hintTooltip.setAttribute('aria-hidden','true'); hintTooltip.textContent = PAGE_HINTS[pageIndex] || '';
  modalHint.style.display='none'; modalHint.textContent = PAGE_HINTS[pageIndex] || '';

  attempts[pageIndex] = attempts[pageIndex] || 0;
  shareRow.style.display = buildTokenFromUnlocked() ? 'flex' : 'none';
  tokenField.value = buildTokenFromUnlocked() ? tokenURLFor(buildTokenFromUnlocked()) : '';

  function onSubmit(){
    const raw = (pwInput.value || '').trim().toLowerCase();
    if (!raw){ msg.innerText='Please enter a password.'; return; }

    // master bypass
    if (raw === MASTER.toLowerCase()){
      pages.forEach((_,i)=>{ unlocked[i]=true; visited[i]=true; });
      saveState();
      modal.style.display='none';
      tokenField.value = tokenURLFor('ALL'); shareRow.style.display='flex';
      renderPageIndex(pages.length-1);
      return;
    }

    const correct = PAGE_PASSWORDS[pageIndex];
    if (correct && raw === correct.toLowerCase()){
      unlocked[pageIndex] = true; visited[pageIndex] = true; saveState();
      modal.style.display='none'; tokenField.value = tokenURLFor(buildTokenFromUnlocked()); shareRow.style.display='flex';
      renderPageIndex(pageIndex); return;
    }

    // incorrect
    attempts[pageIndex] = (attempts[pageIndex]||0) + 1; saveState(); msg.innerText='Incorrect password.';
    if (attempts[pageIndex] >= 3){
      hintTooltip.setAttribute('aria-hidden','false'); hintTooltip.classList.add('show');
    }
  }

  document.getElementById('submitPw').onclick = onSubmit;
  document.getElementById('cancelPw').onclick = ()=>{ modal.style.display='none'; msg.innerText=''; };
  document.getElementById('copyBtn').onclick = async ()=>{
    const txt = tokenField.value; if(!txt) return;
    try{ await navigator.clipboard.writeText(txt); document.getElementById('copyBtn').innerText='Copied'; setTimeout(()=>document.getElementById('copyBtn').innerText='Copy',1200);}catch(e){ alert('Copy failed'); }
  };
  pwInput.onkeydown = (e)=>{ if (e.key==='Enter') onSubmit(); if (e.key==='Escape') modal.style.display='none'; };

  if ((attempts[pageIndex]||0) >= 3){ hintTooltip.setAttribute('aria-hidden','false'); hintTooltip.classList.add('show'); }
}

// nav buttons
function setupNavButtons(currentIdx){
  const prev = document.getElementById('prevBtn'), next = document.getElementById('nextBtn'), home = document.getElementById('homeLink');
  if (prev){ prev.disabled = currentIdx <= 0; prev.onclick = ()=>{ if(currentIdx>0) location.href = 'page.html?p=' + (currentIdx-1) + (getVParam()? '&v='+encodeURIComponent(getVParam()):''); } }
  if (next){ next.disabled = currentIdx >= pages.length-1; next.onclick = ()=>{ if(currentIdx < pages.length-1){ const target = currentIdx+1; if (PAGE_PASSWORDS[target] && !unlocked[target]) { openPasswordModal(target); return; } location.href = 'page.html?p=' + target + (getVParam()? '&v='+encodeURIComponent(getVParam()):''); } } }
  if (home) home.href = 'index.html' + (getVParam()? '?v='+encodeURIComponent(getVParam()):'');
  const shareBtn = document.getElementById('shareBtn'); if (shareBtn) shareBtn.onclick = ()=>{ const tok = buildTokenFromUnlocked(); if(!tok){ alert('No unlocked pages to share yet.'); return; } const url = tokenURLFor(tok); navigator.clipboard.writeText(url).then(()=>alert('Link copied'), ()=>prompt('Copy link:', url)); };
}

// index page builder
function buildIndexList(){
  const container = document.getElementById('pagesList'); if(!container) return; container.innerHTML='';
  pages.forEach((p,i)=>{ const row = document.createElement('div'); row.className='page-row'; const preview = (p.split(/\n/).find(l=>l.trim().length) || '').trim() || '(empty)'; const link = document.createElement('a'); const v = getVParam(); link.href = 'page.html?p=' + i + (v ? '&v='+encodeURIComponent(v):''); link.innerText = `Page ${i+1}: ${ preview.length>80 ? preview.slice(0,80)+'…' : preview }`; row.appendChild(link); container.appendChild(row); });
  const status = document.getElementById('status'); if (status) status.innerText = `Loaded ${pages.length} page${pages.length!==1?'s':''}`;
}

// token helpers used above
function buildTokenFromUnlocked(){ const ks = Object.keys(unlocked).filter(k=>unlocked[k]).map(k=>parseInt(k)).sort((a,b)=>a-b); if(!ks.length) return ''; return ks.join(','); }
function tokenURLFor(v){ const url = new URL(window.location.href); url.searchParams.set('v', v); return url.toString(); }
function getVParam(){ return new URLSearchParams(window.location.search).get('v'); }

// apply v param at load
function applyVParam(){
  const v = getVParam(); if(!v) return false; return applyTokenString(v);
}

// init
(async function init(){
  loadState();
  try{
    const raw = await fetchDoc();
    pages = splitPages(raw);
    window.clues_pages = pages;
    applyVParam();
    buildIndexList();
    initResolve();
  } catch(e){
    console.error('Init failed', e);
    const status = document.getElementById('status'); if (status) status.innerText = 'Error loading document';
    initResolve();
  }
})();

// expose for page.html
window.clues_applyTokenFromURL = function(v){ return applyTokenString(v); };
window.clues_navigateTo = function(p){ renderPageIndex(Math.max(0, Math.min(pages.length-1, parseInt(p)||0))); };
window.clues_pages = pages;
