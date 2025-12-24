const MASTER_PASS = 'daniela';
const PASSWORD_FLOW = { 
  2:'bloomrise', 
  3:'paulanka', 
  4:'amberlite', 
  5:'softfracture', 
  6:'violetluck' 
};

const HINTS = {
  2: "I open without sound when someone walks near; not a door, not a bloom — name the thing that wakes on the face like sunrise.",
  3: "A vintage voice that serenades young hearts; two names, one famous for a small-heart song — say him aloud.",
  4: "A gemstone warmed by daylight, then paired with the spark that sets it aglow — speak the fused glow.",
  5: "Part hush, part break — a gentle word for what’s broken but beloved; join the soft with the shard.",
  6: "Every time I see that smile, I feel at ease. It’s one of those things that makes me trust you without even trying."
};

// localStorage keys
const LS_UNLOCK = 'story_unlocked_v2';
const LS_UNLOCK_TS = 'story_unlocked_ts_v2';
const LS_VISITED = 'story_visited_v2';
const LS_ATTEMPTS = 'story_attempts_v2';
const LS_FINAL_STAGE = 'story_final_stage_v2';
const LS_FINAL_LOCK = 'story_final_lock_v2';

let pages = [];
let unlocked = {};
let unlockTimestamps = {};
let visited = {};
let attempts = {};
let finalStage = false;
let currentIdx = 0;

function loadState(){
  unlocked = JSON.parse(localStorage.getItem(LS_UNLOCK)) || {};
  unlockTimestamps = JSON.parse(localStorage.getItem(LS_UNLOCK_TS)) || {};
  visited = JSON.parse(localStorage.getItem(LS_VISITED)) || {};
  attempts = JSON.parse(localStorage.getItem(LS_ATTEMPTS)) || {};
  finalStage = JSON.parse(localStorage.getItem(LS_FINAL_STAGE)) || false;
}
function saveState(){
  localStorage.setItem(LS_UNLOCK, JSON.stringify(unlocked));
  localStorage.setItem(LS_UNLOCK_TS, JSON.stringify(unlockTimestamps));
  localStorage.setItem(LS_VISITED, JSON.stringify(visited));
  localStorage.setItem(LS_ATTEMPTS, JSON.stringify(attempts));
  localStorage.setItem(LS_FINAL_STAGE, JSON.stringify(finalStage));
}

// init
window.clues_initPromise = (async function(){
  loadState();
  const r = await fetch('pages.json');
  const j = await r.json();
  pages = j.pages || [];
})();

// helpers
const $ = id => document.getElementById(id);
function escapeHtml(s){
  return String(s).replace(/[&<>"']/g,ch=>(
    {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]
  ));
}

// PASSWORD MODAL
function openPasswordModalFor(idx){
  const modal = $('modal');
  const pw = $('pwInput');
  const msg = $('pwMessage');
  const hint = $('modalHint');

  modal.style.display = 'flex';
  pw.value = '';
  msg.innerText = '';
  hint.style.display = 'none';

  $('modalTitle').innerText = `Unlock Page ${idx+1}`;
  $('modalNote').innerText = 'Enter the password.';

  function submit(){
    const val = pw.value.trim().toLowerCase();

    // 🚫 Disable master pass on page 7
    if (idx !== 6 && val === MASTER_PASS){
      for (let i=0;i<pages.length;i++) unlocked[i]=true;
      saveState();
      modal.style.display='none';
      renderPageIndex(idx);
      return;
    }

    // PAGE 7 — STEP 1 (violetluck)
    if (idx === 6 && !finalStage){
      if (val === 'violetluck'){
        finalStage = true;
        saveState();
        pw.value = '';
        msg.innerText = 'Final guess: who is it?';
        $('modalNote').innerText = 'Enter your final answer.';
        return;
      }
      msg.innerText = 'Incorrect password.';
      return;
    }

    // PAGE 7 — STEP 2 (daniela)
    if (idx === 6 && finalStage){
      const lockUntil = localStorage.getItem(LS_FINAL_LOCK);
      if (lockUntil && Date.now() < Number(lockUntil)){
        msg.innerText = 'Try again later.';
        return;
      }

      attempts[6] = (attempts[6]||0)+1;
      saveState();

      if (val === 'daniela'){
        unlocked[6] = true;
        saveState();
        modal.style.display='none';
        renderPageIndex(6);
        return;
      }

      msg.innerText = 'Incorrect.';
      if (attempts[6] >= 3){
        hint.style.display='block';
        hint.innerText = HINTS[6];
      }
      localStorage.setItem(LS_FINAL_LOCK, Date.now() + 2*60*60*1000);
      return;
    }

    // NORMAL FLOW
    if (val === PASSWORD_FLOW[idx]){
      unlocked[idx]=true;
      saveState();
      modal.style.display='none';
      renderPageIndex(idx);
      return;
    }

    msg.innerText = 'Incorrect password.';
  }

  $('submitPw').onclick = submit;
  $('cancelPw').onclick = ()=> modal.style.display='none';
  pw.onkeydown = e => e.key==='Enter' && submit();
}

// PAGE RENDER
function renderPageIndex(idx){
  currentIdx = idx;
  const content = $('content');
  const status = $('status');

  status.innerText = `Page ${idx+1} / ${pages.length}`;

  if (PASSWORD_FLOW[idx] && !unlocked[idx]){
    openPasswordModalFor(idx);
    content.innerHTML = `<div style="filter:blur(3px)">${escapeHtml(pages[idx].content)}</div>`;
    return;
  }

  content.innerHTML = escapeHtml(pages[idx].content).replace(/\n/g,'<br>');
}

// boot
(async function(){
  await window.clues_initPromise;
  const p = parseInt(new URLSearchParams(location.search).get('p')||'0',10);
  renderPageIndex(p);
})();
