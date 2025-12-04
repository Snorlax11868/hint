/* CONFIG */
const DOC_PUB_URL = 'https://docs.google.com/document/d/e/2PACX-1vRIzDF5V10ykJNamnHWrjM1YFlMrE9uZfMMDSuH1uo_Mb4Si0RFOUm6pmxB1padhPD9iICKQxEG0B-Z/pub';
const TRY_PLAIN_TEXT = true;
const DIVIDER = '==PAGE==';

// page-indexed passwords (lowercase)
const PAGE_PASSWORDS = {
  2: 'bloomrise',
  3: 'paulanka',
  4: 'amberlit',
  5: 'softfracture',
  6: 'violetluck'
};

// hints
const PAGE_HINTS = {
  2: "I open without sound when someone walks near; not a door, not a bloom — name the thing that wakes on the face like sunrise.",
  3: "A vintage voice that serenades young hearts; two names, one famous for a small-heart song — say him aloud.",
  4: "A gemstone warmed by daylight, then paired with the spark that sets it aglow — speak the fused glow.",
  5: "Part hush, part break — a gentle word for what’s broken but beloved; join the soft with the shard.",
  6: "Take the royal shade that stands its ground and pair it with a tiny omen that lands like a whisper — combine them into one quiet promise."
};

const DANIELA = 'daniela';
const TYPE_SPEED = 35;

/* Monthly unlock schedule helpers */
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
  if (pageIdx < 2) return new Date(0);
  const monthsAhead = pageIdx - 2;
  return firstOfMonthAfterMonthsFromNow(monthsAhead);
}
function daysUntil(date) {
  const ms = date - new Date();
  if (ms <= 0) return 0;
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

/* UI refs */
const contentEl = document.getElementById('content');
const statusEl = document.getElementById('status');
const backBtn = document.getElementById('backBtn');
const nextBtn = document.getElementById('nextBtn');
const copyTokenBtn = document.getElementById('copyTokenBtn');

const modal = document.getElementById('modal');
const modalTitle = document.getElementById('modalTitle');
const modalNote = document.getElementById('modalNote');
const pwInput = document.getElementById('pwInput');
const submitPw = document.getElementById('submitPw');
const cancelPw = document.getElementById('cancelPw');
const pwMessage = document.getElementById('pwMessage');
const modalHint = document.getElementById('modalHint');
const hintTooltip = document.getElementById('hintTooltip');
const shareRow = document.getElementById('shareRow');
const tokenField = document.getElementById('tokenField');
const copyBtn = document.getElementById('copyBtn');

/* State */
let pages = [];
let idx = 0;
let unlocked = {};        // pageIdx -> true
let visited = {};         // pageIdx -> true (skip typewriter)
let attempts = {};        // pageIdx -> int

/* Persistence keys */
const UNLOCK_KEY = 'unlocked_pages_v4';
const VISITED_KEY = 'visited_pages_v1';
const ATTEMPT_KEY = 'attempts_v2';

/* Load persisted state */
try { unlocked = JSON.parse(localStorage.getItem(UNLOCK_KEY)) || {}; } catch(e){ unlocked = {}; }
try { visited = JSON.parse(localStorage.getItem(VISITED_KEY)) || {}; } catch(e){ visited = {}; }
try { attempts = JSON.parse(localStorage.getItem(ATTEMPT_KEY)) || {}; } catch(e){ attempts = {}; }

function saveState(){ localStorage.setItem(UNLOCK_KEY, JSON.stringify(unlocked)); localStorage.setItem(VISITED_KEY, JSON.stringify(visited)); localStorage.setItem(ATTEMPT_KEY, JSON.stringify(attempts)); }

/* Fetch & clean doc text */
async function fetchDocText(){
  const attemptsArr = [];
  if (TRY_PLAIN_TEXT) attemptsArr.push(DOC_PUB_URL + '?output=txt');
  attemptsArr.push(DOC_PUB_URL);

  for (const url of attemptsArr) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const txt = await res.text();

      // If HTML → parse and remove style/script elements first, then extract textContent
      if (txt.trim().startsWith('<')) {
        try {
          const parser = new DOMParser();
          const doc = parser.parseFromString(txt, 'text/html');

          // remove style/script elements entirely
          const styles = doc.querySelectorAll('style, script');
          styles.forEach(el => el.remove());

          // remove comment nodes
          const iterator = doc.createNodeIterator(doc, NodeFilter.SHOW_COMMENT);
          let comment;
          while (comment = iterator.nextNode()) comment.remove();

          // extract visible text from body
          const body = doc.body;
          let text = body ? body.textContent || '' : txt;

          // CLEANUP: remove CSS-like declarations remaining in text (e.g., "color:#000000;font-size:12pt;")
          text = text.replace(/\{[^}]*\}/g, ' ');             // remove brace blocks
          text = text.replace(/[a-z-]+:\s*[^;]+;/gi, ' ');    // remove key: value; sequences
          text = text.replace(/&nbsp;/gi, ' ');
          text = text.replace(/Report abuse/gi, ' ');
          text = text.replace(/\s{2,}/g, ' ');
          text = text.replace(/\n{3,}/g, '\n\n');
          text = text.trim();

          return text;
        } catch(e) {
          // fallback: strip tags and CSS-like
          let cleaned = txt.replace(/<[^>]*>/g,' ').replace(/\{[^}]*\}/g,' ').replace(/[a-z-]+:\s*[^;]+;/gi,' ').replace(/&nbsp;/gi,' ').replace(/\s{2,}/g,' ').trim();
          return cleaned;
        }
      } else {
        // plain text returned
        // still remove any CSS-like remnants
        let cleaned = txt.replace(/\{[^}]*\}/g,' ').replace(/[a-z-]+:\s*[^;]+;/gi,' ').replace(/\s{2,}/g,' ').trim();
        return cleaned;
      }
    } catch(err) {
      console.warn('Fetch attempt failed:', url, err);
    }
  }
  throw new Error('Could not fetch published Google Doc. Make sure it is public.');
}

