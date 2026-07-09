from flask import Flask, jsonify, request
from flask_cors import CORS
from functools import wraps
from dotenv import load_dotenv
import os, jwt, bcrypt, datetime
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests

import subjectDao
import authDao
import dashboardDao
import taskDao
import taskDao

load_dotenv()

app = Flask(__name__)
CORS(app)

JWT_SECRET        = os.environ.get("JWT_SECRET")
GOOGLE_CLIENT_ID  = os.environ.get("GOOGLE_CLIENT_ID")
RESEND_API_KEY    = os.environ.get("RESEND_API_KEY")
FRONTEND_URL      = os.environ.get("FRONTEND_URL", "http://127.0.0.1:5500")

import resend
resend.api_key = RESEND_API_KEY


# JWT helpers 

def generate_token(user_id):
    payload = {
        "user_id": user_id,
        "exp": datetime.datetime.utcnow() + datetime.timedelta(days=7)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")


def decode_token(token):
    return jwt.decode(token, JWT_SECRET, algorithms=["HS256"])


# Auth decorator 

def require_auth(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return jsonify({"error": "Missing or invalid token"}), 401
        token = auth_header.split(" ")[1]
        try:
            payload = decode_token(token)
            request.user_id = payload["user_id"]
        except jwt.ExpiredSignatureError:
            return jsonify({"error": "Token expired"}), 401
        except jwt.InvalidTokenError:
            return jsonify({"error": "Invalid token"}), 401
        return f(*args, **kwargs)
    return decorated



#  AUTH ENDPOINTS

@app.route("/api/auth/signup", methods=["POST"])
def signup():
    data = request.get_json()
    name     = (data.get("name") or "").strip()
    email    = (data.get("email") or "").strip().lower()
    password = data.get("password", "")

    if not name or not email or not password:
        return jsonify({"error": "Name, email and password are required."}), 400
    if len(password) < 8:
        return jsonify({"error": "Password must be at least 8 characters."}), 400

    try:
        existing = authDao.find_user_by_email(email)
        if existing:
            return jsonify({"error": "An account with this email already exists."}), 409

        pw_hash = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
        user    = authDao.create_user(name, email, pw_hash)
        token   = generate_token(user["id"])
        return jsonify({"token": token, "user": user}), 201

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/auth/login", methods=["POST"])
def login():
    data     = request.get_json()
    email    = (data.get("email") or "").strip().lower()
    password = data.get("password", "")

    if not email or not password:
        return jsonify({"error": "Email and password are required."}), 400

    try:
        user = authDao.find_user_by_email(email)
        if not user:
            return jsonify({"error": "Invalid email or password."}), 401

        if not user["password_hash"]:
            return jsonify({"error": "This account uses Google sign-in. Please use the Google button."}), 401

        if not bcrypt.checkpw(password.encode(), user["password_hash"].encode()):
            return jsonify({"error": "Invalid email or password."}), 401

        token = generate_token(user["id"])
        safe_user = {k: v for k, v in user.items() if k != "password_hash"}
        return jsonify({"token": token, "user": safe_user}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/auth/google", methods=["POST"])
def google_auth():
    data       = request.get_json()
    credential = data.get("credential")

    if not credential:
        return jsonify({"error": "Missing Google credential"}), 400

    try:
        # Verify the token with Google
        id_info = id_token.verify_oauth2_token(
            credential,
            google_requests.Request(),
            GOOGLE_CLIENT_ID
        )
        name  = id_info.get("name", "")
        email = id_info.get("email", "").lower()

        user  = authDao.find_or_create_google_user(name, email)
        token = generate_token(user["id"])
        safe_user = {k: v for k, v in user.items() if k != "password_hash"}
        return jsonify({"token": token, "user": safe_user}), 200

    except ValueError as e:
        return jsonify({"error": "Invalid Google token: " + str(e)}), 401
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/auth/forgot-password", methods=["POST"])
def forgot_password():
    data  = request.get_json()
    email = (data.get("email") or "").strip().lower()
    if not email:
        return jsonify({"error": "Email is required."}), 400

    try:
        from dbConnection import get_connection
        import secrets, datetime as dt
        conn   = get_connection()
        cursor = conn.cursor()

        cursor.execute("SELECT id FROM public.users WHERE email=%s", (email,))
        row = cursor.fetchone()

        # Always return 200 — never reveal if email exists
        if not row:
            cursor.close(); conn.close()
            return jsonify({"message": "If that email exists, a reset link was sent."}), 200

        user_id    = str(row[0])
        token      = secrets.token_urlsafe(48)
        expires_at = dt.datetime.utcnow() + dt.timedelta(hours=1)

        cursor.execute(
            "UPDATE public.password_resets SET used=TRUE WHERE user_id=%s AND used=FALSE",
            (user_id,)
        )
        cursor.execute("""
            INSERT INTO public.password_resets (user_id, token, expires_at)
            VALUES (%s, %s, %s)
        """, (user_id, token, expires_at))
        conn.commit()
        cursor.close(); conn.close()

        reset_url = f"{FRONTEND_URL}/reset_password.html?token={token}"

        resend.Emails.send({
            "from":    "AuraStudy <onboarding@resend.dev>",
            "to":      [email],
            "subject": "Reset your AuraStudy password",
            "html":    f"""
                <div style="font-family:sans-serif;max-width:480px;margin:auto;">
                  <h2 style="color:#0d1b4b;">Reset your password</h2>
                  <p>We received a request to reset your password.
                     Click the button below — the link expires in <strong>1 hour</strong>.</p>
                  <a href="{reset_url}"
                     style="display:inline-block;padding:12px 28px;background:#1e3a8a;color:#fff;
                            border-radius:8px;text-decoration:none;font-weight:700;margin:16px 0;">
                    Reset Password
                  </a>
                  <p style="color:#888;font-size:0.82rem;">
                    If you didn't request this, you can safely ignore this email.
                  </p>
                </div>
            """
        })

        return jsonify({"message": "If that email exists, a reset link was sent."}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/auth/reset-password", methods=["POST"])
def reset_password():
    data         = request.get_json()
    token        = data.get("token", "")
    new_password = data.get("new_password", "")

    if not token or not new_password:
        return jsonify({"error": "Token and new password are required."}), 400
    if len(new_password) < 8:
        return jsonify({"error": "Password must be at least 8 characters."}), 400

    try:
        from dbConnection import get_connection
        import datetime as dt
        conn   = get_connection()
        cursor = conn.cursor()

        cursor.execute("""
            SELECT user_id, expires_at, used
            FROM   public.password_resets
            WHERE  token = %s
        """, (token,))
        row = cursor.fetchone()

        if not row:
            cursor.close(); conn.close()
            return jsonify({"error": "Invalid or expired reset link."}), 410

        user_id, expires_at, used = row

        if used or expires_at.replace(tzinfo=None) < dt.datetime.utcnow():
            cursor.close(); conn.close()
            return jsonify({"error": "This reset link has expired."}), 410

        pw_hash = bcrypt.hashpw(new_password.encode(), bcrypt.gensalt()).decode()
        cursor.execute("UPDATE public.users SET password_hash=%s WHERE id=%s", (pw_hash, user_id))
        cursor.execute("UPDATE public.password_resets SET used=TRUE WHERE token=%s", (token,))
        conn.commit()
        cursor.close(); conn.close()

        return jsonify({"message": "Password reset successfully."}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


#  SUBJECTS ENDPOINTS  (protected)

@app.route("/api/subjects", methods=["GET"])
@require_auth
def get_subjects():
    try:
        subjects = subjectDao.get_all_subjects(request.user_id)
        return jsonify(subjects), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/subjects", methods=["POST"])
@require_auth
def create_subject():
    data = request.get_json()
    try:
        new_id = subjectDao.add_subject(
            user_id=request.user_id,
            subject_name=data["subject_name"],
            description=data.get("description", "")
        )
        return jsonify({"id": new_id, "message": "Subject created"}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/subjects/<subject_id>", methods=["PUT"])
@require_auth
def edit_subject(subject_id):
    data = request.get_json()
    try:
        subjectDao.update_subject(
            subject_id=subject_id,
            subject_name=data["subject_name"],
            description=data.get("description", "")
        )
        return jsonify({"message": "Subject updated"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/subjects/<subject_id>", methods=["DELETE"])
@require_auth
def remove_subject(subject_id):
    try:
        subjectDao.delete_subject(subject_id)
        return jsonify({"message": "Subject deleted"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500



#  DASHBOARD ENDPOINTS  (protected)

@app.route("/api/dashboard/weekly-focus", methods=["GET"])
@require_auth
def weekly_focus():
    try:
        data = dashboardDao.get_weekly_focus(request.user_id)
        return jsonify(data), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/dashboard/schedule", methods=["GET"])
@require_auth
def weekly_schedule():
    try:
        offset = int(request.args.get("week_offset", 0))
        data   = dashboardDao.get_weekly_schedule(request.user_id, offset)
        return jsonify(data), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/dashboard/high-priority", methods=["GET"])
@require_auth
def high_priority():
    try:
        data = dashboardDao.get_high_priority_tasks(request.user_id)
        return jsonify(data), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/dashboard/ai-insight", methods=["GET"])
@require_auth
def ai_insight():
    try:
        data = dashboardDao.get_ai_insight(request.user_id)
        return jsonify(data), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500



#  TASK ENDPOINTS  (protected)

@app.route("/api/tasks", methods=["GET"])
@require_auth
def get_tasks():
    subject_id = request.args.get("subject_id")
    priority   = request.args.get("priority")
    sort_by    = request.args.get("sort_by", "due_date")
    kanban     = request.args.get("kanban", "false").lower() == "true"
    try:
        if kanban:
            tasks = taskDao.get_all_tasks_including_completed(request.user_id)
        else:
            tasks = taskDao.get_all_tasks(request.user_id, subject_id, priority, sort_by)
        return jsonify(tasks), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/tasks/subject-counts", methods=["GET"])
@require_auth
def task_subject_counts():
    try:
        data = taskDao.get_tasks_by_subject_counts(request.user_id)
        return jsonify(data), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/tasks/heatmap", methods=["GET"])
@require_auth
def task_heatmap():
    try:
        data = taskDao.get_deadline_heatmap(request.user_id)
        return jsonify(data), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/tasks", methods=["POST"])
@require_auth
def create_task():
    data = request.get_json()
    try:
        new_id = taskDao.add_task(
            subject_id        = data["subject_id"],
            title             = data["title"],
            description       = data.get("description", ""),
            due_date          = data["due_date"],
            priority          = data.get("priority", "medium"),
            status            = data.get("status", "pending"),
            estimated_minutes = data.get("estimated_minutes")
        )
        return jsonify({"id": new_id, "message": "Task created"}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/tasks/<task_id>", methods=["PUT"])
@require_auth
def edit_task(task_id):
    data = request.get_json()
    try:
        taskDao.update_task(
            task_id           = task_id,
            title             = data["title"],
            description       = data.get("description", ""),
            due_date          = data["due_date"],
            priority          = data.get("priority", "medium"),
            status            = data.get("status", "pending"),
            estimated_minutes = data.get("estimated_minutes")
        )
        return jsonify({"message": "Task updated"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/tasks/<task_id>/status", methods=["PATCH"])
@require_auth
def patch_task_status(task_id):
    data = request.get_json()
    try:
        taskDao.update_task_status(task_id, data["status"])
        return jsonify({"message": "Status updated"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/tasks/<task_id>", methods=["DELETE"])
@require_auth
def remove_task(task_id):
    try:
        taskDao.delete_task(task_id)
        return jsonify({"message": "Task deleted"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    app.run(debug=True, port=5000)
