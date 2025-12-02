/* -----------------------
   CONFIG
   -----------------------
   - Put your published Google Doc URL here (your /pub link).
   - The script tries DOC_PUB_URL + '?output=txt' first, then falls back.
*/
const DOC_PUB_URL = 'https://docs.google.com/document/d/e/2PACX-1vRIzDF5V10ykJNamnHWrjM1YFlMrE9uZfMMDSuH1uo_Mb4Si0RFOUm6pmxB1padhPD9iICKQxEG0B-Z/pub';
const TRY_PLAIN_TEXT = true;
const DIVIDER = '==PAGE==';

// Passwords (lowercased for comparison)
const PAGE_PASSWORDS = {
  2: 'bloomrise',
  3: 'paulanka',
  4: 'amberlit',
  5: 'softfracture',
  6: 'violetluck'
};

// Poetic hints (as you provided)
const PAGE_HINTS = {
  2: "I open without sound when someone walks near; not a door, not a bloom — name the thing that wakes on the face like sunrise.",
  3: "A vintage voice that serenades young hearts; two names, one famous for a small-heart song — say him aloud.",
  4: "A gemstone warmed by daylight, then paired with the spark that sets it aglow — speak the fused glow.",
  5: "Part hush, part break — a gentle word for what’s broken but beloved; join the soft with the shard.",
  6: "Take the royal shade that stands its ground and pair it with a tiny omen that lands like a whisper — combine them into one quiet promise."
};

const DANIELA = 'daniela';
const TYPE_SPEED = 35;

/* Unlock schedule */
const FIRST_UNLOCK_DATE = new Date(); // change to desired base date/time if needed
const TWO_WEEKS = 14 * 24 * 60 * 60 * 1000;

/* Helpers for schedule */
function getUnlockDateForPage(pageIdx) {
  const offset = (pageIdx - 2) * TWO_WEEKS;
  return new Date(FIRST_UNLOCK_DATE.getTime() + Math.max(0, offset));
}
function isPageUnlockedByTime(pageIdx) {
  return new Date() >= getUnlockDateForPage(pageIdx);
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
const hintBtn = document.getElementById('hintBtn');

const modal = document.getElementById('modal');
const modalTitle = document.getElementById('modalTitle');
const modalNote = document.getElementById('modalNote');
const pwInput = document.getElementById('pwInput');
const submitPw = document.getElementById('submitPw');
const cancelPw = document.getElementById('cancelPw');
const pwMessage = document.getElementById('pwMessage');
const modalHint = document.getElementById('modalHint');
const hintTooltip = document.getElementById('hintTooltip');

let pages = [];
let idx = 0;
let unlocked = {};        // pageIdx -> true
let attempts = {};        // pageIdx -> integer

/* persistence */
try {
  const raw = localStorage.getItem('unlocked_pages_v3');
  if (raw) unlocked = JSON.parse(raw) || {};
} catch(e){ unlocked = {}; }
function saveUnlocked(){ localStorage.setItem('unlocked_pages_v3', JSON.stringify(unlocked)); }

/* fetch published doc */
async function fetchDocText(){
  const attemptsArr = [];
  if (TRY_PLAIN_TEXT) attemptsArr.push(DOC_PUB_URL + '?output=txt');
  attemptsArr.push(DOC_PUB_URL);

  for (const url of attemptsArr){
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const txt = await res.text();
      return txt;
    } catch(err){
      console.warn('Fetch failed:', url, err);
    }
  }
  throw new Error('Could not fetch published Google Doc. Ensure it is published to web and public.');
}

function splitPages(raw) {
  const normalized = raw.replace(/\r\n/g, '\n').trim();
  const parts = normalized.split(DIVIDER).map(p => p.trim());
  return parts;
}

/* rendering & typewriter */
function escapeHtml(str){ return str.replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])); }

function renderPageHtml(text) {
  const paragraphs = text.split(/\n{2,}/).map(s => s.trim()).filter(Boolean);
  return { paragraphs };
}

function clearContent(){ contentEl.innerHTML = ''; }

