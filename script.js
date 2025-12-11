// ---------------- CONFIG ----------------
const DOC_PUB_URL = 'https://docs.google.com/document/d/e/2PACX-1vRIzDF5V10ykJNamnHWrjM1YFlMrE9uZfMMDSuH1uo_Mb4Si0RFOUm6pmxB1padhPD9iICKQxEG0B-Z/pub';
const PAGE_DIVIDER = '==PAGE==';
const TYPE_SPEED = 35; // ms per char

// Page passwords (page index -> password). 0-based page indices.
// Pages 0 and 1 are public by your earlier plan. Locking starts at index 2.
const PAGE_PASSWORDS = {
  2: 'bloomrise',
  3: 'paulanka',
  4: 'amberlit',
  5: 'softfracture',
  6: 'violetluck'
};

// Manual hints for locked pages (same page indices)
const PAGE_HINTS = {
  2: "I open without sound when someone walks near; not a door, not a bloom — name the thing that wakes on the face like sunrise.",
  3: "A vintage voice that serenades young hearts; two names, one famous for a small-heart song — say him aloud.",
  4: "A gemstone warmed by daylight, then paired with the spark that sets it aglow — speak the fused glow.",
  5: "Part hush, part break — a gentle word for what’s broken but beloved; join the soft with the shard.",
  6: "Take the royal shade that stands its ground and pair it with a tiny omen that lands like a whisper — combine them into one quiet promise."
};

// Master bypass (case-insensitive). Hidden — no UI mention.
const MASTER_BYPASS = 'daniela';

// Local storage keys
const LS_UNLOCK = 'mp_unlock_v1';    // object { "2": true, ... }
const LS_VISITED = 'mp_visited_v1';  // object { "0": true, ... } skip typewriter
const LS_ATTEMPTS = 'mp_attempts_v1';// object { "2": 1, ... }

// State
let pages = [];           // array of raw page text
let unlocked = {};        // loaded from LS
let visited = {};         // loaded from LS
let attempts = {};        // loaded from LS
let initPromise = null;   // resolves when doc loaded
let activePage = 0;       // current index (used by page.html)

// Utility helpers
const $ = id => document.getElementById(id);
function saveState() {
  localStorage.setItem(LS_UNLOCK, JSON.stringify(unlocked));
  localStorage.setItem(LS_VISITED, JSON.stringify(visited));
  localStorage.setItem(LS_ATTEMPTS, JSON.stringify(attempts));
}
function loadState() {
  try { unlocked = JSON.parse(localStorage.getItem(LS_UNLOCK)) || {}; } catch(e){ unlocked = {}; }
  try { visited = JSON.parse(localStorage.getItem(LS_VISITED)) || {}; } catch(e){ visited = {}; }
  try { attempts = JSON.parse(localStorage.getItem(LS_ATTEMPTS)) || {}; } catch(e){ attempts = {}; }
}

// ---- fetch & clean Google Doc text ----
async function fetchDocText() {
  // Try text export first (best)
  try {
    const r = await fetch(DOC_PUB_URL);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    let txt = await r.text();

    // If the pub page returns HTML, extract body text. If it returns plain text already, keep.
    if (txt.trim().startsWith('<')) {
      // parse HTML, remove <style> and <script>, then use body textContent
      const parser = new DOMParser();
      const doc = parser.parseFromString(txt, 'text/html');
      doc.querySelectorAll('style,script').forEach(e => e.remove());
      // remove comments
      const iterator = doc.createNodeIterator(doc, NodeFilter.SHOW_COMMENT);
      let c;
      while (c = iterator.nextNode()) c.remove();
      let bodyText = doc.body ? doc.body.textContent || '' : txt;
      txt = bodyText;
    }

    // Remove common Google footer lines and collapse whitespace
    txt = txt.replace(/Published using Google Docs.*(\n|$)/gi, '');
    txt = txt.replace(/Learn more.*(\n|$)/gi, '');
    txt = txt.replace(/Updated automatically.*(\n|$)/gi, '');
    txt = txt.replace(/\r\n/g, '\n').replace(/\t/g, ' ');
    txt = txt.replace(/[ \u00A0]{2,}/g, ' ');
    txt = txt.replace(/\n{3,}/g, '\n\n');
    txt = txt.trim();
    return txt;
  } catch (err) {
    throw new Error('Fetch error: ' + err);
  }
}

// ---- split pages ----
function splitPages(raw) {
  if (!raw) return [];
  const parts = raw.split(PAGE_DIVIDER).map(s => s.trim());
  // keep empty parts? remove empties at ends
  return parts.map(p => p).filter(p => p !== null);
}

