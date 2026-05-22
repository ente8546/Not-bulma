import { generatePuzzle } from "./puzzle-generator.js";
import {
  initApi,
  adminLogin,
  getAdminConfig,
  saveGradeAndPuzzle,
  changeAdminPassword,
  getAdminToken,
  setAdminToken,
} from "./api-init.js";
import { renderNetworkInfo } from "./network-info.js";

const loginSection = document.getElementById("loginSection");
const panelSection = document.getElementById("panelSection");
const adminMessage = document.getElementById("adminMessage");
const setupHint = document.getElementById("setupHint");
const loginPassword = document.getElementById("loginPassword");
const loginBtn = document.getElementById("loginBtn");
const gradeInput = document.getElementById("gradeInput");
const saveGradeBtn = document.getElementById("saveGradeBtn");
const currentGradeInfo = document.getElementById("currentGradeInfo");
const currentPassword = document.getElementById("currentPassword");
const newPassword = document.getElementById("newPassword");
const confirmPassword = document.getElementById("confirmPassword");
const changePasswordBtn = document.getElementById("changePasswordBtn");
const logoutBtn = document.getElementById("logoutBtn");

function showMessage(text, type = "info") {
  adminMessage.textContent = text;
  adminMessage.className = `message ${type}`;
  adminMessage.classList.remove("hidden");
}

function hideMessage() {
  adminMessage.classList.add("hidden");
}

function showPanel() {
  loginSection.classList.add("hidden");
  panelSection.classList.remove("hidden");
}

function showLogin() {
  setAdminToken(null);
  loginSection.classList.remove("hidden");
  panelSection.classList.add("hidden");
}

async function handleLogin() {
  hideMessage();
  const password = loginPassword.value.trim();
  if (!password) {
    showMessage("Şifre girin.", "error");
    return;
  }

  try {
    const { token, isDefault } = await adminLogin(password);
    setAdminToken(token);
    loginPassword.value = "";
    showPanel();
    await refreshGradeInfo();
    if (isDefault) setupHint.classList.remove("hidden");
    showMessage("Giriş başarılı.", "success");
  } catch (err) {
    showMessage(err.message || "Giriş hatası.", "error");
  }
}

async function refreshGradeInfo() {
  const config = await getAdminConfig();
  if (config?.grade != null) {
    currentGradeInfo.textContent = `Kayıtlı not: ${config.grade}`;
    gradeInput.value = config.grade;
  } else {
    currentGradeInfo.textContent = "Henüz not kaydedilmedi.";
  }
}

async function handleSaveGrade() {
  if (!getAdminToken()) {
    showMessage("Oturum süresi doldu. Lütfen tekrar giriş yapın.", "error");
    showLogin();
    return;
  }

  hideMessage();
  const raw = gradeInput.value.trim();
  const grade = Number(raw);
  if (!Number.isInteger(grade) || grade < 0 || grade > 100) {
    showMessage("Not 0 ile 100 arasında tam sayı olmalıdır.", "error");
    return;
  }

  saveGradeBtn.disabled = true;
  try {
    const puzzle = await generatePuzzle(grade);
    const { answer, ...publicData } = puzzle;

    await saveGradeAndPuzzle(grade, {
      type: publicData.type,
      subType: publicData.subType || null,
      question: publicData.question,
      choices: publicData.choices || null,
      salt: publicData.salt,
      answerHash: publicData.answerHash,
    });

    await refreshGradeInfo();
    showMessage(`Not ${grade} kaydedildi ve bulmaca oluşturuldu.`, "success");
  } catch (err) {
    const msg = err.message || "Kayıt hatası.";
    showMessage(msg, "error");
    if (msg.includes("Oturum") || msg.includes("giriş")) {
      showLogin();
    }
  } finally {
    saveGradeBtn.disabled = false;
  }
}

async function handleChangePassword() {
  if (!getAdminToken()) {
    showMessage("Oturum süresi doldu. Lütfen tekrar giriş yapın.", "error");
    showLogin();
    return;
  }

  const cur = currentPassword.value.trim();
  const neu = newPassword.value.trim();
  const conf = confirmPassword.value.trim();

  if (!cur || !neu || !conf) {
    showMessage("Tüm şifre alanlarını doldurun.", "error");
    return;
  }
  if (neu.length < 4) {
    showMessage("Yeni şifre en az 4 karakter olmalıdır.", "error");
    return;
  }
  if (neu !== conf) {
    showMessage("Yeni şifreler eşleşmiyor.", "error");
    return;
  }
  if (cur === neu) {
    showMessage("Yeni şifre mevcut şifreden farklı olmalıdır.", "error");
    return;
  }

  changePasswordBtn.disabled = true;
  try {
    await changeAdminPassword(cur, neu);
    currentPassword.value = "";
    newPassword.value = "";
    confirmPassword.value = "";
    setupHint.classList.add("hidden");
    showMessage("Şifre güncellendi. Bir sonraki girişte yeni şifreyi kullanın.", "success");
  } catch (err) {
    const msg = err.message || "Şifre güncellenemedi.";
    showMessage(msg, "error");
    if (msg.includes("Oturum")) {
      showLogin();
    }
  } finally {
    changePasswordBtn.disabled = false;
  }
}

function handleLogout() {
  hideMessage();
  showLogin();
}

async function boot() {
  renderNetworkInfo("networkInfo");
  try {
    await initApi();
    setupHint.classList.remove("hidden");

    if (getAdminToken()) {
      try {
        showPanel();
        await refreshGradeInfo();
      } catch {
        setAdminToken(null);
        showLogin();
        showMessage("Oturum süresi doldu. Lütfen tekrar giriş yapın.", "info");
      }
    }
  } catch (err) {
    showMessage(err.message, "error");
    loginBtn.disabled = true;
    saveGradeBtn.disabled = true;
  }
}

loginBtn.addEventListener("click", handleLogin);
loginPassword.addEventListener("keydown", (e) => {
  if (e.key === "Enter") handleLogin();
});
saveGradeBtn.addEventListener("click", handleSaveGrade);
changePasswordBtn.addEventListener("click", handleChangePassword);
logoutBtn.addEventListener("click", handleLogout);

boot();