function typeParagraphs(paragraphs, done){
  clearContent();
  let p = 0;
  function nextPara(){
    if (p >= paragraphs.length) { if (done) done(); return; }
    const paragraphText = paragraphs[p];
    const pEl = document.createElement('p');
    contentEl.appendChild(pEl);
    let i = 0;
    function step(){
      if (i < paragraphText.length){
        pEl.innerHTML += escapeHtml(paragraphText.charAt(i)).replace(/\n/g,'<br>');
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

/* render current page (with time and password checks) */
function renderCurrent(){
  statusEl.innerText = `Page ${idx+1} / ${pages.length}`;

  const pageText = pages[idx] || '';
  const { paragraphs } = renderPageHtml(pageText);

  const requiredPw = PAGE_PASSWORDS[idx];
  const lockedByPw = requiredPw && !unlocked[idx];
  const lockedByTime = requiredPw && !isPageUnlockedByTime(idx);

  if (requiredPw && !unlocked[idx]) {
    // show preview and formal schedule message
    const unlockDate = getUnlockDateForPage(idx);
    const days = daysUntil(unlockDate);
    statusEl.innerText = `Page ${idx+1} / ${pages.length} — This page will become accessible in ${days} day${days!==1?'s':''}.`;
    showLockedPreview(pageText);
    openPasswordModal(idx);
  } else {
    contentEl.style.pointerEvents = '';
    typeParagraphs(paragraphs, ()=>{});
  }

  backBtn.disabled = idx === 0;
  nextBtn.disabled = idx >= pages.length - 1;
}

/* Modal & password flow with attempts + auto-tooltip after 3 wrong tries */
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

  // attach hint text to tooltip (but keep hidden until attempts >=3)
  const hintText = PAGE_HINTS[pageIndex] || 'No hint available.';
  hintTooltip.textContent = hintText;

  // ensure attempts tracker exists
  attempts[pageIndex] = attempts[pageIndex] || 0;

  submitPw.onclick = () => {
    const raw = (pwInput.value || '').trim();
    const val = raw.toLowerCase();

    if (!val) {
      pwMessage.innerText = 'Please enter a password.';
      return;
    }

    // Daniela override -> jump to final page immediately
    if (val === DANIELA) {
      const lastIndex = pages.length - 1;
      unlocked[lastIndex] = true;
      saveUnlocked();
      modal.style.display = 'none';
      idx = lastIndex;
      renderCurrent();
      return;
    }

    const correct = PAGE_PASSWORDS[pageIndex];
    if (correct && val === correct.toLowerCase()) {
      unlocked[pageIndex] = true;
      saveUnlocked();
      modal.style.display = 'none';
      renderCurrent();
      return;
    }

    // incorrect
    attempts[pageIndex] = (attempts[pageIndex] || 0) + 1;
    pwMessage.innerText = 'Incorrect password.';
    // if attempts >= 3, automatically reveal tooltip (soft glow)
    if (attempts[pageIndex] >= 3) {
      // show tooltip smoothly
      hintTooltip.setAttribute('aria-hidden','false');
      hintTooltip.classList.add('show');
    }
  };

  cancelPw.onclick = () => {
    modal.style.display = 'none';
    pwMessage.innerText = '';
  };

  // Hint button toggles modal hint (in addition to tooltip)
  hintBtn.onclick = () => {
    const vis = modalHint.style.display === 'block';
    if (vis) {
      modalHint.style.display = 'none';
    } else {
      modalHint.innerText = PAGE_HINTS[pageIndex] || 'No hint available.';
      modalHint.style.display = 'block';
    }
  };

  // keyboard handlers
  pwInput.onkeydown = (e) => {
    if (e.key === 'Enter') submitPw.click();
    if (e.key === 'Escape') cancelPw.click();
  };

  setTimeout(()=> pwInput.focus(), 80);

  // If already >=3 attempts (from storage or earlier), show tooltip immediately
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
    if (requiredPw && !isPageUnlockedByTime(next)) {
      const unlockDate = getUnlockDateForPage(next);
      const days = daysUntil(unlockDate);
      statusEl.innerText = `Page ${next+1} will become accessible in ${days} day${days!==1?'s':''}.`;
      openPasswordModal(next); // allow attempt though time may still be in future
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

/* init */
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
    idx = 0;
    renderCurrent();
    statusEl.innerText = `Page ${idx+1} / ${pages.length}`;
  } catch(err){
    contentEl.innerText = 'Could not load document: ' + err;
    statusEl.innerText = 'Error';
    console.error(err);
  }
}
init();
