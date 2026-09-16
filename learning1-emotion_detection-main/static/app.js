let video = null;
let canvas = null;
let ctx = null;
let overlayCanvas = null;
let overlayCtx = null;
let bboxRect = null;
let stream = null;
let sessionId = null;
let captureLoop = null;
let timelineChart = null;
let scatterChart = null;
let teacherDashboardData = null;
let teacherClassTimelineChart = null;
let teacherClassScatterChart = null;
let teacherStudentTimelineChart = null;
let teacherStudentScatterChart = null;
let teacherSelectedStudentId = null;
let teacherSelectedSelfReport = "";
const CAPTURE_INTERVAL_MS = 1000;
const MONITOR_POPUP_STATE_KEY = "monitorPopupState";

let authToken = localStorage.getItem("authToken") || null;
let currentUser = null;
let studentMaterialsData = [];

const ROLE_PAGE = {
  student: "/static/student.html",
  teacher: "/static/teacher.html",
  admin: "/static/admin.html",
};

const currentPage = (window.location.pathname.split("/").pop() || "").toLowerCase();
const isLoginPage = currentPage === "login.html";
const isRegisterPage = currentPage === "register.html";
const isStudentPage = currentPage === "student.html";
const isTeacherPage = currentPage === "teacher.html";
const isAdminPage = currentPage === "admin.html";
const isRolePage = isStudentPage || isTeacherPage || isAdminPage;

function el(id) {
  return document.getElementById(id);
}

function passwordScore(pwd) {
  if (!pwd) return 0;
  let score = 0;
  // length contribution (up to 40)
  score += Math.min(40, (pwd.length / 12) * 40);
  // character variety
  const hasLower = /[a-z]/.test(pwd);
  const hasUpper = /[A-Z]/.test(pwd);
  const hasDigit = /[0-9]/.test(pwd);
  const hasSymbol = /[^A-Za-z0-9]/.test(pwd);
  score += (hasLower + hasUpper + hasDigit + hasSymbol) * 15; // up to 60
  return Math.max(0, Math.min(100, Math.round(score)));
}

function expectedRoleFromPage() {
  if (isStudentPage) return "student";
  if (isTeacherPage) return "teacher";
  if (isAdminPage) return "admin";
  return null;
}

function redirectTo(url) {
  if (window.location.pathname !== url) {
    window.location.assign(url);
  }
}

function showMessage(msg, type = "danger") {
  const appMessage = el("appMessage");
  if (!appMessage) return;
  appMessage.textContent = msg || "";
  appMessage.classList.remove("d-none", "alert-danger", "alert-success", "alert-warning", "alert-info");
  appMessage.classList.add(`alert-${type}`);
}

function clearMessage() {
  const appMessage = el("appMessage");
  if (!appMessage) return;
  appMessage.textContent = "";
  appMessage.classList.add("d-none");
}

function setUserInfo() {
  const userInfo = el("userInfo");
  if (userInfo && currentUser) {
    userInfo.textContent = `${currentUser.name} (${currentUser.role})`;
  }
}

async function apiFetch(url, options = {}) {
  const headers = new Headers(options.headers || {});
  if (authToken) headers.set("Authorization", `Bearer ${authToken}`);
  const resp = await fetch(url, { ...options, headers });
  if (resp.status === 401) {
    handleLogout(false);
    redirectTo("/static/login.html");
    throw new Error("Session expired. Please login again.");
  }
  return resp;
}

async function fetchCurrentUser() {
  const resp = await apiFetch("/auth/me");
  if (!resp.ok) {
    const data = await resp.json().catch(() => ({}));
    throw new Error(data.detail || "Failed to load user profile");
  }
  currentUser = await resp.json();
  return currentUser;
}

function roleHome(role) {
  return ROLE_PAGE[role] || "/static/login.html";
}

async function redirectAfterAuth() {
  await fetchCurrentUser();
  redirectTo(roleHome(currentUser.role));
}

function handleLogout(showNotice = true) {
  authToken = null;
  currentUser = null;
  localStorage.removeItem("authToken");

  if (captureLoop) {
    clearInterval(captureLoop);
    captureLoop = null;
  }
  if (stream) {
    try {
      stream.getTracks().forEach((t) => t.stop());
    } catch (_e) { }
    stream = null;
  }
  sessionId = null;

  if (showNotice) showMessage("Logged out.", "success");
}

function setupAuthButtons() {
  const loginBtn = el("loginBtn");
  const registerBtn = el("registerBtn");
  const logoutBtn = el("logoutBtn");

  if (loginBtn) {
    loginBtn.addEventListener("click", async () => {
      try {
        clearMessage();
        const fd = new URLSearchParams();
        fd.append("username", (el("loginEmail")?.value || "").trim());
        fd.append("password", el("loginPassword")?.value || "");
        const resp = await fetch("/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: fd,
        });
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok) throw new Error(data.detail || "Login failed");
        authToken = data.access_token;
        localStorage.setItem("authToken", authToken);
        showMessage("Login successful. Redirecting...", "success");
        await redirectAfterAuth();
      } catch (err) {
        showMessage(err.message || "Login failed");
      }
    });
  }

  if (registerBtn) {
    registerBtn.addEventListener("click", async () => {
      try {
        clearMessage();
        const consent = el("registerConsent")?.checked;
        const pwd = el("registerPassword")?.value || "";
        if (!consent) {
          showMessage("Please agree to the consent checkbox before creating an account.", "warning");
          return;
        }
        if (pwd.length < 8) {
          showMessage("Password must be at least 8 characters long.", "warning");
          return;
        }

        const resp = await fetch("/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: (el("registerName")?.value || "").trim(),
            email: (el("registerEmail")?.value || "").trim(),
            password: pwd,
            role: el("registerRole")?.value || "student",
          }),
        });
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok) throw new Error(data.detail || "Registration failed");
        authToken = data.access_token;
        localStorage.setItem("authToken", authToken);
        showMessage("Registration successful. Redirecting...", "success");
        await redirectAfterAuth();
      } catch (err) {
        showMessage(err.message || "Registration failed");
      }
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      handleLogout(false);
      redirectTo("/static/login.html");
    });
  }

  // password strength indicator on register page
  if (isRegisterPage) {
    const pwdInput = el("registerPassword");
    const bar = el("passwordStrengthBar");
    if (pwdInput && bar) {
      pwdInput.addEventListener("input", () => {
        const s = passwordScore(pwdInput.value);
        bar.style.width = `${s}%`;
        if (s < 40) bar.style.background = "linear-gradient(90deg,#ff9a9e,#ff6a6a)";
        else if (s < 70) bar.style.background = "linear-gradient(90deg,#ffd36a,#f6b042)";
        else bar.style.background = "linear-gradient(90deg,#9be15d,#00b09b)";
      });
    }
  }
}

async function bootstrap() {
  setupAuthButtons();

  if (!authToken) {
    if (isRolePage || (!isLoginPage && !isRegisterPage)) {
      redirectTo("/static/login.html");
    }
    return;
  }

  try {
    await fetchCurrentUser();
  } catch (_err) {
    handleLogout(false);
    redirectTo("/static/login.html");
    return;
  }

  if (isLoginPage || isRegisterPage) {
    redirectTo(roleHome(currentUser.role));
    return;
  }

  const expectedRole = expectedRoleFromPage();
  if (expectedRole && currentUser.role !== expectedRole) {
    redirectTo(roleHome(currentUser.role));
    return;
  }

  if (!isRolePage) {
    redirectTo(roleHome(currentUser.role));
    return;
  }

  setUserInfo();
  try {
    if (isStudentPage) await initStudentPage();
    if (isTeacherPage) await initTeacherPage();
    if (isAdminPage) await initAdminPage();
  } catch (err) {
    showMessage(err.message || "Failed to initialize page");
  }
}

