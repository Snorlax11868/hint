const DOC_URL =
  "https://docs.google.com/document/d/e/2PACX-1vRIzDF5V10ykJNamnHWrjM1YFlMrE9uZfMMDSuH1uo_Mb4Si0RFOUm6pmxB1padhPD9iICKQxEG0B-Z/pub";

const MASTER_PASSWORD = "daniela";

const pagesConfig = [
  { title: "Intro", password: null },
  { title: "The Quiet Bloom", password: null },
  { title: "Where Small Joys Echo", password: "bloomrise" },
  { title: "A Warm-Hued Morning", password: "PaulAnka" },
  { title: "The Softness in the Cracks", password: "Amberlite" },
  { title: "Purple Fortunes", password: "Softfracture" },
  { title: "Final Page", password: "Daniela", ending: true }
];

let pages = [];
let currentPage = 0;

/* ---------- CLEAN GOOGLE DOC ---------- */
function extractCleanContent(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const body = doc.querySelector("body");
  if (!body) return "";

  body.querySelectorAll("script, style, meta, link").forEach(el => el.remove());
  return body.innerHTML;
}

/* ---------- LOAD DOC ---------- */
fetch(DOC_URL)
  .then(r => r.text())
  .then(raw => {
    const clean = extractCleanContent(raw);
    pages = clean
      .split("==PAGE==")
      .map(p => p.trim())
      .filter(Boolean);

    renderPage(0);
  });

/* ---------- PASSWORD CHECK ---------- */
function unlock(nextIndex) {
  const required = pagesConfig[nextIndex]?.password;
  if (!required) {
    renderPage(nextIndex);
    return;
  }

  const input = prompt("Password:");
  if (!input) return;

  if (
    input === required ||
    input.toLowerCase() === MASTER_PASSWORD
  ) {
    renderPage(nextIndex);
  } else {
    alert("Incorrect password.");
  }
}

/* ---------- RENDER ---------- */
function renderPage(index) {
  currentPage = index;

  document.getElementById("pageTitle").textContent =
    pagesConfig[index]?.title || "Page";

  document.getElementById("content").innerHTML = pages[index] || "";

  document.getElementById("pageCounter").textContent =
    `Page ${index + 1} / ${pages.length}`;

  const nextBtn = document.getElementById("nextBtn");
  nextBtn.style.display = index < pages.length - 1 ? "inline-block" : "none";

  if (pagesConfig[index]?.ending) runEndingEffect();
}

/* ---------- ENDING EFFECT ---------- */
function runEndingEffect() {
  const c = document.getElementById("content");
  c.style.opacity = "0";
  setTimeout(() => {
    c.style.transition = "opacity 3s ease";
    c.style.opacity = "1";
  }, 300);
}

/* ---------- BUTTON ---------- */
document.getElementById("nextBtn").addEventListener("click", () => {
  unlock(currentPage + 1);
});
