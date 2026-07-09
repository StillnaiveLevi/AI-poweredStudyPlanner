const API = "http://127.0.0.1:5000/api";
const token = localStorage.getItem("token");
if (!token) window.location.href = "login.html";

function authHeaders() {
  return { "Content-Type": "application/json", "Authorization": `Bearer ${token}` };
}

//  State
let allTasks      = [];
let subjects      = [];
let currentView   = "list";
let activeSubject = "all";
let sortMode      = "due_date";
let priorityMode  = "all";
let deleteTargetId = null;

const taskModal   = new bootstrap.Modal(document.getElementById("taskModal"));
const deleteModal = new bootstrap.Modal(document.getElementById("deleteTaskModal"));

const SORT_MODES     = ["due_date", "priority"];
const SORT_LABELS    = ["Due Date", "Priority"];
const PRIORITY_MODES = ["all", "high", "medium", "low"];
const PRIORITY_LABELS= ["All Priority", "High", "Medium", "Low"];
const DOT_COLORS     = ["#6366f1","#ef4444","#22c55e","#f59e0b","#3b82f6","#ec4899","#14b8a6"];


//  LOAD
async function loadAll() {
  await Promise.all([loadSubjects(), loadTasks(), loadHeatmap()]);
  loadAiTip();
}

async function loadSubjects() {
  const res  = await fetch(`${API}/subjects`, { headers: authHeaders() });
  subjects   = await res.json();
  populateSubjectFilter();
  populateSubjectSelect();
}

async function loadTasks() {
  const params = new URLSearchParams({ sort_by: sortMode });
  if (activeSubject !== "all") params.set("subject_id", activeSubject);
  if (priorityMode  !== "all") params.set("priority", priorityMode);

  const res  = await fetch(`${API}/tasks?${params}`, { headers: authHeaders() });
  allTasks   = await res.json();

  if (currentView === "list") renderListView(allTasks);

  // Also load kanban separately (includes completed)
  if (currentView === "kanban") await loadKanban();

  updateDailyProgress();
}

async function loadKanban() {
  const res   = await fetch(`${API}/tasks?kanban=true`, { headers: authHeaders() });
  const tasks = await res.json();
  renderKanban(tasks);
}

async function loadHeatmap() {
  const res  = await fetch(`${API}/tasks/heatmap`, { headers: authHeaders() });
  const data = await res.json();
  renderHeatmap(data);
}


//  RENDER LIST VIEW
function renderListView(tasks) {
  const search  = document.getElementById("searchInput").value.toLowerCase();
  const filtered = tasks.filter(t =>
    t.title.toLowerCase().includes(search) ||
    t.subject.toLowerCase().includes(search)
  );

  const today    = new Date(); today.setHours(23, 59, 59, 999);
  const todayTasks    = filtered.filter(t => t.due_date && new Date(t.due_date) <= today);
  const upcomingTasks = filtered.filter(t => !t.due_date || new Date(t.due_date) > today);

  document.getElementById("todayTasks").innerHTML    = todayTasks.length
    ? todayTasks.map(taskRowHTML).join("") : emptyState("No tasks due today");
  document.getElementById("upcomingTasks").innerHTML = upcomingTasks.length
    ? upcomingTasks.map(taskRowHTML).join("") : emptyState("No upcoming tasks");
}

function taskRowHTML(t) {
  const isOverdue  = t.due_date && new Date(t.due_date) < new Date() && t.status !== "completed";
  const dueLabel   = t.due_date ? formatDue(new Date(t.due_date), isOverdue) : "";
  const priorityBadge = t.priority === "high"
    ? `<span class="badge-high">HIGH FOCUS</span>`
    : t.priority === "medium" ? `<span class="badge-medium">MEDIUM</span>`
    : `<span class="badge-low">LOW</span>`;
  const done = t.status === "completed";

  return `
    <div class="task-row ${done ? "completed-row" : ""}" id="row-${t.id}">
      <input type="checkbox" class="task-checkbox" ${done ? "checked" : ""}
             onchange="toggleComplete('${t.id}', this.checked)"/>
      <div class="task-body">
        <div class="task-title-row">
          <span class="task-name ${done ? "done" : ""}">${t.title}</span>
          ${priorityBadge}
        </div>
        <div class="task-meta">
          <span><i class="bi bi-journal-text"></i> ${t.subject}</span>
          ${dueLabel ? `<span class="${isOverdue ? "overdue" : ""}"><i class="bi bi-clock"></i> ${dueLabel}</span>` : ""}
          ${t.estimated_minutes ? `<span><i class="bi bi-stopwatch"></i> ${t.estimated_minutes}m Est.</span>` : ""}
        </div>
      </div>
      <div class="task-actions">
        <button title="Edit"   onclick="openEditModal('${t.id}')"><i class="bi bi-pencil"></i></button>
        <button title="Delete" onclick="openDeleteModal('${t.id}')"><i class="bi bi-trash"></i></button>
      </div>
    </div>`;
}