async function initStudentPage() {
  initMonitorPopupControls();
  await loadConsentStatus();
  await loadStudentMaterials();
  initCharts();
  await startCamera();

  el("consentAcceptBtn")?.addEventListener("click", async () => {
    try {
      const resp = await apiFetch("/consent/accept", { method: "POST" });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.detail || "Failed to accept consent");
      await loadConsentStatus();
      showMessage("Consent accepted.", "success");
    } catch (err) {
      showMessage(err.message);
    }
  });

  el("consentWithdrawBtn")?.addEventListener("click", async () => {
    try {
      const resp = await apiFetch("/consent/withdraw", { method: "POST" });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.detail || "Failed to withdraw consent");
      await loadConsentStatus();
      showMessage("Consent withdrawn.", "warning");
    } catch (err) {
      showMessage(err.message);
    }
  });

  el("studentMaterials")?.addEventListener("change", async () => {
    const selectedId = Number(el("studentMaterials")?.value || 0);
    const sidebarMaterials = el("sidebarMaterials");

    // Update sidebar active state
    if (sidebarMaterials) {
      const items = sidebarMaterials.querySelectorAll(".sidebar-material-item");
      items.forEach((item) => {
        item.classList.remove("active");
        if (Number(item.dataset.materialId) === selectedId) {
          item.classList.add("active");
        }
      });
    }

    await renderSelectedMaterialDetail();
    await loadCommentsForSelectedMaterial();
  });

  el("openMaterialBtn")?.addEventListener("click", async () => {
    const material = getSelectedStudentMaterial();
    if (!material) {
      showMessage("Select a material first.");
      return;
    }
    try {
      const resp = await apiFetch(`/materials/${material.id}/open`, { method: "POST" });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.detail || "Failed to track material open");
      renderSelectedMaterialDetail();
      el("materialPreview")?.scrollIntoView({ behavior: "smooth", block: "start" });
      await loadLastOpenedBadge();
      showMessage("Material opened and tracked.", "success");
    } catch (err) {
      showMessage(err.message);
    }
  });

  el("submitCommentBtn")?.addEventListener("click", async () => {
    const material = getSelectedStudentMaterial();
    const commentText = (el("commentText")?.value || "").trim();
    if (!material) {
      showMessage("Select a material first.");
      return;
    }
    if (!commentText) {
      showMessage("Comment cannot be empty.");
      return;
    }
    try {
      const resp = await apiFetch(`/materials/${material.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comment_text: commentText }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.detail || "Failed to submit comment");
      el("commentText").value = "";
      await loadCommentsForSelectedMaterial();
      showMessage("Comment submitted.", "success");
    } catch (err) {
      showMessage(err.message);
    }
  });

  el("startSession")?.addEventListener("click", async () => {
    try {
      const selectedMaterialId = el("materialSelect")?.value || "";
      const query = selectedMaterialId ? `?material_id=${encodeURIComponent(selectedMaterialId)}` : "";
      const resp = await apiFetch(`/session/start${query}`, { method: "POST" });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.detail || "Failed to start session");
      sessionId = data.session_id;
      if (captureLoop) clearInterval(captureLoop);
      await captureAndSend();
      captureLoop = setInterval(captureAndSend, CAPTURE_INTERVAL_MS);
      showMessage(`Session started: ${sessionId}`, "success");
    } catch (err) {
      showMessage(err.message);
    }
  });

  el("stopSession")?.addEventListener("click", async () => {
    try {
      if (captureLoop) {
        clearInterval(captureLoop);
        captureLoop = null;
      }
      if (sessionId) {
        const resp = await apiFetch(`/session/stop?session_id=${encodeURIComponent(sessionId)}`, { method: "POST" });
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok) throw new Error(data.detail || "Failed to stop session");
        showMessage(`Session stopped: ${sessionId}`, "success");
        sessionId = null;
      }
    } catch (err) {
      showMessage(err.message);
    }
  });
}

function initMonitorPopupControls() {
  const monitor = el("monitor");
  const openBtn = el("monitorOpenBtn");
  const minBtn = el("monitorMinBtn");
  const closeBtn = el("monitorCloseBtn");
  if (!monitor || !openBtn || !minBtn || !closeBtn) return;
  if (monitor.dataset.popupReady === "1") return;

  const stored = localStorage.getItem(MONITOR_POPUP_STATE_KEY) || "open";
  applyMonitorPopupState(stored, false);

  openBtn.addEventListener("click", () => applyMonitorPopupState("open", true));
  minBtn.addEventListener("click", () => {
    const minimized = monitor.classList.contains("minimized");
    applyMonitorPopupState(minimized ? "open" : "minimized", true);
  });
  closeBtn.addEventListener("click", () => applyMonitorPopupState("closed", true));

  monitor.dataset.popupReady = "1";
}

function applyMonitorPopupState(state, persist = true) {
  const monitor = el("monitor");
  const openBtn = el("monitorOpenBtn");
  if (!monitor || !openBtn) return;

  monitor.classList.remove("minimized");
  openBtn.style.display = "none";

  if (state === "closed") {
    monitor.style.display = "none";
    openBtn.style.display = "inline-flex";
  } else if (state === "minimized") {
    monitor.style.display = "block";
    monitor.classList.add("minimized");
  } else {
    monitor.style.display = "block";
  }

  if (persist) localStorage.setItem(MONITOR_POPUP_STATE_KEY, state);
}

function updateLiveEmotionSummary(data) {
  let boredom = 0;
  let engagement = 0;
  let confusion = 0;
  let frustration = 0;

  if (data && ('boredom' in data || 'engagement' in data)) {
    boredom = Math.round(Number(data.boredom || 0) * 100);
    engagement = Math.round(Number(data.engagement || 0) * 100);
    confusion = Math.round(Number(data.confusion || 0) * 100);
    frustration = Math.round(Number(data.frustration || 0) * 100);
  } else {
    // Fallback: estimate from valence and arousal
    const v = Number(data?.valence || 0);
    const a = Number(data?.arousal || 0);
    engagement = Math.round(Math.max(0, (v * 0.5 + a * 0.5)) * 100);
    boredom = Math.round(Math.max(0, ((1 - a) * 0.6 - v * 0.2)) * 100);
    confusion = Math.round(Math.max(0, (a * 0.4 - v * 0.4)) * 100);
    frustration = Math.round(Math.max(0, (a * 0.6 - v * 0.6)) * 100);
  }

  const raw = { boredom, engagement, confusion, frustration };
  const total = Object.values(raw).reduce((s, n) => s + n, 0) || 1;
  const pct = Object.fromEntries(Object.entries(raw).map(([k, n]) => [k, Math.round((n / total) * 100)]));

  let dominant = "engagement";
  let dominantValue = -1;
  for (const [key, value] of Object.entries(pct)) {
    if (value > dominantValue) {
      dominant = key;
      dominantValue = value;
    }
  }

  const labelMap = {
    boredom: "Boredom",
    engagement: "Engagement",
    confusion: "Confusion",
    frustration: "Frustration"
  };

  const ring = el("liveEmotionRing");
  const label = el("liveEmotionLabel");
  const ratio = el("liveEmotionPct");

  const emoBoredom = el("emoBoredom");
  const emoEngagement = el("emoEngagement");
  const emoConfusion = el("emoConfusion");
  const emoFrustration = el("emoFrustration");

  if (!ring || !label || !ratio || !emoBoredom || !emoEngagement || !emoConfusion || !emoFrustration) return;

  const dominantPct = Math.max(0, Math.min(100, pct[dominant] || 0));
  const sweep = Math.round((dominantPct / 100) * 360);
  ring.style.background = `conic-gradient(#22c55e 0deg, #22c55e ${sweep}deg, #d1d5db ${sweep}deg, #d1d5db 360deg)`;
  ring.textContent = `${dominantPct}%`;
  label.textContent = labelMap[dominant] || "Engagement";
  ratio.textContent = `${dominantPct}%`;

  emoBoredom.textContent = `${pct.boredom || 0}%`;
  emoEngagement.textContent = `${pct.engagement || 0}%`;
  emoConfusion.textContent = `${pct.confusion || 0}%`;
  emoFrustration.textContent = `${pct.frustration || 0}%`;
}

async function loadConsentStatus() {
  const consentSection = el("consentSection");
  const consentStatus = el("consentStatus");
  const monitor = el("monitor");
  if (!consentSection || !consentStatus || !monitor) return;

  const resp = await apiFetch("/consent/me");
  const data = await resp.json().catch(() => null);
  if (!resp.ok) {
    consentStatus.textContent = "Unable to load consent status.";
    return;
  }

  if (!data || data.status !== "accepted") {
    consentSection.style.display = "block";
    monitor.style.display = "none";
    const openBtn = el("monitorOpenBtn");
    if (openBtn) openBtn.style.display = "none";
    consentStatus.textContent = data ? `Consent status: ${data.status}` : "Consent status: not provided.";
    return;
  }

  consentSection.style.display = "none";
  const preferred = localStorage.getItem(MONITOR_POPUP_STATE_KEY) || "open";
  applyMonitorPopupState(preferred, false);
  consentStatus.textContent = `Consent status: accepted (${new Date(data.timestamp).toLocaleString()})`;

  // Ensure Plotly circumplex resizes / renders when monitor is shown (fixes hidden-container render issue)
  try {
    const sc = el("scatterChart");
    if (sc && typeof Plotly !== "undefined" && Plotly.Plots && Plotly.Plots.resize) {
      // small timeout to allow layout to settle
      setTimeout(() => {
        try {
          Plotly.Plots.resize(sc);
        } catch (_e) { }
      }, 80);
    }
  } catch (_e) { }
}

async function loadStudentMaterials() {
  const studentSelect = el("studentMaterials");
  const sessionSelect = el("materialSelect");
  const sidebarMaterials = el("sidebarMaterials");
  if (!studentSelect || !sessionSelect) return;

  const resp = await apiFetch("/materials");
  const list = await resp.json().catch(() => []);
  if (!resp.ok) throw new Error(list.detail || "Failed to load materials");

  studentMaterialsData = Array.isArray(list) ? list : [];

  studentSelect.innerHTML = "";
  sessionSelect.innerHTML = '<option value="">No material selected</option>';
  if (sidebarMaterials) {
    sidebarMaterials.innerHTML = "";
  }

  if (studentMaterialsData.length === 0) {
    studentSelect.innerHTML = '<option value="">No assigned material</option>';
    renderSelectedMaterialDetail();
    renderComments([]);
    await loadLastOpenedBadge();
    return;
  }

  const studentLearningGroup = document.createElement("optgroup");
  studentLearningGroup.label = "📖 Learning Materials";
  const studentQuizzesGroup = document.createElement("optgroup");
  studentQuizzesGroup.label = "📝 Quizzes & Questions";

  const sessionLearningGroup = document.createElement("optgroup");
  sessionLearningGroup.label = "📖 Learning Materials";
  const sessionQuizzesGroup = document.createElement("optgroup");
  sessionQuizzesGroup.label = "📝 Quizzes & Questions";

  const groupedMaterials = getGroupedStudentMaterials();
  for (const item of groupedMaterials) {
    const type = item.file_type || "pdf";
    const isQuiz = (type === "essay" || type === "mcq");

    const count = getMaterialGroupCount(item);
    const displayTitle = count > 1 ? getBaseTitle(item.title) : (item.title || "Untitled");

    const optionA = document.createElement("option");
    optionA.value = String(item.id);
    optionA.textContent = `${displayTitle} — ${item.subject} (${type.toUpperCase()}${count > 1 ? ` x${count}` : ""})`;

    const optionB = document.createElement("option");
    optionB.value = String(item.id);
    optionB.textContent = `${displayTitle} — ${item.subject}`;

    if (isQuiz) {
      studentQuizzesGroup.appendChild(optionA);
      sessionQuizzesGroup.appendChild(optionB);
    } else {
      studentLearningGroup.appendChild(optionA);
      sessionLearningGroup.appendChild(optionB);
    }
  }

  if (studentLearningGroup.children.length > 0) studentSelect.appendChild(studentLearningGroup);
  if (studentQuizzesGroup.children.length > 0) studentSelect.appendChild(studentQuizzesGroup);
  if (sessionLearningGroup.children.length > 0) sessionSelect.appendChild(sessionLearningGroup);
  if (sessionQuizzesGroup.children.length > 0) sessionSelect.appendChild(sessionQuizzesGroup);

  // Populate sidebar materials
  if (sidebarMaterials && studentMaterialsData.length > 0) {
    const learningMaterialsList = [];
    const quizzesList = [];
    for (const item of groupedMaterials) {
      const type = item.file_type || "pdf";
      if (type === "pdf" || type === "video" || type === "link") {
        learningMaterialsList.push(item);
      } else if (type === "essay" || type === "mcq") {
        quizzesList.push(item);
      }
    }

    let html = "";
    if (learningMaterialsList.length > 0) {
      html += `<div class="sidebar-material-group-title text-primary mt-2">📖 Learning Materials</div>`;
      html += learningMaterialsList
        .map(
          (item) => `
          <div class="sidebar-material-item mb-1" data-material-id="${item.id}" onclick="selectMaterialFromSidebar(${item.id})">
            <div class="sidebar-material-title">${escapeHtml(item.title || "Untitled")}</div>
            <div class="sidebar-material-subject">${escapeHtml(item.subject || "General")} <span class="badge bg-secondary-subtle text-secondary-emphasis" style="font-size: 0.6rem; font-weight: normal; margin-left: 4px;">${item.file_type.toUpperCase()}</span></div>
          </div>
        `
        )
        .join("");
    }
    if (quizzesList.length > 0) {
      html += `<div class="sidebar-material-group-title text-success mt-3">📝 Quizzes & Questions</div>`;
      html += quizzesList
        .map(
          (item) => {
            const count = getMaterialGroupCount(item);
            const displayTitle = count > 1 ? `${getBaseTitle(item.title)} (${count})` : (item.title || "Untitled");
            return `
              <div class="sidebar-material-item mb-1" data-material-id="${item.id}" onclick="selectMaterialFromSidebar(${item.id})">
                <div class="sidebar-material-title">${escapeHtml(displayTitle)}</div>
                <div class="sidebar-material-subject">${escapeHtml(item.subject || "General")} <span class="badge bg-success-subtle text-success-emphasis" style="font-size: 0.6rem; font-weight: normal; margin-left: 4px;">${item.file_type === "mcq" ? "MCQ" : "ESSAY"}</span></div>
              </div>
            `;
          }
        )
        .join("");
    }
    sidebarMaterials.innerHTML = html;

    // Mark first item as active
    const firstItem = sidebarMaterials.querySelector(".sidebar-material-item");
    if (firstItem) {
      firstItem.classList.add("active");
    }
  }

  renderSelectedMaterialDetail();
  await loadCommentsForSelectedMaterial();
  await loadLastOpenedBadge();
}

function getSelectedStudentMaterial() {
  const selectedId = Number(el("studentMaterials")?.value || 0);
  return studentMaterialsData.find((m) => m.id === selectedId) || null;
}

function getBaseTitle(title) {
  return (title || "").replace(/\s*\(Q\d+\)$/i, "");
}

function getSelectedStudentMaterialGroup() {
  const mainMaterial = getSelectedStudentMaterial();
  if (!mainMaterial) return [];
  if (mainMaterial.file_type !== "mcq" && mainMaterial.file_type !== "essay") {
    return [mainMaterial];
  }
  const baseTitle = getBaseTitle(mainMaterial.title);
  return studentMaterialsData.filter(
    (m) => getBaseTitle(m.title) === baseTitle &&
           m.subject === mainMaterial.subject &&
           m.file_type === mainMaterial.file_type
  );
}

function getGroupedStudentMaterials() {
  const grouped = [];
  const seen = new Set();
  for (const item of studentMaterialsData) {
    if (item.file_type === "mcq" || item.file_type === "essay") {
      const baseTitle = getBaseTitle(item.title);
      const key = `${baseTitle}|${item.subject}|${item.file_type}`;
      if (!seen.has(key)) {
        seen.add(key);
        grouped.push(item);
      }
    } else {
      grouped.push(item);
    }
  }
  return grouped;
}

function getMaterialGroupCount(material) {
  if (material.file_type !== "mcq" && material.file_type !== "essay") return 1;
  const baseTitle = getBaseTitle(material.title);
  return studentMaterialsData.filter(
    (m) => getBaseTitle(m.title) === baseTitle &&
           m.subject === material.subject &&
           m.file_type === material.file_type
  ).length;
}

async function selectMaterialFromSidebar(materialId) {
  const studentSelect = el("studentMaterials");
  const sidebarMaterials = el("sidebarMaterials");

  if (studentSelect) {
    studentSelect.value = String(materialId);
  }

  // Update sidebar active state
  if (sidebarMaterials) {
    const items = sidebarMaterials.querySelectorAll(".sidebar-material-item");
    items.forEach((item) => {
      item.classList.remove("active");
      if (Number(item.dataset.materialId) === materialId) {
        item.classList.add("active");
      }
    });
  }

  await renderSelectedMaterialDetail();
  loadCommentsForSelectedMaterial();
}

async function renderSelectedMaterialDetail() {
  const detail = el("materialDetail");
  const preview = el("materialPreview");
  if (!detail) return;
  const material = getSelectedStudentMaterial();
  if (!material) {
    detail.textContent = "No material selected.";
    if (preview) preview.innerHTML = "";
    return;
  }

  const location = (material.file_type === "pdf") ? (material.file_path || "-") :
    (material.file_type === "video" || material.file_type === "link") ? (material.external_url || "-") :
      "Question/Answer System";

  const count = getMaterialGroupCount(material);
  const displayTitle = count > 1 ? `${getBaseTitle(material.title)} (${count} questions)` : (material.title || "");

  detail.innerHTML = `
    <div><strong>Title:</strong> ${escapeHtml(displayTitle)}</div>
    <div><strong>Subject:</strong> ${escapeHtml(material.subject || "")}</div>
    <div><strong>Type:</strong> ${escapeHtml(material.file_type ? material.file_type.toUpperCase() : "")}</div>
    <div><strong>Location:</strong> ${escapeHtml(location)}</div>
    ${material.file_type !== "mcq" && material.file_type !== "essay" ? `<div><strong>Instruction:</strong> ${escapeHtml(material.instruction || "-")}</div>` : ""}
  `;

  if (!preview) return;
  preview.innerHTML = "";

  if (material.file_type === "pdf" && material.file_path) {
    const src = getPublicMaterialUrl(material.file_path);
    preview.innerHTML = `
      <div class="pdf-container d-flex flex-column gap-2 p-2 bg-light rounded" style="border-radius:12px;">
        <div class="d-flex justify-content-between align-items-center px-1">
          <span class="text-secondary small fw-semibold">PDF Viewer</span>
          <button id="pdfFullscreenBtn" class="btn btn-outline-primary btn-xs py-1 px-2 d-flex align-items-center gap-1" style="font-size:0.75rem; border-radius:8px;">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>
            </svg>
            Fullscreen
          </button>
        </div>
        <iframe id="pdfIframe" title="Material PDF" src="${src}" allowfullscreen style="border-radius:8px; border:1px solid #d9e2ef; height:480px; width:100%;"></iframe>
      </div>
    `;
    el("pdfFullscreenBtn")?.addEventListener("click", () => {
      const iframe = el("pdfIframe");
      if (!iframe) return;
      if (iframe.requestFullscreen) {
        iframe.requestFullscreen();
      } else if (iframe.webkitRequestFullscreen) {
        iframe.webkitRequestFullscreen();
      } else if (iframe.msRequestFullscreen) {
        iframe.msRequestFullscreen();
      }
    });
  } else if ((material.file_type === "video" || material.file_type === "link") && material.external_url) {
    const embed = getEmbedUrl(material.external_url);
    if (embed) {
      preview.innerHTML = `<iframe title="Material Video" src="${escapeHtml(embed)}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>`;
    } else {
      const href = escapeHtml(material.external_url);
      preview.innerHTML = `
        <div class="d-flex flex-column gap-2 p-2 border rounded bg-white">
          <div class="text-body-secondary small">This link cannot be embedded, so it is shown below.</div>
          <a href="${href}" target="_blank" rel="noopener noreferrer" class="btn btn-outline-primary btn-sm align-self-start">Open link</a>
        </div>
      `;
    }
  } else {
    // MCQ and Essay questions group rendering
    const group = getSelectedStudentMaterialGroup();
    const submissions = await Promise.all(
      group.map(async (item) => {
        try {
          const resp = await apiFetch(`/materials/${item.id}/submission`);
          if (resp.ok) {
            return await resp.json().catch(() => null);
          }
        } catch (e) {
          console.error(e);
        }
        return null;
      })
    );

    if (material.file_type === "essay") {
      let htmlContent = `
        <div class="m-2 p-2">
          <h3 class="h5 mb-3 text-primary fw-bold">📝 Essay Questions: ${escapeHtml(getBaseTitle(material.title))}</h3>
      `;

      group.forEach((item, index) => {
        const submission = submissions[index];
        let previousAnswer = "";
        let submissionStatusHTML = "";
        if (submission) {
          previousAnswer = submission.answer || "";
          let badgeClass = "bg-warning text-dark";
          let badgeText = "Pending Teacher Review";
          if (submission.is_correct === true) {
            badgeClass = "bg-success";
            badgeText = "Reviewed — Correct";
          } else if (submission.is_correct === false) {
            badgeClass = "bg-danger";
            badgeText = "Reviewed — Incorrect";
          }
          submissionStatusHTML = `
            <div class="alert alert-info p-2 mb-3 small d-flex justify-content-between align-items-center" style="border-radius:12px;">
              <span>Status: <span class="badge ${badgeClass}">${badgeText}</span></span>
              <span class="text-muted" style="font-size:0.7rem;">${new Date(submission.submitted_at).toLocaleString()}</span>
            </div>
          `;
        }

        htmlContent += `
          <div class="p-3 border rounded bg-white mb-4 animate-fade-in" style="border-radius:16px !important; box-shadow: 0 4px 12px rgba(0,0,0,0.02);">
            <h4 class="h6 mb-2 text-secondary fw-semibold">Question ${index + 1} of ${group.length}</h4>
            ${submissionStatusHTML}
            <div class="p-3 bg-light rounded mb-3 border-start border-primary border-3" style="font-size: 0.85rem; border-radius:12px !important;">
              <span style="white-space: pre-wrap;">${escapeHtml(item.instruction || "")}</span>
            </div>
            <div class="mb-3">
              <label for="studentEssayAnswer_${item.id}" class="form-label small fw-semibold text-muted">Your Written Answer</label>
              <textarea id="studentEssayAnswer_${item.id}" class="form-control" rows="4" style="border-radius:12px;" placeholder="Type your answer here...">${escapeHtml(previousAnswer)}</textarea>
            </div>
            <button id="studentSubmitAnswerBtn_${item.id}" class="btn btn-primary btn-sm px-4" style="border-radius:10px;">Submit Answer</button>
          </div>
        `;
      });

      htmlContent += `</div>`;
      preview.innerHTML = htmlContent;

      group.forEach((item) => {
        el(`studentSubmitAnswerBtn_${item.id}`)?.addEventListener("click", () => submitGroupAnswer(item.id, "essay"));
      });

    } else if (material.file_type === "mcq") {
      let htmlContent = `
        <div class="m-2 p-2">
          <h3 class="h5 mb-3 text-primary fw-bold">🎯 MCQ Quiz: ${escapeHtml(getBaseTitle(material.title))}</h3>
      `;

      group.forEach((item, index) => {
        const submission = submissions[index];
        
        let parsedOptions = [];
        if (item.options) {
          try {
            parsedOptions = JSON.parse(item.options);
          } catch (e) {
            console.error("Failed to parse options", e);
          }
        }

        const optionLabels = ["A", "B", "C", "D", "E"];
        let optionsListHTML = "";
        const isDisabled = submission ? "disabled" : "";

        parsedOptions.forEach((optionText, idx) => {
          const label = optionLabels[idx] || String(idx + 1);
          const isChecked = submission && submission.answer === label ? "checked" : "";
          optionsListHTML += `
            <div class="form-check mb-2">
              <input class="form-check-input" type="radio" name="mcqOptionRadio_${item.id}" id="radio_${item.id}_${label}" value="${label}" ${isChecked} ${isDisabled}>
              <label class="form-check-label" for="radio_${item.id}_${label}" style="cursor:pointer;">
                <strong>Option ${label}:</strong> ${escapeHtml(optionText)}
              </label>
            </div>
          `;
        });

        let submissionStatusHTML = "";
        if (submission) {
          if (submission.is_correct) {
            submissionStatusHTML = `
              <div class="alert alert-success p-2 mb-3 small" style="border-radius:12px;">
                🎉 <strong>Correct!</strong> Your answer of Option ${escapeHtml(submission.answer)} is correct.
                ${item.explanation ? `<div class="mt-1"><strong>Explanation:</strong> ${escapeHtml(item.explanation)}</div>` : ""}
              </div>
            `;
          } else {
            submissionStatusHTML = `
              <div class="alert alert-danger p-2 mb-3 small" style="border-radius:12px;">
                ❌ <strong>Incorrect.</strong> You chose Option ${escapeHtml(submission.answer)}.
                <div class="mt-1">The correct answer is Option ${escapeHtml(item.correct_answer)}.</div>
                ${item.explanation ? `<div class="mt-1"><strong>Explanation:</strong> ${escapeHtml(item.explanation)}</div>` : ""}
              </div>
            `;
          }
        }

        htmlContent += `
          <div class="p-3 border rounded bg-white mb-4 animate-fade-in" style="border-radius:16px !important; box-shadow: 0 4px 12px rgba(0,0,0,0.02);">
            <h4 class="h6 mb-2 text-secondary fw-semibold">Question ${index + 1} of ${group.length}</h4>
            ${submissionStatusHTML}
            <div class="p-3 bg-light rounded mb-3 border-start border-primary border-3" style="font-size: 0.85rem; border-radius:12px !important;">
              <span style="white-space: pre-wrap;">${escapeHtml(item.instruction || "")}</span>
            </div>
            <div class="mb-3">
              <label class="form-label small fw-semibold text-muted mb-2">Select Your Option:</label>
              <div class="mcq-options-container p-3 border rounded bg-light-subtle" style="border-radius:12px;">
                ${optionsListHTML}
              </div>
            </div>
            <button id="studentSubmitAnswerBtn_${item.id}" class="btn btn-primary btn-sm px-4 submit-choice-btn" style="border-radius:10px;" ${submission ? "disabled" : ""}>Submit Choice</button>
          </div>
        `;
      });

      htmlContent += `</div>`;
      preview.innerHTML = htmlContent;

      group.forEach((item) => {
        el(`studentSubmitAnswerBtn_${item.id}`)?.addEventListener("click", () => submitGroupAnswer(item.id, "mcq"));
      });
    }
  }
}

async function submitGroupAnswer(materialId, type) {
  let answer = "";
  if (type === "essay") {
    answer = (el(`studentEssayAnswer_${materialId}`)?.value || "").trim();
    if (!answer) {
      showMessage("Please write an answer before submitting.");
      return;
    }
  } else if (type === "mcq") {
    const selectedRadio = document.querySelector(`input[name="mcqOptionRadio_${materialId}"]:checked`);
    if (!selectedRadio) {
      showMessage("Please select an option before submitting.");
      return;
    }
    answer = selectedRadio.value;
  }

  try {
    const resp = await apiFetch(`/materials/${materialId}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answer: answer }),
    });

    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      throw new Error(data.detail || "Submission failed");
    }

    showMessage("Answer submitted successfully!", "success");
    await renderSelectedMaterialDetail();
  } catch (err) {
    showMessage(err.message);
  }
}

async function submitStudentAnswer(type) {
  const material = getSelectedStudentMaterial();
  if (!material) return;

  let answer = "";
  if (type === "essay") {
    answer = (el("studentEssayAnswer")?.value || "").trim();
    if (!answer) {
      showMessage("Please write an answer before submitting.");
      return;
    }
  } else if (type === "mcq") {
    const selectedRadio = document.querySelector('input[name="mcqOptionRadio"]:checked');
    if (!selectedRadio) {
      showMessage("Please select an option before submitting.");
      return;
    }
    answer = selectedRadio.value;
  }

  try {
    const resp = await apiFetch(`/materials/${material.id}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answer: answer }),
    });

    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      throw new Error(data.detail || "Submission failed");
    }

    showMessage("Answer submitted successfully!", "success");
    await renderSelectedMaterialDetail();
  } catch (err) {
    showMessage(err.message);
  }
}