// ---- unlock schedule helpers: pages unlock on 1st-of-month series ----
function firstOfMonthAfterMonthsFromNow(monthsAhead = 0) {
  const now = new Date();
  const base = new Date(now.getFullYear(), now.getMonth(), 1);
  if (now.getDate() > 1 || now.getHours() > 0 || now.getMinutes() > 0 || now.getSeconds() > 0) {
    base.setMonth(base.getMonth() + 1);
  }
  base.setMonth(base.getMonth() + monthsAhead);
  base.setHours(0,0,0,0);
  return base;
}
function getUnlockDateForPage(pageIdx) {
  if (pageIdx < 2) return new Date(0); // public
  const monthsAhead = pageIdx - 2;
  return firstOfMonthAfterMonthsFromNow(monthsAhead);
}
function daysUntil(date) {
  const ms = date - new Date();
  if (ms <= 0) return 0;
  return Math.ceil(ms / (1000*60*60*24));
}

// ---- token helpers (Option B: comma list or ALL) ----
function buildTokenFromUnlocked() {
  const keys = Object.keys(unlocked).filter(k => unlocked[k]).map(k => parseInt(k)).sort((a,b)=>a-b);
  if (!keys.length) return '';
  return keys.join(',');
}
function tokenToURL(v) {
  const url = new URL(window.location.href);
  url.searchParams.set('v', v);
  return url.toString();
}
function applyTokenString(v) {
  if (!v) return false;
  if (v.toUpperCase() === 'ALL') {
    for (let i=0;i<pages.length;i++){ unlocked[i]=true; visited[i]=true; }
    saveState();
    return true;
  }
  // comma list like "2,3,5"
  if (/^[0-9,]+$/.test(v)) {
    const parts = v.split(',').map(s => parseInt(s,10)).filter(n => !isNaN(n) && n>=0 && n<pages.length);
    parts.forEach(n => { unlocked[n]=true; visited[n]=true; });
    saveState();
    return parts.length>0;
  }
  // otherwise try base64 JSON
  try {
    const decoded = atob(v);
    const arr = JSON.parse(decoded);
    if (Array.isArray(arr)) {
      arr.forEach(n => { if (typeof n === 'number' && n>=0 && n<pages.length) { unlocked[n]=true; visited[n]=true; }});
      saveState();
      return true;
    }
  } catch(e){}
  return false;
}

// ---- UI helpers ----
function setStatus(text) { const el = $('status'); if (el) el.innerText = text; }
function escapeHtml(str) { return String(str).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])); }

// ---- rendering & typewriter ----
function renderParagraphs(text) {
  return text.split(/\n{2,}/).map(s => s.trim()).filter(Boolean);
}
function instantShow(paragraphs, container) {
  container.innerHTML = '';
  paragraphs.forEach(p => {
    const pEl = document.createElement('p');
    pEl.innerHTML = escapeHtml(p).replace(/\n/g,'<br>');
    container.appendChild(pEl);
  });
}
function typeParagraphs(paragraphs, container, onDone) {
  container.innerHTML = '';
  let pi = 0;
  function nextPara() {
    if (pi >= paragraphs.length) { if (onDone) onDone(); return; }
    const text = paragraphs[pi];
    const pEl = document.createElement('p');
    container.appendChild(pEl);
    let i = 0;
    function step() {
      if (i < text.length) {
        pEl.innerHTML += escapeHtml(text.charAt(i)).replace(/\n/g,'<br>');
        i++;
        setTimeout(step, TYPE_SPEED);
      } else {
        pi++;
        setTimeout(nextPara, TYPE_SPEED * 6);
      }
    }
    step();
  }
  nextPara();
}

