const API   = "http://127.0.0.1:5000/api";
const token = localStorage.getItem("token");
if (!token) window.location.href = "login.html";

function authHeaders() {
  return { "Content-Type": "application/json", "Authorization": `Bearer ${token}` };
}

// State 
let timerInterval  = null;
let secondsLeft    = 25 * 60;
let totalSeconds   = 25 * 60;
let goalSeconds    = 45 * 60;
let elapsedSeconds = 0;
let isRunning      = false;
let sessionId      = null;
let activeTask     = null;   // { id, title, subject }
let modeLabel      = "Deep Focus";
let allPickerTasks = [];

const CIRCUMFERENCE = 2 * Math.PI * 100; // r=100

const taskPickerModal    = new bootstrap.Modal(document.getElementById("taskPickerModal"));
const settingsModal      = new bootstrap.Modal(document.getElementById("timerSettingsModal"));


//  Init
async function init() {
  updateDisplay();
  updateRing();
  await loadTasks();
  loadAiInsights();

  // Sidebar start button mirrors main button
  document.getElementById("sidebarStartBtn").addEventListener("click", toggleTimer);
}


//  Timer Core
function toggleTimer() {
  if (isRunning) {
    pauseTimer();
  } else {
    startTimer();
  }
}

async function startTimer() {
  if (secondsLeft <= 0) resetTimer();

  isRunning = true;
  setRunningUI(true);

  // Log session start in DB
  try {
    const res  = await fetch(`${API}/sessions/start`, {
      method:  "POST",
      headers: authHeaders(),
      body:    JSON.stringify({ task_id: activeTask?.id || null })
    });
    const data = await res.json();
    sessionId  = data.id;
  } catch {
    // Continue timer even if DB call fails
  }

  timerInterval = setInterval(tick, 1000);
}

function pauseTimer() {
  isRunning = false;
  clearInterval(timerInterval);
  setRunningUI(false);
}

async function resetTimer() {
  pauseTimer();
  secondsLeft    = totalSeconds;
  elapsedSeconds = 0;
  updateDisplay();
  updateRing();
  updateGoalBar();

  // End session in DB if one is active
  if (sessionId) {
    try {
      await fetch(`${API}/sessions/${sessionId}/end`, {
        method:  "PATCH",
        headers: authHeaders()
      });
    } catch { /* ignore */ }
    sessionId = null;
  }
}

function tick() {
  if (secondsLeft <= 0) {
    onTimerComplete();
    return;
  }
  secondsLeft--;
  elapsedSeconds++;
  updateDisplay();
  updateRing();
  updateGoalBar();
}

async function onTimerComplete() {
  clearInterval(timerInterval);
  isRunning = false;
  setRunningUI(false);
  playDoneSound();

  // End session in DB
  if (sessionId) {
    try {
      await fetch(`${API}/sessions/${sessionId}/end`, {
        method:  "PATCH",
        headers: authHeaders()
      });
    } catch { /* ignore */ }
    sessionId = null;
  }

  alert("Session complete! Great work.");
  secondsLeft = totalSeconds;
  updateDisplay();
  updateRing();
}


//  UI Helpers
function updateDisplay() {
  const m = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const s = String(secondsLeft % 60).padStart(2, "0");
  document.getElementById("timerDisplay").textContent = `${m}:${s}`;
}

function updateRing() {
  const progress = secondsLeft / totalSeconds;
  const offset   = CIRCUMFERENCE * (1 - progress);
  document.getElementById("ringFill").style.strokeDashoffset = offset;
}

function updateGoalBar() {
  const pct = Math.min((elapsedSeconds / goalSeconds) * 100, 100);
  document.getElementById("goalBar").style.width = `${pct}%`;
}

function setRunningUI(running) {
  const btn   = document.getElementById("startStopBtn");
  const icon  = document.getElementById("startStopIcon");
  const label = document.getElementById("startStopLabel");

  btn.classList.toggle("running", running);
  icon.className  = running ? "bi bi-pause-fill me-1" : "bi bi-play-fill me-1";
  label.textContent = running ? "Pause" : "Start Session";
}