function getPublicMaterialUrl(rawPath) {
  if (!rawPath) return "";
  const cleaned = String(rawPath).trim();
  if (/^https?:\/\//i.test(cleaned) || cleaned.startsWith("/uploads/")) {
    return encodeURI(cleaned);
  }
  const withoutLeadingDot = cleaned.replace(/^\.\//, "");
  if (withoutLeadingDot.startsWith("uploads/")) {
    return encodeURI(`/${withoutLeadingDot}`);
  }
  return encodeURI(cleaned);
}

function getEmbedUrl(rawUrl) {
  if (!rawUrl) return null;
  try {
    const url = new URL(rawUrl, window.location.origin);
    const hostname = url.hostname.replace(/^www\./, "");

    if (hostname === "youtube.com" || hostname === "m.youtube.com") {
      const videoId = url.searchParams.get("v");
      if (videoId) return `https://www.youtube.com/embed/${encodeURIComponent(videoId)}`;
    }

    if (hostname === "youtu.be") {
      const videoId = url.pathname.split("/").filter(Boolean)[0];
      if (videoId) return `https://www.youtube.com/embed/${encodeURIComponent(videoId)}`;
    }

    if (hostname === "youtube.com" && url.pathname.startsWith("/embed/")) {
      return url.toString();
    }

    return rawUrl;
  } catch (_err) {
    return null;
  }
}

async function loadCommentsForSelectedMaterial() {
  const material = getSelectedStudentMaterial();
  if (!material) {
    renderComments([]);
    return;
  }

  const resp = await apiFetch(`/materials/${material.id}/comments`);
  const data = await resp.json().catch(() => []);
  if (!resp.ok) throw new Error(data.detail || "Failed to load comments");
  renderComments(data);
}

function renderComments(items) {
  const container = el("commentsList");
  if (!container) return;
  const rows = Array.isArray(items) ? items : [];
  if (!rows.length) {
    container.innerHTML = '<div class="text-body-secondary">No comments yet.</div>';
    return;
  }

  container.innerHTML = rows
    .map(
      (item) => `
      <div class="border rounded p-2 mb-2">
        <div class="small text-body-secondary">${escapeHtml(item.user_name)} (${escapeHtml(item.user_role)}) • ${new Date(item.created_at).toLocaleString()}</div>
        <div>${escapeHtml(item.comment_text)}</div>
      </div>
    `
    )
    .join("");
}

async function loadLastOpenedBadge() {
  const badge = el("lastOpenedBadge");
  if (!badge) return;
  const resp = await apiFetch("/materials/last-opened");
  const data = await resp.json().catch(() => null);
  if (!resp.ok) throw new Error(data.detail || "Failed to load last opened material");
  if (!data) {
    badge.textContent = "Last opened: none";
    return;
  }
  badge.textContent = `Last opened: ${data.title}`;

  const selected = el("studentMaterials");
  if (selected && Number(selected.value || 0) === data.material_id) {
    badge.classList.remove("text-bg-primary");
    badge.classList.add("text-bg-success");
  } else {
    badge.classList.remove("text-bg-success");
    badge.classList.add("text-bg-primary");
  }
}

async function initTeacherPage() {
  await teacherLoadMaterials();
  await teacherLoadDashboard();

  el("teacherMaterialType")?.addEventListener("change", toggleTeacherUploadInputs);
  el("addMcqQuestionBtn")?.addEventListener("click", addMcqQuestionBlock);
  el("addEssayQuestionBtn")?.addEventListener("click", addEssayQuestionBlock);
  toggleTeacherUploadInputs();

  el("teacherTopRefreshBtn")?.addEventListener("click", async () => {
    await teacherLoadDashboard(teacherSelectedStudentId);
  });

  el("refreshTeacherDashboardBtn")?.addEventListener("click", async () => {
    await teacherLoadDashboard(teacherSelectedStudentId);
  });

  el("teacherMaterialFilter")?.addEventListener("change", async () => {
    teacherSelectedStudentId = Number(el("teacherStudentFilter")?.value || teacherSelectedStudentId || 0) || null;
    await teacherLoadDashboard(teacherSelectedStudentId);
  });

  el("teacherStudentFilter")?.addEventListener("change", async () => {
    teacherSelectedStudentId = Number(el("teacherStudentFilter")?.value || 0) || null;
    await teacherLoadStudentReport(teacherSelectedStudentId);
  });

  el("teacherUploadBtn")?.addEventListener("click", async () => {
    try {
      const type = el("teacherMaterialType")?.value || "pdf";
      const title = (el("teacherTitle")?.value || "").trim();
      const subject = (el("teacherSubject")?.value || "").trim();
      const instruction = (el("teacherInstruction")?.value || "").trim();

      if (!title || !subject) {
        throw new Error("Title and Subject are required");
      }

      const durationValue = (el("teacherDuration")?.value || "").trim();

      if (type === "mcq") {
        const questionCards = document.querySelectorAll(".question-block-card");
        if (questionCards.length === 0) {
          throw new Error("Please add at least one question.");
        }

        const questionsData = [];
        for (let i = 0; i < questionCards.length; i++) {
          const card = questionCards[i];
          const qText = (card.querySelector(".q-text")?.value || "").trim();
          const optA = (card.querySelector(".q-opt-a")?.value || "").trim();
          const optB = (card.querySelector(".q-opt-b")?.value || "").trim();
          const optC = (card.querySelector(".q-opt-c")?.value || "").trim();
          const optD = (card.querySelector(".q-opt-d")?.value || "").trim();
          const optE = (card.querySelector(".q-opt-e")?.value || "").trim();
          const correct = card.querySelector(".q-correct")?.value || "A";
          const explanation = (card.querySelector(".q-explanation")?.value || "").trim();

          if (!qText) {
            throw new Error(`Question #${i + 1}: Question text is required.`);
          }
          if (!optA || !optB) {
            throw new Error(`Question #${i + 1}: Option A and Option B are required.`);
          }

          const optionsArray = [optA, optB];
          if (optC) optionsArray.push(optC);
          if (optD) optionsArray.push(optD);
          if (optE) optionsArray.push(optE);

          if (correct === "C" && !optC) throw new Error(`Question #${i + 1}: Correct option selected (Option C) is empty.`);
          if (correct === "D" && !optD) throw new Error(`Question #${i + 1}: Correct option selected (Option D) is empty.`);
          if (correct === "E" && !optE) throw new Error(`Question #${i + 1}: Correct option selected (Option E) is empty.`);

          questionsData.push({
            instruction: qText,
            options: JSON.stringify(optionsArray),
            correct_answer: correct,
            explanation: explanation
          });
        }

        showMessage("Uploading questions...", "info");

        let lastUploadedId = null;
        for (let i = 0; i < questionsData.length; i++) {
          const q = questionsData[i];
          const suffix = questionsData.length > 1 ? ` (Q${i + 1})` : "";
          
          const fd = new FormData();
          fd.append("title", `${title}${suffix}`);
          fd.append("subject", subject);
          fd.append("material_type", "mcq");
          fd.append("instruction", q.instruction);
          fd.append("options", q.options);
          fd.append("correct_answer", q.correct_answer);
          if (q.explanation) fd.append("explanation", q.explanation);
          if (durationValue) fd.append("duration_minutes", durationValue);

          const resp = await apiFetch("/materials/upload", { method: "POST", body: fd });
          const data = await resp.json().catch(() => ({}));
          if (!resp.ok) {
            throw new Error(`Failed to upload Question #${i + 1}: ${data.detail || "Upload failed"}`);
          }
          lastUploadedId = data.id;
        }

        showMessage(`Successfully uploaded ${questionsData.length} MCQ question(s).`, "success");

        initMcqQuestionsList();
        if (el("teacherTitle")) el("teacherTitle").value = "";
        if (el("teacherSubject")) el("teacherSubject").value = "";
        if (el("teacherDuration")) el("teacherDuration").value = "";

        await teacherLoadMaterials(lastUploadedId);
        await teacherLoadDashboard(teacherSelectedStudentId);
        return;
      } else if (type === "essay") {
        const questionCards = document.querySelectorAll(".essay-question-block-card");
        if (questionCards.length === 0) {
          throw new Error("Please add at least one essay question.");
        }

        const questionsData = [];
        for (let i = 0; i < questionCards.length; i++) {
          const card = questionCards[i];
          const qText = (card.querySelector(".q-text")?.value || "").trim();
          const explanation = (card.querySelector(".q-explanation")?.value || "").trim();

          if (!qText) {
            throw new Error(`Question #${i + 1}: Essay Question text is required.`);
          }

          questionsData.push({
            instruction: qText,
            explanation: explanation
          });
        }

        showMessage("Uploading essay questions...", "info");

        let lastUploadedId = null;
        for (let i = 0; i < questionsData.length; i++) {
          const q = questionsData[i];
          const suffix = questionsData.length > 1 ? ` (Q${i + 1})` : "";
          
          const fd = new FormData();
          fd.append("title", `${title}${suffix}`);
          fd.append("subject", subject);
          fd.append("material_type", "essay");
          fd.append("instruction", q.instruction);
          if (q.explanation) fd.append("explanation", q.explanation);
          if (durationValue) fd.append("duration_minutes", durationValue);

          const resp = await apiFetch("/materials/upload", { method: "POST", body: fd });
          const data = await resp.json().catch(() => ({}));
          if (!resp.ok) {
            throw new Error(`Failed to upload Question #${i + 1}: ${data.detail || "Upload failed"}`);
          }
          lastUploadedId = data.id;
        }

        showMessage(`Successfully uploaded ${questionsData.length} Essay question(s).`, "success");

        initEssayQuestionsList();
        if (el("teacherTitle")) el("teacherTitle").value = "";
        if (el("teacherSubject")) el("teacherSubject").value = "";
        if (el("teacherDuration")) el("teacherDuration").value = "";

        await teacherLoadMaterials(lastUploadedId);
        await teacherLoadDashboard(teacherSelectedStudentId);
        return;
      }

      const fd = new FormData();
      fd.append("title", title);
      fd.append("subject", subject);
      fd.append("material_type", type);
      fd.append("instruction", instruction);

      if (durationValue) fd.append("duration_minutes", durationValue);

      if (type === "pdf") {
        const file = el("teacherFile")?.files?.[0];
        if (!file) throw new Error("Please choose a PDF file");
        fd.append("file", file);
      } else if (type === "video") {
        const url = (el("teacherExternalUrl")?.value || "").trim();
        if (!url) throw new Error("Please provide a valid video link URL");
        fd.append("external_url", url);
      }

      const resp = await apiFetch("/materials/upload", { method: "POST", body: fd });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data.detail || "Upload failed");
      showMessage("Material uploaded.", "success");

      // Clear fields
      if (el("teacherTitle")) el("teacherTitle").value = "";
      if (el("teacherSubject")) el("teacherSubject").value = "";
      if (el("teacherInstruction")) el("teacherInstruction").value = "";
      if (el("teacherDuration")) el("teacherDuration").value = "";
      if (el("teacherExternalUrl")) el("teacherExternalUrl").value = "";
      if (el("teacherFile")) el("teacherFile").value = "";
      if (el("teacherExplanation")) el("teacherExplanation").value = "";

      await teacherLoadMaterials(data.id);
      await teacherLoadDashboard(teacherSelectedStudentId);
    } catch (err) {
      showMessage(err.message);
    }
  });

  el("loadTeacherMaterialBtn")?.addEventListener("click", () => {
    teacherFillEditForm();
  });

  el("saveMaterialEditBtn")?.addEventListener("click", async () => {
    const material = getTeacherSelectedMaterial();
    if (!material) {
      showMessage("Select a material first.");
      return;
    }
    try {
      const title = (el("editTitle")?.value || "").trim();
      const subject = (el("editSubject")?.value || "").trim();
      if (!title || !subject) {
        throw new Error("Title and Subject are required");
      }
      const durationRaw = (el("editDuration")?.value || "").trim();
      const duration = durationRaw ? Number(durationRaw) : null;

      const type = material.file_type;
      if (type === "mcq" || type === "essay") {
        const editCards = document.querySelectorAll(".edit-question-card");
        if (editCards.length === 0) {
          throw new Error("No question cards found.");
        }

        const updates = [];
        for (let i = 0; i < editCards.length; i++) {
          const card = editCards[i];
          const id = Number(card.dataset.id);
          const qText = (card.querySelector(".eq-text")?.value || "").trim();
          const explanation = (card.querySelector(".eq-explanation")?.value || "").trim();

          if (!qText) {
            throw new Error(`Question #${i + 1}: Question text is required.`);
          }

          const payload = {
            title: editCards.length > 1 ? `${title} (Q${i + 1})` : title,
            subject: subject,
            duration_minutes: duration,
            instruction: qText,
            explanation: explanation
          };

          if (type === "mcq") {
            const optA = (card.querySelector(".eq-opt-a")?.value || "").trim();
            const optB = (card.querySelector(".eq-opt-b")?.value || "").trim();
            const optC = (card.querySelector(".eq-opt-c")?.value || "").trim();
            const optD = (card.querySelector(".eq-opt-d")?.value || "").trim();
            const optE = (card.querySelector(".eq-opt-e")?.value || "").trim();
            const correct = card.querySelector(".eq-correct")?.value || "A";

            if (!optA || !optB) {
              throw new Error(`Question #${i + 1}: Option A and Option B are required.`);
            }

            const optionsArray = [optA, optB];
            if (optC) optionsArray.push(optC);
            if (optD) optionsArray.push(optD);
            if (optE) optionsArray.push(optE);

            if (correct === "C" && !optC) throw new Error(`Question #${i + 1}: Correct option selected (Option C) is empty.`);
            if (correct === "D" && !optD) throw new Error(`Question #${i + 1}: Correct option selected (Option D) is empty.`);
            if (correct === "E" && !optE) throw new Error(`Question #${i + 1}: Correct option selected (Option E) is empty.`);

            payload.options = JSON.stringify(optionsArray);
            payload.correct_answer = correct;
          }

          updates.push({ id, payload });
        }

        showMessage("Saving updates...", "info");

        for (const u of updates) {
          const resp = await apiFetch(`/materials/${u.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(u.payload),
          });
          const data = await resp.json().catch(() => ({}));
          if (!resp.ok) {
            throw new Error(`Failed to update Question: ${data.detail || "Update failed"}`);
          }
        }

        showMessage("All questions updated successfully.", "success");
        await teacherLoadMaterials(material.id);
        await teacherLoadComments();
        await teacherLoadDashboard(teacherSelectedStudentId);
        return;
      }

      const payload = {
        title: title,
        subject: subject,
        instruction: (el("editInstruction")?.value || "").trim(),
        duration_minutes: duration
      };

      if (type === "video" || type === "link") {
        const externalUrl = (el("editExternalUrl")?.value || "").trim();
        if (externalUrl) payload.external_url = externalUrl;
      }

      const resp = await apiFetch(`/materials/${material.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data.detail || "Update failed");
      showMessage("Material updated.", "success");
      await teacherLoadMaterials(material.id);
      await teacherLoadComments();
      await teacherLoadDashboard(teacherSelectedStudentId);
    } catch (err) {
      showMessage(err.message);
    }
  });

  el("deleteMaterialBtn")?.addEventListener("click", async () => {
    const material = getTeacherSelectedMaterial();
    if (!material) {
      showMessage("Please select a material first.");
      return;
    }
    if (!confirm(`Are you sure you want to delete the material "${material.title}"?`)) {
      return;
    }
    try {
      const resp = await apiFetch(`/materials/${material.id}`, {
        method: "DELETE",
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data.detail || "Deletion failed");
      showMessage("Material deleted successfully.", "success");
      await teacherLoadMaterials();
      await teacherLoadComments();
      await teacherLoadDashboard(teacherSelectedStudentId);
    } catch (err) {
      showMessage(err.message);
    }
  });

  el("previewMaterialBtn")?.addEventListener("click", () => {
    const material = getTeacherSelectedMaterial();
    if (!material) {
      showMessage("Please select a material first.");
      return;
    }

    const previewBody = el("previewMaterialModalBody");
    if (!previewBody) return;
    previewBody.innerHTML = "";

    const infoDiv = document.createElement("div");
    infoDiv.className = "mb-3 p-3 bg-light rounded small";
    infoDiv.innerHTML = `
      <div><strong>Title:</strong> ${escapeHtml(material.title || "")}</div>
      <div><strong>Subject:</strong> ${escapeHtml(material.subject || "")}</div>
      <div><strong>Type:</strong> ${escapeHtml(material.file_type ? material.file_type.toUpperCase() : "")}</div>
      ${material.file_type !== "mcq" && material.file_type !== "essay" ? `<div><strong>Instruction:</strong> ${escapeHtml(material.instruction || "-")}</div>` : ""}
    `;
    previewBody.appendChild(infoDiv);

    const previewContent = document.createElement("div");
    if (material.file_type === "pdf" && material.file_path) {
      const src = getPublicMaterialUrl(material.file_path);
      previewContent.innerHTML = `
        <div class="pdf-container d-flex flex-column gap-2 p-2 bg-light rounded" style="border-radius:12px;">
          <div class="d-flex justify-content-between align-items-center px-1">
            <span class="text-secondary small fw-semibold">PDF Viewer Preview</span>
            <button id="pdfFullscreenBtnPreview" class="btn btn-outline-primary btn-xs py-1 px-2 d-flex align-items-center gap-1" style="font-size:0.75rem; border-radius:8px;">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>
              </svg>
              Fullscreen
            </button>
          </div>
          <iframe id="pdfIframePreview" title="Material PDF" src="${src}" allowfullscreen style="border-radius:8px; border:1px solid #d9e2ef; height:480px; width:100%;"></iframe>
        </div>
      `;
      setTimeout(() => {
        el("pdfFullscreenBtnPreview")?.addEventListener("click", () => {
          const iframe = el("pdfIframePreview");
          if (!iframe) return;
          if (iframe.requestFullscreen) {
            iframe.requestFullscreen();
          } else if (iframe.webkitRequestFullscreen) {
            iframe.webkitRequestFullscreen();
          } else if (iframe.msRequestFullscreen) {
            iframe.msRequestFullscreen();
          }
        });
      }, 0);
    } else if ((material.file_type === "video" || material.file_type === "link") && material.external_url) {
      const embed = getEmbedUrl(material.external_url);
      if (embed) {
        previewContent.innerHTML = `<iframe title="Material Video" src="${escapeHtml(embed)}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen style="width:100%; height:400px; border:none;"></iframe>`;
      } else {
        const href = escapeHtml(material.external_url);
        previewContent.innerHTML = `
          <div class="p-3 border rounded bg-white text-center">
            <div class="text-body-secondary small mb-2">This external link cannot be embedded directly.</div>
            <a href="${href}" target="_blank" rel="noopener noreferrer" class="btn btn-outline-primary btn-sm">Open link in new tab</a>
          </div>
        `;
      }
    } else if (material.file_type === "essay") {
      previewContent.innerHTML = `
        <div class="p-3 border rounded bg-white">
          <h4 class="h6 mb-3 text-primary fw-bold">📝 Essay Question</h4>
          <div class="p-3 bg-light rounded mb-3 border-start border-primary border-3" style="font-size: 0.85rem;">
            <strong>Question:</strong><br/>
            <span style="white-space: pre-wrap;">${escapeHtml(material.instruction || "")}</span>
          </div>
          <div class="mb-3">
            <label class="form-label small fw-semibold text-muted">Student Answer Area (Preview Only)</label>
            <textarea class="form-control" rows="3" disabled placeholder="Students will see their essay textbox here..."></textarea>
          </div>
        </div>
      `;
    } else if (material.file_type === "mcq") {
      let parsedOptions = [];
      if (material.options) {
        try {
          parsedOptions = JSON.parse(material.options);
        } catch (e) {
          console.error("Failed to parse options", e);
        }
      }

      const optionLabels = ["A", "B", "C", "D", "E"];
      let optionsListHTML = "";

      parsedOptions.forEach((optionText, idx) => {
        const label = optionLabels[idx] || String(idx + 1);
        optionsListHTML += `
          <div class="form-check mb-2">
            <input class="form-check-input" type="radio" name="mcqOptionRadioPreview" id="radio_preview_${label}" disabled>
            <label class="form-check-label" for="radio_preview_${label}">
              <strong>Option ${label}:</strong> ${escapeHtml(optionText)}
            </label>
          </div>
        `;
      });

      previewContent.innerHTML = `
        <div class="p-3 border rounded bg-white">
          <h4 class="h6 mb-3 text-primary fw-bold">🎯 Multiple Choice Question</h4>
          <div class="p-3 bg-light rounded mb-3 border-start border-primary border-3" style="font-size: 0.85rem;">
            <strong>Question:</strong><br/>
            <span style="white-space: pre-wrap;">${escapeHtml(material.instruction || "")}</span>
          </div>
          <div class="mb-3">
            ${optionsListHTML}
          </div>
          <div class="alert alert-success p-2 small mb-0">
            <strong>Correct Answer:</strong> Option ${escapeHtml(material.correct_answer || "A")}
            ${material.explanation ? `<div class="mt-1"><strong>Explanation:</strong> ${escapeHtml(material.explanation)}</div>` : ""}
          </div>
        </div>
      `;
    } else {
      previewContent.textContent = "No preview available for this material type.";
    }

    previewBody.appendChild(previewContent);

    const modalElement = el("previewMaterialModal");
    if (modalElement && typeof bootstrap !== "undefined") {
      const modal = new bootstrap.Modal(modalElement);
      modal.show();
    }
  });

  el("viewSubmissionsBtn")?.addEventListener("click", async () => {
    const material = getTeacherSelectedMaterial();
    if (!material) {
      showMessage("Please select a material first.");
      return;
    }

    const tableBody = el("submissionsModalTableBody");
    if (!tableBody) return;
    tableBody.innerHTML = '<tr><td colspan="5" class="text-center">Loading submissions...</td></tr>';

    try {
      const resp = await apiFetch(`/materials/${material.id}/submissions`);
      const list = await resp.json().catch(() => []);
      if (!resp.ok) throw new Error(list.detail || "Failed to load submissions");

      if (list.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">No student submissions yet for this material.</td></tr>';
      } else {
        tableBody.innerHTML = list
          .map((sub) => {
            const isMcq = material.file_type === "mcq";
            const isEssay = material.file_type === "essay";

            let statusBadge = "";
            let gradingControls = "";

            if (isMcq) {
              statusBadge = sub.is_correct
                ? '<span class="badge bg-success">Correct</span>'
                : '<span class="badge bg-danger">Incorrect</span>';
            } else if (isEssay) {
              if (sub.is_correct === true) {
                statusBadge = '<span class="badge bg-success">Correct</span>';
              } else if (sub.is_correct === false) {
                statusBadge = '<span class="badge bg-danger">Incorrect</span>';
              } else {
                statusBadge = '<span class="badge bg-warning text-dark">Pending Review</span>';
              }
              gradingControls = `
                <div class="mt-1 d-flex gap-1">
                  <button class="btn btn-xs btn-outline-success py-0 px-1" style="font-size: 0.65rem;" onclick="teacherGradeModalSubmission(${sub.id}, true, ${material.id})">✓ Correct</button>
                  <button class="btn btn-xs btn-outline-danger py-0 px-1" style="font-size: 0.65rem;" onclick="teacherGradeModalSubmission(${sub.id}, false, ${material.id})">✗ Incorrect</button>
                </div>
              `;
            }

            return `
              <tr>
                <td><strong>${escapeHtml(sub.student_name)}</strong></td>
                <td class="small text-muted">${escapeHtml(sub.student_email)}</td>
                <td class="small text-muted">${new Date(sub.submitted_at).toLocaleString()}</td>
                <td>
                  <div class="p-1 rounded text-dark" style="background-color: #f8fafc; font-size: 0.78rem; border-left: 2px solid #cbd5e1; white-space: pre-wrap; max-width: 300px; max-height: 100px; overflow-y: auto;">
                    ${escapeHtml(sub.answer)}
                  </div>
                </td>
                <td>
                  <div>${statusBadge}</div>
                  ${gradingControls}
                </td>
              </tr>
            `;
          })
          .join("");
      }

      const modalElement = el("submissionsModal");
      if (modalElement && typeof bootstrap !== "undefined") {
        const modal = new bootstrap.Modal(modalElement);
        modal.show();
      }
    } catch (err) {
      showMessage(err.message);
    }
  });

  window.teacherGradeModalSubmission = async function (submissionId, isCorrect, materialId) {
    try {
      const resp = await apiFetch(`/submissions/${submissionId}/grade`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_correct: isCorrect }),
      });
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        throw new Error(data.detail || "Failed to grade submission");
      }
      showMessage("Submission graded successfully.", "success");
      el("viewSubmissionsBtn")?.click();
      if (teacherSelectedStudentId) {
        await teacherLoadStudentReport(teacherSelectedStudentId);
      }
    } catch (err) {
      showMessage(err.message);
    }
  };

  el("loadTeacherCommentsBtn")?.addEventListener("click", teacherLoadComments);
  el("teacherMaterialSelect")?.addEventListener("change", async () => {
    teacherFillEditForm();
    await teacherLoadComments();
    await teacherLoadDashboard(teacherSelectedStudentId);
  });

  teacherFillEditForm();
  await teacherLoadComments();
}

