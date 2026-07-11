const API   = "http://127.0.0.1:5000/api";
const token = localStorage.getItem("token");
if (!token) window.location.href = "login.html";

function authHeaders(json = true) {
  const headers = { "Authorization": `Bearer ${token}` };
  if (json) headers["Content-Type"] = "application/json";
  return headers;
}

//Snapshot for discard 
let originalName  = "";
let originalEmail = "";


//  Load Profile
async function loadProfile() {
  try {
    const res  = await fetch(`${API}/profile`, { headers: authHeaders() });
    const data = await res.json();

    // Avatar
    if (data.avatar_url) {
      document.getElementById("profileAvatar").src =
        data.avatar_url.startsWith("/") ? `http://127.0.0.1:5000${data.avatar_url}` : data.avatar_url;
    }

    // Name/email
    document.getElementById("profileName").textContent  = data.name;
    document.getElementById("profileEmail").textContent = data.email;
    document.getElementById("accountName").value        = data.name;
    document.getElementById("accountEmail").value       = data.email;
    originalName  = data.name;
    originalEmail = data.email;

    // Stats
    document.getElementById("statSessions").textContent = data.session_count;
    document.getElementById("statFocus").textContent    = `${data.focus_rate}%`;

    // Preferences
    const prefs = data.preferences || {};
    document.getElementById("prefNotifications").checked = prefs.push_notifications  ?? true;
    document.getElementById("prefDarkMode").checked      = prefs.dark_mode           ?? false;
    document.getElementById("prefSmartBreaks").checked   = prefs.ai_smart_breaks     ?? true;

  } catch (err) {
    console.error("Failed to load profile:", err);
  }
}

//Avatar Upload
async function uploadAvatar(input) {
  const file = input.files[0];
  if (!file) return;

  const formData = new FormData();
  formData.append("avatar", file);

  try {
    const res  = await fetch(`${API}/profile/avatar`, {
      method:  "POST",
      headers: { "Authorization": `Bearer ${token}` },
      body:    formData
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    document.getElementById("profileAvatar").src =
      `http://127.0.0.1:5000${data.avatar_url}`;
  } catch (err) {
    alert("Avatar upload failed: " + err.message);
  }
}

//Preferences
async function savePreferences() {
  const prefs = {
    push_notifications: document.getElementById("prefNotifications").checked,
    dark_mode:          document.getElementById("prefDarkMode").checked,
    ai_smart_breaks:    document.getElementById("prefSmartBreaks").checked
  };

  try {
    const res = await fetch(`${API}/profile/preferences`, {
      method:  "PUT",
      headers: authHeaders(),
      body:    JSON.stringify(prefs)
    });
    if (!res.ok) throw new Error("Failed to save preferences");
  } catch (err) {
    alert("Could not save preferences: " + err.message);
  }
}

//Account Details
async function saveAccountDetails() {
  const name  = document.getElementById("accountName").value.trim();
  const email = document.getElementById("accountEmail").value.trim();

  if (!name || !email) {
    alert("Name and email are required.");
    return;
  }

  try {
    const res  = await fetch(`${API}/profile`, {
      method:  "PUT",
      headers: authHeaders(),
      body:    JSON.stringify({ name, email })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    originalName  = name;
    originalEmail = email;
    document.getElementById("profileName").textContent  = name;
    document.getElementById("profileEmail").textContent = email;

    // Update localStorage user object
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    user.name  = name;
    user.email = email;
    localStorage.setItem("user", JSON.stringify(user));

    showToast("Account details saved.");
  } catch (err) {
    alert("Could not save: " + err.message);
  }
}

function discardAccountChanges() {
  document.getElementById("accountName").value  = originalName;
  document.getElementById("accountEmail").value = originalEmail;
}

//Change Password
async function changePassword() {
  const current  = document.getElementById("currentPassword").value;
  const newPw    = document.getElementById("newPassword").value;
  const confirm  = document.getElementById("confirmPassword").value;
  const errEl    = document.getElementById("pwError");
  errEl.textContent = "";

  if (!current || !newPw || !confirm) {
    errEl.textContent = "All password fields are required.";
    return;
  }
  if (newPw.length < 8) {
    errEl.textContent = "New password must be at least 8 characters.";
    return;
  }
  if (newPw !== confirm) {
    errEl.textContent = "New passwords do not match.";
    return;
  }

  try {
    const res  = await fetch(`${API}/profile/change-password`, {
      method:  "PUT",
      headers: authHeaders(),
      body:    JSON.stringify({ current_password: current, new_password: newPw })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    document.getElementById("currentPassword").value = "";
    document.getElementById("newPassword").value     = "";
    document.getElementById("confirmPassword").value = "";
    showToast("Password updated successfully.");
  } catch (err) {
    errEl.textContent = err.message;
  }
}

//Signout
function signOut() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  window.location.href = "login.html";
}

//Password Toggle
function togglePw(fieldId, btn) {
  const input = document.getElementById(fieldId);
  const icon  = btn.querySelector("i");
  if (input.type === "password") {
    input.type     = "text";
    icon.className = "bi bi-eye-slash";
  } else {
    input.type     = "password";
    icon.className = "bi bi-eye";
  }
}

//Toast Notification
function showToast(message) {
  const toast = document.createElement("div");
  toast.style.cssText = `
    position:fixed; bottom:24px; right:24px; background:#0d1b4b; color:#fff;
    padding:12px 20px; border-radius:10px; font-size:0.85rem; font-weight:600;
    box-shadow:0 4px 16px rgba(0,0,0,0.2); z-index:9999;
    animation: fadeIn 0.2s ease;
  `;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}


loadProfile();
