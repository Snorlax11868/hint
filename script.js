/******************************************************************************
 * script.js
 *
 * Multi-page site core:
 * - fetches your Google Doc (plain-text export)
 * - strips residual Google footer lines
 * - splits on ==PAGE== into pages
 * - supports per-page password locking (indices 2..6)
 * - Daniela master bypass (unlocks all pages)
 * - URL tokens: ?v=2,3,5  or ?v=ALL  to sync unlocked/visited pages across devices
 * - monthly unlock schedule: pages unlock on 1st of month (page2 -> next 1st, page3 -> +1 month...)
 * - hint tooltip auto-appears after 3 wrong attempts for that page
 * - typewriter on first view; skip on revisit (persisted)
 *
 * IMPORTANT:
 * - Set SHARE_DOC_ID below to your doc ID (edit view ID ok if "Anyone with the link" viewer)
 ******************************************************************************/

/* ---------------- CONFIG ---------------- */
const SHARE_DOC_ID = '1zAIQ5dOs-g6RImawO_AFONp9RreqFMaJknvGR_c4jYo'; // your doc id
const DOC_EXPORT_TXT = `https://docs.google.com/document/d/${SHARE_DOC_ID}/export?format=txt`;
const DIVIDER = '==PAGE==';

// Passwords (page index -> password)
const PAGE_PASSWORDS = {
  2: 'bloomrise',
  3: 'paulanka',
  4: 'amberlit',
  5: 'softfracture',
  6: 'violetluck'
};

const PAGE_HINTS = {
  2: "I open without sound when someone walks near; not a door, not a bloom — name the thing that wakes on the face like sunrise.",
  3: "A vintage voice that serenades young hearts; two names, one famous for a small-heart song — say him aloud.",
  4: "A gemstone warmed by daylight, then paired with the spark that sets it aglow — speak the fused glow.",
  5: "Part hush, part break — a gentle word for what’s broken but beloved; join the soft with the shard.",
  6: "Take the royal shade that stands its ground and pair it with a tiny omen that lands like a whisper — combine them into one quiet promise."
};

const DANIELA = 'daniela'; // master bypass (case-insensitive)
const TYPE_SPEED = 35;

/* Persistence keys */
const KEY_UNLOCK = 'clues_unlocked_v1'; // stores object {index:true}
const KEY_VISITED = 'clues_visited_v1'; // stores object {index:true}
const KEY_ATTEMPTS = 'clues_attempts_v1'; // stores object {index:count}

/* State */
let clues_pages = [];              // array of raw page text
let clues_unlocked = {};           // loaded from localStorage
let clues_visited = {};            // loaded from localStorage
let clues_attempts = {};           // loaded from localStorage
let clues_token = '';              // token string if present
let clues_initPromise;             // promise that resolves when pages loaded

/* ---------- helpers: storage ---------- */
function loadState(){
  try { clues_unlocked = JSON.parse(localStorage.getItem(KEY_UNLOCK)) || {}; } catch(e){ clues_unlocked = {}; }
  try { clues_visited = JSON.parse(localStorage.getItem(KEY_VISITED)) || {}; } catch(e){ clues_visited = {}; }
  try { clues_attempts = JSON.parse(localStorage.getItem(KEY_ATTEMPTS)) || {}; } catch(e){ clues_attempts = {}; }
}
function saveState(){
  localStorage.setItem(KEY_UNLOCK, JSON.stringify(clues_unlocked));
  localStorage.setItem(KEY_VISITED, JSON.stringify(clues_visited));
  localStorage.setItem(KEY_ATTEMPTS, JSON.stringify(clues_attempts));
}

/* ---------- fetch & clean doc ---------- */
async function fetchDocText(){
  // try export txt (best chance at plain text)
  try {
    const r = await fetch(DOC_EXPORT_TXT);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    let txt = await r.text();
    // remove likely Google footer lines
    txt = txt.replace(/Published using Google Docs.*(\n|$)/gi, '');
    txt = txt.replace(/Learn more.*(\n|$)/gi, '');
    txt = txt.replace(/Updated automatically.*(\n|$)/gi, '');
    // collapse extraneous whitespace
    txt = txt.replace(/\r\n/g, '\n').replace(/\t/g,' ').replace(/[ \u00A0]{2,}/g,' ');
    txt = txt.replace(/\n{3,}/g,'\n\n').trim();
    return txt;
  } catch(err){
    // fallback: try fetch /pub HTML and extract textContent
    try {
      const pubUrl = `https://docs.google.com/document/d/${SHARE_DOC_ID}/pub`;
      const r2 = await fetch(pubUrl);
      if (!r2.ok) throw new Error('HTTP ' + r2.status);
      const html = await r2.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      // remove style/script
      doc.querySelectorAll('style,script').forEach(e=>e.remove());
      const bodyText = doc.body ? doc.body.textContent || '' : html;
      let txt = bodyText.replace(/\r\n/g,'\n').replace(/\t/g,' ').replace(/[ \u00A0]{2,}/g,' ').replace(/\n{3,}/g,'\n\n').trim();
      txt = txt.replace(/Published using Google Docs.*(\n|$)/gi, '');
      txt = txt.replace(/Learn more.*(\n|$)/gi, '');
      txt = txt.replace(/Updated automatically.*(\n|$)/gi, '');
      return txt;
    } catch(err2){
      throw new Error('Failed to fetch Google Doc: ' + err2.toString());
    }
  }
}