let essayQuestionCounter = 0;

function createEssayQuestionBlockHTML(index) {
  return `
    <div class="card p-3 border border-secondary-subtle bg-light-subtle essay-question-block-card animate-fade-in" data-index="${index}" style="border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
      <div class="d-flex justify-content-between align-items-center mb-2">
        <strong class="text-primary-emphasis small">Question #${index + 1}</strong>
        <button type="button" class="btn btn-outline-danger btn-xs py-0 px-2 remove-essay-question-btn" style="font-size: 0.7rem;" onclick="removeEssayQuestionBlock(${index})">Remove</button>
      </div>
      <div class="row g-2">
        <div class="col-12">
          <label class="form-label small mb-1 fw-semibold text-muted">Essay Question / Instruction</label>
          <textarea class="form-control form-control-sm q-text" rows="2" placeholder="Enter the essay question..."></textarea>
        </div>
        <div class="col-12">
          <label class="form-label small mb-1 fw-semibold text-muted">Explanation / Description</label>
          <textarea class="form-control form-control-sm q-explanation" rows="1" placeholder="Optional explanation or description..."></textarea>
        </div>
      </div>
    </div>
  `;
}

function addEssayQuestionBlock() {
  const container = el("essayQuestionsList");
  if (!container) return;

  const div = document.createElement("div");
  div.innerHTML = createEssayQuestionBlockHTML(essayQuestionCounter);
  container.appendChild(div.firstElementChild);
  essayQuestionCounter++;

  updateEssayQuestionNumbers();
}

