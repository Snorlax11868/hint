// ===============================
// CONFIG
// ===============================
const MASTER_BYPASS = "Daniela";
const PASSWORDS = ["Bloomrise", "PaulAnka", "Amberlit", "Softfracture", "Violetluck"];
const DOC_URL = "https://docs.google.com/document/d/e/2PACX-1vRIzDF5V10ykJNamnHWrjM1YFlMrE9uZfMMDSuH1uo_Mb4Si0RFOUm6pmxB1padhPD9iICKQxEG0B-Z/pub";
const PAGE_SPLITTER = "==PAGE==";

// Unlock schedule: first day of every month
function nextUnlockDate() {
    const now = new Date();
    const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return next;
}

// ===============================
// URL TOKEN SYNCING
// ===============================
function encodeAccess(unlockedPages) {
    return btoa(JSON.stringify(unlockedPages));
}
function decodeAccess(token) {
    try {
        return JSON.parse(atob(token));
    } catch {
        return [];
    }
}

function getTokenFromURL() {
    const params = new URLSearchParams(window.location.search);
    return params.get("access");
}
function updateURLWithToken(unlockedPages) {
    const token = encodeAccess(unlockedPages);
    const newURL = `${window.location.pathname}?access=${token}`;
    history.replaceState(null, "", newURL);
}

// ===============================
// MAIN LOADER
// ===============================
let unlockedPages = [];

function loadPageContent(index) {
    fetch(DOC_URL)
        .then(res => res.text())
        .then(html => {
            const clean = html.replace(/<[^>]*>/g, ""); // remove junk html
            const pages = clean.split(PAGE_SPLITTER).map(p => p.trim());

            if (!pages[index]) {
                document.getElementById("content").innerHTML = "Page not found.";
                return;
            }

            typewriter(pages[index], "content");
        });
}

// ===============================
// TYPEWRITER (with skip on revisit)
// ===============================
function typewriter(text, elementId) {
    const el = document.getElementById(elementId);
    el.innerHTML = "";
    let i = 0;

    // Skip animation if page already visited
    if (sessionStorage.getItem("visited-" + text.slice(0, 20))) {
        el.innerHTML = text;
        return;
    }

    const interval = setInterval(() => {
        el.innerHTML += text[i];
        i++;
        if (i >= text.length) {
            clearInterval(interval);
            sessionStorage.setItem("visited-" + text.slice(0, 20), "true");
        }
    }, 15);
}

// ===============================
// PASSWORD SCREEN
// ===============================
let attemptCount = 0;

function handlePasswordSubmit() {
    const input = document.getElementById("passwordInput").value.trim();

    // Master bypass
    if (input === MASTER_BYPASS) {
        unlockedPages = PASSWORDS.map((_, i) => i); // unlock all pages
        updateURLWithToken(unlockedPages);
        showPageSelector();
        return;
    }

    const index = PASSWORDS.indexOf(input);

    if (index !== -1) {
        if (!unlockedPages.includes(index)) unlockedPages.push(index);
        updateURLWithToken(unlockedPages);
        showPageSelector();
    } else {
        attemptCount++;
        if (attemptCount >= 3) showHint();
        document.getElementById("error").innerText = "Incorrect password.";
    }
}

// ===============================
// HINT AFTER 3 FAILED ATTEMPTS
// ===============================
function showHint() {
    const hintBox = document.getElementById("hintBox");
    hintBox.style.display = "block";
    hintBox.innerText = "Hint: The password relates to music, color, or emotion.";
}

// ===============================
// PAGE SELECTOR
// ===============================
function showPageSelector() {
    const container = document.getElementById("pageSelector");
    container.innerHTML = "";

    PASSWORDS.forEach((pw, i) => {
        const isUnlocked = unlockedPages.includes(i);
        const btn = document.createElement("button");

        if (isUnlocked) {
            btn.innerText = `Page ${i + 1}`;
            btn.onclick = () => loadPageContent(i);
        } else {
            const unlockDate = nextUnlockDate();
            const now = new Date();
            const daysLeft = Math.ceil((unlockDate - now) / (1000 * 60 * 60 * 24));

            btn.innerText = `Page locked — unlocks in ${daysLeft} days`;
            btn.disabled = true;
        }
        container.appendChild(btn);
    });
}

// ===============================
// INITIAL LOAD
// ===============================
window.onload = function () {
    const token = getTokenFromURL();
    if (token) unlockedPages = decodeAccess(token);

    showPageSelector();
};
