const API = "http://127.0.0.1:5000/api";

//  Toggle password visibility 
function togglePassword(fieldId, btn) {
  const input = document.getElementById(fieldId);
  const icon  = btn.querySelector("i");
  if (input.type === "password") {
    input.type = "text";
    icon.className = "bi bi-eye-slash";
  } else {
    input.type = "password";
    icon.className = "bi bi-eye";
  }
}

//  Field validation helpers 
function setError(inputId, errorId, message) {
  const wrap = document.getElementById(inputId)?.closest(".input-wrap");
  if (wrap) wrap.classList.toggle("error", !!message);
  const err = document.getElementById(errorId);
  if (err) err.textContent = message;
}

function clearErrors() {
  document.querySelectorAll(".field-error").forEach(el => el.textContent = "");
  document.querySelectorAll(".input-wrap").forEach(el => el.classList.remove("error"));
  document.getElementById("termsError") && (document.getElementById("termsError").textContent = "");
}


//  SIGNUP

const signupForm = document.getElementById("signupForm");

if (signupForm) {
  signupForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearErrors();

    const name     = document.getElementById("fullName").value.trim();
    const email    = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;
    const terms    = document.getElementById("terms").checked;

    // Client-side validation
    let valid = true;
    if (!name) {
      setError("fullName", "nameError", "Full name is required.");
      valid = false;
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("email", "emailError", "Enter a valid email address.");
      valid = false;
    }
    if (password.length < 8) {
      setError("password", "passwordError", "Password must be at least 8 characters.");
      valid = false;
    }
    if (!terms) {
      document.getElementById("termsError").textContent = "You must agree to the terms.";
      valid = false;
    }
    if (!valid) return;

    // Submit
    const btn     = document.getElementById("submitBtn");
    const btnText = document.getElementById("btnText");
    const spinner = document.getElementById("btnSpinner");
    btn.disabled  = true;
    btnText.textContent = "Creating account…";
    spinner.classList.remove("d-none");

    try {
      const res  = await fetch(`${API}/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password })
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Signup failed.");
      }

      // Store token and redirect
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      window.location.href = "subjects.html";

    } catch (err) {
      btnText.textContent = "Create Account";
      spinner.classList.add("d-none");
      btn.disabled = false;
      setError("email", "emailError", err.message);
    }
  });
}


//  LOGIN (used by login.html)
const loginForm = document.getElementById("loginForm");

if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearErrors();

    const email    = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    let valid = true;
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("email", "emailError", "Enter a valid email address.");
      valid = false;
    }
    if (!password) {
      setError("password", "passwordError", "Password is required.");
      valid = false;
    }
    if (!valid) return;

    const btn     = document.getElementById("submitBtn");
    const btnText = document.getElementById("btnText");
    const spinner = document.getElementById("btnSpinner");
    btn.disabled  = true;
    btnText.textContent = "Logging in…";
    spinner.classList.remove("d-none");

    try {
      const res  = await fetch(`${API}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Login failed.");

      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      window.location.href = "subjects.html";

    } catch (err) {
      btnText.textContent = "Log In";
      spinner.classList.add("d-none");
      btn.disabled = false;
      setError("password", "passwordError", err.message);
    }
  });
}