/* ---------- split into pages ---------- */
function splitPages(raw){
  if (!raw) return [];
  const parts = raw.split(DIVIDER).map(s=>s.trim());
  return parts;
}

/* --------- unlock schedule: 1st of months ---------- */
function firstOfMonthAfterMonthsFromNow(monthsAhead=0){
  const now = new Date();
  const base = new Date(now.getFullYear(), now.getMonth(), 1);
  if (now.getDate() > 1 || now.getHours() > 0 || now.getMinutes() > 0 || now.getSeconds() > 0) {
    base.setMonth(base.getMonth() + 1);
  }
  base.setMonth(base.getMonth() + monthsAhead);
  base.setHours(0,0,0,0);
  return base;
}
function getUnlockDateForPage(pageIdx){
  if (pageIdx < 2) return new Date(0);
  const monthsAhead = pageIdx - 2;
  return firstOfMonthAfterMonthsFromNow(monthsAhead);
}
function daysUntil(date){
  const ms = date - new Date();
  if (ms <= 0) return 0;
  return Math.ceil(ms / (1000*60*60*24));
}

/* ---------- token helpers (Option B) ----------
   Token formats supported on URL v=:
   - v=ALL             -> unlock all pages
   - v=2,3,5           -> unlock specific page indices
   - v=<base64>        -> base64'd JSON array [2,3,5] (optional)
*/
function buildTokenFromUnlocked(){
  const keys = Object.keys(clues_unlocked).filter(k=>clues_unlocked[k]).map(k=>parseInt(k)).sort((a,b)=>a-b);
  if (!keys.length) return '';
  return keys.join(',');
}
function showShareToken(valueOverride){
  const v = valueOverride ? valueOverride : buildTokenFromUnlocked();
  if (!v) return;
  const url = new URL(window.location.href);
  url.searchParams.set('v', v);
  // we show this in modal's tokenField where needed
  return url.toString();
}
function applyTokenString(v){
  if (!v) return false;
  if (v.toUpperCase() === 'ALL') {
    for (let i=0;i<clues_pages.length;i++){ clues_unlocked[i]=true; clues_visited[i]=true; }
    saveState();
    return true;
  }
  // try comma list
  if (/^[0-9,]+$/.test(v)) {
    const parts = v.split(',').map(s=>parseInt(s,10)).filter(n=>!isNaN(n) && n>=0 && n<clues_pages.length);
    parts.forEach(n=>{ clues_unlocked[n]=true; clues_visited[n]=true; });
    saveState();
    return parts.length>0;
  }
  // try base64 decode -> JSON array
  try {
    const decoded = atob(v);
    const arr = JSON.parse(decoded);
    if (Array.isArray(arr)) {
      arr.forEach(n=>{ if (typeof n === 'number' && n>=0 && n<clues_pages.length) { clues_unlocked[n]=true; clues_visited[n]=true; }});
      saveState();
      return true;
    }
  } catch(e){}
  return false;
}

/* ---------- UI utility ---------- */
function byId(id){ return document.getElementById(id); }
function setStatus(s){ const e = byId('status'); if(e) e.innerText = s; }

/* ---------- rendering & typewriter ---------- */
function escapeHtml(str){ return str.replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])); }

function renderPageHtml(text){
  const paragraphs = text.split(/\n{2,}/).map(s=>s.trim()).filter(Boolean);
  return paragraphs;
}

function instantShow(paragraphs, container){
  container.innerHTML = '';
  paragraphs.forEach(p=>{
    const el = document.createElement('p');
    el.innerHTML = escapeHtml(p).replace(/\n/g,'<br>');
    container.appendChild(el);
  });
}

function typeParagraphs(paragraphs, container, done){
  container.innerHTML = '';
  let p = 0;
  function nextPara(){
    if (p >= paragraphs.length) { if(done) done(); return; }
    const text = paragraphs[p];
    const pEl = document.createElement('p');
    container.appendChild(pEl);
    let i = 0;
    function step(){
      if (i < text.length){
        pEl.innerHTML += escapeHtml(text.charAt(i)).replace(/\n/g,'<br>');
        i++;
        setTimeout(step, TYPE_SPEED);
      } else {
        p++;
        setTimeout(nextPara, TYPE_SPEED * 6);
      }
    }
    step();
  }
  nextPara();
}