function playDoneSound() {
  try {
    const ctx  = new AudioContext();
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1);
    osc.start();
    osc.stop(ctx.currentTime + 1);
  } catch { /* ignore if AudioContext unavailable */ }
}


//  SETTINGS
function applySettings() {
  if (isRunning) {
    alert("Stop the session before changing settings.");
    return;
  }
  const dur  = parseInt(document.getElementById("settingDuration").value) || 25;
  const goal = parseInt(document.getElementById("settingGoal").value)     || 45;
  const mode = document.getElementById("settingMode").value;

  totalSeconds   = dur  * 60;
  goalSeconds    = goal * 60;
  secondsLeft    = totalSeconds;
  elapsedSeconds = 0;
  modeLabel      = mode;

  document.getElementById("goalMinutes").textContent = goal;
  document.getElementById("modeLabel").textContent   = `${mode.toUpperCase()} MODE`;
  document.getElementById("modeDot").className =
    mode === "Light Review" ? "mode-dot break" : "mode-dot";
  document.getElementById("ringFill").classList.toggle("break-mode", mode === "Light Review");

  updateDisplay();
  updateRing();
  updateGoalBar();

  settingsModal.hide();
}

//Task Picker
async function loadTasks() {
  try {
    const res  = await fetch(`${API}/tasks`, { headers: authHeaders() });
    allPickerTasks = await res.json();
  } catch {
    allPickerTasks = [];
  }
}

function openTaskPicker() {
  renderPickerList(allPickerTasks);
  taskPickerModal.show();
}

function filterPickerTasks() {
  const q = document.getElementById("taskPickerSearch").value.toLowerCase();
  renderPickerList(allPickerTasks.filter(t =>
    t.title.toLowerCase().includes(q) || t.subject.toLowerCase().includes(q)
  ));
}

function renderPickerList(tasks) {
  const list = document.getElementById("taskPickerList");
  if (!tasks.length) {
    list.innerHTML = `<div class="task-picker-item"><span class="picker-task-title text-muted">No tasks found</span></div>`;
    return;
  }
  list.innerHTML = tasks.map(t => `
    <div class="task-picker-item ${activeTask?.id === t.id ? "selected" : ""}"
         onclick="selectTask('${t.id}', '${escHtml(t.title)}', '${escHtml(t.subject)}')">
      <span class="picker-task-title">${t.title}</span>
      <span class="picker-task-sub">${t.subject} · Due ${t.due_date ? new Date(t.due_date).toLocaleDateString() : "–"}</span>
    </div>`).join("");
}

function selectTask(id, title, subject) {
  activeTask = { id, title, subject };
  document.getElementById("activeTaskTitle").textContent = title;
  document.getElementById("activeTaskSub").textContent   = subject;
  taskPickerModal.hide();
}

function clearActiveTask() {
  activeTask = null;
  document.getElementById("activeTaskTitle").textContent = "Free Session";
  document.getElementById("activeTaskSub").textContent   = "No task selected";
  taskPickerModal.hide();
}

function escHtml(str) {
  return str.replace(/'/g, "\\'").replace(/"/g, "&quot;");
}


//  AI INSIGHTS
function loadAiInsights() {
  const insights = [
    "Your cognitive rhythm suggests you're most productive now. Try maintaining this session for another 15 minutes before a break.",
    "Reviewing your notes after this session will boost long-term retention by up to 60%.",
    "You've been consistent this week. Keep this momentum — streaks compound over time.",
    "Short breaks between sessions improve focus. Stand up and move for 5 minutes when the timer ends.",
    "Deep work sessions longer than 90 minutes without a break reduce effectiveness. Pace yourself."
  ];
  const tip = insights[new Date().getMinutes() % insights.length];
  document.getElementById("aiInsightText").textContent = `"${tip}"`;
}


init();