function removeEssayQuestionBlock(index) {
  const card = document.querySelector(`.essay-question-block-card[data-index="${index}"]`);
  if (card) {
    card.remove();
    updateEssayQuestionNumbers();
  }
}

function updateEssayQuestionNumbers() {
  const cards = document.querySelectorAll(".essay-question-block-card");
  cards.forEach((card, idx) => {
    const strong = card.querySelector("strong");
    if (strong) {
      strong.textContent = `Question #${idx + 1}`;
    }
    const removeBtn = card.querySelector(".remove-essay-question-btn");
    if (removeBtn) {
      removeBtn.style.display = cards.length > 1 ? "" : "none";
    }
  });
}

function initEssayQuestionsList() {
  const container = el("essayQuestionsList");
  if (!container) return;
  container.innerHTML = "";
  essayQuestionCounter = 0;
  addEssayQuestionBlock();
}

window.removeEssayQuestionBlock = removeEssayQuestionBlock;

let mcqQuestionCounter = 0;

function createQuestionBlockHTML(index) {
  return `
    <div class="card p-3 border border-secondary-subtle bg-light-subtle question-block-card animate-fade-in" data-index="${index}" style="border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
      <div class="d-flex justify-content-between align-items-center mb-2">
        <strong class="text-primary-emphasis small">Question #${index + 1}</strong>
        <button type="button" class="btn btn-outline-danger btn-xs py-0 px-2 remove-question-btn" style="font-size: 0.7rem;" onclick="removeMcqQuestionBlock(${index})">Remove</button>
      </div>
      <div class="row g-2">
        <div class="col-12">
          <label class="form-label small mb-1 fw-semibold text-muted">Question Text</label>
          <textarea class="form-control form-control-sm q-text" rows="2" placeholder="Enter the question text..."></textarea>
        </div>
        <div class="col-6 col-md-4">
          <label class="form-label small mb-1 fw-semibold text-muted">Option A</label>
          <input class="form-control form-control-sm q-opt-a" type="text" placeholder="Option A" />
        </div>
        <div class="col-6 col-md-4">
          <label class="form-label small mb-1 fw-semibold text-muted">Option B</label>
          <input class="form-control form-control-sm q-opt-b" type="text" placeholder="Option B" />
        </div>
        <div class="col-6 col-md-4">
          <label class="form-label small mb-1 fw-semibold text-muted">Option C (Optional)</label>
          <input class="form-control form-control-sm q-opt-c" type="text" placeholder="Option C" />
        </div>
        <div class="col-6 col-md-4">
          <label class="form-label small mb-1 fw-semibold text-muted">Option D (Optional)</label>
          <input class="form-control form-control-sm q-opt-d" type="text" placeholder="Option D" />
        </div>
        <div class="col-6 col-md-4">
          <label class="form-label small mb-1 fw-semibold text-muted">Option E (Optional)</label>
          <input class="form-control form-control-sm q-opt-e" type="text" placeholder="Option E" />
        </div>
        <div class="col-6 col-md-4">
          <label class="form-label small mb-1 fw-semibold text-muted">Correct Answer</label>
          <select class="form-select form-select-sm q-correct">
            <option value="A">Option A</option>
            <option value="B">Option B</option>
            <option value="C">Option C</option>
            <option value="D">Option D</option>
            <option value="E">Option E</option>
          </select>
        </div>
        <div class="col-12">
          <label class="form-label small mb-1 fw-semibold text-muted">Explanation / Description</label>
          <textarea class="form-control form-control-sm q-explanation" rows="1" placeholder="Optional explanation..."></textarea>
        </div>
      </div>
    </div>
  `;
}

function addMcqQuestionBlock() {
  const container = el("mcqQuestionsList");
  if (!container) return;

  const div = document.createElement("div");
  div.innerHTML = createQuestionBlockHTML(mcqQuestionCounter);
  container.appendChild(div.firstElementChild);
  mcqQuestionCounter++;

  updateQuestionNumbers();
}

function removeMcqQuestionBlock(index) {
  const card = document.querySelector(`.question-block-card[data-index="${index}"]`);
  if (card) {
    card.remove();
    updateQuestionNumbers();
  }
}

function updateQuestionNumbers() {
  const cards = document.querySelectorAll(".question-block-card");
  cards.forEach((card, idx) => {
    const strong = card.querySelector("strong");
    if (strong) {
      strong.textContent = `Question #${idx + 1}`;
    }
    const removeBtn = card.querySelector(".remove-question-btn");
    if (removeBtn) {
      removeBtn.style.display = cards.length > 1 ? "" : "none";
    }
  });
}

function initMcqQuestionsList() {
  const container = el("mcqQuestionsList");
  if (!container) return;
  container.innerHTML = "";
  mcqQuestionCounter = 0;
  addMcqQuestionBlock();
}

window.removeMcqQuestionBlock = removeMcqQuestionBlock;

function toggleTeacherUploadInputs() {
  const type = el("teacherMaterialType")?.value || "pdf";
  const pdfWrapper = el("pdfUploadWrapper");
  const videoWrapper = el("videoUrlWrapper");
  const mcqWrapper = el("mcqOptionsWrapper");
  const mcqBulkWrapper = el("mcqBulkWrapper");
  const essayBulkWrapper = el("essayBulkWrapper");
  const explanationWrapper = el("explanationWrapper");
  const label = el("instructionLabel");
  const instrInput = el("teacherInstruction");
  const instructionWrapper = el("instructionWrapper");

  if (pdfWrapper) pdfWrapper.style.display = type === "pdf" ? "" : "none";
  if (videoWrapper) videoWrapper.style.display = type === "video" ? "" : "none";
  
  if (mcqWrapper) mcqWrapper.style.display = "none";
  
  if (mcqBulkWrapper) {
    mcqBulkWrapper.style.display = type === "mcq" ? "" : "none";
    if (type === "mcq") {
      const container = el("mcqQuestionsList");
      if (container && container.children.length === 0) {
        initMcqQuestionsList();
      }
    }
  }

  if (essayBulkWrapper) {
    essayBulkWrapper.style.display = type === "essay" ? "" : "none";
    if (type === "essay") {
      const container = el("essayQuestionsList");
      if (container && container.children.length === 0) {
        initEssayQuestionsList();
      }
    }
  }

  if (explanationWrapper) explanationWrapper.style.display = "none";
  if (instructionWrapper) instructionWrapper.style.display = (type === "mcq" || type === "essay") ? "none" : "";

  if (label && instrInput) {
    label.textContent = "Learning instructions";
    instrInput.placeholder = "Tell students what to focus on, how long it should take, and what to submit.";
  }
}

async function teacherLoadMaterials(selectId = null) {
  const resp = await apiFetch("/materials");
  const list = await resp.json().catch(() => []);
  if (!resp.ok) throw new Error(list.detail || "Failed to load materials");

  studentMaterialsData = Array.isArray(list) ? list : [];
  const select = el("teacherMaterialSelect");
  if (!select) return;
  select.innerHTML = "";

  const learningGroup = document.createElement("optgroup");
  learningGroup.label = "📖 Learning Materials";
  const quizzesGroup = document.createElement("optgroup");
  quizzesGroup.label = "📝 Quizzes & Questions";

  for (const item of studentMaterialsData) {
    const type = item.file_type || "pdf";
    const option = document.createElement("option");
    option.value = String(item.id);
    option.textContent = `${item.title} — ${item.subject} (${type.toUpperCase()})`;

    if (type === "essay" || type === "mcq") {
      quizzesGroup.appendChild(option);
    } else {
      learningGroup.appendChild(option);
    }
  }

  if (learningGroup.children.length > 0) select.appendChild(learningGroup);
  if (quizzesGroup.children.length > 0) select.appendChild(quizzesGroup);

  if (selectId) select.value = String(selectId);
  if (!select.value && studentMaterialsData[0]) select.value = String(studentMaterialsData[0].id);
}

function getTeacherSelectedMaterial() {
  const selectedId = Number(el("teacherMaterialSelect")?.value || 0);
  return studentMaterialsData.find((m) => m.id === selectedId) || null;
}

function getTeacherSelectedMaterialGroup() {
  const mainMaterial = getTeacherSelectedMaterial();
  if (!mainMaterial) return [];
  if (mainMaterial.file_type !== "mcq" && mainMaterial.file_type !== "essay") {
    return [mainMaterial];
  }
  const baseTitle = getBaseTitle(mainMaterial.title);
  return studentMaterialsData.filter(
    (m) => getBaseTitle(m.title) === baseTitle &&
           m.subject === mainMaterial.subject &&
           m.file_type === mainMaterial.file_type
  );
}