/* ---------- public helpers used by index/page pages ---------- */

/**
 * clues_initPromise resolves once pages are fetched and split into clues_pages
 */
clues_initPromise = (async function init(){
  loadState();
  setStatus('Fetching document…');
  const raw = await fetchDocText();
  clues_pages = splitPages(raw);
  // expose pages on window for index.html script
  window.clues_pages = clues_pages;
  setStatus(`Loaded ${clues_pages.length} page${clues_pages.length!==1?'s':''}`);
})();

/* Expose helper to apply token from URL param v (used by page.html) */
window.clues_applyTokenFromURL = function(v){
  // v may be actual string from URL; try direct then decode if needed
  if (!v) return false;
  // decode if it's URL-encoded JSON token
  try {
    const applied = applyTokenString(v);
    if (applied) {
      clues_token = v;
      return true;
    }
  } catch(e){}
  return false;
};

/* Expose navigate to a page (page.html uses this) */
window.clues_navigateTo = function(pageIdx){
  // ensure pages loaded
  clues_initPromise.then(()=>{
    const idx = Math.max(0, Math.min(clues_pages.length-1, pageIdx|0));
    renderPageIndex(idx);
  }).catch(err=>{
    setStatus('Load failed');
    console.error(err);
  });
};

/* ---------- render a page index (main flow for page.html) ---------- */
function renderPageIndex(idx){
  const container = byId('content');
  setStatus(`Page ${idx+1} / ${clues_pages.length}`);

  const raw = clues_pages[idx] || '';
  const paragraphs = renderPageHtml(raw);

  const required = PAGE_PASSWORDS[idx]; // undefined if not locked
  const isUnlocked = !!clues_unlocked[idx];
  const unlockDate = getUnlockDateForPage(idx);
  const days = daysUntil(unlockDate);

  if (required && !isUnlocked) {
    // show formal message and blurred preview
    setStatus(`Page ${idx+1} / ${clues_pages.length} — This page will become accessible in ${days} day${days!==1?'s':''}.`);
    showLockedPreview(raw);
    // open modal to allow password attempts and/or token copy
    openPasswordModal(idx);
    // set prev/next link buttons but do not change state here
    setupNavButtons(idx);
    return;
  }

  // unlocked or no password
  if (clues_visited[idx]) {
    instantShow(paragraphs, container);
  } else {
    typeParagraphs(paragraphs, container, ()=>{
      // after typewriter finishes, mark visited
      clues_visited[idx] = true;
      saveState();
    });
  }
  setupNavButtons(idx);
}

/* show blurred preview when locked */
function showLockedPreview(text){
  const c = byId('content');
  c.innerHTML = '';
  const firstPara = (text || '').split(/\n{2,}/).map(s=>s.trim()).filter(Boolean)[0] || '(This page is empty)';
  const preview = document.createElement('div');
  preview.innerHTML = '<p>' + escapeHtml(firstPara).replace(/\n/g,'<br>') + '</p>';
  preview.style.filter = 'blur(3px)';
  preview.style.opacity = '0.95';
  c.appendChild(preview);
  c.style.pointerEvents = 'none';
}

