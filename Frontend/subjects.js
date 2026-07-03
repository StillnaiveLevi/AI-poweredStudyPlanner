const API = "http://127.0.0.1:5000/api/subjects";
let subjects = [];
let currentView = "grid";
let deleteTargetId = null;

// ── Bootstrap modal instances ──────────────────────────
const subjectModal = new bootstrap.Modal(document.getElementById("subjectModal"));
const deleteModal  = new bootstrap.Modal(document.getElementById("deleteModal"));

// ── Fetch and render all subjects ─────────────────────
async function loadSubjects() {
  try {
    const res = await fetch(API);
    if (!res.ok) throw new Error("Failed to fetch");
    subjects = await res.json();
    renderCards(subjects);
    renderAiInsight(subjects);
  } catch (err) {
    document.getElementById("subjectsGrid").innerHTML =
      `<p class="text-danger px-2">Could not load subjects. Is the backend running?<br><small>${err.message}</small></p>`;
  }
}

// ── Render cards ───────────────────────────────────────
function renderCards(data) {
  const grid = document.getElementById("subjectsGrid");
  grid.innerHTML = "";

  data.forEach(s => {
    const mastery  = Math.min(Math.max(Math.round(s.mastery), 0), 100);
    const barClass = mastery >= 70 ? "bar-high" : mastery >= 40 ? "bar-medium" : "bar-low";
    const icon     = guessIcon(s.name);
    const catLabel = guessCategoryLabel(s.name, s.description);
    const catClass = getCatClass(catLabel);

    const card = document.createElement("div");
    card.className = "subject-card";
    card.innerHTML = `
      <div class="card-top-row">
        <div class="card-icon-wrap"><i class="bi ${icon}"></i></div>
        <div class="card-actions">
          <button title="Edit"   onclick="openEditModal('${s.id}')"><i class="bi bi-pencil"></i></button>
          <button title="Delete" onclick="openDeleteModal('${s.id}')"><i class="bi bi-trash"></i></button>
        </div>
      </div>
      <div>
        <span class="category-badge ${catClass}">${catLabel}</span>
        <div class="subject-name">${s.name}</div>
        <div class="subject-next">${s.next_session ? "Next: " + s.next_session : s.description || ""}</div>
      </div>
      <div>
        <div class="card-footer-row">
          <span class="mastery-label">Mastery: ${mastery}%</span>
          <span>${s.units_done}/${s.units_total} Units</span>
        </div>
        <div class="progress-wrap">
          <div class="progress">
            <div class="progress-bar ${barClass}" style="width:${mastery}%"></div>
          </div>
        </div>
      </div>`;
    grid.appendChild(card);
  });

  // New Subject placeholder
  const placeholder = document.createElement("div");
  placeholder.className = "subject-card new-card";
  placeholder.onclick = openAddModal;
  placeholder.innerHTML = `
    <div class="new-card-inner">
      <div class="new-card-plus"><i class="bi bi-plus-lg"></i></div>
      <p>New Subject</p>
      <small>Broaden your horizons by adding a new academic domain.</small>
    </div>`;
  grid.appendChild(placeholder);
}

// ── Icon guesser (based on subject name keywords) ─────
function guessIcon(name) {
  const n = name.toLowerCase();
  if (n.includes("math") || n.includes("calculus") || n.includes("algebra")) return "bi-calculator";
  if (n.includes("computer") || n.includes("algorithm") || n.includes("data"))  return "bi-cpu";
  if (n.includes("bio") || n.includes("neuro") || n.includes("science"))        return "bi-eyedropper";
  if (n.includes("philo") || n.includes("history") || n.includes("social"))     return "bi-book-half";
  if (n.includes("physics") || n.includes("chem"))                              return "bi-lightning";
  if (n.includes("language") || n.includes("english") || n.includes("lit"))     return "bi-chat-quote";
  return "bi-journal-text";
}