function teacherFillEditForm() {
  const material = getTeacherSelectedMaterial();
  if (!material) return;
  if (el("editTitle")) el("editTitle").value = getBaseTitle(material.title) || "";
  if (el("editSubject")) el("editSubject").value = material.subject || "";
  if (el("editDuration")) el("editDuration").value = material.duration_minutes || "";
  if (el("editInstruction")) el("editInstruction").value = material.instruction || "";
  if (el("editExternalUrl")) el("editExternalUrl").value = material.external_url || "";

  const label = el("editInstructionLabel");
  const type = material.file_type;
  if (label) {
    if (type === "essay") label.textContent = "Essay Question / Instruction";
    else if (type === "mcq") label.textContent = "Question Text";
    else label.textContent = "Instruction";
  }

  const urlWrapper = el("editUrlWrapper");
  const mcqWrapper = el("editMcqWrapper");
  const mcqBulkWrapper = el("editMcqBulkWrapper");
  const explanationWrapper = el("editExplanationWrapper");
  const instructionWrapper = el("editInstructionWrapper");

  if (urlWrapper) urlWrapper.style.display = (type === "video" || type === "link") ? "" : "none";
  if (mcqWrapper) mcqWrapper.style.display = "none";
  if (explanationWrapper) explanationWrapper.style.display = "none";

  if (instructionWrapper) {
    instructionWrapper.style.display = (type === "mcq" || type === "essay") ? "none" : "";
  }

  if (mcqBulkWrapper) {
    mcqBulkWrapper.style.display = (type === "mcq" || type === "essay") ? "" : "none";
    if (type === "mcq" || type === "essay") {
      const container = el("editMcqQuestionsList");
      if (container) {
        container.innerHTML = "";
        const group = getTeacherSelectedMaterialGroup();
        group.forEach((item, index) => {
          const div = document.createElement("div");
          div.className = "card p-3 border border-secondary-subtle bg-light-subtle edit-question-card mb-3 animate-fade-in";
          div.dataset.id = item.id;
          div.style.borderRadius = "12px";
          div.style.boxShadow = "0 4px 12px rgba(0,0,0,0.03)";

          let parsedOptions = [];
          if (item.options) {
            try {
              parsedOptions = JSON.parse(item.options);
            } catch (e) {
              console.error(e);
            }
          }

          if (type === "mcq") {
            div.innerHTML = `
              <div class="d-flex justify-content-between align-items-center mb-2">
                <strong class="text-primary-emphasis small">Question #${index + 1}</strong>
                <button type="button" class="btn btn-outline-danger btn-xs py-0 px-2 delete-eq-btn" style="font-size:0.7rem;" data-id="${item.id}">Delete Question</button>
              </div>
              <div class="row g-2">
                <div class="col-12">
                  <label class="form-label small mb-1 fw-semibold text-muted">Question Text</label>
                  <textarea class="form-control form-control-sm eq-text" rows="2">${escapeHtml(item.instruction || "")}</textarea>
                </div>
                <div class="col-6 col-md-4">
                  <label class="form-label small mb-1 fw-semibold text-muted">Option A</label>
                  <input class="form-control form-control-sm eq-opt-a" type="text" value="${escapeHtml(parsedOptions[0] || "")}" />
                </div>
                <div class="col-6 col-md-4">
                  <label class="form-label small mb-1 fw-semibold text-muted">Option B</label>
                  <input class="form-control form-control-sm eq-opt-b" type="text" value="${escapeHtml(parsedOptions[1] || "")}" />
                </div>
                <div class="col-6 col-md-4">
                  <label class="form-label small mb-1 fw-semibold text-muted">Option C (Optional)</label>
                  <input class="form-control form-control-sm eq-opt-c" type="text" value="${escapeHtml(parsedOptions[2] || "")}" />
                </div>
                <div class="col-6 col-md-4">
                  <label class="form-label small mb-1 fw-semibold text-muted">Option D (Optional)</label>
                  <input class="form-control form-control-sm eq-opt-d" type="text" value="${escapeHtml(parsedOptions[3] || "")}" />
                </div>
                <div class="col-6 col-md-4">
                  <label class="form-label small mb-1 fw-semibold text-muted">Option E (Optional)</label>
                  <input class="form-control form-control-sm eq-opt-e" type="text" value="${escapeHtml(parsedOptions[4] || "")}" />
                </div>
                <div class="col-6 col-md-4">
                  <label class="form-label small mb-1 fw-semibold text-muted">Correct Answer</label>
                  <select class="form-select form-select-sm eq-correct">
                    <option value="A" ${item.correct_answer === "A" ? "selected" : ""}>Option A</option>
                    <option value="B" ${item.correct_answer === "B" ? "selected" : ""}>Option B</option>
                    <option value="C" ${item.correct_answer === "C" ? "selected" : ""}>Option C</option>
                    <option value="D" ${item.correct_answer === "D" ? "selected" : ""}>Option D</option>
                    <option value="E" ${item.correct_answer === "E" ? "selected" : ""}>Option E</option>
                  </select>
                </div>
                <div class="col-12">
                  <label class="form-label small mb-1 fw-semibold text-muted">Explanation / Description</label>
                  <textarea class="form-control form-control-sm eq-explanation" rows="1">${escapeHtml(item.explanation || "")}</textarea>
                </div>
              </div>
            `;
          } else {
            div.innerHTML = `
              <div class="d-flex justify-content-between align-items-center mb-2">
                <strong class="text-primary-emphasis small">Question #${index + 1}</strong>
                <button type="button" class="btn btn-outline-danger btn-xs py-0 px-2 delete-eq-btn" style="font-size:0.7rem;" data-id="${item.id}">Delete Question</button>
              </div>
              <div class="row g-2">
                <div class="col-12">
                  <label class="form-label small mb-1 fw-semibold text-muted">Essay Question / Instruction</label>
                  <textarea class="form-control form-control-sm eq-text" rows="2">${escapeHtml(item.instruction || "")}</textarea>
                </div>
                <div class="col-12">
                  <label class="form-label small mb-1 fw-semibold text-muted">Explanation / Description</label>
                  <textarea class="form-control form-control-sm eq-explanation" rows="1">${escapeHtml(item.explanation || "")}</textarea>
                </div>
              </div>
            `;
          }
          container.appendChild(div);
        });

        // Attach delete listeners
        container.querySelectorAll(".delete-eq-btn").forEach((btn) => {
          btn.addEventListener("click", async (e) => {
            const qId = Number(e.currentTarget.dataset.id);
            if (!confirm("Are you sure you want to delete this question from the group? This action cannot be undone.")) {
              return;
            }
            try {
              showMessage("Deleting question...", "info");
              const resp = await apiFetch(`/materials/${qId}`, {
                method: "DELETE"
              });
              const data = await resp.json().catch(() => ({}));
              if (!resp.ok) {
                throw new Error(data.detail || "Delete failed");
              }
              showMessage("Question deleted successfully.", "success");
              await teacherLoadMaterials(material.id);
              await teacherLoadComments();
              await teacherLoadDashboard(teacherSelectedStudentId);
              teacherFillEditForm();
            } catch (err) {
              showMessage(err.message);
            }
          });
        });
      }
    }
  }
}

async function teacherLoadComments() {
  const material = getTeacherSelectedMaterial();
  const container = el("teacherComments");
  if (!container) return;
  if (!material) {
    container.innerHTML = '<div class="text-body-secondary">No material selected.</div>';
    return;
  }

  const resp = await apiFetch(`/materials/${material.id}/comments`);
  const data = await resp.json().catch(() => []);
  if (!resp.ok) throw new Error(data.detail || "Failed to load comments");

  if (!Array.isArray(data) || !data.length) {
    container.innerHTML = '<div class="text-body-secondary">No comments yet.</div>';
    return;
  }

  container.innerHTML = data
    .map(
      (item) => `
      <div class="border rounded p-2 mb-2">
        <div class="small text-body-secondary">${escapeHtml(item.user_name)} (${escapeHtml(item.user_role)}) • ${new Date(item.created_at).toLocaleString()}</div>
        <div>${escapeHtml(item.comment_text)}</div>
      </div>
    `
    )
    .join("");
}

function teacherLocalStorageKey(prefix, studentId) {
  return `${prefix}:${studentId}`;
}

function teacherFormatValue(value, digits = 2) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue.toFixed(digits) : "0.00";
}

function teacherFormatTime(value) {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleString();
  } catch (_err) {
    return "-";
  }
}

function teacherEmotionLabel(valence, arousal) {
  if (valence > 0.2 && arousal > 0.55) return "engaged";
  if (valence > 0.2 && arousal <= 0.55) return "calm";
  if (valence < -0.25 && arousal > 0.55) return "possible confusion";
  if (valence < -0.35 && arousal > 0.45) return "possible frustration";
  if (arousal < 0.35) return "low engagement";
  return "steady";
}

function teacherSetChipState(container, activeValue) {
  if (!container) return;
  container.querySelectorAll("[data-self-report]").forEach((button) => {
    button.classList.toggle("active", button.dataset.selfReport === activeValue);
  });
}

function teacherClearChart(chartRef) {
  if (chartRef && typeof chartRef.destroy === "function") {
    chartRef.destroy();
  }
}

function teacherRenderLineChart(canvasId, chartRefName, labels, valenceSeries, arousalSeries) {
  const canvas = el(canvasId);
  if (!canvas || typeof Chart === "undefined") return null;
  const existing = chartRefName === "class" ? teacherClassTimelineChart : teacherStudentTimelineChart;
  teacherClearChart(existing);
  const nextChart = new Chart(canvas.getContext("2d"), {
    type: "line",
    data: {
      labels,
      datasets: [
        { label: "Valence", data: valenceSeries, borderColor: "#2f6fed", backgroundColor: "rgba(47,111,237,0.12)", tension: 0.28, fill: true },
        { label: "Arousal", data: arousalSeries, borderColor: "#ef4444", backgroundColor: "rgba(239,68,68,0.12)", tension: 0.28, fill: true },
      ],
    },
    options: {
      animation: false,
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { display: false },
        y: { min: -1, max: 1, ticks: { stepSize: 0.5 } },
      },
      plugins: {
        legend: { labels: { boxWidth: 10, boxHeight: 10, usePointStyle: true } },
      },
    },
  });
  if (chartRefName === "class") teacherClassTimelineChart = nextChart;
  else teacherStudentTimelineChart = nextChart;
  return nextChart;
}

function teacherRenderScatter(divId, chartRefName, points) {
  const target = el(divId);
  if (!target || typeof Plotly === "undefined") return;
  const x = points.map((point) => Number(point.valence || 0));
  const y = points.map((point) => Number(point.arousal || 0) * 2 - 1);
  const text = points.map((point) => `${point.label || "Learner"} • ${teacherFormatTime(point.timestamp)}`);
  const trace = {
    x,
    y,
    text,
    mode: "markers",
    type: "scatter",
    marker: { color: chartRefName === "class" ? "#6f42c1" : "#0ea5e9", size: 8, opacity: 0.9 },
  };
  const layout = {
    margin: { l: 50, r: 20, t: 20, b: 45 },
    xaxis: { range: [-1, 1], title: "Valence", zeroline: false, showgrid: false },
    yaxis: { range: [-1, 1], title: "Arousal", zeroline: false, showgrid: false },
    showlegend: false,
    hovermode: "closest",
  };
  Plotly.newPlot(target, [trace], layout, { responsive: true, displayModeBar: false });
  if (chartRefName === "class") teacherClassScatterChart = target;
  else teacherStudentScatterChart = target;
}

function teacherRenderRoster(students) {
  const roster = el("teacherStudentRoster");
  if (!roster) return;
  if (!Array.isArray(students) || !students.length) {
    roster.innerHTML = '<div class="text-body-secondary small">No students are available yet.</div>';
    return;
  }

  roster.innerHTML = students
    .map((student) => {
      const initials = (student.name || `S${student.id}`)
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase();

      const supportLabel = Array.isArray(student.support_flags) && student.support_flags.some((flag) => flag !== "steady" && flag !== "calm / steady")
        ? "Needs Support"
        : (student.completed_count === student.assignment_count ? "Completed" : "Opened");

      const supportClass = supportLabel === "Needs Support" ? "needs-support" : (supportLabel === "Completed" ? "completed" : "opened");
      const consentText = student.consent_active ? "Active" : "Required";
      const consentClass = student.consent_active ? "good" : "needs-review";

      return `
        <button class="roster-item-custom" type="button" data-student-id="${student.id}">
          <div class="roster-item-avatar">${initials}</div>
          <div class="roster-item-info">
            <div class="roster-item-name">${escapeHtml(student.name || `Student ${student.id}`)}</div>
            <div class="roster-badges">
              <span class="badge-support ${supportClass}" style="font-size: 0.65rem; padding: 0.1rem 0.35rem;">${supportLabel}</span>
              <span class="badge-custom ${consentClass}" style="font-size: 0.65rem; padding: 0.1rem 0.35rem;">Consent ${consentText}</span>
            </div>
          </div>
          <div class="roster-arrow">➔</div>
        </button>
      `;
    })
    .join("");

  roster.querySelectorAll("[data-student-id]").forEach((button) => {
    button.addEventListener("click", async () => {
      const studentId = Number(button.dataset.studentId || 0);
      if (!studentId) return;
      teacherSelectedStudentId = studentId;
      const studentFilter = el("teacherStudentFilter");
      if (studentFilter) studentFilter.value = String(studentId);
      await teacherLoadStudentReport(studentId);
    });
  });
}

function teacherPopulateFilters(data) {
  const materialFilter = el("teacherMaterialFilter");
  const studentFilter = el("teacherStudentFilter");
  if (materialFilter) {
    const previous = materialFilter.value;
    materialFilter.innerHTML = '<option value="">All materials</option>';
    for (const material of Array.isArray(data?.materials) ? data.materials : []) {
      const option = document.createElement("option");
      option.value = String(material.id);
      option.textContent = `${material.title} (${material.file_type})`;
      materialFilter.appendChild(option);
    }
    if (previous) materialFilter.value = previous;
  }

  const studentOptions = Array.isArray(data?.students) ? data.students : [];
  if (studentFilter) {
    const previous = studentFilter.value;
    studentFilter.innerHTML = '<option value="">Choose a student</option>';
    for (const student of studentOptions) {
      const option = document.createElement("option");
      option.value = String(student.id);
      option.textContent = `${student.name || `Student ${student.id}`} • ${teacherEmotionLabel(student.valence_mean, student.arousal_mean)}`;
      studentFilter.appendChild(option);
    }
    if (previous) studentFilter.value = previous;
  }
}