function emptyState(msg) {
  return `<div class="empty-state"><i class="bi bi-check2-all d-block mb-2" style="font-size:1.5rem;"></i>${msg}</div>`;
}

function formatDue(date, overdue) {
  const now  = new Date();
  const diff = Math.round((date - now) / 60000); // minutes
  if (overdue) return `${date.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})} (Overdue)`;
  if (diff < 60) return `In ${diff}m`;
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}


//  RENDER KANBAN
function renderKanban(tasks) {
  const cols = { pending: [], in_progress: [], completed: [] };
  tasks.forEach(t => {
    if (cols[t.status]) cols[t.status].push(t);
    else cols["pending"].push(t);
  });

  ["pending", "in_progress", "completed"].forEach(status => {
    const el = document.getElementById(
      status === "in_progress" ? "kanbanInProgress"
      : status === "completed" ? "kanbanCompleted" : "kanbanPending"
    );
    el.innerHTML = cols[status].length
      ? cols[status].map(t => `
          <div class="kanban-card" onclick="openEditModal('${t.id}')">
            <div class="kanban-card-title">${t.title}</div>
            <div class="kanban-card-meta">
              <span><i class="bi bi-journal-text me-1"></i>${t.subject}</span>
              ${t.due_date ? `<span><i class="bi bi-calendar me-1"></i>${new Date(t.due_date).toLocaleDateString()}</span>` : ""}
              ${t.estimated_minutes ? `<span><i class="bi bi-stopwatch me-1"></i>${t.estimated_minutes}m</span>` : ""}
            </div>
          </div>`).join("")
      : `<div class="empty-state" style="padding:16px;">Empty</div>`;
  });
}


//  SUBJECT FILTER PANEL
async function populateSubjectFilter() {
  const res    = await fetch(`${API}/tasks/subject-counts`, { headers: authHeaders() });
  const counts = await res.json();
  const total  = counts.reduce((s, c) => s + c.count, 0);

  document.getElementById("totalCount").textContent = total;

  const container = document.getElementById("subjectFilter");
  // Remove old subject rows (keep "All Subjects")
  container.querySelectorAll(".subject-filter-item:not([data-id='all'])").forEach(el => el.remove());

  counts.forEach((s, i) => {
    const color = DOT_COLORS[i % DOT_COLORS.length];
    const div   = document.createElement("div");
    div.className = "subject-filter-item";
    div.dataset.id = s.id;
    div.onclick    = () => filterBySubject(s.id, div);
    div.innerHTML  = `
      <span class="subject-dot" style="background:${color};"></span>
      <span class="subject-name">${s.name}</span>
      <span class="subject-count">${s.count}</span>`;
    container.appendChild(div);
  });
}

function filterBySubject(id, el) {
  activeSubject = id;
  document.querySelectorAll(".subject-filter-item").forEach(e => e.classList.remove("active"));
  el.classList.add("active");
  loadTasks();
}


//  HEATMAP
function renderHeatmap(data) {
  const row = document.getElementById("heatmapRow");
  row.innerHTML = "";

  // Build a map of date → count for next 7 days
  const map   = {};
  data.forEach(d => { map[d.date] = d.count; });
  const today = new Date();
  let maxCount = Math.max(1, ...data.map(d => d.count));
  let busyDays = 0;

  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const key   = d.toISOString().split("T")[0];
    const count = map[key] || 0;
    if (count >= 2) busyDays++;
    const level = count === 0 ? 0 : Math.min(4, Math.ceil((count / maxCount) * 4));
    const cell  = document.createElement("div");
    cell.className = `heatmap-cell heat-${level}`;
    cell.title     = `${d.toDateString()}: ${count} task(s)`;
    row.appendChild(cell);
  }

  const majorDeadlines = data.filter(d => d.count >= 2).length;
  document.getElementById("heatmapLabel").textContent =
    majorDeadlines > 0
      ? `Busy week ahead. ${majorDeadlines} major deadline${majorDeadlines > 1 ? "s" : ""}.`
      : "Light week ahead.";
}


//  DAILY PROGRESS
function updateDailyProgress() {
  const todayStr = new Date().toDateString();
  const todayAll  = allTasks.filter(t => t.due_date && new Date(t.due_date).toDateString() === todayStr);

  // Fetch completed today separately isn't available in current tasks (they're filtered out),
  // so we show pending today / total today as progress
  const total   = todayAll.length;
  const pending = todayAll.filter(t => t.status !== "completed").length;
  const done    = total - pending;
  const pct     = total ? Math.round((done / total) * 100) : 0;

  document.getElementById("progressCount").textContent = `${done}/${total}`;
  document.getElementById("progressBar").style.width   = `${pct}%`;
}


//  AI TIP
function loadAiTip() {
  const tips = [
    "You are most productive between 10 AM and 1 PM. Plan high-focus tasks then.",
    "Review your hardest subject first — your mind is freshest early in a session.",
    "Break large tasks into 25-minute sprints for better focus and less fatigue.",
    "Spacing out study sessions improves long-term retention by up to 80%."
  ];
  const tip = tips[new Date().getDay() % tips.length];
  document.getElementById("aiTipText").textContent = `AI Insight: ${tip}`;
}