// ── Category label guesser ────────────────────────────
function guessCategoryLabel(name, desc) {
  const n = (name + " " + (desc || "")).toLowerCase();
  if (n.includes("computer") || n.includes("algorithm") || n.includes("software")) return "Computer Science";
  if (n.includes("bio") || n.includes("neuro") || n.includes("chemistry"))         return "Natural Sciences";
  if (n.includes("math") || n.includes("calculus") || n.includes("statistics"))    return "Mathematics";
  if (n.includes("phil") || n.includes("history") || n.includes("social"))         return "Humanities";
  if (n.includes("physics"))                                                         return "Physics";
  if (n.includes("language") || n.includes("english"))                              return "Languages";
  return "General";
}

// ── Category CSS class ────────────────────────────────
function getCatClass(label) {
  const l = label.toLowerCase();
  if (l.includes("computer"))  return "cat-cs";
  if (l.includes("science") || l.includes("physics") || l.includes("bio")) return "cat-science";
  if (l.includes("humanit") || l.includes("phil"))  return "cat-humanities";
  if (l.includes("math"))      return "cat-math";
  return "cat-default";
}

// ── AI Insight ─────────────────────────────────────────
function renderAiInsight(data) {
  if (data.length < 2) return;
  const highest = [...data].sort((a, b) => b.mastery - a.mastery)[0];
  const lowest  = [...data].sort((a, b) => a.mastery - b.mastery)[0];
  document.getElementById("aiText").innerHTML =
    `Based on your recent performance, you are maintaining a high retention rate in ` +
    `<strong style="color:#1e40af">${highest.name}</strong>. ` +
    `We suggest allocating more study cycles to ` +
    `<strong style="color:#1e40af">${lowest.name}</strong> this week to balance your cognitive load.`;
}

// ── View toggle ────────────────────────────────────────
function setView(view) {
  currentView = view;
  document.getElementById("gridViewBtn").classList.toggle("active", view === "grid");
  document.getElementById("listViewBtn").classList.toggle("active", view === "list");
  document.getElementById("subjectsGrid").classList.toggle("list-view", view === "list");
}

// ── Search ─────────────────────────────────────────────
document.getElementById("searchInput").addEventListener("input", function () {
  const q = this.value.toLowerCase();
  renderCards(subjects.filter(s =>
    s.name.toLowerCase().includes(q) || (s.description || "").toLowerCase().includes(q)
  ));
});

// ── Add modal ──────────────────────────────────────────
function openAddModal() {
  document.getElementById("subjectModalLabel").textContent = "Add Subject";
  document.getElementById("editSubjectId").value = "";
  document.getElementById("subjectName").value = "";
  document.getElementById("subjectDescription").value = "";
  subjectModal.show();
}

// ── Edit modal ─────────────────────────────────────────
function openEditModal(id) {
  const s = subjects.find(x => x.id === id);
  if (!s) return;
  document.getElementById("subjectModalLabel").textContent = "Edit Subject";
  document.getElementById("editSubjectId").value = s.id;
  document.getElementById("subjectName").value = s.name;
  document.getElementById("subjectDescription").value = s.description || "";
  subjectModal.show();
}

// ── Save (add or update) ───────────────────────────────
async function saveSubject() {
  const id   = document.getElementById("editSubjectId").value;
  const name = document.getElementById("subjectName").value.trim();
  const desc = document.getElementById("subjectDescription").value.trim();

  if (!name) { alert("Subject name is required."); return; }

  const payload = { subject_name: name, description: desc };

  try {
    const url    = id ? `${API}/${id}` : API;
    const method = id ? "PUT" : "POST";
    const res    = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error(await res.text());
    subjectModal.hide();
    loadSubjects();
  } catch (err) {
    alert("Error saving subject: " + err.message);
  }
}

// ── Delete ─────────────────────────────────────────────
function openDeleteModal(id) {
  deleteTargetId = id;
  deleteModal.show();
}

document.getElementById("confirmDeleteBtn").addEventListener("click", async () => {
  if (!deleteTargetId) return;
  try {
    const res = await fetch(`${API}/${deleteTargetId}`, { method: "DELETE" });
    if (!res.ok) throw new Error(await res.text());
    deleteModal.hide();
    deleteTargetId = null;
    loadSubjects();
  } catch (err) {
    alert("Error deleting: " + err.message);
  }
});

// ── Init ───────────────────────────────────────────────
loadSubjects();
