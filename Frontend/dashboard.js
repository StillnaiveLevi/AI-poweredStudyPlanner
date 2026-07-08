const API = "http://127.0.0.1:5000/api";

// Auth guard
const token = localStorage.getItem("token");
if (!token) window.location.href = "login.html";

function authHeaders() {
  return { "Content-Type": "application/json", "Authorization": `Bearer ${token}` };
}

// Week offset state
let weekOffset = 0;

const DAYS    = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
const TIPS = [
  "Taking a 5-minute movement break every 25 minutes can improve your focus by up to 20%.",
  "Reviewing notes within 24 hours of a study session increases retention by 60%.",
  "Studying in 45-minute focused blocks with 10-minute breaks maximises long-term memory.",
  "Teaching a concept to someone else is one of the most effective ways to master it.",
  "Sleeping 7-8 hours after studying consolidates memory significantly better than cramming."
];

//  LOAD ALL SECTIONS
async function loadDashboard() {
  await Promise.all([
    loadAiInsight(),
    loadWeeklyFocus(),
    loadSchedule(),
    loadHighPriority()
  ]);
  loadTip();
}

// AI Insight
async function loadAiInsight() {
  try {
    const res  = await fetch(`${API}/dashboard/ai-insight`, { headers: authHeaders() });
    const data = await res.json();

    if (!data || data.error) {
      document.getElementById("aiTitle").textContent  = "No pending tasks — you're all caught up!";
      document.getElementById("aiReason").textContent = "Add some tasks to get personalised suggestions.";
      return;
    }

    document.getElementById("aiTitle").textContent  = data.title;
    document.getElementById("aiReason").textContent = data.reason;

    document.getElementById("startNowBtn").onclick = () => {
      localStorage.setItem("activeTaskId", data.task_id);
      window.location.href = "tasks.html";
    };
  } catch {
    document.getElementById("aiTitle").textContent = "Could not load suggestion.";
  }
}

// Weekly Focus
async function loadWeeklyFocus() {
  try {
    const res  = await fetch(`${API}/dashboard/weekly-focus`, { headers: authHeaders() });
    const data = await res.json();

    document.getElementById("focusSub").textContent =
      `You've completed ${data.sessions_completed} of ${data.sessions_planned} planned sessions.`;
    document.getElementById("focusPct").textContent  = `${data.percent}%`;
    document.getElementById("focusBar").style.width  = `${data.percent}%`;
    document.getElementById("statHours").textContent  = data.hours;
    document.getElementById("statStreak").textContent = `${data.streak_days} Days`;
  } catch {
    document.getElementById("focusSub").textContent = "Could not load focus data.";
  }
}

// Study Schedule 
async function loadSchedule() {
  try {
    const res   = await fetch(`${API}/dashboard/schedule?week_offset=${weekOffset}`, { headers: authHeaders() });
    const tasks = await res.json();
    renderCalendar(tasks);
  } catch {
    document.getElementById("calendarGrid").innerHTML =
      `<p class="text-danger small">Could not load schedule.</p>`;
  }
}

function renderCalendar(tasks) {
  const grid  = document.getElementById("calendarGrid");
  const today = new Date();

  // Compute week start (Monday)
  const weekStart = new Date(today);
  const dayOfWeek = (today.getDay() + 6) % 7; // 0=Mon
  weekStart.setDate(today.getDate() - dayOfWeek + weekOffset * 7);
  weekStart.setHours(0, 0, 0, 0);

  // Update week label
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  document.getElementById("weekLabel").textContent =
    `${fmtShort(weekStart)} – ${fmtShort(weekEnd)}`;

  grid.innerHTML = "";

  for (let i = 0; i < 7; i++) {
    const day  = new Date(weekStart);
    day.setDate(weekStart.getDate() + i);

    const isToday = day.toDateString() === today.toDateString();
    const col     = document.createElement("div");
    col.className = "cal-col";

    const dayTasks = tasks.filter(t => {
      const d = new Date(t.due_date);
      return d.toDateString() === day.toDateString();
    });

    col.innerHTML = `
      <div class="cal-day-header">${DAYS[i]}</div>
      <div class="cal-date ${isToday ? "today" : ""}">${day.getDate()}</div>
    `;

    dayTasks.forEach(t => {
      const chip = document.createElement("div");
      const chipClass = isToday ? "chip-current"
        : t.priority === "high"   ? "chip-high"
        : t.priority === "medium" ? "chip-medium" : "chip-low";
      const mins = t.estimated_minutes ? `(${t.estimated_minutes}m)` : "";
      chip.className = `task-chip ${chipClass}`;
      chip.title     = t.subject;
      chip.textContent = `${t.title} ${mins}`.trim();
      col.appendChild(chip);
    });

    grid.appendChild(col);
  }
}

function fmtShort(d) {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// High Priority
async function loadHighPriority() {
  try {
    const res   = await fetch(`${API}/dashboard/high-priority`, { headers: authHeaders() });
    const tasks = await res.json();
    const list  = document.getElementById("priorityList");

    if (!tasks.length) {
      list.innerHTML = `<p class="text-muted small">No high-priority tasks right now.</p>`;
      return;
    }

    list.innerHTML = tasks.map(t => {
      const dotClass = t.priority === "high" ? "dot-high"
                     : t.priority === "medium" ? "dot-medium" : "dot-low";
      const dueLabel = t.days_left === 0 ? "Today"
                     : t.days_left === 1 ? "Tomorrow"
                     : `${t.days_left} days`;
      return `
        <div class="priority-item">
          <span class="priority-dot ${dotClass}"></span>
          <span class="priority-name">${t.title}</span>
          <span class="priority-due">${dueLabel}</span>
        </div>`;
    }).join("");
  } catch {
    document.getElementById("priorityList").innerHTML =
      `<p class="text-danger small">Could not load tasks.</p>`;
  }
}

// Aura Tip
function loadTip() {
  const tip = TIPS[new Date().getDay() % TIPS.length];
  document.getElementById("tipText").textContent = `"${tip}"`;
}

// Week navigation
document.getElementById("prevWeekBtn").addEventListener("click", () => {
  weekOffset--;
  loadSchedule();
});
document.getElementById("nextWeekBtn").addEventListener("click", () => {
  weekOffset++;
  loadSchedule();
});


loadDashboard();