//  COMPLETE TOGGLE
async function toggleComplete(id, checked) {
  const status = checked ? "completed" : "pending";
  try {
    await fetch(`${API}/tasks/${id}/status`, {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify({ status })
    });
    await loadTasks();
  } catch (err) {
    alert("Failed to update task: " + err.message);
  }
}


//  VIEW TOGGLE
function setView(view) {
  currentView = view;
  document.getElementById("listViewBtn").classList.toggle("active", view === "list");
  document.getElementById("kanbanViewBtn").classList.toggle("active", view === "kanban");
  document.getElementById("listView").style.display   = view === "list"   ? "" : "none";
  document.getElementById("kanbanView").style.display = view === "kanban" ? "" : "none";
  if (view === "kanban") loadKanban();
}


//  SORT & PRIORITY CYCLE
function cycleSort() {
  const idx  = SORT_MODES.indexOf(sortMode);
  sortMode   = SORT_MODES[(idx + 1) % SORT_MODES.length];
  document.getElementById("sortLabel").textContent = SORT_LABELS[SORT_MODES.indexOf(sortMode)];
  loadTasks();
}

function cyclePriority() {
  const idx      = PRIORITY_MODES.indexOf(priorityMode);
  priorityMode   = PRIORITY_MODES[(idx + 1) % PRIORITY_MODES.length];
  document.getElementById("priorityLabel").textContent = PRIORITY_LABELS[PRIORITY_MODES.indexOf(priorityMode)];
  loadTasks();
}


//  MODAL — ADD / EDIT
function populateSubjectSelect() {
  const sel = document.getElementById("taskSubject");
  sel.innerHTML = subjects.map(s =>
    `<option value="${s.id}">${s.name}</option>`
  ).join("");
}

function openAddModal() {
  document.getElementById("taskModalLabel").textContent = "Create Task";
  document.getElementById("editTaskId").value = "";
  document.getElementById("taskTitle").value  = "";
  document.getElementById("taskDesc").value   = "";
  document.getElementById("taskDue").value    = "";
  document.getElementById("taskMins").value   = "";
  document.getElementById("taskPriority").value = "medium";
  document.getElementById("taskStatus").value   = "pending";
  taskModal.show();
}

function openEditModal(id) {
  const t = allTasks.find(x => x.id === id);
  if (!t) return;
  document.getElementById("taskModalLabel").textContent  = "Edit Task";
  document.getElementById("editTaskId").value            = t.id;
  document.getElementById("taskTitle").value             = t.title;
  document.getElementById("taskDesc").value              = t.description;
  document.getElementById("taskDue").value               = t.due_date ? t.due_date.slice(0,16) : "";
  document.getElementById("taskMins").value              = t.estimated_minutes || "";
  document.getElementById("taskPriority").value          = t.priority;
  document.getElementById("taskStatus").value            = t.status;
  document.getElementById("taskSubject").value           = t.subject_id;
  taskModal.show();
}

async function saveTask() {
  const id      = document.getElementById("editTaskId").value;
  const title   = document.getElementById("taskTitle").value.trim();
  const subject = document.getElementById("taskSubject").value;
  const due     = document.getElementById("taskDue").value;

  if (!title)   { alert("Title is required."); return; }
  if (!subject) { alert("Please select a subject."); return; }
  if (!due)     { alert("Due date is required."); return; }

  const payload = {
    title,
    description:       document.getElementById("taskDesc").value.trim(),
    subject_id:        subject,
    due_date:          due,
    priority:          document.getElementById("taskPriority").value,
    status:            document.getElementById("taskStatus").value,
    estimated_minutes: parseInt(document.getElementById("taskMins").value) || null
  };

  try {
    const url    = id ? `${API}/tasks/${id}` : `${API}/tasks`;
    const method = id ? "PUT" : "POST";
    const res    = await fetch(url, { method, headers: authHeaders(), body: JSON.stringify(payload) });
    if (!res.ok) throw new Error(await res.text());
    taskModal.hide();
    await loadAll();
  } catch (err) {
    alert("Error saving task: " + err.message);
  }
}

//  DELETE
function openDeleteModal(id) {
  deleteTargetId = id;
  deleteModal.show();
}

document.getElementById("confirmDeleteTaskBtn").addEventListener("click", async () => {
  if (!deleteTargetId) return;
  try {
    const res = await fetch(`${API}/tasks/${deleteTargetId}`, { method: "DELETE", headers: authHeaders() });
    if (!res.ok) throw new Error(await res.text());
    deleteModal.hide();
    deleteTargetId = null;
    await loadAll();
  } catch (err) {
    alert("Error deleting task: " + err.message);
  }
});


//  SEARCH
document.getElementById("searchInput").addEventListener("input", () => {
  if (currentView === "list") renderListView(allTasks);
});


loadAll();