// ---- render a page index (used by page.html) ----
function renderPageIndex(idx) {
  const contentEl = $('content');
  if (!contentEl) return;
  setStatus(`Page ${idx+1} / ${pages.length}`);
  const raw = pages[idx] || '';
  const paragraphs = renderParagraphs(raw);
  const requiredPw = PAGE_PASSWORDS[idx];
  const isUnlocked = !!unlocked[idx];

  if (requiredPw && !isUnlocked) {
    const unlockDate = getUnlockDateForPage(idx);
    const days = daysUntil(unlockDate);
    setStatus(`Page ${idx+1} / ${pages.length} — This page will become accessible in ${days} day${days!==1?'s':''}.`);
    // preview first paragraph blurred
    contentEl.innerHTML = '';
    const first = (raw.split(/\n{2,}/).map(s => s.trim()).filter(Boolean)[0]) || '(This page is empty)';
    const preview = document.createElement('div');
    preview.innerHTML = '<p>' + escapeHtml(first).replace(/\n/g,'<br>') + '</p>';
    preview.style.filter = 'blur(3px)';
    preview.style.opacity = '0.95';
    contentEl.appendChild(preview);
    contentEl.style.pointerEvents = 'none';
    openPasswordModal(idx);
    setupNavButtons(idx);
    return;
  }

  contentEl.style.pointerEvents = '';
  if (visited[idx]) {
    instantShow(paragraphs, contentEl);
  } else {
    typeParagraphs(paragraphs, contentEl, () => {
      visited[idx] = true;
      saveState();
    });
  }
  setupNavButtons(idx);
}

// ---- password modal + attempts + hint tooltip + share token UI ----
function openPasswordModal(pageIndex) {
  const modal = $('modal');
  const pwInput = $('pwInput');
  const pwMessage = $('pwMessage');
  const hintTooltip = $('hintTooltip');
  const modalHint = $('modalHint');
  const shareRow = $('shareRow');
  const tokenField = $('tokenField');

  if (!modal) return;
  modal.style.display = 'flex';
  modal.setAttribute('aria-hidden','false');
  pwMessage.innerText = '';
  pwInput.value = '';
  $('modalTitle').innerText = `Unlock Page ${pageIndex+1}`;
  $('modalNote').innerText = 'Enter the password to unlock this page.';
  hintTooltip.classList.remove('show');
  hintTooltip.setAttribute('aria-hidden','true');
  hintTooltip.textContent = PAGE_HINTS[pageIndex] || '';
  modalHint.style.display = 'none';
  modalHint.textContent = PAGE_HINTS[pageIndex] || '';

  attempts[pageIndex] = attempts[pageIndex] || 0;
  shareRow.style.display = buildTokenFromUnlocked() ? 'flex' : 'none';
  tokenField.value = buildTokenFromUnlocked() ? tokenToURL(buildTokenFromUnlocked()) : '';

  function submitHandler() {
    const raw = (pwInput.value||'').trim();
    if (!raw) { pwMessage.innerText = 'Please enter a password.'; return; }
    const val = raw.toLowerCase();

    // Master bypass
    if (val === MASTER_BYPASS.toLowerCase()) {
      // unlock all pages & mark visited
      for (let i=0;i<pages.length;i++){ unlocked[i]=true; visited[i]=true; }
      saveState();
      modal.style.display = 'none';
      // generate share token ALL and populate token field (no mention of Daniela)
      tokenField.value = tokenToURL('ALL');
      shareRow.style.display = 'flex';
      // go to last page
      renderPageIndex(pages.length - 1);
      return;
    }

    // Normal password for this page
    const correct = PAGE_PASSWORDS[pageIndex];
    if (correct && val === correct.toLowerCase()) {
      unlocked[pageIndex] = true;
      visited[pageIndex] = true;
      saveState();
      modal.style.display = 'none';
      // update share UI
      tokenField.value = tokenToURL(buildTokenFromUnlocked());
      shareRow.style.display = 'flex';
      renderPageIndex(pageIndex);
      return;
    }

    // incorrect
    attempts[pageIndex] = (attempts[pageIndex]||0) + 1;
    saveState();
    pwMessage.innerText = 'Incorrect password.';
    if (attempts[pageIndex] >= 3) {
      hintTooltip.setAttribute('aria-hidden','false');
      hintTooltip.classList.add('show');
    }
  }

  // Remove old handlers before attaching new ones to avoid duplicates
  $('submitPw').onclick = submitHandler;
  $('cancelPw').onclick = () => { modal.style.display = 'none'; pwMessage.innerText = ''; };
  $('copyBtn').onclick = async () => {
    const text = tokenField.value;
    if (!text) return;
    try { await navigator.clipboard.writeText(text); $('copyBtn').innerText = 'Copied'; setTimeout(()=>$('copyBtn').innerText='Copy',1200); } catch(e){ alert('Copy failed.'); }
  };

  // hint toggle (larger text area inside modal)
  // show modalHint when user clicks tokenField area? we expose modalHint toggling via error-free click
  // but we also want a small visible tooltip after 3 attempts (handled above)
  $('pwInput').onkeydown = (e) => { if (e.key === 'Enter') submitHandler(); if (e.key === 'Escape') modal.style.display = 'none'; };

  // if attempts >=3 already, show tooltip immediately
  if ((attempts[pageIndex]||0) >= 3) {
    hintTooltip.setAttribute('aria-hidden','false');
    hintTooltip.classList.add('show');
  }
}

