import { verifyAnswer } from "./crypto.js";
import { initApi, watchPublicPuzzle } from "./api-init.js";
import { renderNetworkInfo } from "./network-info.js";

const MAX_ATTEMPTS = 3;
const ATTEMPTS_KEY = "puzzleAttempts";
const LOCKED_KEY = "puzzleLocked";

const emptyState = document.getElementById("emptyState");
const puzzleSection = document.getElementById("puzzleSection");
const puzzleTypeBadge = document.getElementById("puzzleTypeBadge");
const puzzleQuestion = document.getElementById("puzzleQuestion");
const mathInput = document.getElementById("mathInput");
const mcqInput = document.getElementById("mcqInput");
const answerInput = document.getElementById("answerInput");
const submitBtn = document.getElementById("submitBtn");
const attemptsInfo = document.getElementById("attemptsInfo");
const lockOverlay = document.getElementById("lockOverlay");
const retryBtn = document.getElementById("retryBtn");
const successModal = document.getElementById("successModal");
const gradeDisplay = document.getElementById("gradeDisplay");
const closeSuccessBtn = document.getElementById("closeSuccessBtn");
const statusBar = document.getElementById("statusBar");

let currentPuzzle = null;
let selectedMcq = null;
let isLocked = sessionStorage.getItem(LOCKED_KEY) === "1";

function getAttempts() {
  return parseInt(sessionStorage.getItem(ATTEMPTS_KEY) || "0", 10);
}

function setAttempts(n) {
  sessionStorage.setItem(ATTEMPTS_KEY, String(n));
}

function updateAttemptsUI() {
  const remaining = MAX_ATTEMPTS - getAttempts();
  attemptsInfo.textContent = `Kalan hak: ${Math.max(0, remaining)}`;
}

function setStatus(text, type = "") {
  statusBar.textContent = text;
  statusBar.className = `status-bar ${type}`;
  statusBar.classList.remove("hidden");
}

function applyLockUI() {
  if (isLocked) {
    lockOverlay.classList.remove("hidden");
    puzzleSection.classList.add("hidden");
    submitBtn.disabled = true;
  } else {
    lockOverlay.classList.add("hidden");
    submitBtn.disabled = false;
  }
}

function renderPuzzle(data) {
  if (!data?.question || !data?.answerHash || !data?.salt) {
    emptyState.classList.remove("hidden");
    puzzleSection.classList.add("hidden");
    currentPuzzle = null;
    return;
  }

  emptyState.classList.add("hidden");
  if (!isLocked) {
    puzzleSection.classList.remove("hidden");
  }

  currentPuzzle = data;
  selectedMcq = null;

  puzzleQuestion.textContent = data.question;

  if (data.type === "math") {
    puzzleTypeBadge.textContent = "Zor matematik";
    mathInput.classList.remove("hidden");
    mcqInput.classList.add("hidden");
    answerInput.value = "";
  } else {
    const isMathMcq = data.subType === "math_mcq";
    puzzleTypeBadge.textContent = isMathMcq
      ? "Matematik · çoktan seçmeli"
      : "Çoktan seçmeli";
    mathInput.classList.add("hidden");
    mcqInput.classList.remove("hidden");
    renderMcq(data.choices || []);
  }

  updateAttemptsUI();
}

function renderMcq(choices) {
  mcqInput.innerHTML = "";
  choices.forEach((value) => {
    const label = document.createElement("label");
    label.className = "mcq-option";
    label.innerHTML = `
      <input type="radio" name="mcq" value="${value}">
      <span>${value}</span>
    `;
    const radio = label.querySelector("input");
    radio.addEventListener("change", () => {
      selectedMcq = value;
      mcqInput.querySelectorAll(".mcq-option").forEach((el) => el.classList.remove("selected"));
      label.classList.add("selected");
    });
    mcqInput.appendChild(label);
  });
}

async function handleSubmit() {
  if (isLocked || !currentPuzzle) return;

  let userAnswer;
  if (currentPuzzle.type === "math") {
    const raw = answerInput.value.trim();
    if (raw === "") return;
    userAnswer = parseInt(raw, 10);
    if (Number.isNaN(userAnswer)) return;
  } else {
    if (selectedMcq === null) return;
    userAnswer = selectedMcq;
  }

  submitBtn.disabled = true;

  try {
    const correct = await verifyAnswer(
      userAnswer,
      currentPuzzle.salt,
      currentPuzzle.answerHash
    );

    if (correct) {
      setAttempts(0);
      gradeDisplay.textContent = userAnswer;
      successModal.showModal();
    } else {
      const attempts = getAttempts() + 1;
      setAttempts(attempts);
      updateAttemptsUI();

      if (attempts >= MAX_ATTEMPTS) {
        isLocked = true;
        sessionStorage.setItem(LOCKED_KEY, "1");
        applyLockUI();
      } else {
        answerInput.value = "";
        selectedMcq = null;
        mcqInput.querySelectorAll(".mcq-option").forEach((el) => {
          el.classList.remove("selected");
          const radio = el.querySelector("input");
          if (radio) radio.checked = false;
        });
      }
    }
  } finally {
    if (!isLocked) submitBtn.disabled = false;
  }
}

function handleRetry() {
  isLocked = false;
  sessionStorage.removeItem(LOCKED_KEY);
  setAttempts(0);
  applyLockUI();
  if (currentPuzzle) {
    puzzleSection.classList.remove("hidden");
    renderPuzzle(currentPuzzle);
  }
  updateAttemptsUI();
}

async function boot() {
  renderNetworkInfo("networkInfo");
  try {
    await initApi();
    setStatus("Sunucuya bağlandı", "connected");

    if (isLocked) {
      applyLockUI();
    }

    watchPublicPuzzle(
      (data) => {
        renderPuzzle(data);
        if (isLocked) applyLockUI();
      },
      (err) => {
        setStatus("Bağlantı hatası", "error");
        console.error(err);
      }
    );
  } catch (err) {
    setStatus(err.message, "error");
    emptyState.classList.remove("hidden");
    emptyState.querySelector("p").textContent = err.message;
  }
}

submitBtn.addEventListener("click", handleSubmit);
answerInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") handleSubmit();
});
retryBtn.addEventListener("click", handleRetry);
closeSuccessBtn.addEventListener("click", () => successModal.close());

boot();
