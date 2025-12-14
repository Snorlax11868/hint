const DOC_URL = "https://docs.google.com/document/d/e/2PACX-1vRIzDF5V10ykJNamnHWrjM1YFlMrE9uZfMMDSuH1uo_Mb4Si0RFOUm6pmxB1padhPD9iICKQxEG0B-Z/pub";

const TITLES = [
  "Intro",
  "The Quiet Bloom",
  "Where Small Joys Echo",
  "A Warm-Hued Morning",
  "The Softness in the Cracks",
  "Purple Fortunes",
  "Ending"
];

const PASSWORDS = [
  null,
  null,
  "bloomrise",
  "PaulAnka",
  "Amberlite",
  "Softfracture",
  "Daniela"
];

const HINTS = [
  "",
  "",
  "I open without sound when someone walks near...",
  "A vintage voice that serenades young hearts...",
  "A gemstone warmed by daylight...",
  "Part hush, part break...",
  ""
];

window.clues_pages = [];
window.clues_unlocked = JSON.parse(localStorage.getItem("unlocked") || "[]");

window.clues_initPromise = fetch(DOC_URL)
  .then(r => r.text())
  .then(t => {
    window.clues_pages = t.split("==PAGE==");
  });

window.clues_navigateTo = function(i) {
  siteTitle.innerText = TITLES[i];
  status.innerText = `Page ${i+1}`;

  if (PASSWORDS[i] && !window.clues_unlocked.includes(i)) {
    showModal(i);
    return;
  }

  renderPage(i);
};

function renderPage(i) {
  content.textContent = window.clues_pages[i] || "";
  if (i === PASSWORDS.length - 1) {
    document.body.classList.add("final-page");
  }
}

function showModal(i) {
  modal.style.display = "flex";
  hintText.innerText = HINTS[i];
  submitPw.onclick = () => {
    if (pwInput.value === PASSWORDS[i]) {
      modal.style.display = "none";
      window.clues_unlocked.push(i);
      localStorage.setItem("unlocked", JSON.stringify(window.clues_unlocked));
      renderPage(i);
    } else {
      pwError.innerText = "Incorrect password";
    }
  };
}