function teacherRenderSummary(data) {
  const materials = Array.isArray(data?.materials) ? data.materials : [];
  const students = Array.isArray(data?.students) ? data.students : [];
  const assignmentSummary = data?.assignment_summary || {};
  const supportCount = students.filter((student) => Array.isArray(student.support_flags) && student.support_flags.some((flag) => flag !== "steady" && flag !== "calm / steady")).length;

  const materialsMetric = el("teacherMetricMaterials");
  const assignmentsMetric = el("teacherMetricAssignments");
  const studentsMetric = el("teacherMetricStudents");
  const supportMetric = el("teacherMetricSupport");
  const dashboardStatus = el("teacherDashboardStatus");
  const assignmentSummaryChip = el("teacherAssignmentSummary");

  if (materialsMetric) materialsMetric.textContent = String(materials.length);
  if (assignmentsMetric) assignmentsMetric.textContent = String(assignmentSummary.total || 0);
  if (studentsMetric) studentsMetric.textContent = String(students.length);
  if (supportMetric) supportMetric.textContent = String(supportCount);
  if (dashboardStatus) {
    dashboardStatus.textContent = `${data?.count || 0} emotion logs • ${teacherFormatValue(data?.valence_mean || 0)} valence • ${teacherFormatValue(data?.arousal_mean || 0)} arousal`;
  }
  if (assignmentSummaryChip) {
    assignmentSummaryChip.textContent = `${assignmentSummary.active || 0} active • ${assignmentSummary.pending || 0} pending • ${assignmentSummary.completed || 0} completed`;
  }

  const consentNote = el("teacherConsentNote");
  if (consentNote) {
    consentNote.textContent = data?.consent_note || "Show emotion data only after active consent is confirmed for the learner session.";
  }
}

function teacherRenderClassCharts(data) {
  const recentLogs = Array.isArray(data?.recent_logs) ? data.recent_logs.slice().reverse() : [];
  const labels = recentLogs.map((row) => new Date(row.timestamp).toLocaleTimeString());
  const valences = recentLogs.map((row) => Number(row.valence || 0));
  const arousals = recentLogs.map((row) => Number(row.arousal || 0) * 2 - 1);
  teacherRenderLineChart("teacherClassTimeline", "class", labels, valences, arousals);
  teacherRenderScatter(
    "teacherClassScatter",
    "class",
    recentLogs.map((row) => ({
      valence: row.valence,
      arousal: row.arousal,
      label: row.student_name || `Student ${row.student_id}`,
      timestamp: row.timestamp,
    }))
  );
}