/* ---------- password modal (shared) ---------- */
function openPasswordModal(pageIndex){
  const modal = byId('modal');
  const pwInput = byId('pwInput');
  const msg = byId('pwMessage');
  const hintTooltip = byId('hintTooltip');
  const shareRow = byId('shareRow');
  const tokenField = byId('tokenField');

  modal.style.display = 'flex';
  modal.setAttribute('aria-hidden','false');
  msg.innerText = '';
  pwInput.value = '';
  byId('modalTitle').innerText = `Unlock Page ${pageIndex+1}`;
  byId('modalNote').innerText = 'Enter the password to unlock this page.';
  hintTooltip.classList.remove('show');
  hintTooltip.setAttribute('aria-hidden','true');
  hintTooltip.textContent = PAGE_HINTS[pageIndex] || '';

  clues_attempts[pageIndex] = clues_attempts[pageIndex] || 0;
  shareRow.style.display = buildTokenFromUnlocked() ? 'flex' : 'none';
  tokenField.value = buildTokenFromUnlocked() ? showShareToken() : '';

  // submit handler
  function onSubmit(){
    const val = (pwInput.value || '').trim().toLowerCase();
    if (!val) { msg.innerText = 'Please enter a password.'; return; }

    // master bypass (Daniela)
    if (val === DANIELA.toLowerCase()) {
      for (let i=0;i<clues_pages.length;i++){ clues_unlocked[i]=true; clues_visited[i]=true; }
      saveState();
      // generate token but do not mention Daniela
      const url = showShareToken('ALL');
      // show simple feedback via modal token UI
      tokenField.value = url;
      shareRow.style.display = 'flex';
      modal.style.display = 'none';
      // navigate to last page
      renderPageIndex(clues_pages.length - 1);
      return;
    }

    // normal password check
    const correct = PAGE_PASSWORDS[pageIndex];
    if (correct && val === correct.toLowerCase()) {
      clues_unlocked[pageIndex] = true;
      clues_visited[pageIndex] = true; // skip typewriter on revisit
      saveState();
      // update share UI
      tokenField.value = showShareToken();
      shareRow.style.display = 'flex';
      modal.style.display = 'none';
      // show unlocked content
      renderPageIndex(pageIndex);
      return;
    }

    // incorrect
    clues_attempts[pageIndex] = (clues_attempts[pageIndex] || 0) + 1;
    saveState();
    msg.innerText = 'Incorrect password.';
    if ((clues_attempts[pageIndex] || 0) >= 3) {
      hintTooltip.setAttribute('aria-hidden','false');
      hintTooltip.classList.add('show');
    }
  }

  // wire temporary handlers (remove previous)
  submitClr(); // remove any earlier attaches
  byId('submitPw').onclick = onSubmit;
  byId('cancelPw').onclick = ()=>{ modal.style.display='none'; msg.innerText=''; };
  byId('copyBtn').onclick = async ()=>{
    const text = tokenField.value;
    if (!text) return;
    try { await navigator.clipboard.writeText(text); byId('copyBtn').innerText='Copied'; setTimeout(()=>byId('copyBtn').innerText='Copy',1200); } catch(e){ alert('Copy failed'); }
  };

  // allow enter key
  pwInput.onkeydown = (e)=>{ if (e.key==='Enter') onSubmit(); if (e.key==='Escape') modal.style.display='none'; };
}

/* helper to clear submit attach (avoid duplicates) */
function submitClr(){ try{ byId('submitPw').onclick = null; byId('cancelPw').onclick = null; }catch(e){} }

/* ---------- navigation button wiring ---------- */
function setupNavButtons(currentIdx){
  const prev = byId('prevBtn'), next = byId('nextBtn'), home = byId('homeLink');
  prev.disabled = currentIdx <= 0;
  next.disabled = currentIdx >= clues_pages.length - 1;
  prev.onclick = ()=> {
    if (currentIdx > 0) {
      const target = currentIdx - 1;
      window.location.href = 'page.html?p=' + target + (clues_token ? '&v=' + encodeURIComponent(clues_token) : '');
    }
  };
  next.onclick = ()=> {
    if (currentIdx < clues_pages.length - 1) {
      const target = currentIdx + 1;
      // if next is locked, open modal instead of direct
      const required = PAGE_PASSWORDS[target];
      if (required && !clues_unlocked[target]) {
        // show modal for that target (but stay on same page)
        openPasswordModal(target);
        return;
      }
      window.location.href = 'page.html?p=' + target + (clues_token ? '&v=' + encodeURIComponent(clues_token) : '');
    }
  };

  // share button (page view)
  const shareBtn = byId('shareBtn');
  if (shareBtn) {
    shareBtn.onclick = ()=> {
      const token = buildTokenFromUnlocked();
      if (!token) {
        alert('No unlocked pages to share yet. Unlock some pages (or use master bypass).');
        return;
      }
      const url = showShareToken();
      // copy to clipboard
      navigator.clipboard.writeText(url).then(()=>{ alert('Link copied to clipboard'); }).catch(()=>{ prompt('Copy the link:', url); });
    };
  }
}

/* ---------- token application from URL param v (page.html uses this) ---------- */
window.clues_applyTokenFromURL = function(v){
  if (!v) return false;
  const applied = applyTokenString(v);
  if (applied) clues_token = v;
  return applied;
};

/* ---------- navigation entrypoint for page.html ---------- */
window.clues_navigateTo = function(p){
  // p is integer page index
  clues_initPromise.then(()=> renderPageIndex(p|0)).catch(err=>{ console.error(err); setStatus('Error loading'); });
};

/* expose a bit of state for index.html */
window.clues_pages = clues_pages;
window.clues_token = (new URLSearchParams(window.location.search)).get('v') || '';

/* ---------- apply v= on initial load if present (index.html or page.html may call applyTokenFromURL directly) ---------- */
(function applyVfromURLonLoad(){
  const params = new URLSearchParams(window.location.search);
  const v = params.get('v');
  if (v) {
    clues_initPromise.then(()=>{ window.clues_applyTokenFromURL(v); }).catch(()=>{});
  }
})();
