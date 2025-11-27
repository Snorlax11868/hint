/*****************************************
 * Configuration
 *****************************************/

// exact passwords for pages (lowercased for case-insensitive compare)
const PAGE_PASSWORDS = [
  'bloomrise',     // first protected step (page 3 in original plan)
  'paulanka',      // next
  'amberlit',
  'softfracture',
  'violetluck'
];

// Daniela override (case-insensitive)
const OVERRIDE = 'daniela';

// Where to redirect when Daniela is entered (set this to your real final page)
const FINAL_PAGE_URL = 'final.html'; // <-- change to your final page path if different

// Where to redirect after a normal correct password (optional). If you have a flow
// of pages, set NEXT_PAGE_URL to the next page or leave empty to just reveal content.
const NEXT_PAGE_URL = ''; // set to '' if you don't want auto-redirect

// Two-week countdown system — single next-unlock date
// (If you want per-page unlocks in a schedule, I can switch this to a base-date + offsets)
const TWO_WEEKS_DAYS = 14;
const LOCALSTORAGE_UNLOCK_KEY = 'unlocked_passwords_v1';
const LOCALSTORAGE_NEXTUNLOCK = 'nextUnlockDate_v1';

// Typewriter speed (ms per character)
const TYPE_SPEED = 35;

/*****************************************
 * UI references
 *****************************************/
const countdownEl = document.getElementById('countdown');
const pwInput = document.getElementById('password-input');
const submitBtn = document.getElementById('submit-btn');
const contentEl = document.getElementById('content');
const typedEl = document.getElementById('typed-text');

/*****************************************
 * Utility: load/save unlocked state
 *****************************************/
function loadUnlocked() {
  try {
    const raw = localStorage.getItem(LOCALSTORAGE_UNLOCK_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}
function saveUnlocked(arr) {
  try { localStorage.setItem(LOCALSTORAGE_UNLOCK_KEY, JSON.stringify(arr)); } catch(e){}
}
let unlockedPasswords = loadUnlocked();

/*****************************************
 * Countdown (formal message): "This page will become accessible in ___ days."
 *****************************************/
function getOrCreateNextUnlockDate() {
  try {
    const raw = localStorage.getItem(LOCALSTORAGE_NEXTUNLOCK);
    const now = new Date();
    if (raw) {
      const d = new Date(raw);
      if (d > now) return d;
    }
    // create new (now + 14 days)
    const next = new Date(now.getTime());
    next.setDate(next.getDate() + TWO_WEEKS_DAYS);
    localStorage.setItem(LOCALSTORAGE_NEXTUNLOCK, next.toISOString());
    return next;
  } catch (e) {
    // fallback: now + 14 days
    const fallback = new Date();
    fallback.setDate(fallback.getDate() + TWO_WEEKS_DAYS);
    return fallback;
  }
}

function updateCountdownDisplay() {
  const next = getOrCreateNextUnlockDate();
  const now = new Date();
  const diff = next - now;
  if (diff <= 0) {
    countdownEl.textContent = 'This page will become accessible in 0 days.';
    return;
  }
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
  countdownEl.textContent = `This page will become accessible in ${days} day${days !== 1 ? 's' : ''}.`;
}

// refresh every minute so the days display updates
setInterval(updateCountdownDisplay, 60 * 1000);
updateCountdownDisplay();

/*****************************************
 * Typewriter effect — safe for text
 *****************************************/
function typeWriter(text, el, speed = TYPE_SPEED, onDone = null) {
  el.textContent = '';
  let i = 0;
  function step() {
    if (i >= text.length) {
      if (onDone) onDone();
      return;
    }
    el.textContent += text.charAt(i);
    i++;
    setTimeout(step, speed);
  }
  step();
}

/*****************************************
 * Password handling
 *****************************************/
function normalize(s){ return (s || '').trim().toLowerCase(); }

function alreadyUnlocked(password) {
  const norm = normalize(password);
  return unlockedPasswords.includes(norm);
}

function markUnlocked(password) {
  const norm = normalize(password);
  if (!unlockedPasswords.includes(norm)) {
    unlockedPasswords.push(norm);
    saveUnlocked(unlockedPasswords);
  }
}

function handleSuccess(password) {
  // reveal the content area with typewriter message
  contentEl.classList.remove('hidden');
  const msg = (normalize(password) === OVERRIDE) ?
    'Access override accepted. Redirecting to the final page...' :
    'Access granted. Proceeding to the next encrypted page...';

  typeWriter(msg, typedEl, TYPE_SPEED, () => {
    // optional redirect behavior
    if (normalize(password) === OVERRIDE) {
      // small delay to let the message show
      setTimeout(() => { window.location.href = FINAL_PAGE_URL; }, 800);
    } else if (NEXT_PAGE_URL) {
      setTimeout(() => { window.location.href = NEXT_PAGE_URL; }, 800);
    }
  });
}

/*****************************************
 * Submit logic (Enter key and button)
 *****************************************/
function submitPasswordFlow() {
  const val = normalize(pwInput.value);

  if (!val) {
    alert('Please enter a password.');
    return;
  }

  // Daniela override
  if (val === normalize(OVERRIDE)) {
    markUnlocked(val);
    handleSuccess(val);
    return;
  }

  // If this password was already unlocked earlier, bypass check
  if (alreadyUnlocked(val)) {
    handleSuccess(val);
    return;
  }

  // Check among allowed passwords
  if (PAGE_PASSWORDS.includes(val)) {
    markUnlocked(val);
    handleSuccess(val);
    return;
  }

  // Not recognized
  alert('Incorrect password. Please try again.');
}

// handle Enter key in input
pwInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') submitPasswordFlow();
});
submitBtn.addEventListener('click', submitPasswordFlow);

/*****************************************
 * Initialize UI (hide content if not unlocked)
 *****************************************/
(function initUI(){
  // If any password already stored as unlocked, optionally show content (adjust as you prefer)
  // right now we leave it hidden until the user submits or override triggers.
  if (unlockedPasswords.length > 0) {
    // optional: show note (not auto-revealing)
    // contentEl.classList.remove('hidden');
    // typedEl.textContent = 'You have previously unlocked content. Use navigation to continue.';
  }

  // focus input for convenience
  pwInput.focus();
})();
