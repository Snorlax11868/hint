/* Final script.js — Sequential + Monthly backup (Option 3A)
   SPECIAL PAGE 7 LOGIC:
   - Page 7 (index 6) requires TWO steps:
       1) violetluck
       2) daniela
   - Master password does NOT work on page 7
   - One wrong attempt = 2 hour lockout
   - 3 wrong attempts = hint appears
*/

const MASTER_PASS = 'daniela';

const PASSWORD_FLOW = {
  2:'bloomrise',
  3:'paulanka',
  4:'amberlite',
  5:'softfracture',
  6:'violetluck' // STEP 1 ONLY
};

const FINAL_PAGE_INDEX = 6;
const FINAL_ANSWER = 'daniela';

const FINAL_HINT =
  "Every time I see that smile, I feel at ease. It’s one of those things that makes me trust you without even trying.";

const LS_UNLOCK = 'story_unlocked_v2';
const LS_UNLOCK_TS = 'story_unlocked_ts_v2';
const LS_VISITED = 'story_visited_v2';
const LS_ATTEMPTS = 'story_attempts_v2';
const LS_PAGE7_LOCK = 'page7_lock_until';

let pages = [];
let unlocked = {};
let unlockTimestamps = {};
let visited = {};
let attempts = {};
let currentIdx = 0;

/* ---------------- STATE ---------------- */

function loadState(){
  unlocked = JSON.parse(localStorage.getItem(LS_UNLOCK) || '{}');
  unlockTimestamps = JSON.parse(localStorage.getItem(LS_UNLOCK_TS) || '{}');
  visited = JSON.parse(localStorage.getItem(LS_VISITED) || '{}');
  attempts = JSON.parse(localStorage.getItem(LS_ATTEMPTS) || '{}');
}
function saveState(){
  localStorage.setItem(LS_UNLOCK, JSON.stringify(unlocked));
  localStorage.setItem(LS_UNLOCK_TS, JSON.stringify(unlockTimestamps));
  localStorage.setItem(LS_VISITED, JSON.stringify(visited));
  localStorage.setItem(LS_ATTEMPTS, JSON.stringify(attempts));
}

/* ---------------- TIME BACKUP ---------------- */

function firstOfCurrentMonth(){
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function firstOfNextMonthFrom(ts){
  const d = new Date(ts);
  return new Date(d.getFullYear(), d.getMonth()+1, 1);
}

function applyMonthlyBackups(){
  if (!unlocked[2] && new Date() >= firstOfCurrentMonth()){
    unlocked[2] = true;
    unlockTimestamps[2] = new Date().toISOString();
  }
  for (let i=3;i<pages.length;i++){
    if (unlocked[i]) continue;
    const prevTs = unlockTimestamps[i-1];
    if (prevTs && new Date() >= firstOfNextMonthFrom(prevTs)){
      unlocked[i] = true;
      unlockTimestamps[i] = new Date().toISOString();
    }
  }
  saveState();
}

/* ---------------- INIT ---------------- */

window.clues_initPromise = (async ()=>{
  loadState();
  const r = await fetch('pages.json');
  const j = await r.json();
  pages = j.pages || [];
  applyMonthlyBackups();
})();

/* ---------------- HELPERS ---------------- */

const $ = id => document.getElementById(id);
function escapeHtml(s){
  return String(s).replace(/[&<>"']/g,c=>({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}

/* ---------------- TYPEWRITER ---------------- */

let skip=false;
async function typewriter(el,text){
  if (visited[currentIdx]){
    el.innerHTML = escapeHtml(text).replace(/\n/g,'<br>');
    return;
  }
  el.innerHTML='';
  let i=0;
  skip=false;
  return new Promise(res=>{
    function step(){
      if (skip || i>=text.length){
        el.innerHTML = escapeHtml(text).replace(/\n/g,'<br>');
        visited[currentIdx]=true;
        saveState();
        res();
        return;
      }
      el.innerHTML+=escapeHtml(text[i++]).replace(/\n/g,'<br>');
      setTimeout(step,22);
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
    }

    // NORMAL PAGE
    if (val===PASSWORD_FLOW[idx]){
      unlocked[idx]=true;
      visited[idx]=true;
      unlockTimestamps[idx]=new Date().toISOString();
      saveState();
      modal.style.display='none';
      renderPageIndex(idx);
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
    }
  }

  $('cancelPw').onclick=()=>modal.style.display='none';
}

/* ---------------- PAGE RENDER ---------------- */

function renderPageIndex(idx){
  currentIdx=idx;
  applyMonthlyBackups();

  const page=pages[idx];
  $('status').innerText=`Page ${idx+1} / ${pages.length}`;

  if (PASSWORD_FLOW[idx] && !unlocked[idx]){
    $('content').innerHTML='<p class="small">(Locked)</p>';
    openPasswordModalFor(idx);
    return;
  }

  if (visited[idx]){
    $('content').innerHTML=escapeHtml(page.content).replace(/\n/g,'<br>');
  } else {
    typewriter($('content'),page.content);
  }

  $('prevBtn').disabled=idx===0;
  $('nextBtn').disabled=idx===pages.length-1;

  $('prevBtn').onclick=()=>location.href=`page.html?p=${idx-1}`;
  $('nextBtn').onclick=()=>location.href=`page.html?p=${idx+1}`;
}

/* ---------------- BOOT ---------------- */

(async ()=>{
  await window.clues_initPromise;
  const p=parseInt(new URLSearchParams(location.search).get('p')||0,10);
  renderPageIndex(p);
})();