// ---- navigation setup for page.html ----
function setupNavButtons(currentIdx) {
  const prev = $('prevBtn');
  const next = $('nextBtn');
  const home = $('homeLink');

  if (prev) {
    prev.disabled = currentIdx <= 0;
    prev.onclick = () => {
      if (currentIdx > 0) {
        const target = currentIdx - 1;
        window.location.href = 'page.html?p=' + target + (getVParam()? '&v='+encodeURIComponent(getVParam()):'');
      }
    };
  }
  if (next) {
    next.disabled = currentIdx >= pages.length - 1;
    next.onclick = () => {
      if (currentIdx < pages.length - 1) {
        const target = currentIdx + 1;
        const required = PAGE_PASSWORDS[target];
        if (required && !unlocked[target]) {
          // open modal for that target instead of navigating
          openPasswordModal(target);
          return;
        }
        window.location.href = 'page.html?p=' + target + (getVParam()? '&v='+encodeURIComponent(getVParam()):'');
      }
    };
  }
  if (home) home.href = 'index.html' + (getVParam()? '?v='+encodeURIComponent(getVParam()):'');
}

// ---- index page list builder ----
function buildIndexList() {
  const container = $('pagesList');
  if (!container) return;
  container.innerHTML = '';
  pages.forEach((p, i) => {
    const row = document.createElement('div');
    row.className = 'page-row';
    const preview = p.split(/\n/).find(l=>l.trim().length) || '(empty)';
    const link = document.createElement('a');
    const vParam = getVParam();
    link.href = 'page.html?p=' + i + (vParam ? '&v=' + encodeURIComponent(vParam) : '');
    link.innerText = `Page ${i+1}: ` + (preview.length>80? preview.slice(0,80)+'…' : preview);
    row.appendChild(link);
    container.appendChild(row);
  });
  const status = $('status');
  if (status) status.innerText = `Loaded ${pages.length} page${pages.length!==1?'s':''}`;
}

// ---- share token UI helpers used by modal & share button ----
function buildTokenURLForUnlocked() {
  const token = buildTokenFromUnlocked();
  if (!token) return '';
  return tokenToURL(token);
}
function showShareLinkPrompt() {
  const token = buildTokenFromUnlocked();
  if (!token) {
    alert('No unlocked pages to share yet. Unlock some pages or use the master bypass.');
    return;
  }
  const url = tokenToURL(token);
  // copy to clipboard if possible
  navigator.clipboard.writeText(url).then(()=>alert('Link copied to clipboard'), ()=>prompt('Copy link:', url));
}

// ---- parse & apply v param helpers ----
function getVParam() {
  const p = new URLSearchParams(window.location.search).get('v');
  return p;
}
function applyVFromURL() {
  const v = getVParam();
  if (!v) return false;
  const applied = applyTokenString(v);
  if (applied) {
    // store token for navigation links
    return true;
  }
  return false;
}

// ---- initialization ----
async function initCore() {
  loadState();
  setStatus('Fetching document…');
  const raw = await fetchDocText();
  pages = splitPages(raw);

  // expose pages globally for index.html script
  window.clues_pages = pages;

  // try to apply v param if present
  applyVFromURL();

  // expose helpers for page.html to use
  window.clues_applyTokenFromURL = function(v){ return applyTokenString(v); };
  window.clues_navigateTo = function(p){ activePage = Math.max(0, Math.min(pages.length-1, parseInt(p)||0)); renderPageIndex(activePage); };

  // for index/build UI
  buildIndexList();

  setStatus(`Loaded ${pages.length} page${pages.length!==1?'s':''}`);
}

// Immediately start loading; pages are available via window.clues_pages once done
initPromise = initCore();
window.clues_initPromise = initPromise;

// ---- on-page helpers for index and page htmls ----
// index.html uses window.clues_initPromise then reads window.clues_pages and buildIndexList()
// page.html should call window.clues_initPromise.then(()=> { window.clues_applyTokenFromURL(vParam); window.clues_navigateTo(p); })

// expose a few helpers for external UI
window.mp_buildTokenURLForUnlocked = buildTokenURLForUnlocked;
window.mp_showShareLinkPrompt = showShareLinkPrompt;
window.mp_getUnlockDaysFor = getUnlockDateForPage;
