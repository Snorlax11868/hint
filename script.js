/*******************************
 * GLOBAL STATE + PAGE STORAGE
 *******************************/
window.clues_pages = [];
window.clues_passwords = [];
window.clues_token = null;

window.clues_initPromise = (async function loadPages() {
  try {
    const r = await fetch('pages.json');
    const data = await r.json();
    window.clues_pages = data.pages || [];
  } catch (e) {
    console.error('Error loading pages.json:', e);
    window.clues_pages = [];
  }

  // PASSWORDS (must match pages exactly)
  window.clues_passwords = [
    null,          // Page 0 — intro (no password)
    "smile",       // Page 1
    "baker",       // Page 2
    "amberglow",   // Page 3
    "softshard",   // Page 4
    "purpleluck",  // Page 5
    null           // Page 6 — final message (no password)
  ];
})();

/***************************************
 * TOKEN HANDLING (Daniela shortcut)
 ***************************************/
window.clues_applyTokenFromURL = function (tk) {
  if (!tk) return;
  try {
    const decoded = atob(tk);
    window.clues_token = decoded;
    if (decoded === "daniela") {
      localStorage.setItem("clues_access", "daniela");
    }
  } catch (e) {}
};

window.clues_generateShareLink = function () {
  const tk = btoa("daniela");
  return window.location.origin + window.location.pathname.replace("page.html", "index.html") + "?v=" + encodeURIComponent(tk);
};

/***************************************
 * PASSWORD CHECK
 ***************************************/
window.clues_canAccess = function (pageNum) {
  const stored = localStorage.getItem("clues_access");
  if (stored === "daniela") return true;
  if (pageNum === 0 || pageNum === window.clues_pages.length - 1) return true; 
  return false;
};

window.clues_requestPassword = function (pageNum, callback) {
  const pass = window.clues_passwords[pageNum];
  if (!pass) {
    callback(true);
    return;
  }

  const userInput = prompt("Enter the password to continue:");
  if (userInput && userInput.toLowerCase().trim() === pass.toLowerCase()) {
    callback(true);
  } else {
    alert("Incorrect password.");
    callback(false);
  }
};

/***************************************
 * TYPEWRITER EFFECT WITH SKIP
 ***************************************/
let clues_isSkipping = false;

async function typewriter(element, text, speed = 12) {
  element.innerHTML = "";
  clues_isSkipping = false;

  return new Promise(resolve => {
    let i = 0;

    function write() {
      if (clues_isSkipping) {
        element.innerText = text;
        resolve();
        return;
      }

      if (i < text.length) {
        element.innerHTML += text.charAt(i);
        i++;
        setTimeout(write, speed);
      } else {
        resolve();
      }
    }
    write();
  });
}

window.addEventListener("click", () => {
  clues_isSkipping = true;
});
window.addEventListener("keydown", () => {
  clues_isSkipping = true;
});

/***************************************
 * PAGE NAVIGATION
 ***************************************/
window.clues_navigateTo = async function (pageNum) {
  const pages = window.clues_pages;
  const passwords = window.clues_passwords;

  if (pageNum < 0 || pageNum >= pages.length) return;

  const status = document.getElementById("status");
  const contentDiv = document.getElementById("content");
  const siteTitle = document.getElementById("siteTitle");

  // Lock if needed
  if (!window.clues_canAccess(pageNum)) {
    if (passwords[pageNum]) {
      window.clues_requestPassword(pageNum, allowed => {
        if (allowed) {
          localStorage.setItem("clues_access", "daniela");
          window.clues_token = "daniela";
          window.clues_navigateTo(pageNum);
        }
      });
      return;
    }
  }

  // Load page content
  status.innerText = "Loaded";
  const page = pages[pageNum];

  document.title = "Page " + (pageNum + 1);
  siteTitle.innerText = page.title || "Page " + (pageNum + 1);

  await typewriter(contentDiv, page.content);

  // Update navigation links
  const prevBtn = document.getElementById("prevBtn");
  const nextBtn = document.getElementById("nextBtn");

  if (prevBtn) {
    if (pageNum > 0) {
      prevBtn.onclick = () => {
        location.href = `page.html?p=${pageNum - 1}${window.clues_token ? "&v=" + encodeURIComponent(btoa(window.clues_token)) : ""}`;
      };
    } else {
      prevBtn.disabled = true;
    }
  }

  if (nextBtn) {
    if (pageNum < pages.length - 1) {
      nextBtn.onclick = () => {
        location.href = `page.html?p=${pageNum + 1}${window.clues_token ? "&v=" + encodeURIComponent(btoa(window.clues_token)) : ""}`;
      };
    } else {
      nextBtn.disabled = true;
    }
  }

  // Share Link
  const shareBtn = document.getElementById("shareBtn");
  if (shareBtn) {
    shareBtn.onclick = () => {
      const link = window.clues_generateShareLink();
      navigator.clipboard.writeText(link).then(() => {
        alert("Share link copied to clipboard!");
      });
    };
  }
};