function splitPages(raw) {
  const normalized = raw.replace(/\r\n/g,'\n').trim();
  const parts = normalized.split(DIVIDER).map(p => p.trim()).filter(Boolean);
  return parts;
}

/* Rendering & typewriter (skip on revisit using visited[]) */
function escapeHtml(str){ return str.replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])); }

function renderPageParagraphs(text) {
  const paragraphs = text.split(/\n{2,}/).map(s => s.trim()).filter(Boolean);
  return paragraphs;
}

function clearContent(){ contentEl.innerHTML = ''; }

function instantShowParagraphs(paragraphs){
  clearContent();
  paragraphs.forEach(p => {
    const el = document.createElement('p');
    el.innerHTML = escapeHtml(p).replace(/\n/g,'<br>');
    contentEl.appendChild(el);
  });
}

function typeParagraphs(paragraphs, done) {
  clearContent();
  let pi = 0;
  function nextPara(){
    if (pi >= paragraphs.length) { if (done) done(); return; }
    const text = paragraphs[pi];
    const pEl = document.createElement('p');
    contentEl.appendChild(pEl);
    let i = 0;
    function step(){
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

/* Render current page with time & locks */
function renderCurrent(){
  statusEl.innerText = `Page ${idx+1} / ${pages.length}`;
  const pageText = pages[idx] || '';
  const paragraphs = renderPageParagraphs(pageText);
  const requiredPw = PAGE_PASSWORDS[idx];

  if (requiredPw && !unlocked[idx]) {
    const unlockDate = getUnlockDateForPage(idx);
    const days = daysUntil(unlockDate);
    statusEl.innerText = `Page ${idx+1} / ${pages.length} — This page will become accessible in ${days} day${days!==1?'s':''}.`;
    showLockedPreview(pageText);
    openPasswordModal(idx);
    return;
  }

  if (visited[idx]) {
    instantShowParagraphs(paragraphs);
  } else {
    typeParagraphs(paragraphs, ()=>{});
    visited[idx] = true;
    saveState();
  }

  backBtn.disabled = idx === 0;
  nextBtn.disabled = idx >= pages.length - 1;
}

/* Show blurred preview for locked page */
function showLockedPreview(text){
  clearContent();
  const firstPara = (text || '').split(/\n{2,}/).map(s=>s.trim()).filter(Boolean)[0] || '(This page is empty)';
  const preview = document.createElement('div');
  preview.innerHTML = '<p>' + escapeHtml(firstPara).replace(/\n/g,'<br>') + '</p>';
  preview.style.filter = 'blur(3px)';
  preview.style.opacity = '0.95';
  contentEl.appendChild(preview);
  contentEl.style.pointerEvents = 'none';
}

/* Modal & password flow (attempts + tooltip after 3) */
function openPasswordModal(pageIndex){
  modal.style.display = 'flex';
  modal.setAttribute('aria-hidden','false');
  pwMessage.innerText = '';
  pwInput.value = '';
  modalTitle.innerText = `Unlock Page ${pageIndex+1}`;
  modalNote.innerText = 'Enter the password to unlock this page.';
  modalHint.style.display = 'none';
  modalHint.innerText = '';
  hintTooltip.classList.remove('show');
  hintTooltip.setAttribute('aria-hidden','true');
  hintTooltip.textContent = '';

  const hintText = PAGE_HINTS[pageIndex] || 'No hint available.';
  hintTooltip.textContent = hintText;

  attempts[pageIndex] = attempts[pageIndex] || 0;

  // show share UI if unlocked anywhere
  updateShareUI();

  submitPw.onclick = () => {
    const raw = (pwInput.value || '').trim();
    const val = raw.toLowerCase();
    if (!val) {
      pwMessage.innerText = 'Please enter a password.';
      return;
    }

    // Daniela override: unlock all pages and mark visited (skip typewriter)
    if (val === DANIELA) {
      for (let i = 0; i < pages.length; i++) {
        unlocked[i] = true;
        visited[i] = true;
      }
      saveState();
      modal.style.display = 'none';
      // show token for ALL but without mentioning Daniela
      showShareToken('ALL');
      idx = pages.length - 1;
      renderCurrent();
      return;
    }

    const correct = PAGE_PASSWORDS[pageIndex];
    if (correct && val === correct.toLowerCase()) {
      unlocked[pageIndex] = true;
      visited[pageIndex] = true; // skip typewriter on revisit
      saveState();
      modal.style.display = 'none';
      updateShareUI();
      renderCurrent();
      return;
    }

    // incorrect
    attempts[pageIndex] = (attempts[pageIndex] || 0) + 1;
    saveState();
    pwMessage.innerText = 'Incorrect password.';

    if (attempts[pageIndex] >= 3) {
      hintTooltip.setAttribute('aria-hidden','false');
      hintTooltip.classList.add('show');
    }
  };

  cancelPw.onclick = () => {
    modal.style.display = 'none';
    pwMessage.innerText = '';
  };

  pwInput.onkeydown = (e) => {
    if (e.key === 'Enter') submitPw.click();
    if (e.key === 'Escape') cancelPw.click();
  };

  setTimeout(()=> pwInput.focus(), 80);

  if ((attempts[pageIndex] || 0) >= 3) {
    hintTooltip.setAttribute('aria-hidden','false');
    hintTooltip.classList.add('show');
  }
}

/* Navigation */
backBtn.addEventListener('click', ()=>{
  if (idx > 0) { idx--; renderCurrent(); }
});
nextBtn.addEventListener('click', ()=>{
  if (idx < pages.length - 1) {
    const next = idx + 1;
    const requiredPw = PAGE_PASSWORDS[next];
    if (requiredPw) {
      const unlockDate = getUnlockDateForPage(next);
      const days = daysUntil(unlockDate);
      statusEl.innerText = `Page ${next+1} will become accessible in ${days} day${days!==1?'s':''}.`;
      openPasswordModal(next);
      return;
    }
    idx++;
    renderCurrent();
  }
});
window.addEventListener('keydown', (e)=>{
  if (e.key === 'ArrowLeft') backBtn.click();
  if (e.key === 'ArrowRight') nextBtn.click();
});

/* Share token helpers (Option B: token lists specific page indices) */
function buildTokenFromUnlocked() {
  const keys = Object.keys(unlocked).filter(k => unlocked[k]).map(k=>parseInt(k)).sort((a,b)=>a-b);
  if (!keys.length) return '';
  return keys.join(',');
}
function showShareToken(valueOverride) {
  const v = valueOverride ? valueOverride : buildTokenFromUnlocked();
  if (!v) return;
  const url = new URL(window.location.href);
  url.searchParams.set('v', v);
  tokenField.value = url.toString();
  shareRow.style.display = 'flex';
  tokenField.select();
}
function updateShareUI(){
  const t = buildTokenFromUnlocked();
  if (t) {
    shareRow.style.display = 'flex';
    tokenField.value = (new URL(window.location.href)).origin + (new URL(window.location.href)).pathname + '?v=' + t;
  } else {
    shareRow.style.display = 'none';
  }
}
copyBtn.addEventListener('click', async ()=>{
  if (!tokenField.value) return;
  try {
    await navigator.clipboard.writeText(tokenField.value);
    copyBtn.textContent = 'Copied';
    setTimeout(()=> copyBtn.textContent = 'Copy', 1500);
  } catch(e) {
    alert('Copy failed — manually select and copy the link.');
  }
});

/* Copy token from main UI */
copyTokenBtn.addEventListener('click', ()=>{
  const t = buildTokenFromUnlocked();
  if (!t) {
    alert('No unlocked pages to share yet. Unlock some pages first (or use Daniela).');
    return;
  }
  showShareToken();
});

/* URL token parsing on load (v=2,3,5  OR v=ALL) */
function applyTokenFromURL() {
  const params = new URLSearchParams(window.location.search);
  const v = params.get('v');
  if (!v) return false;
  if (v.toUpperCase() === 'ALL') {
    for (let i = 0; i < pages.length; i++) { unlocked[i] = true; visited[i] = true; }
    saveState();
    return true;
  }
  const parts = v.split(',').map(s => s.trim()).filter(Boolean);
  let applied = false;
  for (const p of parts) {
    const n = parseInt(p, 10);
    if (!isNaN(n) && n >= 0 && n < pages.length) {
      unlocked[n] = true;
      visited[n] = true;
      applied = true;
    }
  }
  if (applied) saveState();
  return applied;
}

/* Fetch & init */
async function init(){
  statusEl.innerText = 'Fetching document…';
  try {
    const raw = await fetchDocText();
    pages = splitPages(raw);
    if (!pages.length) {
      contentEl.innerText = 'No pages found.';
      statusEl.innerText = 'No pages';
      return;
    }

    applyTokenFromURL();

    idx = 0;
    renderCurrent();
    statusEl.innerText = `Page ${idx+1} / ${pages.length}`;

    updateShareUI();
  } catch(err){
    contentEl.innerText = 'Could not load document: ' + err;
    statusEl.innerText = 'Error';
    console.error(err);
  }
}
init();