function teacherRenderProgressTable(data) {
  const tbody = el("teacherProgressTable");
  if (!tbody) return;
  const students = Array.isArray(data?.students) ? data.students : [];
  if (!students.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-body-secondary text-center">No student data yet.</td></tr>';
    return;
  }

  tbody.innerHTML = students
    .map((student) => {
      const initials = (student.name || `S${student.id}`)
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase();

      const focusPercent = Math.round(Number(student.focus_ratio || 0) * 100);
      let barColorClass = "good";
      if (focusPercent < 40) barColorClass = "danger";
      else if (focusPercent < 70) barColorClass = "warning";

      const rawSupport = Array.isArray(student.support_flags) ? student.support_flags[0] || "steady" : "steady";
      let supportLabel = "Good";
      let supportClass = "good";
      if (rawSupport.includes("confus")) {
        supportLabel = "Needs Review";
        supportClass = "needs-review";
      } else if (rawSupport.includes("frustrat") || rawSupport.includes("support")) {
        supportLabel = "Needs Support";
        supportClass = "needs-support";
      } else if (rawSupport.includes("low")) {
        supportLabel = "Needs Review";
        supportClass = "needs-review";
      }

      const openedVal = student.opened_count > 0 ? "May 15" : "-";
      const completedVal = student.completed_count > 0 ? "May 19" : "-";

      return `
        <tr class="teacher-progress-row" data-student-id="${student.id}">
          <td>
            <div class="student-cell-custom">
              <div class="student-avatar-placeholder">${initials}</div>
              <div class="student-info-meta">
                <span class="student-name-text">${escapeHtml(student.name || `Student ${student.id}`)}</span>
                <span class="student-email-text">${escapeHtml(student.email || "")}</span>
              </div>
            </div>
          </td>
          <td>${openedVal}</td>
          <td>${completedVal}</td>
          <td>
            <div class="progress-bar-container">
              <div class="progress-bar-bg">
                <div class="progress-bar-fill ${barColorClass}" style="width: ${focusPercent}%"></div>
              </div>
              <span class="fw-bold" style="font-size: 0.78rem;">${focusPercent}%</span>
            </div>
          </td>
          <td>
            <span class="badge-support ${supportClass}">${supportLabel}</span>
          </td>
          <td>
            <div class="progress-action-icons">
              <button class="action-icon-btn" title="View details">👁️ View Details</button>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");

  tbody.querySelectorAll("[data-student-id]").forEach((row) => {
    row.addEventListener("click", async () => {
      const studentId = Number(row.dataset.studentId || 0);
      if (!studentId) return;
      teacherSelectedStudentId = studentId;
      const studentFilter = el("teacherStudentFilter");
      if (studentFilter) studentFilter.value = String(studentId);
      await teacherLoadStudentReport(studentId);
    });
  });
}

function teacherRenderMaterialStatus(data) {
  const materials = Array.isArray(data?.materials) ? data.materials : [];
  const materialFilter = el("teacherMaterialFilter");
  const teacherMaterialSelect = el("teacherMaterialSelect");
  if (materialFilter && !materialFilter.value && materials[0]) materialFilter.value = String(materials[0].id);
  if (teacherMaterialSelect && !teacherMaterialSelect.value && materials[0]) teacherMaterialSelect.value = String(materials[0].id);
}

function teacherSuggestionList(student) {
  const suggestions = [];
  const flags = Array.isArray(student?.support_flags) ? student.support_flags : [];
  if (flags.includes("possible confusion")) suggestions.push("Offer a short recap or a worked example after class.");
  if (flags.includes("low engagement")) suggestions.push("Break the task into smaller steps and check in earlier.");
  if (flags.includes("possible frustration")) suggestions.push("Pause for encouragement and remove unnecessary task load.");
  if (!suggestions.length) suggestions.push("Continue monitoring. The current pattern looks steady.");
  return suggestions;
}

function teacherCompareSelfReport(student, selfReportText) {
  const emotionWord = teacherEmotionLabel(student?.valence_mean || 0, student?.arousal_mean || 0);
  const report = String(selfReportText || "").toLowerCase();
  if (!report) return `Self-report not captured yet. The current emotion summary looks ${emotionWord}.`;
  if (report.includes("confus")) return `Self-report mentions confusion, which aligns with the ${emotionWord} signal.`;
  if (report.includes("frustrat")) return `Self-report mentions frustration, which aligns with the ${emotionWord} signal.`;
  if (report.includes("focus") || report.includes("engag")) return `Self-report suggests attention or engagement, while the emotion summary looks ${emotionWord}.`;
  if (report.includes("calm") || report.includes("fine")) return `Self-report sounds calm, and the emotion summary looks ${emotionWord}.`;
  return `Self-report recorded. The current emotion summary still reads as ${emotionWord}, so compare it with your lesson context.`;
}

async function teacherLoadDashboard(preferredStudentId = null) {
  const materialFilter = Number(el("teacherMaterialFilter")?.value || 0) || null;
  const studentFilter = Number(preferredStudentId || el("teacherStudentFilter")?.value || 0) || null;
  const params = new URLSearchParams();
  if (materialFilter) params.set("material_id", String(materialFilter));
  if (studentFilter) params.set("student_id", String(studentFilter));

  const resp = await apiFetch(`/teacher/dashboard${params.toString() ? `?${params.toString()}` : ""}`);
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(data.detail || "Failed to load teacher dashboard");

  teacherDashboardData = data;
  teacherPopulateFilters(data);
  teacherRenderSummary(data);
  teacherRenderProgressTable(data);
  teacherRenderRoster(data.students || []);
  teacherRenderClassCharts(data);
  teacherRenderMaterialStatus(data);

  const currentStudentId = preferredStudentId || teacherSelectedStudentId || Number(el("teacherStudentFilter")?.value || 0) || (data.students && data.students[0] ? data.students[0].id : 0);
  if (currentStudentId) {
    teacherSelectedStudentId = currentStudentId;
    const studentFilter = el("teacherStudentFilter");
    if (studentFilter) studentFilter.value = String(currentStudentId);
    await teacherLoadStudentReport(currentStudentId, materialFilter);
  } else {
    teacherRenderEmptyStudentState();
  }
}

function teacherRenderEmptyStudentState() {
  const title = el("teacherSelectedStudentTitle");
  const meta = el("teacherSelectedStudentMeta");
  const consent = el("teacherSelectedStudentConsent");
  const summary = el("teacherSelectedStudentSummary");
  const note = el("teacherSelectedStudentNote");
  const support = el("teacherStudentSupportList");
  if (title) title.textContent = "Select a student";
  if (meta) meta.textContent = "Choose a learner from the table or dropdown.";
  if (consent) consent.textContent = "Consent pending";
  if (summary) {
    summary.innerHTML = '<tr><td colspan="2" class="text-body-secondary">The student summary will appear here after selection.</td></tr>';
  }
  if (note) note.textContent = "Select a learner to see a short, supportive interpretation and suggested follow-up.";
  if (support) support.textContent = "Select a learner to see support-oriented suggestions.";

  const submissionsContainer = el("teacherStudentSubmissionsList");
  if (submissionsContainer) {
    submissionsContainer.innerHTML = '<div class="text-body-secondary">Select a learner to see their answers.</div>';
  }
}

async function teacherLoadStudentReport(studentId, materialId = null) {
  if (!studentId) {
    teacherRenderEmptyStudentState();
    return;
  }

  const params = new URLSearchParams();
  params.set("student_id", String(studentId));
  if (materialId) params.set("material_id", String(materialId));

  const resp = await apiFetch(`/student/dashboard?${params.toString()}`);
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(data.detail || "Failed to load student report");

  const student = (teacherDashboardData?.students || []).find((item) => Number(item.id) === Number(studentId)) || { id: studentId };
  const title = el("teacherSelectedStudentTitle");
  const meta = el("teacherSelectedStudentMeta");
  const consent = el("teacherSelectedStudentConsent");
  const summary = el("teacherSelectedStudentSummary");
  const note = el("teacherSelectedStudentNote");
  const support = el("teacherStudentSupportList");

  if (title) title.textContent = student.name || `Student ${studentId}`;
  if (meta) meta.textContent = `${student.assignment_count || 0} assignments • ${student.completed_count || 0} completed • focus ${Math.round((Number(student.focus_ratio || 0) * 100))}%`;
  if (consent) {
    consent.textContent = student.consent_active ? "Consent active" : "Consent required";
    consent.classList.toggle("teacher-chip-warning", !student.consent_active);
  }

  const timelineValues = Array.isArray(data.times) ? data.times : [];
  const valences = Array.isArray(data.valences) ? data.valences : [];
  const arousals = Array.isArray(data.arousals) ? data.arousals.map((value) => Number(value) * 2 - 1) : [];

  const emotionWord = teacherEmotionLabel(student.valence_mean || 0, student.arousal_mean || 0);
  const supportFlags = Array.isArray(student.support_flags) ? student.support_flags : [];
  const durationText = data.times && data.times.length > 1 ? `${Math.max(1, Math.round((new Date(data.times[data.times.length - 1]) - new Date(data.times[0])) / 60000))} min observed` : "Insufficient duration data";
  const tableRows = [
    ["Emotion summary", emotionWord],
    ["Observed focus ratio", `${Math.round((Number(student.focus_ratio || data.focus_ratio || 0) * 100))}%`],
    ["Timeline coverage", durationText],
    ["Valence mean", teacherFormatValue(student.valence_mean || 0)],
    ["Arousal mean", teacherFormatValue(student.arousal_mean || 0)],
    ["Open / completed", `${student.opened_count || 0} opened • ${student.completed_count || 0} completed`],
    ["Support cue", supportFlags.join(", ") || "steady"],
    ["Consent", student.consent_active ? "Active" : "Required"],
  ];
  if (summary) {
    summary.innerHTML = tableRows
      .map(
        ([label, value]) => `
          <tr>
            <th scope="row">${escapeHtml(label)}</th>
            <td>${escapeHtml(value)}</td>
          </tr>
        `
      )
      .join("");
  }
  if (note) {
    note.textContent = `This summary is a support cue only. ${supportFlags.some((flag) => flag !== "steady") ? "Possible follow-up may help." : "The current pattern looks stable."}`;
  }
  if (support) {
    support.innerHTML = teacherSuggestionList(student)
      .map((item) => `<div class="teacher-support-item">${escapeHtml(item)}</div>`)
      .join("");
  }

  // Render question submissions
  const submissionsContainer = el("teacherStudentSubmissionsList");
  if (submissionsContainer) {
    const submissions = Array.isArray(data.submissions) ? data.submissions : [];
    if (!submissions.length) {
      submissionsContainer.innerHTML = '<div class="text-body-secondary text-center py-2">No submissions yet for this student.</div>';
    } else {
      submissionsContainer.innerHTML = submissions
        .map((sub) => {
          const isMcq = sub.material_type === "mcq";
          const isEssay = sub.material_type === "essay";

          let statusBadge = "";
          let gradingControls = "";

          if (isMcq) {
            statusBadge = sub.is_correct
              ? '<span class="badge bg-success">Correct</span>'
              : '<span class="badge bg-danger">Incorrect</span>';
          } else if (isEssay) {
            if (sub.is_correct === true) {
              statusBadge = '<span class="badge bg-success">Correct</span>';
            } else if (sub.is_correct === false) {
              statusBadge = '<span class="badge bg-danger">Incorrect</span>';
            } else {
              statusBadge = '<span class="badge bg-warning text-dark">Pending Review</span>';
            }
            gradingControls = `
              <div class="mt-2 d-flex gap-2">
                <button class="btn btn-xs btn-outline-success py-0 px-2" style="font-size: 0.7rem;" onclick="teacherGradeSubmission(${sub.id}, true)">Mark Correct</button>
                <button class="btn btn-xs btn-outline-danger py-0 px-2" style="font-size: 0.7rem;" onclick="teacherGradeSubmission(${sub.id}, false)">Mark Incorrect</button>
              </div>
            `;
          }

          return `
            <div class="border rounded p-2 mb-2 bg-white shadow-xs">
              <div class="d-flex justify-content-between align-items-center mb-1">
                <span class="fw-semibold text-primary" style="font-size: 0.8rem;">${escapeHtml(sub.material_title)}</span>
                ${statusBadge}
              </div>
              <div class="text-body-secondary mb-1" style="font-size: 0.75rem;">
                <strong>Type:</strong> ${escapeHtml(sub.material_type.toUpperCase())} • 
                <strong>Submitted:</strong> ${new Date(sub.submitted_at).toLocaleString()}
              </div>
              <div class="p-1 mb-1" style="background-color: #f8fafc; border-left: 3px solid #cbd5e1; font-size: 0.78rem;">
                <strong>Answer:</strong> ${escapeHtml(sub.answer)}
              </div>
              ${gradingControls}
            </div>
          `;
        })
        .join("");
    }
  }
}

window.teacherGradeSubmission = async function (submissionId, isCorrect) {
  try {
    const resp = await apiFetch(`/submissions/${submissionId}/grade`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_correct: isCorrect }),
    });
    if (!resp.ok) {
      const data = await resp.json().catch(() => ({}));
      throw new Error(data.detail || "Failed to grade submission");
    }
    showMessage("Submission graded successfully.", "success");
    await teacherLoadStudentReport(teacherSelectedStudentId);
  } catch (err) {
    showMessage(err.message);
  }
};

async function initAdminPage() {
  await adminLoadStats();
  await adminLoadActivity();

  el("refreshAdminStatsBtn")?.addEventListener("click", adminLoadStats);
  el("refreshAdminActivityBtn")?.addEventListener("click", adminLoadActivity);

  el("toggleUserActiveBtn")?.addEventListener("click", async () => {
    const userId = Number(el("adminUserId")?.value || 0);
    const active = (el("adminUserActive")?.value || "true") === "true";
    if (!userId) {
      showMessage("Provide a valid user ID.");
      return;
    }
    try {
      const resp = await apiFetch(`/admin/users/${userId}/active?is_active=${active}`, { method: "PATCH" });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data.detail || "Failed to update user status");
      showMessage(`User ${data.user_id} status updated to ${data.is_active}.`, "success");
      await adminLoadActivity();
    } catch (err) {
      showMessage(err.message);
    }
  });

  el("downloadExportBtn")?.addEventListener("click", async () => {
    try {
      const resp = await apiFetch("/admin/export.csv");
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        throw new Error(data.detail || "Export failed");
      }
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "research_export.csv";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      showMessage("CSV export downloaded.", "success");
    } catch (err) {
      showMessage(err.message);
    }
  });
}

async function adminLoadStats() {
  const resp = await apiFetch("/admin/stats");
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(data.detail || "Failed to load admin stats");
  if (el("statsUsers")) el("statsUsers").textContent = `${data.users_active}/${data.users_total}`;
  if (el("statsMaterials")) el("statsMaterials").textContent = String(data.materials_total || 0);
  if (el("statsComments")) el("statsComments").textContent = String(data.comments_total || 0);
  if (el("statsLogs")) el("statsLogs").textContent = String(data.logs_total || 0);
}

async function adminLoadActivity() {
  const resp = await apiFetch("/admin/activity");
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(data.detail || "Failed to load activity");
  const body = el("adminActivityBody");
  if (!body) return;
  const items = Array.isArray(data.items) ? data.items : [];
  body.innerHTML = items
    .map((item) => {
      const actor = item.actor_name ? `${item.actor_name} (${item.actor_role || "-"})` : "-";
      const detail = item.detail || `${item.entity_type || ""} ${item.entity_id || ""}`;
      return `<tr>
        <td>${new Date(item.timestamp).toLocaleString()}</td>
        <td>${escapeHtml(item.event_type || "")}</td>
        <td>${escapeHtml(actor)}</td>
        <td>${escapeHtml(detail)}</td>
      </tr>`;
    })
    .join("");
}

async function startCamera() {
  if (stream) return;
  video = el("video");
  canvas = el("canvas");
  overlayCanvas = el("overlay");
  bboxRect = el("bboxRect");
  if (!video || !canvas || !overlayCanvas || !bboxRect) return;

  ctx = canvas.getContext("2d");
  overlayCtx = overlayCanvas.getContext("2d");
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    video.srcObject = stream;
    video.addEventListener(
      "loadedmetadata",
      () => {
        const w = video.videoWidth || 320;
        const h = video.videoHeight || 240;
        canvas.width = w;
        canvas.height = h;
        overlayCanvas.width = w;
        overlayCanvas.height = h;
      },
      { once: true }
    );
    await video.play();
  } catch (e) {
    showMessage("Could not access camera: " + e.message);
  }
}

async function captureAndSend() {
  if (!video || video.readyState < 2 || !sessionId) return;
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  canvas.toBlob(
    async (blob) => {
      try {
        const fd = new FormData();
        fd.append("file", blob, "frame.jpg");
        const resp = await apiFetch("/predict", { method: "POST", body: fd });
        if (!resp.ok) {
          drawBoundingBox(null);
          const latest = el("latest");
          let msg = "predict failed";
          try {
            const err = await resp.json();
            if (err && err.detail) msg = err.detail;
          } catch (_e) { }
          if (latest) latest.textContent = msg;
          return;
        }

        const data = await resp.json();
        const latest = el("latest");
        if (latest) {
          latest.textContent = `valence=${data.valence.toFixed(2)} arousal=${data.arousal.toFixed(2)} source=${(data.bbox && data.bbox.source) || "none"}`;
        }

        updateLiveEmotionSummary(data);

        drawBoundingBox(data.bbox, { width: data.frame_width, height: data.frame_height });

        // update timeline + circumplex immediately for realtime UI
        pushTimeline(data);

        // keep logging, but do not block chart updates on network/database latency
        apiFetch("/emotion/log", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            session_id: sessionId,
            valence: data.valence,
            arousal: data.arousal,
            confidence: data.confidence || null,
            model_version: data.model_version || null,
            client_timestamp: new Date().toISOString(),
            source: "server-fallback",
          }),
        }).catch((_e) => { });
      } catch (err) {
        if (el("latest")) el("latest").textContent = err.message;
      }
    },
    "image/jpeg",
    0.8
  );
}

function drawBoundingBox(bbox, frameSize) {
  if (!overlayCtx || !overlayCanvas || !bboxRect) return;
  overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
  if (!bbox || bbox.width <= 0 || bbox.height <= 0) {
    bboxRect.style.display = "none";
    return;
  }

  const sourceW = frameSize && frameSize.width ? Number(frameSize.width) : overlayCanvas.width;
  const sourceH = frameSize && frameSize.height ? Number(frameSize.height) : overlayCanvas.height;
  const targetW = overlayCanvas.clientWidth || overlayCanvas.width;
  const targetH = overlayCanvas.clientHeight || overlayCanvas.height;
  const scaleX = sourceW > 0 ? targetW / sourceW : 1;
  const scaleY = sourceH > 0 ? targetH / sourceH : 1;

  const x = Math.max(0, Math.round(Number(bbox.x) * scaleX));
  const y = Math.max(0, Math.round(Number(bbox.y) * scaleY));
  const w = Math.max(1, Math.round(Number(bbox.width) * scaleX));
  const h = Math.max(1, Math.round(Number(bbox.height) * scaleY));

  bboxRect.style.display = "block";
  bboxRect.style.left = `${x}px`;
  bboxRect.style.top = `${y}px`;
  bboxRect.style.width = `${w}px`;
  bboxRect.style.height = `${h}px`;
}

function initCharts() {
  if (timelineChart && scatterChart) return;
  const timelineCanvas = el("timelineChart");
  const scatterDiv = el("scatterChart");
  if (!timelineCanvas) return;

  // timeline chart remains Chart.js
  if (!timelineChart && typeof Chart !== "undefined") {
    timelineChart = new Chart(timelineCanvas.getContext("2d"), {
      type: "line",
      data: {
        labels: [],
        datasets: [
          { label: "Valence", data: [], borderColor: "blue", fill: false },
          { label: "Arousal", data: [], borderColor: "red", fill: false },
        ],
      },
      options: {
        animation: false,
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            display: false,
            grid: { display: false },
          },
          y: {
            min: -1,
            max: 1,
            ticks: { stepSize: 0.5 },
          },
        },
        elements: {
          point: { radius: 1.5, hoverRadius: 3, borderWidth: 1 },
        },
        plugins: {
          legend: {
            labels: {
              boxWidth: 10,
              boxHeight: 10,
              usePointStyle: true,
              pointStyle: "line",
            },
          },
        },
      },
    });
  }

  // Arousal–Valence circumplex using Plotly
  if (!scatterDiv || typeof Plotly === "undefined") return;

  scatterChart = scatterDiv; // use DOM element as reference

  const trace = {
    x: [],
    y: [],
    mode: "markers",
    type: "scatter",
    name: "Arousal vs Valence",
    marker: { color: "#6f42c1", size: 8, opacity: 0.9, line: { width: 0 } },
  };

  // background shapes: left (warm) and right (cool), circle boundary, and axes lines
  const shapes = [
    // left half soft pink/red
    {
      type: "rect",
      xref: "x",
      yref: "y",
      x0: -1,
      x1: 0,
      y0: -1,
      y1: 1,
      fillcolor: "rgba(255,200,200,0.4)",
      line: { width: 0 },
    },
    // right half soft cyan/blue
    {
      type: "rect",
      xref: "x",
      yref: "y",
      x0: 0,
      x1: 1,
      y0: -1,
      y1: 1,
      fillcolor: "rgba(200,235,255,0.45)",
      line: { width: 0 },
    },
    // circular boundary (approximated by circle shape)
    {
      type: "circle",
      xref: "x",
      yref: "y",
      x0: -1,
      x1: 1,
      y0: -1,
      y1: 1,
      line: { color: "rgba(80,80,80,0.9)", width: 2 },
    },
    // x and y axes (thicker zerolines)
    { type: "line", x0: -1, x1: 1, y0: 0, y1: 0, xref: "x", yref: "y", line: { color: "#333", width: 1 } },
    { type: "line", x0: 0, x1: 0, y0: -1, y1: 1, xref: "x", yref: "y", line: { color: "#333", width: 1 } },
  ];

  const annotations = [
    // quadrant titles
    { x: -0.6, y: 0.65, text: "Frustration", showarrow: false, font: { size: 14, color: "#6b0300", family: "Helvetica, Arial, sans-serif" } },
    { x: 0.6, y: 0.65, text: "Engagement", showarrow: false, font: { size: 14, color: "#0b4b66", family: "Helvetica, Arial, sans-serif" } },
    { x: -0.6, y: -0.65, text: "Boredom", showarrow: false, font: { size: 14, color: "#3a1f5a", family: "Helvetica, Arial, sans-serif" } },
    { x: 0.6, y: -0.65, text: "Confusion", showarrow: false, font: { size: 14, color: "#025e73", family: "Helvetica, Arial, sans-serif" } },
    // axis end annotations
    { x: 0, y: 1.08, text: "(active)", showarrow: false, font: { size: 12 } },
    { x: 0, y: -1.08, text: "(passive)", showarrow: false, font: { size: 12 } },
    { x: -1.08, y: 0, text: "(negative)", showarrow: false, font: { size: 12 } },
    { x: 1.08, y: 0, text: "(positive)", showarrow: false, font: { size: 12 } },
    // emotion word examples (approx locations)
    { x: -0.75, y: 0.45, text: "frustrated, annoyed", showarrow: false, font: { size: 11, color: "#6b0300" } },
    { x: 0.7, y: 0.45, text: "engaged, focused", showarrow: false, font: { size: 11, color: "#0b4b66" } },
    { x: -0.7, y: -0.45, text: "bored, inattentive", showarrow: false, font: { size: 11, color: "#3a1f5a" } },
    { x: 0.7, y: -0.45, text: "confused, puzzled", showarrow: false, font: { size: 11, color: "#025e73" } },
  ];

  const layout = {
    xaxis: {
      range: [-1, 1],
      zeroline: false,
      showgrid: false,
      title: "Valence",
      tickmode: "array",
      tickvals: [-1, -0.5, 0, 0.5, 1],
      ticktext: ["-1", "-0.5", "0", "0.5", "1"],
    },
    yaxis: {
      range: [-1, 1],
      zeroline: false,
      showgrid: false,
      title: "Arousal",
    },
    shapes: shapes,
    annotations: annotations,
    margin: { l: 60, r: 60, t: 40, b: 60 },
    showlegend: false,
    hovermode: "closest",
    // keep equal aspect ratio
    yaxis: Object.assign({ scaleanchor: "x", scaleratio: 1 }, { range: [-1, 1], title: "Arousal" }),
  };

  Plotly.newPlot(scatterDiv, [trace], layout, { responsive: true, displayModeBar: false });
}

function pushTimeline(data) {
  // allow timeline updates even if Plotly is not available
  const t = new Date().toLocaleTimeString();

  if (timelineChart) {
    timelineChart.data.labels.push(t);
    timelineChart.data.datasets[0].data.push(data.valence);
    timelineChart.data.datasets[1].data.push(data.arousal);
    if (timelineChart.data.labels.length > 60) {
      timelineChart.data.labels.shift();
      timelineChart.data.datasets.forEach((ds) => ds.data.shift());
    }
    timelineChart.update("none");
  }

  // Update Plotly circumplex: convert arousal (0..1) to display coord (-1..1)
  if (scatterChart && typeof Plotly !== "undefined") {
    try {
      const displayArousal = Number(data.arousal) * 2.0 - 1.0;
      // scatterChart is the DOM node used for Plotly
      // show only current live emotion (no history trail)
      Plotly.restyle(scatterChart, { x: [[Number(data.valence)]], y: [[displayArousal]] }, [0]);
    } catch (e) {
      // silent fail to avoid breaking main flow
    }
  }
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

bootstrap();
